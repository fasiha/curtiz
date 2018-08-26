import * as mecab from './mecabUnidic';
import {Content, linesToBlocks, Quizzable, SentenceBlock} from './validateMarkdown';

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
    let learned = content.filter(o => o instanceof Quizzable);
    console.log(learned);

    let mode = process.argv[2];
    if (mode === 'quiz') {
    } else if (mode === 'learn') {
    } else {
      console.error('Unknown mode. See usage below.');
      console.error(USAGE);
      process.exit(2);
    }
  })();
}