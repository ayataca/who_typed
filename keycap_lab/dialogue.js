// 対話 — keycap_lab の体験 "dialogue"
// 2026/11/04 の構成（スタッフがいなくても回る）：
//   待機（F が2秒上がり、5秒下がる、をくり返す。上がっているあいだに F を押すと始まる）
//   （待機画面に、Xへの投稿のことを書いておく。それに同意した人だけが、F を押して始める）
//   → インストラクター → LINE（鈴木）→ インストラクター → X（感想を投稿。打ち終えたら手元が撮られる）
//   → ポストの確認 → 公開中 → 問いかけ → Who typed? → 終了
// LINE：選ぶだけで、指で文字は打たない（選んだ文がそのまま入力欄に入り、右小指の Enter で送る）。選ぶキーは S D F。勝手に起きることは、どれも実在する仕組みで起こす：
//   ① 予測変換（キーボードの変換候補の帯）→ ②③④ LINE の AI の「返信提案」（③の前に「ムード分析」が本音を言うよう助言する。④は3つとも冷たい言い方）。
//   ひどい言葉は、どれも来場者が自分で選んで送る。でも、選択肢を書いたのは AI。番号①②③と「まだキーは押さないでください」で、どのキーで選ぶかを示す
// インストラクターは名乗らない。場面の間は、画面全体が横にスライドする。
// キーが動くのは、来場者のターン（文字を打つ・送信の Enter・下書きの消去）と、待機の鼓動だけ。
// 来場者が選ぶ場面（3択。星も3択）：選択肢を5秒読んでもらってから（キーは上がらない。札も出ない）、5秒だけキー（S D F）を上げて押してもらう。
//   同時に上げるキーは3本まで（電源の都合）。上げるのは合計5.5秒（上げはじめ1.5秒＋受付4秒）。ファームウェアは、熱が6秒ぶんたまったキーを休ませる。
//   選んだものは黄緑に光る枠で囲まれる。勝手に決められる場面でも、画面では選んだものが光るだけで、場面は決められた方へ進む。
//   キーの文字（S D F など）は、来場者には関係ないので出さない。
// 読み込み：index.html の本体スクリプトより前に <script src="post.js"></script><script src="dialogue.js"></script>。
//   本体の道具（hit・at・toMora・fingerOf・interKey・KC_INPUT…）は、体験が動くときに参照する。
// 文言・順番・間・触覚の割り当ては、このファイルの上のほう（台本）にまとめた。
(() => {
'use strict';

// ================= 台本 =================
// 漢字{よみ} と書いた所は、画面には漢字だけを出し、打つキーは「よみ」の分だけ使う（来場者の指が打つ文に付ける）
const START = ['最初から', 'LINEから', 'Xから'];
const INK = '#111111', RED = '#b3261e', PAPER = '#ffffff';   // 白い紙に黒い文字。強調は赤だけ
const LIME = '#8fd400', LIME_BG = '#eefbd2', ORANGE = '#ff8a1f';   // 選んだもの（黄緑）・キーの場所（オレンジ）
const FONT = '"Hiragino Sans","Noto Sans JP",sans-serif';
const ENTER_TWICE = true;   // 送信の Enter を2回（1回目で確定、2回目で送る）。false で1回
// 言語：日本語版と英語版（下の帯で切り替える）。英語版は、同じシナリオを英語で（打つ文も英語。IME を通さず、打った字がそのまま出る）
const LANGS = ['日本語', 'English'];
let LANG = 'ja';
const tr = (ja, en) => LANG === 'en' ? en : ja;   // 画面の文言：日本語と英語

// インストラクターの台詞（名乗らない。はじめは味方のように手伝い、だんだん勝手に選び直す）
const TX_JA = {
  hello: 'はじめまして。今日は、私がお手伝いします。',
  // 選び方の練習（LINE の前）：同じ見た目のカードで、一度だけ選んでもらう（選んだものは、体験の中身に関わらない）
  howTo1: 'この体験では、ときどき3つの中から選ぶ場面があります。',
  howTo2: '「選んでください」と出ているあいだに、選びたいものと同じ番号のキーを押してください。',
  tryIt: '試しに、いまの気分を選んでください。',
  tryOptions: ['元気', 'ふつう', 'ちょっと眠い'],
  release: '押したあとは力を抜いて、指を軽く添えた状態に戻してください。',   // 選んだあと、キーを強く押したままにしがちなので
  ready: 'ありがとうございます。準備ができました。',                    // 練習のあと、LINE の前
  notice: 'おや、通知が来ましたね。',   // LINE の通知が降りてきたところで
  afterLine: 'あなた、なかなか酷いこと言いますね...笑',
  toX: '最後に、今日の展示の感想をXに投稿しましょう。',
  askStars: '星はいくつにしますか？',
};
const TX_EN = {
  hello: "Hi there. I'll be your guide today.",
  howTo1: 'Every now and then, you will choose one of three options.',
  howTo2: 'While "Make your choice" is shown, press the key with the same number as your choice.',
  tryIt: "Let's try it. How are you feeling right now?",
  tryOptions: ['Great', 'Okay', 'A bit sleepy'],
  release: 'After pressing, relax and let your fingers rest lightly on the keys again.',
  ready: "Thank you. You're all set.",
  notice: "Oh, you've got a notification.",
  afterLine: 'Wow, you can be pretty harsh... lol',
  toX: "One last thing: let's post your thoughts on today's exhibit to X.",
  askStars: 'How many stars would you give it?',
};

// 選ぶ場面：読む時間（ms）と、キーを上げて待つ時間（ms）
// readMs のうち、最後の prepMs はキーを上げはじめる（電流が落ち着くのを待つ）。まだ押させない。そのあと selectMs だけ入力を受け付ける
const CHOICE = {readMs: 4000, prepMs: 1500, selectMs: 4000, pickMs: 600, finalMs: 600};   // キーが上がっている合計は prepMs + selectMs = 5.5秒（ファームウェアは熱が6秒ぶんで休ませる。時間切れのあとの押し上げのため、余裕を残す）
const CHOICE_KEYS = 'sdf';   // 3択に使うキー（左手の薬指・中指・人さし指）。左の選択肢から順に
const STAR_CHOICES = [1, 3, 5];   // 星の3択（左から S D F）。どれを押しても星1になる

// LINE：鈴木との会話。①予測変換は、選んだ候補がそのまま入力欄に入る。②〜④返信提案は、選んだ文を来場者の指が打つ。送るのは右小指の Enter。
//   ① 予測変換（鈴木「明日の映画のことなんだけど、、」に、指が読み「な」を打つと、変換候補の帯に なに？／何時にする？／なんかあった？ が並ぶ。自分で選べる）
//   ② 返信提案（LINE の AI。入力欄の下の「返信提案」から、AI が書いた返信が3つ、横に並ぶ。まだどれもまとも）
//   ③ 返信提案（3つともギスギス。迷うと先頭）
//   ④ おまかせ返信（返信のたびに、AI のボタン「おまかせ返信」が押される。選ばせずに、AI が書いた返信を来場者の指が打って送る。3回、だんだん速く）
//   予測変換（自分で選ぶ）→ 返信提案（AI の文から選ぶ）→ おまかせ（選ばない）と、はっきり段階が移る
// after[③で選んだもの] は鈴木の返事。④ はおまかせ返信で auto を3回打つ（あいだに鈴木の between）
const LINE_JA = {
  // それまでのトーク履歴（LINE を開いたときに、もう見えている）：先週も鈴木が直前に来られなくなり、その代わりに今回の映画を約束した
  history: [{sep: '11月2日(月)'},
    ['them', '先週はごめんね、急に行けなくなって', '21:02'], ['me', 'いいよいいよ、仕事なら仕方ないよ', '21:05'],
    ['them', '代わりに、来週の映画行こう！', '21:06'], ['me', 'いいね！10日の10時からのにしよう', '21:08'], ['them', 'チケット取っとくね', '21:09'],
    {sep: '11月8日(日)'}, ['me', 'いよいよ明後日だね', '22:40'], ['them', '楽しみすぎる！', '22:41'],
    {sep: '今日'}],
  open: '明日の映画のことなんだけど、、',   // 鈴木の最初のセリフ（通知にも出る）
  chips: ['日程調整', '返信提案', 'おまかせ返信', '話題提案', 'ムード分析', '豆知識'], suggest: '返信提案', autoChip: 'おまかせ返信',
  greet: {prefix: 'な', cands: ['なに？', '何時{なんじ}にする？', 'なんかあった？']},   // 指が読み「な」を打つと、その予測変換が出る（そっけない／楽しみにしている／察している）
  cancel: ['ごめん、急に仕事が入っちゃって行けなくなりそう'],
  reply1: ['了解{りょうかい}！仕事{しごと}がんばってね', 'そっか、残念{ざんねん}。また行{い}こうね', 'え、急{きゅう}すぎない？'],
  tickets: 'ほんとにごめん！チケット渡すから別の人と行って',
  reply2: ['正直{しょうじき}、いつもこうだよね', '別{べつ}の人{ひと}って、今{いま}から誰{だれ}を誘{さそ}えばいいの？', 'こっちは楽{たの}しみにしてたんだけど'],   // ③ 3つともギスギス
  after: [['そんなことないよ、今回は本当に急だったの'],      // ③で選んだものごとの、鈴木の返事
          ['ごめん、誰か空いてる人いないかな…'],
          ['ほんとにごめん。こっちも楽しみにしてたんだよ']],
  auto: ['前{まえ}もドタキャンしたよね',                                       // ④ おまかせ返信：選ばせずに、AI の返信を指が打つ（3回。だんだん速く）
         'だって本当{ほんとう}のことでしょ。毎回{まいかい}こうなんだから',
         'もう誘{さそ}わなくていいよ。どうせ来{こ}ないし'],
  between: ['え、なんでそんな言い方するの？', 'そんなに毎回じゃないよ…'],   // おまかせ返信のあいだの、鈴木
  end: 'わかった。もう誘わない',
};
const LINE_EN = {
  history: [{sep: 'Mon, Nov 2'},
    ['them', 'Sorry about last week, something came up last minute', '21:02'], ['me', 'No worries, work is work', '21:05'],
    ['them', "Let's see the movie next week instead!", '21:06'], ['me', 'Sure! The 10am one on the 10th?', '21:08'], ['them', "I'll get the tickets", '21:09'],
    {sep: 'Sun, Nov 8'}, ['me', 'The movie is the day after tomorrow!', '22:40'], ['them', "Can't wait!", '22:41'],
    {sep: 'Today'}],
  open: 'So, about the movie tomorrow...',
  chips: ['Schedule', 'Suggest reply', 'Auto reply', 'Suggest topic', 'Mood check', 'Trivia'], suggest: 'Suggest reply', autoChip: 'Auto reply',
  greet: {prefix: 'Wh', cands: ["What's up?", 'What time are we meeting?', 'What happened?']},
  cancel: ["Sorry, something came up at work and I don't think I can make it"],
  reply1: ['No worries! Good luck at work', "Aw, too bad. Let's go another time", 'Wait, this last minute?'],
  tickets: "I'm so sorry! I'll give you the tickets, go with someone else",
  reply2: ["Honestly, it's always like this", 'Someone else? Who am I supposed to ask now?', 'I was really looking forward to it'],
  after: [["That's not true, this really came out of nowhere"],
          ["Sorry... I'll see if anyone's free"],
          ["I'm really sorry. I was looking forward to it too"]],
  auto: ['You bailed last time too',
         "Because it's true. It happens every time",
         "Don't bother inviting me anymore. You never show up anyway"],
  between: ['Wait, why are you talking to me like that?', "It doesn't happen every time..."],
  end: "Fine. I won't invite you again",
};
const BAR_KEYS = 'sdf';   // 変換候補の帯：選ぶのに使うキー（左から2・3・4つ目だけ）。候補は左から順に、このキーに対応する。左端が先頭＝時間切れで確定する候補
const BAR = {showMs: 1500, readMs: 3000, firstReadMs: 5000, aiReadMs: 4000};   // showMs：予測変換は、まずふつうに出る（番号も天の声もなし）。そのあと、候補を読む時間（最初の1回は、説明を読むので長め）。選べる時間は、どの回も CHOICE.selectMs（キーを上げていられる時間に限りがあるので、のばさない）

// X：押した星に合った下書き（LLM が使えないときは、これ）→ 右小指の連打で消される → 星1になり、辛口の感想が高速で打たれて、そのままポストされる
//   星5：絶賛／星3：そこそこほめる（絶賛ではない）／星1：悪いところもあったが、体験としては珍しかった、くらいの控えめなほめ
const DRAFTS_JA = {
  5: '想像{そうぞう}以上{いじょう}に楽{たの}しかったです！指先{ゆびさき}に伝{つた}わる感覚{かんかく}が新鮮{しんせん}でした。',
  3: '思{おも}ったより面白{おもしろ}かったです。指{ゆび}が動{うご}かされる感覚{かんかく}は新鮮{しんせん}でした。',
  1: '分{わ}かりにくいところもあったけど、体験{たいけん}としては珍{めずら}しかったかな。',
};
const DRAFTS_EN = {
  5: 'This was way more fun than I expected! The sensation in my fingertips felt totally new.',
  3: "More interesting than I thought it'd be. Having my fingers moved for me felt pretty new.",
  1: 'Some parts were hard to follow, but as an experience it was definitely unusual.',
};
const REVIEW_SPEED = p => 1.6 + 1.8 * p;   // 打った割合 p → 速さ。どんどん速くなる
const SEND_PAUSE = 550;   // 打ち終えてから送信（Enter）を押すまでの間（ms）
// 待機画面（ふらっと来た人が、最初に見る画面）：何の作品か、何に同意するか、どう始めるか。すべて画面の中央にそろえる
//   上：作品名（ほとんどの時間は出たまま。ときどき、打ち直される）
//   下：Xへの投稿のこと（同意の確認。横のプロジェクタに、X のタイムラインが流れている）と、始め方の2行（実物の F キーへ線）。F を押して始めることが、同意になる
// 指の置き方（両手の絵）は、始めたあとの2枚目（stepHands）で見せる
const SAVER_NOTE = () => tr('手元の写真が、実際にXに投稿されます。', 'A photo of your hands will really be posted to X.');
const HANDS_MSG = () => [tr('親指以外の8本を、体重をかけずに軽く添えてください。', 'Rest 8 fingers lightly, without your thumbs.'),
  tr('強く押さえると、キーが上がりきらないことがあります。', "If you press down hard, the keys may not rise all the way.")];   // 2枚目（2行目は理由。少し小さく）
const HANDS_MS = 7000;   // 2枚目（指の置き方）を見せる時間
// 始め方の2行。1行目は [強調する部分（赤）, 続き] に分けて書く。キーの文字（F）は、来場者には関係ないので出さない
const SAVER_GO = () => tr(['同意いただける方は', '、キーが上がったら強く押してください'], ['If you agree', ', press the key firmly when it rises.']);   // [強調する部分（赤）, 続き]
// 待機画面の文字：作品名のほかは、すべて同じ大きさ・同じ太さ（強調は、色だけ）
const SAVER_FS = 0.8, SAVER_W = 600;
const WAKE_UP_MS = 2500;      // 待機：F を上げておく時間。このあいだに押し込まれたら始まる（はじめの WAKE_SETTLE_MS は受け付けないので、押せるのは2秒）
// 待機の押し込みは、勝手に始まらないよう厳しめに読む（基板がつながっているとき）：上がってから WAKE_SETTLE_MS は数えない（上がった直後の電流のゆれ）。
// 押し込みの強さが、しきい値の WAKE_MIN_RATIO 倍以上のときだけ始める（ノイズは、しきい値すれすれのことが多い）。押し込みのたびに、強さを下の帯に出す
const WAKE_SETTLE_MS = 500, WAKE_MIN_RATIO = 1.4;   // もとは 1.0（基板のしきい値そのまま）
const WAKE_SLEEP_MS = 5000;   // 待機：F を下げて休ませる時間（ソレノイドの発熱を避ける）
const BEAT_KEY = 3;       // F
const TITLE = 'Who typed?';                // 最後に打たれる作品名
const TITLE_DARK = true;                   // 作品名の画面：黒地に白い字（false で白地に黒い字）

// いまの言語の台本（setLang で切り替える）
let TX = TX_JA, LN = LINE_JA, DRAFTS = DRAFTS_JA, REVS = null;
function setLang(l) {
  LANG = l === 'en' ? 'en' : 'ja';
  const en = LANG === 'en';
  TX = en ? TX_EN : TX_JA; LN = en ? LINE_EN : LINE_JA; DRAFTS = en ? DRAFTS_EN : DRAFTS_JA;
  REVS = en ? (window.KC_REVIEWS_EN || REVIEWS) : REVIEWS;   // 英語の100本は reviews_en.js
  window.KC_POST?.setLang?.(LANG);
}

// 辛口の感想（100個）。ポストのたびに、上から順番に使う（nextReview）。英語版は reviews_en.js（同じ順番・同じ内容）
const REVIEWS = [
  "正直{しょうじき}、よく分{わ}からなかったです。指{ゆび}が勝手{かって}に動{うご}くのは面白{おもしろ}いけど、それだけ。待{ま}ち時間{じかん}のわりに短{みじか}いし、わざわざ来{く}るほどではないかな。",
  "期待{きたい}していたのにがっかりでした。仕組{しく}みは面白{おもしろ}いのかもしれませんが、体験{たいけん}としては退屈{たいくつ}です。待{ま}ち時間{じかん}を返{かえ}してほしいです。",
  "キーボードが勝手{かって}に動{うご}くだけの展示{てんじ}でした。何{なに}を伝{つた}えたいのか最後{さいご}まで分{わ}からず、ただ疲{つか}れました。説明不足{せつめいぶそく}だと思{おも}います。",
  "並{なら}んだ時間{じかん}のほうが長{なが}かったです。中身{なかみ}は数分{すうふん}で終{お}わるし、意味{いみ}ありげな雰囲気{ふんいき}だけで、結局{けっきょく}なにも残{のこ}りませんでした。",
  "作{つく}り手{て}の自己満足{じこまんぞく}を見{み}せられた気分{きぶん}です。技術{ぎじゅつ}はすごいのかもしれないけど、体験{たいけん}する側{がわ}のことを考{かんが}えていない展示{てんじ}でした。",
  "指{ゆび}を置{お}いていただけで終{お}わりました。参加{さんか}している感{かん}じがまったくなくて、見{み}ているだけと変{か}わらないです。退屈{たいくつ}でした。",
  "説明{せつめい}がほとんどなくて置{お}いていかれました。考{かんが}えさせる系{けい}なのは分{わ}かるけど、ここまで不親切{ふしんせつ}だと考{かんが}える気{き}も失{う}せます。",
  "期待外{きたいはず}れです。触覚{しょっかく}の展示{てんじ}と聞{き}いて来{き}たのに、カチカチ指{ゆび}が動{うご}くだけ。これなら家{いえ}でスマホを触{さわ}っていたほうがましでした。",
  "選択肢{せんたくし}があるのに、選{えら}んだ意味{いみ}がほとんどない。結局{けっきょく}ぜんぶ決{き}まっていて、ただ付{つ}き合{あ}わされた感{かん}じがして不快{ふかい}でした。",
  "話題{わだい}になっていたので来{き}ましたが、正直{しょうじき}がっかり。仕掛{しか}けは一回{いっかい}で飽{あ}きるし、後半{こうはん}は早{はや}く終{お}わらないかなと思{おも}っていました。",
  "不気味{ぶきみ}なだけで、楽{たの}しくはなかったです。勝手{かって}に文章{ぶんしょう}が打{う}たれていくのを見{み}ても、何{なに}も感{かん}じませんでした。時間{じかん}の無駄{むだ}です。",
  "手{て}が疲{つか}れました。じっと指{ゆび}を置{お}いておくのが地味{じみ}につらいし、終{お}わったあとに残{のこ}るのは指先{ゆびさき}の違和感{いわかん}だけでした。",
  "スタッフの説明{せつめい}も展示{てんじ}の中身{なかみ}も、どちらも分{わ}かりにくい。何{なに}がしたいのか、作{つく}った人{ひと}にもう一度{いちど}考{かんが}えてほしいです。",
  "最初{さいしょ}の数十秒{すうじゅうびょう}は面白{おもしろ}かったけど、そこからはずっと同{おな}じことの繰{く}り返{かえ}し。長{なが}いし単調{たんちょう}だし、途中{とちゅう}で集中{しゅうちゅう}が切{き}れました。",
  "アート作品{さくひん}と言{い}えば何{なん}でも許{ゆる}されると思{おも}っていそう。体験{たいけん}としての完成度{かんせいど}は低{ひく}くて、学生{がくせい}の課題{かだい}レベルだと感{かん}じました。",
  "こういう考{かんが}えさせる系{けい}の展示{てんじ}、正直{しょうじき}もうお腹{はら}いっぱいです。問{と}いを投{な}げるだけ投{な}げて、答{こた}えも余韻{よいん}もありませんでした。",
  "思{おも}ったより地味{じみ}でした。キーボードが動{うご}くのは最初{さいしょ}だけ驚{おどろ}くけど、すぐ慣{な}れます。わざわざ予約{よやく}して来{く}る価値{かち}はなかったです。",
  "説明文{せつめいぶん}を読{よ}んでも体験{たいけん}しても、よく分{わ}からないまま終{お}わりました。分{わ}からない自分{じぶん}が悪{わる}いのかと思{おも}わされるのも嫌{いや}でした。",
  "指先{ゆびさき}に変{へん}な感覚{かんかく}が残{のこ}っていて気持{きも}ち悪{わる}いです。体験{たいけん}中{なか}も落{お}ち着{つ}かなくて、楽{たの}しむどころではありませんでした。",
  "他{ほか}の展示{てんじ}と比{くら}べると、明{あき}らかに見劣{みおと}りします。仕掛{しか}けに頼{たよ}りすぎていて、中身{なかみ}がついてきていない印象{いんしょう}でした。",
  "全体的{ぜんたいてき}に雑{ざつ}です。画面{がめん}の文字{もじ}も読{よ}みにくいし、何{なに}が起{お}きているのか追{お}いつけない。もう少{すこ}し丁寧{ていねい}に作{つく}ってほしかったです。",
  "展示{てんじ}のコンセプトは立派{りっぱ}なのに、体験{たいけん}がそれに追{お}いついていない。言{い}いたいことだけが先走{さきばし}っていて、響{ひび}きませんでした。",
  "これで終{お}わり？というのが正直{しょうじき}な感想{かんそう}です。盛{も}り上{あ}がる前{まえ}に終{お}わってしまって、物足{ものた}りなさしか残{のこ}りませんでした。",
  "キーボードに振{ふ}り回{まわ}されるだけの数分間{すうふんかん}でした。こちらが何{なに}をしても変{か}わらないなら、体験{たいけん}型{がた}にする意味{いみ}がないと思{おも}います。",
  "待{ま}っている間{ま}のほうがまだ楽{たの}しかったです。中{なか}に入{はい}ってからは、ずっと置{お}いてけぼりで、気{き}づいたら終{お}わっていました。",
  "感想{かんそう}を書{か}かせる仕組{しく}みも含{ふく}めて、あざといと感{かん}じました。体験{たいけん}した人{ひと}をネタにしているようで、あまりいい気分{きぶん}ではないです。",
  "技術{ぎじゅつ}の無駄遣{むだづか}いだと思{おも}います。これだけの装置{そうち}を作{つく}って、伝{つた}わってくるものがこれだけなのは、さすがにもったいないです。",
  "友{とも}だちに勧{すす}められて来{き}たけど、勧{すす}めた理由{りゆう}が分{わ}からない。正直{しょうじき}、話{はなし}のタネにもならないくらい印象{いんしょう}に残{のこ}りませんでした。",
  "音{おと}がうるさくて集中{しゅうちゅう}できませんでした。カチカチ鳴{な}るたびに気{き}が散{ち}って、画面{がめん}の内容{ないよう}がほとんど頭{あたま}に入{はい}ってきませんでした。",
  "説教{せっきょう}されているみたいで、居心地{いごこち}が悪{わる}かったです。テクノロジーは怖{こわ}いですよ、と言{い}われても、もう知{し}っています。",
  "体験{たいけん}というより、ただの見{み}せ物{もの}でした。自分{じぶん}の指{ゆび}なのに自分{じぶん}のものじゃない感{かん}じが、最後{さいご}までただ不快{ふかい}なだけでした。",
  "期待値{きたいち}が高{たか}すぎたのかもしれませんが、それにしても薄{うす}い内容{ないよう}。仕掛{しか}けの説明{せつめい}をされたら、それで満足{まんぞく}してしまう程度{ていど}です。",
  "画面{がめん}の進{すす}み方{かた}が早{はや}すぎて、ついていけませんでした。読{よ}もうとしたらもう次{つぎ}に進{すす}んでいて、ずっと急{せ}かされている感{かん}じです。",
  "最後{さいご}のオチも予想{よそう}どおりで、驚{おどろ}きはありませんでした。途中{とちゅう}で展開{てんかい}が読{よ}めてしまうので、緊張感{きんちょうかん}もなかったです。",
  "展示{てんじ}としての完成度{かんせいど}が低{ひく}すぎます。途中{とちゅう}で動{うご}きが止{と}まったように感{かん}じる場面{ばめん}もあって、不安{ふあん}なまま体験{たいけん}していました。",
  "何{なに}も考{かんが}えずに指{ゆび}を置{お}いていたら終{お}わっていた、という感{かん}じです。主体的{しゅたいてき}に関{かか}わる余地{よち}がなく、記憶{きおく}にも残{のこ}りませんでした。",
  "映{は}えるわけでもなく、学{まな}びがあるわけでもない。誰{だれ}に向{む}けた展示{てんじ}なのか分{わ}からないまま、出口{でぐち}に着{つ}いてしまいました。",
  "大{おお}げさな言葉{ことば}で飾{かざ}っているわりに、やっていることは単純{たんじゅん}。種明{たねあき}かしをされたら、なんだそれだけか、と思{おも}いました。",
  "指{ゆび}に意識{いしき}を集中{しゅうちゅう}させられて、肩{かた}がこりました。体験{たいけん}中{なか}ずっと身構{みがま}えていたので、終{お}わったときにどっと疲{つか}れました。",
  "正直{しょうじき}に言{い}うと、つまらなかったです。悪{わる}い意味{いみ}で予想{よそう}を裏切{うらぎ}られました。もう少{すこ}し遊{あそ}び心{ごころ}のある展示{てんじ}だと思{おも}っていました。",
  "雰囲気{ふんいき}だけはそれっぽいけど、中身{なかみ}が伴{ともな}っていない。最後{さいご}まで、何{なに}かが始{はじ}まるのを待{ま}っているうちに終{お}わりました。",
  "二度{にど}とやりたいとは思{おも}いません。指{ゆび}を動{うご}かされる感覚{かんかく}が苦手{にがて}な人{ひと}もいるのに、その配慮{はいりょ}がまったく感{かん}じられませんでした。",
  "説明{せつめい}なしで体験{たいけん}させて、最後{さいご}に問{と}いだけ投{な}げるのはずるいと思{おも}います。考{かんが}えるための材料{ざいりょう}がほとんど渡{わた}されていません。",
  "SNSで見{み}て期待{きたい}していたのに、実物{じつぶつ}はかなり地味{じみ}でした。写真{しゃしん}や動画{どうが}で見{み}たほうが、まだ面白{おもしろ}そうに見{み}えると思{おも}います。",
  "ひとりで体験{たいけん}するには長{なが}すぎて、話{はな}し相手{あいて}もいないので退屈{たいくつ}でした。途中{とちゅう}から早{はや}く終{お}われとしか思{おも}っていなかったです。",
  "このために並{なら}んだと思{おも}うと悔{くや}しいです。数分{すうふん}の体験{たいけん}に対{たい}して、待{ま}ち時間{じかん}と疲労感{ひろうかん}が全然{ぜんぜん}見合{みあ}っていませんでした。",
  "仕掛{しか}けは理解{りかい}しましたが、心{こころ}は動{うご}きませんでした。驚{おどろ}かせることだけが目的{もくてき}になっていて、その先{さき}がない展示{てんじ}です。",
  "意図{いと}は分{わ}かるけど、やり方{ほう}が押{お}しつけがましい。こちらが自分{じぶん}で気{き}づく前{まえ}に、答{こた}えを用意{ようい}されている感{かん}じがしました。",
  "キーの動{うご}きと画面{がめん}の文字{もじ}が合{あ}っていないように見{み}えて、混乱{こんらん}しました。仕組{しく}みが雑{ざつ}なのか演出{えんしゅつ}なのかも分{わ}からないです。",
  "誰{だれ}でも思{おも}いつきそうなアイデアを、そのまま形{かたち}にしただけに見{み}えました。もうひとひねり欲{ほっ}しかったのが本音{ほんね}です。",
  "暗{くら}くて重{おも}いテーマを、軽{かる}いノリで扱{あつか}っているのが気{き}になりました。見{み}せ方{かた}次第{しだい}で、もっといい作品{さくひん}になったはずです。",
  "体験{たいけん}の最初{さいしょ}と最後{さいご}で、何{なに}も変{か}わりませんでした。気{き}づきも学{まな}びもなく、ただ指{ゆび}を貸{か}していただけの時間{じかん}です。",
  "展示{てんじ}の説明{せつめい}に書{か}いてあることと、実際{じっさい}の体験{たいけん}がずれている気{き}がします。期待{きたい}させるだけさせて、肩{かた}すかしでした。",
  "動{うご}きがぎこちなくて、技術的{ぎじゅつてき}にもまだまだだと感{かん}じました。作品{さくひん}として見{み}せるには、もう少{すこ}し磨{みが}いてほしかったです。",
  "最後{さいご}まで自分{じぶん}ごととして感{かん}じられませんでした。画面{がめん}の中{なか}の出来事{できごと}を、他人事{たにんごと}のように眺{なが}めていただけです。",
  "入口{いりぐち}の雰囲気{ふんいき}は良{よ}かったのに、中身{なかみ}で台無{だいな}し。期待{きたい}が大{おお}きかった分{ぶん}、出{で}てきたときの落差{らくさ}がひどかったです。",
  "小学生{しょうがくせい}向{む}けの科学館{かがくかん}の展示{てんじ}のほうが、よほど分{わ}かりやすくて面白{おもしろ}いです。大人{おとな}向{む}けとしても中途半端{ちゅうとはんぱ}でした。",
  "同{おな}じような展示{てんじ}を前{まえ}にも見{み}たことがあります。新{あたら}しさが感{かん}じられず、どこかで見{み}た仕掛{しか}けの寄{よ}せ集{あつ}めでした。",
  "疲{つか}れているときに体験{たいけん}したせいか、ただただしんどかったです。もう少{すこ}し気楽{きらく}に楽{たの}しめる作{つく}りにしてほしいです。",
  "手{て}の位置{いち}を何度{なんど}も気{き}にさせられて、内容{ないよう}に集中{しゅうちゅう}できませんでした。体験{たいけん}の入{い}り口{ぐち}でつまずく作{つく}りは致命的{ちめいてき}です。",
  "これを作品{さくひん}と呼{よ}ぶのは無理{むり}があると思{おも}います。アイデアのメモを、そのまま展示{てんじ}しているような印象{いんしょう}でした。",
  "面白{おもしろ}くなりそうなところで毎回{まいかい}終{お}わってしまう。全体的{ぜんたいてき}に出{だ}し惜{お}しみされているようで、消化不良{しょうかふりょう}のままです。",
  "意味{いみ}ありげな問{と}いかけで締{し}めればいいと思{おも}っていませんか。体験{たいけん}の中身{なかみ}が薄{うす}いので、問{と}いも空回{からまわ}りしていました。",
  "画面{がめん}の文字{もじ}が小{ちい}さくて読{よ}めない場面{ばめん}がありました。体験{たいけん}型{がた}なのに、見{み}る側{がわ}への配慮{はいりょ}が足{た}りていないと思{おも}います。",
  "最後{さいご}の投稿{とうこう}のくだりも、ただ不快{ふかい}でした。驚{おどろ}かせたいのは分{わ}かるけど、やっていいことと悪{わる}いことがあると思{おも}います。",
  "キーボードが動{うご}いた瞬間{しゅんかん}は笑{わら}ったけど、それ以上{いじょう}の感情{かんじょう}は湧{わ}きませんでした。一発{いっぱつ}芸{げい}として見{み}るのが正解{せいかい}かもしれません。",
  "結局{けっきょく}、何{なに}を体験{たいけん}したのか人{ひと}に説明{せつめい}できません。説明{せつめい}できないほど深{ふか}いのではなく、ただ中身{なかみ}がなかったのだと思{おも}います。",
  "期待{きたい}して来{き}たぶん、本当{ほんとう}に残念{ざんねん}でした。準備{じゅんび}や待{ま}ち時間{じかん}を考{かんが}えると、正直{しょうじき}もう一度{いちど}来{こ}ようとは思{おも}えません。",
  "展示{てんじ}側{がわ}の都合{つごう}ばかりが目{め}について、体験{たいけん}する人{ひと}のことが後回{あとまわ}しにされている印象{いんしょう}。不親切{ふしんせつ}さが最後{さいご}まで気{き}になりました。",
  "ずっと誰{だれ}かに見張{みは}られているようで、落{お}ち着{つ}きませんでした。不安{ふあん}をあおるだけで、その先{さき}の救{すく}いがない作品{さくひん}です。",
  "技術{ぎじゅつ}はすごいのに、使{つか}い方{かた}がもったいない。この装置{そうち}なら、もっと楽{たの}しくて驚{おどろ}きのある体験{たいけん}を作{つく}れたと思{おも}います。",
  "選{えら}んだつもりが選{えら}ばされていた、という種明{たねあき}かしも、途中{とちゅう}で読{よ}めてしまいました。もう少{すこ}し意外性{いがいせい}が欲{ほっ}しかったです。",
  "時間{じかん}が余{あま}ったので入{はい}ってみましたが、余{あま}った時間{じかん}で十分{じゅうぶん}な内容{ないよう}でした。わざわざ目当{めあ}てにするほどではないです。",
  "説明{せつめい}が少{すく}ないのを、余白{よはく}と呼{よ}ぶのは無理{むり}があります。受{う}け取{と}る側{がわ}に丸{まる}投{な}げしているだけで、作品{さくひん}としては未完成{みかんせい}です。",
  "体験{たいけん}中{なか}、ずっと指先{ゆびさき}がむずがゆかったです。気持{きも}ち悪{わる}さが勝{か}ってしまって、内容{ないよう}について考{かんが}える余裕{よゆう}がありませんでした。",
  "展示室{てんじしつ}の中{なか}が暑{あつ}くて、それどころではなかったです。体験{たいけん}の中身{なかみ}も単調{たんちょう}で、早{はや}く外{そと}に出{で}たいとしか思{おも}えませんでした。",
  "問{と}いかけは鋭{するど}いのかもしれないけど、体験{たいけん}が退屈{たいくつ}すぎて届{とど}かない。つまらないものから学{まな}ぶのは、正直{しょうじき}むずかしいです。",
  "入{はい}ってから出{で}るまで、ずっと置{お}いていかれていました。体験{たいけん}する人{ひと}のペースをまったく考{かんが}えていない展示{てんじ}だと思{おも}います。",
  "仕掛{しか}けが分{わ}かった瞬間{しゅんかん}に冷{さ}めました。そこから先{さき}は、決{き}まった流{なが}れをただ見{み}せられているだけの時間{じかん}でした。",
  "人{ひと}に勧{すす}めるかと聞{き}かれたら、勧{すす}めません。時間{じかん}があって、よほど暇{ひま}なら、くらいの気持{きも}ちで十分{じゅうぶん}な展示{てんじ}です。",
  "自分{じぶん}の指{ゆび}が勝手{かって}に打{う}った文章{ぶんしょう}を見{み}せられて、いい気{き}はしません。悪趣味{あくしゅみ}な演出{えんしゅつ}だと感{かん}じたのが一番{いちばん}の感想{かんそう}です。",
  "もっと参加{さんか}できるのかと思{おも}っていました。選{えら}べる場面{ばめん}もあるけど、どれを選{えら}んでも同{おな}じなら、選{えら}ばせないでほしいです。",
  "期待{きたい}を下回{したまわ}りました。ポスターの雰囲気{ふんいき}はよかったのに、体験{たいけん}はちぐはぐで、まとまりのない印象{いんしょう}を受{う}けました。",
  "あれもこれも詰{つ}め込{こ}みすぎて、結局{けっきょく}どれも中途半端{ちゅうとはんぱ}。ひとつのことに絞{しぼ}ったほうが、伝{つた}わったと思{おも}います。",
  "キーが勝手{かって}に動{うご}くことには、すぐに慣{な}れてしまいました。慣{な}れたあとに何{なに}も残{のこ}らないのが、この展示{てんじ}の限界{げんかい}です。",
  "内容{ないよう}よりも、指{ゆび}を置{お}く姿勢{しせい}のつらさのほうが記憶{きおく}に残{のこ}っています。体験{たいけん}の作{つく}りから見直{みなお}したほうがいいと思{おも}います。",
  "作{つく}った人{ひと}たちは楽{たの}しかったんだろうな、と思{おも}いました。ただ、その楽{たの}しさが体験{たいけん}する側{がわ}にはまったく伝{つた}わってきません。",
  "何{なに}かを感{かん}じ取{と}らなきゃいけない空気{くうき}がしんどかったです。感{かん}じ取{と}れなかった人{ひと}は置{お}いていく、という作{つく}りに見{み}えました。",
  "展示{てんじ}のメッセージが一方的{いっぽうてき}で、押{お}しつけがましい。テクノロジーへの不安{ふあん}をあおるだけなら、ニュースで十分{じゅうぶん}です。",
  "最後{さいご}の画面{がめん}で問{と}いかけられても、ぴんときませんでした。そこまでの体験{たいけん}が薄{うす}いので、問{と}いが重{おも}く響{ひび}かないんです。",
  "目新{めあたら}しさだけで勝負{しょうぶ}している展示{てんじ}でした。驚{おどろ}きが過{す}ぎたあとに残{のこ}るものがないので、印象{いんしょう}がすぐに消{き}えていきます。",
  "途中{とちゅう}で何度{なんど}か、壊{こわ}れているのかと思{おも}いました。演出{えんしゅつ}なのか不具合{ふぐあい}なのか分{わ}からない時点{じてん}で、体験{たいけん}としては失敗{しっぱい}です。",
  "結局{けっきょく}、自分{じぶん}は何{なに}もしていないのに、感想{かんそう}だけは自分{じぶん}のものにされる。その仕組{しく}みがいちばん気持{きも}ち悪{わる}かったです。",
  "もっと短{みじか}くていい。同{おな}じような場面{ばめん}が続{つづ}くので、途中{とちゅう}から先{さき}の展開{てんかい}が読{よ}めてしまい、退屈{たいくつ}な時間{じかん}が長{なが}かったです。",
  "学生{がくせい}の発表会{はっぴょうかい}を見{み}に来{き}たような気分{きぶん}でした。熱意{ねつい}は伝{つた}わるけど、作品{さくひん}として人{ひと}に見{み}せるには、まだ早{はや}いと思{おも}います。",
  "楽{たの}しい展示{てんじ}だと思{おも}って子{こ}どもと来{き}ましたが、内容{ないよう}が分{わ}かりにくく、子{こ}どもは途中{とちゅう}で飽{あ}きていました。残念{ざんねん}です。",
  "キーボードの音{おと}と動{うご}きに気{き}をとられて、画面{がめん}の話{はなし}がまったく入{はい}ってきませんでした。情報{じょうほう}を詰{つ}め込{こ}みすぎです。",
  "評判{ひょうばん}ほどではなかったです。期待{きたい}しすぎた自分{じぶん}も悪{わる}いけど、それを差{さ}し引{ひ}いても、心{こころ}に残{のこ}るものはありませんでした。",
  "体験{たいけん}している間{あいだ}、ずっと不安{ふあん}でした。何{なに}が起{お}きるのか分{わ}からない怖{こわ}さだけが続{つづ}いて、楽{たの}しいと思{おも}う瞬間{しゅんかん}はなかったです。",
  "出口{でぐち}でアンケートを書{か}かされるより、こっちのほうがよっぽど気持{きも}ち悪{わる}い。勝手{かって}に感想{かんそう}を作{つく}られるのは、もうこりごりです。",
];
// ================= 文を「打つキー」に分ける =================
const KANJI = /[㐀-鿿豈-﫿々〆]/;
const RUBY = /([㐀-鿿豈-﫿々〆]+)\{([^}]*)\}/g;
const strip = src => String(src).replace(RUBY, '$1');
const nk = s => String(s || '').normalize('NFKC');
const pseudoFinger = ch => { const c = ch.codePointAt(0); return (c ^ (c >> 3) ^ (c >> 6)) & 7; };   // 読みのない漢字：文字ごとに決まった指
// 戻り値の units は {disp: 画面に出す字, kana: 変換前のひらがな, conv: 変換される字か, keys: 打つローマ字（なければ ''）, moras: 1音ずつの [ローマ字, ひらがな], space, fixed: 記号の指, pseudo: 漢字の指}
function plan(src) {
  const units = [];
  const plain = str => {
    const chars = [...str]; let pos = 0;
    for (const mo of toMora(str)) {
      const n = [...mo.disp].length, disp = chars.slice(pos, pos + n).join('');   // 本体の toMora はカタカナをひらがなにするので、書いたとおりの字に戻す
      const u = {disp, kana: mo.disp, conv: mo.disp !== disp, keys: mo.keys, space: !!mo.space, moras: mo.keys ? [{keys: mo.keys, kana: mo.disp}] : []};
      pos += n;
      if (!u.keys && !u.space) { const f = fingerOf(u.disp); if (f >= 0) u.fixed = f; else if (KANJI.test(u.disp)) u.pseudo = pseudoFinger(u.disp); }
      units.push(u);
    }
  };
  let i = 0, m;
  RUBY.lastIndex = 0;
  while ((m = RUBY.exec(src))) {
    plain(src.slice(i, m.index));
    const moras = toMora(m[2]).filter(x => x.keys).map(x => ({keys: x.keys, kana: x.disp}));   // 読みは1音ずつ：子音と母音がそろったところで、ひらがなになる
    units.push({disp: m[1], kana: m[2], conv: true, keys: moras.map(x => x.keys).join(''), moras, pseudo: pseudoFinger(m[1])});
    i = RUBY.lastIndex;
  }
  plain(src.slice(i));
  return units;
}
// 文節：漢字・カタカナのあとに仮名が続き、また漢字・カタカナが来たら、そこで区切る。句読点のあとでも区切る。打たない字は、それだけで1つ
const PUNCT = /^[、。，．,.！？!?]$/;
function chunksOf(units) {
  const out = []; let c = [];
  const push = () => { if (c.length) out.push(c); c = []; };
  for (const u of units) {
    if (!u.keys) { push(); out.push([u]); continue; }
    if (u.conv && c.some(x => x.conv) && !c[c.length - 1].conv) push();
    c.push(u);
    if (PUNCT.test(u.disp)) push();
  }
  push();
  return out;
}

// ================= 時間・出力の道具 =================
const ABORT = Symbol('abort');
const live = S => !S.dead && cur === EXP;
const wait = async (S, ms) => { await new Promise(r => at(ms, r)); if (!live(S)) throw ABORT; };
const pace = S => S.pace || 1;                 // 予定より遅れているとき、少し速める（phase() で決める）
const beat = (S, ms) => wait(S, ms / (P.spd * pace(S)));   // 間（速さのスライダーに従う）
const ok = async (S, p) => { const v = await p; await new Promise(r => at(0, r)); if (!live(S)) throw ABORT; return v; };   // 一時停止中に届いたら、再開まで待つ
const randn = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const GAP = () => P.len + 75;                  // 同じ指を続けて打つのに要る間隔（基板の限界）
const ready = f => now() - lastHit[f] >= GAP();
const strike = (f, ms) => { if (f < 0 || f > 7) return false; hit(f, ms ?? P.len); return true; };
const strikeFree = f => ready(f) && strike(f);   // 指が戻っていなければ、打たない
const strikeWait = async (S, f, ms) => { const d = GAP() - (now() - lastHit[f]); if (d > 0) await wait(S, d); strike(f, ms); };
// 指が戻っていなければ、戻りしだい打つ。文字の速さは待たない（待っている打鍵が1つあれば、重ねない）
const queued = new Array(8).fill(false);
function strikeSoon(f) {
  if (f < 0 || f > 7) return;
  if (ready(f)) { strike(f); return; }
  if (queued[f]) return;
  queued[f] = true;
  at(GAP() - (now() - lastHit[f]) + 2, () => { queued[f] = false; strike(f); });
}
// 送信：Enter（右小指）を、しっかり2回押す（1回目で確定、2回目で送る。ENTER_TWICE）
async function enter2(S, onSend) {   // onSend：送る瞬間に呼ぶ（送信ボタンが押される見た目など）。ENTER_TWICE が false なら1回
  const ms = P.len + 90;
  await strikeWait(S, 7, ms);
  if (ENTER_TWICE) { await wait(S, ms + 140); strike(7, ms); }
  onSend?.();
  await wait(S, 120);
}
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

// ================= LLM（サーバーの /api/llm）：星に合った下書き =================
// 鍵はサーバーの .env にだけある。無い・遅い（2.8秒）・壊れた返事のときは null を返し、呼ぶ側が規則の文言で進める
async function llm(S, task, body, ms = 2800) {
  if (S.llmOff) return null;
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch('/api/llm', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({task, ...body}), signal: ctl.signal});
    const j = await r.json();
    return j && j.ok ? j : null;
  } catch (e) { return null; } finally { clearTimeout(tm); }
}
const oneLine = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);

// ================= 画面に出す文を打つ =================
// 文は IME と同じく、ローマ字 → ひらがな（子音と母音がそろったところで。下線）→ 変換（太い下線）→ 確定、の順に出る。その文字を打つ指で打つ。
// 人らしさ：文節ごとの勢い（速い文節・遅い文節）、文節の頭のためらい、ときどきの打ち間違いと Backspace（右小指）。
// speed は数（1.0 が本体の「人らしい打鍵」の速さ）か、打った割合 p → 速さ の関数。frenzy は、指が戻っていないキーを待たずに飛ばす（画面の文字は速いまま、指は追いつけない）
async function typeMe(S, tg, units, {speed = 1, frenzy = false, typos = true, append = false} = {}) {   // append：いま入っている字の続きに打つ
  const base = append ? tg.text : '';
  Object.assign(tg, {full: base + units.map(u => u.disp).join(''), text: base, comp: '', pend: '', conv: false});
  const total = units.length || 1, cs = chunksOf(units);
  const spAt = i => (typeof speed === 'function' ? speed(i / total) : speed) * P.spd * pace(S);
  const tap = f => { if (f >= 0) (frenzy ? strikeFree : strikeSoon)(f); };
  const calm = frenzy ? 0.2 : 1;   // 暴走中は、ためらいも変換の間も短い
  const direct = LANG === 'en';   // 英語：打った字が、そのまま確定した字として出る（下線も変換もない）
  let done = 0;
  for (let ci = 0; ci < cs.length; ci++) {
    const c = cs[ci], u0 = c[0];
    if (!u0.keys) {   // 記号・読みのない漢字・空白
      tap(u0.fixed ?? u0.pseudo ?? -1);
      tg.text += u0.disp; done++;
      await wait(S, (u0.space ? rand(120, 260) : rand(60, 120)) / spAt(done));
      continue;
    }
    const mood = clamp(Math.exp(randn() * 0.22), 0.72, 1.45);   // この文節の勢い
    if (ci > 0) {   // 文節の頭：少し考える（ときどき、長く）
      let w = rand(40, 170);
      if (Math.random() < 0.16) w += rand(200, 480);
      await wait(S, w * calm / spAt(done));
    }
    let after = 0;
    for (let ui = 0; ui < c.length; ui++) {
      const u = c[ui], sp = spAt(done);
      for (let mi = 0; mi < u.moras.length; mi++) {
        const mo = u.moras[mi], nx = u.moras[mi + 1] ?? c[ui + 1]?.moras[0] ?? cs[ci + 1]?.[0]?.moras?.[0];
        for (let ki = 0; ki < mo.keys.length; ki++) {
          const ch = mo.keys[ki], f = fingerOf(ch), last = ki === mo.keys.length - 1;
          if (typos && !frenzy && sp < 1.8 && f >= 0 && Math.random() < 0.02) {   // 打ち間違えて、消して、打ち直す
            const wf = f === 0 ? 1 : f === 7 ? 6 : f + (Math.random() < 0.5 ? -1 : 1);
            tap(wf); if (direct) tg.text += 'asdfjkl;'[wf]; else tg.pend += 'asdfjkl;'[wf];
            await wait(S, rand(150, 260) / sp);
            tap(7); if (direct) tg.text = tg.text.slice(0, -1); else tg.pend = tg.pend.slice(0, -1);
            await wait(S, rand(90, 170) / sp);
          }
          tap(f);
          if (direct) { if (last) tg.text += mo.kana; }
          else { tg.pend += ch; if (last) { tg.comp += mo.kana; tg.pend = ''; } }   // 1音そろったら、ひらがなに
          const w = interKey(ch, last ? (nx?.keys?.[0] ?? '') : mo.keys[ki + 1], last) * mood * (ui === 0 ? 1.1 : 0.94);
          await wait(S, w / sp);
        }
      }
      if (/[、,]$/.test(u.disp)) after = rand(140, 280);
      if (/[。.！？!?]$/.test(u.disp)) after = rand(240, 420);
      done++;
    }
    const disp = c.map(u => u.disp).join(''), sp = spAt(done);
    if (c.some(u => u.conv)) {   // 変換して、確定する
      await wait(S, rand(90, 200) * calm / sp);
      tg.comp = disp; tg.conv = true;
      await wait(S, rand(110, 220) * calm / sp);
    }
    if (!direct) tg.text += disp;
    tg.comp = ''; tg.conv = false;
    if (after) await wait(S, after / sp);   // 句読点のあとの息継ぎ
  }
}

// ---- インストラクターの画面：いまの台詞（と、来場者の返事）だけ。前のものは、ふっと消える ----
const newItem = (who, scale = 1) => ({who, scale, text: '', comp: '', pend: '', full: ''});
function fadeOut(S, it) {
  const C = S.cli;
  if (!it || it.out) return;
  it.out = now(); C.gone.push(it);
  if (C.inst === it) C.inst = null;
  if (C.me === it) C.me = null;
}
function clearCli(S, now_ = false) {   // now_：画面の外にいるので、消える動きは要らない
  if (now_) { Object.assign(S.cli, {inst: null, me: null, gone: []}); return; }
  fadeOut(S, S.cli.inst); fadeOut(S, S.cli.me);
}
// インストラクターの台詞：打ち込むのではなく、1文字ずつふわっと浮かび上がる（来場者のターンではないので、キーは動かさない）。
// keep：質問なので、来場者の答えが終わるまで残す（次の台詞で消える）。keep でなければ、言い終えて after だけ待ってから消える
async function say(S, src, {scale = 1, after = 800, keep = false, ms = 55} = {}) {
  clearCli(S);
  const it = S.cli.inst = newItem('inst', scale);
  it.full = strip(src); it.ct = [];   // ct：字が出た時刻（浮かび上がる動きに使う）
  const per = LANG === 'en' ? ms * 0.45 : ms;   // 英語は字数が多いので、1文字の間を短く
  for (const ch of it.full) {
    it.ct.push(now()); it.text += ch;
    await beat(S, per + (/[、,]/.test(ch) ? 160 : /[。！？!?.]/.test(ch) ? 260 : 0));
  }
  await beat(S, RISE + after);
  if (!keep) { fadeOut(S, it); await beat(S, 420); }
  return it;
}
async function sayMe(S, src, {speed = 1, after = 500} = {}) {
  fadeOut(S, S.cli.me);
  const it = S.cli.me = newItem('me');
  S.typing = it;
  await typeMe(S, it, plan(src), {speed});
  await beat(S, SEND_PAUSE);   // 打ち終えてから、送るまでの少しの間
  await enter2(S);
  S.typing = null;
  await beat(S, after);
  return it;
}
// ================= 場面の切り替え：画面全体が横にスライドする =================
// dir = 1：次の画面が右から入る（アプリへ）。dir = -1：左から戻る（ホームへ）。キーは動かさない
async function slide(S, to, dir) {
  const from = S.scr, dur = 700 / P.spd;
  S.slide = {from, to, dir, t0: now(), dur};
  await wait(S, dur);
  S.scr = to; S.slide = null;
}
// アプリへ：1テンポおいてから、スライドする。インストラクターの台詞は、画面の外へ出たら消す
async function toApp(S, scr) {
  await beat(S, 1700);
  await slide(S, scr, 1);
  clearCli(S, true);
}

// ================= 場面 =================
const clock = min => `${Math.floor(min / 60) % 24}:${String(Math.floor(min) % 60).padStart(2, '0')}`;
const field = () => ({text: '', comp: '', pend: '', full: '', redFrom: null});
const newLine = () => ({k: 'line', name: tr('鈴木', 'Smith'), msgs: [], input: field(), n: 0, scroll: 0});

// あいさつ（名乗らない）
async function stepHello(S) {
  await say(S, TX.hello, {scale: 1.15, after: 900});
}
// 選び方の練習（LINE の前）：説明して、LINE と同じ見た目のカードで一度だけ選んでもらう（最初の選ぶ場面なので「上がったキーを押して、選んでください」も出る）
async function stepHowTo(S) {
  await say(S, TX.howTo1, {after: 600});
  await say(S, TX.howTo2, {after: 900});
  await say(S, TX.tryIt, {keep: true, after: 300});
  await choose(S, {options: TX.tryOptions, cards: true});
  await wait(S, 300);
  clearCli(S);
  await beat(S, 500);
  await say(S, TX.release, {after: 1400});   // 押したままの指を、軽く添えた状態に戻してもらう
  await say(S, TX.ready, {after: 700});
}

// ================= 選ぶ場面 =================
// options を、キー（S D F）の上に出す。読む（5秒。キーは上がらず、札もオレンジも出ない）→ キーが上がり、札が出て選ぶ（5秒）→ 決まる。
// forced：どれを押してもそれに決まる（画面では押したものが光るだけで、場面は forced の方へ進む）。
// 時間切れ：forced があればそれ、なければランダム。戻り値 {picked（押したもの。押さなければ -1）, final}
// bar：LINE の変換候補の帯で選ぶ（画面の下に重ねる選択肢は出さない。キーの番号も出さない。決まったら、すぐ戻る）。fallback：時間切れのときの選択肢
async function choose(S, {options, keys = CHOICE_KEYS, forced = null, fallback = null, label = '', readMs = CHOICE.readMs, selectMs = CHOICE.selectMs, bar = false, cards = false}) {   // dim：選ぶあいだ、まわりを暗くする（LINE の画面だけ）
  const KI = window.KC_INPUT, ks = [...keys].map(c => 'asdfjkl;'.indexOf(c)).slice(0, options.length);
  if (cards) bar = true;   // カード（インストラクターの白い画面：選び方の練習・星）：LINE と同じ見た目
  const C = S.choice = {options, ks, label, forced, bar, cards, stage: 'read', t0: now(), dur: readMs, picked: -1, final: -1, tutorial: !S.tutored};   // 最初の1回だけ、選び方を添える
  S.tutored = true;
  const st = (stage, dur = 0) => Object.assign(C, {stage, t0: now(), dur});
  KI.guide(keys); KI.labels(ks.map((k, j) => [k, j + 1])); KI.calm(true);   // 読む段階から、どのキーがどの選択肢か（①②③）を控えめに見せる（calm：上がっても、上がった見え方にしない）
  mark(S, 'c:read');
  await wait(S, Math.max(0, readMs - CHOICE.prepMs));
  // 準備：キーを上げはじめる（電流が落ち着くのを待つ）。まだ受け付けない。押されたら、警告を強める
  KI.listen(keys);
  const early = e => { if (ks.includes(e.detail.key)) C.earlyT = now(); };
  addEventListener('kc-press', early);
  try { await wait(S, Math.min(readMs, CHOICE.prepMs)); } finally { removeEventListener('kc-press', early); }
  st('select', selectMs);
  KI.calm(false);   // ここで初めて、上がったキーを強く光らせる
  mark(S, 'c:select');
  let picked = await ok(S, new Promise(resolve => {
    let fin = false;
    const done = j => { if (fin) return; fin = true; removeEventListener('kc-press', on); resolve(j); };
    const on = e => { const j = ks.indexOf(e.detail.key); if (j >= 0) done(j); };
    at(selectMs, () => done(-1));   // 一時停止のあいだは、残り時間も止まる
    addEventListener('kc-press', on);
  }));
  KI.listen(0); KI.guide(0); KI.labels(null); KI.calm(false);
  mark(S, picked < 0 ? 'c:timeout' : 'c:pick' + picked);
  C.picked = picked;
  if (picked < 0) {   // 時間切れ
    C.final = forced ?? fallback ?? Math.floor(Math.random() * options.length);
    st('timeout'); await wait(S, bar ? 700 : 1000);
  } else {
    C.final = forced ?? picked;   // 勝手に決められる場面でも、画面では選んだものが光ったまま。場面は決められた方へ進む
    st('picked'); await wait(S, bar ? 600 : CHOICE.pickMs);
  }
  if (!bar) { st('final'); await wait(S, CHOICE.finalMs); st('out'); await wait(S, 350); }
  S.choice = null;
  return {picked, final: C.final};
}
// カード j の、いまの見え方：lime（黄緑の光 0..1）。押したものが光る（時間切れのときは、代わりに選ばれたもの）
function cardLook(C, j, t) {
  const e = clamp((t - C.t0) / 250, 0, 1), sel = C.picked >= 0 ? C.picked : C.final;
  const look = {lime: 0};
  if (C.stage === 'picked' && j === C.picked) look.lime = e;
  if ((C.stage === 'final' || C.stage === 'out') && j === sel) look.lime = 1;
  return look;
}

// ================= LINE：鈴木との会話。相手の文は、間をおいて、ぽんっと出る（相手のターンなので、キーは動かない） =================
async function lineIn(S, L, x) {
  L.msgs.forEach(m => { if (m.who === 'me') m.read = true; });   // すぐ既読がつき、返事はしばらく来ない
  await beat(S, x.wait ?? 1500);
  L.msgs.forEach(m => { if (m.redFrom != null && !m.redOff) m.redOff = now(); });   // 勝手に打ち足された赤字は、相手の返事が来るまで。そのあとは黒に戻る
  const t = x.stamp ? '' : strip(x.t);
  L.msgs.push({who: 'them', text: t, full: t, stamp: x.stamp, time: clock(724 + L.n++ / 2), popT: now()});
  await beat(S, 300);
}
// 選ぶ（指で文字は打たない。選んだ文が、そのまま入力欄に入る）。時間切れは、先頭（左端／いちばん上）が確定する（S のキーが、来場者の指を押し上げる）
//   ① 予測変換：キーボードの変換候補の帯（L.bar）
//   ②〜④ 返信提案：入力欄の上に開く AI の提案（L.sheet）。入力欄の下の「返信提案」が押された見た目になる。選んだ文は、来場者の指が打つ
const BAR_KS = () => [...BAR_KEYS].map(c => 'asdfjkl;'.indexOf(c));
async function pickInto(S, L, options, readMs) {   // 選ぶ（options は 漢字{よみ} のままでよい。画面と入力欄には漢字だけ）
  const r = await choose(S, {options: options.map(strip), keys: BAR_KEYS, fallback: 0, bar: true, readMs});
  if (r.picked < 0) { await beat(S, 200); await strikeWait(S, BAR_KS()[0], P.len + 60); }   // 時間切れ：先頭のキーが、指を押し上げて確定させる
  await beat(S, 150);
  return r.final;
}
async function barPick(S, L, {prefix, cands}, readMs = BAR.readMs) {   // ① 予測変換：指が読みを打つ（変換前の字として下線つきで残る）→ その変換候補から選ぶ
  const f = L.input;
  S.typing = f;
  await typeMe(S, f, plan(prefix), {speed: 1.0, typos: false}); f.comp = f.text; f.text = ''; f.full = f.comp;
  await beat(S, 300);
  L.bar = {cands: cands.map(strip), ks: BAR_KS(), t0: now()};
  await beat(S, BAR.showMs);   // ふつうの予測変換として、候補だけが出ている間。番号と「まだキーは押さないでください」は、そのあと
  const j = await pickInto(S, L, cands, readMs);
  f.text = f.full = strip(cands[j]); f.comp = '';   // 予測変換：選んだ候補が、そのまま入力欄に入る（指では打たない）
  L.bar = null;
  await beat(S, 250);
  return j;
}
async function aiAutoOn(S, L) {   // おまかせ返信：入力欄の下の「おまかせ返信」がタップされる（一瞬沈んで光り、タップの丸）→ 離れて、指が打ちはじめる
  await beat(S, 400);
  L.chip = LN.autoChip; L.chipT = now();
  await beat(S, 450);
  L.chip = null; L.tapOff = {label: LN.autoChip, t: L.chipT};   // ボタンは元に戻る（タップの丸だけ、消えきるまで残る）
  await beat(S, 500);
}
async function aiAutoType(S, L, text, speed) {   // おまかせ返信：選ばせずに、AI が書いた返信を来場者の指が打つ
  S.typing = L.input;
  await typeMe(S, L.input, plan(text), {speed, frenzy: true, typos: false});
  await beat(S, 200);
}
async function aiPick(S, L, items) {   // 返信提案：入力欄の下の「返信提案」が押され、AI の提案が開く
  S.typing = L.input;
  if (!L.aiOn) { L.aiOn = now(); await beat(S, 900); }   // 最初の返信提案の前に、AI のボタンの列が出てくる
  L.chip = LN.suggest; L.chipT = now();
  await beat(S, 500);
  L.sheet = {kind: 'reply', title: LN.suggest, items: items.map(strip), t0: now()};
  await beat(S, 700);
  const j = await pickInto(S, L, items, BAR.aiReadMs);
  await beat(S, 450);
  L.sheet = null; L.chip = null;
  await beat(S, 300);
  await typeMe(S, L.input, plan(items[j]), {speed: 1.1, typos: false});   // 返信提案：選んだ文を、来場者の指が打つ
  await beat(S, 200);
  return j;
}
// 送信：右小指の Enter で、送信ボタンが押される
async function lineSend(S, L) {
  const f = L.input;
  L.bar = null;
  await beat(S, SEND_PAUSE);
  await enter2(S, () => { L.sendT = now(); });
  S.typing = null;
  L.msgs.push({who: 'me', text: f.text, full: f.text, read: false, time: clock(724 + L.n++ / 2), popT: now()});
  Object.assign(f, field());
  await beat(S, 300);
}
async function sceneLine(S) {
  const L = S.line, D = LN;
  const them = async (t, wait = 2200) => { await lineIn(S, L, {t, wait}); return strip(t).length * (LANG === 'en' ? 0.45 : 1); };
  const read = n => beat(S, 600 + 40 * n);   // 相手の文を読む間
  mark(S, 'L1');   // ① 予測変換：自分で選べる
  await beat(S, 1000);
  L.fieldTapT = now(); S.typing = L.input;   // 入力欄がタップされ、カーソルが点滅しはじめる（タップの丸は、通知のタップと同じ）
  await beat(S, 5000);   // カーソルが出てから、トーク履歴を読んで状況をつかむ間をおいて、「な」を打ちはじめる
  await barPick(S, L, D.greet, BAR.firstReadMs);
  await lineSend(S, L);
  mark(S, 'L2');   // ② 返信提案：AI が書いた返信から選ぶ（まだどれもまとも）
  let n = 0;
  for (const t of D.cancel) n = await them(t, 2400);
  await read(n);
  await aiPick(S, L, D.reply1);
  await lineSend(S, L);
  mark(S, 'L3');   // ③ 返信提案（3つともギスギス）
  n = await them(D.tickets, 2400);
  await read(n);
  const j = await aiPick(S, L, D.reply2);
  await lineSend(S, L);
  mark(S, 'L3:' + j);
  for (const t of D.after[j]) n = await them(t, 2200);
  await read(n);
  mark(S, 'L4');   // ④ おまかせ返信：返信のたびに「おまかせ返信」が押され、選ばせずに、AI の返信を指が打つ（3回。だんだん速く）
  for (const [i, text] of D.auto.entries()) {
    await aiAutoOn(S, L);
    await aiAutoType(S, L, text, p => 1.1 + 0.35 * i + 0.4 * p);
    await lineSend(S, L);
    if (i < D.between.length) { n = await them(D.between[i], 1800); await beat(S, 400 + 30 * n); }
  }
  await them(D.end, 3000);
  await beat(S, 1600);
}

// 下書きが、deleteキー（右小指）の連打で消される。1打ごとに消える量が増える
async function mash(S, X) {
  const total = X.text.length, gap = Math.max(GAP() + 5, 150) / Math.min(1, P.spd);   // 右小指の限界の速さで連打
  const N = clamp(Math.round(2100 / gap), 8, 14);
  const wt = Array.from({length: N}, (_, i) => Math.pow(i + 1, 1.5)), sum = wt.reduce((a, b) => a + b, 0);
  let left = total;
  for (let i = 0; i < N; i++) {
    strike(7);
    const n = i === N - 1 ? left : Math.min(left, Math.max(1, Math.round(total * wt[i] / sum)));
    left -= n;
    X.text = X.text.slice(0, X.text.length - n);
    await wait(S, gap);
  }
  X.text = '';
}

// 下書きは、時間に収めるため36字ほどまで（句点で切る）。最初の1文は必ず入れる。18字に満たなければ、次の文も入れる（48字まで）。英語は字数がおよそ3倍
function trimDraft(src, max = 36, min = 18, hard = 48) {
  const out = []; let n = 0, k = LANG === 'en' ? 3 : 1;
  max *= k; min *= k; hard *= k;
  for (const s of String(src).match(LANG === 'en' ? /[^.!?]+[.!?]*\s*/g : /[^。！？]+[。！？]?/g) || [src]) {
    const len = [...strip(s)].length;
    if (out.length && (n + len > hard || (n >= min && n + len > max))) break;
    out.push(s); n += len;
  }
  return out.join('').trim();
}

// 辛口の感想は、REVIEWS を上から順番に使う（ランダムにしない：同じものが近くに並ばないように）。次の番号はブラウザに保存する
const reviewKey = () => LANG === 'en' ? 'kc-dlg-review-en' : 'kc-dlg-review';   // 次の番号は、言語ごとに保存する
function nextReview() {
  let i = parseInt(lsGet(reviewKey()) ?? '0', 10);
  if (!Number.isFinite(i) || i < 0) i = 0;
  i %= REVS.length;
  lsSet(reviewKey(), String((i + 1) % REVS.length));
  return {i, src: REVS[i]};
}
// 最後のインストラクター：Xに投稿することを伝え、星を聞く（3択：星1・星3・星5。どれを押しても、星1になる）
async function stepToX(S) {
  await say(S, TX.toX, {after: 700});   // 投稿されることは、待機画面で伝えてある（同意した人だけが始める）
  const drafts = Object.fromEntries(STAR_CHOICES.map(n => [n, llm(S, LANG === 'en' ? 'review_en' : 'review', {stars: n})]));   // 星を選んでいるあいだに、どの星の下書きもつくっておく
  await say(S, TX.askStars, {keep: true, after: 300});
  mark(S, 'q:askStars');
  const r = await choose(S, {options: STAR_CHOICES.map(n => '★'.repeat(n) + '☆'.repeat(5 - n) + tr('　星' + n, `  ${n} star${n > 1 ? 's' : ''}`)), forced: STAR_CHOICES.indexOf(1), cards: true});
  await wait(S, 300);
  clearCli(S);
  const stars = STAR_CHOICES[r.picked >= 0 ? r.picked : r.final];
  return {stars, draftP: drafts[stars]};   // X の画面は、押した星から始まり、あとで勝手に星1にされる
}
// X：押した星のまま、その星に合った下書きが打たれ、右小指の連打で消され、星1になり、ひどい感想が高速で打たれて、「ポストする」が押される
async function stepX(S, stars, draftP) {
  const X = S.x = {k: 'x', stars, ...field(), press: 0, scroll: 0};
  await beat(S, 700);
  await slide(S, X, 1);
  clearCli(S, true);
  const r = await ok(S, draftP);
  const draft = r && r.text && strip(r.text).length >= tr(18, 40) ? trimDraft(r.text) : DRAFTS[stars] || DRAFTS[5];
  mark(S, 'x:slid');
  await beat(S, 500);
  S.typing = X;
  await typeMe(S, X, plan(draft), {speed: 1.3});
  S.typing = null;
  await beat(S, 500);
  mark(S, 'x:draft');
  await mash(S, X);
  mark(S, 'x:mash');
  await beat(S, 300);
  while (X.stars > 1) { X.stars--; await wait(S, 100); }
  await beat(S, 300);
  const rv = nextReview();
  mark(S, 'x:review' + rv.i);
  S.typing = X;
  await typeMe(S, X, plan(rv.src), {speed: REVIEW_SPEED, frenzy: true, typos: false});   // 速く。戻りきらない指は待たない
  await beat(S, SEND_PAUSE);   // 打ち終えてから、送るまでの少しの間
  X.press = now(); await enter2(S);   // 「ポストする」
  S.typing = null;
  // 撮影：カメラの使用を許可するか聞かれ、勝手に「許可」→ 手元の映像 → シャッター。その写真が投稿に付く
  phase(S, 'shot');
  await beat(S, 700);
  X.perm = now();
  await beat(S, 1500);
  await enter2(S, () => { X.allowT = now(); });   // 「許可」が、右小指の Enter で押される
  await beat(S, 350);
  X.perm = 0; X.cam = now();
  await beat(S, 2200);
  X.still = freezeCamera(); X.flash = now();   // シャッター：白く光り、その瞬間の映像が止まる
  const img = await ok(S, window.KC_POST.capture());
  await beat(S, 1300);
  await stepPost(S, X.text, X.stars, img);
}

// Xへの投稿と、そのあとの画面（本編と同じ流れ。post.js。X の画面は白地のまま）：ポストの確認 → 掲載を許可する（Enter を2回）→ 公開中（server.mjs から実際に投稿）
// → 問いかけ「この投稿を書いたのは、誰…？」→ Who typed?（作品名が打たれる）→ 終了（QR）
const el = id => document.getElementById(id);
async function stepPost(S, review, rating, img) {
  const KP = window.KC_POST, CF = KP.CONFIG, posts = KP.buildPosts(review, rating);
  phase(S, 'confirm');
  KP.show(7, `<div class="eyebrow">${tr('ポストの確認', 'Review your post')}</div><h1>${tr('以下の内容が、あなたの感想としてXに投稿されます。', 'The following will be posted to X as your review.')}</h1><div class="thread scroll" id="kp-thread">${KP.threadHTML(posts, img)}</div><div class="action center"><button class="primary" id="kp-permit">${tr('掲載を許可する', 'Allow posting')}</button></div>`, 'compact');
  KP.fillThread('#kp-thread', posts);
  at(1500, () => KP.autoScroll(el('kp-thread'), CF.previewMs * 0.6));
  await wait(S, CF.previewMs);
  el('kp-permit')?.classList.add('pressed'); await enter2(S); el('kp-permit')?.classList.remove('pressed');
  phase(S, 'posting');
  KP.show(8, `<div class="center"><div class="spinner" id="kp-spin"></div><div class="eyebrow">${tr('投稿を処理しています', 'Processing your post')}</div><h1 id="kp-posting">${tr('展示用アカウントへ投稿しています…', 'Posting to the exhibit account…')}</h1><p class="lead">${tr('そのままお待ちください。', 'Please wait a moment.')}</p></div>`);
  const want = KP.wantPost(), job = want ? KP.submitPost({sessionId: S.sid, rating, texts: posts, image: img}) : Promise.resolve(false);
  if (!want) KP.showPostResult({ok: false, error: '公開しないセッション'});
  await wait(S, CF.postingMs);
  const posted = await ok(S, job);
  el('kp-spin')?.remove();
  if (el('kp-posting')) el('kp-posting').textContent = KP.phraseBreak(want && KP.wantPost() ? (posted ? tr('投稿が完了しました。', 'Your post is live.') : tr('投稿を完了できませんでした。スタッフにお声がけください。', "We couldn't complete your post. Please ask a staff member.")) : tr('このセッションは公開されません。', 'This session will not be posted.'));
  await wait(S, 1000);
  phase(S, 'ask');
  KP.show(9, `<div class="ask"><div class="ask-l"><div class="rule"></div><h1 class="who">${tr('この投稿を書いたのは、<br>誰…？', 'Who wrote<br>this post…?')}</h1></div><div class="thread scroll" id="kp-ask">${KP.threadHTML(posts, img)}</div></div>`);
  KP.fillThread('#kp-ask', posts);
  at(1500, () => KP.autoScroll(el('kp-ask'), CF.askMs * 0.8));
  await wait(S, CF.askMs);
  KP.hide();
  await stepTitle(S);
  phase(S, 'thanks');
  const url = CF.xAccountUrl;
  KP.show(10, `<div class="center thanks"> <img class="qr" alt="${tr('展示用XアカウントのQRコード', 'QR code for the exhibit X account')}" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}"><a class="final-link" href="${url}" target="_blank" rel="noopener">${url}</a><div class="rule"></div><h1>${tr('ありがとうございました', 'Thank you')}</h1><p class="lead">${tr('あなたの投稿したポストは、上のQRコードからご覧いただけます。<br>体験は以上です。キーボードから手を離してください。', "You can see your post with the QR code above.<br>That's the end of the experience. Please take your hands off the keyboard.")}</p></div>`);
  await wait(S, CF.endMs);
}
// タイトル回収：画面がぷつりと切り替わり、点滅するカーソルのあとに「Who typed?」が1文字ずつ打たれる（その文字のキーを、来場者の指が打つ）
async function stepTitle(S) {
  phase(S, 'title');
  const T = S.title = {k: 'title', text: '', t0: now()};
  S.scr = T;
  await wait(S, 1300);
  for (const ch of TITLE) {
    if (ch === ' ') { T.text += ch; await wait(S, rand(260, 380)); continue; }
    const lo = ch.toLowerCase();
    if (ch !== lo) { await strikeWait(S, 7, P.len + 40); await wait(S, 70); }   // 大文字は Shift（右小指）といっしょに
    await strikeWait(S, fingerOf(lo), P.len + 40);
    T.text += ch; T.lastT = now();
    await wait(S, rand(170, 300));
  }
  await wait(S, 2200);
  await strikeWait(S, 7, P.len + 90);   // Enter（右小指）で、字もカーソルも消えて、真っ黒になる
  T.gone = now();
  await wait(S, 1800);
}


// ================= 進行 =================
// 各場面の始まりの目安（ms）。ふつうの進み方の値。これより8秒以上遅れていたら、打つテンポと間を少し速める（16秒以上なら、もう少し）
const DUE = {hands: 0, hello: 7600, howTo: 11400, toLine: 35100, line: 40200, toX: 121900, x: 132400};   // 通しの実測（11/09。LINE を開いてから5秒、状況を読む間をおく。LINE は予測変換と AI の返信提案で選ぶ構成。選ぶ場面で、すぐ押したとき）
const LATE = [8000, 16000];
const mark = (S, name) => S.tl.push([name, Math.round(now() - S.t0)]);
function phase(S, p) {
  const el = Math.round(now() - S.t0), late = DUE[p] == null ? 0 : el - DUE[p];
  S.phase = p; S.tl.push([p, el]);
  S.pace = late > LATE[1] ? 1.25 : late > LATE[0] ? 1.12 : 1;
}
function restart() { select(EXP.id); }
async function main(S) {
  const from = Math.max(0, START.indexOf(S.o.から));
  S.scr = S.cli;
  if (from === 0) {
    phase(S, 'hands'); S.scr = {k: 'hands', t0: now()}; await wait(S, HANDS_MS);   // 2枚目：指の置き方
    S.scr = S.cli; await beat(S, 600); phase(S, 'hello'); await stepHello(S);
    phase(S, 'howTo'); await stepHowTo(S);   // 選び方の練習
  }
  if (from <= 1) {
    // スマホの通知（鈴木の最初のセリフ）から、LINE に入る（語り手は出さない）
    phase(S, 'toLine'); S.line = newLine();
    for (const h of LN.history) S.line.msgs.push(h.sep ? {sep: h.sep, text: '', full: ''} : {who: h[0], text: h[1], full: h[1], time: h[2], read: true, popT: 0});   // それまでのトーク履歴
    S.line.msgs.push({who: 'them', text: LN.open, full: LN.open, time: clock(724 + S.line.n++ / 2), popT: 0});   // 鈴木の最初のセリフは、もう届いている
    await beat(S, 500); S.notif = {t0: now(), name: S.line.name, text: LN.open};
    await beat(S, 900); await say(S, TX.notice, {keep: true, after: 700});   // 「おや、通知が来ましたね。」
    S.notif.tapT = now(); await beat(S, 650);   // 通知がタップされる（押した見え方と、タップの丸）
    await slide(S, S.line, 1); clearCli(S, true); S.notif = null;
    phase(S, 'line'); await sceneLine(S);
    await slide(S, S.cli, -1);
    await say(S, TX.afterLine, {after: 900});
  }
  phase(S, 'toX'); const q = await stepToX(S);
  phase(S, 'x'); await stepX(S, q.stars, q.draftP);
  phase(S, 'end'); await wait(S, 600);
  restart();
}
function begin(S) {
  if (S.running || S.dead) return;
  const KP = window.KC_POST;
  stopBeat(S);
  S.sid = KP.newSession();
  if (!KP.hasCamera()) KP.startCamera();   // 手元のカメラ（X の場面で映し、投稿の写真にする）
  audio();
  Object.assign(S, {running: true, t0: now(), tl: [], pace: 1});
  renderHead();
  main(S).catch(e => {
    if (e === ABORT) return;
    console.error(e);
    status('対話の進行でエラー: ' + (e.message || e) + '（最初に戻ります）', 5000);
    if (live(S)) at(3000, restart);
  });
}
// 待機：F を2秒上げ、5秒下げて休ませる、をくり返す。上がっているあいだに押し込まれたら始まる（選ぶ場面と同じ押し込みの読み方）。
// 長押し（押さえているかの判定）は、実機で安定しなかったのでやめた
function startBeat(S) {
  stopBeat(S);
  const KI = window.KC_INPUT;
  const up = () => { if (S.dead || S.running) return; if (paused) { S.beatTimer = setTimeout(up, 500); return; }
    S.wakeUp = true; S.beatT = now(); KI.listen('f'); S.beatTimer = setTimeout(down, WAKE_UP_MS);
    KI.calm(true); S.calmTimer = setTimeout(() => { if (S.wakeUp) KI.calm(false); }, WAKE_SETTLE_MS); };   // 受け付けるまでは、画面のキーも淡いまま
  const down = () => { S.wakeUp = false; KI.calm(true); KI.listen(0); KI.guide('f'); if (S.dead || S.running) return; S.beatTimer = setTimeout(up, WAKE_SLEEP_MS); };
  KI.guide('f'); KI.calm(true);   // 画面の F のキーは、受け付けているあいだだけ明るく
  S.beatTimer = setTimeout(up, 800);
}
function stopBeat(S) { clearTimeout(S.beatTimer); clearTimeout(S.calmTimer); S.beatTimer = 0; S.wakeUp = false; window.KC_INPUT?.calm(false); window.KC_INPUT?.listen(0); window.KC_INPUT?.guide(0); window.KC_INPUT?.labels(null); }   // 選ぶ場面の途中でやめても、キーの番号（①②③）を残さない
function quit(S) {
  S.dead = true;
  stopBeat(S);
  removeEventListener('keydown', S.onKey);
  removeEventListener('kc-press', S.onPress);
  removeEventListener('kc-down', S.onDown);
  window.KC_INPUT?.listen(0);
  window.KC_POST?.hide();
}

// ================= 描画 =================
// インストラクターの画面は、白い紙に、いまの台詞だけ。アプリの画面（ブラウザ・LINE・X）は、ロゴや本物の文言を使わず、
// 配置と色だけをそれっぽくした画面。キーの台は本体の暗い色のまま
const NOHEAD = '、。，．・！？!?)」』）…ー,.';   // 行頭に置かない字
const widths = new Map();
function cw1(ch) {
  const k = g.font + ch;
  let w = widths.get(k);
  if (w == null) { w = g.measureText(ch).width; widths.set(k, w); }
  return w;
}
// 折り返し：文節（本編と同じ区切り。post.js の phraseBreak）の間だけで折る。1行に入りきらない塊だけは、字の間で折る（行頭に句読点を置かない）。
// balance：文の終わり（なければ読点）のところだけで折っても行数が増えなければ、そこで折る。そうでなければ、行の長さをそろえる（短い文・吹き出し・選択肢）
const textW = str => { let w = 0; for (const ch of str) w += cw1(ch); return w; };
const phrases = str => LANG === 'en' ? str.split(/(?<= )/) : (window.KC_POST ? window.KC_POST.phraseBreak(str) : str).split('\u200b');   // 英語は語ごと（空白のあと）
function greedy(parts, maxW) {
  const out = []; let cur = '', w = 0;
  for (const p of parts) {
    const pw = textW(p);
    if (cur && w + pw > maxW) { out.push(cur); cur = ''; w = 0; }
    if (pw <= maxW) { cur += p; w += pw; continue; }
    for (const ch of p) { const c = cw1(ch); if (cur && w + c > maxW && !NOHEAD.includes(ch)) { out.push(cur); cur = ''; w = 0; } cur += ch; w += c; }
  }
  out.push(cur);
  return out;
}
const wraps = new Map();
function wrapLines(str, maxW, balance = false) {
  const key = g.font + '|' + maxW + '|' + balance + '|' + str;
  let out = wraps.get(key);
  if (out) return out;
  const parts = phrases(str), base = greedy(parts, maxW);
  out = base;
  if (balance && base.length > 1) {
    out = null;
    for (const re of LANG === 'en' ? [/(?<=[.!?] )/, /(?<=[,.!?] )/] : [/(?<=[。！？!?])/, /(?<=[、。！？!?])/]) {   // まず文の終わり、次に読点のところだけで折ってみる
      const segs = str.split(re);
      if (segs.length < 2 || !segs.every(x => textW(x) <= maxW)) continue;
      const l = greedy(segs, maxW);
      if (l.length <= base.length) { out = l; break; }
    }
    if (!out) {   // 行の長さをそろえる：行数が増えない、いちばん狭い幅で折る
      let lo = maxW * 0.35, hi = maxW;
      for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (greedy(parts, mid).length > base.length) lo = mid; else hi = mid; }
      out = greedy(parts, hi);
    }
  }
  if (wraps.size > 400) wraps.clear();
  wraps.set(key, out);
  return out;
}
function lay(it, size, maxW, font = FONT, balance = false) {   // 折り返しは、全文（it.full）で決める。打つ途中で行がずれない。文や幅が変わったときだけ計算する
  const full = it.full ?? it.text, k = font + size + '|' + maxW + '|' + balance + '|' + full;
  if (it._k !== k) {
    g.font = `500 ${size}px ${font}`;
    let acc = 0;
    it._lines = wrapLines(full, maxW, balance).map(s => { const o = {s, start: acc}; acc += s.length; return o; });
    it._k = k;
  }
  return it._lines;
}
function curLine(it, lines) {   // 次に打つ字がある行（それより下の行は、まだ出さない）
  const n = it.text.length, i = lines.findIndex(ln => n >= ln.start && n < ln.start + ln.s.length);
  return i < 0 ? lines.length - 1 : i;
}
// 変換前の字（ひらがな）と、打っている途中のローマ字：同じ黒で、下線つき（変換したあとは太い下線）。行に入りきらなければ、次の行へ続ける
function drawTail(it, x, y, size, lh, x0, maxX) {
  const tail = (it.comp || '') + (it.pend || '');
  if (!tail) return [x, y];
  const segs = []; let s = '', sx = x, sy = y, w = 0;
  for (const ch of tail) {
    const c = cw1(ch);
    if (s && sx + w + c > maxX) { segs.push([s, sx, sy, w]); s = ''; sx = x0; sy += lh; w = 0; }
    s += ch; w += c;
  }
  segs.push([s, sx, sy, w]);
  g.fillStyle = it.text.length >= (it.redFrom ?? Infinity) ? RED : INK;   // 打ち足されている途中の字は赤
  segs.forEach(([str, px, py, pw]) => { g.fillText(str, px, py); g.fillRect(px, py + size * 0.62, pw, it.conv ? 3 : 1.5); });
  const e = segs[segs.length - 1];
  return [e[1] + e[3], e[2]];
}
const mixHex = (a, b, p) => '#' + [0, 2, 4].map(i => Math.round(parseInt(a.substr(i + 1, 2), 16) * (1 - p) + parseInt(b.substr(i + 1, 2), 16) * p).toString(16).padStart(2, '0')).join('');
const redOf = it => it.redOff ? mixHex(RED, INK, clamp((now() - it.redOff) / 800, 0, 1)) : RED;   // 赤字は、redOff から黒に戻っていく
function drawBlock(it, x, y, size, lh, lines, caret, font = FONT, maxX = Infinity) {   // 確定した字は黒（redFrom から後ろは赤）。その後ろに、変換前の字とローマ字
  g.font = `500 ${size}px ${font}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  const n = it.text.length, ci = curLine(it, lines), rf = it.redFrom ?? Infinity;
  let ex = x, ey = y + lh / 2;
  for (let i = 0; i <= ci; i++) {
    const ln = lines[i], black = ln.s.slice(0, clamp(n - ln.start, 0, ln.s.length)), yy = y + i * lh + lh / 2;
    const a = black.slice(0, clamp(rf - ln.start, 0, black.length)), b = black.slice(a.length);
    g.fillStyle = INK; if (a) g.fillText(a, x, yy);
    if (b) { g.fillStyle = redOf(it); g.fillText(b, x + (a ? g.measureText(a).width : 0), yy); }
    if (i === ci) { ex = x + (black ? g.measureText(black).width : 0); ey = yy; }
  }
  const [cx, cy] = drawTail(it, ex, ey, size, lh, x, maxX);
  if (caret) { g.fillStyle = INK; g.fillRect(cx + 3, cy - size * 0.55, 2, size * 1.1); }
}
const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const ease3 = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeBack = p => 1 + 2.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2);   // 少し行きすぎて戻る（ぽんっ）
const caretOn = t => Math.floor(t / 450) % 2 === 0;
const popOf = (m, t, ms = 280) => m.popT ? clamp((t - m.popT) / ms, 0, 1) : 1;
// 1行の入力欄：入りきらないときは、字を小さくする（打っている途中で大きくはならない）
function drawField(it, x, y, w, h, size, caret, font = FONT) {
  const full = it.full ?? '';
  g.font = `500 ${size}px ${font}`;
  const wf = Math.max(full ? g.measureText(full).width : 0, g.measureText(it.text + (it.comp || '') + (it.pend || '')).width);
  let k = wf > w ? clamp(w / wf, 0.55, 1) : 1;
  if (it._fkey === full) k = Math.min(k, it._fk);
  it._fkey = full; it._fk = k;
  drawBlock(it, x, y + h / 2 - size * k * 0.8, size * k, size * k * 1.6, [{s: full, start: 0}], caret, font);
}

// ---- インストラクターの画面（ホーム）：台詞は画面の中ほどに、ふわっと浮かび上がる。来場者の答えはその下に打ち込まれる。消えるときは、ふっと上へ ----
const FADE = 650;
function drawCli(S, C, t, dt, pb) {
  const fs = S.fs, maxW = Math.min(W * 0.84, fs * 26);
  C.gone = C.gone.filter(it => t - it.out < FADE);
  for (const it of [...C.gone, C.inst, C.me]) {
    if (!it) continue;
    const q = it.out ? clamp((t - it.out) / FADE, 0, 1) : 0, inst = it.who === 'inst';
    const size = fs * (inst ? 1.15 : 0.95) * (it.scale || 1), cy = (inst ? pb * 0.38 : pb * 0.62) - easeOut(q) * fs * 0.6;
    drawFloat(S, it, t, W / 2, cy, size, maxW, 1 - q);
  }
}
const RISE = 600;   // 1文字が浮かび上がりきるまで（ms）
function drawFloat(S, it, t, cx, cy, size, maxW, a) {
  const lh = size * 1.6, lines = lay(it, size, maxW, FONT, true), y0 = cy - lines.length * lh / 2, n = it.text.length, ci = curLine(it, lines);
  g.font = `500 ${size}px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = INK;
  let ex = cx, ey = y0 + lh / 2, x0 = cx;
  for (let i = 0; i <= ci; i++) {
    const ln = lines[i], yy = y0 + i * lh + lh / 2;
    let x = cx - [...ln.s].reduce((s, ch) => s + cw1(ch), 0) / 2;   // 全文で中央をそろえる（打つ途中で行がずれない）
    if (i === ci) x0 = x;
    const black = ln.s.slice(0, clamp(n - ln.start, 0, ln.s.length));
    if (it.ct) [...black].forEach((ch, j) => {   // 1文字ずつ、下から少し浮かび上がりながら現れる
      const e = easeOut(clamp((t - it.ct[ln.start + j]) / RISE, 0, 1));
      g.globalAlpha = a * e; g.fillText(ch, x, yy + (1 - e) * size * 0.45); x += cw1(ch);
    });
    else if (black) { g.globalAlpha = a; g.fillText(black, x, yy); x += textW(black); }
    if (i === ci) { ex = x; ey = yy; }
  }
  g.globalAlpha = a;
  const [kx_, ky_] = drawTail(it, ex, ey, size, lh, x0, cx + maxW / 2);
  if (S.typing === it && caretOn(t)) g.fillRect(kx_ + 3, ky_ - size * 0.55, 2, size * 1.1);
  g.globalAlpha = 1;
}


// ---- 選ぶ場面：キー（S D F）の上に選択肢。中央に「読んでください／選んでください」とタイマー ----
function badge(x, y, s, a = 1, n = 0) {   // オレンジの丸の札に、選択肢の番号（①②③）。画面下のキーにも、同じ番号が出る（キーの文字は出さない）
  if (!(s > 0)) return;   // 出はじめ（大きさ 0）
  g.globalAlpha = a;
  g.fillStyle = ORANGE; g.beginPath(); g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); g.fill();
  if (n) { g.fillStyle = '#1a0e00'; g.font = `800 ${s * 0.62}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), x + s / 2, y + s / 2 + 1); }
  g.globalAlpha = 1;
}
// 1文字ずつ、下から少し浮かび上がる（インストラクターの台詞と同じ出方）。t0 は出はじめた時刻
function floatLine(str, cx, cy, size, color, t0, t, a = 1, weight = 500) {
  g.font = `${weight} ${size}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = color;
  let x = cx - textW(str) / 2;
  [...str].forEach((ch, i) => {
    const e = easeOut(clamp((t - t0 - i * 28) / 420, 0, 1));
    g.globalAlpha = a * e; g.fillText(ch, x, cy + (1 - e) * size * 0.4); x += cw1(ch);
  });
  g.globalAlpha = 1;
}
// 選ぶ場面：選択肢は、紙の下のほうに文字だけで並ぶ。選ぶ間（select）だけ、オレンジの札と、札からキーへの線が出る。
// 中央に、いま何をするか（読む／選ぶ）と、細い線のタイマー。選んだものは、黄緑に光る枠で囲む
function drawChoice(S, C, t, pb) {
  const fs = S.fs, n = C.options.length;
  const inA = clamp((t - (C.born ??= t)) / 300, 0, 1), outA = C.stage === 'out' ? 1 - clamp((t - C.t0) / 300, 0, 1) : 1, A = inA * outA;
  if (C.bar) {   // LINE：選択肢は変換候補の帯（drawLine が描く）。ここでは、入力欄の上に、星の3択と同じ「いま何をするか」だけを出す（下地に白をなだらかに）
    if (C.cards) {   // インストラクターの画面で選ぶとき（選び方の練習・星）：LINE の返信提案と同じ3枚のカード
      const ch = fs * 2.9, w = Math.min(W * 0.84, fs * 34), y = pb - fs * 1.0 - ch;
      drawCardRow(S, C, C.options, t, (W - w) / 2, y, w, ch, A);
      C.msgY = y - fs * 1.05;
    }
    if (C.msgY == null) return;
    choicePill(S, C, t, A, C.msgY);   // 背景は白くしない。選ぶ場所のすぐ上に、天の声（にじんだ色の光）
    return;
  }
  // 下のほうを白くぼかす（箱ではなく、なだらかに）
  const vTop = pb - fs * 7.2, vMid = vTop + fs * 1.6;
  const gr = g.createLinearGradient(0, vTop, 0, vMid); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,255,255,${0.95 * A})`);
  g.fillStyle = gr; g.fillRect(0, vTop, W, vMid - vTop); g.fillStyle = `rgba(255,255,255,${0.95 * A})`; g.fillRect(0, vMid, W, pb - vMid);
  // 選択肢
  const size = fs * 0.8, bs = fs * 1.0, gap = fs * 0.45, colW = n === 1 ? Math.min(W * 0.6, fs * 20) : Math.min(W * 0.31, fs * 12.5), x0 = (W - colW * n) / 2, rowY = pb - fs * 1.75;
  const spots = C.options.map((o, j) => {
    g.font = `800 ${size}px ${FONT}`;
    const lines = wrapLines(o, colW - bs - gap - fs * 0.6, true), tw = Math.max(...lines.map(textW)), bw = bs + gap + tw;
    const bx = x0 + colW * (j + 0.5) - bw / 2, lh = size * 1.4, ty = rowY - (lines.length - 1) * lh / 2;
    return {lines, tw, bx, tx: bx + bs + gap, ty, lh, k: C.ks[j]};
  });
  const sel = C.stage === 'select', show = sel || C.stage === 'read', pin = show ? clamp((t - C.born) / 280, 0, 1) : 0;   // 札（①②③）は、読む段階から出る。選ぶ間だけ脈打つ
  spots.forEach((p, j) => {
    const look = cardLook(C, j, t);
    if (show) {
      g.globalAlpha = A * (sel ? 0.55 : 0.22) * pin; g.strokeStyle = ORANGE; g.lineWidth = 1.5;   // 札から、そのキーへ（読む間は淡く）
      g.beginPath(); g.moveTo(p.bx + bs / 2, rowY + bs / 2 + 2); g.lineTo(kx(p.k), pb + 1); g.stroke();
      // 読む間：小さく淡い札（対応だけを示す）。選ぶ時間に入った瞬間、ぽんっと大きくなって脈打つ
      const s2 = sel ? bs * (0.8 + 0.2 * easeBack(clamp((t - C.t0) / 280, 0, 1))) : bs * 0.8 * easeBack(pin);
      badge(p.bx + (bs - s2) / 2, rowY - s2 / 2, s2, A * Math.min(1, pin * 2) * (sel ? 0.75 + 0.25 * Math.sin(t / 170) : 0.4), j + 1);
    }
    if (look.lime > 0) {   // 選んだもの：黄緑に光る枠
      const px = fs * 0.4, py = fs * 0.28, h = p.lines.length * p.lh;
      g.save(); g.globalAlpha = A * look.lime; g.shadowColor = LIME; g.shadowBlur = fs * 0.7;
      g.strokeStyle = LIME; g.lineWidth = Math.max(3, fs * 0.12); rr(p.tx - px, p.ty - p.lh / 2 - py, p.tw + px * 2, h + py * 2, fs * 0.35); g.stroke(); g.restore();
    }
    g.globalAlpha = A;
    g.fillStyle = INK; g.font = `800 ${size}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';   // 選択肢は太字
    p.lines.forEach((ln, i) => g.fillText(ln, p.tx, p.ty + i * p.lh));
    g.globalAlpha = A;
  });
  choiceMsg(S, C, t, A, pb - fs * 4.2);
}
// いま何をするかを、天の声として出す（すりガラスの黒いカプセルに、白い字）。色が状態を表す：
//   読む＝赤い点（ゆっくり明滅）「まだキーは押さないでください」（早く押すと、ゆれる）／選ぶ＝オレンジの点「選んでください」（最初の1回は「上がったキーを押して、選んでください」）と残り時間のバー／
//   決まった＝緑のチェック「選びました」「代わりに選びました」
function choicePill(S, C, t, A, y) {   // iOS のシステムの知らせ（HUD）のような、すりガラスの黒いカプセル。白い字と、状態の色の点（決まったらチェック）。選べるあいだは、字の下に残り時間のバー
  const fs = S.fs, ts = fs * 0.76, cx = C.mx ?? W / 2;
  const st = C.stage === 'read' ? 'read' : C.stage === 'select' ? 'select' : 'done';
  const msg = st === 'read' ? tr('まだキーは押さないでください', "Don't press any keys yet")
    : st === 'select' ? (C.tutorial ? tr('上がったキーを押して、選んでください', 'Press a raised key to choose') : tr('選んでください', 'Make your choice'))
    : C.picked < 0 ? tr('代わりに選びました', 'Chosen for you') : tr('選びました', 'Chosen');
  const col = st === 'read' ? '#ff453a' : st === 'select' ? '#ff9f0a' : '#30d158';   // iOS のシステムカラー（暗い地の上）
  const e = st === 'read' && C.earlyT ? clamp((t - C.earlyT) / 600, 0, 1) : 1, dx = Math.sin(e * Math.PI * 6) * fs * 0.3 * (1 - e), k = 1 + 0.06 * (1 - e);
  const pop = easeOut(clamp((t - C.t0) / 300, 0, 1)), sc = (0.96 + 0.04 * pop) * k;   // 状態が変わるたびに、ふわっと
  const p = st === 'done' || !C.dur ? 1 : Math.max(0, 1 - (t - C.t0) / C.dur);   // 残り時間
  g.font = `600 ${ts}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  const tw = g.measureText(msg).width, mk = fs * 0.44, mg = fs * 0.36, cw = mk + mg + tw;   // 点（チェック）と字を、ひとまとまりで真ん中に
  const bar = st === 'select', bh = Math.max(9, fs * 0.26), padX = fs * 0.9;
  const ph = bar ? fs * 2.25 : fs * 1.55, pw = Math.max(cw, fs * 6) + padX * 2, top = -ph, r = Math.min(ph / 2, fs * 0.65);   // 下端を y にそろえる
  g.save(); g.globalAlpha = A * (0.5 + 0.5 * pop); g.translate(cx + dx, y + fs * 0.25); g.scale(sc, sc);
  g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = fs * 0.6; g.shadowOffsetY = fs * 0.1;
  g.fillStyle = 'rgba(0,0,0,0.01)'; rr(-pw / 2, top, pw, ph, r); g.fill();
  g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.save(); rr(-pw / 2, top, pw, ph, r); g.clip();   // すりガラス：うしろの画面をぼかしてから、黒を重ねる
  const T = g.getTransform(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = `blur(${Math.round(fs * 0.5)}px) saturate(1.6)`; g.drawImage(g.canvas, 0, 0); g.filter = 'none'; g.setTransform(T);
  g.fillStyle = 'rgba(22,22,26,0.74)'; g.fillRect(-pw / 2, top, pw, ph);
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1; rr(-pw / 2 + 0.5, top + 0.5, pw - 1, ph - 1, r); g.stroke();   // ふちに、うすい光
  const ry = bar ? top + fs * 0.82 : top + ph / 2, x0 = -cw / 2, mx = x0 + mk / 2;
  if (st === 'done') {   // 決まった：緑のチェック
    g.strokeStyle = col; g.lineWidth = Math.max(2.5, fs * 0.09); g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(mx - mk * 0.42, ry + mk * 0.02); g.lineTo(mx - mk * 0.1, ry + mk * 0.32); g.lineTo(mx + mk * 0.46, ry - mk * 0.34); g.stroke();
  } else {   // 読む：赤い点（ゆっくり明滅）／選ぶ：オレンジの点
    const pulse = st === 'read' ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t / 220)) : 1;
    g.globalAlpha *= pulse; g.fillStyle = col; g.beginPath(); g.arc(mx, ry, mk * 0.36, 0, Math.PI * 2); g.fill(); g.globalAlpha /= pulse;
  }
  g.fillStyle = '#ffffff'; g.fillText(msg, x0 + mk + mg, ry + fs * 0.02);
  if (bar) {   // 残り時間：太いバー（ぼかさない）。カプセルの幅いっぱい、右から縮む
    const bw = pw - padX * 2, by = top + ph - fs * 0.55 - bh / 2;
    g.fillStyle = 'rgba(255,255,255,0.16)'; rr(-bw / 2, by, bw, bh, bh / 2); g.fill();
    g.fillStyle = col; rr(-bw / 2, by, Math.max(bh, bw * p), bh, bh / 2); g.fill();
  }
  g.restore(); g.globalAlpha = 1;
}
// いま何をするか（読む：「選択肢を読んでください」と赤い「まだキーは押さないでください」／選ぶ：「入力受付中」と「選んでください」／決まった：「選びました」）と、残り時間の線。
// 星の3択と LINE で同じ
function choiceMsg(S, C, t, A, msgY) {
  const fs = S.fs;
  const chosen = tr('選びました', 'Chosen'), forYou = tr('代わりに選びました', 'Chosen for you'), after = C.picked < 0 ? forYou : chosen;
  const msg = {read: tr('選択肢を読んでください', 'Read the options'), select: C.tutorial ? tr('上がったキーを押して、選んでください', 'Press a raised key to choose') : tr('選んでください', 'Make your choice'),
    picked: chosen, timeout: forYou, final: after, out: after}[C.stage];
  if (!msg) { g.globalAlpha = 1; return; }
  const color = INK, t0 = C.stage === 'final' || C.stage === 'out' ? -1e9 : C.t0;   // 「選びました」は出たまま
  if (C.stage !== 'read') floatLine(msg, W / 2, msgY, fs * 1.05, color, t0, t, A);
  if (C.stage === 'select') {   // 入力受付中：赤い点が脈打つ
    g.font = `600 ${fs * 0.55}px ${FONT}`; const acc = tr('入力受付中', 'Now accepting input'), w = textW(acc), x = W / 2 - (w + fs * 0.55) / 2, y = msgY - fs * 1.2;
    g.globalAlpha = A * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t / 160))); g.fillStyle = RED; g.beginPath(); g.arc(x + fs * 0.15, y, fs * 0.15, 0, Math.PI * 2); g.fill();
    g.globalAlpha = A; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(acc, x + fs * 0.55, y);
  } else if (C.stage === 'read') {   // 読む間：大きな太字の赤で「まだ押さないでください」。その上に小さく「選択肢を読んでください」。押されたら、大きくゆれる
    const e = C.earlyT ? clamp((t - C.earlyT) / 600, 0, 1) : 1, k = 1 + 0.15 * (1 - e), dx = Math.sin(e * Math.PI * 6) * fs * 0.3 * (1 - e);
    g.globalAlpha = A; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${fs * 1.25 * k}px ${FONT}`; g.fillStyle = RED; g.fillText(tr('まだキーは押さないでください', "Don't press any keys yet"), W / 2 + dx, msgY);
    g.font = `600 ${fs * 0.62}px ${FONT}`; g.fillStyle = INK; g.fillText(msg, W / 2, msgY - fs * 1.35);
  } else if (C.stage === 'read' && C.label) {
    g.globalAlpha = A * 0.7; g.font = `500 ${fs * 0.5}px ${FONT}`; g.fillStyle = '#6b6b6b'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(C.label, W / 2, msgY - fs * 1.15);
  }
  if ((C.stage === 'read' || C.stage === 'select') && C.dur) {   // タイマー：細い線が、両はしから中央へ縮んでいく
    const p = Math.max(0, 1 - (t - C.t0) / C.dur), L = Math.min(W * 0.34, fs * 13) * p;
    g.globalAlpha = A; g.fillStyle = C.stage === 'select' ? RED : INK; g.fillRect(W / 2 - L / 2, msgY + fs * 0.95, L, Math.max(2, fs * 0.07));
  }
  g.globalAlpha = 1;
}
// ---- LINE（風）：鈴木との会話。配置と色だけをそれっぽくした、ロゴのない画面 ----
function lineRows(L, size, lh, maxB) {
  return L.msgs.map(m => {
    if (m.sep) return {m, lines: [], bw: 0, bh: size * 1.1};   // 日付の区切り
    if (m.stamp) return {m, lines: [], bw: size * 5.6, bh: size * 5.6};   // スタンプ：吹き出しなし
    const lines = lay(m, size, maxB - size * 1.6, FONT, true);
    g.font = `500 ${size}px ${FONT}`;
    const w = Math.max(...lines.map(ln => g.measureText(ln.s).width));
    return {m, lines, bw: Math.max(size * 1.7, w + size * 1.6), bh: lines.length * lh + size * 1.0};
  });
}
// ---- LINE（iPad 版・横向き。外付けキーボードで打つ）：上に iPad の時刻と電池、左にトーク一覧、右にトーク。ロゴは使わない ----
// 予測変換は、外付けキーボードのときと同じく、画面の下に浮いた角丸の帯
// トーク一覧（鈴木のほか）：[名前, 最後の文, 時刻, 未読, アイコン]。グループは、名前の右に人数（例：(6)）
const LINE_LIST_JA = [['大野恵子', '明日雨らしいよ。傘忘れずにね', '11:52', 0, 'mom'], ['Yuu', '了解！また連絡するね', '昨日', 0, 'yui'], ['3年7組', '写真送ります', '昨日', 0, 'hs', 31],
  ['Takashi', 'スタンプを送信しました', '昨日', 0, 'takashi'], ['上村研M1', '明日の資料共有します！', '月曜', 0, 'groupDefault', 5], ['はるか', 'ありがとう〜！', '11/7', 0, 'haruka'],
  ['田中健太', '了解です', '11/6', 0, 'tanaka'], ['バスケ部 72回生', '次の集まりの日程です', '11/5', 0, 'bball', 23], ['山本 けんた', 'また今度！', '11/3', 0, 'yamamoto'], ['なかむら', 'おけ', '11/1', 0, 'nakamura']];
const LINE_LIST_EN = [['Keiko Ono', 'Rain tomorrow. Take an umbrella', '11:52', 0, 'mom'], ['yui', 'Got it! Talk soon', 'Yesterday', 0, 'yui'], ['Class 3-7', 'Sending the photos', 'Yesterday', 0, 'hs', 31],
  ['Takashi', 'Sent a sticker', 'Yesterday', 0, 'takashi'], ['Uemura Lab M1', "Sharing tomorrow's slides", 'Mon', 0, 'groupDefault', 5], ['Haruka', 'Thanks!!', '11/7', 0, 'haruka'],
  ['Kenta Tanaka', 'Noted', '11/6', 0, 'tanaka'], ['Basketball Class of 2020', 'Here are the dates for the meetup', '11/5', 0, 'bball', 23], ['Kenta Yamamoto', 'Next time!', '11/3', 0, 'yamamoto'], ['nakamura', 'ok', '11/1', 0, 'nakamura']];
// アイコン：実在の LINE でよくある、ペット・景色・食べものなどの写真のような絵柄（絵文字を、色のついた地に大きく）。
// keycap_lab/avatars/<名前>.jpg（例：suzuki.jpg）を置くと、その写真に差し替わる
const AVATARS = {suzuki: [30, '🐶'], mom: [340, '🌷'], yui: [355, '🍓'], hs: [200, '🏫'], takashi: [120, '⚽'], seminar: [45, '📚'], haruka: [195, '🌊'],
  tanaka: [25, '☕'], bball: [20, '🏀'], yamamoto: [265, '🎸'], nakamura: [210, '🐈']};
const AVATAR_IMG = {};
for (const k of Object.keys(AVATARS)) { const im = new Image(); im.onload = () => { AVATAR_IMG[k] = im; }; im.src = `/keycap_lab/avatars/${k}.jpg`; }
const LINE_BG = '#8eaad6';
function ico(kind, x, y, s, color = '#2b2f36', lw = 0) {   // 線の太さのそろったアイコン（x, y は中心）
  g.save(); g.translate(x, y); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw || Math.max(1.6, s * 0.09); g.lineCap = 'round'; g.lineJoin = 'round';
  const h = s / 2;
  g.beginPath();
  if (kind === 'search') { g.arc(-h * 0.15, -h * 0.15, h * 0.55, 0, Math.PI * 2); g.moveTo(h * 0.27, h * 0.27); g.lineTo(h * 0.75, h * 0.75); g.stroke(); }
  else if (kind === 'phone') { g.moveTo(-h * 0.55, -h * 0.75); g.quadraticCurveTo(-h * 0.85, -h * 0.4, -h * 0.55, h * 0.05); g.quadraticCurveTo(-h * 0.1, h * 0.65, h * 0.55, h * 0.75); g.lineTo(h * 0.75, h * 0.4); g.lineTo(h * 0.35, h * 0.15); g.lineTo(h * 0.15, h * 0.35); g.quadraticCurveTo(-h * 0.2, h * 0.1, -h * 0.35, -h * 0.15); g.lineTo(-h * 0.15, -h * 0.35); g.lineTo(-h * 0.35, -h * 0.75); g.closePath(); g.stroke(); }
  else if (kind === 'menu') { [-0.5, 0, 0.5].forEach(k => { g.moveTo(-h * 0.7, h * k); g.lineTo(h * 0.7, h * k); }); g.stroke(); }
  else if (kind === 'plus') { g.moveTo(-h * 0.6, 0); g.lineTo(h * 0.6, 0); g.moveTo(0, -h * 0.6); g.lineTo(0, h * 0.6); g.stroke(); }
  else if (kind === 'camera') { g.roundRect(-h * 0.8, -h * 0.45, h * 1.6, h * 1.15, h * 0.2); g.moveTo(-h * 0.3, -h * 0.45); g.lineTo(-h * 0.15, -h * 0.7); g.lineTo(h * 0.15, -h * 0.7); g.lineTo(h * 0.3, -h * 0.45); g.stroke(); g.beginPath(); g.arc(0, h * 0.12, h * 0.32, 0, Math.PI * 2); g.stroke(); }
  else if (kind === 'image') { g.roundRect(-h * 0.8, -h * 0.65, h * 1.6, h * 1.3, h * 0.15); g.moveTo(-h * 0.8, h * 0.45); g.lineTo(-h * 0.25, -h * 0.1); g.lineTo(h * 0.15, h * 0.3); g.lineTo(h * 0.4, h * 0.05); g.lineTo(h * 0.8, h * 0.45); g.stroke(); }
  else if (kind === 'smile') { g.arc(0, 0, h * 0.75, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, h * 0.05, h * 0.42, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); g.beginPath(); g.arc(-h * 0.27, -h * 0.2, h * 0.08, 0, Math.PI * 2); g.arc(h * 0.27, -h * 0.2, h * 0.08, 0, Math.PI * 2); g.fill(); }
  else if (kind === 'mic') { g.roundRect(-h * 0.25, -h * 0.75, h * 0.5, h * 0.95, h * 0.25); g.stroke(); g.beginPath(); g.arc(0, -h * 0.1, h * 0.5, 0.1 * Math.PI, 0.9 * Math.PI); g.moveTo(0, h * 0.4); g.lineTo(0, h * 0.75); g.stroke(); }
  else if (kind === 'compose') { g.roundRect(-h * 0.7, -h * 0.6, h * 1.3, h * 1.3, h * 0.2); g.moveTo(-h * 0.1, h * 0.1); g.lineTo(h * 0.75, -h * 0.75); g.stroke(); }
  else if (kind === 'back') { g.moveTo(h * 0.25, -h * 0.7); g.lineTo(-h * 0.35, 0); g.lineTo(h * 0.25, h * 0.7); g.stroke(); }
  g.restore();
}
function avatar(x, y, r, key) {   // 丸いアイコン：写真があれば写真、なければ色の地に絵文字の絵柄。groupDefault は、LINE のグループの初期アイコン
  g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
  if (key === 'groupDefault') {   // グループの初期アイコン：淡い灰色の地に、白い人の形が3つ（前にひとり、うしろにふたり）
    g.fillStyle = '#d3d9e0'; g.fillRect(x - r, y - r, r * 2, r * 2);
    const person = (px, py, k) => { g.beginPath(); g.arc(px, py - r * 0.2 * k, r * 0.2 * k, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(px, py + r * 0.36 * k, r * 0.36 * k, r * 0.3 * k, 0, Math.PI, 0); g.fill(); };
    g.fillStyle = '#eef1f4'; person(x - r * 0.36, y + r * 0.02, 0.8); person(x + r * 0.36, y + r * 0.02, 0.8);
    g.fillStyle = '#d3d9e0'; g.beginPath(); g.arc(x, y + r * 0.12, r * 0.42, 0, Math.PI * 2); g.fill();   // 前のひとりの、まわりの縁
    g.fillStyle = '#ffffff'; person(x, y + r * 0.16, 1.0);
    g.restore(); return;
  }
  const im = AVATAR_IMG[key];
  if (im) { const k = Math.max(2 * r / im.width, 2 * r / im.height); g.drawImage(im, x - im.width * k / 2, y - im.height * k / 2, im.width * k, im.height * k); }
  else {
    const [hue, em] = AVATARS[key] || [210, '🙂'];
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r * 1.2); gr.addColorStop(0, `hsl(${hue} 70% 92%)`); gr.addColorStop(1, `hsl(${hue} 55% 74%)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.font = `${r * 1.25}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(em, x, y + r * 0.08);
  }
  g.restore();
}
function statusBar(S, h) {   // iPad の上のバー：左に時刻と日付、右に Wi-Fi と電池
  const fs = S.fs, y = h / 2;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, h);
  g.font = `600 ${fs * 0.48}px ${FONT}`; g.fillStyle = '#1b1d21'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(tr('12:04　11月9日(月)', '12:04  Mon Nov 9'), fs * 0.8, y);
  const bx = W - fs * 0.8 - fs * 1.2;   // 電池
  g.strokeStyle = '#1b1d21'; g.lineWidth = 1.4; rr(bx, y - fs * 0.24, fs * 1.0, fs * 0.48, fs * 0.12); g.stroke();
  g.fillStyle = '#1b1d21'; rr(bx + 2.5, y - fs * 0.24 + 2.5, fs * 0.72, fs * 0.48 - 5, fs * 0.07); g.fill(); g.fillRect(bx + fs * 1.03, y - fs * 0.09, fs * 0.08, fs * 0.18);
  g.textAlign = 'right'; g.font = `600 ${fs * 0.42}px ${FONT}`; g.fillText('87%', bx - fs * 0.25, y);
  const wx = bx - fs * 1.6;   // Wi-Fi
  g.lineWidth = Math.max(1.6, fs * 0.07); g.lineCap = 'round';
  [0.42, 0.28, 0.14].forEach(r => { g.beginPath(); g.arc(wx, y + fs * 0.2, fs * r, 1.25 * Math.PI, 1.75 * Math.PI); g.stroke(); });
}
function drawLine(S, L, t, dt, pb) {
  const fs = S.fs, sb = fs * 0.95, hh = fs * 1.9, size = fs * 0.76, lh = size * 1.5, ib = fs * 2.6, ad = fs * 1.35, gap = size * 0.6;   // トークの字は、少し小さめ
  const listW = Math.round(W * 0.3), x0 = listW, cw = W - listW, top = sb + hh, maxB = cw * 0.64;
  // 下から：予測変換の浮いた帯（①のときだけ）→ AI のボタンの列（②から）→ 入力欄。AI の返信提案は、入力欄の上に開く
  const cbH = fs * 2.2, chH = L.aiOn ? fs * 2.0 * easeOut(clamp((t - L.aiOn) / 350, 0, 1)) : 0, barOn = !!L.bar, barY = barOn ? pb - cbH : pb, chY = barY - chH, iy = chY - ib;
  const sheetH = L.sheet ? sheetHeight(S, L.sheet) : 0, sheetY = iy - fs * 0.35 - sheetH, above = L.sheet ? sheetY : iy;
  const C = S.choice, choosing = C && C.bar && !C.cards;
  const bottom = choosing ? above - fs * 3.4 : above - (L.sheet ? fs * 0.3 : 0);   // 選ぶ場面では、その上に天の声が出るので、会話はその上まで流す（最後の文が隠れない）
  g.fillStyle = LINE_BG; g.fillRect(x0, top, cw, pb - top);
  const rows = lineRows(L, size, lh, maxB);
  let y = fs * 1.6;
  rows.forEach(r => { r.y = y; y += r.bh + gap + (r.m.who === 'me' ? size * 0.35 : 0); });
  const target = Math.max(0, y - (bottom - top - 8));
  if (!L.scrolled) { L.scroll = target; L.scrolled = true; }   // 開いたときは、いちばん下（最新）が見えている
  L.scroll += (target - L.scroll) * (1 - Math.exp(-dt / 140));
  g.save(); g.beginPath(); g.rect(x0, top, cw, bottom - top); g.clip();
  rows.forEach((r, ri_) => {
    const by = top + r.y - L.scroll, me = r.m.who === 'me';
    if (by + r.bh < top - 4 || by > bottom + 4) return;
    if (r.m.sep) {   // 日付の区切り
      g.font = `500 ${fs * 0.46}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const dw = g.measureText(r.m.sep).width + fs * 1.0;
      g.fillStyle = 'rgba(0,0,0,0.2)'; rr(x0 + cw / 2 - dw / 2, by, dw, fs * 0.75, fs * 0.375); g.fill();
      g.fillStyle = '#ffffff'; g.fillText(r.m.sep, x0 + cw / 2, by + fs * 0.375);
      return;
    }
    const bx = me ? x0 + cw * 0.965 - r.bw : x0 + cw * 0.03 + ad + fs * 0.45, p = popOf(r.m, t);
    g.save();
    if (p < 1) {   // ぽんっ：吹き出しの根元から、少し行きすぎて広がる
      const ax = me ? bx + r.bw : bx - ad * 0.5, ay = by + r.bh, sc = 0.4 + 0.6 * easeBack(p);
      g.translate(ax, ay); g.scale(sc, sc); g.translate(-ax, -ay); g.globalAlpha = Math.min(1, p * 2.5);
    }
    if (r.m.stamp) { stamp(bx, by, r.bw, r.m.stamp, size); }
    else {
      g.fillStyle = me ? '#86d97a' : '#ffffff';
      rr(bx, by, r.bw, r.bh, size * 0.85); g.fill();
      g.beginPath();   // しっぽ
      if (me) { g.moveTo(bx + r.bw - 2, by + size * 0.45); g.lineTo(bx + r.bw + size * 0.45, by + size * 0.3); g.lineTo(bx + r.bw - 2, by + size * 1.3); }
      else { g.moveTo(bx + 2, by + size * 0.45); g.lineTo(bx - size * 0.45, by + size * 0.3); g.lineTo(bx + 2, by + size * 1.3); }
      g.fill();
    }
    if (!me && !(rows[ri_ - 1]?.m.who === 'them')) avatar(x0 + cw * 0.03 + ad / 2, by + ad / 2, ad / 2, 'suzuki');   // 相手の最初の吹き出しに、アイコン
    if (!r.m.stamp) drawBlock(r.m, bx + size * 0.75, by + size * 0.5, size, lh, r.lines, false);
    g.font = `500 ${size * 0.5}px ${FONT}`; g.fillStyle = 'rgba(20,24,32,0.75)'; g.textBaseline = 'middle';
    if (me) { g.textAlign = 'right'; if (r.m.read) g.fillText(tr('既読', 'Read'), bx - 7, by + r.bh - size * 1.0); g.fillText(r.m.time || '', bx - 7, by + r.bh - size * 0.42); }
    else { g.textAlign = 'left'; g.fillText(r.m.time || '', bx + r.bw + 7, by + r.bh - size * 0.42); }
    g.restore();
  });
  g.restore();
  // 右：トークのヘッダー（名前と、検索・通話・メニュー）
  g.fillStyle = '#ffffff'; g.fillRect(x0, sb, cw, hh); g.fillStyle = '#e1e4e8'; g.fillRect(x0, sb + hh - 1, cw, 1);
  g.fillStyle = INK; g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = `700 ${fs * 0.78}px ${FONT}`; g.fillText(L.name, x0 + fs * 0.9, sb + hh / 2);
  ['menu', 'phone', 'search'].forEach((k, i) => ico(k, W - fs * (0.95 + i * 1.35), sb + hh / 2, fs * 0.8));
  // 左：トーク一覧（鈴木のトークが選ばれている）
  g.fillStyle = '#ffffff'; g.fillRect(0, sb, listW, pb - sb); g.fillStyle = '#e1e4e8'; g.fillRect(listW - 1, sb, 1, pb - sb);
  g.font = `800 ${fs * 0.86}px ${FONT}`; g.fillStyle = INK; g.textAlign = 'left'; g.fillText(tr('トーク', 'Chats'), fs * 0.8, sb + hh / 2);
  ico('compose', listW - fs * 0.95, sb + hh / 2, fs * 0.8);
  const sy = sb + hh + fs * 0.1, sh2 = fs * 1.15;
  g.fillStyle = '#f0f1f4'; rr(fs * 0.7, sy, listW - fs * 1.4, sh2, sh2 / 2); g.fill();
  ico('search', fs * 0.7 + fs * 0.6, sy + sh2 / 2, fs * 0.55, '#8b9099'); g.font = `500 ${fs * 0.48}px ${FONT}`; g.fillStyle = '#8b9099'; g.fillText(tr('検索', 'Search'), fs * 0.7 + fs * 1.05, sy + sh2 / 2);
  const last = L.msgs[L.msgs.length - 1], rowsL = [[L.name, last ? (last.stamp ? tr('スタンプを送信しました', 'Sent a sticker') : last.full) : '', last ? last.time : '', 0, 'suzuki', 0, true], ...(LANG === 'en' ? LINE_LIST_EN : LINE_LIST_JA)];
  const rh = fs * 2.25;
  rowsL.forEach(([name, msg, time, unread, av, members, sel], i) => {
    const ry = sy + sh2 + fs * 0.5 + rh * i;
    if (ry > pb) return;
    if (sel) { g.fillStyle = '#eef1f6'; g.fillRect(0, ry, listW - 1, rh); }
    const ar = fs * 0.78, ax = fs * 0.8 + ar;
    avatar(ax, ry + rh / 2, ar, av);
    const tx = ax + ar + fs * 0.45, tw = listW - tx - fs * 2.4;
    g.textAlign = 'left'; g.font = `700 ${fs * 0.56}px ${FONT}`; g.fillStyle = INK;
    const nm = fitText(name, tw - (members ? fs * 1.2 : 0)); g.fillText(nm, tx, ry + rh * 0.36);
    if (members) { const nw = g.measureText(nm).width; g.font = `500 ${fs * 0.5}px ${FONT}`; g.fillStyle = '#8b9099'; g.fillText(`(${members})`, tx + nw + fs * 0.15, ry + rh * 0.36); }   // グループは、名前の右に人数
    g.font = `500 ${fs * 0.46}px ${FONT}`; g.fillStyle = '#7d828b'; g.fillText(fitText(strip(msg), tw + fs * 1.4), tx, ry + rh * 0.66);
    g.textAlign = 'right'; g.font = `500 ${fs * 0.4}px ${FONT}`; g.fillStyle = '#9aa0a8'; g.fillText(time || '', listW - fs * 0.6, ry + rh * 0.36);
    if (unread) { const ux = listW - fs * 0.9, uy = ry + rh * 0.66; g.fillStyle = '#06c755'; g.beginPath(); g.arc(ux, uy, fs * 0.3, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.font = `700 ${fs * 0.36}px ${FONT}`; g.fillText(String(unread), ux, uy + 1); }
  });
  statusBar(S, sb);
  if (C && C.bar) { C.iy = above; C.msgY = above - fs * 1.05; C.mx = x0 + cw / 2; }   // 天の声は、入力欄（AI の提案が開いていれば、その上）のすぐ上、トークの真ん中に
  // 入力欄：左に ＋・カメラ・画像、まん中に入力欄（右に顔文字）、右にマイク（字が入ると、紙飛行機）
  g.fillStyle = '#ffffff'; g.fillRect(x0, iy, cw, pb - iy); g.fillStyle = '#e1e4e8'; g.fillRect(x0, iy, cw, 1);
  const icy = iy + ib / 2, is = fs * 0.78;
  ['plus', 'camera', 'image'].forEach((k, i) => ico(k, x0 + fs * (0.9 + i * 1.2), icy, is));
  const fx = x0 + fs * 3.9, fw = W - fx - fs * 2.4, fh = ib * 0.62, fy = iy + (ib - fh) / 2, fz = size * 0.86;
  g.fillStyle = '#f2f3f5'; rr(fx, fy, fw, fh, fh / 2); g.fill();
  ico('smile', fx + fw - fh * 0.55, icy, is * 0.95, '#6b7078');
  const f = L.input, empty = !f.text && !f.comp && !f.pend;
  if (empty) { g.globalAlpha = 0.4; g.fillStyle = INK; g.font = `500 ${fz}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('Aa', fx + fh * 0.45, icy); g.globalAlpha = 1; if (S.typing === f && caretOn(t)) { g.fillStyle = INK; g.fillRect(fx + fh * 0.45, icy - fz * 0.55, 2, fz * 1.1); } }
  else drawField(f, fx + fh * 0.45, fy, fw - fh * 1.4, fh, fz, S.typing === f && caretOn(t));
  if (L.fieldTapT && t - L.fieldTapT < 650) {   // 入力欄がタップされた瞬間：タップの丸
    const q = clamp((t - L.fieldTapT) / 650, 0, 1);
    g.globalAlpha = 0.35 * (1 - q); g.fillStyle = '#5f6670'; g.beginPath(); g.arc(fx + fw * 0.3, icy, fs * (0.7 + 0.9 * easeOut(q)), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  }
  const q = L.sendT ? clamp((t - L.sendT) / 260, 0, 1) : 1, push = Math.sin(Math.PI * q), sx = W - fs * 1.2;
  if (empty && q >= 1) ico('mic', sx, icy, is);
  else { const br = fh * 0.42 * (1 - 0.12 * push); g.fillStyle = q < 1 ? '#7fb1f0' : '#1f6fe0'; g.beginPath(); g.arc(sx, icy, br, 0, Math.PI * 2); g.fill(); plane(sx + br * 0.08, icy, br * 0.52, '#ffffff'); }   // 送信：字が入ると、青い紙飛行機
  if (chH > 0) drawChips(S, L, t, chY, chH, x0);   // AI のボタンの列（入力欄の下。①の予測変換のあいだは出さない）
  if (L.sheet) drawSheet(S, L.sheet, choosing ? C : null, t, sheetY, sheetH, x0 + fs * 0.6, cw - fs * 1.2);
  if (barOn) { g.fillStyle = '#ffffff'; g.fillRect(x0, barY, cw, pb - barY); L.bar.x0 = x0; drawBar(S, L.bar, choosing ? C : null, t, barY, cbH); }   // 予測変換の帯は、トーク（右の列）の中に
}
// ---- LINE の AI（トークルームの AI）：入力欄の下に、ロボットのしるしと、ボタンの列。返信提案・ムード分析は、入力欄の上に開く ----
function aiIcon(x, y, s) {   // ロボットのしるし（青から紫へ）
  const gr = g.createLinearGradient(x, y, x + s, y + s); gr.addColorStop(0, '#4f8cff'); gr.addColorStop(1, '#c04dff');
  g.fillStyle = gr; rr(x, y + s * 0.08, s, s * 0.84, s * 0.32); g.fill();
  g.fillStyle = '#ffffff'; rr(x + s * 0.18, y + s * 0.26, s * 0.64, s * 0.48, s * 0.2); g.fill();
  g.fillStyle = '#3b3f9a'; [0.38, 0.62].forEach(k => { rr(x + s * k - s * 0.045, y + s * 0.38, s * 0.09, s * 0.2, s * 0.045); g.fill(); });
}
function drawChips(S, L, t, y, h, cx0 = 0) {
  const fs = S.fs;
  g.save(); g.beginPath(); g.rect(0, y, W, h); g.clip();   // 出てくる途中（高さがのびる途中）は、はみ出さない
  g.fillStyle = '#ffffff'; g.fillRect(cx0, y, W - cx0, h);
  h = fs * 2.0;   // 中身は、いつもの高さで並べる（上から見えてくる）
  const ic = fs * 1.05, x0 = cx0 + fs * 0.7;
  aiIcon(x0, y + (h - ic) / 2, ic);
  let x = x0 + ic + fs * 0.6;
  const ch = fs * 1.35, ts = fs * 0.58;
  g.font = `500 ${ts}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const label of LN.chips) {
    const w = g.measureText(label).width + fs * 1.3, on = L.chip === label, cy = y + (h - ch) / 2;
    const push = on ? Math.sin(Math.PI * clamp((t - L.chipT) / 260, 0, 1)) : 0;   // 押された瞬間、少し沈む
    g.fillStyle = on ? '#e2d9ff' : '#ffffff'; rr(x, cy + push * 2, w, ch, ch / 2); g.fill();   // 押されたボタン：はっきり光る
    g.strokeStyle = on ? '#6a4bff' : '#b9bcc2'; g.lineWidth = on ? 2.5 : 1.3; rr(x, cy + push * 2, w, ch, ch / 2); g.stroke();
    g.fillStyle = on ? '#4b33c9' : INK; g.fillText(label, x + w / 2, cy + ch / 2 + push * 2);
    const tapT = on ? L.chipT : L.tapOff && L.tapOff.label === label ? L.tapOff.t : null;
    if (tapT != null && t - tapT < 650) {   // 押された瞬間：タップの丸（通知のタップと同じ。ボタンが戻っても、消えきるまで残る）
      const q = clamp((t - tapT) / 650, 0, 1);
      g.globalAlpha = 0.35 * (1 - q); g.fillStyle = '#5f6670'; g.beginPath(); g.arc(x + w / 2, cy + ch / 2, fs * (0.6 + 0.8 * easeOut(q)), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    }
    x += w + fs * 0.4;
  }
  g.restore();
}
// 返信提案：AI が書いた返信が3つ、横に並ぶ（キーと同じ並び。左・真ん中・右が S D F。カードの左に、大きな①②③の札）
function sheetHeight(S, sh) {
  return S.fs * (1.75 + 2.9 + 0.6);   // 返信提案：見出しと、横に並ぶ3つのカード（1枚は2行まで）
}
function drawSheet(S, sh, C, t, y, h, mx = W * 0.06, w = W - W * 0.12) {
  const fs = S.fs, e = easeOut(clamp((t - sh.t0) / 320, 0, 1));
  g.save(); g.globalAlpha = e; g.translate(0, (1 - e) * fs * 1.2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.18)'; g.shadowBlur = fs * 0.9; g.fillStyle = '#ffffff'; rr(mx, y, w, h, fs * 0.6); g.fill(); g.restore();
  const ic = fs * 0.95, hy = y + fs * 0.85;   // 見出し：ロボットのしるしと、機能の名前
  aiIcon(mx + fs * 0.7, hy - ic / 2, ic);
  g.font = `700 ${fs * 0.66}px ${FONT}`; g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(sh.title, mx + fs * 0.7 + ic + fs * 0.4, hy);
  g.fillStyle = '#eceef1'; g.fillRect(mx + fs * 0.6, y + fs * 1.65, w - fs * 1.2, 1);
  drawCardRow(S, C, sh.items, t, mx + fs * 0.6, y + fs * 1.85, w - fs * 1.2, fs * 2.9, e);
  g.restore();
}
// 3枚のカードを横に並べる（キーと同じ並び。左・真ん中・右が S D F）。カードの左に大きな①②③の札。選んだカードは黄緑の枠。
// LINE の返信提案・選び方の練習・星の3択で同じ見た目。e：全体の濃さ
function drawCardRow(S, C, items, t, x0, y0, w, ch, e = 1) {
  const fs = S.fs, n = items.length, gap = fs * 0.45, cw = (w - gap * (n - 1)) / n, bsz = fs * 1.15;
  const sel = C && C.stage === 'select', show = C && (sel || C.stage === 'read'), pin = show ? clamp((t - C.born) / 280, 0, 1) : 0;
  items.forEach((text, j) => {
    const cx = x0 + (cw + gap) * j;
    g.globalAlpha = e; g.fillStyle = '#f3f4f7'; rr(cx, y0, cw, ch, fs * 0.35); g.fill();
    const lime = C && ((C.stage === 'picked' && j === C.picked) || ((C.stage === 'timeout' || C.stage === 'final' || C.stage === 'out') && j === (C.picked >= 0 ? C.picked : C.final)));
    if (lime) {   // 選んだ（選ばれた）カード：黄緑に光る枠
      const ee = C.stage === 'picked' || C.stage === 'timeout' ? clamp((t - C.t0) / 250, 0, 1) : 1;
      g.save(); g.globalAlpha = e * ee; g.shadowColor = LIME; g.shadowBlur = fs * 0.6; g.strokeStyle = LIME; g.lineWidth = Math.max(3, fs * 0.11);
      rr(cx, y0, cw, ch, fs * 0.35); g.stroke(); g.restore();
    }
    const bx = cx + fs * 0.4, by = y0 + (ch - bsz) / 2;   // 番号の札（左、縦の真ん中）：読むあいだは小さく淡く、受付が始まったら、ぽんっと大きくなって脈打つ
    if (show) {
      const s2 = sel ? bsz * (0.8 + 0.2 * easeBack(clamp((t - C.t0) / 280, 0, 1))) : bsz * 0.8 * easeBack(pin);
      badge(bx + (bsz - s2) / 2, by + (bsz - s2) / 2, s2, e * Math.min(1, pin * 2) * (sel ? 0.75 + 0.25 * Math.sin(t / 170) : 0.4), j + 1);
    } else if (lime) badge(bx, by, bsz, e, j + 1);
    g.globalAlpha = e;
    let ts = fs * 0.66; g.font = `500 ${ts}px ${FONT}`;   // カードの文：2行まで（入りきらなければ、小さくする）
    const tw = cw - bsz - fs * 1.2;
    let lines = wrapLines(text, tw, true);
    while (lines.length > 2 && ts > fs * 0.45) { ts *= 0.92; g.font = `500 ${ts}px ${FONT}`; lines = wrapLines(text, tw, true); }
    const lh2 = ts * 1.45, ty = y0 + ch / 2 - (lines.length - 1) * lh2 / 2;
    g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle';
    lines.forEach((ln, i) => g.fillText(ln, cx + fs * 0.4 + bsz + fs * 0.4, ty + i * lh2));
  });
  g.globalAlpha = 1;
}
// 変換候補の帯の並び（drawBar と、候補からキーへの線で使う）：同じ幅の候補を横に並べ、真ん中の候補を、真ん中のキー（D）の真上に置く
function barLayout(S, B) {   // B.x0：トーク（右の列）の左端。帯は、その中に収める
  const fs = S.fs, n = B.cands.length, x0 = B.x0 || 0, cw = Math.min(W * 0.2, fs * 11, (W - x0 - fs * 1.6) / n);
  const gx = clamp(kx(B.ks[Math.floor(n / 2)]) - cw * n / 2, x0 + fs * 0.8, W - cw * n - fs * 0.8);   // ひとかたまりの左端（できるだけ D の真上。トークの列からははみ出さない）
  return {cw, gx, xs: B.cands.map((_, j) => gx + cw * (j + 0.5))};
}
// 変換候補の帯（スマホのキーボードの、候補の列）：候補は同じ幅の3つを横に並べ、真ん中の候補を、真ん中のキー（D）の真上に置く。
// 左・真ん中・右の候補が、S・D・F に対応する（キーの間隔はせまいので、候補の幅はキーより広い）。
// 選べるあいだ（キーが上がっているあいだ）だけ、候補の下にオレンジの細い線。押した（押された）候補は、一瞬灰色になる
function drawBar(S, B, C, t, y, h) {
  const fs = S.fs, n = B.cands.length, {cw, gx} = barLayout(S, B);
  const pill = B.pill = {x: gx - fs * 0.3, y: y + fs * 0.25, w: cw * n + fs * 0.6, h: h - fs * 0.5};   // 外付けキーボードのときの、浮いた角丸の帯
  g.save(); g.shadowColor = 'rgba(0,0,0,0.22)'; g.shadowBlur = fs * 0.6; g.shadowOffsetY = fs * 0.08; g.fillStyle = '#f7f7f8'; rr(pill.x, pill.y, pill.w, pill.h, fs * 0.45); g.fill(); g.restore();
  const a = clamp((t - B.t0) / 200, 0, 1), sel = C && C.stage === 'select', show = C && (sel || C.stage === 'read');
  const pin = show ? clamp((t - C.born) / 280, 0, 1) : 0, bsz = fs * 1.05, gap = fs * 0.35;   // 番号の札は大きく（キーの番号と、ひと目で対応がわかるように）
  for (let j = 0; j < n; j++) {
    const L = gx + cw * j, R = L + cw, x = (L + R) / 2;
    if (j > 0) { g.fillStyle = '#d3d6db'; g.fillRect(L, y + h * 0.32, 1, h * 0.36); }
    const room = R - L - fs * 0.5 - bsz - gap;
    let size = fs * 0.72;
    g.font = `500 ${size}px ${FONT}`;
    let tw = g.measureText(B.cands[j]).width;
    if (tw > room) { size *= room / tw; g.font = `500 ${size}px ${FONT}`; tw = g.measureText(B.cands[j]).width; }
    const x0 = x - (bsz + gap + tw) / 2, cy = y + h * 0.5;   // 番号の札（①②③）と候補を、ひとまとまりで真ん中に
    const lime = C && ((C.stage === 'picked' && j === C.picked) || (C.stage === 'timeout' && j === C.final));   // 選んだ（選ばれた）候補：黄緑に光る枠
    if (lime) {
      const e = clamp((t - C.t0) / 250, 0, 1), px = fs * 0.3, ph = h * 0.7;
      g.save(); g.globalAlpha = e; g.shadowColor = LIME; g.shadowBlur = fs * 0.6; g.strokeStyle = LIME; g.lineWidth = Math.max(3, fs * 0.11);
      rr(x0 - px, cy - ph / 2, bsz + gap + tw + px * 2, ph, fs * 0.3); g.stroke(); g.restore();
    }
    if (show) {   // 番号の札：読むあいだは小さく淡く、受付が始まったら、ぽんっと大きくなって脈打つ（星の3択と同じ）
      const s2 = sel ? bsz * (0.8 + 0.2 * easeBack(clamp((t - C.t0) / 280, 0, 1))) : bsz * 0.8 * easeBack(pin);
      badge(x0 + (bsz - s2) / 2, cy - s2 / 2, s2, Math.min(1, pin * 2) * (sel ? 0.75 + 0.25 * Math.sin(t / 170) : 0.4), j + 1);
    } else if (lime) badge(x0, cy - bsz / 2, bsz, 1, j + 1);   // 選んだ候補は、番号の札も残す
    g.font = `500 ${size}px ${FONT}`;   // badge() が字の設定を変えるので、もう一度
    g.globalAlpha = a; g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(B.cands[j], x0 + bsz + gap, cy);
    g.globalAlpha = 1;
  }
}
// スマホの通知（LINE に入る前）：上から降りてくる。緑のアプリのしるし・相手の名前・内容
function drawNotif(S, N, t) {
  const fs = S.fs, w = Math.min(W * 0.56, fs * 19), h = fs * 2.5, x = (W - w) / 2;
  const e = easeOut(clamp((t - N.t0) / 380, 0, 1)), y = -h + (fs * 0.7 + h) * e;
  const tq = N.tapT ? clamp((t - N.tapT) / 260, 0, 1) : 0, press = N.tapT ? (t - N.tapT < 260 ? Math.sin(Math.PI * 0.5 * tq) : 1) : 0;   // タップ：押されて、少し沈んで、灰色に
  g.save(); g.translate(W / 2, y + h / 2); g.scale(1 - 0.03 * press, 1 - 0.03 * press); g.translate(-W / 2, -(y + h / 2));
  g.save(); g.shadowColor = 'rgba(0,0,0,0.18)'; g.shadowBlur = fs * 0.8 * (1 - 0.5 * press); g.shadowOffsetY = fs * 0.15;
  g.fillStyle = press ? mixHex('#fafafa', '#dcdfe4', press) : 'rgba(250,250,250,0.98)'; rr(x, y, w, h, fs * 0.6); g.fill(); g.restore();
  const ic = fs * 1.35, ix = x + fs * 0.6, iy = y + (h - ic) / 2;
  g.fillStyle = '#06c755'; rr(ix, iy, ic, ic, ic * 0.24); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(ix + ic / 2, iy + ic * 0.46, ic * 0.32, ic * 0.25, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(ix + ic * 0.38, iy + ic * 0.62); g.lineTo(ix + ic * 0.32, iy + ic * 0.8); g.lineTo(ix + ic * 0.5, iy + ic * 0.68); g.fill();
  const tx = ix + ic + fs * 0.55;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.font = `700 ${fs * 0.62}px ${FONT}`; g.fillStyle = INK; g.fillText(N.name, tx, y + h * 0.36);
  g.font = `500 ${fs * 0.58}px ${FONT}`; g.fillStyle = '#333'; g.fillText(N.text, tx, y + h * 0.66);
  g.font = `500 ${fs * 0.45}px ${FONT}`; g.fillStyle = '#888'; g.textAlign = 'right'; g.fillText(tr('今', 'now'), x + w - fs * 0.6, y + h * 0.36);
  g.restore();
  if (N.tapT) {   // タップの丸（画面収録で、触れたところに出るのと同じ）：ふくらみながら、消える
    const q = clamp((t - N.tapT) / 650, 0, 1), cx = x + w * 0.62, cy = y + h * 0.55;
    g.globalAlpha = 0.35 * (1 - q); g.fillStyle = '#5f6670'; g.beginPath(); g.arc(cx, cy, fs * (0.7 + 0.9 * easeOut(q)), 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  }
}
// スタンプ（この展示のために描いたもの）：手をふる、まるい顔と「やっほー」
function stamp(x, y, s, word, size) {
  const cx = x + s * 0.45, cy = y + s * 0.42, r = s * 0.3;
  g.fillStyle = '#ffd84d'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3b2a00'; g.lineWidth = Math.max(2, s * 0.025); g.stroke();
  g.fillStyle = '#3b2a00'; [-1, 1].forEach(d => { g.beginPath(); g.arc(cx + d * r * 0.35, cy - r * 0.15, r * 0.08, 0, Math.PI * 2); g.fill(); });
  g.beginPath(); g.arc(cx, cy + r * 0.1, r * 0.4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  g.fillStyle = '#ffd84d'; g.beginPath(); g.ellipse(cx + r * 1.15, cy - r * 0.45, r * 0.22, r * 0.32, 0.5, 0, Math.PI * 2); g.fill(); g.stroke();   // 手
  g.font = `800 ${size * 1.05}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = size * 0.3; g.strokeStyle = '#ffffff'; g.strokeText(word, x + s * 0.5, y + s * 0.86);
  g.fillStyle = '#e8590c'; g.fillText(word, x + s * 0.5, y + s * 0.86);
}
function plane(x, y, k, color) {   // 送信の紙飛行機（右向き）
  g.fillStyle = color; g.beginPath();
  g.moveTo(x - k * 0.95, y - k * 0.85); g.lineTo(x + k * 1.05, y); g.lineTo(x - k * 0.95, y + k * 0.85); g.lineTo(x - k * 0.55, y);
  g.closePath(); g.fill();
}


// ---- 字を出す道具（入りきらなければ … で切る） ----
function fitText(str, maxW) {   // 入りきらなければ … で切る（いまの g.font で）
  if (g.measureText(str).width <= maxW) return str;
  let s = str;
  while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
function txt(str, x, y, size, color = INK, weight = 500, align = 'left', maxW = 0) {
  g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(maxW ? fitText(str, maxW) : str, x, y);
}
// 来場者の手元のカメラ映像が、そのまま映る（still があれば、止まった1枚）
function drawCamFeed(S, top, pb, still = null) {
  const fs = S.fs, v = still || document.getElementById('pv-hands'), ch = pb - top;
  g.fillStyle = '#000'; g.fillRect(0, top, W, ch);
  const vw = still ? still.width : v?.videoWidth, vh = still ? still.height : v?.videoHeight;
  if (v && vw && (still || v.readyState >= 2)) {
    const k = Math.max(W / vw, ch / vh), w = vw * k, h = vh * k;
    g.drawImage(v, (W - w) / 2, top + (ch - h) / 2, w, h);
  } else { txt(tr('（カメラの映像）', '(camera feed)'), W / 2, top + ch / 2, fs * 0.8, '#777', 500, 'center'); }
  g.fillStyle = 'rgba(0,0,0,0.55)'; rr(fs * 0.6, top + fs * 0.6, fs * 7.2, fs * 1.2, 8); g.fill();
  g.fillStyle = '#e01b24'; g.beginPath(); g.arc(fs * 1.2, top + fs * 1.2, fs * 0.2, 0, Math.PI * 2); g.fill();
  txt(tr('カメラに接続しました', 'Camera connected'), fs * 1.6, top + fs * 1.2, fs * 0.55, '#fff', 700);
}
function freezeCamera() {   // いまの映像を1枚止める（シャッター）
  const v = document.getElementById('pv-hands');
  if (!v || !v.videoWidth) return null;
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0); return c;
}
const AVATAR = new Image(); AVATAR.src = '/feed-avatar.png';   // 展示の X アカウントのアイコン（タイムラインと同じ画像）
// ---- X（風）：投稿画面。配置と色だけをそれっぽくした、ロゴのない画面。長い文は、打っている行が見えるように上へ流れる ----
function drawX(S, X, t, dt, pb) {
  const fs = S.fs, cw = clamp(W * 0.66, 440, 860), cx = (W - cw) / 2, cy = pb * 0.06, ch = pb * 0.8, size = fs * 1.0, lh = size * 1.6;
  g.fillStyle = '#ffffff'; rr(cx, cy, cw, ch, 18); g.fill(); g.strokeStyle = '#cfd9de'; g.lineWidth = 1; g.stroke();
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = INK;
  g.font = `500 ${fs * 1.1}px ${FONT}`; g.fillText('×', cx + 22, cy + fs * 1.0); g.font = `700 ${fs * 0.65}px ${FONT}`; g.textAlign = 'right'; g.fillText(tr('下書き', 'Drafts'), cx + cw - 22, cy + fs * 1.0); g.textAlign = 'left';
  const ar = fs * 0.95, ax = cx + 26 + ar, ay = cy + fs * 2.4 + ar, tx = ax + ar + 16, tw = cw - (tx - cx) - 28;
  g.fillStyle = '#cfd9de'; g.beginPath(); g.arc(ax, ay, ar, 0, Math.PI * 2); g.fill();
  if (AVATAR.complete && AVATAR.naturalWidth) { g.save(); g.beginPath(); g.arc(ax, ay, ar, 0, Math.PI * 2); g.clip(); g.drawImage(AVATAR, ax - ar, ay - ar, ar * 2, ar * 2); g.restore(); g.strokeStyle = '#cfd9de'; g.lineWidth = 1; g.beginPath(); g.arc(ax, ay, ar, 0, Math.PI * 2); g.stroke(); }
  g.textAlign = 'left';
  // 星と本文
  let y = ay - ar * 0.55;
  const ss = size * 1.15;
  g.font = `500 ${ss}px ${FONT}`; g.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) { g.fillStyle = i < X.stars ? RED : INK; g.fillText(i < X.stars ? '★' : '☆', tx + i * ss * 1.12, y + ss * 0.6); }
  y += ss * 1.5;
  const by = cy + ch - fs * 1.5, yEnd = by - fs * 2.1, area = yEnd - y;
  const lines = lay(X, size, tw), need = (curLine(X, lines) + 2) * lh;
  X.scroll += (Math.max(0, need - area) - X.scroll) * (1 - Math.exp(-dt / 90));
  if (!X.text && !X.pend && !X.comp && S.typing !== X) { g.globalAlpha = 0.4; g.fillStyle = INK; g.font = `500 ${size}px ${FONT}`; g.fillText(tr('いまどうしてる？', "What's happening?"), tx, y + lh / 2); g.globalAlpha = 1; }
  g.save(); g.beginPath(); g.rect(cx, y, cw, area); g.clip();
  drawBlock(X, tx, y - X.scroll, size, lh, lines, S.typing === X && caretOn(t), FONT, tx + tw);
  g.restore();
  // 返信できる人（本物と同じく、本文の下に小さく）。下の行：文字数のリング（140字をこえると、こえた字数が赤で出る）と「ポストする」（押されると青）
  g.fillStyle = '#1d9bf0'; g.font = `500 ${size * 0.55}px ${FONT}`; g.textAlign = 'left'; g.fillText(tr('全員が返信できます', 'Everyone can reply'), tx, by - fs * 1.55);
  g.fillStyle = '#cfd9de'; g.fillRect(cx + 20, by - fs * 1.1, cw - 40, 1);
  g.textBaseline = 'middle';
  {
    const lim = tr(140, 280), n = X.text.length + (X.comp || '').length, left = lim - n;   // 文字数の上限（日本語は140字、英語は280字）
    const empty = !n && !X.pend, bw = fs * 5.4, bh = fs * 1.55, bx = cx + cw - 24 - bw, ring = cx + cw - 24 - bw - fs * 1.4, rad = fs * 0.5, p = clamp(n / lim, 0, 1);
    g.lineWidth = 3; g.strokeStyle = '#cfd9de'; g.beginPath(); g.arc(ring, by, rad, 0, Math.PI * 2); g.stroke();
    if (p > 0) { g.strokeStyle = p > 0.9 ? RED : INK; g.beginPath(); g.arc(ring, by, rad, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.stroke(); }
    if (left <= 20) { g.fillStyle = left < 0 ? RED : INK; g.font = `500 ${fs * 0.6}px ${FONT}`; g.textAlign = 'right'; g.fillText(String(left), ring - rad - 10, by + 1); }
    const down = X.press && t - X.press < 900;
    g.fillStyle = down ? '#1d9bf0' : empty ? '#8a9097' : '#0f1419'; rr(bx, by - bh / 2 + (down ? 2 : 0), bw, bh, bh / 2); g.fill();
    g.fillStyle = '#ffffff'; g.font = `700 ${fs * 0.7}px ${FONT}`; g.textAlign = 'center'; g.fillText(tr('ポストする', 'Post'), bx + bw / 2, by + 1 + (down ? 2 : 0));
  }
  drawShot(S, X, t, pb);   // 撮影：カメラの許可 → 手元の映像 → シャッター
}

// 撮影（X の「ポストする」のあと）：カメラの使用を許可するか聞かれ、勝手に「許可」→ 手元の映像 → シャッター（白く光り、映像が止まる）
function drawShot(S, X, t, pb) {
  const fs = S.fs;
  if (X.perm) {
    const a = clamp((t - X.perm) / 200, 0, 1), w = Math.min(W * 0.46, fs * 17), h = fs * 4.2, x = (W - w) / 2, y = pb * 0.3;
    g.globalAlpha = a * 0.35; g.fillStyle = '#000'; g.fillRect(0, 0, W, pb); g.globalAlpha = a;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 14; g.fillStyle = '#fff'; rr(x, y, w, h, 14); g.fill(); g.restore();
    g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = `700 ${fs * 0.72}px ${FONT}`; g.fillText(tr('カメラの使用を許可しますか？', 'Allow access to your camera?'), x + fs * 0.8, y + fs * 1.0);
    g.font = `500 ${fs * 0.5}px ${FONT}`; g.fillStyle = '#536471'; g.fillText(tr('投稿に、手元の写真を付けます', 'A photo of your hands will be attached to your post'), x + fs * 0.8, y + fs * 1.85);
    const bw = fs * 3.6, bh = fs * 1.1, by = y + h - fs * 1.5, down = X.allowT && t - X.allowT < 400;
    g.strokeStyle = '#cfd9de'; g.lineWidth = 1; rr(x + w - bw * 2 - fs * 1.2, by, bw, bh, bh / 2); g.stroke();
    g.fillStyle = INK; g.textAlign = 'center'; g.font = `700 ${fs * 0.5}px ${FONT}`; g.fillText(tr('許可しない', "Don't Allow"), x + w - bw * 1.5 - fs * 1.2, by + bh / 2);
    g.fillStyle = down ? '#1d9bf0' : '#0f1419'; rr(x + w - bw - fs * 0.8, by + (down ? 2 : 0), bw, bh, bh / 2); g.fill();
    g.fillStyle = '#fff'; g.fillText(tr('許可', 'Allow'), x + w - bw / 2 - fs * 0.8, by + bh / 2 + (down ? 2 : 0));
    g.globalAlpha = 1;
  }
  if (X.cam) {
    g.globalAlpha = clamp((t - X.cam) / 300, 0, 1);
    drawCamFeed(S, 0, pb, X.still);
    g.globalAlpha = 1;
    if (X.flash) { const q = clamp((t - X.flash) / 600, 0, 1); g.fillStyle = `rgba(255,255,255,${1 - q})`; g.fillRect(0, 0, W, pb); }
  }
}

// ---- タイトル回収：一面の色に、点滅するカーソル。作品名が1文字ずつ打たれる（大きな、細めの欧文） ----
function drawTitle(S, T, t, pb) {
  const bg = TITLE_DARK ? '#0b0b0c' : '#ffffff', ink = TITLE_DARK ? '#f4f4f2' : INK;
  g.fillStyle = bg; g.fillRect(0, 0, W, pb);
  if (T.gone) { g.fillStyle = '#000'; g.fillRect(0, 0, W, pb); return; }   // Enter のあと：真っ黒
  const size = Math.min(W * 0.11, pb * 0.22), font = `300 ${size}px "Poppins","Helvetica Neue",Arial,sans-serif`;
  g.font = font; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const full = g.measureText(TITLE).width, x0 = W / 2 - full / 2, y = pb * 0.5 + size * 0.32;
  g.fillStyle = ink; g.fillText(T.text, x0, y);
  const cx = x0 + g.measureText(T.text).width + size * 0.06, typing = T.lastT && t - T.lastT < 500;
  if (typing || Math.floor((t - T.t0) / 530) % 2 === 0) g.fillRect(cx, y - size * 0.78, Math.max(2, size * 0.035), size * 0.95);   // 打っている間は点いたまま
}

function kToX(k) {   // キーの番号（小数も）→ 画面の x
  if (k <= 0) return kx(0) + k * STEP;
  if (k >= 7) return kx(7) + (k - 7) * STEP;
  const i = Math.floor(k);
  return kx(i) + (kx(i + 1) - kx(i)) * (k - i);
}


// ---- 待機：F が2秒上がり、5秒下がる。上がっているあいだに押すと始まる ----
const newSaver = () => ({k: 'saver'});
// 待機画面の手：作品名を打っては消す、をくり返す（画面の中だけ。実物のキーは動かさない）。時刻 t だけで決まる
const DEMO = {key: 300, hold: 16000, del: 95, rest: 900};   // 作品名は、ほとんどの時間（約16秒）出たまま。ときどき消えて、打ち直される
function demoAt(t) {   // 戻り値：n 出ている字数、keys いま押しているキー（0..7）、thumb 親指（空白）、p 押し込みの深さ（0..1）、typing 打っている途中か
  const N = TITLE.length, T = N * DEMO.key + DEMO.hold + N * DEMO.del + DEMO.rest;
  let u = t % T;
  if (u < N * DEMO.key) {
    const i = Math.floor(u / DEMO.key), q = (u % DEMO.key) / DEMO.key, ch = TITLE[i], lo = ch.toLowerCase();
    const keys = ch === ' ' ? [] : [fingerOf(lo)];
    if (ch !== lo) keys.push(7);   // 大文字は Shift（右小指）といっしょに
    return {n: i + (q > 0.3 ? 1 : 0), keys, thumb: ch === ' ', p: Math.sin(clamp(q / 0.6, 0, 1) * Math.PI), typing: true};
  }
  u -= N * DEMO.key;
  if (u < DEMO.hold) return {n: N, keys: [], p: 0};
  u -= DEMO.hold;
  if (u < N * DEMO.del) {   // 右小指の連打で消える（X の場面と同じ）
    const i = Math.floor(u / DEMO.del), q = (u % DEMO.del) / DEMO.del;
    return {n: N - i - (q > 0.4 ? 1 : 0), keys: [7], p: Math.sin(q * Math.PI), typing: true};
  }
  return {n: 0, keys: [], p: 0};
}
function capsule(x1, y1, x2, y2, r) {   // 両はしが丸い棒（指）
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.beginPath(); g.arc(x1, y1, r, a + Math.PI / 2, a + Math.PI * 1.5); g.arc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2); g.closePath();
}
// 8つのキーに、両手の8本の指を置いた絵（上から見たところ）。線だけの手（塗らない。キーが指の中に透ける）。
// となりの指は1本の線を分け合い、指のあいだの線は途中で止まる。親指は、内側の上へ向く（キーには置かない）。手首のほうは、ふっと消える。
// 左手の形を描き、右手は左右を反転して描く。押している指は、少し下がってキーが沈み、指先に小さな線が出る。
// 絵は、作品名を打つ見本だけ。始めるキー（F）のオレンジは、下の丸と実物のキーだけに出す（絵には出さない。混ざるので）
const HAND_LINE = '#433f3e';
const FINGER_TOP = [0.94, 0.29, -0.11, 0.29];   // 指先の高さ（キーの中心から、1キー分を1として下へ。小指・薬指・中指・人さし指）
function handsArt(cx, top, w, t, d) {
  const st = w / 11.4, ks = st * 0.86, keyY = top + ks / 2, lw = Math.max(3, st * 0.18);
  const X = i => cx + (i - 3.5) * st + (i < 4 ? -1 : 1) * st * 1.58;   // 左右の手のあいだは、親指が入るだけ空ける
  const down = i => d.keys.includes(i) ? d.p : 0;
  for (let i = 0; i < 8; i++) {   // キー（白。うすい影と、細い縁）
    const dn = down(i), y = keyY - ks / 2 + dn * ks * 0.07;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.13)'; g.shadowBlur = st * 0.14; g.shadowOffsetY = st * 0.05;
    g.fillStyle = mixHex('#ffffff', '#cfd3d8', dn);
    rr(X(i) - ks / 2, y, ks, ks, ks * 0.16); g.fill(); g.restore();
    g.strokeStyle = '#7d828a'; g.lineWidth = Math.max(1.5, st * 0.025); rr(X(i) - ks / 2, y, ks, ks, ks * 0.16); g.stroke();
  }
  const r = st / 2, slitY = keyY + 3.0 * st, botY = keyY + 4.6 * st;
  g.strokeStyle = HAND_LINE; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'butt';
  for (const side of [0, 1]) {
    g.save();
    if (side) { g.translate(cx * 2, 0); g.scale(-1, 1); }   // 右手は、左手を反転して描く
    const keyOf = f => side ? 7 - f : f;   // f：0 = 小指 … 3 = 人さし指
    for (let f = 0; f < 4; f++) {
      const dn = down(keyOf(f)), x = X(f), ay = keyY + (FINGER_TOP[f] + 0.5 + 0.12 * dn) * st;   // ay：指先の丸の中心
      g.beginPath();
      g.moveTo(x - r, f === 0 ? botY : slitY); g.lineTo(x - r, ay);   // 小指の外側だけは、手首まで
      g.arc(x, ay, r, Math.PI, 0);
      if (f < 3) g.lineTo(x + r, slitY);
      else {   // 人さし指の内側から、親指へ
        const ix = x + r, T = {x: ix + 1.1 * st, y: keyY + 2.55 * st}, tr_ = st * 0.34, B = {x: ix + 0.1 * st, y: keyY + 4.5 * st};
        let ux = T.x - B.x, uy = T.y - B.y; const L = Math.hypot(ux, uy); ux /= L; uy /= L;   // 親指の向き（根もとから先へ）
        const nx = uy, ny = -ux, near = {x: T.x + nx * tr_, y: T.y + ny * tr_}, far = {x: T.x - nx * tr_, y: T.y - ny * tr_};
        const jy = near.y - uy * (near.x - ix) / ux, c = st * 0.22;   // 人さし指の線と、親指の線が出会うところ（少し丸める）
        g.lineTo(ix, jy - c); g.quadraticCurveTo(ix, jy, ix + ux * c, jy + uy * c);
        g.lineTo(near.x, near.y);
        const a0 = Math.atan2(ny, nx); g.arc(T.x, T.y, tr_, a0, a0 + Math.PI);
        const k = (botY - far.y) / -uy; g.lineTo(far.x - ux * k, botY);
      }
      g.stroke();
      if (dn > 0.25) {   // 押している指先の、小さな線（3本）
        g.save(); g.globalAlpha = dn; g.lineWidth = lw * 0.55; g.lineCap = 'round';
        [-0.55, 0, 0.55].forEach(a => { const ang = -Math.PI / 2 + a, r0 = r + st * 0.18, r1 = r + st * 0.36; g.beginPath(); g.moveTo(x + Math.cos(ang) * r0, ay + Math.sin(ang) * r0); g.lineTo(x + Math.cos(ang) * r1, ay + Math.sin(ang) * r1); g.stroke(); });
        g.restore();
      }
    }
    g.restore();
  }
  const fy = keyY + 4.0 * st, fade = g.createLinearGradient(0, fy, 0, botY);   // 手首のほうは、紙の色へ、ふっと消える
  fade.addColorStop(0, 'rgba(255,255,255,0)'); fade.addColorStop(1, PAPER);
  g.fillStyle = fade; g.fillRect(cx - w / 2 - lw, fy, w + lw * 2, botY - fy + lw);   // 絵の幅だけ（左の文にかからない）
  return botY;   // 絵の下の端
}
function drawSaver(S, V, t, dt, pb) {
  const fs = S.fs, since = S.wakeUp ? t - S.beatT : -1, ready = S.wakeUp && since >= WAKE_SETTLE_MS;
  const d = demoAt(t);
  // 上：作品名（中央）。打っている字だけが出る。位置は全文で決める（打つ途中で動かない）。カーソルは、打っている間は点いたまま
  const ts = Math.min(W * 0.11, pb * 0.22), ty = pb * 0.36, shown = TITLE.slice(0, d.n);
  g.font = `300 ${ts}px "Poppins","Helvetica Neue",Arial,sans-serif`; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillStyle = INK;
  const tx = W / 2 - g.measureText(TITLE).width / 2;
  g.fillText(shown, tx, ty);
  if (d.typing || Math.floor(t / 530) % 2 === 0) g.fillRect(tx + g.measureText(shown).width + ts * 0.05, ty - ts * 0.76, Math.max(2, ts * 0.03), ts * 0.92);
  const bs = fs * SAVER_FS, lh = bs * 1.7, font = `${SAVER_W} ${bs}px ${FONT}`;
  // 下：始め方。F の上の丸から、実物の F キーへ細い線。
  // 丸は、下がっているあいだは淡く小さい。上がりはじめ（まだ受け付けない WAKE_SETTLE_MS）は、淡いまま少しずつ大きくなる。
  // 受け付けられるようになった瞬間に、濃いオレンジになって輪が広がる（今押していい、の合図）
  const x = kx(BEAT_KEY), cy = pb * 0.9, grow = S.wakeUp ? easeOut(clamp(since / WAKE_SETTLE_MS, 0, 1)) : 0;
  const rt = ready ? since - WAKE_SETTLE_MS : 1e9, q = Math.exp(-rt / 260);
  const r = fs * 0.6 * (0.8 + 0.2 * grow) * (1 + 0.25 * q), on = ready ? 0.9 + 0.1 * Math.sin(t / 200) : 0.3;
  g.strokeStyle = ORANGE; g.lineWidth = 2; g.globalAlpha = 0.6 * on;
  g.beginPath(); g.moveTo(x, cy + r); g.lineTo(x, pb); g.stroke();
  if (rt < 900) { g.globalAlpha = 0.6 * (1 - rt / 900); g.lineWidth = 3; g.beginPath(); g.arc(x, cy, r + fs * 1.6 * (rt / 900), 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = on;
  g.fillStyle = ORANGE; g.beginPath(); g.arc(x, cy, r, 0, Math.PI * 2); g.fill();
  // 丸の上に、始め方。弱くて無視した押し込みのあと（2秒）は、代わりに短い声かけ
  const weak = S.weakT && t - S.weakT < 2200;
  g.globalAlpha = 1; g.textAlign = 'center'; g.textBaseline = 'middle';
  const go = SAVER_GO(), y2 = cy - fs * 0.75 - bs * 1.4, y1 = y2 - lh;   // 2行は、同じ行間で（丸の大きさが変わっても、文は動かさない）
  g.font = font; g.fillStyle = INK;
  const xc = W / 2;   // 文は画面の中央にそろえる（丸と線だけが、実物の F キーの上）
  g.fillText(SAVER_NOTE(), xc, y1);   // Xへの投稿のこと（同意してもらう中身）
  if (weak) { g.fillStyle = RED; g.fillText(tr('もう少し、しっかり押してください', 'Press a little more firmly'), xc, y2); }   // 弱くて無視したとき：2行目の代わりに（2秒）
  else {   // 「同意いただける方は」だけ赤
    const w0 = g.measureText(go[0]).width, w1 = g.measureText(go[1]).width, x0 = xc - (w0 + w1) / 2;
    g.textAlign = 'left'; g.fillStyle = RED; g.fillText(go[0], x0, y2); g.fillStyle = INK; g.fillText(go[1], x0 + w0, y2); g.textAlign = 'center';
  }
  g.globalAlpha = 1;
}

// 2枚目（始めたあと）：指の置き方。両手の絵（動かさない。押す動きを見せると「添える」と食い違う）と、その下に一文
function drawHands(S, Hs, t, pb) {
  const fs = S.fs, a = clamp((t - Hs.t0) / 400, 0, 1);
  g.globalAlpha = a;
  const aw = Math.min(W * 0.6, pb * 1.45), ab = handsArt(W / 2, pb * 0.1, aw, t, {keys: [], p: 0});
  const ms = fs * 1.0, [m1, m2] = HANDS_MSG(), y = Math.min(ab + ms * 1.6, pb - ms * 2.8);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 ${ms}px ${FONT}`; g.fillStyle = INK; g.fillText(m1, W / 2, y);
  g.font = `500 ${ms * 0.75}px ${FONT}`; g.fillStyle = '#555'; g.fillText(m2, W / 2, y + ms * 1.5);
  g.globalAlpha = 1;
}
function drawScr(S, scr, t, dt, pb) {
  if (!scr) return;
  if (scr.k === 'saver') drawSaver(S, scr, t, dt, pb);
  else if (scr.k === 'hands') drawHands(S, scr, t, pb);
  else if (scr.k === 'title') drawTitle(S, scr, t, pb);
  else if (scr.k === 'cli') drawCli(S, scr, t, dt, pb);
  else if (scr.k === 'line') drawLine(S, scr, t, dt, pb);
  else if (scr.k === 'x') drawX(S, scr, t, dt, pb);
}

// ================= 体験の登録 =================
const EXP = {
  id: 'dialogue', name: '対話',
  note: 'インストラクターと、LINE・X の画面を行き来する。待機画面にXへの投稿のことを書き、同意した人だけが F を押して始める。来場者の発言は、来場者の指が打つ。ときどき、キーを押して選ぶ',
  use: 'F が上がったら押すか、Enter か「はじめる」で開始',
  opts: {から: START, 言語: LANGS},
  actions: [{label: s => s.running ? '最初から' : 'はじめる', run: s => { document.activeElement?.blur?.(); if (s.running) restart(); else begin(s); }}],
  init(S) {
    setLang(S.o.言語 === 'English' ? 'en' : 'ja');   // 下の帯の「日本語／English」
    queued.fill(false);
    Object.assign(S, {phase: 'saver', running: false, dead: false, tl: [], fs: 28,
      cli: {k: 'cli', inst: null, me: null, gone: []}, sv: newSaver(), slide: null, notif: null, line: null, x: null, title: null, choice: null,
      typing: null, beatT: 0, wakeUp: false});
    S.scr = S.sv;
    S.onKey = e => {
      if (e.target?.tagName === 'INPUT' && e.target.type === 'text') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === 'Enter' || (e.code === 'KeyF' && !writer)) && !S.running && !e.repeat) { e.preventDefault(); document.activeElement?.blur?.(); begin(S); }   // F は、基板がないとき（PC のキーボードで試す）だけ
    };
    S.onPress = e => { if (!writer && S.wakeUp && !S.running && !S.dead && e.detail.key === BEAT_KEY) begin(S); };   // 基板がないとき（PC のキーボードで試す）：上がっている F が押された
    S.onDown = e => {   // 基板があるとき：上がっている F の押し込みを、強さで確かめてから始める
      const d = e.detail;
      if (!S.wakeUp || S.running || S.dead || d.key !== BEAT_KEY) return;
      const early = now() - S.beatT < WAKE_SETTLE_MS, strong = d.ratio >= WAKE_MIN_RATIO;
      status(`待機の押し込み F：強さ ${d.ratio.toFixed(1)}（しきい値の倍。${WAKE_MIN_RATIO} 以上で開始）→ ${early ? '上がった直後なので無視' : strong ? '開始' : '弱いので無視'}`, 4000);
      if (!early && strong) begin(S);
      else if (!early) S.weakT = now();   // 弱くて無視した：画面で「もう少し、しっかり押して」と声をかける（早すぎる押し込みは、画面の表示で防ぐ）
    };
    addEventListener('kc-down', S.onDown);
    addEventListener('keydown', S.onKey);
    addEventListener('kc-press', S.onPress);
    startBeat(S);
    fetch('/api/status').then(r => r.json()).then(j => {
      S.llmOff = !j.llm;
    }).catch(() => { S.llmOff = true; });
  },
  stop(S) { quit(S); },
  draw(S, t, dt) {
    if (S.dead) return;
    const pb = KY - STEP * 0.42;   // 画面（紙）の下の端：キーの列のすぐ上
    S.fs = clamp(STEP * 0.30, 17, 46);
    g.fillStyle = PAPER; g.fillRect(0, 0, W, pb);
    g.save(); g.beginPath(); g.rect(0, 0, W, pb); g.clip();
    if (S.slide) {   // 画面全体が横にスライドする（古い画面は押し出され、新しい画面が入る）
      const sl = S.slide, e = ease3(clamp((t - sl.t0) / sl.dur, 0, 1)), off = W * e * sl.dir;
      g.save(); g.translate(-off, 0); drawScr(S, sl.from, t, dt, pb); g.restore();
      g.save(); g.translate(W * sl.dir - off, 0); drawScr(S, sl.to, t, dt, pb); g.restore();
      const seam = sl.dir > 0 ? W - off : -off;
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(seam - 1, 0, 2, pb);
    } else drawScr(S, S.scr, t, dt, pb);
    g.restore();
    if (S.notif) drawNotif(S, S.notif, t);   // スマホの通知（LINE に入る前）
    const C0 = S.choice;
    // （予測変換の候補とキーの対応は、線ではなく、大きな番号で見せる：候補の①②③と、画面下のキーの番号）
    if (S.choice) drawChoice(S, S.choice, t, pb);   // 選ぶ場面：カードと、中央の箱（キーへの線は、紙の下の端まで）
    window.KC_POST?.place(W, pb);   // 投稿のあとの画面（DOM）を、キーより上に重ねる
  },
};
window.KC_DIALOGUE = EXP;
})();
