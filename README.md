# Curtiz

Curtiz is an experimental flashcard application aimed at Japanese language learners that uses Markdown to both
- store flashcards, and
- store review scheduling information.

Here's how it works. You write a Markdown file (see GitHub's guide, [Mastering Markdown](https://guides.github.com/features/mastering-markdown/) for a quick introduction). Curtiz recognizes Markdown headings conforming to a special syntax as flashcards you want to learn about. You can tell Curtiz you want to `learn` new flashcards, or to `quiz` you on flashcards you already know.

There are two kinds of flashcards that Curtiz currently knows about:
- vocabulary, i.e., a reading (or pronunciation) in kana, a translation, and optionally, kanji, and
- sentences, with optional translation.

Sentences are pretty fancy! Assuming your system has [MeCab](https://taku910.github.io/mecab/) (a morphological parser and part-of-speech tagger), [MeCab-UniDic](https://osdn.net/projects/unidic/) (a powerful dictionary for MeCab), and [J.DepP](http://www.tkl.iis.u-tokyo.ac.jp/~ynaga/jdepp/) (a depedency parser and bunsetsu chunker that consumes the output of MeCab) installed, Curtiz will parse sentences and make a list of
- conjugated phrases (verbs and adjectives), and
- particles (は, が, の, で, etc.),

and modify your Markdown file to contain all this extra information. Curtiz will track your memory of each conjugated phrase and particles as a flashcard, just like vocabulary. If Curtiz decides to quiz you on a sentence, it'll either ask you to type in either
1. all conjugated phrases, or
1. all (sensible) particles.

**N.B.** You just need MeCab and J.DepP once, to parse sentences. If Curtiz detects that your Markdown file already contains all the grammar details, it will not attempt to call either of these tools.

## Installation

Install [Git](https://git-scm.com/) and [Node.js](https://nodejs.org/). Then run the following set of commands in your command-line prompt  (i.e., Terminal in macOS, xterm in Linux, Command Prompt in Windows, etc.), noting that the `$` symbol just indicates the start of the prompt and is not intended to be typed.
```
$ git clone https://github.com/fasiha/curtiz.git
$ cd curtiz
$ npm install
$ npm run build
```
You are asking `git` to clone this repository from GitHub to your computer, then `cd` to enter the newly-cloned directory, then `npm` (Node.js Package Manager that was installed alongside Node.js) to `install` dependencies and compile (`build`) my TypeScript source code to JavaScript (which Node.js can run).

Next you need to install MeCab, UniDic, and J.DepP. Write to me if you need help with this—they are easy to install on macOS (`brew install mecab mecab-unidic`, but then J.DepP has to be compiled and installed manually). I am also preparing a Docker container with these dependencies.

## Usage
This [`README.md`](README.md) that you're currently reading is a Curtiz-friendly Markdown file that you can use immediately. Try running the following:
```
$ node curtiz.js learn README.md
```
Curtiz should invite you to learn the following bit of Japanese vocabulary:

#### ◊vocab かいしゃ: office: 会社

So. Curtiz looked through this Markdown file for a header block—a line starting with one or more `#`s—followed by a `◊` symbol (a lozenge, with much admiration towards [Pollen](https://docs.racket-lang.org/pollen/pollen-command-syntax.html#%28part._the-lozenge%29)) and the `vocab` keyword. Curtiz expects this to be followed by
1. some text indicating pronunciation (probably some hiragana or katakana, though you can put whatever you want)
2. a translation that it can use to prompt you for this pronunciation, and
3. optionally some kanji (which it will also show you when asking you for the pronunciation).

If you actually ran the command above, you might notice that Curtiz has modified your copy of this README.md. It has added a Markdown bullet under the header above, something like `- ◊Ebisu1 `, followed by a date and several numbers. [Ebisu](https://fasiha.github.io/ebisu/) is the statistical scheduler that Curtiz uses to know what flashcards to review and when; the numbers are Ebisu "models" that track your memory of this flashcard (the reading, translation, and kanji are all separate "flashcards").

> (If you don't yet know hiragana, head on over to [Naurvir's Memrise Hiragana course](https://www.memrise.com/course/43833/hiragana-2/) and you'll have it in a couple of days. Seriously, don't delay: Memrise's emphasis on visual mnemonics make it child's play to memorize the hiragana and [katakana](https://www.memrise.com/course/43875/katakana-2/).)

> (Though I plan to add functionality for Curtiz to quiz you on kanji handwriting, it doesn't currently ask for anything other than the reading (pronunciation), not even the kanji or translation as multiple-choice, because picking out the correct kanji from a list is basically the same as practicing kanji-to-reading.)

You can ask Curtiz to `quiz` you on what you just learned by running the following:
```
$ node curtiz.js quiz README.md
```
If you hit Control-C, Curtiz will exit without doing anything, but otherwise, it will update the Ebisu numbers based on whether or not you successfully typed in "かいしゃ" as the reading for "office/会社".

You may also have noticed that Ebisu added several lines to the following region of the file. Let's talk about sentences.

### Sentences
Assuming you have the requisite Japanese linguistic parsers and you have run one of the Curtiz commands above, you will see the following list of bullets *underneath* the following section block:
- ◊morpheme 山田	ヤマダ	ヤマダ	ヤマダ	noun-proper-name-surname		
- ◊morpheme は	ワ	ハ	は	particle-binding		
- ◊morpheme 先生	センセー	センセイ	先生	noun-common-general		
- ◊morpheme に	ニ	ニ	に	particle-case		
- ◊morpheme ほめ	ホメ	ホメル	褒める	verb-general	shimoichidan_verb_e_row-ma_column	irrealis-general
- ◊morpheme られ	ラレ	ラレル	られる	auxiliary_verb	auxiliary-reru	continuative-general
- ◊morpheme た	タ	タ	た	auxiliary_verb	auxiliary-ta	conclusive-general
- ◊morpheme 。			。	supplementary_symbol-period		
- ◊bunsetsu 山田は :: 先生に :: ほめられた。
- ◊particle は
- ◊particle に
- ◊conjugated ほめられた。

#### ◊sent 山田は先生にほめられた。 :: Yamada was praised by the teacher.

Note how `◊sent` is the Curtiz keyword indicating sentence, and how it added extra information on bullets under the header, prefacing each bullet with a lozenge plus a keyword it understands. This is a core "feature" of Curtiz: rather than an external database, your human-editable Markdown file is its only database. (I do plan on integrating it with Git, to track reviews, but that is not necessary for learning and quizzing. Markdown + Curtiz is all you need.)

So if you run `node curtiz.js learn README.md` again, Curtiz will invite you to learn the above sentence. Specifically you have to memorize
1. the way the two particles, は and に are being used, as well as
2. the conjugation of the verb, "ほめられた".

When you ask Curtiz to quiz you, via `node curtiz.js quiz README.md`, it will likely ask you about the "office" vocabulary you learned above, but if you rerun the quiz command, it will ask you to reproduce either the particles or the conjugations in the sentence, via fill-in-the-blanks.

As far as command-line tools go, Curtiz won't win any awards, but I have sought to make it ergonomic to fill in blanks, out of order if you prefer, etc.

## Name
The name comes from Arakawa Hiromi's legendary manga, *Fullmetal Alchemist*, where Curtis Izumi is the powerful alchemist who took in the Elric brothers and taught them alchemy. The artist has said that this is her favorite scene:

![Curtis Izumi, from Fullmetal Alchemist manga, by Hiromi Arakawa. "I am a housewife!"](izumi.jpg)
