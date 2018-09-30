# Curtiz

Curtiz is an experimental flashcard application aimed at Japanese language learners that uses Markdown to both
- store flashcards, and
- store review scheduling information.

Here's how it works. You write a Markdown file. Curtiz recognizes special Markdown headings as flashcards that you want to learn about. You can tell Curtiz you want to `learn` new flashcards, or to `quiz` you on flashcards you already know. In either case, it modifies the Markdown file in-place.

> If you're not familiar with Markdown, you're in for a treat: this is the markup used to format documents on GitHub, Stack Overflow, etc. See GitHub's guide, [Mastering Markdown](https://guides.github.com/features/mastering-markdown/) for a quick introduction.

Curtiz can be pretty fancy with Japanese flashcards! Assuming your system has
1. [MeCab](https://taku910.github.io/mecab/), a morphological parser and part-of-speech tagger,
1. [MeCab-UniDic](https://osdn.net/projects/unidic/), a powerful dictionary for MeCab, and
1. [J.DepP](http://www.tkl.iis.u-tokyo.ac.jp/~ynaga/jdepp/) (a depedency parser and bunsetsu chunker that consumes the output of MeCab

installed, Curtiz can parse Japanese text and automatically create flashcards for all
- conjugated phrases (verbs and adjectives), and
- particles (は, が, の, で, etc.)!

As you might expect, it updates the Markdown file with this data.

Along with the Japanese text's reading (pronunciation), Curtiz will also track your memory of each conjugated phrase and particle as a flashcard. So during quizzes, Curtiz might show you the sentence's translation and ask you to fill-in-the-blank with a conjugated phrase or a particle.

**N.B.** You don't need MeCab and J.DepP: you can explicitly tell Curtiz about the subtext that *you* want it to track, and in fact, they can be entirely arbitrary, only semantically-related sub-flashcards.

## Installation

Install [Git](https://git-scm.com/) and [Node.js](https://nodejs.org/). Then run the following set of commands in your command-line prompt  (i.e., Terminal in macOS, xterm in Linux, Command Prompt in Windows, etc.), noting that the `$` symbol just indicates the start of the prompt and is not intended to be typed.
```
$ git clone https://github.com/fasiha/curtiz.git
$ cd curtiz
$ npm install
$ npm run build
```
You are asking `git` to clone this repository from GitHub to your computer, then `cd` to enter the newly-cloned directory, then `npm` (Node.js Package Manager that was installed alongside Node.js) to `install` dependencies and compile (`build`) my TypeScript source code to JavaScript (which Node.js can run).

If you want automatic reading generation and automatic conjugations/particles detection, you need to install MeCab, UniDic, and J.DepP. **N.B. You can use Curtiz quite well without these tools.** Please feel free to [write](https://fasiha.github.io/#contact) to me or [open an issue](https://github.com/fasiha/curtiz/issues) if the following sketch is insufficient.

(1) and (2): On macOS, I install the MeCab and UniDic via `brew install mecab mecab-unidic` with the always-superb [Homebrew](https://brew.sh/).

Finally, (3): [J.DepP](http://www.tkl.iis.u-tokyo.ac.jp/~ynaga/jdepp/#dl) has to be compiled and installed manually. On macOS or Unix:
```
$ curl -O http://www.tkl.iis.u-tokyo.ac.jp/~ynaga/jdepp/jdepp-latest.tar.gz
$ tar zf jdepp-latest.tar.gz
$ cd jdepp-YYYY-MM-DD---UPDATE-THIS
$ ./configure --with-mecab-dict=UNI
$ make model
$ make install
```
(`curl` just downloads the file; make sure you change the directory name when you `cd`; your system may need `sudo make install` on the last line. Note the J.DepP build step requires Python 2: if you use Python 3, consider the fantastic [pyenv](https://github.com/pyenv/pyenv#readme), which lets me specify per-directory Python versions.)

This will download corpora from the internet and build the J.DepP source code.

I am also preparing a Docker container with these dependencies, as well as Emscripten versions of these C++ applications so they can be `npm install`ed. As mentioned, feel free to [write](https://fasiha.github.io/#contact) to me or [open an issue](https://github.com/fasiha/curtiz/issues) for help with any of the above.

## Usage
This [`README.md`](README.md) that you're currently reading is a Curtiz-friendly Markdown file that you can use immediately. Try running the following:
```
$ node curtiz.js learn README.md
```
Curtiz should invite you to learn the following bit of Japanese vocabulary:

#### ◊sent かいしゃ :: office :: 会社

That is, Curtiz will look through this Markdown file for a header block—a line starting with one or more `#`s—containing
- the `◊` symbol,
- the `sent` keyword,
- a reading (likely in hiragana, though you can make it whatever you want),
- a translation, and
- a written form (all the kanji you want).

> ◊ is a lozenge. On macOS US English keyboard, it is `option-shift-v`; on other operating systems and phones, I set up an auto-converter that translates something like "loz" to ◊. I use this symbol with much admiration for [Pollen](https://docs.racket-lang.org/pollen/pollen-command-syntax.html#%28part._the-lozenge%29).

After you finish learning a sentence, Curtiz lets you specify a multiplier to scale its initial guess about this fact's half-life in your memory, which is 15 minutes. If you learn a hard sentence that you're not confident about, feel free to enter "0.5" or something less than 1 (the default). If you're confident you will remember the sentence, feel fre to enter a number bigger than 1. Entering "10" for example will set the sentence's memory half-life to 2.5 hours: fifteen minutes times ten. This is a fancy feature of [Ebisu](https://fasiha.github.io/ebisu/)!

If you actually ran the command above, you might notice that Curtiz has modified your copy of this README.md. It has added a Markdown bullet under the header above, something like `- ◊Ebisu1 `, followed by a date and several numbers. [Ebisu](https://fasiha.github.io/ebisu/) is the statistical scheduler that Curtiz uses to know what flashcards to review and when; the numbers are Ebisu "models" that track your memory of this flashcard (the reading, translation, and kanji are all separate "flashcards").

> If you don't yet know hiragana, head on over to [Naurvir's Memrise Hiragana course](https://www.memrise.com/course/43833/hiragana-2/) and you'll have it in a couple of days. Seriously, don't delay: Memrise's emphasis on visual mnemonics make it child's play to memorize the hiragana and [katakana](https://www.memrise.com/course/43875/katakana-2/). (Though, it's better to learn the katakana *from* the hiragana, instead of learning both from English or your native language. Try to find a course that teaches katakana from the hiragana.)

You can ask Curtiz to `quiz` you on what you just learned by running the following:
```
$ node curtiz.js quiz README.md
```
If you hit Control-C, Curtiz will exit without doing anything, but otherwise, it will update the Ebisu numbers based on whether or not you successfully typed in "かいしゃ" (or "カイシャ", i.e., the same thing but in katakana, Curtiz will always convert katakana input to hiragana) as the reading for "会社".

(Note it doesn't show you the translation in the quiz. Let me know if you really want the translation.)

## Advanced usage: cloze-deletion `◊cloze` and normal flashcards `◊related`

Ebisu can also help you learn and practice longer sentences. Here's an example that shows you all the things you can do.

#### ◊sent やまだはにんじゃにほめられた :: Yamada was praised by the ninja. :: 山田はにんじゃにほめられた。
- ◊related ほめる :: to praise :: 褒める
- ◊related やまだ :: (proper name) :: 山田
- ◊cloze は
- ◊cloze ゃ[に]ほ
- ◊cloze ほめられた // 褒められた

If a Curtiz header is followed immediately by a list of lozenge keywords, as above, Curtiz will understand that you want to tell it more about this sentence, and will have more ways to quiz your knowledge. The two extra kinds of information are:
- **related** words, via `◊related`, following the same format of (1) reading, (2) translation, (3) an *optional* written form. I use these to practice kanji→reading (or translation→reading, in the absence of a written form) of words that are related to the sentence, which is close to "normal" flashcards, in that I practice a single word.
- **Fill-in-the-blanks** via `◊cloze`, followed by the text belonging the blank, I use with *particles* and *conjugated phrases* (verbs and adjectives). Curtiz will also give you the sentence's translation, because that usually contains crucial information for particles and conjugations.

If there is ambiguity about which part of the sentence represents the cloze (which is the fancy word for [fill-in-the-blank](https://en.wikipedia.org/wiki/Cloze_test)), you can provide some context, as in the penultimate line above: `◊cloze ゃ[に]ほ` means "the particle is に, specifically the に in the sentence flanked by ゃ and ほ, and not the に in にんじゃ". Curtiz will warn you if these clozed phrases are ambiguous, so don't worry.

Furthermore, note that you can specify more than one correct answer for a given cloze: for a quiz of the last line above, Curtiz will accept "ほめられた", *or* its katakana version, *or* "褒められた", with kanji, in case that's easier to produce with keyboard IMEs.

So if you run `node curtiz.js learn README.md` again, Curtiz will invite you to learn the above sentence.

When you ask Curtiz to quiz you, via `node curtiz.js quiz README.md`, it will ask you about the "office" vocabulary you learned first. After answering this and rerunning the same command, it will ask you for one of the following:
- the full reading of the sentence,
- the reading of one of the `◊related` words, "褒める" or "山田", or
- the conjugated phrase "められた" or one of the particles ("は" or "に") via fill-in-the-blanks.

As far as command-line tools go, Curtiz won't win any awards, but I have sought to make it ergonomic and helpful.

Also note that you can learn a sentence, and then add `◊related` or `◊cloze` sub-facts to it. The next time the sentence flashcard is up for review, Curtiz will ask you to learn these new sub-facts (and of course you can provide a multiplier for the new sub-facts' half-lives).

## Automatic reading and cloze generation with Japanese parsers

If you have MeCab and J.DepP installed, you can leave out the reading, and Curtiz will fill it in for you. So for example, if you had the following:

#### ◊sent :: Snow began falling. :: 雪が降り始めました。

Note how there is *no* reading before the first `::`, and *no* sub-bullets.

After you the first `quiz` or `learn` **or** after `node curtiz.js parse README.md`, you'll see that
1. the reading 「ゆきがふりはじめました」has been automatically added to the header, and
2. the following bullets added under the header:
  - ◊related?? ゆき :: ? :: 雪
  - ◊related?? ふる :: ? :: 降る
  - ◊related?? はじめる :: ? :: 始める
  - ◊cloze が
- ◊cloze 降り始めました // ふりはじめました

Curtiz has analyzed the sentence and found vocabulary using kanji as `◊related??` tags. N.B., the `??` prevents this from being parsed as a true `◊related` flashcard! If you'd like Curtiz to quiz you on these related cards, going from kanji to reading, remove the `??` to make these `◊related` flashcards.

Curtiz has also added particles and conjugated verbal phrases as `◊cloze` flashcards, which will be quizzed via fill-in-the-blanks. (For clozes with kanji, it has added the reading (it's best guess, at least) as a valid answer to the cloze.)

I recommend checking these because these automatic tools can make mistakes. Don't worry, it won't overwrite any clozes that you've already learned.

And if Curtiz does eat your homework, it always saves a backup, with the `.bak` extension.

Another way to get Curtiz to parse the sentence (besides leaving out the reading) is to add an extra bullet under the header containing `◊pleaseParse`:

#### ◊sent めをあける :: to open eyes :: 目を開ける
- ◊pleaseParse

After Curtiz processes this file, the above will have the following bullets under it:
- ◊related?? め :: ? :: 目
- ◊related?? あける :: ? :: 開ける
- ◊cloze particle を

## Name
The name comes from Arakawa Hiromi's legendary manga, *Fullmetal Alchemist*, where Curtis Izumi is the powerful alchemist who took in the Elric brothers and taught them alchemy. The artist, Arakawa-sensei, has said that this memorable scene featuring Curtis is her favorite scene in the manga!:

![Curtis Izumi, from Fullmetal Alchemist manga, by Hiromi Arakawa. "I am a housewife!"](izumi.jpg)
