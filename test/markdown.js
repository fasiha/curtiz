"use strict";
const md = require('../markdown');
const utils = require('../utils');
const test = require('tape');

test('Basic sentence block works', async t => {
  let raw = `# ◊sent :: (It's/I'm) Yamada :: 山田です。`;
  let content = md.textToBlocks(raw);
  t.is(1, content.length);
  t.assert(content[0] instanceof md.SentenceBlock);
  t.equal(content[0].reading, '');
  await content[0].verify();
  t.equal(content[0].reading, 'やまだです');
  t.end();
});

test('More complex parsing', async t => {
  let raw = `# ◊sent :: The teacher praised Yamada. :: 山田は先生にほめられた。`;
  let content = md.textToBlocks(raw);
  await content[0].verify();
  t.equal(content[0].reading, 'やまだはせんせいにほめられた');
  t.deepEqual(content[0].clozedConjugations, ['ほめられた']);
  t.deepEqual(content[0].clozedParticles, 'は,に'.split(','));
  t.end();
});

test('Context-cloze complex parsing', async t => {
  let raw = `# ◊sent :: The carrot praised the carrot. :: にんじんは先生にほめられた。`;
  let content = md.textToBlocks(raw);
  await content[0].verify();
  t.equal(content[0].reading, 'にんじんはせんせいにほめられた');
  t.deepEqual(content[0].clozedConjugations, ['ほめられた']);
  t.deepEqual(content[0].clozedParticles, 'は,生[に]ほ'.split(','));
  t.end();
});

test('Learning and quizzing', async t => {
  let raw = `# ◊sent :: The teacher praised the carrot. :: にんじんは先生にほめられた。`;
  let content = md.textToBlocks(raw);
  await content[0].verify();
  content[0].learn();
  t.is(content[0].ebisu && content[0].ebisu.size, 4);

  for (let name of content[0].ebisu.keys()) {
    let clozeStruct = content[0].preQuiz(undefined, name);
    t.equal(clozeStruct.quizName, name);
    t.equal(clozeStruct.contexts.filter(s => !s).length, clozeStruct.clozes.length);
    if (name.indexOf('◊cloze') >= 0) {
      t.ok(utils.fillHoles(clozeStruct.contexts, clozeStruct.clozes).join('').match(content[0].sentence));
    }
  }
  t.end();
});

test('preQuiz without a name will pick a valid quiz', async t => {
  let raw = `# ◊sent :: The teacher praised the carrot. :: にんじんは先生にほめられた。`;
  let content = md.textToBlocks(raw);
  await content[0].verify();
  content[0].learn();
  t.is(content[0].ebisu && content[0].ebisu.size, 4);

  let clozeStruct = content[0].preQuiz();
  t.ok(content[0].ebisu.has(clozeStruct.quizName));
  t.end();
});

test('Kanji in conjugated phrase will be needed during quiz', async t => {
  let raw = `# ◊sent :: The teacher praised the carrot. :: にんじんは先生に褒められた。`;
  let content = md.textToBlocks(raw);
  await content[0].verify();
  t.equal(content[0].reading, 'にんじんはせんせいにほめられた');

  content[0].learn();

  let conjQuizName = md.SentenceBlock.clozedConjugationStart + '褒められた';
  t.ok(content[0].ebisu.has(conjQuizName));
  let clozeStruct = content[0].preQuiz(undefined, conjQuizName);
  t.equal(clozeStruct.clozes[0], '褒められた');
  /*
  TODO: in `SentenceBlock.verify`, add new things like ◊bunsetsu and ◊bunsetsuReadings to let the quiz accept readings

  TODO 2: allow clozes to be sets/arrays, multiple readings
  */
  t.end();
});

test('What happens with multiple same particle? Each different particle is tracked. 😎', async t => {
  let raw = `# ◊sent :: My mom's car's color. :: 私のお母さんの車の色。`;
  let content = md.textToBlocks(raw);
  await content[0].verify();
  content[0].learn();
  for (let name of content[0].ebisu.keys()) {
    let clozeStruct = content[0].preQuiz(undefined, name);
    if (name.indexOf('◊cloze') >= 0) {
      t.ok(utils.fillHoles(clozeStruct.contexts, clozeStruct.clozes).join('').match(content[0].sentence));
    }
  }
  t.end();
});

test('postQuiz', async t => {
  let raw = `# ◊sent :: My mom's car's color. :: 私のお母さんの車の色。`;
  let content = md.textToBlocks(raw);
  await content[0].verify();

  let now = new Date();
  let hourAgo = new Date(now.valueOf() - 36e5);
  content[0].learn(hourAgo);

  let initModels =
      new Map([...utils.zip(Array.from(content[0].ebisu.keys()), Array.from(content[0].ebisu.values(), e => e.model))]);
  let block = content[0].block.slice();
  for (let name of content[0].ebisu.keys()) {
    let clozeStruct = content[0].preQuiz(undefined, name);
    content[0].postQuiz(name, clozeStruct.clozes, ['WRONG'], now);

    // The model of the quiz under the test will change, but the rest will stay the same (passive update). BECAUSE, we
    // assume the full sentence is shown to the user after each quiz. Apps that don't do this will have to revisit this
    // assumption.
    for (let [k, v] of content[0].ebisu) { (k === name ? t.notDeepEqual : t.deepEqual)(v.model, initModels.get(name)); }

    // reset clock
    content[0].block = block.slice();
    content[0].extractAll();
  }
  t.end();
});

test('Related cards with kanji', async t => {
  let raw = `# ◊sent :: My mom's car's color. :: 私のお母さんの車の色。
- ◊related わたし :: I :: 私`;
  let content = md.textToBlocks(raw);
  await content[0].verify();
  content[0].learn();
  let clozeStruct = content[0].preQuiz(undefined, '- ◊related わたし :: I :: 私');
  // One of the context strings should have the kanji in question
  t.ok(clozeStruct.contexts.some(s => s.indexOf('私') >= 0));
  // And one of the cloze strings should have the reading in question
  t.ok(clozeStruct.clozes.some(s => s.indexOf('わたし') >= 0));
  t.end();
});

test('Related cards with NO kanji', async t => {
  let raw = `# ◊sent ごじまで　:: till 5 o'clock :: 五時まで
- ◊related まで :: till`;
  let content = md.textToBlocks(raw);
  await content[0].verify();
  content[0].learn();
  for (let name of content[0].ebisu.keys()) {
    let clozeStruct = content[0].preQuiz(undefined, name);
    if (name.indexOf('◊related') >= 0) {
      t.ok(clozeStruct.contexts.some(s => s.indexOf('till') >= 0));
      t.ok(clozeStruct.clozes.some(s => s.indexOf('まで') >= 0));
    }
  }
  t.end();
});

test('Throw when no kanji', async t => {
  let raw = `# ◊sent まで　:: till`;
  t.throws(() => md.textToBlocks(raw))
  t.end();
});

// TODO 3: check if multiple blocks declare the same `◊related`. At least warn. Ideally, quizzing one of these ◊relateds
// updates all their Ebisus.