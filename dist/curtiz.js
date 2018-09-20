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
Either of these will overwrite markdown.md (after creating markdown.md.bak backup).

For Ebisu-related scheduling debug information:
    $ node [this-script.js] ebisu [markdown.md]
`;
const kana_1 = require("./kana");
const cliFillInTheBlanks_1 = require("./cliFillInTheBlanks");
const cliPrompt_1 = require("./cliPrompt");
const markdown_1 = require("./markdown");
const mecabUnidic_1 = require("./mecabUnidic");
const utils_1 = require("./utils");
const bunsetsuToString = (morphemes) => morphemes.map(m => m.literal).join('');
const morphemesToTsv = (b) => b.map(mecabUnidic_1.ultraCompressMorpheme).join('\n');
const ensureFinalNewline = (s) => s.endsWith('\n') ? s : s + '\n';
const contentToString = (content) => ensureFinalNewline(content.map(o => (o instanceof Array ? o : o.block).join('\n')).join('\n'));
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
            console.log(utils_1.fillHoles(clozes.slice(), responses).map((c, i) => c ? c : printableCloze[i]).join(''));
            return responses.every(o => !!o); // exit criteria
        });
        return responses;
    });
}
function filterJunkMorphemes(b) {
    return b.filter(m => m && !(m.partOfSpeech[0] === 'supplementary_symbol') &&
        !(m.partOfSpeech[0] === 'particle' && m.partOfSpeech[1] === 'phrase_final'));
}
function gradeQuiz(morphemeBunsetsuMap, input, toQuiz, mode) {
    let now = new Date();
    let corrects = [];
    if (toQuiz instanceof markdown_1.SentenceBlock) {
        if (!toQuiz.ebisu) {
            throw new Error('Ebisu field expected');
        }
        toQuiz.ebisu.update(true, now); // Don't passive update this!
        toQuiz.updateBlock();
        if (mode === 'particle') {
            for (let [midx, m] of utils_1.enumerate(toQuiz.particleMorphemes)) {
                const correct = m.literal === input[midx];
                let q = morphemeBunsetsuMap.get(mecabUnidic_1.ultraCompressMorpheme(m));
                if (!q) {
                    throw new Error('Morpheme not found in list of quizzables');
                }
                if (!q.ebisu) {
                    throw new Error('Ebisu field expected');
                }
                q.ebisu.update(correct, now);
                q.updateBlock();
                corrects.push(correct);
            }
        }
        else if (mode === 'conjugation') {
            for (let [bidx, b] of utils_1.enumerate(toQuiz.conjugatedBunsetsus)) {
                // FIXME: DRY with above 'particle' block
                const correct = bunsetsuToString(filterJunkMorphemes(b)) === input[bidx];
                let q = morphemeBunsetsuMap.get(mecabUnidic_1.ultraCompressMorphemes(b));
                if (!q) {
                    throw new Error('Bunsetsu not found in list of quizzables');
                }
                if (!q.ebisu) {
                    throw new Error('Ebisu field expected');
                }
                q.ebisu.update(correct, now);
                q.updateBlock();
                corrects.push(correct);
            }
        }
        else {
            throw new Error('unknown mode for Sentence quiz');
        }
        return corrects;
    }
    else if (toQuiz instanceof markdown_1.VocabBlock) {
        if (input[0].length === 0) {
            process.exit(0);
        }
        const correct = (input[0] === toQuiz.reading) || (input[0] === toQuiz.kanji) || (kana_1.kata2hira(input[0]) === toQuiz.reading);
        if (!toQuiz.ebisu) {
            throw new Error('Ebisu field expected');
        }
        toQuiz.ebisu[0].update(correct, now);
        toQuiz.updateBlock();
        let summary = toQuiz.reading + (toQuiz.kanji ? '・' + toQuiz.kanji : '') + ': ' + toQuiz.translation;
        if (!correct) {
            console.log('😭 🙅‍♀️ 🙅‍♂️ 👎 🤬. Correct answer: ' + summary);
        }
        else {
            console.log(`💥 🔥 🎆 🎇 👏 🙌 👍 👌! ${summary}`);
        }
        return [correct];
    }
    throw new Error('Unadministerable quiz type');
}
function administerQuiz(toQuiz, mode) {
    return __awaiter(this, void 0, void 0, function* () {
        if (toQuiz instanceof markdown_1.SentenceBlock) {
            console.log('“' + (toQuiz.translation || '') + '”');
            if (mode === 'particle') {
                let particles = new Set(toQuiz.particleMorphemes.map(mecabUnidic_1.ultraCompressMorpheme));
                let clozes = toQuiz.morphemes.map(m => particles.has(mecabUnidic_1.ultraCompressMorpheme(m)) ? null : (m ? m.literal : ''));
                let responses = yield cloze(clozes);
                utils_1.fillHoles(clozes, responses);
                return responses;
            }
            else if (mode === 'conjugation') {
                console.log(`(${toQuiz.conjugatedBunsetsus.length} bunsetsu to conjugate)`);
                for (const [btmp, b] of utils_1.enumerate(toQuiz.conjugatedBunsetsus)) {
                    const bidx = btmp + 1;
                    console.log(`#${bidx}: initial morpheme lemma: ${b[0].lemma}（${b[0].lemmaReading}）`);
                }
                const bunsetsuToString = (b) => b.map(m => m.literal).join('');
                let bunsetsus = new Set(toQuiz.conjugatedBunsetsus.map(bunsetsuToString));
                let clozes = toQuiz.bunsetsus.map(bunsetsuToString).map(s => bunsetsus.has(s) ? null : s);
                let responses = yield cloze(clozes);
                return responses;
            }
            else {
                throw new Error('unknown mode for Sentence quiz');
            }
        }
        else if (toQuiz instanceof markdown_1.VocabBlock) {
            if (toQuiz.kanji) {
                console.log(`${toQuiz.kanji}: enter reading.`);
            }
            else {
                console.log(`${toQuiz.translation}: enter reading.`);
            }
            let response = yield cliPrompt_1.cliPrompt();
            return [response];
        }
        throw new Error('Unadministerable quiz type');
    });
}
function compressedToBunsetsuOrMorpheme(content) {
    let stringToMorphemeBunsetsuBlock = new Map([]);
    for (const c of content) {
        if (c instanceof markdown_1.MorphemeBlock) {
            stringToMorphemeBunsetsuBlock.set(mecabUnidic_1.ultraCompressMorpheme(c.morpheme), c);
        }
        else if (c instanceof markdown_1.BunsetsuBlock) {
            stringToMorphemeBunsetsuBlock.set(mecabUnidic_1.ultraCompressMorphemes(c.bunsetsu), c);
        }
    }
    return stringToMorphemeBunsetsuBlock;
}
if (require.main === module) {
    const promisify = require('util').promisify;
    const readFile = promisify(require('fs').readFile);
    const writeFile = promisify(require('fs').writeFile);
    (function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.argv.length < 4) {
                console.log(USAGE);
                process.exit(1);
            }
            // Read file and create backup
            const filename = process.argv[3];
            const text = yield readFile(filename, 'utf8');
            writeFile(filename + '.bak', text);
            let content = markdown_1.textToBlocks(text);
            // Parses Markdown for morphemes/bunsetsu, and if necessary invokes MeCab/Jdepp, and appends
            // new morphemes/bunsetsu of interest to the bottom of the file as new flashcards.
            yield markdown_1.parseAndUpdate(content);
            const DEBUG = !true;
            let learned = content.filter(o => o instanceof markdown_1.Quizzable && o.ebisu);
            let learnedSentences = learned.filter(o => o instanceof markdown_1.SentenceBlock);
            let mode = process.argv[2];
            if (mode === 'quiz') {
                let now = new Date();
                let toQuiz;
                if (!DEBUG) {
                    let toQuizIdx;
                    let predictedRecall;
                    [toQuiz, predictedRecall, toQuizIdx] = utils_1.argmin(learned, o => o.predict(now));
                }
                else {
                    toQuiz = learned.find(o => o instanceof markdown_1.MorphemeBlock);
                    toQuiz = learned.find(o => o instanceof markdown_1.BunsetsuBlock);
                    // toQuiz = learned.find(o => o instanceof VocabBlock);
                }
                if (!toQuiz) {
                    console.log('Nothing to review. Learn something and try again.');
                    process.exit(0);
                }
                let morphemeBunsetsuMap = compressedToBunsetsuOrMorpheme(learned);
                if (toQuiz instanceof markdown_1.MorphemeBlock) {
                    let targetMorpheme = mecabUnidic_1.ultraCompressMorpheme(toQuiz.morpheme);
                    let candidateSentences = learnedSentences.filter(o => o.particleMorphemes.some(m => mecabUnidic_1.ultraCompressMorpheme(m) === targetMorpheme));
                    if (!candidateSentences.length) {
                        throw new Error('no candidate sentences found');
                    }
                    let sentenceToQuiz = candidateSentences[0];
                    let response = yield administerQuiz(sentenceToQuiz, 'particle');
                    let grades = gradeQuiz(morphemeBunsetsuMap, response, sentenceToQuiz, 'particle');
                }
                else if (toQuiz instanceof markdown_1.BunsetsuBlock) {
                    let raw = toQuiz.bunsetsu.map(o => o ? o.literal : '').join('');
                    let candidateSentences = learnedSentences.filter(o => o.sentence.includes(raw));
                    if (!candidateSentences.length) {
                        throw new Error('no candidate sentences found');
                    }
                    // FIXME DRY above
                    let sentenceToQuiz = candidateSentences[0];
                    let response = yield administerQuiz(sentenceToQuiz, 'conjugation');
                    let grades = gradeQuiz(morphemeBunsetsuMap, response, sentenceToQuiz, 'conjugation');
                }
                else if (toQuiz instanceof markdown_1.VocabBlock) {
                    let response = yield administerQuiz(toQuiz);
                    let grades = gradeQuiz(morphemeBunsetsuMap, response, toQuiz);
                }
                else if (toQuiz instanceof markdown_1.SentenceBlock) {
                    // This will only happen for a sentence without conjugated bunsetsu or particle morphemes, but it may happen.
                    let quizType;
                    if (toQuiz.particleMorphemes.length && toQuiz.conjugatedBunsetsus.length) {
                        quizType = Math.random() < 0.5 ? 'conjugation' : 'particle';
                    }
                    else if (toQuiz.particleMorphemes.length) {
                        quizType = 'particle';
                    }
                    else if (toQuiz.conjugatedBunsetsus.length) {
                        quizType = 'conjugation';
                    }
                    else {
                        throw new Error('Unimplemented: review sentence lacking morphemes/bunsetsu');
                    }
                    let response = yield administerQuiz(toQuiz, quizType);
                    let grades = gradeQuiz(morphemeBunsetsuMap, response, toQuiz, quizType);
                }
                else {
                    throw new Error('Unhandled quiz type');
                }
                writeFile(filename, contentToString(content));
            }
            else if (mode === 'learn') {
                //
                // Learn
                //
                let toLearn = content.find(o => (o instanceof markdown_1.VocabBlock || o instanceof markdown_1.SentenceBlock) && !o.ebisu);
                if (!toLearn) {
                    console.log('Nothing to learn!');
                    process.exit(0);
                    return;
                }
                console.log('Learn this:');
                if (toLearn instanceof markdown_1.SentenceBlock) {
                    console.log(`“${toLearn.sentence}”`);
                    if (toLearn.translation) {
                        console.log(`“${toLearn.translation}”`);
                    }
                    if (toLearn.particleMorphemes && toLearn.particleMorphemes.length > 0) {
                        console.log('Study the following particles:');
                        let prefix = '- ';
                        console.log((prefix + morphemesToTsv(toLearn.particleMorphemes)).replace(/\n/g, `\n${prefix}`));
                    }
                    if (toLearn.bunsetsus && toLearn.bunsetsus.length > 0) {
                        let realPrefix = '= ';
                        let emptyPrefix = ' '.repeat(realPrefix.length);
                        console.log('Understand the following conjugations:');
                        console.log(toLearn.conjugatedBunsetsus.map(b => filterJunkMorphemes(b))
                            .map(s => (realPrefix + morphemesToTsv(s)).replace(/\n/g, `\n${emptyPrefix}`))
                            .join('\n'));
                    }
                }
                else if (toLearn instanceof markdown_1.VocabBlock) {
                    console.log(`${toLearn.reading}: ${toLearn.translation || ''}: ${toLearn.kanji || ''}`);
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
                toLearn.updateBlock();
                // Post-learn
                {
                    let stringToMorphemeBunsetsuBlock = compressedToBunsetsuOrMorpheme(content);
                    if (toLearn instanceof markdown_1.SentenceBlock) {
                        const looper = (key) => {
                            let hit = stringToMorphemeBunsetsuBlock.get(key);
                            if (hit) {
                                if (hit.ebisu) {
                                    hit.ebisu.passiveUpdate(now);
                                }
                                else {
                                    hit.learn(now, scale);
                                }
                                hit.updateBlock();
                            }
                            else {
                                throw new Error('bunsetsu not found');
                            }
                        };
                        toLearn.conjugatedBunsetsus.map(mecabUnidic_1.ultraCompressMorphemes).forEach(looper);
                        toLearn.particleMorphemes.map(mecabUnidic_1.ultraCompressMorpheme).forEach(looper);
                    }
                }
                writeFile(filename, contentToString(content));
            }
            else if (mode === 'ebisu') {
                let now = new Date();
                let sorted = learned.slice();
                sorted.sort((a, b) => a.predict(now) - b.predict(now));
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
                console.log(sorted
                    .map(o => 'Precall=' + o.predict(now).toExponential(2) + '  hl=' +
                    (o.ebisu instanceof Array ? halflife(o.ebisu[0]) : halflife(o.ebisu)).toExponential(2) +
                    'hours  ' + o.block[0])
                    .join('\n'));
            }
            else {
                console.error('Unknown mode. See usage below.');
                console.error(USAGE);
                process.exit(2);
            }
        });
    })();
}
