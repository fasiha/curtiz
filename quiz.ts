import {Content, linesToBlocks, Quizzable, SentenceBlock} from './validateMarkdown';

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
    let learned: Quizzable[] = content.filter(o => o instanceof Quizzable && o.ebisu) as Quizzable[];

    let mode = process.argv[2];
    if (mode === 'quiz') {
      let now = Date.now();
      let [toQuiz, predictedRecall, toQuizIdx] = argmin(learned, (o: Quizzable) => o.predict(now));
      console.log(`The following quiz has recall probability ${predictedRecall}:`, JSON.stringify(toQuiz, null, 1));
    } else if (mode === 'learn') {
    } else {
      console.error('Unknown mode. See usage below.');
      console.error(USAGE);
      process.exit(2);
    }
  })();
}