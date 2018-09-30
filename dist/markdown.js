"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const ebisu_1 = require("./ebisu");
const jdepp = __importStar(require("./jdepp"));
const kana_1 = require("./kana");
const mecabUnidic_1 = require("./mecabUnidic");
const utils_1 = require("./utils");
const DEFAULT_HALFLIFE_HOURS = 0.25;
const ebisuVersion = '1';
const ebisuInit = '- ◊Ebisu' + ebisuVersion + ' ';
/*
Quiz classes (within a Quizzable, defined below)
*/
class Quiz {
}
exports.Quiz = Quiz;
;
class QuizCloze extends Quiz {
    constructor(sentence, acceptables, line, ebisu) {
        super();
        this.fieldSep = '//';
        this.sentence = sentence;
        if (ebisu) {
            this.ebisu = ebisu;
        }
        if (acceptables && acceptables.length > 0) {
            this.acceptables = acceptables.slice();
        }
        else if (line) {
            let idx = line.indexOf(QuizCloze.init);
            if (idx < 0) {
                throw new Error('cannot find QuizCloze init');
            }
            this.acceptables = line.slice(idx + QuizCloze.init.length).split(this.fieldSep).map(s => s.trim());
        }
        else {
            throw new Error('need `acceptables` or `line`');
        }
        let possibleClozes = this.acceptables.map(cloze => extractClozed(this.sentence.sentence + ` (${this.sentence.translation})`, cloze));
        let primaryClozeIdx = possibleClozes.findIndex(x => !!x);
        let primaryCloze = possibleClozes[primaryClozeIdx];
        if (!primaryCloze) {
            throw new Error('None of these clozes were found: ' + line);
        }
        let alsoAcceptable = this.acceptables.map((s, idx) => idx === primaryClozeIdx ? null : s).filter(s => !!s);
        primaryCloze.clozes[0].push(...alsoAcceptable);
        this.cloze = primaryCloze;
    }
    preQuiz() { return this.cloze; }
    toString() {
        return `${QuizCloze.init}${this.acceptables.join(this.fieldSep)}` +
            (this.ebisu ? `\n  ${ebisuInit}_ ${this.ebisu.toString()}` : ``);
    }
}
QuizCloze.init = '- ◊cloze ';
exports.QuizCloze = QuizCloze;
;
class QuizRelated extends Quiz {
    constructor(line, ebisu) {
        super();
        this.fieldSep = '::';
        if (ebisu) {
            this.ebisu = ebisu;
        }
        let idx = line.indexOf(QuizRelated.init);
        if (idx < 0) {
            throw new Error('cannot find QuizRelated init');
        }
        let split = line.slice(idx + QuizRelated.init.length).split(this.fieldSep);
        if (!(split.length === 2 || split.length === 3)) {
            throw new Error('2- or 3-item related not found');
        }
        [this.reading, this.translation, this.written] = split.map(s => s.trim());
    }
    preQuiz() {
        if (this.written) {
            return { contexts: [`${this.written}: enter reading: `, null], clozes: [[this.reading, this.written]] };
        }
        return { contexts: [`${this.translation}: enter reading: `, null], clozes: [[this.reading]] };
    }
    toString() {
        return `${QuizRelated.init}${[this.reading, this.translation, this.written].filter(x => !!x).join(' ' + this.fieldSep + ' ')}` +
            (this.ebisu ? `\n  ${ebisuInit}_ ${this.ebisu.toString()}` : ``);
    }
}
QuizRelated.init = '- ◊related ';
exports.QuizRelated = QuizRelated;
;
class QuizReading extends Quiz {
    constructor(sentence, ebisu) {
        super();
        this.ebisu = ebisu;
        this.sentence = sentence;
    }
    preQuiz() {
        return {
            contexts: [`${this.sentence.sentence}: enter reading: `, null],
            clozes: [[this.sentence.reading, this.sentence.sentence]]
        };
    }
    toString() {
        return this.ebisu ? `${ebisuInit}${QuizReading.ebisuName} ${this.ebisu.toString()}` : null;
    }
}
QuizReading.ebisuName = 'reading';
exports.QuizReading = QuizReading;
;
/*
Quizzables
*/
class Quizzable {
}
exports.Quizzable = Quizzable;
class SentenceBlock extends Quizzable {
    constructor(block) {
        super();
        if (!block[0].includes(SentenceBlock.init)) {
            throw new Error('first entry of text block should contain header');
        }
        this.header = block[0];
        {
            const lozengeIdx = block[0].indexOf(SentenceBlock.init);
            if (lozengeIdx < 0) {
                throw new Error('◊ not found');
            }
            const line = block[0].slice(lozengeIdx + SentenceBlock.init.length);
            const pieces = line.split(SentenceBlock.fieldSep);
            if (pieces.length !== 3) {
                throw new Error('Sentence needs (1) reading, (2) translation, and (3) printed.');
            }
            this.sentence = pieces[2].trim();
            this.translation = pieces[1].trim();
            this.reading = pieces[0].trim();
        }
        this.bullets = [];
        if (block.length > 1) {
            const getIndent = (s) => (s.match(/^\s*/) || [''])[0].length;
            let initialIndent = getIndent(block[1]);
            let prev;
            for (let [lidx, line] of utils_1.enumerate(block)) {
                if (lidx === 0) {
                    continue;
                }
                let thisIndent = getIndent(line);
                let trimmedLine = line.trimLeft();
                if (trimmedLine.startsWith(ebisuInit)) {
                    let extracted = lineToEbisu(line);
                    if (extracted) {
                        let { name, ebisu } = extracted;
                        if (name === QuizReading.ebisuName && thisIndent === initialIndent) {
                            this.bullets.push(new QuizReading(this, ebisu));
                        }
                        else if ((prev = last(this.bullets)) instanceof Quiz && !prev.ebisu) {
                            prev.ebisu = ebisu;
                        }
                        else {
                            this.bullets.push(line);
                        }
                    }
                }
                else if (trimmedLine.startsWith(QuizRelated.init) && initialIndent === thisIndent) {
                    this.bullets.push(new QuizRelated(line));
                }
                else if (trimmedLine.startsWith(QuizCloze.init) && initialIndent === thisIndent) {
                    this.bullets.push(new QuizCloze(this, undefined, line));
                }
                else {
                    this.bullets.push(line);
                }
            }
        }
        // Required quizzes go here
        if (!this.bullets.some(q => q instanceof QuizReading)) {
            this.bullets.push(new QuizReading(this));
        }
    }
    numUnlearned() { return this.bullets.filter(b => b instanceof Quiz && !b.ebisu).length; }
    learned() { return this.bullets.some(b => b instanceof Quiz && !!b.ebisu); }
    predict(now) {
        let ret = {};
        let possibleQuizs = this.bullets.filter(b => b instanceof Quiz && b.ebisu);
        utils_1.argmin(possibleQuizs, b => b.ebisu ? b.ebisu.predict(now) : Infinity, ret);
        return ret.min ? { prob: ret.minmapped || Infinity, quiz: ret.min, unlearned: this.numUnlearned() } : undefined;
    }
    learn(now, scale = 1) {
        let epoch = now ? now.valueOf() : Date.now();
        for (let b of this.bullets) {
            if (b instanceof Quiz && !b.ebisu) {
                b.ebisu = ebisu_1.Ebisu.createDefault(scale * DEFAULT_HALFLIFE_HOURS, undefined, (b instanceof QuizReading ? new Date(epoch) : staggeredDate(epoch)));
            }
        }
    }
    postQuiz(quizCompleted, clozes, results, now, scale = 1) {
        const correct = results.every((r, idx) => clozes[idx].indexOf(r) >= 0 || clozes[idx].indexOf(kana_1.kata2hira(r)) >= 0);
        let epoch = now ? now.valueOf() : Date.now();
        for (let quiz of this.bullets) {
            if (quiz instanceof Quiz) {
                if (quiz === quizCompleted) {
                    if (!quiz.ebisu) {
                        throw new Error('refusing to update quiz that was not already learned');
                    }
                    quiz.ebisu.update(correct, now);
                }
                else {
                    if (quiz.ebisu) {
                        quiz.ebisu.passiveUpdate(staggeredDate(epoch));
                    }
                    else {
                        quiz.ebisu = ebisu_1.Ebisu.createDefault(scale * DEFAULT_HALFLIFE_HOURS, undefined, staggeredDate(epoch));
                    }
                }
            }
        }
        return correct;
    }
    verify() {
        return __awaiter(this, void 0, void 0, function* () {
            const pleaseParseRegexp = /^\s*- ◊pleaseParse/;
            if (this.reading === '' || this.bullets.some(s => typeof s === 'string' && pleaseParseRegexp.test(s))) {
                let { bunsetsus } = yield parse(this.sentence);
                const parsedReading = utils_1.flatten(bunsetsus)
                    .filter(m => m.partOfSpeech[0] !== 'supplementary_symbol')
                    .map(m => utils_1.hasKanji(m.literal) ? kana_1.kata2hira(m.literal === m.lemma ? m.lemmaReading : m.pronunciation)
                    : m.literal)
                    .join('');
                if (this.reading.length === 0) {
                    this.reading = parsedReading;
                    let oldHeader = this.header;
                    let hit = oldHeader.indexOf(SentenceBlock.init);
                    if (hit < 0) {
                        throw new Error('Init string not found in block header?');
                    }
                    let hit2 = oldHeader.indexOf(SentenceBlock.fieldSep, hit + SentenceBlock.init.length);
                    if (hit2 < 0) {
                        throw new Error('Separator not found in block header?');
                    }
                    // reading should be between `hit + SentenceBlock.init.length+1` and `hit2`.
                    this.header =
                        oldHeader.slice(0, hit + SentenceBlock.init.length + 1) + parsedReading + ' ' + oldHeader.slice(hit2);
                }
                this.identifyQuizItems(bunsetsus);
                this.bullets = this.bullets.filter(s => typeof s === 'string' ? !pleaseParseRegexp.test(s) : true);
            }
        });
    }
    identifyQuizItems(bunsetsus) {
        { // Guess at `◊related??` blocks
            const morphemes = utils_1.flatten(bunsetsus);
            if (morphemes.length > 1) {
                let relatedMaybeInit = QuizRelated.init.trimRight() + '?? ';
                // purge existing ◊related?? blocks
                this.bullets = this.bullets.filter(s => typeof s === 'string' ? !s.includes(relatedMaybeInit) : true);
                // add ◊related?? blocks
                for (let morpheme of morphemes) {
                    if (utils_1.hasKanji(morpheme.literal)) {
                        this.bullets.push(`${relatedMaybeInit}${kana_1.kata2hira(morpheme.lemmaReading)} :: ? :: ${morpheme.lemma}`);
                    }
                }
            }
        }
        // Find clozes: particles and conjugated verb/adjective phrases
        let literalClozes = new Map([]);
        const particlePredicate = (p) => p.partOfSpeech[0].startsWith('particle') && p.partOfSpeech.length > 1 &&
            !p.partOfSpeech[1].startsWith('phrase_final');
        for (let [bidx, bunsetsu] of utils_1.enumerate(bunsetsus)) {
            let first = bunsetsu[0];
            if (!first) {
                continue;
            }
            const pos0 = first.partOfSpeech[0];
            if (bunsetsu.length > 1 && (pos0.startsWith('verb') || pos0.endsWith('_verb') || pos0.startsWith('adject'))) {
                let ignoreRight = utils_1.filterRight(bunsetsu, m => !mecabUnidic_1.goodMorphemePredicate(m));
                let goodBunsetsu = ignoreRight.length === 0 ? bunsetsu : bunsetsu.slice(0, -ignoreRight.length);
                let cloze = bunsetsuToString(goodBunsetsu);
                let left = bunsetsus.slice(0, bidx).map(bunsetsuToString).join('');
                let right = bunsetsuToString(ignoreRight) + bunsetsus.slice(bidx + 1).map(bunsetsuToString).join('');
                literalClozes.set(generateContextClozed(left, cloze, right), goodBunsetsu);
            }
            else {
                // only add particles if they're NOT inside conjugated phrases
                for (let [pidx, particle] of utils_1.enumerate(bunsetsu)) {
                    if (particlePredicate(particle)) {
                        let left = bunsetsus.slice(0, bidx).map(bunsetsuToString).join('') + bunsetsuToString(bunsetsu.slice(0, pidx));
                        let right = bunsetsuToString(bunsetsu.slice(pidx + 1)) + bunsetsus.slice(bidx + 1).map(bunsetsuToString).join('');
                        literalClozes.set(generateContextClozed(left, particle.literal, right), [particle]);
                    }
                }
            }
        }
        let existingClozes = new Set(utils_1.flatten(utils_1.flatten(this.bullets.filter(b => b instanceof QuizCloze).map(q => q.cloze.clozes))));
        for (let [cloze, bunsetsu] of literalClozes) {
            if (!existingClozes.has(cloze)) {
                let acceptable = [cloze];
                if (utils_1.hasKanji(bunsetsuToString(bunsetsu))) {
                    acceptable.push(kana_1.kata2hira(bunsetsu.map(m => m.pronunciation).join('')));
                }
                this.bullets.push(new QuizCloze(this, acceptable));
            }
        }
    }
    toString() {
        let ret = [this.header];
        ret = ret.concat(this.bullets.map(b => b instanceof Quiz ? b.toString() : b)).filter(x => x !== null);
        return ret.join('\n');
    }
}
SentenceBlock.init = '◊sent';
SentenceBlock.fieldSep = '::';
exports.SentenceBlock = SentenceBlock;
/*
Helper functions
*/
/**
 * Ensure needle is found in haystack only once
 * @param haystack big string
 * @param needle little string
 */
function appearsExactlyOnce(haystack, needle) {
    let hit;
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
function generateContextClozed(left, cloze, right) {
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
    if (leftContext === '' && rightContext === '') {
        return cloze;
    }
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
function extractClozed(haystack, needleMaybeContext) {
    let re = /\[([^\]]+)\]/;
    let bracketMatch = needleMaybeContext.match(re);
    if (bracketMatch) {
        if (typeof bracketMatch.index !== 'number') {
            throw new Error('TypeScript pacification: match.index invalid');
        }
        let cloze = bracketMatch[1];
        let leftContext = needleMaybeContext.slice(0, bracketMatch.index);
        let rightContext = needleMaybeContext.slice(bracketMatch.index + bracketMatch[0].length);
        if (re.test(rightContext)) {
            throw new Error('More than one context unsupported');
        }
        let fullRe = new RegExp(leftContext + cloze + rightContext, 'g');
        let checkContext = fullRe.exec(haystack);
        if (!checkContext) {
            return null;
        }
        const left = haystack.slice(0, checkContext.index + leftContext.length);
        const right = haystack.slice(checkContext.index + checkContext[0].length - rightContext.length);
        if (fullRe.exec(haystack)) {
            throw new Error('Insufficient cloze context');
        }
        return { contexts: [left, null, right], clozes: [[cloze]] };
    }
    let cloze = needleMaybeContext;
    let clozeRe = new RegExp(cloze, 'g');
    let clozeHit = clozeRe.exec(haystack);
    if (clozeHit) {
        let left = haystack.slice(0, clozeHit.index);
        let right = haystack.slice(clozeHit.index + cloze.length);
        if (clozeRe.exec(haystack)) {
            console.error('haystack', haystack, 'needle', needleMaybeContext);
            throw new Error('Cloze context required');
        }
        return { contexts: [left, null, right], clozes: [[cloze]] };
    }
    return null;
}
const staggeredDate = (start, maxMilliseconds = 750) => new Date(start + Math.floor(Math.random() * maxMilliseconds));
function parse(sentence) {
    return __awaiter(this, void 0, void 0, function* () {
        let rawMecab = yield mecabUnidic_1.invokeMecab(sentence);
        let morphemes = mecabUnidic_1.maybeMorphemesToMorphemes(mecabUnidic_1.parseMecab(sentence, rawMecab)[0].filter(o => !!o));
        let bunsetsus = yield addJdepp(rawMecab, morphemes);
        return { morphemes, bunsetsus };
    });
}
function addJdepp(raw, morphemes) {
    return __awaiter(this, void 0, void 0, function* () {
        let jdeppRaw = yield jdepp.invokeJdepp(raw);
        let jdeppSplit = jdepp.parseJdepp('', jdeppRaw);
        let bunsetsus = [];
        {
            let added = 0;
            for (let bunsetsu of jdeppSplit) {
                // -1 because each `bunsetsu` array here will contain a header before the morphemes
                bunsetsus.push(morphemes.slice(added, added + bunsetsu.length - 1));
                added += bunsetsu.length - 1;
            }
        }
        return bunsetsus;
    });
}
const bunsetsuToString = (morphemes) => morphemes.map(m => m.literal).join('');
function lineToEbisu(line) {
    const ebisuRegexp = new RegExp('^\\s*' + ebisuInit);
    const nonwsRegexp = /\S+/;
    let res = line.match(ebisuRegexp);
    if (!res) {
        return null;
    }
    let withoutInit = line.slice(res[0].length + (res.index || 0));
    res = withoutInit.match(nonwsRegexp);
    if (!res) {
        return null;
    }
    let name = res[0];
    let withoutCruft = withoutInit.slice(res[0].length + (res.index || 0));
    let ebisu = ebisu_1.Ebisu.fromString(withoutCruft.trim());
    return { name, ebisu };
}
function last(v) { return v[v.length - 1]; }
function textToBlocks(text) {
    let content = [];
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
        if (piece.endsWith('\n')) {
            piece = piece.slice(0, -1);
        }
        const lines = piece.split('\n');
        let endOfBlock = lines.findIndex(s => !(s.match(headerRegexp) || s.match(bulletRegexp)));
        // last line of file might be header-lozenge-block so:
        if (endOfBlock < 0) {
            endOfBlock = lines.length;
        }
        if (endOfBlock === 0) {
            // no lozenge-block found: must be opening text
            content.push(lines);
        }
        else {
            let block = lines.slice(0, endOfBlock);
            let restText = lines.slice(endOfBlock);
            let line = block[0];
            let lozengeIdx = line.indexOf('◊');
            line = line.slice(lozengeIdx);
            if (line.startsWith(SentenceBlock.init)) {
                content.push(new SentenceBlock(block));
            }
            else {
                throw new Error('unknown header, did you forget to add a parser for it here?');
            }
            if (restText.length > 0) {
                content.push(restText);
            }
        }
        start = hit ? stop + 1 : -1;
        stop = -1;
    }
    return content;
}
exports.textToBlocks = textToBlocks;
function verifyAll(content) {
    return __awaiter(this, void 0, void 0, function* () {
        return Promise.all(content.filter(c => c instanceof SentenceBlock).map(o => o.verify()));
    });
}
exports.verifyAll = verifyAll;
/*
Main command-line app (prints updated (parsed) Markdown)
*/
const ensureFinalNewline = (s) => s.endsWith('\n') ? s : s + '\n';
exports.contentToString = (content) => ensureFinalNewline(content.map(o => (o instanceof Quizzable ? o.toString() : o.join('\n'))).join('\n'));
const USAGE = `USAGE:
$ node [this-script.js] [markdown.md]
will print a parsed version of the input Markdown.`;
if (require.main === module) {
    const promisify = require('util').promisify;
    const readFile = promisify(require('fs').readFile);
    (function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.argv.length < 3) {
                console.log(USAGE);
                process.exit(1);
                return;
            }
            // Read Markdown
            const filename = process.argv[2];
            let txt = yield readFile(filename, 'utf8');
            // Validate it
            let content = textToBlocks(txt);
            yield verifyAll(content);
            console.log(exports.contentToString(content));
        });
    })();
}
