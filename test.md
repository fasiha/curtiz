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

- ◊sent 山田は先生にほめられた。
  - ◊Ebisu1 2018-07-26T21:20:00.000Z; 4.4,3.4,5.5
- ◊sent 昨日から急に寒くなった。
- ◊sent 雪が降り始めました
- ◊sent 私は男が自転車を盗むのを見ました。

I could cloze-delete the adjective/adverb/verb-headed bunsetsu, and give the English translation, and potentially a list of lemmas, and ask to fill in the entire agglutinated bunsetsu.

Ok, how does grading work? We could grade each sentence. And we should, but we should have a separte section at the bottom of the file for
- particles, extracted via a combination of MeCab and Jdepp and JMdict: omitting `supplementary_symbol-period` and `particle-phrase_final` morphemes and picking the remaining `particle`s at the tail-edge of bunsetsu should give mostly "real" particles
  - JMdict needed to screen things like this?: 急/に split by MeCab-UniDic.
    - `に	ニ	ダ	だ	auxiliary_verb	auxiliary-da	continuative-change_ni`
  - ignore `particle-conjunctive`s which are (so far) て/で in conjugated phrases:
    - 住んでいます -> particle-conjunctive
    - 見て -> particle-conjunctive
  - ignore `particle-adverbial` too, these are in conjugated phrases
    - "たり" in 良かったり
- verb/adjectival/adverbial phrases' individual morphemes.
  - Tricky to separate "よさが" e.g., nominalized adjective plus regular particle が, one bunsetsu…
  - JMdict has よさ/良さ.

- ◊vocab べんごし: lawyer: 弁護士
  - ◊Ebisu1 2018-07-26T21:20:00.000Z; 4.4,3.4,5.5; 5.5,6.6,7.7; 8.8,9.9,101.2
- ◊sent スミスさんはABCフウズの弁護士です。
  - ◊Ebisu1 2018-07-26T21:20:00.000Z; 4.4,3.4,5.5
  - ◊Cf: 弁護士
- ◊sent こちらはのぞみデパートのたかはしさんです。
  - ◊Ebisu1 2018-07-26T21:20:00.000Z; 4.4,3.4,5.5
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
- ◊sent 見てごらん、この池にコイがたくさんいるよ。



Adjectivals:
- ◊sent 景色が良くてたくさん写真をとった。
- ◊sent あのレストランは良かったり悪かったりする。
- ◊sent この絵のよさがわからない。
- ◊sent これはそれよりもっと複雑な問題です。
- ◊sent この仕事は難しいけれども面白いです。
- ◊sent 本田さんはゴルフが好きなだけだ。上手じゃない。
- ◊sent あの店のパンは古いことがある。

So when I see a particle morpheme, am I going to cloze-delete just it (treating it as a "real" particle) or am I going to treat it as part of the adjectival/verbal phrase (bunsetsu) it's in and cloze-delete the whole bunsetsu? And when there's no particles in a bunsetsu, how can I identify adjectival/verbal conjugated phrases?
- If bunsetsu starts with morpheme whose part-of-speech starts with "verb" or "adjective", it's a conjugated phrase.
- All other morpheme particles found outside those bunsetsu, treat as particles to cloze.
- Problems:
  - よ さ が: starts with "adjective" but the final particle isn't part of the conjugation
  - 難しい けれど も: starts "adjective" but last two particles are really one particle
  - 古い こと が ある: ditto.
- You know. As long as the particle is getting reviewed. Because each particle and morpheme in a conjugated-verb/adjective bunsetsu will have its own Ebisu track.

Ok! `validateMarkdown.ts` is in: it's an idempotent function that'll consume a Markdown file, update any quiz blocks (bullets starting with `- ◊` + a relevant identifier) with MeCab and Jdepp outputs, and append the file with any particle (morphemes) or conjugated phrases (bunsetsu) that can be quizzed.

I'll start on a `quiz.ts` that'll consume a Markdown file processed with `validateMarkdown.ts`, execute quizzes, and update the Markdown file with the quizzed blocks' new Ebisu record (note that if a particle is quizzed by cloze-deleting all the particles in a sentence, several quiz blocks might have updated Ebisu records).
