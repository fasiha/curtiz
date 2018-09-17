#!/usr/bin/env node

const USAGE = `USAGE:
For a quiz:
    $ node [this-script.js] quiz [markdown.md]
For learning:
    $ node [this-script.js] learn [markdown.md]
Either of these will overwrite markdown.md (after creating markdown.md.bak backup).

For Ebisu-related scheduling debug information:
    $ node [this-script.js] ebisu [markdown.md]
`;

import {kata2hira} from './kana';
import {fill} from './cliFillInTheBlanks';
import {cliPrompt} from './cliPrompt';
import {
  BunsetsuBlock,
  Content,
  MorphemeBlock,
  parseAndUpdate,
  Quizzable,
  SentenceBlock,
  textToBlocks,
  VocabBlock
} from './markdown';
import {Morpheme, ultraCompressMorpheme, ultraCompressMorphemes} from './mecabUnidic';
import {argmin, enumerate, fillHoles} from './utils';
import {Ebisu} from './ebisu';

const bunsetsuToString = (morphemes: Morpheme[]) => morphemes.map(m => m.literal).join('');
const morphemesToTsv = (b: Morpheme[]) => b.map(ultraCompressMorpheme).join('\n');
const ensureFinalNewline = (s: string) => s.endsWith('\n') ? s : s + '\n';
const contentToString = (content: Array<Content>) =>
    ensureFinalNewline(content.map(o => (o instanceof Array ? o : o.block).join('\n')).join('\n'));

async function cloze(clozes: Array<string|null>): Promise<string[]> {
  let numberOfParticles = 0;
  let printableCloze = clozes.map(o => o ? o : `(${++numberOfParticles})`);
  console.log(`Fill in the numbered blanks:\n${printableCloze.join('')}\nEnter text or "# text":`);
  let responses: string[] = Array.from(Array(numberOfParticles), _ => '');
  await fill((thisResponse: string) => {
    // Most expected use case: type "a" enter "b" enter to fill in two blanks.
    // Less likely: "2 b" enter "a" enter to fill in the second blank first.
    // ("1 a" above should be fine too)
    let numHit = thisResponse.match(/^([0-9]+)/);
    if (numHit) {
      let num = parseInt(numHit[0]);
      if (num <= numberOfParticles) {
        // Don't expand the array
        let rest = thisResponse.slice(numHit[0].length).trim();
        responses[num - 1] = rest;
      }
    } else {
      let firstEmpty = responses.findIndex(o => !o);
      if (firstEmpty >= 0) {
        responses[firstEmpty] = thisResponse.trim();
      } else {
        responses.push(thisResponse.trim());
      }
    }
    console.log(fillHoles(clozes.slice(), responses).map((c, i) => c ? c : printableCloze[i]).join(''));
    return responses.every(o => !!o); // exit criteria
  });
  return responses;
}

function filterJunkMorphemes(b: Morpheme[]): Morpheme[] {
  return b.filter(m => m && !(m.partOfSpeech[0] === 'supplementary_symbol') &&
                       !(m.partOfSpeech[0] === 'particle' && m.partOfSpeech[1] === 'phrase_final'));
}

function gradeQuiz(morphemeBunsetsuMap: Map<string, MorphemeBlock|BunsetsuBlock>, input: string[], toQuiz: Quizzable,
                   mode?: string): boolean[] {
  let now = new Date();
  let corrects: boolean[] = [];
  if (toQuiz instanceof SentenceBlock) {
    if (!toQuiz.ebisu) { throw new Error('Ebisu field expected'); }
    toQuiz.ebisu.update(true, now); // Don't passive update this!
    toQuiz.updateBlock();
    if (mode === 'particle') {
      for (let [midx, m] of enumerate(toQuiz.particleMorphemes)) {
        const correct = m.literal === input[midx];
        let q = morphemeBunsetsuMap.get(ultraCompressMorpheme(m));
        if (!q) { throw new Error('Morpheme not found in list of quizzables'); }
        if (!q.ebisu) { throw new Error('Ebisu field expected'); }
        q.ebisu.update(correct, now);
        q.updateBlock();
        corrects.push(correct);
      }
    } else if (mode === 'conjugation') {
      for (let [bidx, b] of enumerate(toQuiz.conjugatedBunsetsus)) {
        // FIXME: DRY with above 'particle' block
        const correct = bunsetsuToString(filterJunkMorphemes(b)) === input[bidx];
        let q = morphemeBunsetsuMap.get(ultraCompressMorphemes(b));
        if (!q) { throw new Error('Bunsetsu not found in list of quizzables'); }
        if (!q.ebisu) { throw new Error('Ebisu field expected'); }
        q.ebisu.update(correct, now);
        q.updateBlock();
        corrects.push(correct);
      }
    } else {
      throw new Error('unknown mode for Sentence quiz');
    }
    return corrects;
  } else if (toQuiz instanceof VocabBlock) {
    if (input[0].length === 0) { process.exit(0); }
    const correct =
        (input[0] === toQuiz.reading) || (input[0] === toQuiz.kanji) || (kata2hira(input[0]) === toQuiz.reading);
    if (!toQuiz.ebisu) { throw new Error('Ebisu field expected'); }
    toQuiz.ebisu[0].update(correct, now);
    toQuiz.updateBlock();
    if (!correct) { console.log('Correct answer: ', toQuiz.reading); }
    return [correct];
  }
  throw new Error('Unadministerable quiz type');
}

async function administerQuiz(toQuiz: Quizzable, mode?: string): Promise<string[]> {
  if (toQuiz instanceof SentenceBlock) {
    console.log('“' + (toQuiz.translation || '') + '”');
    if (mode === 'particle') {
      let particles = new Set(toQuiz.particleMorphemes.map(ultraCompressMorpheme));
      let clozes: (string|null)[] =
          toQuiz.morphemes.map(m => particles.has(ultraCompressMorpheme(m)) ? null : (m ? m.literal : ''));
      let responses: string[] = await cloze(clozes);
      fillHoles(clozes, responses);
      return responses;
    } else if (mode === 'conjugation') {
      console.log(`(${toQuiz.conjugatedBunsetsus.length} bunsetsu to conjugate)`)
      for (const [btmp, b] of enumerate(toQuiz.conjugatedBunsetsus)) {
        const bidx = btmp + 1;
        console.log(`#${bidx}: initial morpheme lemma: ${b[0].lemma}（${b[0].lemmaReading}）`);
      }
      const bunsetsuToString = (b: Morpheme[]) => b.map(m => m.literal).join('');
      let bunsetsus = new Set(toQuiz.conjugatedBunsetsus.map(bunsetsuToString));
      let clozes = toQuiz.bunsetsus.map(bunsetsuToString).map(s => bunsetsus.has(s) ? null : s);
      let responses: string[] = await cloze(clozes);
      return responses;
    } else {
      throw new Error('unknown mode for Sentence quiz');
    }
  } else if (toQuiz instanceof VocabBlock) {
    if (toQuiz.kanji) {
      console.log(`${toQuiz.kanji}: enter reading.`);
    } else {
      console.log(`${toQuiz.translation}: enter reading.`);
    }
    let response = await cliPrompt();
    return [response];
  }
  throw new Error('Unadministerable quiz type');
}

function compressedToBunsetsuOrMorpheme(content: Content[]): Map<string, BunsetsuBlock|MorphemeBlock> {
  let stringToMorphemeBunsetsuBlock: Map<string, BunsetsuBlock|MorphemeBlock> = new Map([]);
  for (const c of content) {
    if (c instanceof MorphemeBlock) {
      stringToMorphemeBunsetsuBlock.set(ultraCompressMorpheme(c.morpheme), c);
    } else if (c instanceof BunsetsuBlock) {
      stringToMorphemeBunsetsuBlock.set(ultraCompressMorphemes(c.bunsetsu), c);
    }
  }
  return stringToMorphemeBunsetsuBlock;
}

if (require.main === module) {
  const promisify = require('util').promisify;
  const readFile = promisify(require('fs').readFile);
  const writeFile = promisify(require('fs').writeFile);
  (async function() {
    if (process.argv.length < 4) {
      console.log(USAGE);
      process.exit(1);
    }
    // Read file and create backup
    const filename = process.argv[3];
    const text = await readFile(filename, 'utf8');
    writeFile(filename + '.bak', text);
    let content: Content[] = textToBlocks(text);

    // Parses Markdown for morphemes/bunsetsu, and if necessary invokes MeCab/Jdepp, and appends
    // new morphemes/bunsetsu of interest to the bottom of the file as new flashcards.
    await parseAndUpdate(content);

    const DEBUG = !true;
    let learned: Quizzable[] = content.filter(o => o instanceof Quizzable && o.ebisu) as Quizzable[];
    let learnedSentences: SentenceBlock[] = learned.filter(o => o instanceof SentenceBlock) as SentenceBlock[];

    let mode = process.argv[2];
    if (mode === 'quiz') {
      let now: Date = new Date();
      let toQuiz: Quizzable|undefined;
      if (!DEBUG) {
        let toQuizIdx: number;
        let predictedRecall: number;
        [toQuiz, predictedRecall, toQuizIdx] = argmin(learned, o => o.predict(now));
      } else {
        toQuiz = learned.find(o => o instanceof MorphemeBlock);
        toQuiz = learned.find(o => o instanceof BunsetsuBlock);
        // toQuiz = learned.find(o => o instanceof VocabBlock);
      }
      if (!toQuiz) {
        console.log('Nothing to review. Learn something and try again.')
        process.exit(0);
      }
      let morphemeBunsetsuMap = compressedToBunsetsuOrMorpheme(learned);

      if (toQuiz instanceof MorphemeBlock) {
        let targetMorpheme = ultraCompressMorpheme(toQuiz.morpheme);
        let candidateSentences =
            learnedSentences.filter(o => o.particleMorphemes.some(m => ultraCompressMorpheme(m) === targetMorpheme));
        if (!candidateSentences.length) { throw new Error('no candidate sentences found'); }

        let sentenceToQuiz = candidateSentences[0];
        let response = await administerQuiz(sentenceToQuiz, 'particle');

        let grades = gradeQuiz(morphemeBunsetsuMap, response, sentenceToQuiz, 'particle');
        console.log('response', response, 'grades', grades);
      } else if (toQuiz instanceof BunsetsuBlock) {
        let raw = toQuiz.bunsetsu.map(o => o ? o.literal : '').join('');
        let candidateSentences = learnedSentences.filter(o => o.sentence.includes(raw));
        if (!candidateSentences.length) { throw new Error('no candidate sentences found'); }

        // FIXME DRY above
        let sentenceToQuiz = candidateSentences[0];
        let response = await administerQuiz(sentenceToQuiz, 'conjugation');

        let grades = gradeQuiz(morphemeBunsetsuMap, response, sentenceToQuiz, 'conjugation');
        console.log('response', response, 'grades', grades);
      } else if (toQuiz instanceof VocabBlock) {
        let response = await administerQuiz(toQuiz);
        let grades = gradeQuiz(morphemeBunsetsuMap, response, toQuiz);
        console.log('response', response, 'grades', grades);
      } else if (toQuiz instanceof SentenceBlock) {
        // This will only happen for a sentence without conjugated bunsetsu or particle morphemes, but it may happen.
        let quizType;
        if (toQuiz.particleMorphemes.length && toQuiz.conjugatedBunsetsus.length) {
          quizType = Math.random() < 0.5 ? 'conjugation' : 'particle';
        } else if (toQuiz.particleMorphemes.length) {
          quizType = 'particle';
        } else if (toQuiz.conjugatedBunsetsus.length) {
          quizType = 'conjugation';
        } else {
          throw new Error('Unimplemented: review sentence lacking morphemes/bunsetsu')
        }
        let response = await administerQuiz(toQuiz, quizType);
        let grades = gradeQuiz(morphemeBunsetsuMap, response, toQuiz, quizType);
        console.log('response', response, 'grades', grades);
      } else {
        throw new Error('Unhandled quiz type');
      }
      writeFile(filename, contentToString(content));
    } else if (mode === 'learn') {
      //
      // Learn
      //
      let toLearn: VocabBlock|SentenceBlock|undefined =
          content.find(o => (o instanceof VocabBlock || o instanceof SentenceBlock) && !o.ebisu) as
          (VocabBlock | SentenceBlock | undefined);
      if (!toLearn) {
        console.log('Nothing to learn!');
        process.exit(0);
        return;
      }
      console.log('Learn this:');
      if (toLearn instanceof SentenceBlock) {
        console.log(`“${toLearn.sentence}”`);
        if (toLearn.translation) { console.log(`“${toLearn.translation}”`); }
        if (toLearn.particleMorphemes && toLearn.particleMorphemes.length > 0) {
          console.log('Study the following particles:')
          let prefix = '- ';
          console.log((prefix + morphemesToTsv(toLearn.particleMorphemes)).replace(/\n/g, `\n${prefix}`));
        }
        if (toLearn.bunsetsus && toLearn.bunsetsus.length > 0) {
          let realPrefix = '= ';
          let emptyPrefix = ' '.repeat(realPrefix.length);
          console.log('Understand the following conjugations:')
          console.log(toLearn.conjugatedBunsetsus.map(b => filterJunkMorphemes(b))
                          .map(s => (realPrefix + morphemesToTsv(s)).replace(/\n/g, `\n${emptyPrefix}`))
                          .join('\n'));
        }
      } else if (toLearn instanceof VocabBlock) {
        console.log(`${toLearn.reading}: ${toLearn.translation || ''}: ${toLearn.kanji || ''}`);
      } else {
        throw new Error('unknown type to learn');
      }
      await cliPrompt('Enter to indicate you have learned this');
      const now = new Date();
      toLearn.learn(now);
      toLearn.updateBlock();

      // Post-learn
      {
        let stringToMorphemeBunsetsuBlock = compressedToBunsetsuOrMorpheme(content);
        if (toLearn instanceof SentenceBlock) {
          const looper = (key: string) => {
            let hit = stringToMorphemeBunsetsuBlock.get(key);
            if (hit) {
              if (hit.ebisu) {
                hit.ebisu.passiveUpdate(now);
              } else {
                hit.learn(now);
              }
              hit.updateBlock();
            } else {
              throw new Error('bunsetsu not found');
            }
          };
          toLearn.conjugatedBunsetsus.map(ultraCompressMorphemes).forEach(looper);
          toLearn.particleMorphemes.map(ultraCompressMorpheme).forEach(looper);
        }
      }

      writeFile(filename, contentToString(content));
    } else if (mode === 'ebisu') {
      let now = new Date();
      let sorted = learned.slice();
      sorted.sort((a, b) => a.predict(now) - b.predict(now));

      // Half-life calculation
      var minimize = require('minimize-golden-section-1d');
      function halflife(e: Ebisu): number {
        let res = minimize((timestamp: number) => Math.abs(0.5 - e.predict(new Date(timestamp))), {
          lowerBound: e.lastDate.valueOf(),
          tolerance: 5e3,
          maxIter: 1000,
        });
        if (res < e.lastDate.valueOf()) {
          // Probably minimize failed to converge and returned function value, see
          // https://github.com/scijs/minimize-golden-section-1d/issues/2
          throw new Error('nonsense half-life, did minimize fail to converge?');
        }
        return (res - e.lastDate.valueOf()) / 36e5;
      }

      // Print
      console.log(sorted
                      .map(o => 'Precall=' + o.predict(now).toExponential(2) + '  hl=' +
                                (o.ebisu instanceof Array ? halflife(o.ebisu[0]) : halflife(o.ebisu)).toExponential(2) +
                                'hours  ' + o.block[0])
                      .join('\n'));
    } else {
      console.error('Unknown mode. See usage below.');
      console.error(USAGE);
      process.exit(2);
    }
  })();
}