import {Ebisu} from './ebisu';
import * as jdepp from './jdepp';
import {kata2hira} from './kana';
import {goodMorphemePredicate, invokeMecab, maybeMorphemesToMorphemes, Morpheme, parseMecab} from './mecabUnidic';
import {argmin, enumerate, filterRight, flatten, hasKanji} from './utils';

const DEFAULT_HALFLIFE_HOURS = 0.25;
const ebisuVersion = '1';
const ebisuInit: string = '- ◊Ebisu' + ebisuVersion + ' ';

export abstract class Quizzable {
  abstract header: string;
  abstract bullets: Bullet[];
  abstract predict(now?: Date): Predicted|undefined;
  abstract learn(now?: Date, scale?: number): void;
  abstract postQuiz(quizCompleted: Quiz, clozes: string[], results: string[], now?: Date, scale?: number): boolean;
  abstract learned(): boolean;
  abstract numUnlearned(): number;
}
export type Content = Quizzable|string[];
export type Predicted = {
  prob: number,
  quiz: Quiz,
  unlearned: number
};

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
    if (typeof bracketMatch.index !== 'number') { throw new Error('TypeScript pacification: match.index invalid'); }
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

const staggeredDate = (start: number, maxMilliseconds: number = 750) =>
    new Date(start + Math.floor(Math.random() * maxMilliseconds));

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

function lineToEbisu(line: string): {name: string, ebisu: Ebisu}|null {
  const ebisuRegexp = new RegExp('^\\s*' + ebisuInit);
  const nonwsRegexp = /\S+/;
  let res = line.match(ebisuRegexp);
  if (!res) { return null; }
  let withoutInit = line.slice(res[0].length + (res.index || 0));

  res = withoutInit.match(nonwsRegexp);
  if (!res) { return null; }
  let name = res[0];

  let withoutCruft = withoutInit.slice(res[0].length + (res.index || 0));
  let ebisu = Ebisu.fromString(withoutCruft.trim());
  return {name, ebisu};
}
function last<T>(v: T[]): T|undefined { return v[v.length - 1]; }

export abstract class Quiz {
  ebisu?: Ebisu;
  abstract preQuiz(): {contexts: (string|null)[], clozes: string[]};
  abstract toString(): string|null;
};

export class QuizCloze extends Quiz {
  static init = '- ◊cloze ';
  cloze: string;
  sentence: SentenceBlock;
  constructor(sentence: SentenceBlock, particle?: string, line?: string, ebisu?: Ebisu) {
    super();
    this.sentence = sentence;
    if (ebisu) { this.ebisu = ebisu; }
    if (particle) {
      this.cloze = particle;
    } else if (line) {
      let idx = line.indexOf(QuizCloze.init);
      if (idx < 0) { throw new Error('cannot find QuizCloze init'); }
      this.cloze = line.slice(idx + QuizCloze.init.length).trim();
    } else {
      throw new Error('need particle or line')
    }
  }
  preQuiz(): {contexts: (string|null)[], clozes: string[]} {
    let [contexts, clozes] = extractClozed(this.sentence.sentence + ` (${this.sentence.translation})`, this.cloze);
    return {contexts, clozes};
  }
  toString(): string|null {
    return `${QuizCloze.init}${this.cloze}` + (this.ebisu ? `\n  ${ebisuInit}_ ${this.ebisu.toString()}` : ``);
  }
};
export class QuizRelated extends Quiz {
  static init = '- ◊related ';
  fieldSep = '::';
  reading: string;
  translation: string;
  written?: string;
  constructor(line: string, ebisu?: Ebisu) {
    super();
    if (ebisu) { this.ebisu = ebisu; }
    let idx = line.indexOf(QuizRelated.init);
    if (idx < 0) { throw new Error('cannot find QuizRelated init'); }
    let split = line.slice(idx + QuizRelated.init.length).split(this.fieldSep);
    if (!(split.length === 2 || split.length === 3)) { throw new Error('2- or 3-item related not found'); }
    [this.reading, this.translation, this.written] = split.map(s => s.trim());
  }
  preQuiz(): {contexts: (string|null)[], clozes: string[]} {
    if (this.written) { return {contexts: [`${this.written}: enter reading: `, null], clozes: [this.reading]}; }
    return {contexts: [`${this.translation}: enter reading: `, null], clozes: [this.reading]};
  }
  toString(): string|null {
    return `${QuizRelated.init}${
                   [this.reading, this.translation, this.written].filter(x => !!x).join(' ' + this.fieldSep + ' ')}` +
           (this.ebisu ? `\n  ${ebisuInit}_ ${this.ebisu.toString()}` : ``);
  }
};
export class QuizReading extends Quiz {
  static ebisuName: string = 'reading';
  sentence: SentenceBlock;
  constructor(sentence: SentenceBlock, ebisu?: Ebisu) {
    super();
    this.ebisu = ebisu;
    this.sentence = sentence;
  }
  preQuiz(): {contexts: (string|null)[], clozes: string[]} {
    return { contexts: [`${this.sentence.sentence}: enter reading: `, null], clozes: [this.sentence.reading] }
  }
  toString(): string|null {
    return this.ebisu ? `${ebisuInit}${QuizReading.ebisuName} ${this.ebisu.toString()}` : null;
  }
};
type Bullet = string|Quiz;

export class SentenceBlock extends Quizzable {
  header: string;
  bullets: Bullet[];
  sentence: string;
  translation: string;
  reading: string;
  static init: string = '◊sent';
  static fieldSep = '::';

  constructor(block: string[]) {
    super();
    if (!block[0].includes(SentenceBlock.init)) { throw new Error('first entry of text block should contain header'); }
    this.header = block[0];
    {
      const lozengeIdx = block[0].indexOf(SentenceBlock.init);
      if (lozengeIdx < 0) { throw new Error('◊ not found'); }
      const line = block[0].slice(lozengeIdx + SentenceBlock.init.length);
      const pieces = line.split(SentenceBlock.fieldSep);
      if (pieces.length !== 3) { throw new Error('Sentence needs (1) reading, (2) translation, and (3) printed.'); }
      this.sentence = pieces[2].trim();
      this.translation = pieces[1].trim();
      this.reading = pieces[0].trim();
    }

    this.bullets = [];
    if (block.length > 1) {
      const getIndent = (s: string) => (s.match(/^\s*/) || [''])[0].length;
      let initialIndent = getIndent(block[1]);
      let prev: Bullet|undefined;
      for (let [lidx, line] of enumerate(block)) {
        if (lidx === 0) { continue; }
        let thisIndent = getIndent(line);
        let trimmedLine = line.trimLeft();

        if (trimmedLine.startsWith(ebisuInit)) {
          let extracted = lineToEbisu(line)
          if (extracted) {
            let {name, ebisu} = extracted;
            if (name === QuizReading.ebisuName && thisIndent === initialIndent) {
              this.bullets.push(new QuizReading(this, ebisu));
            } else if ((prev = last(this.bullets)) instanceof Quiz && !prev.ebisu) {
              prev.ebisu = ebisu;
            } else {
              this.bullets.push(line);
            }
          }
        } else if (trimmedLine.startsWith(QuizRelated.init) && initialIndent === thisIndent) {
          this.bullets.push(new QuizRelated(line));
        } else if (trimmedLine.startsWith(QuizCloze.init) && initialIndent === thisIndent) {
          this.bullets.push(new QuizCloze(this, undefined, line));
        } else {
          this.bullets.push(line);
        }
      }
    }
    // Required quizzes go here
    if (!this.bullets.some(q => q instanceof QuizReading)) { this.bullets.push(new QuizReading(this)); }
  }
  numUnlearned() { return this.bullets.filter(b => b instanceof Quiz && !b.ebisu).length; }
  learned() { return this.bullets.some(b => b instanceof Quiz && !!b.ebisu); }
  predict(now?: Date): {prob: number, quiz: Quiz, unlearned: number}|undefined {
    let ret: {min?: Quiz, argmin?: number, minmapped?: number} = {};
    let possibleQuizs = this.bullets.filter(b => b instanceof Quiz && b.ebisu) as Quiz[];
    argmin(possibleQuizs, b => b.ebisu ? b.ebisu.predict(now) : Infinity, ret);
    return ret.min ? {prob: ret.minmapped || Infinity, quiz: ret.min, unlearned: this.numUnlearned()} : undefined;
  }
  learn(now?: Date, scale: number = 1) {
    let epoch = now ? now.valueOf() : Date.now();
    for (let b of this.bullets) {
      if (b instanceof Quiz && !b.ebisu) {
        b.ebisu = Ebisu.createDefault(scale * DEFAULT_HALFLIFE_HOURS, undefined,
                                      (b instanceof QuizReading ? new Date(epoch) : staggeredDate(epoch)));
      }
    }
  }
  postQuiz(quizCompleted: Quiz, clozes: string[], results: string[], now?: Date, scale: number = 1): boolean {
    const correct = clozes.every((cloze, cidx) => (cloze === results[cidx]) || (cloze === kata2hira(results[cidx])));
    let epoch = now ? now.valueOf() : Date.now();
    for (let quiz of this.bullets) {
      if (quiz instanceof Quiz) {
        if (quiz === quizCompleted) {
          if (!quiz.ebisu) { throw new Error('refusing to update quiz that was not already learned'); }
          quiz.ebisu.update(correct, now);
        } else {
          if (quiz.ebisu) {
            quiz.ebisu.passiveUpdate(staggeredDate(epoch));
          } else {
            quiz.ebisu = Ebisu.createDefault(scale * DEFAULT_HALFLIFE_HOURS, undefined, staggeredDate(epoch));
          }
        }
      }
    }
    return correct;
  }
  async verify() {
    const pleaseParseRegexp = /^\s*- ◊pleaseParse/;
    if (this.reading === '' || this.bullets.some(s => typeof s === 'string' && pleaseParseRegexp.test(s))) {
      let {bunsetsus} = await parse(this.sentence);
      const parsedReading =
          flatten(bunsetsus)
              .filter(m => m.partOfSpeech[0] !== 'supplementary_symbol')
              .map(m => hasKanji(m.literal) ? kata2hira(m.literal === m.lemma ? m.lemmaReading : m.pronunciation)
                                            : m.literal)
              .join('');
      if (this.reading.length === 0) {
        this.reading = parsedReading;
        let oldHeader = this.header;
        let hit = oldHeader.indexOf(SentenceBlock.init);
        if (hit < 0) { throw new Error('Init string not found in block header?'); }
        let hit2 = oldHeader.indexOf(SentenceBlock.fieldSep, hit + SentenceBlock.init.length);
        if (hit2 < 0) { throw new Error('Separator not found in block header?'); }
        // reading should be between `hit + SentenceBlock.init.length+1` and `hit2`.
        this.header =
            oldHeader.slice(0, hit + SentenceBlock.init.length + 1) + parsedReading + ' ' + oldHeader.slice(hit2);
      }
      this.identifyQuizItems(bunsetsus);
      this.bullets = this.bullets.filter(s => typeof s === 'string' ? !pleaseParseRegexp.test(s) : true);
    }
  }
  identifyQuizItems(bunsetsus: Morpheme[][]) {
    let clozes: Set<string> = new Set([]);
    const particlePredicate = (p: Morpheme) => p.partOfSpeech[0].startsWith('particle') && p.partOfSpeech.length > 1 &&
                                               !p.partOfSpeech[1].startsWith('phrase_final');
    {
      const morphemes = flatten(bunsetsus);
      if (morphemes.length > 1) {
        let relatedMaybeInit = QuizRelated.init.trimRight() + '?? ';
        // purge existing ◊related?? blocks
        this.bullets = this.bullets.filter(s => typeof s === 'string' ? !s.includes(relatedMaybeInit) : true);
        // add ◊related?? blocks
        for (let morpheme of morphemes) {
          if (hasKanji(morpheme.literal)) {
            this.bullets.push(`${relatedMaybeInit}${kata2hira(morpheme.lemmaReading)} :: ? :: ${morpheme.lemma}`)
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
        clozes.add(generateContextClozed(left, cloze, right));
      } else {
        // only add particles if they're NOT inside conjugated phrases
        for (let [pidx, particle] of enumerate(bunsetsu)) {
          if (particlePredicate(particle)) {
            let left =
                bunsetsus.slice(0, bidx).map(bunsetsuToString).join('') + bunsetsuToString(bunsetsu.slice(0, pidx));
            let right =
                bunsetsuToString(bunsetsu.slice(pidx + 1)) + bunsetsus.slice(bidx + 1).map(bunsetsuToString).join('');
            clozes.add(generateContextClozed(left, particle.literal, right));
          }
        }
      }
    }
    let existingClozes = new Set(this.bullets.filter(b => b instanceof QuizCloze).map(q => (q as QuizCloze).cloze));
    for (let p of clozes) {
      if (!existingClozes.has(p)) { this.bullets.push(new QuizCloze(this, p)); }
    }
  }
  toString(): string {
    let ret: (string|null)[] = [this.header];
    ret = ret.concat(this.bullets.map(b => b instanceof Quiz ? b.toString() : b)).filter(x => x !== null);
    return ret.join('\n');
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
export const contentToString = (content: Content[]) =>
    ensureFinalNewline(content.map(o => (o instanceof Quizzable ? o.toString() : o.join('\n'))).join('\n'));

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