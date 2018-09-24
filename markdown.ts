import {Ebisu} from './ebisu';
import * as jdepp from './jdepp';
import {kata2hira} from './kana';
import {goodMorphemePredicate, invokeMecab, maybeMorphemesToMorphemes, Morpheme, parseMecab} from './mecabUnidic';
import {argmin, enumerate, filterRight, flatten, hasKanji, setEq, zip} from './utils';

const DEFAULT_HALFLIFE_HOURS = 0.25;
const ebisuVersion = '1';
const ebisuInit: string = '- ◊Ebisu' + ebisuVersion + ' ';
const ebisuDateSeparator = ';';

export abstract class Quizzable {
  abstract predict(now?: Date, ebisu?: any): number;
  abstract learn(now?: Date, scale?: number): void;
  abstract preQuiz(now?: Date, quizName?: string): {quizName: string, contexts: (string|null)[], clozes: string[]};
  abstract postQuiz(quizName: string, clozes: string[], results: string[], now?: Date): boolean;
  abstract block: string[];
  abstract ebisu?: any;
}
export type Content = Quizzable|string[];

/**
 * Ensure needle is found in haystack only once
 * @param haystack big string
 * @param needle little string
 */
function appearsExactlyOnce(haystack: string, needle: string): boolean {
  let hit: number;
  return (hit = haystack.indexOf(needle)) >= 0 && (hit = haystack.indexOf(needle, hit + 1)) < 0;
}
/**
 * Given three consecuties substrings (the arguments), return either
 * - `${left2}[${cloze}]${right2}` where `left2` and `right2` are as short as possible (and of equal length, if
 *    possible) so the this return string (minus the brackets) is unique in the full string, or
 * - `${cloze}` if `left2 === right2 === ''` (i.e., the above but without the brackets).
 * @param left left string, possibly empty
 * @param cloze middle string
 * @param right right string, possible empty
 * @throws in the unlikely event that such a return string cannot be build (I cannot think of an example though)
 */
function generateContextClozed(left: string, cloze: string, right: string): string {
  const sentence = left + cloze + right;
  let leftContext = '';
  let rightContext = '';
  let contextLength = 0;
  while (!appearsExactlyOnce(sentence, leftContext + cloze + rightContext)) {
    contextLength++;
    if (contextLength >= left.length && contextLength >= right.length) {
      throw new Error('Ran out of context to build unique cloze');
    }
    leftContext = left.slice(-contextLength);
    rightContext = right.slice(0, contextLength);
  }
  if (leftContext === '' && rightContext === '') { return cloze; }
  return `${leftContext}[${cloze}]${rightContext}`;
}

/**
 * Given a big string and a substring, which can be either
 * - a strict substring or
 * - a cloze-deleted string like "left[cloze]right", where only "cloze" should be treated as the substring of interest
 * but where "left" and "right" uniquely determine which appearance of "cloze" in the big string is desired,
 *
 * break the big string into two arrays:
 * 1. [the content to the *left* of the substring/cloze, `null`, the content to the *right* of the substring/cloze], and
 * 1. [the substring/cloze].
 *
 * Replacing `null` in the first array with the contents of the second array will yield `haystack` again.
 * @param haystack Long string
 * @param needleMaybeContext
 */
function extractClozed(haystack: string, needleMaybeContext: string): [(string | null)[], string[]] {
  let re = /\[([^\]]+)\]/;
  let bracketMatch = needleMaybeContext.match(re);
  if (bracketMatch) {
    if (typeof bracketMatch.index !== 'number') { throw new Error('TypeScript pactification: match.index invalid'); }
    let cloze = bracketMatch[1];
    let leftContext = needleMaybeContext.slice(0, bracketMatch.index);
    let rightContext = needleMaybeContext.slice(bracketMatch.index + bracketMatch[0].length);
    if (re.test(rightContext)) { throw new Error('More than one context unsupported'); }

    let fullRe = new RegExp(leftContext + cloze + rightContext, 'g');
    let checkContext = fullRe.exec(haystack);
    if (!checkContext) { throw new Error('Needle not found in haystack'); }
    const left = haystack.slice(0, checkContext.index + leftContext.length);
    const right = haystack.slice(checkContext.index + checkContext[0].length - rightContext.length);
    if (fullRe.exec(haystack)) { throw new Error('Insufficient cloze context'); }
    return [[left, null, right], [cloze]];
  }
  let cloze = needleMaybeContext;
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

const bunsetsuToString = (morphemes: Morpheme[]) => morphemes.map(m => m.literal).join('');

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

function blockToFirstEbisu(block: string[], status?: {lino?: number}) {
  const ebisuRegexp = new RegExp('^\\s*' + ebisuInit);
  const nonwsRegexp = /\S+/;
  for (let [lidx, line] of enumerate(block)) {
    let res = line.match(ebisuRegexp);
    if (!res) { continue; }
    let withoutInit = line.slice(res[0].length);

    res = withoutInit.match(nonwsRegexp);
    if (!res) { continue; }
    let name = res[0];

    let withoutCruft = withoutInit.slice(res[0].length);
    let ebisu = Ebisu.fromString(withoutCruft.replace(ebisuDateSeparator, Ebisu.fieldSeparator).trim());
    if (status) { status.lino = lidx; }
    return {name, ebisu};
  }
  return null;
}

function updateBlockEbisu(block: string[], startIdx: number, ebisu: Ebisu) {
  let rows = findSubBlockLength(block, startIdx);
  const ebisuRegexp = new RegExp('^\\s*' + ebisuInit + '[^ ]+ ');
  for (let [lidx, line] of enumerate(block.slice(startIdx, startIdx + rows))) {
    let hit = line.match(ebisuRegexp);
    if (!hit) { continue; }
    let eStrings = ebisu.toString();
    let eString = hit[0] + eStrings[0] + ebisuDateSeparator + ' ' + eStrings[1];
    block[lidx + startIdx] = eString;
    return;
  }
  throw new Error('Ebisu not found in block, cannot update')
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
  ebisuNameToLino: Map<string, number> = new Map([]);
  clozeNameToLino: Map<string, number> = new Map([]);
  static init: string = '◊sent';
  static clozedParticleStart = '- ◊cloze particle ';
  static clozedConjugationStart = '- ◊cloze conjugation ';
  static relatedStart = '- ◊related ';
  static fieldSep = '::';

  constructor(block: string[]) {
    super();
    this.block = block;
    const lozengeIdx = block[0].indexOf(SentenceBlock.init);
    if (lozengeIdx < 0) { throw new Error('◊ not found'); }
    const line = block[0].slice(lozengeIdx + SentenceBlock.init.length);
    const pieces = line.split(SentenceBlock.fieldSep);
    if (pieces.length !== 3) { throw new Error('Sentence needs (1) reading, (2) translation, and (3) printed.'); }
    this.sentence = pieces[2].trim();
    this.translation = pieces[1].trim();
    this.reading = pieces[0].trim();
    this.extractAll();
  }
  extractAll() {
    for (const key of this.ebisuNameToLino.keys()) { this.ebisuNameToLino.delete(key); }
    for (const key of this.clozeNameToLino.keys()) { this.clozeNameToLino.delete(key); }
    this.extractTopLevelEbisu();
    this.extractClozesRelatedsAndEbisu();
  }
  extractClozesRelatedsAndEbisu() {
    const regexps = [
      SentenceBlock.clozedConjugationStart,
      SentenceBlock.clozedParticleStart,
      SentenceBlock.relatedStart,
    ].map(s => new RegExp('^\\s*' + s));

    this.clozedConjugations = [];
    this.clozedParticles = [];
    this.relateds = [];

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
            let title = match[0].trimLeft() + withoutInit;
            this.clozeNameToLino.set(title, lidx);

            let numBullets = findSubBlockLength(this.block, lidx);
            let status = {lino: -1};
            let e = blockToFirstEbisu(this.block.slice(lidx, lidx + numBullets), status);
            if (e) {
              if (!this.ebisu) { this.ebisu = new Map([]); }
              this.ebisu.set(title, e.ebisu);
              if (status.lino < 0) { throw new Error('Ebisu made but lino not found?') }
              this.ebisuNameToLino.set(title, lidx + status.lino);
            }
            return true;
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
      this.ebisuNameToLino.delete(targetName);
      this.clozeNameToLino.delete(targetName); // and don't add!
      let hit = this.block.findIndex(s => s.indexOf(ebisuInit + targetName + ' ') >= 0);
      if (hit >= 0) {
        let e = blockToFirstEbisu([this.block[hit]]);
        if (!e) { throw new Error('Expected to find Ebisu block'); }
        if (!this.ebisu) { this.ebisu = new Map([]); }
        if (targetName !== e.name) { throw new Error('Unexpected Ebisu name mismatch'); }
        this.ebisu.set(targetName, e.ebisu);
        this.ebisuNameToLino.set(targetName, hit);
      }
    }
  }
  predict(now?: Date, ebisu?: {ebisu?: Ebisu}): number {
    if (!this.ebisu) { return Infinity; }
    if (!ebisu) { return Math.min(...Array.from(this.ebisu.values(), e => e.predict(now))); }
    // If predict asked for the lowest-probability Ebisu object:
    let status: {min?: Ebisu, minmapped?: number} = {};
    argmin(Array.from(this.ebisu.values()), e => e.predict(now), status);
    ebisu.ebisu = status.min;
    return typeof status.minmapped === 'undefined' ? Infinity : status.minmapped;
  }
  learn(now?: Date, scale: number = 1) {
    now = now || new Date();
    this.ebisu = new Map([]);
    const make = () => Ebisu.createDefault(scale * DEFAULT_HALFLIFE_HOURS, undefined, now);

    const looper = (v: string[], init: string, map: Map<string, Ebisu>) => {
      for (let p of v) {
        let name = init + p;
        let ebisu = make();
        map.set(name, ebisu);
        let headerIdx = this.clozeNameToLino.get(name);
        if (typeof headerIdx === 'number') {
          let dash = this.block[headerIdx].indexOf('-');
          if (dash < 0) { throw new Error('Failed to find dash of bullet'); }
          let spaces = ' '.repeat(dash + 2);
          let eStrings = ebisu.toString();
          this.block.splice(headerIdx + 1, 0,
                            spaces + ebisuInit + '_' +
                                ' ' + eStrings[0] + ebisuDateSeparator + ' ' + eStrings[1]);
          for (let [k, v] of this.clozeNameToLino) {
            if (v > headerIdx) { this.clozeNameToLino.set(k, v + 1); }
          }
        } else {
          throw new Error('Quiz name not found in clozeNameToLino:' + name);
        }
      }
    };
    looper(this.clozedParticles, SentenceBlock.clozedParticleStart, this.ebisu);
    looper(this.clozedConjugations, SentenceBlock.clozedConjugationStart, this.ebisu);
    looper(this.relateds, SentenceBlock.relatedStart, this.ebisu);

    // kanji to be decided
    for (let name of 'reading'.split(',')) {
      let ebisu = make();
      this.ebisu.set(name, ebisu);
      let eStrings = ebisu.toString();
      this.block.push(ebisuInit + name + ' ' + eStrings[0] + ebisuDateSeparator + ' ' + eStrings[1])
    }

    this.extractAll();
  }
  preQuiz(now?: Date, quizName?: string): {quizName: string, contexts: (string|null)[], clozes: string[]} {
    if (!this.ebisu) { throw new Error('Block has not yet been learned: no Ebisu map'); }
    if (!quizName) {
      let findQuiz: {min?: [string, Ebisu]|undefined} = {};
      let quizIdx = argmin(this.ebisu.entries(), ([, v]) => v.predict(now), findQuiz)
      if (quizIdx >= 0 && findQuiz.min) { quizName = findQuiz.min[0]; }
      else {
        throw new Error('Cannot find Ebisu model for quiz');
      }
    } else if (!this.ebisu.has(quizName)) {
      throw new Error('quiz name not found');
    }

    let hit: number;
    if ((hit = quizName.indexOf(SentenceBlock.clozedConjugationStart)) >= 0) {
      let cloze = quizName.slice(hit + SentenceBlock.clozedConjugationStart.length).trim();
      let [contexts, clozes] = extractClozed(this.sentence + ` (${this.translation})`, cloze);
      return {quizName, contexts, clozes};
    } else if ((hit = quizName.indexOf(SentenceBlock.clozedParticleStart)) >= 0) {
      let cloze = quizName.slice(hit + SentenceBlock.clozedParticleStart.length).trim();
      let [contexts, clozes] = extractClozed(this.sentence + ` (${this.translation})`, cloze);
      return {quizName, contexts, clozes};
    } else if ((hit = quizName.indexOf(SentenceBlock.relatedStart)) >= 0) {
      let related = quizName.slice(hit + SentenceBlock.relatedStart.length);
      let split = related.split(SentenceBlock.fieldSep);
      if (!(split.length === 2 || split.length === 3)) { throw new Error('2- or 3-item related not found'); }
      let [reading, translation, kanji] = split.map(s => s.trim());
      if (kanji) { return {quizName, contexts: [`${kanji}: enter reading: `, null], clozes: [reading]}; }
      return {quizName, contexts: [`${translation}: enter reading: `, null], clozes: [reading]};
    } else if (quizName === 'reading') {
      return {quizName, contexts: [`${this.sentence}: enter reading: `, null], clozes: [this.reading]};
    }
    throw new Error('unknown quiz name');
  }
  postQuiz(quizName: string, clozes: string[], results: string[], now?: Date): boolean {
    if (!this.ebisu) { throw new Error('Block has not yet been learned: no Ebisu map'); }
    const correct = clozes.every((cloze, cidx) => (cloze === results[cidx]) || (cloze === kata2hira(results[cidx])));
    for (let [name, ebisu] of this.ebisu) {
      if (name === quizName) {
        ebisu.update(correct, now);
      } else {
        ebisu.passiveUpdate(now);
      }
      const idx = this.ebisuNameToLino.get(name);
      if (typeof idx !== 'number') { throw new Error('TypeScript pacification: name->index failed') }
      updateBlockEbisu(this.block, idx, ebisu);
    }
    return correct;
  }
  async verify() {
    const pleaseParseRegexp = /^\s*- ◊pleaseParse/;
    if (this.reading === '' || this.block.some(s => pleaseParseRegexp.test(s))) {
      let {bunsetsus} = await parse(this.sentence);
      const parsedReading =
          flatten(bunsetsus)
              .filter(m => m.partOfSpeech[0] !== 'supplementary_symbol')
              .map(m => hasKanji(m.literal) ? kata2hira(m.literal === m.lemma ? m.lemmaReading : m.pronunciation)
                                            : m.literal)
              .join('');
      if (this.reading !== parsedReading) {
        if (this.reading.length === 0) {
          this.reading = parsedReading;
          let oldHeader = this.block[0];
          let hit = oldHeader.indexOf(SentenceBlock.init);
          if (hit < 0) { throw new Error('Init string not found in block header?'); }
          let hit2 = oldHeader.indexOf(SentenceBlock.fieldSep, hit + SentenceBlock.init.length);
          if (hit2 < 0) { throw new Error('Separator not found in block header?'); }
          // reading should be between `hit + SentenceBlock.init.length+1` and `hit2`.
          let newHeader =
              oldHeader.slice(0, hit + SentenceBlock.init.length + 1) + parsedReading + ' ' + oldHeader.slice(hit2);
          this.block[0] = newHeader;
        }
      }
      this.identifyQuizItems(bunsetsus);
      this.block = this.block.filter(s => !pleaseParseRegexp.test(s));
      this.extractAll();
    }
  }
  identifyQuizItems(bunsetsus: Morpheme[][]) {
    let clozedParticles: Set<string> = new Set([]);
    let clozedConjugations: Set<string> = new Set([]);
    const particlePredicate = (p: Morpheme) => p.partOfSpeech[0].startsWith('particle') && p.partOfSpeech.length > 1 &&
                                               !p.partOfSpeech[1].startsWith('phrase_final');
    {
      const morphemes = flatten(bunsetsus);
      if (morphemes.length > 1) {
        let relatedMaybeInit = SentenceBlock.relatedStart.trimRight() + '?? ';
        // purge existing ◊related?? blocks
        this.block = this.block.filter(s => !s.includes(relatedMaybeInit));
        // add ◊related?? blocks
        for (let morpheme of morphemes) {
          if (hasKanji(morpheme.literal)) {
            this.block.push(`${relatedMaybeInit}${kata2hira(morpheme.lemmaReading)} :: ? :: ${morpheme.lemma}`)
          }
        }
      }
    }
    for (let [bidx, bunsetsu] of enumerate(bunsetsus)) {
      let first = bunsetsu[0];
      if (!first) { continue; }
      const pos0 = first.partOfSpeech[0];
      if (bunsetsu.length > 1 && (pos0.startsWith('verb') || pos0.endsWith('_verb') || pos0.startsWith('adject'))) {
        let ignoreRight = filterRight(bunsetsu, m => !goodMorphemePredicate(m));
        let cloze = bunsetsuToString(ignoreRight.length === 0 ? bunsetsu : bunsetsu.slice(0, -ignoreRight.length));
        let left = bunsetsus.slice(0, bidx).map(bunsetsuToString).join('');
        let right = bunsetsuToString(ignoreRight) + bunsetsus.slice(bidx + 1).map(bunsetsuToString).join('');
        clozedConjugations.add(generateContextClozed(left, cloze, right));
      } else {
        // only add particles if they're NOT inside conjugated phrases
        for (let [pidx, particle] of enumerate(bunsetsu)) {
          if (particlePredicate(particle)) {
            let left =
                bunsetsus.slice(0, bidx).map(bunsetsuToString).join('') + bunsetsuToString(bunsetsu.slice(0, pidx));
            let right =
                bunsetsuToString(bunsetsu.slice(pidx + 1)) + bunsetsus.slice(bidx + 1).map(bunsetsuToString).join('');
            clozedParticles.add(generateContextClozed(left, particle.literal, right));
          }
        }
      }
    }
    if (setEq(clozedParticles, new Set(this.clozedParticles)) &&
        setEq(clozedConjugations, new Set(this.clozedConjugations))) {
      // all done.
      return;
    }
    // Existing clozes don't match parsed ones. FIXME doesn't handle over-determined contexts for clozes
    if (this.ebisu && this.ebisu.size > 0) {
      throw new Error('Refusing to modify clozes/readings for learned items (with Ebisu models)');
    }
    // Delete all existing clozes and insert new ones
    let linos: number[] = Array.from(this.clozeNameToLino.keys())
                              .filter(o => o.indexOf(SentenceBlock.clozedConjugationStart) >= 0 ||
                                           o.indexOf(SentenceBlock.clozedParticleStart) >= 0)
                              .map(k => this.clozeNameToLino.get(k)) as number[];
    if (linos.some(n => typeof n === 'undefined')) { throw new Error('cloze not found in clozeNameToLino'); }
    if (linos.length !== this.clozedParticles.length + this.clozedConjugations.length) {
      throw new Error('Did not find equal number of clozes and line starts');
    }
    // Important: delete from the end!
    linos.sort((a, b) => b - a);
    for (let lino of linos) {
      let nbullets = findSubBlockLength(this.block, lino);
      this.block.splice(lino, nbullets);
    }
    const initialSpaces = ' '.repeat(this.block[1] ? findDashIndex(this.block[1]) : 0);
    for (let c of clozedConjugations) { this.block.push(initialSpaces + SentenceBlock.clozedConjugationStart + c); }
    for (let p of clozedParticles) { this.block.push(initialSpaces + SentenceBlock.clozedParticleStart + p); }
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

export async function verifyAll(content: Content[]) {
  return Promise.all(content.filter(c => c instanceof SentenceBlock).map(o => (o as SentenceBlock).verify()));
}

const ensureFinalNewline = (s: string) => s.endsWith('\n') ? s : s + '\n';
const contentToString = (content: Content[]) =>
    ensureFinalNewline(content.map(o => (o instanceof Array ? o : o.block).join('\n')).join('\n'));

const USAGE = `USAGE:
$ node [this-script.js] [markdown.md]
will print a parsed version of the input Markdown.`;

if (require.main === module) {
  const promisify = require('util').promisify;
  const readFile = promisify(require('fs').readFile);
  (async function() {
    if (process.argv.length < 3) {
      console.log(USAGE);
      process.exit(1);
      return;
    }
    // Read Markdown
    const filename = process.argv[2];
    let txt: string = await readFile(filename, 'utf8');

    // Validate it
    let content = textToBlocks(txt);
    await verifyAll(content);
    console.log(contentToString(content));
  })();
}