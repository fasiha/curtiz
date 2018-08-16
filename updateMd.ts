import * as jdepp from './jdepp';
import * as mecab from './mecabUnidic';

const promisify = require('util').promisify;
const readFile = promisify(require('fs').readFile);

const ebisuVersion = '1';
function addEbisu(block: string[], ebisuInit: string, d?: Date) {
  block.push(ebisuInit + (d || new Date()).toISOString() + ', 4, 4, 1');
}
function checkEbisu(block: string[], ebisuInit: string, d?: Date) {
  if (!block.some(line => line.startsWith(ebisuInit))) { addEbisu(block, ebisuInit, d); }
}
function ultraCompressMecab(vov: mecab.MaybeMorpheme[][]) {
  let ret: any[][] = [];
  for (let v of vov) {
    ret.push(v.map(o => {
      return o ? `${o.literal};${o.pronunciation};${o.lemmaReading};${o.lemma};${o.partOfSpeech.join('-')};${
                     (o.inflectionType || []).join('-')};${(o.inflection || []).join('-')}`
               : o;
    }));
  }
  return ret;
}
class Sentence {
  block: string[];
  init: string = '- ◊sent';
  ebisuInit: string = '  - ◊Ebisu' + ebisuVersion + ': ';
  parsed: mecab.MaybeMorpheme[][] = [];
  parsedString = '';
  tsv = '';
  rawMecab = '';
  constructor(block: string[], d?: Date) {
    this.block = block;
    checkEbisu(this.block, this.ebisuInit, d);
  }
  async addMecab(): Promise<boolean> {
    let text = this.block[0].split(' ').slice(2).join(' ');
    this.rawMecab = await mecab.invokeMecab(text.trim());
    let parsed = mecab.parseMecab(text, this.rawMecab);
    this.parsed = parsed;
    let compressed = ultraCompressMecab(parsed);
    this.parsedString = JSON.stringify(compressed);
    this.tsv = compressed.map(line => line.map(ent => ent ? ent.split(';').join('\t') : '').join('\n')).join('\n');
    return true;
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
    function* zip(...arrs: any[][]) {
      const stop = Math.min(...arrs.map(v => v.length));
      for (let i = 0; i < stop; i++) { yield arrs.map(v => v[i]); }
    }

    let sentences: Sentence[] = [];
    for (let [start, end] of zip(starts, ends)) {
      let thisblock = lines.slice(start, end + 1);
      if (lines[start].indexOf('◊sent') >= 0) {
        let o = new Sentence(thisblock);
        sentences.push(o);
      }
    }
    await Promise.all(sentences.map(s => s.addMecab()));

    for (let s of sentences) {
      console.log(s.block[0]);
      let jdeppRaw = await jdepp.invokeJdepp(s.rawMecab);
      let jdeppSplit = jdepp.parseJdepp('', jdeppRaw);
      let jdeppChunksizes = jdeppSplit.map(v => v.length - 1);
      let chunks = s.tsv.trim().split('\n');
      for (let size of jdeppChunksizes) {
        console.log(chunks.splice(0, size).join('\n'));
        console.log('---');
      }
    }
  })();
}