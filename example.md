# Japanese vocabulary

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

- 手紙を書かない
  - Kamiya: negative base (a)
  - irrealis +( conclusive)
- 詩を書きます
  - Kamiya: conjunctive base (i)
  - continuative (+ conclusive)
- 詩を書き、詩を読む
  - Kamiya: conjunctive base (i)
  - continuative
- 詩を書く
  - Kamiya: dictionary base (u)
  - conclusive
- 手紙を書けば
  - Kamiya: conditional/imperative (e)
  - conditional (+ null)
- 手紙を書け！
  - Kamiya: conditional/imperative (e)
  - imperative
- 手紙を書こう
  - Kamiya: volitional (u)
  - volitional_tentative
- 書いて
  - Kamiya: te
  - continuative + null
- 書いた
  - Kamiya: ta (past)
  - continuative (+ conclusive)
- 書いたら
  - Kamiya: tara (conditional)
  - continuative (+ conditional)
- 書いたり
  - Kamiya: tari
  - continuative (+ null)



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


## Days and weeks and such
- きょう: today: 今日
  - ◊Ebisu1: 20180726.210900Z, 3.3,4.4,5.5. 5.3,4.3,3.5. 3.3,4.4,5.5
- きのう: yesterday: 昨日
  - ◊Ebisu1: 20180726.210900Z, 3.3,4.4,5.5. 5.3,4.3,3.5. 3.3,4.4,5.5
- あした: tomorrow: 明日
  - ◊Ebisu1: 20180726.210900Z, 3.3,4.4,5.5. 5.3,4.3,3.5. 3.3,4.4,5.5
- おととい: day before yesterday: 一昨日
  - ◊Ebisu1: 20180726.210900Z, 3.3,4.4,5.5. 5.3,4.3,3.5. 3.3,4.4,5.5
- あさって: day after tomorrow: 明後日
  - ◊Ebisu1: 20180726.210900Z, 3.3,4.4,5.5. 5.3,4.3,3.5. 3.3,4.4,5.5
- けさ: this morning: 今朝
  - ◊Ebisu1: 20180726.210900Z, 3.3,4.4,5.5. 5.3,4.3,3.5. 3.3,4.4,5.5
- よる: night: 夜
  - ◊Ebisu1: 20180726.210900Z, 3.3,4.4,5.5. 5.3,4.3,3.5. 3.3,4.4,5.5
- ゆうべ: last night: 昨夜
  - ◊Ebisu1: 20180726.210900Z, 3.3,4.4,5.5. 5.3,4.3,3.5. 3.3,4.4,5.5

- [休日]{きゅうじつ}/holiday
- [週末]{しゅうまつ}/weekend
- [平日]{へいじつ}/weekday

### Days of the week
- [日曜日]{にちようび}/Sunday
- [月曜日]{げつようび}/Monday
- [火曜日]{かようび}/Tuesday
- [水曜日]{すいようび}/Wednesday
- [木曜日]{もくようび}/Thursday
- [金曜日]{きんようび}/Friday
- [土曜日]{どようび}/Saturday

### Week
- [先週]{せんしゅう}/last week
- [今週]{こんしゅう}/this week
- [来週]{らいしゅう}/next week
- [先々週]{せんせんしゅう}/week before last
- [再来週]{さらいしゅう}/week after next

### Month
- [先月]{せんげつ}/last month
- [今月]{こんげつ}/this month
- [来月]{らいげつ}/next month
- [先々月]{せんせんげつ}/month before last
- [再来月]{さらいげつ}/month after next

## Months of the Year
- [一月]{いちがつ}/January
- [４月]{しがつ}/April
- [七月]{しちがつ}/July
- [九月]{くがつ}/September

## Year
- [去年]{きょねん}/last year
- Review #一昨年 [一昨年]{おととし}/the year before last
- Review #今年 [今年]{ことし}/this year
- Review #来年 [来年]{らいねん}/next year
- Review #再来年 [再来年]{さらいねん}/the year after next

## Seasons
- [冬]{ふゆ}/winter　
- [春]{はる}/spring
- [夏]{なつ}/summer
- [秋]{あき}/autmn

## Time use of Every 
- [毎〜]{まい}/every~
- [毎日]{まいにち}/every day
- [毎月]{まいつき}/every month
- [毎週]{まいしゅう}/every week
- [毎年]{まいとし}/every year

## Weather
- お[天気]{てんき}/weather

## Places
- [公園]{こうえん}/public park

## Adjectives
- いい/good

## Particles
- ね/agreement seeker

## Set Phrases
- [行]{い}ってきます/I'm leaving!
- [行]{い}ってらっしゃい/See you when you get home!
- ただ[今]{いま}/I'm home!
- お[帰]{かえ}りなさい/Welcome back!
- お[休]{やす}みなさい/Good night
- [済]{す}みません/I'm sorry
- [失礼]{しつれい}します/Excuse me. or I am about to do something rude 

## Anime/Dorama
- [喧]{やまか}しい/noisy
- [不]{ふ}[愉]{ゆ}[快]{かい}/unpleasant
- [意味]{いみ}[不明]{ふめい}/meaning unclear

## DuoLingo
- [出身]{しゅっしん}/person's origin
- Review: #曇り: [曇]{くも}り/cloudy

## Names
- [羽]{は}[鳥]{とり}[智]{ち}[世]{せ}/Ancient Magus' Bride

## Youtube songs
- [火]{か}[事]{じ}/something on fire
- [火]{hi}/fire, blaze
- [梯]{hashigo}子車{sha}/ladder firetruck
- [自]{ji}[動]{dou}[車]{sha}/automobile
