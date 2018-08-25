import * as jdepp from './jdepp';
import * as mecab from './mecabUnidic';

const promisify = require('util').promisify;
const readFile = promisify(require('fs').readFile);
const writeFile = promisify(require('fs').writeFile);
function* enumerate<T>(v: T[]): IterableIterator<[number, T]> {
  for (let n = 0; n < v.length; n++) { yield [n, v[n]]; }
}
function* zip(...arrs: any[][]) {
  const stop = Math.min(...arrs.map(v => v.length));
  for (let i = 0; i < stop; i++) { yield arrs.map(v => v[i]); }
}

const ebisuVersion = '1';
const ebisuInit: string = '  - ◊Ebisu' + ebisuVersion + ' ';
function addEbisu(block: string[], ebisuInit: string, d?: Date) {
  block.push(ebisuInit + (d || new Date()).toISOString() + ', 4, 4, 1');
}
function checkEbisu(block: string[], ebisuInit: string, d?: Date) {
  if (!block.some(line => line.startsWith(ebisuInit))) { addEbisu(block, ebisuInit, d); }
}
const MORPHEMESEP = '\t';
const BUNSETSUSEP = '::';
const ELEMENTSEP = '-';
function ultraCompressMorpheme(m: mecab.MaybeMorpheme): string {
  return m ? [m.literal, m.pronunciation, m.lemmaReading, m.lemma, m.partOfSpeech.join(ELEMENTSEP),
                         (m.inflectionType || []).join(ELEMENTSEP), (m.inflection || []).join(ELEMENTSEP)].join(MORPHEMESEP) : '';
}
function ultraCompressMorphemes(ms: mecab.MaybeMorpheme[]): string {
  return ms.map(ultraCompressMorpheme).join(BUNSETSUSEP);
}
function decompressMorpheme(s: string): mecab.MaybeMorpheme {
  const split = (s: string) => s.split(ELEMENTSEP);
  const nullable = (v: any[]) => v.length ? v : null;
  if (s === '') { return null; }
  let [literal, pronunciation, lemmaReading, lemma, partOfSpeech, inflectionType, inflection] = s.split(MORPHEMESEP);
  return {
    literal,
    pronunciation,
    lemmaReading,
    lemma,
    partOfSpeech: split(partOfSpeech),
    inflectionType: nullable(split(inflectionType || '')),
    inflection: nullable(split(inflection || ''))
  };
}
function decompressMorphemes(s: string): mecab.MaybeMorpheme[] { return s.split(BUNSETSUSEP).map(decompressMorpheme); }

type Content = VocabBlock|SentenceBlock|MorphemeBlock|BunsetsuBlock|string[];
class VocabBlock {
  block: string[];
  static init: string = '- ◊vocab'
  seperator: string = ': ';

  reading: string;
  translation: string;
  kanji?: string;
  constructor(block: string[], d?: Date) {
    this.block = block;
    checkEbisu(this.block, ebisuInit, d);
    let pieces = this.block[0].slice(VocabBlock.init.length).trim().split(this.seperator);
    if (pieces.length === 2 || pieces.length === 3) {
      this.reading = pieces[0];
      this.translation = pieces[1];
      if (pieces.length === 3) { this.kanji = pieces[2]; }
    } else {
      throw new Error('Vocab block needs 2 or 3 fields');
    }
  }
}
class MorphemeBlock {
  block: string[];
  static init: string = '- ◊morpheme';
  morpheme: mecab.MaybeMorpheme;
  constructor(block?: string[], morpheme?: mecab.MaybeMorpheme, d?: Date) {
    if (morpheme) {
      this.morpheme = morpheme;
      if (block) {
        this.block = block;
      } else {
        this.block = [MorphemeBlock.init + ' ' + ultraCompressMorpheme(morpheme)];
      }
    } else {
      if (block) {
        this.morpheme = decompressMorpheme(block[0].slice(MorphemeBlock.init.length).trim());
        this.block = block;
      } else {
        throw new Error('Either block or morpheme or both required');
      }
    }
    checkEbisu(this.block, ebisuInit, d);
  }
}
class BunsetsuBlock {
  block: string[];
  static init: string = '- ◊bunsetsu';
  bunsetsu: mecab.MaybeMorpheme[];
  constructor(block?: string[], bunsetsu?: mecab.MaybeMorpheme[], d?: Date) {
    if (bunsetsu) {
      this.bunsetsu = bunsetsu;
      if (block) {
        this.block = block;
      } else {
        this.block = [BunsetsuBlock.init + ' ' + ultraCompressMorphemes(bunsetsu)];
      }
    } else {
      if (block) {
        this.bunsetsu = decompressMorphemes(block[0].slice(BunsetsuBlock.init.length).trim());
        this.block = block;
      } else {
        throw new Error('Either block or morpheme or both required');
      }
    }
    checkEbisu(this.block, ebisuInit, d);
  }
}
class SentenceBlock {
  block: string[];
  sentence: string;
  static init: string = '- ◊sent';
  morphemeStart = '  - ◊morpheme ';
  bunsetsuStart = '  - ◊bunsetsu ';
  bunSep = ' :: ';
  particleMorphemeStart = '  - ◊particle '
  conjugatedBunsetsuStart = '  - ◊conjugated '

  morphemes: mecab.MaybeMorpheme[] = [];
  bunsetsus: mecab.MaybeMorpheme[][] = [];
  conjugatedBunsetsus: mecab.MaybeMorpheme[][] = [];
  particleMorphemes: mecab.MaybeMorpheme[] = [];
  constructor(block: string[], d?: Date) {
    this.block = block;
    this.sentence = block[0].slice(SentenceBlock.init.length).trim();
    checkEbisu(this.block, ebisuInit, d);
  }
  blockToMorphemes(): mecab.MaybeMorpheme[] {
    return this.block.filter(s => s.startsWith(this.morphemeStart))
        .map(s => decompressMorpheme(s.slice(this.morphemeStart.length)));
  }
  findAndParseBunsetsuLine(): string[] {
    let line = this.block.find(s => s.startsWith(this.bunsetsuStart)) || '';
    return line.slice(this.bunsetsuStart.length).split(this.bunSep);
  }
  hasParsed(): boolean {
    let morphemes = this.blockToMorphemes();
    if (morphemes.length === 0) { return false; }
    let reconstructed = morphemes.map(m => m && m.literal).join('');
    let bunsetsuReconstructed = this.findAndParseBunsetsuLine().join('');
    return (reconstructed === this.sentence) && (bunsetsuReconstructed === this.sentence);
  }
  saveParsed(): void {
    for (let m of this.morphemes) { this.block.push(this.morphemeStart + ultraCompressMorpheme(m)); }
    this.block.push(this.bunsetsuStart +
                    this.bunsetsus.map(v => v.filter(o => o).map(o => o && o.literal).join('')).join(this.bunSep));
    for (let m of this.particleMorphemes) { this.block.push(this.particleMorphemeStart + (m && m.literal)) }
    for (let b of this.conjugatedBunsetsus) {
      this.block.push(this.conjugatedBunsetsuStart + b.map(o => o && o.literal).join(''));
    }
  }
  async parse(): Promise<boolean> {
    if (!this.hasParsed()) {
      let text = this.block[0].split(' ').slice(2).join(' ');
      let rawMecab = await mecab.invokeMecab(text.trim());
      this.morphemes = mecab.parseMecab(text, rawMecab)[0].filter(o => o);
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
        this.conjugatedBunsetsus.push(
            bunsetsu.filter(m => m && !(m.partOfSpeech[0] === 'supplementary_symbol') &&
                                 !(m.partOfSpeech[0] === 'particle' && m.partOfSpeech[1] === 'phrase_final')));
      } else {
        // only add particles if they're NOT inside conjugated phrases
        this.particleMorphemes = this.particleMorphemes.concat(bunsetsu.filter(
            m => m && m.partOfSpeech[0].startsWith('particle') && !m.partOfSpeech[1].startsWith('phrase_final')))
      }
    }
  }
}

if (require.main === module) {
  (async function() {
    var txt: string = await readFile('test.md', 'utf8');

    // Find blocks
    var starts: number[] = [];
    var ends: number[] = [];

    let lino = 0;
    let inside = false;
    var lines = txt.split('\n');
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

    // Make some objects
    let content: Array<Content> = [];
    let morphemeBunsetsuToIdx: Map<string, number> = new Map();
    if (starts[0] > 0) { content.push(lines.slice(0, starts[0])); }
    for (let [start, end, prevEnd] of zip(starts, ends, [-1].concat(ends.slice(0, -1)))) {
      // push the content before this
      if (prevEnd > 0 && start !== prevEnd + 1) { content.push(lines.slice(prevEnd + 1, start)); }
      let thisblock = lines.slice(start, end + 1);
      if (lines[start].startsWith(SentenceBlock.init)) {
        let o = new SentenceBlock(thisblock);
        content.push(o);
      } else if (lines[start].startsWith(MorphemeBlock.init)) {
        morphemeBunsetsuToIdx.set(thisblock[0], content.length);
        content.push(new MorphemeBlock(thisblock))
      } else if (lines[start].startsWith(BunsetsuBlock.init)) {
        morphemeBunsetsuToIdx.set(thisblock[0], content.length);
        content.push(new BunsetsuBlock(thisblock))
      } else if (lines[start].startsWith(VocabBlock.init)) {
        content.push(new VocabBlock(thisblock))
      } else {
        throw new Error('unknown header, did you forget to add a parser for it here?');
      }
    }
    // if there's more content:
    if (ends[ends.length - 1] < lines.length) { content.push(lines.slice(1 + ends[ends.length - 1])); }

    // Send off content to MeCab and Jdepp
    let sentences: SentenceBlock[] = content.filter(o => o instanceof SentenceBlock) as SentenceBlock[];
    await Promise.all(sentences.map(s => s.parse()));

    // Print, and create new blocks as needed
    const morphemesToTsv = (b: mecab.MaybeMorpheme[]) => b.map(ultraCompressMorpheme).join('\n');
    for (let s of sentences) {
      console.log(s.block[0]);
      console.log(s.bunsetsus.map(morphemesToTsv).join('\n---\n'));
      console.log(('..' + morphemesToTsv(s.particleMorphemes)).replace(/\n/g, '\n..'));
      console.log(s.conjugatedBunsetsus.map(s => ('>>' + morphemesToTsv(s)).replace(/\n/g, '\n  ')).join('\n'));
      for (let m of s.particleMorphemes) {
        let mb = new MorphemeBlock(undefined, m);
        if (!morphemeBunsetsuToIdx.has(mb.block[0])) {
          morphemeBunsetsuToIdx.set(mb.block[0], content.length);
          content.push(mb);
        }
      }
      for (let b of s.conjugatedBunsetsus) {
        let bb = new BunsetsuBlock(undefined, b);
        if (!morphemeBunsetsuToIdx.has(bb.block[0])) {
          morphemeBunsetsuToIdx.set(bb.block[0], content.length);
          content.push(bb);
        }
      }
      // TODO how to refactor above two loops and simplify them?
    }
    // Save file
    const ensureFinalNewline = (s: string) => s.endsWith('\n') ? s : s + '\n';
    const contentToString = (content: Array<Content>) =>
        ensureFinalNewline(content.map(o => (o instanceof Array ? o : o.block).join('\n')).join('\n'));
    writeFile('test2.md', contentToString(content));
  })();
}