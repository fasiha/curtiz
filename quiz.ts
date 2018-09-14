import {fill} from './cliFillInTheBlanks';
import {Morpheme, ultraCompressMorpheme} from './mecabUnidic';
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

function fillHoles<T>(a: T[], b: T[], predicate: (a: T) => boolean = (o => !o)) {
  let bidx = 0;
  for (let aidx in a) {
    if (predicate(a[aidx])) { a[aidx] = b[bidx++]; }
  }
  return a;
}

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

async function administerQuiz(toQuiz: Quizzable, mode: string) {
  if (toQuiz instanceof SentenceBlock) {
    if (mode === 'particle') {
      let particles = new Set(toQuiz.particleMorphemes.map(ultraCompressMorpheme));
      let clozes: (string|null)[] =
          toQuiz.morphemes.map(m => particles.has(ultraCompressMorpheme(m)) ? null : (m ? m.literal : ''));
      let responses: string[] = await cloze(clozes);
      fillHoles(clozes, responses);
      console.log('quiz responses', responses);
    } else if (mode === 'conjugation') {
      const bunsetsuToString = (b: Morpheme[]) => b.map(m => m.literal).join('');
      console.log(toQuiz)
      let bunsetsus = new Set(toQuiz.conjugatedBunsetsus.map(bunsetsuToString));
      let number = 1;
      let toPrint =
          toQuiz.bunsetsus.map(b => bunsetsus.has(bunsetsuToString(b)) ? `(${number++})` : bunsetsuToString(b))
              .join('');
      console.log(toPrint);
    } else {
      throw new Error('unknown mode for Sentence quiz');
    }
  } else if (toQuiz instanceof VocabBlock) {
    throw new Error('Unimplemented');
  } else {
    throw new Error('Unadministerable quiz type');
  }
  // let input: string = await cliPrompt();
  // return input;
  return '';
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
        toQuiz = learned.find(o => o instanceof MorphemeBlock);
        // toQuiz = learned.find(o => o instanceof BunsetsuBlock);
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
        // console.log('Can quiz with:', candidateSentences.map(o => o.sentence), 'particle');
        if (!candidateSentences.length) { throw new Error('no candidate sentences found'); }
        let response = await administerQuiz(candidateSentences[0], 'particle');
        console.log('Got: ', response);
      } else if (toQuiz instanceof BunsetsuBlock) {
        let raw = toQuiz.bunsetsu.map(o => o ? o.literal : '').join('');
        let candidateSentences = learnedSentences.filter(o => o.sentence.includes(raw));
        if (!candidateSentences.length) { throw new Error('no candidate sentences found'); }
        // console.log('Can quiz with:', candidateSentences.map(o => o.sentence), 'conjugation');
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