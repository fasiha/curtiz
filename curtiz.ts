#!/usr/bin/env node

const USAGE = `USAGE:
For a quiz:
    $ node [this-script.js] quiz [markdown.md [...markdowns.md]]
For learning:
    $ node [this-script.js] learn [markdown.md [...markdowns.md]]
To just automatically parse the Markdown file using MeCab/J.DepP:
    $ node [this-script.js] parse [markdown.md [...markdowns.md]]
These will overwrite markdown.md (after creating markdown.md.bak backup).

For Ebisu-related scheduling debug information:
    $ node [this-script.js] ebisu [markdown.md [...markdowns.md]]
`;

import {fill} from './cliFillInTheBlanks';
import {cliPrompt} from './cliPrompt';
import {
  Content,
  Quiz,
  LozengeBlock,
  Predicted,
  SentenceBlock,
  findBestQuiz,
  textToBlocks,
  verifyAll,
  contentToString
} from './markdown';
import {Ebisu} from './ebisu';
import {argmin, flatten, enumerate, zip} from './utils';

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
    return responses.every(o => !!o); // exit criteria
  });
  return responses;
}

async function administerQuiz(finalQuiz: Quiz, finalLozenge: LozengeBlock, finalPrediction: Predicted) {
  if (finalLozenge instanceof SentenceBlock) {
    let contexts: (string|null)[] = [];
    let clozes: string[][] = [];
    try {
      let ret = finalQuiz.preQuiz();
      contexts = ret.contexts;
      clozes = ret.clozes;
    } catch (e) {
      console.error('Critical error when preparing a quiz, for item:')
      console.error(finalLozenge.toString());
      process.exit(1);
      return;
    }
    let responses = await cloze(contexts);

    let scale: number = 1;
    if (finalPrediction && finalPrediction.unlearned > 0) {
      let n = finalPrediction.unlearned;
      console.log(`Learn the following ${n} new sub-fact${n > 1 ? 's' : ''}:`);
      let print = finalLozenge.bullets.filter(b => b instanceof Quiz && !b.ebisu).map(q => q.toString()).join('\n');
      console.log(print)
      let entry = await cliPrompt(`Enter to indicate you have learned ${n > 1 ? 'these' : 'this'},` +
                                  ` or a positive number to scale the initial half-life. > `);
      if (entry && entry.length > 0 && (scale = parseFloat(entry))) {
        console.log(`${n} sub-fact${n > 1 ? 's' : ''} initial half-life will be ${scale}× default.`);
      }
    }

    let now: Date = new Date();
    let correct = finalLozenge.postQuiz(finalQuiz, clozes, responses, now, scale);
    let summary = finalLozenge.header;
    summary = summary.slice(summary.indexOf(SentenceBlock.init) + SentenceBlock.init.length);
    if (correct) {
      console.log('💥 🔥 🎆 🎇 👏 🙌 👍 👌! ' + summary);
    } else {
      console.log('😭 🙅‍♀️ 🙅‍♂️ 👎 🤬. Expected answer: ' + clozes.join(' | '));
      console.log(summary);
    }
  } else {
    throw new Error('Unhandled quiz type');
  }
}

async function quiz(content: Content[]) {
  let learned: LozengeBlock[] = content.filter(o => o instanceof LozengeBlock && o.learned()) as LozengeBlock[];
  const {finalQuiz, finalQuizzable, finalPrediction, finalIndex} = findBestQuiz(learned);

  if (!(finalQuiz && finalQuizzable && finalPrediction && typeof finalIndex === 'number')) {
    console.log('Nothing to review. Learn something and try again.')
    process.exit(0);
    return;
  }
  await administerQuiz(finalQuiz, finalQuizzable, finalPrediction);
  return finalIndex;
}

if (require.main === module) {
  const promisify = require('util').promisify;
  const readFile = promisify(require('fs').readFile);
  const stat = promisify(require('fs').stat);
  (async function() {
    if (process.argv.length < 4) {
      console.log(USAGE);
      process.exit(1);
    }
    // Read file and create backup
    const filenames: string[] = process.argv.slice(3);
    const texts: string[] = await Promise.all(filenames.map(filename => readFile(filename, 'utf8')));
    const modifiedTimes: number[] =
        await Promise.all(filenames.map(filename => stat(filename).then((x: any) => x.mtimeMs)));
    const writer = async (originalText: string, newText: string, filename: string, modifiedTime: number) => {
      const writeFile = promisify(require('fs').writeFile);
      const newModifiedTime: number = (await stat(filename)).mtimeMs;
      if (newModifiedTime > modifiedTime) {
        console.error(
            `⚠️ ${filename}` +
            ` has been modified, refusing to overwrite it.⚠️\n⚠️ Your quiz has not been saved.️️⚠️\n⚠️ Sorry!️️⚠️`);
        process.exit(1);
        return;
      }
      return Promise.all([writeFile(filename + '.bak', originalText), writeFile(filename, newText)]);
    };

    let contents: Content[][] = texts.map(textToBlocks);
    // Parses Markdown and if necessary invokes MeCab/Jdepp
    await Promise.all(contents.map(verifyAll));

    let mode = process.argv[2];
    if (mode === 'quiz') {
      /////////
      // Quiz
      /////////
      const contentToLearned: (content: Content[]) => LozengeBlock[] = content =>
          content.filter(o => o instanceof LozengeBlock && o.learned()) as LozengeBlock[];

      const bestQuizzes = contents.map(content => findBestQuiz(contentToLearned(content)));
      const fileIndex = await quiz(bestQuizzes.map(b => b.finalQuizzable as LozengeBlock));
      if (typeof fileIndex === 'undefined') {
        throw new Error('TypeScript pacification: fileIndex will be number here')
      }
      writer(texts[fileIndex], contentToString(contents[fileIndex]), filenames[fileIndex], modifiedTimes[fileIndex]);
    } else if (mode === 'learn') {
      /////////
      // Learn
      /////////
      let toLearn: LozengeBlock|undefined;
      let fileIndex: number = -1;
      for (const [idx, content] of enumerate(contents)) {
        fileIndex = idx;
        toLearn = content.find(o => o instanceof LozengeBlock && !o.learned()) as (LozengeBlock | undefined);
        if (toLearn) { break; }
      }
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
      writer(texts[fileIndex], contentToString(contents[fileIndex]), filenames[fileIndex], modifiedTimes[fileIndex]);
    } else if (mode === 'ebisu') {
      /////////
      // Ebisu
      /////////
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
      let learned: LozengeBlock[] =
          flatten(contents).filter(o => o instanceof LozengeBlock && o.learned()) as LozengeBlock[];
      let sorted = flatten(learned.map(qz => qz.bullets.filter(b => b instanceof Quiz && !!b.ebisu)
                                                 .map(q => ({
                                                        str: qz.header + '|' + (q.toString() || '').split('\n')[0],
                                                        prob: ((q as Quiz).ebisu as Ebisu).predict(now),
                                                        hl: halflife((q as Quiz).ebisu as Ebisu)
                                                      }))));
      sorted.sort((a, b) => a.prob - b.prob);
      console.log(sorted
                      .map(({str, prob, hl}) => 'Precall=' + (100 * prob).toFixed(1).padStart(4, '0') +
                                                '%  hl=' + hl.toExponential(2) + 'hours  ' + str)
                      .join('\n'))
    } else if (mode === 'parse') {
      for (const [text, content, filename, modifiedTime] of zip(texts, contents, filenames, modifiedTimes)) {
        writer(text, contentToString(content), filename, modifiedTime);
      }
    } else {
      console.error('Unknown mode. See usage below.');
      console.error(USAGE);
      process.exit(2);
    }
  })();
}