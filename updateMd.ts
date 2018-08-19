import * as jdepp from './jdepp';
import * as mecab from './mecabUnidic';

const promisify = require('util').promisify;
const readFile = promisify(require('fs').readFile);
// function* enumerate<T>(v: T[]): IterableIterator<[number, T]> {
//   for (let n = 0; n < v.length; n++) { yield [n, v[n]]; }
// }
function* zip(...arrs: any[][]) {
  const stop = Math.min(...arrs.map(v => v.length));
  for (let i = 0; i < stop; i++) { yield arrs.map(v => v[i]); }
}

const ebisuVersion = '1';
function addEbisu(block: string[], ebisuInit: string, d?: Date) {
  block.push(ebisuInit + (d || new Date()).toISOString() + ', 4, 4, 1');
}
function checkEbisu(block: string[], ebisuInit: string, d?: Date) {
  if (!block.some(line => line.startsWith(ebisuInit))) { addEbisu(block, ebisuInit, d); }
}
function ultraCompressMecab(v: mecab.MaybeMorpheme[]) {
  return v.map(o => {
    return o ? `${o.literal};${o.pronunciation};${o.lemmaReading};${o.lemma};${o.partOfSpeech.join('-')};${
                   (o.inflectionType || []).join('-')};${(o.inflection || []).join('-')}`
             : o;
  });
}
class Sentence {
  block: string[];
  init: string = '- ◊sent';
  ebisuInit: string = '  - ◊Ebisu' + ebisuVersion + ': ';
  morphemes: mecab.MaybeMorpheme[] = [];
  rawMecab = '';
  bunsetsus: mecab.MaybeMorpheme[][] = [];
  conjugatedBunsetsus: mecab.MaybeMorpheme[][] = [];
  particleMorphemes: mecab.MaybeMorpheme[] = [];
  constructor(block: string[], d?: Date) {
    this.block = block;
    checkEbisu(this.block, this.ebisuInit, d);
  }
  async addMecab(): Promise<boolean> {
    let text = this.block[0].split(' ').slice(2).join(' ');
    this.rawMecab = await mecab.invokeMecab(text.trim());
    this.morphemes = mecab.parseMecab(text, this.rawMecab)[0];
    return this.addJdepp();
  }
  async addJdepp(): Promise<boolean> {
    let jdeppRaw = await jdepp.invokeJdepp(this.rawMecab);
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
    this.identifyQuizItems();
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
    for (let line of lines) {
      if (inside && !line.startsWith('  - ◊')) {
        ends.push(lino - 1);
        inside = false;
      }
      if (!inside && line.startsWith('- ◊') && (line.startsWith('- ◊vocab') || line.startsWith('- ◊sent'))) {
        starts.push(lino);
        inside = true;
      }
      lino++;
    }
    if (inside) { ends.push(lino - 1); }

    // Make some objects
    let sentences: Sentence[] = [];
    for (let [start, end] of zip(starts, ends)) {
      let thisblock = lines.slice(start, end + 1);
      if (lines[start].indexOf('◊sent') >= 0) {
        let o = new Sentence(thisblock);
        sentences.push(o);
      }
    }
    await Promise.all(sentences.map(s => s.addMecab()));

    const morphemesToTsv = (b: mecab.MaybeMorpheme[]) =>
        ultraCompressMecab(b).map(ent => ent ? ent.split(';').join('\t') : '').join('\n')
    for (let s of sentences) {
      console.log(s.block[0]);
      for (let b of s.bunsetsus) {
        let tsv = morphemesToTsv(b);
        console.log(tsv);
        console.log('---');
      }
      console.log(morphemesToTsv(s.particleMorphemes));
      console.log(
          s.conjugatedBunsetsus.map(s => morphemesToTsv(s).replace(/\n/g, '\n  ').replace(/^/, '>>')).join('\n'));
    }
  })();
}