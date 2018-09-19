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
import {enumerate, zip} from './utils';

const DEFAULT_BUNSETSU_MORPHEME_PREFIX = '#### ';
const DEFAULT_HALFLIFE_HOURS = 0.25;
const ebisuVersion = '1';
const ebisuInit: string = '- ◊Ebisu' + ebisuVersion + ' ';
const ebisuDateSeparator = ';';
const ebisuSuperSeparator = ';';

export abstract class Quizzable {
  abstract predict(now?: Date): number;
  abstract extractEbisu(): void;
  abstract updateBlock(): void;
  abstract learn(now?: Date, scale?: number): void;
  abstract block: string[];
  abstract ebisu?: any;
}
export type Content = Quizzable|string[];

export class VocabBlock extends Quizzable {
  block: string[];
  static init: string = '◊vocab'
  seperator: string = ': ';
  reading: string;
  translation: string;
  ebisu?: Ebisu[];
  kanji?: string;
  constructor(block: string[]) {
    super();
    this.block = block;
    const lozengeIdx = block[0].indexOf(VocabBlock.init);
    if (lozengeIdx < 0) { throw new Error('◊ not found'); }
    let pieces = block[0].slice(lozengeIdx + VocabBlock.init.length).trim().split(this.seperator);
    if (pieces.length === 2 || pieces.length === 3) {
      this.reading = pieces[0];
      this.translation = pieces[1];
      if (pieces.length === 3) { this.kanji = pieces[2]; }
    } else {
      throw new Error('Vocab block needs 2 or 3 fields');
    }
    this.extractEbisu();
  }
  extractEbisu() {
    let line = this.block.find(line => line.startsWith(ebisuInit));
    if (typeof line === 'undefined') {
      this.ebisu = undefined;
      return;
    }
    let eString = line.slice(ebisuInit.length);
    let eDate = eString.slice(0, eString.indexOf(ebisuDateSeparator));
    let eSubstrings = eString.slice(eDate.length + ebisuDateSeparator.length).split(ebisuSuperSeparator);
    this.ebisu = eSubstrings.map(s => Ebisu.fromString(eDate + Ebisu.fieldSeparator + s));
  }
  predict(now?: Date): number { return this.ebisu ? Math.min(...this.ebisu.map(o => o.predict(now))) : Infinity; }
  updateBlock() {
    if (this.ebisu) {
      let eString = ebisuInit + this.ebisu[0].lastDate.toISOString() + ebisuDateSeparator + ' ' +
                    this.ebisu.map(e => e.modelToString()).join(ebisuSuperSeparator);
      let eIndex = this.block.findIndex(line => line.startsWith(ebisuInit));
      if (eIndex >= 0) {
        this.block[eIndex] = eString;
      } else {
        this.block.push(eString);
      }
    }
  }
  learn(now?: Date, scale: number = 1) {
    this.ebisu = 'reading,translation,kanji'.split(',').map(
        _ => Ebisu.createDefault(scale * DEFAULT_HALFLIFE_HOURS, undefined, now));
  }
}

function hasSingleEbisu(block: string[]): Ebisu|undefined {
  let line = block.find(line => line.startsWith(ebisuInit));
  if (typeof line === 'undefined') { return undefined; }
  return Ebisu.fromString(line.slice(ebisuInit.length).replace(ebisuDateSeparator, Ebisu.fieldSeparator));
}

export class MorphemeBlock extends Quizzable {
  block: string[];
  static init: string = '◊morpheme';
  morpheme: Morpheme;
  ebisu?: Ebisu;
  constructor(block?: string[], morpheme?: Morpheme, prefix = DEFAULT_BUNSETSU_MORPHEME_PREFIX) {
    super();
    if (morpheme) {
      this.morpheme = morpheme;
      if (block) {
        this.block = block;
      } else {
        this.block = [prefix + MorphemeBlock.init + ' ' + ultraCompressMorpheme(morpheme)];
      }
    } else {
      if (block) {
        const lozengeIdx = block[0].indexOf(MorphemeBlock.init);
        if (lozengeIdx < 0) { throw new Error('◊ not found'); }
        this.morpheme =
            maybeMorphemeToMorpheme(decompressMorpheme(block[0].slice(lozengeIdx + MorphemeBlock.init.length).trim()));
        this.block = block;
      } else {
        throw new Error('Either block or morpheme or both required');
      }
    }
    this.extractEbisu();
  }
  extractEbisu() { this.ebisu = hasSingleEbisu(this.block); }
  predict(now?: Date): number { return this.ebisu ? this.ebisu.predict(now) : Infinity; }
  updateBlock() {
    if (this.ebisu) {
      let eStrings = this.ebisu.toString();
      let eString = ebisuInit + eStrings[0] + ebisuDateSeparator + ' ' + eStrings[1];
      let eIndex = this.block.findIndex(line => line.startsWith(ebisuInit));
      if (eIndex >= 0) {
        this.block[eIndex] = eString;
      } else {
        this.block.push(eString);
      }
    }
  }
  learn(now?: Date, scale: number = 1) {
    this.ebisu = Ebisu.createDefault(scale * DEFAULT_HALFLIFE_HOURS, undefined, now);
  }
}

export class BunsetsuBlock extends Quizzable {
  block: string[];
  static init: string = '◊bunsetsu';
  bunsetsu: Morpheme[];
  ebisu?: Ebisu;
  constructor(block?: string[], bunsetsu?: Morpheme[], prefix = DEFAULT_BUNSETSU_MORPHEME_PREFIX) {
    super();
    if (bunsetsu) {
      this.bunsetsu = bunsetsu;
      if (block) {
        this.block = block;
      } else {
        this.block = [prefix + BunsetsuBlock.init + ' ' + ultraCompressMorphemes(bunsetsu)];
      }
    } else {
      if (block) {
        const lozengeIdx = block[0].indexOf(BunsetsuBlock.init);
        if (lozengeIdx < 0) { throw new Error('◊ not found'); }
        this.bunsetsu = maybeMorphemesToMorphemes(
            decompressMorphemes(block[0].slice(lozengeIdx + BunsetsuBlock.init.length).trim()));
        this.block = block;
      } else {
        throw new Error('Either block or morpheme or both required');
      }
    }
    this.extractEbisu();
  }
  extractEbisu() { this.ebisu = hasSingleEbisu(this.block); }
  predict(now?: Date): number { return this.ebisu ? this.ebisu.predict(now) : Infinity; }
  updateBlock() {
    if (this.ebisu) {
      let eStrings = this.ebisu.toString();
      let eString = ebisuInit + eStrings[0] + ebisuDateSeparator + ' ' + eStrings[1];
      let eIndex = this.block.findIndex(line => line.startsWith(ebisuInit));
      if (eIndex >= 0) {
        this.block[eIndex] = eString;
      } else {
        this.block.push(eString);
      }
    }
  }
  learn(now?: Date, scale: number = 1) {
    this.ebisu = Ebisu.createDefault(scale * DEFAULT_HALFLIFE_HOURS, undefined, now);
  }
}
export class SentenceBlock extends Quizzable {
  block: string[];
  sentence: string;
  translation: string;
  morphemes: Morpheme[] = [];
  bunsetsus: Morpheme[][] = [];
  conjugatedBunsetsus: Morpheme[][] = [];
  particleMorphemes: Morpheme[] = [];
  ebisu?: Ebisu;
  static init: string = '◊sent';
  static morphemeStart = '- ◊morpheme ';
  static bunsetsuStart = '- ◊bunsetsu ';
  static bunSep = ' :: ';
  static particleMorphemeStart = '- ◊particle ';
  static conjugatedBunsetsuStart = '- ◊conjugated ';
  static translationSep = '::';

  constructor(block: string[]) {
    super();
    this.block = block;
    const lozengeIdx = block[0].indexOf(SentenceBlock.init);
    if (lozengeIdx < 0) { throw new Error('◊ not found'); }
    const line = block[0].slice(lozengeIdx + SentenceBlock.init.length);
    const pieces = line.split(SentenceBlock.translationSep);
    this.sentence = pieces[0].trim();
    this.translation = pieces[1] ? pieces[1].trim() : '';
    this.extractEbisu();
  }
  extractEbisu() { this.ebisu = hasSingleEbisu(this.block); }
  predict(now?: Date): number { return this.ebisu ? this.ebisu.predict(now) : Infinity; }
  updateBlock() {
    if (this.ebisu) {
      let eStrings = this.ebisu.toString();
      let eString = ebisuInit + eStrings[0] + ebisuDateSeparator + ' ' + eStrings[1];
      let eIndex = this.block.findIndex(line => line.startsWith(ebisuInit));
      if (eIndex >= 0) {
        this.block[eIndex] = eString;
      } else {
        this.block.push(eString);
      }
    }
  }
  blockToMorphemes(): Morpheme[] {
    return this.block.filter(s => s.startsWith(SentenceBlock.morphemeStart))
        .map(s => maybeMorphemeToMorpheme(decompressMorpheme(s.slice(SentenceBlock.morphemeStart.length))));
  }
  findAndParseBunsetsuLine(): string[] {
    let line = this.block.find(s => s.startsWith(SentenceBlock.bunsetsuStart)) || '';
    return line.slice(SentenceBlock.bunsetsuStart.length).split(SentenceBlock.bunSep);
  }
  hasParsed(): boolean {
    let morphemes = this.blockToMorphemes();
    if (morphemes.length === 0) { return false; }
    let reconstructed = morphemes.map(m => m.literal).join('');
    let bunsetsuReconstructed = this.findAndParseBunsetsuLine().join('');
    return (reconstructed === this.sentence) && (bunsetsuReconstructed === this.sentence);
  }
  saveParsed(): void {
    for (let m of this.morphemes) { this.block.push(SentenceBlock.morphemeStart + ultraCompressMorpheme(m)); }
    this.block.push(SentenceBlock.bunsetsuStart +
                    this.bunsetsus.map(v => v.filter(o => o).map(o => o.literal).join('')).join(SentenceBlock.bunSep));
    for (let m of this.particleMorphemes) { this.block.push(SentenceBlock.particleMorphemeStart + (m.literal)) }
    for (let b of this.conjugatedBunsetsus) {
      this.block.push(SentenceBlock.conjugatedBunsetsuStart + b.map(o => o.literal).join(''));
    }
  }
  async parse(): Promise<boolean> {
    if (!this.hasParsed()) {
      let rawMecab = await invokeMecab(this.sentence);
      this.morphemes = maybeMorphemesToMorphemes(parseMecab(this.sentence, rawMecab)[0].filter(o => !!o));
      await this.addJdepp(rawMecab);
      this.identifyQuizItems();
      this.saveParsed();
      return false;
    }
    this.morphemes = this.blockToMorphemes();
    let bunsetsuGuide = this.findAndParseBunsetsuLine();
    // morphemes:  [lit1, lit2, lit3, lit4, lit5, lit6]
    // bun. guide: [lit1lit2, lit3, lit4lit5lit6]
    // desired:    [lit1, lit2], [lit3], [lit4, lit5, lit6]
    this.bunsetsus = [];
    {
      let lits = this.morphemes.map(o => o ? o.literal : '');
      let added = 0;
      for (let bun of bunsetsuGuide) {
        let litSum = '';
        for (let [litidx, lit] of enumerate(lits)) {
          litSum += lit;
          if (litSum === bun) {
            this.bunsetsus.push(this.morphemes.slice(added, added + litidx + 1));
            lits = lits.slice(litidx + 1);
            added += litidx + 1;
            break;
          }
        }
      }
    }
    this.identifyQuizItems();
    return true;
  }
  async addJdepp(raw: string): Promise<boolean> {
    let jdeppRaw = await jdepp.invokeJdepp(raw);
    let jdeppSplit = jdepp.parseJdepp('', jdeppRaw);
    this.bunsetsus = [];
    {
      let added = 0;
      for (let bunsetsu of jdeppSplit) {
        // -1 because each `bunsetsu` array here will contain a header before the morphemes
        this.bunsetsus.push(this.morphemes.slice(added, added + bunsetsu.length - 1));
        added += bunsetsu.length - 1;
      }
    }
    // morphemes and bunsetesus filled
    return true;
  }
  identifyQuizItems() {
    this.particleMorphemes = [];
    this.conjugatedBunsetsus = [];
    for (let bunsetsu of this.bunsetsus) {
      let first = bunsetsu[0];
      if (!first) { continue; }
      const pos0 = first.partOfSpeech[0];
      if (bunsetsu.length > 1 && (pos0.startsWith('verb') || pos0.startsWith('adject'))) {
        this.conjugatedBunsetsus.push(bunsetsu);
      } else {
        // only add particles if they're NOT inside conjugated phrases
        this.particleMorphemes = this.particleMorphemes.concat(bunsetsu.filter(
            m => m.partOfSpeech[0].startsWith('particle') && !m.partOfSpeech[1].startsWith('phrase_final')))
      }
    }
  }
  learn(now?: Date, scale: number = 1) {
    this.ebisu = Ebisu.createDefault(scale * DEFAULT_HALFLIFE_HOURS, undefined, now);
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
      } else if (line.startsWith(MorphemeBlock.init)) {
        content.push(new MorphemeBlock(block))
      } else if (line.startsWith(BunsetsuBlock.init)) {
        content.push(new BunsetsuBlock(block))
      } else if (line.startsWith(VocabBlock.init)) {
        content.push(new VocabBlock(block))
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

export async function parseAndUpdate(content: Content[],
                                     prefix = DEFAULT_BUNSETSU_MORPHEME_PREFIX): Promise<Content[]> {
  let sentences: SentenceBlock[] = content.filter(o => o instanceof SentenceBlock) as SentenceBlock[];
  await Promise.all(sentences.map(s => s.parse()));

  // Find existing `MorphemeBlock`s/`BunsetsuBlock`s and cache their first line
  let morphemeBunsetsuToIdx: Map<string, number> = new Map();
  for (let [idx, o] of enumerate(content)) {
    if (o instanceof MorphemeBlock || o instanceof BunsetsuBlock) { morphemeBunsetsuToIdx.set(o.block[0], idx); }
  }

  // For each sentence, make new `MorphemeBlock`s/`BunsetsuBlock`s as needed
  const looper = (mb: Morpheme|Morpheme[]) => {
    let o = mb instanceof Array ? new BunsetsuBlock(undefined, mb, prefix) : new MorphemeBlock(undefined, mb, prefix);
    if (!morphemeBunsetsuToIdx.has(o.block[0])) {
      morphemeBunsetsuToIdx.set(o.block[0], content.length);
      content.push(o);
    }
  };
  for (let s of sentences) {
    s.particleMorphemes.forEach(looper);
    s.conjugatedBunsetsus.forEach(looper);
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
    content = await parseAndUpdate(content);

    // Save file
    writeFile(filename, contentToString(content));
  })();
}