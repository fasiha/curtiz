import {Ebisu} from './ebisu';
import * as jdepp from './jdepp';
import {
  decompressMorpheme,
  decompressMorphemes,
  invokeMecab,
  maybeMorphemesToMorphemes,
  maybeMorphemeToMorpheme,
  Morpheme,
  parseMecab,
  ultraCompressMorpheme,
  ultraCompressMorphemes
} from './mecabUnidic';
import {argmin, difference, enumerate, hasKanji, zip} from './utils';

const DEFAULT_HALFLIFE_HOURS = 0.25;
const ebisuVersion = '1';
const ebisuInit: string = '- ◊Ebisu' + ebisuVersion + ' ';
const ebisuDateSeparator = ';';
const ebisuSuperSeparator = ';';

export abstract class Quizzable {
  abstract predict(now?: Date): number;
  abstract extractTopLevelEbisu(): void;
  // abstract updateBlock(): void;
  abstract learn(now?: Date, scale?: number): void;
  abstract block: string[];
  abstract ebisu?: any;
}
export type Content = Quizzable|string[];

function extractClozed(haystack: string, needleWithContext: string): [(string | null)[], string[]] {
  let re = /\[([^\]]+)\]/;
  let bracketMatch = needleWithContext.match(re);
  if (bracketMatch) {
    if (typeof bracketMatch.index !== 'number') { throw new Error('TypeScript pactification: match.index invalid'); }
    let cloze = bracketMatch[1];
    let leftContext = needleWithContext.slice(0, bracketMatch.index);
    let rightContext = needleWithContext.slice(bracketMatch.index + bracketMatch[0].length);
    if (re.test(rightContext)) { throw new Error('More than one context unsupported'); }

    let fullRe = new RegExp(leftContext + cloze + rightContext, 'g');
    let checkContext = fullRe.exec(haystack);
    if (!checkContext) { throw new Error('Needle not found in haystack'); }
    const left = haystack.slice(0, checkContext.index + leftContext.length);
    const right = haystack.slice(checkContext.index + checkContext[0].length);
    if (fullRe.exec(haystack)) { throw new Error('Insufficient cloze context'); }
    return [[left, null, right], [cloze]];
  }
  let cloze = needleWithContext;
  let clozeRe = new RegExp(cloze, 'g');
  let clozeHit = clozeRe.exec(haystack);
  if (clozeHit) {
    let left = haystack.slice(0, clozeHit.index);
    let right = haystack.slice(clozeHit.index + cloze.length);
    if (clozeRe.exec(haystack)) { throw new Error('Cloze context required'); }
    return [[left, null, right], [cloze]];
  }
  throw new Error('Could not find cloze');
}
async function parse(sentence: string): Promise<{morphemes: Morpheme[]; bunsetsus: Morpheme[][];}> {
  let rawMecab = await invokeMecab(sentence);
  let morphemes = maybeMorphemesToMorphemes(parseMecab(sentence, rawMecab)[0].filter(o => !!o));
  let bunsetsus = await addJdepp(rawMecab, morphemes);
  return {morphemes, bunsetsus};
}
async function addJdepp(raw: string, morphemes: Morpheme[]): Promise<Morpheme[][]> {
  let jdeppRaw = await jdepp.invokeJdepp(raw);
  let jdeppSplit = jdepp.parseJdepp('', jdeppRaw);
  let bunsetsus: Morpheme[][] = [];
  {
    let added = 0;
    for (let bunsetsu of jdeppSplit) {
      // -1 because each `bunsetsu` array here will contain a header before the morphemes
      bunsetsus.push(morphemes.slice(added, added + bunsetsu.length - 1));
      added += bunsetsu.length - 1;
    }
  }
  return bunsetsus;
}
function findDashIndex(s: string): number {
  let dashMatch = s.match(/-/);
  if (!dashMatch || dashMatch.index === undefined) { throw new Error('TypeScript pacification: regexp failed?'); }
  return dashMatch.index;
}
function findSubBlockLength(block: string[], startIdx: number): number {
  let headSpaces = findDashIndex(block[startIdx]);
  let subBullets = block.slice(startIdx + 1).findIndex(s => findDashIndex(s) <= headSpaces);
  if (subBullets < 0) { return block.length - startIdx; }
  return subBullets + 1;
}
function blockToFirstEbisu(block: string[]) {
  const ebisuRegexp = new RegExp('^\\s*' + ebisuInit);
  const nonwsRegexp = /\S+/;
  for (let line of block) {
    let res = line.match(ebisuRegexp);
    if (!res) { continue; }
    let withoutInit = line.slice(res[0].length);

    res = withoutInit.match(nonwsRegexp);
    if (!res) { continue; }
    let name = res[0];

    let withoutCruft = withoutInit.slice(res[0].length);
    let ebisu = Ebisu.fromString(withoutCruft.replace(ebisuDateSeparator, Ebisu.fieldSeparator).trim());
    return {name, ebisu};
  }
  return null;
}

export class SentenceBlock extends Quizzable {
  block: string[];
  sentence: string;
  translation: string;
  reading: string;
  clozedConjugations: string[] = [];
  clozedParticles: string[] = [];
  relateds: string[] = [];
  ebisu?: Map<string, Ebisu>;
  static init: string = '◊sent';
  static morphemeStart = '- ◊morpheme ';
  static bunsetsuStart = '- ◊bunsetsu ';
  static bunSep = ' :: ';
  static clozedParticleStart = '- ◊cloze particle ';
  static clozedConjugationStart = '- ◊cloze conjugation ';
  static relatedStart = '- ◊part ';
  static translationSep = '::';

  constructor(block: string[]) {
    super();
    this.block = block;
    const lozengeIdx = block[0].indexOf(SentenceBlock.init);
    if (lozengeIdx < 0) { throw new Error('◊ not found'); }
    const line = block[0].slice(lozengeIdx + SentenceBlock.init.length);
    const pieces = line.split(SentenceBlock.translationSep);
    if (pieces.length !== 3) {
      console.error(block);
      throw new Error('Sentence needs (1) reading, (2) translation, and (3) printed.');
    }
    this.sentence = pieces[2].trim();
    this.translation = pieces[1].trim();
    this.reading = pieces[0].trim();
    this.extractTopLevelEbisu();
    this.extractClozesRelateds();
  }
  extractClozesRelateds() {
    const regexps = [
      SentenceBlock.clozedConjugationStart,
      SentenceBlock.clozedParticleStart,
      SentenceBlock.relatedStart,
    ].map(s => new RegExp('^\\s*' + s));
    const outputs = [
      this.clozedConjugations,
      this.clozedParticles,
      this.relateds,
    ];

    const update =
        (lidx: number, line: string, re: RegExp, dest: string[]) => {
          let match = line.match(re);
          if (match) {
            let withoutInit = line.slice(match[0].length).trim();
            if (withoutInit.length === 0) { throw new Error('cloze conjugation empty?') }
            dest.push(withoutInit);
            let numBullets = findSubBlockLength(this.block, lidx);
            let e = blockToFirstEbisu(this.block.slice(lidx, lidx + numBullets));

            if (e) {
              if (!this.ebisu) { this.ebisu = new Map([]); }
              this.ebisu.set(match[0].trimLeft() + withoutInit, e.ebisu);
              return true;
            } else {
              throw new Error('Could not find Ebisu block?');
            }
          }
          return false;
        }

    for (const [lidx, line] of enumerate(this.block)) {
      for (const [re, dest] of zip(regexps, outputs)) {
        if (update(lidx, line, re, dest)) { break; };
      }
    }
  }
  extractTopLevelEbisu() {
    const acceptableNames = [
      // 'kanji',
      'reading',
    ];
    for (let targetName of acceptableNames) {
      let hit = this.block.find(s => s.indexOf(ebisuInit + targetName + ' ') >= 0);
      if (hit) {
        let e = blockToFirstEbisu([hit]);
        if (!e) { throw new Error('Expected to find Ebisu block'); }
        if (!this.ebisu) { this.ebisu = new Map([]); }
        if (targetName !== e.name) { throw new Error('Unexpected Ebisu name mismatch'); }
        this.ebisu.set(targetName, e.ebisu);
      }
    }
  }
  predict(now?: Date): number {
    if (!this.ebisu) { return Infinity; }
    return Math.min(...Array.from(this.ebisu.values()).map(e => e.predict(now)));
  }
  learn(now?: Date, scale: number = 1) {
    // Reading: required
    // Kanji: optional
    // One for each cloze
    // One for each part.
    this.ebisu = new Map([]);
    const make = () => Ebisu.createDefault(scale * DEFAULT_HALFLIFE_HOURS, undefined, now);
    this.ebisu.set('reading', make());
    // if (hasKanji(this.sentence)) { this.ebisu.set('kanji', make()); }
    for (let p of this.clozedParticles) { this.ebisu.set(SentenceBlock.clozedParticleStart + p, make()); }
    for (let c of this.clozedParticles) { this.ebisu.set(SentenceBlock.clozedConjugationStart + c, make()); }
    for (let r of this.relateds) { this.ebisu.set(SentenceBlock.relatedStart + r, make()); }
  }

  preQuiz(now?: Date, quizName?: string): {quizName: string, contexts: (string|null)[], clozes: string[]} {
    if (!this.ebisu) { throw new Error('Block has not yet been learned: no Ebisu map'); }
    if (!quizName) {
      let findQuiz: {min?: [string, Ebisu]|undefined} = {};
      let quizIdx = argmin(this.ebisu.entries(), ([, v]) => v.predict(now), findQuiz)
      console.log('going to quiz', findQuiz.min);
      if (quizIdx >= 0 && findQuiz.min) {
        quizName = findQuiz.min[0];
      } else {
        throw new Error('Cannot find Ebisu model for quiz');
      }
    } else if (!this.ebisu.has(quizName)) {
      throw new Error('quiz name not found');
    }

    let hit: number;
    if ((hit = quizName.indexOf(SentenceBlock.clozedConjugationStart)) >= 0) {
      let cloze = quizName.slice(hit + SentenceBlock.clozedConjugationStart.length).trim();
      let [contexts, clozes] = extractClozed(this.sentence, cloze);
      return {quizName, contexts, clozes};
    } else if ((hit = quizName.indexOf(SentenceBlock.clozedParticleStart)) >= 0) {
      let cloze = quizName.slice(hit + SentenceBlock.clozedParticleStart.length).trim();
      let [contexts, clozes] = extractClozed(this.sentence, cloze);
      return {quizName, contexts, clozes};
    } else if ((hit = quizName.indexOf(SentenceBlock.relatedStart)) >= 0) {
      let related = quizName.slice(hit + SentenceBlock.relatedStart.length);
      let split = related.split('/');
      if (split.length !== 2) { throw new Error('Two-item related not found'); }
      let [reading, kanji] = split;
      return {quizName, contexts: [`${kanji}: enter reading: `, null], clozes: [reading]};
    } else if (quizName === 'reading') {
      return {quizName, contexts: [`${this.sentence}: enter reading: `, null], clozes: [this.reading]};
    }
    throw new Error('unknown quiz name');
  }
  async verify() {
    const pleaseParseRegexp = /^\s*- ◊pleaseParse/;
    if (this.reading === '' || this.block.some(s => pleaseParseRegexp.test(s))) {
      let {bunsetsus} = await parse(this.sentence);
      this.identifyQuizItems(bunsetsus);
      this.block = this.block.filter(s => !pleaseParseRegexp.test(s));
    }
  }
  identifyQuizItems(bunsetsus: Morpheme[][]) {
    let clozedParticles: Set<string> = new Set([]);
    let clozedConjugations: Set<string> = new Set([]);
    const bunsetsuToString = (morphemes: Morpheme[]) => morphemes.map(m => m.literal).join('');
    for (let bunsetsu of bunsetsus) {
      let first = bunsetsu[0];
      if (!first) { continue; }
      const pos0 = first.partOfSpeech[0];
      if (bunsetsu.length > 1 && (pos0.startsWith('verb') || pos0.startsWith('adject'))) {
        clozedConjugations.add(bunsetsuToString(bunsetsu));
      } else {
        // only add particles if they're NOT inside conjugated phrases
        bunsetsu.filter(m => m.partOfSpeech[0].startsWith('particle') && !m.partOfSpeech[1].startsWith('phrase_final'))
            .forEach(o => clozedParticles.add(o.literal));
      }
    }
    this.extractClozesRelateds();
    const initialSpaces = ' '.repeat(findDashIndex(this.block[1]));
    const update = (newSet: Set<string>, olds: string[], init: string) => {
      let oldsSet = new Set(olds);
      for (let particle of difference(oldsSet, newSet)) {
        let idx = this.block.findIndex(s => s.indexOf(init + particle) >= 0);
        if (idx < 0) { throw new Error('cloze should have been found but was not'); }
        // FIXME should I check that no Ebisu blocks were deleted, and/or if changing/adding purges Ebisu?
        this.block.splice(idx, findSubBlockLength(this.block, idx));
      }
      for (let particle of difference(newSet, oldsSet)) { this.block.push(initialSpaces + init + particle); }
    };
    update(clozedParticles, this.clozedParticles, SentenceBlock.clozedParticleStart);
    update(clozedConjugations, this.clozedConjugations, SentenceBlock.clozedConjugationStart);
    this.clozedParticles = Array.from(clozedParticles);
    this.clozedConjugations = Array.from(clozedConjugations);
  }
}

export function textToBlocks(text: string): Content[] {
  let content: Content[] = [];

  const headerRegexp = /(#+\s+◊)/;
  const bulletRegexp = /(\s*-\s+◊)/;
  let headerLoopRegexp = /(\n#+\s+◊)/g;
  let start = 0;
  let stop = -1;
  let hit;
  while (start >= 0) {
    hit = headerLoopRegexp.exec(text);
    stop = hit ? hit.index : text.length;

    // piece will either start with the first character of the file, or with a header-lozenge-block
    let piece = text.slice(start, stop + 1);
    if (piece.endsWith('\n')) { piece = piece.slice(0, -1); }
    const lines = piece.split('\n');
    let endOfBlock = lines.findIndex(s => !(s.match(headerRegexp) || s.match(bulletRegexp)))
    // last line of file might be header-lozenge-block so:
    if (endOfBlock < 0) { endOfBlock = lines.length; }

    if (endOfBlock === 0) {
      // no lozenge-block found: must be opening text
      content.push(lines);
    } else {
      let block = lines.slice(0, endOfBlock);
      let restText = lines.slice(endOfBlock);
      let line = block[0];
      let lozengeIdx = line.indexOf('◊');
      line = line.slice(lozengeIdx);

      if (line.startsWith(SentenceBlock.init)) {
        content.push(new SentenceBlock(block));
      } else {
        throw new Error('unknown header, did you forget to add a parser for it here?');
      }
      if (restText.length > 0) { content.push(restText); }
    }
    start = hit ? stop + 1 : -1;
    stop = -1;
  }
  return content;
}

const ensureFinalNewline = (s: string) => s.endsWith('\n') ? s : s + '\n';
const contentToString = (content: Array<Content>) =>
    ensureFinalNewline(content.map(o => (o instanceof Array ? o : o.block).join('\n')).join('\n'));

const USAGE = `USAGE:
$ node [this-script.js] [markdown.md]
will validate markdown.md in-place (after creating a markdown.md.bak).`;

if (require.main === module) {
  const promisify = require('util').promisify;
  const readFile = promisify(require('fs').readFile);
  const writeFile = promisify(require('fs').writeFile);
  (async function() {
    if (process.argv.length < 3) {
      console.log(USAGE);
      process.exit(1);
      return;
    }
    // Read Markdown
    const filename = process.argv[2];
    let txt: string = await readFile(filename, 'utf8');
    // Save backup (no await, just run this later)
    writeFile(filename + '.bak', txt);

    // Validate it
    let content = textToBlocks(txt);
    console.log(content);

    let quizs: SentenceBlock[] = content.filter(o => o instanceof SentenceBlock) as SentenceBlock[];
    let q = quizs[0];
    if (q.ebisu) {
      for (let key of q.ebisu.keys()) { console.log(quizs[0].preQuiz(undefined, key)); }
    }

    // Save file
    // writeFile(filename, contentToString(content));
  })();
}