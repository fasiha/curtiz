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

import {fill} from './cliFillInTheBlanks';
import {cliPrompt} from './cliPrompt';
import {
  Content,
  Quizzable,
  SentenceBlock,
  textToBlocks,
  verifyAll,
} from './markdown';
import {enumerate, fillHoles, argmin} from './utils';
import {Ebisu} from './ebisu';

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

    // Parses Markdown and if necessary invokes MeCab/Jdepp
    await verifyAll(content);

    let learned: Quizzable[] = content.filter(o => o instanceof Quizzable && o.ebisu) as Quizzable[];

    let mode = process.argv[2];
    if (mode === 'quiz') {
      let now: Date = new Date();
      let toQuiz: Quizzable|undefined;
      let learnedProbs = learned.map(o => o.predict(now));
      let quizProb = learned.reduce(
          ([q, p], curr, idx) => (learnedProbs[idx] < p ? [curr, learnedProbs[idx]] : [q, p]) as [Quizzable, number],
          [undefined, Infinity] as [Quizzable | undefined, number]);
      toQuiz = quizProb[0];
      if (learned.length > 5) {
        // If enough items have been learned, let's add some randomization. We'll still ask a quiz with low
        // recall probability, but shuffling low-probability quizzes is nice to avoid quizzing in the same
        // order as learned.
        let minProb = quizProb[1];
        let maxProb = [.001, .01, .1, .2, .3, .4, .5].find(x => x > minProb);
        if (maxProb !== undefined) {
          let toQuizs = learned.filter((_, qidx) => learnedProbs[qidx] <= (maxProb || 1));
          if (toQuizs.length > 0) { toQuiz = toQuizs[Math.floor(Math.random() * toQuizs.length)]; }
        }
      }

      if (!toQuiz) {
        console.log('Nothing to review. Learn something and try again.')
        process.exit(0);
      }

      if (toQuiz instanceof SentenceBlock) {
        let {quizName, contexts, clozes} = toQuiz.preQuiz(now);
        let responses = await cloze(contexts);
        let correct = toQuiz.postQuiz(quizName, clozes, responses, now);
        let summary = toQuiz.block[0];
        if (correct) {
          console.log('💥 🔥 🎆 🎇 👏 🙌 👍 👌!\n' + summary);
        } else {
          console.log('😭 🙅‍♀️ 🙅‍♂️ 👎 🤬. Correct answer:\n' + summary);
        }
      } else {
        throw new Error('Unhandled quiz type');
      }
      writeFile(filename, contentToString(content));
    } else if (mode === 'learn') {
      //
      // Learn
      //
      let toLearn: SentenceBlock|undefined =
          content.find(o => o instanceof SentenceBlock && !o.ebisu) as (SentenceBlock | undefined);
      if (!toLearn) {
        console.log('Nothing to learn!');
        process.exit(0);
        return;
      }
      console.log('Learn this:');
      if (toLearn instanceof SentenceBlock) {
        console.log(toLearn.sentence);
        console.log(toLearn.reading);
        console.log(toLearn.translation);
      } else {
        throw new Error('unknown type to learn');
      }
      let entry = await cliPrompt(
          'Enter to indicate you have learned this, or a positive number to scale the initial half-life. > ');
      let scale: number = 1;
      if (entry && entry.length > 0 && (scale = parseFloat(entry))) {
        console.log(`This fact's initial half-life is ${scale}× default.`);
      }
      const now = new Date();
      toLearn.learn(now, scale);

      writeFile(filename, contentToString(content));
    } else if (mode === 'ebisu') {
      let now = new Date();

      // Half-life calculation
      var minimize = require('minimize-golden-section-1d');
      function halflife(e: Ebisu): number {
        let status: any = {};
        let res = minimize((timestamp: number) => Math.abs(0.5 - e.predict(new Date(timestamp))),
                           {lowerBound: e.lastDate.valueOf(), tolerance: 5e3}, status);
        if (res < e.lastDate.valueOf() || !status.converged) {
          throw new Error('minimize failed to converge (nonsense half-life)');
        }
        return (res - e.lastDate.valueOf()) / 36e5;
      }

      // Print
      let sorted = learned.slice();
      sorted.sort((a, b) => a.predict(now) - b.predict(now));
      console.log(sorted
                      .map(o => 'Precall=' + (100 * o.predict(now)).toFixed(1) + '%  hl=' +
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