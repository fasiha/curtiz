"use strict";
const md = require('../markdown');
const test = require('tape');

test('Basic sentence block works', async t => {
  let raw = `- ◊sent 山田です。`.split('\n');
  let content = md.linesToBlocks(raw);
  console.log(content);
  t.is(1, content.length);
  t.assert(content[0] instanceof md.SentenceBlock);

  await content[0].parse();

  console.log(content);
  t.is(3, content[0].morphemes.length);
  t.is(1, content[0].bunsetsus.length);
  t.end();
});