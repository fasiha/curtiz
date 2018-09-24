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
const ebisuDateSeparator = ';';
class Quizzable {
}
exports.Quizzable = Quizzable;
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
            throw new Error('TypeScript pactification: match.index invalid');
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
            throw new Error('Needle not found in haystack');
        }
        const left = haystack.slice(0, checkContext.index + leftContext.length);
        const right = haystack.slice(checkContext.index + checkContext[0].length - rightContext.length);
        if (fullRe.exec(haystack)) {
            throw new Error('Insufficient cloze context');
        }
        return [[left, null, right], [cloze]];
    }
    let cloze = needleMaybeContext;
    let clozeRe = new RegExp(cloze, 'g');
    let clozeHit = clozeRe.exec(haystack);
    if (clozeHit) {
        let left = haystack.slice(0, clozeHit.index);
        let right = haystack.slice(clozeHit.index + cloze.length);
        if (clozeRe.exec(haystack)) {
            throw new Error('Cloze context required');
        }
        return [[left, null, right], [cloze]];
    }
    throw new Error('Could not find cloze');
}
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
function findDashIndex(s) {
    let dashMatch = s.match(/-/);
    if (!dashMatch || dashMatch.index === undefined) {
        throw new Error('TypeScript pacification: regexp failed?');
    }
    return dashMatch.index;
}
function findSubBlockLength(block, startIdx) {
    let headSpaces = findDashIndex(block[startIdx]);
    let subBullets = block.slice(startIdx + 1).findIndex(s => findDashIndex(s) <= headSpaces);
    if (subBullets < 0) {
        return block.length - startIdx;
    }
    return subBullets + 1;
}
function blockToFirstEbisu(block, status) {
    const ebisuRegexp = new RegExp('^\\s*' + ebisuInit);
    const nonwsRegexp = /\S+/;
    for (let [lidx, line] of utils_1.enumerate(block)) {
        let res = line.match(ebisuRegexp);
        if (!res) {
            continue;
        }
        let withoutInit = line.slice(res[0].length);
        res = withoutInit.match(nonwsRegexp);
        if (!res) {
            continue;
        }
        let name = res[0];
        let withoutCruft = withoutInit.slice(res[0].length);
        let ebisu = ebisu_1.Ebisu.fromString(withoutCruft.replace(ebisuDateSeparator, ebisu_1.Ebisu.fieldSeparator).trim());
        if (status) {
            status.lino = lidx;
        }
        return { name, ebisu };
    }
    return null;
}
function updateBlockEbisu(block, startIdx, ebisu) {
    let rows = findSubBlockLength(block, startIdx);
    const ebisuRegexp = new RegExp('^\\s*' + ebisuInit + '[^ ]+ ');
    for (let [lidx, line] of utils_1.enumerate(block.slice(startIdx, startIdx + rows))) {
        let hit = line.match(ebisuRegexp);
        if (!hit) {
            continue;
        }
        let eStrings = ebisu.toString();
        let eString = hit[0] + eStrings[0] + ebisuDateSeparator + ' ' + eStrings[1];
        block[lidx + startIdx] = eString;
        return;
    }
    throw new Error('Ebisu not found in block, cannot update');
}
class SentenceBlock extends Quizzable {
    constructor(block) {
        super();
        this.clozedConjugations = [];
        this.clozedParticles = [];
        this.relateds = [];
        this.ebisuNameToLino = new Map([]);
        this.clozeNameToLino = new Map([]);
        this.block = block;
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
        this.extractAll();
    }
    extractAll() {
        for (const key of this.ebisuNameToLino.keys()) {
            this.ebisuNameToLino.delete(key);
        }
        for (const key of this.clozeNameToLino.keys()) {
            this.clozeNameToLino.delete(key);
        }
        this.extractTopLevelEbisu();
        this.extractClozesRelatedsAndEbisu();
    }
    extractClozesRelatedsAndEbisu() {
        const regexps = [
            SentenceBlock.clozedConjugationStart,
            SentenceBlock.clozedParticleStart,
            SentenceBlock.relatedStart,
        ].map(s => new RegExp('^\\s*' + s));
        this.clozedConjugations = [];
        this.clozedParticles = [];
        this.relateds = [];
        const outputs = [
            this.clozedConjugations,
            this.clozedParticles,
            this.relateds,
        ];
        const update = (lidx, line, re, dest) => {
            let match = line.match(re);
            if (match) {
                let withoutInit = line.slice(match[0].length).trim();
                if (withoutInit.length === 0) {
                    throw new Error('cloze conjugation empty?');
                }
                dest.push(withoutInit);
                let title = match[0].trimLeft() + withoutInit;
                this.clozeNameToLino.set(title, lidx);
                let numBullets = findSubBlockLength(this.block, lidx);
                let status = { lino: -1 };
                let e = blockToFirstEbisu(this.block.slice(lidx, lidx + numBullets), status);
                if (e) {
                    if (!this.ebisu) {
                        this.ebisu = new Map([]);
                    }
                    this.ebisu.set(title, e.ebisu);
                    if (status.lino < 0) {
                        throw new Error('Ebisu made but lino not found?');
                    }
                    this.ebisuNameToLino.set(title, lidx + status.lino);
                }
                return true;
            }
            return false;
        };
        for (const [lidx, line] of utils_1.enumerate(this.block)) {
            for (const [re, dest] of utils_1.zip(regexps, outputs)) {
                if (update(lidx, line, re, dest)) {
                    break;
                }
                ;
            }
        }
    }
    extractTopLevelEbisu() {
        const acceptableNames = [
            // 'kanji',
            'reading',
        ];
        for (let targetName of acceptableNames) {
            this.ebisuNameToLino.delete(targetName);
            this.clozeNameToLino.delete(targetName); // and don't add!
            let hit = this.block.findIndex(s => s.indexOf(ebisuInit + targetName + ' ') >= 0);
            if (hit >= 0) {
                let e = blockToFirstEbisu([this.block[hit]]);
                if (!e) {
                    throw new Error('Expected to find Ebisu block');
                }
                if (!this.ebisu) {
                    this.ebisu = new Map([]);
                }
                if (targetName !== e.name) {
                    throw new Error('Unexpected Ebisu name mismatch');
                }
                this.ebisu.set(targetName, e.ebisu);
                this.ebisuNameToLino.set(targetName, hit);
            }
        }
    }
    predict(now, ebisu) {
        if (!this.ebisu) {
            return Infinity;
        }
        if (!ebisu) {
            return Math.min(...Array.from(this.ebisu.values(), e => e.predict(now)));
        }
        // If predict asked for the lowest-probability Ebisu object:
        let status = {};
        utils_1.argmin(Array.from(this.ebisu.values()), e => e.predict(now), status);
        ebisu.ebisu = status.min;
        return typeof status.minmapped === 'undefined' ? Infinity : status.minmapped;
    }
    learn(now, scale = 1) {
        now = now || new Date();
        this.ebisu = new Map([]);
        const make = () => ebisu_1.Ebisu.createDefault(scale * DEFAULT_HALFLIFE_HOURS, undefined, now);
        const looper = (v, init, map) => {
            for (let p of v) {
                let name = init + p;
                let ebisu = make();
                map.set(name, ebisu);
                let headerIdx = this.clozeNameToLino.get(name);
                if (typeof headerIdx === 'number') {
                    let dash = this.block[headerIdx].indexOf('-');
                    if (dash < 0) {
                        throw new Error('Failed to find dash of bullet');
                    }
                    let spaces = ' '.repeat(dash + 2);
                    let eStrings = ebisu.toString();
                    this.block.splice(headerIdx + 1, 0, spaces + ebisuInit + '_' +
                        ' ' + eStrings[0] + ebisuDateSeparator + ' ' + eStrings[1]);
                    for (let [k, v] of this.clozeNameToLino) {
                        if (v > headerIdx) {
                            this.clozeNameToLino.set(k, v + 1);
                        }
                    }
                }
                else {
                    throw new Error('Quiz name not found in clozeNameToLino:' + name);
                }
            }
        };
        looper(this.clozedParticles, SentenceBlock.clozedParticleStart, this.ebisu);
        looper(this.clozedConjugations, SentenceBlock.clozedConjugationStart, this.ebisu);
        looper(this.relateds, SentenceBlock.relatedStart, this.ebisu);
        // kanji to be decided
        for (let name of 'reading'.split(',')) {
            let ebisu = make();
            this.ebisu.set(name, ebisu);
            let eStrings = ebisu.toString();
            this.block.push(ebisuInit + name + ' ' + eStrings[0] + ebisuDateSeparator + ' ' + eStrings[1]);
        }
        this.extractAll();
    }
    preQuiz(now, quizName) {
        if (!this.ebisu) {
            throw new Error('Block has not yet been learned: no Ebisu map');
        }
        if (!quizName) {
            let findQuiz = {};
            let quizIdx = utils_1.argmin(this.ebisu.entries(), ([, v]) => v.predict(now), findQuiz);
            if (quizIdx >= 0 && findQuiz.min) {
                quizName = findQuiz.min[0];
            }
            else {
                throw new Error('Cannot find Ebisu model for quiz');
            }
        }
        else if (!this.ebisu.has(quizName)) {
            throw new Error('quiz name not found');
        }
        let hit;
        if ((hit = quizName.indexOf(SentenceBlock.clozedConjugationStart)) >= 0) {
            let cloze = quizName.slice(hit + SentenceBlock.clozedConjugationStart.length).trim();
            let [contexts, clozes] = extractClozed(this.sentence, cloze);
            return { quizName, contexts, clozes };
        }
        else if ((hit = quizName.indexOf(SentenceBlock.clozedParticleStart)) >= 0) {
            let cloze = quizName.slice(hit + SentenceBlock.clozedParticleStart.length).trim();
            let [contexts, clozes] = extractClozed(this.sentence, cloze);
            return { quizName, contexts, clozes };
        }
        else if ((hit = quizName.indexOf(SentenceBlock.relatedStart)) >= 0) {
            let related = quizName.slice(hit + SentenceBlock.relatedStart.length);
            let split = related.split(SentenceBlock.fieldSep);
            if (!(split.length === 2 || split.length === 3)) {
                throw new Error('2- or 3-item related not found');
            }
            let [reading, translation, kanji] = split.map(s => s.trim());
            if (kanji) {
                return { quizName, contexts: [`${kanji}: enter reading: `, null], clozes: [reading] };
            }
            return { quizName, contexts: [`${translation}: enter reading: `, null], clozes: [reading] };
        }
        else if (quizName === 'reading') {
            return { quizName, contexts: [`${this.sentence}: enter reading: `, null], clozes: [this.reading] };
        }
        throw new Error('unknown quiz name');
    }
    postQuiz(quizName, clozes, results, now) {
        if (!this.ebisu) {
            throw new Error('Block has not yet been learned: no Ebisu map');
        }
        const correct = clozes.every((cloze, cidx) => (cloze === results[cidx]) || (cloze === kana_1.kata2hira(results[cidx])));
        for (let [name, ebisu] of this.ebisu) {
            if (name === quizName) {
                ebisu.update(correct, now);
            }
            else {
                ebisu.passiveUpdate(now);
            }
            const idx = this.ebisuNameToLino.get(name);
            if (typeof idx !== 'number') {
                throw new Error('TypeScript pacification: name->index failed');
            }
            updateBlockEbisu(this.block, idx, ebisu);
        }
        return correct;
    }
    verify() {
        return __awaiter(this, void 0, void 0, function* () {
            const pleaseParseRegexp = /^\s*- ◊pleaseParse/;
            if (this.reading === '' || this.block.some(s => pleaseParseRegexp.test(s))) {
                let { bunsetsus } = yield parse(this.sentence);
                const parsedReading = utils_1.flatten(bunsetsus)
                    .filter(m => m.partOfSpeech[0] !== 'supplementary_symbol')
                    .map(m => utils_1.hasKanji(m.literal) ? kana_1.kata2hira(m.literal === m.lemma ? m.lemmaReading : m.pronunciation)
                    : m.literal)
                    .join('');
                if (this.reading !== parsedReading) {
                    if (this.reading.length === 0) {
                        this.reading = parsedReading;
                        let oldHeader = this.block[0];
                        let hit = oldHeader.indexOf(SentenceBlock.init);
                        if (hit < 0) {
                            throw new Error('Init string not found in block header?');
                        }
                        let hit2 = oldHeader.indexOf(SentenceBlock.fieldSep, hit + SentenceBlock.init.length);
                        if (hit2 < 0) {
                            throw new Error('Separator not found in block header?');
                        }
                        // reading should be between `hit + SentenceBlock.init.length+1` and `hit2`.
                        let newHeader = oldHeader.slice(0, hit + SentenceBlock.init.length + 1) + parsedReading + ' ' + oldHeader.slice(hit2);
                        this.block[0] = newHeader;
                    }
                }
                this.identifyQuizItems(bunsetsus);
                this.block = this.block.filter(s => !pleaseParseRegexp.test(s));
                this.extractAll();
            }
        });
    }
    identifyQuizItems(bunsetsus) {
        let clozedParticles = new Set([]);
        let clozedConjugations = new Set([]);
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
                let cloze = bunsetsuToString(ignoreRight.length === 0 ? bunsetsu : bunsetsu.slice(0, -ignoreRight.length));
                let left = bunsetsus.slice(0, bidx).map(bunsetsuToString).join('');
                let right = bunsetsuToString(ignoreRight) + bunsetsus.slice(bidx + 1).map(bunsetsuToString).join('');
                clozedConjugations.add(generateContextClozed(left, cloze, right));
            }
            else {
                // only add particles if they're NOT inside conjugated phrases
                for (let [pidx, particle] of utils_1.enumerate(bunsetsu)) {
                    if (particlePredicate(particle)) {
                        let left = bunsetsus.slice(0, bidx).map(bunsetsuToString).join('') + bunsetsuToString(bunsetsu.slice(0, pidx));
                        let right = bunsetsuToString(bunsetsu.slice(pidx + 1)) + bunsetsus.slice(bidx + 1).map(bunsetsuToString).join('');
                        clozedParticles.add(generateContextClozed(left, particle.literal, right));
                    }
                }
            }
        }
        if (utils_1.setEq(clozedParticles, new Set(this.clozedParticles)) &&
            utils_1.setEq(clozedConjugations, new Set(this.clozedConjugations))) {
            // all done.
            return;
        }
        // Existing clozes don't match parsed ones. FIXME doesn't handle over-determined contexts for clozes
        if (this.ebisu && this.ebisu.size > 0) {
            throw new Error('Refusing to modify clozes/readings for learned items (with Ebisu models)');
        }
        // Delete all existing clozes and insert new ones
        let linos = Array.from(this.clozeNameToLino.keys())
            .filter(o => o.indexOf(SentenceBlock.clozedConjugationStart) >= 0 ||
            o.indexOf(SentenceBlock.clozedParticleStart) >= 0)
            .map(k => this.clozeNameToLino.get(k));
        if (linos.some(n => typeof n === 'undefined')) {
            throw new Error('cloze not found in clozeNameToLino');
        }
        if (linos.length !== this.clozedParticles.length + this.clozedConjugations.length) {
            throw new Error('Did not find equal number of clozes and line starts');
        }
        // Important: delete from the end!
        linos.sort((a, b) => b - a);
        for (let lino of linos) {
            let nbullets = findSubBlockLength(this.block, lino);
            this.block.splice(lino, nbullets);
        }
        const initialSpaces = ' '.repeat(this.block[1] ? findDashIndex(this.block[1]) : 0);
        for (let c of clozedConjugations) {
            this.block.push(initialSpaces + SentenceBlock.clozedConjugationStart + c);
        }
        for (let p of clozedParticles) {
            this.block.push(initialSpaces + SentenceBlock.clozedParticleStart + p);
        }
        this.clozedParticles = Array.from(clozedParticles);
        this.clozedConjugations = Array.from(clozedConjugations);
    }
}
SentenceBlock.init = '◊sent';
SentenceBlock.clozedParticleStart = '- ◊cloze particle ';
SentenceBlock.clozedConjugationStart = '- ◊cloze conjugation ';
SentenceBlock.relatedStart = '- ◊related ';
SentenceBlock.fieldSep = '::';
exports.SentenceBlock = SentenceBlock;
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
const ensureFinalNewline = (s) => s.endsWith('\n') ? s : s + '\n';
const contentToString = (content) => ensureFinalNewline(content.map(o => (o instanceof Array ? o : o.block).join('\n')).join('\n'));
const USAGE = `USAGE:
$ node [this-script.js] [markdown.md]
will validate markdown.md in-place (after creating a markdown.md.bak).`;
if (require.main === module) {
    const promisify = require('util').promisify;
    const readFile = promisify(require('fs').readFile);
    const writeFile = promisify(require('fs').writeFile);
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
            // Save backup (no await, just run this later)
            writeFile(filename + '.bak', txt);
            // Validate it
            let content = textToBlocks(txt);
            console.log(content);
            let quizs = content.filter(o => o instanceof SentenceBlock);
            let q = quizs[0];
            let origBlock = q.block.slice();
            yield q.verify();
            console.log(">>> after verifying", q);
            q.learn();
            console.log('>>> block after learning', q.block);
            // Save file
            // writeFile(filename, contentToString(content));
        });
    })();
}
