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
      t.equal(utils.fillHoles(clozeStruct.contexts, clozeStruct.clozes).join(''), content[0].sentence);
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
  let raw = `# ◊sent :: The teacher praised the carrot. :: 私のお母さんの車の色。`;
  let content = md.textToBlocks(raw);
  await content[0].verify();
  content[0].learn();
  for (let name of content[0].ebisu.keys()) {
    let clozeStruct = content[0].preQuiz(undefined, name);
    if (name.indexOf('◊cloze') >= 0) {
      t.equal(utils.fillHoles(clozeStruct.contexts, clozeStruct.clozes).join(''), content[0].sentence);
    }
  }
  t.end();
});

// TODO: ◊part, postQuiz