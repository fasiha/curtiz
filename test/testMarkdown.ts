import test from 'tape';

import {Ebisu} from '../ebisu';
import * as md from '../markdown';
import * as utils from '../utils';
import {flatten} from '../utils';

test('Basic sentence block works', async t => {
  let raw = `# ◊sent :: (It's/I'm) Yamada :: 山田です。`;
  let content = md.textToBlocks(raw);
  t.is(1, content.length);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);
  t.equal(s.reading, '');
  await s.verify();
  t.equal(s.reading, 'やまだです');
  t.end();
});

test('More complex parsing', async t => {
  let raw = `# ◊sent :: The teacher praised Yamada. :: 山田は先生にほめられた。`;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);
  await s.verify();
  t.equal(s.reading, 'やまだはせんせいにほめられた');
  let clozes: string[] =
      flatten(s.bullets.filter(b => b instanceof md.QuizCloze).map(c => flatten((c as md.QuizCloze).cloze.clozes)))
          .sort();
  t.deepEqual(clozes, 'に,は,ほめられた'.split(',').sort());
  t.end();
});

test('Context-cloze complex parsing', async t => {
  let raw = `# ◊sent :: The teacher praised the carrot. :: にんじんは先生にほめられた。`;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);

  await s.verify();
  t.equal(s.reading, 'にんじんはせんせいにほめられた');
  let clozes: string[] =
      flatten(s.bullets.filter(b => b instanceof md.QuizCloze).map(c => (c as md.QuizCloze).acceptables)).sort();
  t.deepEqual(clozes, 'は,生[に]ほ,ほめられた'.split(',').sort());
  t.end();
});

test('Multiple acceptable clozes', async t => {
  let raw = `# ◊sent :: The teacher praised the carrot. :: にんじんは先生に褒められた。`; // use kanji here: 褒める
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  await s.verify();
  t.equal(s.reading, 'にんじんはせんせいにほめられた'); // same as above
  let clozes: string[] =
      flatten(s.bullets.filter(b => b instanceof md.QuizCloze).map(c => (c as md.QuizCloze).acceptables)).sort();
  t.deepEqual(clozes, 'は,生[に]褒,ほめられた,褒められた'.split(',').sort());
  t.end();
});

test('Learning and quizzing', async t => {
  let raw = `# ◊sent :: The teacher praised the carrot. :: にんじんは先生にほめられた。`;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);

  await s.verify();
  s.learn();
  let quizs = s.bullets.filter(b => b instanceof md.Quiz);
  t.is(quizs.map(q => (q as md.Quiz).ebisu).length, 4);

  for (let quiz of (quizs as md.Quiz[])) {
    let clozeStruct = quiz.preQuiz();
    t.equal(clozeStruct.contexts.filter(s => !s).length, clozeStruct.clozes.length);
    if (quiz instanceof md.QuizCloze) {
      t.ok(
          clozeStruct.clozes.some(cloze => utils.fillHoles(clozeStruct.contexts, cloze).join('').includes(s.sentence)));
    }
  }
  t.end();
});

test('preQuiz without a name will pick a valid quiz', async t => {
  let raw = `# ◊sent :: The teacher praised the carrot. :: にんじんは先生にほめられた。`;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);
  await s.verify();
  s.learn();
  let quizs = s.bullets.filter(b => b instanceof md.Quiz);
  t.is(quizs.map(q => (q as md.Quiz).ebisu).length, 4);

  let prediction = s.predict();
  t.ok(!!prediction);
  if (prediction) {
    t.ok(prediction.quiz instanceof md.Quiz)
    t.doesNotThrow(() => {
      if (prediction) { prediction.quiz.preQuiz(); }
    });
  }
  t.end();
});

test('Kanji in conjugated phrase will be needed during quiz', async t => {
  let raw = `# ◊sent :: The teacher praised the carrot. :: にんじんは先生に褒められた。`;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);

  await s.verify();
  t.equal(s.reading, 'にんじんはせんせいにほめられた');

  s.learn();

  let clozes = s.bullets.filter(b => b instanceof md.QuizCloze) as md.QuizCloze[];
  t.is(clozes.length, 3);
  let quiz = clozes.filter(q => q.cloze.clozes[0][0].endsWith('れた'))[0];
  t.deepEqual(quiz.cloze.clozes[0].slice().sort(), '褒められた,ほめられた'.split(',').sort());
  let clozeStruct = quiz.preQuiz();
  t.deepEqual(clozeStruct.clozes[0].slice().sort(), '褒められた,ほめられた'.split(',').sort());
  t.end();
});

test('What happens with multiple same particle? Each different particle is tracked. 😎', async t => {
  let raw = `# ◊sent :: My mom's car's color. :: 私のお母さんの車の色。`;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);

  await s.verify();
  s.learn();
  let quizs = s.bullets.filter(b => b instanceof md.QuizCloze) as md.QuizCloze[];

  for (let quiz of quizs) {
    let clozeStruct = quiz.preQuiz();
    t.ok(clozeStruct.clozes.some(cloze => utils.fillHoles(clozeStruct.contexts, cloze).join('').includes(s.sentence)));
  }
  t.end();
});

test('postQuiz', async t => {
  let raw = `# ◊sent :: My mom's car's color. :: 私のお母さんの車の色。`;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);
  await s.verify();

  let now = new Date();
  let hourAgo = new Date(now.valueOf() - 36e5);
  s.learn(hourAgo);

  let quizs = s.bullets.filter(b => b instanceof md.Quiz) as md.Quiz[];
  let initEbisus: Ebisu[] = quizs.map(q => q.ebisu).filter(e => !!e) as Ebisu[];
  t.ok(initEbisus.every(x => x instanceof Ebisu))
  let initModels = initEbisus.map(e => e.model);
  let initStrings = initEbisus.map(e => e.toString());
  for (let [qidx, quiz] of utils.enumerate(quizs)) {
    let clozeStruct = quiz.preQuiz();
    t.assert(!s.postQuiz(quiz, clozeStruct.clozes, ['WRONG'], now));

    // The model of the quiz under the test will change, but the rest will stay the same (passive update). BECAUSE, we
    // assume the full sentence is shown to the user after each quiz. Apps that don't do this will have to revisit this
    // assumption.
    for (let [midx, innerQuiz] of utils.enumerate(quizs)) {
      (midx === qidx ? t.notDeepEqual : t.deepEqual)((innerQuiz.ebisu as Ebisu).model, initModels[midx]);
    }

    // reset clock
    quizs.forEach((q, i) => q.ebisu = Ebisu.fromString(initStrings[i]));
  }
  t.end();
});

test('Related cards with kanji', async t => {
  let raw = `# ◊sent :: My mom's car's color. :: 私のお母さんの車の色。
- ◊related わたし :: I :: 私`;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);

  await s.verify();
  s.learn();
  let related = s.bullets.find(b => b instanceof md.QuizRelated);
  t.ok(related instanceof md.QuizRelated);
  if (!(related instanceof md.QuizRelated)) { throw new Error('typescript pacification: related is checked by tape'); }
  let clozeStruct = related.preQuiz();
  // One of the context strings should have the kanji in question
  t.ok(clozeStruct.contexts.some(s => !!s && s.indexOf('私') >= 0));
  // And one of the cloze strings should have the reading in question
  t.ok(clozeStruct.clozes.some(s => s.indexOf('わたし') >= 0));
  t.end();
});

test('Related cards with NO kanji', async t => {
  let raw = `# ◊sent ごじまで　:: till 5 o'clock :: 五時まで
- ◊related まで :: till`;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);

  await s.verify();
  s.learn();
  let quiz = s.bullets.find(b => b instanceof md.QuizRelated) as md.QuizRelated;
  let clozeStruct = quiz.preQuiz();
  t.ok(clozeStruct.contexts.some(s => !!s && s.indexOf('till') >= 0));
  t.ok(clozeStruct.clozes.some(s => s.indexOf('まで') >= 0));
  t.end();
});

test('Throw when no kanji', async t => {
  let raw = `# ◊sent まで　:: till`;
  t.throws(() => md.textToBlocks(raw))
  t.end();
});

test('quizzing a partially-learned block learns them all', async t => {
  let now = new Date();
  let hourAgo = new Date(now.valueOf() - 36e5);

  let raw = `# ◊sent ごじまで　:: till 5 o'clock :: 五時まで
- ◊Ebisu1 reading ${hourAgo.toISOString()}, 3,3,0.25
- ◊related まで :: till`;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);
  await s.verify();
  let pred = s.predict();
  t.ok(pred);
  if (!pred) { throw new Error('typescript/tape pacification'); }

  t.ok(s.bullets.filter(b => b instanceof md.Quiz).some(q => !((q as md.Quiz).ebisu)));
  s.postQuiz(pred.quiz, [['x']], ['y'], now);
  t.ok(pred.quiz.ebisu);
  t.ok(s.bullets.filter(b => b instanceof md.Quiz).every(q => !!((q as md.Quiz).ebisu)));
  t.end();
});

test('throw when cloze not available', t => {
  let raw = `# ◊sent まで　:: till :: まで
- ◊cloze ___`;
  t.throws(() => md.textToBlocks(raw))
  t.end();
});

test('multiple clozes possible', t => {
  let raw = `# ◊sent abc　:: ?? :: abc
  - ◊cloze a // A // å `;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  s.learn();
  let q = s.bullets.filter(q => q instanceof md.QuizCloze)[0] as md.QuizCloze;
  t.deepEqual(q.acceptables.slice().sort(), 'a,A,å'.split(',').sort())
  t.deepEqual(q.cloze.clozes[0].slice().sort(), 'a,A,å'.split(',').sort())
  t.ok(s.postQuiz(q, q.cloze.clozes, ['a']));    // correct
  t.ok(s.postQuiz(q, q.cloze.clozes, ['A']));    // correct
  t.ok(s.postQuiz(q, q.cloze.clozes, ['å']));    // correct
  t.ok(!s.postQuiz(q, q.cloze.clozes, ['___'])); // not correct
  t.end();
})