let hiragana = "ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなに" +
               "ぬねのはばぱひびぴふぶぷへべぺほぼまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ";
let katakana = "ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニ" +
               "ヌネノハバパヒビピフブプヘベペホボマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ";

if (hiragana.length !== katakana.length) { throw new Error('Kana strings not same length?'); }
let kata2hiraMap: Map<string, string> = new Map([]);
hiragana.split('').forEach((h, i) => kata2hiraMap.set(katakana[i], h));

export function kata2hira(s: string) { return s.split('').map(c => kata2hiraMap.get(c) || c).join(''); }

let k0 = katakana.charCodeAt(0);
let k1 = katakana.charCodeAt(katakana.length - 1);
export function kata2hiraFast(s: string) {
  return s.split('')
      .map(c => {
        let n = c.charCodeAt(0);
        return (n >= k0 && n <= k1) ? String.fromCharCode(n - 96) : c;
      })
      .join('');
}

if (module === require.main) {
  let s =
      `『バフィー 〜恋する十字架〜』とエンジェルのクリエイターであるジョス・ウィードンによりクリエイトおよび3エピソードが監督された。彼の製作会社である、ミュータント・エネミー・プロダクションズにプロデュースされた。自然主義の伝統的な西部劇をモチーフとしており、ウィドゥンはティム・マイニアとともにエグゼクティブプロデューサーを務めた。

    ファイヤーフライはアメリカとカナダで2002年9月20日にFOXネットワークでプレミア放送された。成績が悪かったために14エピソード中11エピソードの放送で打ち切られた。しかし、その後DVD化されると好調な売り上げを記録し、2003年にはエミー賞のシリーズ視覚効果賞を受賞した。そのため、製作サイドは完結編の企画をユニバーサル・ピクチャーズに持ち込み劇場映画として実現、『セレニティー』のタイトルで公開された。
    
    アメリカ本国ではDVD-BOXが発売されているが日本では映像ソフトは未発売である(映画『セレニティー』はDVD、Blu-rayともに国内盤が発売)。日本ではネットフリックスが字幕版を動画配信しており、視聴が可能である(2017年現在)。
    
    主演のネイサン・フィリオンは本作に愛着があるらしく、後に主演したテレビドラマ『キャッスル』において、本作のパロディーが散見される。また、オマージュと思われるエピソードもある。 `;

  let assert = require('assert');
  assert(kata2hira(s) === kata2hiraFast(s));

  console.time("kata2hira1");
  { let k = kata2hira(s); }
  console.timeEnd("kata2hira1");
  console.time("kata2hiraFast1");
  { let k = kata2hiraFast(s); }
  console.timeEnd("kata2hiraFast1");

  console.time("kata2hira2");
  { let k = kata2hira(s); }
  console.timeEnd("kata2hira2");
  console.time("kata2hiraFast2");
  { let k = kata2hiraFast(s); }
  console.timeEnd("kata2hiraFast2");

  console.time("kata2hiraFast3");
  { let k = kata2hiraFast(s); }
  console.timeEnd("kata2hiraFast3");
  console.time("kata2hira3");
  { let k = kata2hira(s); }
  console.timeEnd("kata2hira3");
}