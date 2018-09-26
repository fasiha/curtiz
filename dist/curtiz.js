#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const USAGE = `USAGE:
For a quiz:
    $ node [this-script.js] quiz [markdown.md]
For learning:
    $ node [this-script.js] learn [markdown.md]
To just automatically parse the Markdown file using MeCab/J.DepP:
    $ node [this-script.js] parse [markdown.md]
These will overwrite markdown.md (after creating markdown.md.bak backup).

For Ebisu-related scheduling debug information:
    $ node [this-script.js] ebisu [markdown.md]
`;
const cliFillInTheBlanks_1 = require("./cliFillInTheBlanks");
const cliPrompt_1 = require("./cliPrompt");
const markdown_1 = require("./markdown");
const utils_1 = require("./utils");
function cloze(clozes) {
    return __awaiter(this, void 0, void 0, function* () {
        let numberOfParticles = 0;
        let printableCloze = clozes.map(o => o ? o : `(${++numberOfParticles})`);
        console.log(`Fill in the numbered blanks:\n${printableCloze.join('')}\nEnter text or "# text":`);
        let responses = Array.from(Array(numberOfParticles), _ => '');
        yield cliFillInTheBlanks_1.fill((thisResponse) => {
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
            }
            else {
                let firstEmpty = responses.findIndex(o => !o);
                if (firstEmpty >= 0) {
                    responses[firstEmpty] = thisResponse.trim();
                }
                else {
                    responses.push(thisResponse.trim());
                }
            }
            return responses.every(o => !!o); // exit criteria
        });
        return responses;
    });
}
if (require.main === module) {
    const promisify = require('util').promisify;
    const readFile = promisify(require('fs').readFile);
    const stat = promisify(require('fs').stat);
    (function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.argv.length < 4) {
                console.log(USAGE);
                process.exit(1);
            }
            // Read file and create backup
            const filename = process.argv[3];
            const text = yield readFile(filename, 'utf8');
            const modifiedTime = (yield stat(filename)).mtimeMs;
            const writer = (text) => __awaiter(this, void 0, void 0, function* () {
                const writeFile = promisify(require('fs').writeFile);
                const newModifiedTime = (yield stat(filename)).mtimeMs;
                if (newModifiedTime > modifiedTime) {
                    console.error(`⚠️ ${filename}` +
                        ` has been modified, refusing to overwrite it.⚠️\n⚠️ Your quiz has not been saved.️️⚠️\n⚠️ Sorry!️️⚠️`);
                    process.exit(1);
                    return;
                }
                return Promise.all([writeFile(filename + '.bak', text), writeFile(filename, text)]);
            });
            let content = markdown_1.textToBlocks(text);
            // Parses Markdown and if necessary invokes MeCab/Jdepp
            yield markdown_1.verifyAll(content);
            let learned = content.filter(o => o instanceof markdown_1.Quizzable && o.learned());
            let mode = process.argv[2];
            if (mode === 'quiz') {
                let finalQuiz;
                let finalQuizzable;
                let finalPrediction;
                let predictions = learned.map(q => q.predict());
                if (predictions.some(x => !x)) {
                    throw new Error('typescript pacification: predictions on learned ok');
                }
                let minIdx = utils_1.argmin(predictions, p => p.prob);
                if (minIdx >= 0) {
                    [finalQuiz, finalQuizzable, finalPrediction] = [predictions[minIdx].quiz, learned[minIdx], predictions[minIdx]];
                    if (learned.length > 5) {
                        // If enough items have been learned, let's add some randomization. We'll still ask a quiz with low
                        // recall probability, but shuffling low-probability quizzes is nice to avoid quizzing in the same
                        // order as learned.
                        let minProb = predictions[minIdx].prob;
                        let maxProb = [.001, .01, .1, .2, .3, .4, .5].find(x => x > minProb);
                        if (maxProb !== undefined) {
                            let max = maxProb;
                            let groupPredictionsQuizzables = predictions.map((p, i) => [p, learned[i]]).filter(([p, q]) => p.prob <= max);
                            if (groupPredictionsQuizzables.length > 0) {
                                let randIdx = Math.floor(Math.random() * groupPredictionsQuizzables.length);
                                [finalQuiz, finalQuizzable, finalPrediction] = [
                                    groupPredictionsQuizzables[randIdx][0].quiz,
                                    groupPredictionsQuizzables[randIdx][1],
                                    groupPredictionsQuizzables[randIdx][0],
                                ];
                            }
                        }
                    }
                }
                if (!(finalQuiz && finalQuizzable)) {
                    console.log('Nothing to review. Learn something and try again.');
                    process.exit(0);
                    return;
                }
                if (finalQuizzable instanceof markdown_1.SentenceBlock) {
                    let contexts = [];
                    let clozes = [];
                    try {
                        let ret = finalQuiz.preQuiz();
                        contexts = ret.contexts;
                        clozes = ret.clozes;
                    }
                    catch (e) {
                        console.error('Critical error when preparing a quiz, for item:');
                        console.error(finalQuizzable.toString());
                        process.exit(1);
                        return;
                    }
                    let responses = yield cloze(contexts);
                    let scale = 1;
                    if (finalPrediction && finalPrediction.unlearned > 0) {
                        let n = finalPrediction.unlearned;
                        console.log(`Learn the following ${n} new sub-fact${n > 1 ? 's' : ''}:`);
                        let print = finalQuizzable.bullets.filter(b => b instanceof markdown_1.Quiz && !b.ebisu).map(q => q.toString()).join('\n');
                        console.log(print);
                        let entry = yield cliPrompt_1.cliPrompt(`Enter to indicate you have learned ${n > 1 ? 'these' : 'this'},` +
                            ` or a positive number to scale the initial half-life. > `);
                        if (entry && entry.length > 0 && (scale = parseFloat(entry))) {
                            console.log(`${n} sub-fact${n > 1 ? 's' : ''} initial half-life will be ${scale}× default.`);
                        }
                    }
                    let now = new Date();
                    let correct = finalQuizzable.postQuiz(finalQuiz, clozes, responses, now, scale);
                    let summary = finalQuizzable.header;
                    summary = summary.slice(summary.indexOf(markdown_1.SentenceBlock.init) + markdown_1.SentenceBlock.init.length);
                    if (correct) {
                        console.log('💥 🔥 🎆 🎇 👏 🙌 👍 👌! ' + summary);
                    }
                    else {
                        console.log('😭 🙅‍♀️ 🙅‍♂️ 👎 🤬. Correct answer: ' + summary);
                    }
                }
                else {
                    throw new Error('Unhandled quiz type');
                }
                writer(markdown_1.contentToString(content));
            }
            else if (mode === 'learn') {
                //
                // Learn
                //
                let toLearn = content.find(o => o instanceof markdown_1.Quizzable && !o.learned());
                if (!toLearn) {
                    console.log('Nothing to learn!');
                    process.exit(0);
                    return;
                }
                console.log('Learn this:');
                if (toLearn instanceof markdown_1.SentenceBlock) {
                    console.log(toLearn.sentence);
                    console.log(toLearn.reading);
                    console.log(toLearn.translation);
                }
                else {
                    throw new Error('unknown type to learn');
                }
                let entry = yield cliPrompt_1.cliPrompt('Enter to indicate you have learned this, or a positive number to scale the initial half-life. > ');
                let scale = 1;
                if (entry && entry.length > 0 && (scale = parseFloat(entry))) {
                    console.log(`This fact's initial half-life is ${scale}× default.`);
                }
                const now = new Date();
                toLearn.learn(now, scale);
                writer(markdown_1.contentToString(content));
            }
            else if (mode === 'ebisu') {
                let now = new Date();
                // Half-life calculation
                var minimize = require('minimize-golden-section-1d');
                function halflife(e) {
                    let status = {};
                    let res = minimize((timestamp) => Math.abs(0.5 - e.predict(new Date(timestamp))), { lowerBound: e.lastDate.valueOf(), tolerance: 5e3 }, status);
                    if (res < e.lastDate.valueOf() || !status.converged) {
                        throw new Error('minimize failed to converge (nonsense half-life)');
                    }
                    return (res - e.lastDate.valueOf()) / 36e5;
                }
                // Print
                let sorted = utils_1.flatten(learned.map(qz => qz.bullets.filter(b => b instanceof markdown_1.Quiz && !!b.ebisu)
                    .map(q => ({
                    str: qz.header + '|' + (q.toString() || '').split('\n')[0],
                    prob: q.ebisu.predict(now),
                    hl: halflife(q.ebisu)
                }))));
                sorted.sort((a, b) => a.prob - b.prob);
                console.log(sorted
                    .map(({ str, prob, hl }) => 'Precall=' + (100 * prob).toFixed(1).padStart(4, '0') +
                    '%  hl=' + hl.toExponential(2) + 'hours  ' + str)
                    .join('\n'));
            }
            else if (mode === 'parse') {
                writer(markdown_1.contentToString(content));
            }
            else {
                console.error('Unknown mode. See usage below.');
                console.error(USAGE);
                process.exit(2);
            }
        });
    })();
}
