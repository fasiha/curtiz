# Japanese vocabulary #blabla

Balbal # bla Don't - ◊vocab this!XXX

## Tom's deck

Question: how to handle kanji reviews? It doesn't make sense to ask "here's reading and meaning, which kanji is it, multiple-choice" because recognizing kanji from a list of them is as effective as the reading quiz, "here's the kanji and meaning, what's the reading": both involve looking at kanji. So a kanji quiz should be writing only: still show the reading+meaning, and don't show the kanji, and ask to write it, with a self-grade for writing (or "skip kanji quizzes for the next hour, I don't have a pen/finger").

Next question. How to handle sentences. J.DeP can do bunsetsu chunking: one bunsetsu often ends in a particle:
- この │ 中 で │ 誰 が │ 猫 の │ 首 に │ 鈴 を │ 付け に │ 行く ん だい ？
- 私 たち は │ 東京 駅 の │ 近く に │ 住んで い ます 。
- 私 の │ 小学校 で は 、 │ １ クラス に │ 70 人 以上 も │ 生徒 が │ いた 。

> via `echo 山田は先生にほめられた |  mecab -d /usr/local/lib/mecab/dic/jumandic | jdepp 2> /dev/null | to_chunk.py`

Also we can use `◊Cf` module to explicitly link a sentence to a vocabulary item. But why practice vocab with a sentence? A sentence review tests much more than a piece of vocab: it deepens awareness of proper sentence format, of grammar and pragmatics. So cloze-delete particles, ok, what about conjugations?

- 山田 は │ 先生 に │ ほめ られた。
  - Yamada was praised by the teacher
  - Lemmas of final bunsetsu: 褒める | られる | た
- 昨日 から │ 急に │ 寒く なった。
  - It's suddenly been cold since yesterday. (Kamia, Adj.)
  - Lemmas of final bunsetsu: 寒い | 成る (なる) | た
- 雪 が │ 降り 始め ました
  - It began to snow (p60, Kamiya, Verb)
- 私 は │ 男 が │ 自転車 を │ 盗む の を │ 見 ました 。
  - I saw a man stealing a bicycle (p68, Kamiya, Verb)

I could cloze-delete the adjective/adverb/verb-headed bunsetsu, and give the English translation, and potentially a list of lemmas, and ask to fill in the entire agglutinated bunsetsu.

Ok, how does grading work? We could grade each sentence.

- ◊vocab べんごし: lawyer: 弁護士
  - ◊Ebisu1: 20180726.212000Z, 4.4,3.4,5.5. 5.5,6.6,7.7. 8.8,9.9,101.2
- ◊sent スミスさんはABCフウズの弁護士です。
  - ◊Ebisu1: 20180726.212000Z, 4.4,3.4,5.5. 5.5,6.6,7.7. 8.8,9.9,101.2
  - ◊Cf: 弁護士
- ◊sent こちらはのぞみデパートのたかはしさんです。
  - ◊Ebisu1: 20180726.212000Z, 4.4,3.4,5.51
- ◊vocab かいしゃ: office: 会社
- ◊vocab しごと: work: 仕事
- ◊vocab じ: o'clock: 時
- ◊vocab から: from (time, place, etc.)
- ◊vocab まで: until (time), to (place)
- ◊sent 仕事は9時から5時までです。
  - ◊Cf: 仕事, 時/じ, から, まで
- ◊sent この中で誰が猫の首に鈴を付けに行くんだい？
  - ◊Cloze: で,が,の,に,を
- ◊sent あの壁にかかっている絵はきれいですね。
  - ◊Cloze: ◊particles
  - ◊Cloze: ◊conjugations

## Miura, Kawashima books
- ◊vocab ちゅうがっこう: primary school: 小学校
- ◊vocab ~にん: ~people: ~人
- ◊vocab いじょう: more than: 以上
- ◊vocab せいと: student: 生徒

Miura, p86:
- ◊sent 私の小学校では、１クラスに70人以上も生徒がいた。
  - ◊Cf: 小学校, ~人, 以上, 生徒

Kawashima, DoJP, p19:
- ◊sent この中で誰が猫の首に鈴を付けに行くんだい？

Kawashima, p120
- ◊sent 私たちは東京駅の近くに住んでいます。

Kawashima, p121
- ◊sent あの壁にかかっている絵はきれいですね。

Kawashima, p120
- ◊sent 見てごらん、この池にコイがたくさんいるよ。


