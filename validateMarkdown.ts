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

const ebisuVersion = '1';
const ebisuInit: string = '  - ◊Ebisu' + ebisuVersion + ' ';
const ebisuDateSeparator = ';';
const ebisuSuperSeparator = ';';

export abstract class Quizzable {
  abstract predict(now?: Date): number;
  abstract extractEbisu(): void;
  abstract updateBlock(): void;
}
export type Content = VocabBlock|SentenceBlock|MorphemeBlock|BunsetsuBlock|string[];

export class VocabBlock extends Quizzable {
  block: string[];
  static init: string = '- ◊vocab'
  seperator: string = ': ';
  reading: string;
  translation: string;
  ebisu?: Ebisu[];
  kanji?: string;
  constructor(block: string[]) {
    super();
    this.block = block;
    let pieces = this.block[0].slice(VocabBlock.init.length).trim().split(this.seperator);
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
}

function hasSingleEbisu(block: string[]): Ebisu|undefined {
  let line = block.find(line => line.startsWith(ebisuInit));
  if (typeof line === 'undefined') { return undefined; }
  return Ebisu.fromString(line.slice(ebisuInit.length).replace(ebisuDateSeparator, Ebisu.fieldSeparator));
}
export class MorphemeBlock extends Quizzable {
  block: string[];
  static init: string = '- ◊morpheme';
  morpheme: Morpheme;
  ebisu?: Ebisu;
  constructor(block?: string[], morpheme?: Morpheme, d?: Date) {
    super();
    if (morpheme) {
      this.morpheme = morpheme;
      if (block) {
        this.block = block;
      } else {
        this.block = [MorphemeBlock.init + ' ' + ultraCompressMorpheme(morpheme)];
      }
    } else {
      if (block) {
        this.morpheme = maybeMorphemeToMorpheme(decompressMorpheme(block[0].slice(MorphemeBlock.init.length).trim()));
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
}
export class BunsetsuBlock extends Quizzable {
  block: string[];
  static init: string = '- ◊bunsetsu';
  bunsetsu: Morpheme[];
  ebisu?: Ebisu;
  constructor(block?: string[], bunsetsu?: Morpheme[]) {
    super();
    if (bunsetsu) {
      this.bunsetsu = bunsetsu;
      if (block) {
        this.block = block;
      } else {
        this.block = [BunsetsuBlock.init + ' ' + ultraCompressMorphemes(bunsetsu)];
      }
    } else {
      if (block) {
        this.bunsetsu =
            maybeMorphemesToMorphemes(decompressMorphemes(block[0].slice(BunsetsuBlock.init.length).trim()));
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
}
export class SentenceBlock extends Quizzable {
  block: string[];
  sentence: string;
  morphemes: Morpheme[] = [];
  bunsetsus: Morpheme[][] = [];
  conjugatedBunsetsus: Morpheme[][] = [];
  particleMorphemes: Morpheme[] = [];
  ebisu?: Ebisu;
  static init: string = '- ◊sent';
  static morphemeStart = '  - ◊morpheme ';
  static bunsetsuStart = '  - ◊bunsetsu ';
  static bunSep = ' :: ';
  static particleMorphemeStart = '  - ◊particle ';
  static conjugatedBunsetsuStart = '  - ◊conjugated ';

  constructor(block: string[]) {
    super();
    this.block = block;
    this.sentence = block[0].slice(SentenceBlock.init.length).trim();
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
      let text = this.block[0].split(' ').slice(2).join(' ');
      let rawMecab = await invokeMecab(text.trim());
      this.morphemes = maybeMorphemesToMorphemes(parseMecab(text, rawMecab)[0].filter(o => !!o));
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
        /*
        // If you want to filter bunsetsu of not-to-be-tested morphemes:
        .filter(m => m && !(m.partOfSpeech[0] === 'supplementary_symbol') &&
                                 !(m.partOfSpeech[0] === 'particle' && m.partOfSpeech[1] === 'phrase_final'))
        */
      } else {
        // only add particles if they're NOT inside conjugated phrases
        this.particleMorphemes = this.particleMorphemes.concat(bunsetsu.filter(
            m => m.partOfSpeech[0].startsWith('particle') && !m.partOfSpeech[1].startsWith('phrase_final')))
      }
    }
  }
}

export function linesToBlocks(lines: string[]): Content[] {
  let starts: number[] = [];
  let ends: number[] = [];

  // Find block starts and stops
  let lino = 0;
  let inside = false;
  const inits = [SentenceBlock, MorphemeBlock, BunsetsuBlock, VocabBlock].map(o => o.init);
  for (let line of lines) {
    if (inside && !line.startsWith('  - ◊')) {
      ends.push(lino - 1);
      inside = false;
    }
    if (!inside && line.startsWith('- ◊') && inits.some(init => line.startsWith(init))) {
      starts.push(lino);
      inside = true;
    }
    lino++;
  }
  if (inside) { ends.push(lino - 1); }

  // Then make an array of Contents: actual blocks for quizzing, and just plain Markdown
  let content: Array<Content> = [];
  if (starts[0] > 0) { content.push(lines.slice(0, starts[0])); }
  for (let [start, end, prevEnd] of zip(starts, ends, [-1].concat(ends.slice(0, -1)))) {
    // push the plain Markdown text before this
    if (prevEnd > 0 && start !== prevEnd + 1) { content.push(lines.slice(prevEnd + 1, start)); }

    // Make an object for this block
    let thisblock = lines.slice(start, end + 1);
    if (lines[start].startsWith(SentenceBlock.init)) {
      content.push(new SentenceBlock(thisblock));
    } else if (lines[start].startsWith(MorphemeBlock.init)) {
      content.push(new MorphemeBlock(thisblock))
    } else if (lines[start].startsWith(BunsetsuBlock.init)) {
      content.push(new BunsetsuBlock(thisblock))
    } else if (lines[start].startsWith(VocabBlock.init)) {
      content.push(new VocabBlock(thisblock))
    } else {
      throw new Error('unknown header, did you forget to add a parser for it here?');
    }
  }
  // if there's more content:
  if (ends[ends.length - 1] < lines.length - 1) { content.push(lines.slice(1 + ends[ends.length - 1])); }
  return content;
}

async function parseAndUpdate(content: Content[]): Promise<Content[]> {
  let sentences: SentenceBlock[] = content.filter(o => o instanceof SentenceBlock) as SentenceBlock[];
  await Promise.all(sentences.map(s => s.parse()));

  // Find existing `MorphemeBlock`s/`BunsetsuBlock`s and cache their first line
  let morphemeBunsetsuToIdx: Map<string, number> = new Map();
  for (let [idx, o] of enumerate(content)) {
    if (o instanceof MorphemeBlock || o instanceof BunsetsuBlock) { morphemeBunsetsuToIdx.set(o.block[0], idx); }
  }

  // For each sentence, make new `MorphemeBlock`s/`BunsetsuBlock`s as needed
  const looper = (mb: Morpheme|Morpheme[]) => {
    let o = mb instanceof Array ? new BunsetsuBlock(undefined, mb) : new MorphemeBlock(undefined, mb);
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

if (require.main === module) {
  const promisify = require('util').promisify;
  const readFile = promisify(require('fs').readFile);
  const writeFile = promisify(require('fs').writeFile);
  (async function() {
    let txt: string = await readFile('test.md', 'utf8');
    let lines = txt.split('\n');
    let content = linesToBlocks(lines);
    content = await parseAndUpdate(content);

    // Print, and create new blocks as needed
    const morphemesToTsv = (b: Morpheme[]) => b.map(ultraCompressMorpheme).join('\n');
    let sentences: SentenceBlock[] = content.filter(o => o instanceof SentenceBlock) as SentenceBlock[];
    for (let s of sentences) {
      console.log(s.block[0]);
      console.log(s.bunsetsus.map(morphemesToTsv).join('\n---\n'));
      console.log(('..' + morphemesToTsv(s.particleMorphemes)).replace(/\n/g, '\n..'));
      console.log(s.conjugatedBunsetsus.map(s => ('>>' + morphemesToTsv(s)).replace(/\n/g, '\n  ')).join('\n'));
    }
    // Save file
    const ensureFinalNewline = (s: string) => s.endsWith('\n') ? s : s + '\n';
    const contentToString = (content: Array<Content>) =>
        ensureFinalNewline(content.map(o => (o instanceof Array ? o : o.block).join('\n')).join('\n'));
    writeFile('test2.md', contentToString(content));
  })();
}