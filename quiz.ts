import {cliPrompt} from './cliPrompt';
import {MaybeMorpheme, ultraCompressMorpheme} from './mecabUnidic';
import {
  BunsetsuBlock,
  Content,
  linesToBlocks,
  MorphemeBlock,
  Quizzable,
  SentenceBlock,
  VocabBlock
} from './validateMarkdown';

function argmin<T>(arr: T[], map: (element: T) => number): [T|undefined, number, number] {
  let smallestElement: T|undefined = undefined;
  let smallestMapped = Infinity;
  let smallestIdx = -1;
  for (let i = 0; i < arr.length; i++) {
    let mapped = map(arr[i])
    if (mapped < smallestMapped) {
      smallestElement = arr[i]
      smallestMapped = mapped;
      smallestIdx = i;
    }
  }
  return [smallestElement, smallestMapped, smallestIdx];
}

async function administerQuiz(toQuiz: Quizzable, mode: string) {
  if (toQuiz instanceof SentenceBlock) {
    if (mode === 'particle') {
      let particles = new Set(toQuiz.particleMorphemes.map(ultraCompressMorpheme));
      let particleNumber = 1;
      for (let m of toQuiz.morphemes) {
        if (particles.has(ultraCompressMorpheme(m))) {
          console.log(`(${particleNumber++})`);
        } else {
          console.log(m && m.literal);
        }
      }
    } else if (mode === 'conjugation') {
      const bunsetsuToString = (b: MaybeMorpheme[]) => b.map(m => m && m.literal).join('');
      let bunsetsus = new Set(toQuiz.conjugatedBunsetsus.map(bunsetsuToString));
      let number = 1;
      for (let b of toQuiz.bunsetsus) {
        if (bunsetsus.has(bunsetsuToString(b))) {
          console.log(`(${number++})`);
        } else {
          console.log(bunsetsuToString(b));
        }
      }
    } else {
      throw new Error('unknown mode for Sentence quiz');
    }
  } else if (toQuiz instanceof VocabBlock) {
    throw new Error('Unimplemented');
  } else {
    throw new Error('Unadministerable quiz type');
  }
  let input: string = await cliPrompt();
  return input;
}

const USAGE = `USAGE:
For a quiz:
    $ node [this-script.js] quiz [markdown.md]
For explicitly learning:
    $ node [this-script.js] learn [markdown.md] [n]
where optional 'n' denotes how many unlearned quizzes to skip from the top.`;
if (require.main === module) {
  const promisify = require('util').promisify;
  const readFile = promisify(require('fs').readFile);
  const writeFile = promisify(require('fs').writeFile);
  (async function() {
    if (process.argv.length < 4) {
      console.log(USAGE);
      process.exit(1);
    }
    let filename = process.argv[3];
    let content: Content[] = linesToBlocks((await readFile(filename, 'utf8')).split('\n'));

    const DEBUG = true;
    let learned: Quizzable[] = content.filter(o => o instanceof Quizzable && (DEBUG || o.ebisu)) as Quizzable[];
    let learnedSentences: SentenceBlock[] = learned.filter(o => o instanceof SentenceBlock) as SentenceBlock[];
    await Promise.all(learnedSentences.map(o => o.parse()));

    let mode = process.argv[2];
    if (mode === 'quiz') {
      let now = Date.now();
      let toQuiz: Quizzable|undefined;
      if (!DEBUG) {
        let toQuizIdx: number;
        let predictedRecall: number;
        [toQuiz, predictedRecall, toQuizIdx] = argmin(learned, o => o.predict(now));
        console.log(`The following quiz has recall probability ${predictedRecall}:`, JSON.stringify(toQuiz, null, 1));
      } else {
        // toQuiz = learned.find(o => o instanceof MorphemeBlock);
        toQuiz = learned.find(o => o instanceof BunsetsuBlock);
      }
      if (!toQuiz) {
        console.log('Nothing to review. Learn something and try again.')
        process.exit(0);
      }
      // console.log('Going to quiz:', toQuiz)
      if (toQuiz instanceof MorphemeBlock) {
        let targetMorpheme = ultraCompressMorpheme(toQuiz.morpheme);
        let candidateSentences =
            learnedSentences.filter(o => o.particleMorphemes.some(m => ultraCompressMorpheme(m) === targetMorpheme));
        console.log('Can quiz with:', candidateSentences.map(o => o.sentence), 'particle');
        if (!candidateSentences.length) { throw new Error('no candidate sentences found'); }
        let response = await administerQuiz(candidateSentences[0], 'particle');
        console.log('Got: ', response);
      } else if (toQuiz instanceof BunsetsuBlock) {
        let raw = toQuiz.bunsetsu.map(o => o ? o.literal : '').join('');
        let candidateSentences = learnedSentences.filter(o => o.sentence.includes(raw));
        if (!candidateSentences.length) { throw new Error('no candidate sentences found'); }
        console.log('Can quiz with:', candidateSentences.map(o => o.sentence), 'conjugation');
        let response = await administerQuiz(candidateSentences[0], 'conjugation');
        console.log('Got: ', response);
      } else if (toQuiz instanceof VocabBlock) {
        let probabilities = toQuiz.predictAll(now);
        let [minProb, _, minProbIdx] = argmin(probabilities, x => x);
      } else if (toQuiz instanceof SentenceBlock) {
        // This will only happen for a sentence without conjugated bunsetsu or particle morphemes, but it may happen.
      } else {
        throw new Error('Unhandled quiz type');
      }
    } else if (mode === 'learn') {
    } else {
      console.error('Unknown mode. See usage below.');
      console.error(USAGE);
      process.exit(2);
    }
  })();
}