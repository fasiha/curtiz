"use strict";
const test = require('tape');
const kana = require('../kana');
let hiragana =
    "ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ";
let katakana =
    "ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ";

test('functionality test, k->h', t => {
  t.equal(kana.kata2hira(katakana), hiragana);
  t.equal(kana.kata2hira(hiragana), hiragana);
  t.end();
});
test('h->k', t => {
  t.equal(kana.hira2kata(hiragana), katakana);
  t.equal(kana.hira2kata(katakana), katakana);
  t.end();
})