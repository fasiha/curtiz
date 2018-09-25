import test from 'tape';

import {Ebisu} from '../ebisu';
import * as md from '../markdown';
import * as utils from '../utils';

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
  t.deepEqual(s.bullets.filter(b => b instanceof md.QuizClozedConjugation)
                  .map(c => (c as md.QuizClozedConjugation).conjugation),
              ['ほめられた']);
  t.deepEqual(s.bullets.filter(b => b instanceof md.QuizClozedParticle).map(c => (c as md.QuizClozedParticle).particle),
              'は,に'.split(','));
  t.end();
});

test('Context-cloze complex parsing', async t => {
  let raw = `# ◊sent :: The carrot praised the carrot. :: にんじんは先生にほめられた。`;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);

  await s.verify();
  t.equal(s.reading, 'にんじんはせんせいにほめられた');
  t.deepEqual(s.bullets.filter(b => b instanceof md.QuizClozedConjugation)
                  .map(c => (c as md.QuizClozedConjugation).conjugation),
              ['ほめられた']);
  t.deepEqual(s.bullets.filter(b => b instanceof md.QuizClozedParticle).map(c => (c as md.QuizClozedParticle).particle),
              'は,生[に]ほ'.split(','));
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
    if (quiz instanceof md.QuizClozedConjugation || quiz instanceof md.QuizClozedParticle) {
      t.ok(utils.fillHoles(clozeStruct.contexts, clozeStruct.clozes).join('').includes(s.sentence));
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
      if (prediction) {
        prediction.quiz.preQuiz();
      } else {
        throw new Error('TypeScript pacification: prediction is not undefined.');
      }
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

  let conjQuizs = s.bullets.filter(b => b instanceof md.QuizClozedConjugation);
  t.is(conjQuizs.length, 1);
  let quiz: md.QuizClozedConjugation = conjQuizs[0] as md.QuizClozedConjugation;
  t.is(quiz.conjugation, '褒められた');
  let clozeStruct = quiz.preQuiz();
  t.equal(clozeStruct.clozes[0], '褒められた');
  t.end();
  // TODO: allow clozes to be sets/arrays, multiple readings
});

test('What happens with multiple same particle? Each different particle is tracked. 😎', async t => {
  let raw = `# ◊sent :: My mom's car's color. :: 私のお母さんの車の色。`;
  let content = md.textToBlocks(raw);
  let s: md.SentenceBlock = content[0] as md.SentenceBlock;
  t.assert(s instanceof md.SentenceBlock);

  await s.verify();
  s.learn();
  let quizs = s.bullets.filter(b => b instanceof md.QuizClozedParticle) as md.QuizClozedParticle[];

  for (let quiz of quizs) {
    let clozeStruct = quiz.preQuiz();
    t.ok(utils.fillHoles(clozeStruct.contexts, clozeStruct.clozes).join('').includes(s.sentence));
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
  let initEbisus: Ebisu[] = quizs.map(q => q.ebisu);
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
// TODO 2: check if multiple blocks declare the same `◊related`. At least warn. Ideally, quizzing one of these ◊relateds
// updates all their Ebisus.
