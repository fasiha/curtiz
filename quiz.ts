import {fill} from './cliFillInTheBlanks';
import {cliPrompt} from './cliPrompt';
import {Ebisu} from './ebisu';
import {Morpheme, ultraCompressMorpheme, ultraCompressMorphemes} from './mecabUnidic';
import {argmin, enumerate, fillHoles, zip} from './utils';
import {
  BunsetsuBlock,
  Content,
  linesToBlocks,
  MorphemeBlock,
  Quizzable,
  SentenceBlock,
  VocabBlock
} from './validateMarkdown';

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

function gradeQuiz(quizzables: Quizzable[], input: string[], toQuiz: Quizzable, mode?: string): boolean[] {
  let now = new Date();
  let corrects: boolean[] = [];
  if (toQuiz instanceof SentenceBlock) {
    if (!toQuiz.ebisu) { throw new Error('Ebisu field expected'); }
    toQuiz.ebisu.update(true, now); // Don't passive update this!
    toQuiz.updateBlock();
    if (mode === 'particle') {
      let stringToMorphemeBlock: Map<string, MorphemeBlock> = new Map([]);
      for (const q of quizzables) {
        if (q instanceof MorphemeBlock) { stringToMorphemeBlock.set(ultraCompressMorpheme(q.morpheme), q); }
      }
      for (let [midx, m] of enumerate(toQuiz.particleMorphemes)) {
        const correct = m.literal === input[midx];
        let q = stringToMorphemeBlock.get(ultraCompressMorpheme(m));
        if (!q) { throw new Error('Morpheme not found in list of quizzables'); }
        if (!q.ebisu) { throw new Error('Ebisu field expected'); }
        q.ebisu.update(correct, now);
        q.updateBlock();
        corrects.push(correct);
      }
    } else if (mode === 'conjugation') {
      let stringToBunsetsuBlock: Map<string, BunsetsuBlock> = new Map([]);
      for (const q of quizzables) {
        if (q instanceof BunsetsuBlock) { stringToBunsetsuBlock.set(ultraCompressMorphemes(q.bunsetsu), q); }
      }
      for (let [bidx, b] of enumerate(toQuiz.conjugatedBunsetsus)) {
        // FIXME: DRY with above 'particle' block
        const correct = bunsetsuToString(b) === input[bidx];
        let q = stringToBunsetsuBlock.get(ultraCompressMorphemes(b));
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
    const correct = input[0] === toQuiz.reading;
    for (const qq of quizzables) {
      let q: VocabBlock = qq as VocabBlock;
      if (toQuiz.reading === q.reading) {
        if (!q.ebisu) { throw new Error('Ebisu field expected'); }
        q.ebisu[0].update(correct, now);
        q.updateBlock();
        break;
      }
    }
    return [correct];
  }
  throw new Error('Unadministerable quiz type');
}

async function administerQuiz(toQuiz: Quizzable, mode?: string): Promise<string[]> {
  if (toQuiz instanceof SentenceBlock) {
    if (mode === 'particle') {
      let particles = new Set(toQuiz.particleMorphemes.map(ultraCompressMorpheme));
      let clozes: (string|null)[] =
          toQuiz.morphemes.map(m => particles.has(ultraCompressMorpheme(m)) ? null : (m ? m.literal : ''));
      let responses: string[] = await cloze(clozes);
      fillHoles(clozes, responses);
      console.log('quiz responses', responses);
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
      console.log('quiz responses:', responses);
      return responses;
    } else {
      throw new Error('unknown mode for Sentence quiz');
    }
  } else if (toQuiz instanceof VocabBlock) {
    if (toQuiz.kanji) {
      console.log(`${toQuiz.kanji}（${toQuiz.translation}）: enter reading.`);
    } else {
      console.log(`${toQuiz.translation}: enter reading.`);
    }
    let response = await cliPrompt();
    console.log('quiz responses:', response);
    return [response];
  }
  throw new Error('Unadministerable quiz type');
}

const USAGE = `USAGE:
For a quiz:
    $ node [this-script.js] quiz [markdown.md]
For learning:
    $ node [this-script.js] learn [markdown.md]
Either of these will overwrite markdown.md (after creating markdown.md.bak backup).`;
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
    let content: Content[] = linesToBlocks(text.split('\n'));

    const DEBUG = !true;
    let learned: Quizzable[] = content.filter(o => o instanceof Quizzable && o.ebisu) as Quizzable[];
    let learnedSentences: SentenceBlock[] = learned.filter(o => o instanceof SentenceBlock) as SentenceBlock[];
    await Promise.all(learnedSentences.map(o => o.parse()));

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

      let learnedStringToQuizzable: Map<string, Quizzable> = new Map([]);
      for (let q of learned) {
        if (q instanceof MorphemeBlock) {
          learnedStringToQuizzable.set(ultraCompressMorpheme(q.morpheme), q);
        } else if (q instanceof BunsetsuBlock) {
          learnedStringToQuizzable.set(ultraCompressMorphemes(q.bunsetsu), q);
        }
      }

      if (toQuiz instanceof MorphemeBlock) {
        let targetMorpheme = ultraCompressMorpheme(toQuiz.morpheme);
        let candidateSentences =
            learnedSentences.filter(o => o.particleMorphemes.some(m => ultraCompressMorpheme(m) === targetMorpheme));
        if (!candidateSentences.length) { throw new Error('no candidate sentences found'); }

        let sentenceToQuiz = candidateSentences[0];
        let response = await administerQuiz(sentenceToQuiz, 'particle');

        let relevantQuizzables =
            (sentenceToQuiz.particleMorphemes.map(m => learnedStringToQuizzable.get(ultraCompressMorpheme(m))));
        if (relevantQuizzables.some(o => !o)) { throw new Error('Sentence has morphemes not being tracked'); }
        let grades = gradeQuiz(relevantQuizzables as Quizzable[], response, sentenceToQuiz, 'particle');
        console.log('response', response, 'grades', grades);

      } else if (toQuiz instanceof BunsetsuBlock) {
        let raw = toQuiz.bunsetsu.map(o => o ? o.literal : '').join('');
        let candidateSentences = learnedSentences.filter(o => o.sentence.includes(raw));
        if (!candidateSentences.length) { throw new Error('no candidate sentences found'); }

        // FIXME DRY above
        let sentenceToQuiz = candidateSentences[0];
        let response = await administerQuiz(sentenceToQuiz, 'conjugation');

        let relevantQuizzables =
            (sentenceToQuiz.conjugatedBunsetsus.map(b => learnedStringToQuizzable.get(ultraCompressMorphemes(b))));
        console.log('rel', relevantQuizzables)
        if (relevantQuizzables.some(o => !o)) { throw new Error('Sentence has bunsetsu not being tracked'); }
        let grades = gradeQuiz(relevantQuizzables as Quizzable[], response, sentenceToQuiz, 'conjugation');
        console.log('response', response, 'grades', grades);

      } else if (toQuiz instanceof VocabBlock) {
        let response = await administerQuiz(toQuiz);
        let grades = gradeQuiz([toQuiz], response, toQuiz);
        console.log('response', response, 'grades', grades);
      } else if (toQuiz instanceof SentenceBlock) {
        // This will only happen for a sentence without conjugated bunsetsu or particle morphemes, but it may happen.
      } else {
        throw new Error('Unhandled quiz type');
      }
      writeFile(filename, contentToString(content));
    } else if (mode === 'learn') {
      let toLearn: VocabBlock|SentenceBlock|undefined =
          content.find(o => o instanceof VocabBlock || o instanceof SentenceBlock) as
          (VocabBlock | SentenceBlock | undefined);
      if (!toLearn) {
        console.log('Nothing to learn!');
        process.exit(0);
        return;
      }
      console.log('Learn this:');
      if (toLearn instanceof SentenceBlock) {
        console.log('>> ' + toLearn.sentence);
        if (toLearn.bunsetsus && toLearn.bunsetsus.length > 0) {
          console.log(toLearn.bunsetsus.map(morphemesToTsv).join('\n---\n'));
          console.log(
              toLearn.conjugatedBunsetsus.map(s => ('>>' + morphemesToTsv(s)).replace(/\n/g, '\n  ')).join('\n'));
        }
        if (toLearn.particleMorphemes && toLearn.particleMorphemes.length > 0) {
          console.log(('..' + morphemesToTsv(toLearn.particleMorphemes)).replace(/\n/g, '\n..'));
        }
      } else if (toLearn instanceof VocabBlock) {
        console.log(`${toLearn.reading}: ${toLearn.translation || ''}: ${toLearn.kanji || ''}`);
      } else {
        throw new Error('unknown type to learn');
      }
      await cliPrompt('Enter to indicate you have learned this');
      toLearn.learn();
      toLearn.updateBlock();
      writeFile(filename, contentToString(content));
    } else {
      console.error('Unknown mode. See usage below.');
      console.error(USAGE);
      process.exit(2);
    }
  })();
}