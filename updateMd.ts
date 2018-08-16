import * as mecab from './mecabUnidic';
import partitionBy from './partitionBy';

const promisify = require('util').promisify;
const readFile = promisify(require('fs').readFile);

const ebisuVersion = '1';
function addEbisu(block: string[], ebisuInit: string, d?: Date) {
  block.push(ebisuInit + (d || new Date()).toISOString() + ', 4, 4, 1');
}
function checkEbisu(block: string[], ebisuInit: string, d?: Date) {
  if (!block.some(line => line.startsWith(ebisuInit))) { addEbisu(block, ebisuInit, d); }
}
function compressMecab(vov: mecab.MaybeMorpheme[][]) {
  let ret: any[][] = [];
  for (let v of vov) {
    ret.push(v.map(o => {
      return o ? {
        lt: o.literal,
        pr: o.pronunciation,
        lr: o.lemmaReading,
        lx: o.lemma,
        po: o.partOfSpeech,
        it: o.inflectionType,
        in: o.inflection
      }
               : o;
    }));
  }
  return ret;
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
  constructor(block: string[], d?: Date) {
    this.block = block;
    checkEbisu(this.block, this.ebisuInit, d);
  }
  async addMecab(): Promise<boolean> {
    let text = this.block[0].split(' ').slice(2).join(' ');
    let parsed = mecab.parseMecab(text, await mecab.invokeMecab(text.trim()));
    this.parsed = parsed;
    this.parsedString = JSON.stringify(ultraCompressMecab(parsed));
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

    console.log(sentences);
    // console.log(starts.map(x => x + 1));
    // console.log(ends.map(x => x + 1));
  })();
}