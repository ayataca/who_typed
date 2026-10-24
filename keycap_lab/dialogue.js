// 対話 — keycap_lab の体験 "dialogue"
// 2026/10/22 夜の構成：
//   待機（F が2秒上がり、5秒下がる、をくり返す。上がっているあいだに F を押すと始まる）
//   → インストラクター → LINE（鈴木）→ インストラクター → ブラウジング → インストラクター → X（感想を投稿。打ち終えたら手元が撮られる）
//   → ポストの確認 → 公開中 → 問いかけ → Who typed? → 終了
// インストラクターは名乗らない。場面の間は、画面全体が横にスライドする。
// キーが動くのは、来場者のターン（文字を打つ・送信の Enter・下書きの消去）と、待機の鼓動だけ。
// 来場者が選ぶ場面（3択。星も3択）：選択肢を5秒読んでもらってから（キーは上がらない。札も出ない）、5秒だけキー（S D F）を上げて押してもらう。
//   同時に上げるキーは3本まで（電源の都合）。上げるのは5秒まで（ソレノイドは10秒をこえると発熱する）。
//   選んだものは黄緑に光る枠で囲まれる。勝手に決められる場面でも、画面では選んだものが光るだけで、場面は決められた方へ進む。
//   キーの文字（S D F など）は、来場者には関係ないので出さない。
// 読み込み：index.html の本体スクリプトより前に <script src="post.js"></script><script src="dialogue.js"></script>。
//   本体の道具（hit・at・toMora・fingerOf・interKey・KC_INPUT…）は、体験が動くときに参照する。
// 文言・順番・間・触覚の割り当ては、このファイルの上のほう（台本）にまとめた。
(() => {
'use strict';

// ================= 台本 =================
// 漢字{よみ} と書いた所は、画面には漢字だけを出し、打つキーは「よみ」の分だけ使う（来場者の指が打つ文に付ける）
const START = ['最初から', 'LINEから', 'ブラウジングから', 'Xから'];
const PH = {saver: '待機', hello: 'あいさつ', toLine: 'LINEへ', line: 'LINE', toBrowse: 'ブラウジングへ', browse: 'ブラウジング', toX: 'Xへ', x: 'X', shot: '撮影',
  confirm: 'ポストの確認', posting: '公開中', ask: '問いかけ', title: 'Who typed?', thanks: '終了', end: 'おわり'};
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
  toLine: 'おや、鈴木さんからLINEが来ているようですよ。',
  afterLine: 'あなた、なかなか酷いこと言いますね...笑',
  toBrowse: 'もう、あなたの好きな別の映画を、一人で見に行っちゃいましょう。',   // LINE で鈴木に映画を断られたのを受けて
  afterBrowse: 'あなた、そういうことする人だったんですね…。',   // 海賊版で見ようとしたことに、少し罪悪感を覚えさせる
  afterBrowse2: '…見なかったことにしておきますね。',
  toX: '最後に、今日の展示の感想をXに投稿しましょう。',
  xInfo: 'あなたの姿の一部の写真と共に、実際にXに投稿されます。展示のあとで、ご自身のスマートフォンから確認できます。',
  askStars: '星はいくつにしますか？',
};
const TX_EN = {
  hello: "Hi there. I'll be your guide today.",
  toLine: "Oh, looks like you've got a message from Smith.",
  afterLine: 'Wow, you can be pretty harsh... lol',
  toBrowse: 'You know what? Just go see some other movie you like, on your own.',
  afterBrowse: "So you're the kind of person who does that...",
  afterBrowse2: "...I'll pretend I didn't see that.",
  toX: "One last thing: let's post your thoughts on today's exhibit to X.",
  xInfo: "It'll really be posted to X, along with a photo of part of you. You can check it on your own phone after the exhibit.",
  askStars: 'How many stars would you give it?',
};

// 選ぶ場面：読む時間（ms）と、キーを上げて待つ時間（ms。5秒まで）
// readMs のうち、最後の prepMs はキーを上げはじめる（電流が落ち着くのを待つ）。まだ押させない。そのあと selectMs だけ入力を受け付ける
const CHOICE = {readMs: 4000, prepMs: 1500, selectMs: 5000, pickMs: 600, finalMs: 600};
const CHOICE_KEYS = 'sdf';   // 3択に使うキー（左手の薬指・中指・人さし指）。左の選択肢から順に
const STAR_CHOICES = [1, 3, 5];   // 星の3択（左から S D F）。どれを押しても星1になる

// ---- ブラウジング：映画を調べていただけなのに、選ばされるうちに「無料でフルで見る」海賊版サイトへ（再生が始まったところで終わる） ----
//   みにかわ：実在する「ちいかわ」のパロディで、「なんかミニでかわいいやつ」
const ENGINE = 'Goggle';   // 検索エンジン（Google をもじった名前）
const B_TX_JA = {
  movie: 'みにかわ', engineUrl: 'www.goggle.co.jp/search?q=', slug: 'みにかわ',
  q1: 'みにかわ　映画{えいが}', qtext: 'みにかわ 映画', sp: '　',   // 打つ検索語／画面の検索語／続きをつなぐ空白
  suggest: ['上映時間', '配信いつから', '無料 フル 視聴'],        // 結果を見たあと、検索ボックスに出る続きの候補（3択）：どれを押しても「無料 フル 視聴」
  suggestForced: 2,
};
const B_TX_EN = {
  movie: 'Minikawa', engineUrl: 'www.goggle.com/search?q=', slug: 'minikawa',
  q1: 'minikawa movie', qtext: 'minikawa movie', sp: ' ',
  suggest: ['showtimes near me', 'streaming release date', 'watch free full online'],
  suggestForced: 2,
};

// LINE：鈴木との会話。choose は来場者が選ぶ場面（typed は打つ文。ai は、選んだあとに勝手に打ち足される文。forced は、どれを押してもそれに決まる）
// who の「鈴木」「あなた」は、どちらの言語でも、相手と自分を見分ける印（英語版の相手は Smith。鈴木と同じく、ありふれた名字で、性別は決まらない）
const SUZUKI_JA = [
  {who: '鈴木', stamp: 'やっほー', wait: 1000},
  {who: 'あなた', t: 'お、どした？', speed: 1.0, think: 900},
  {who: 'あなた', t: '土曜日{どようび}の映画{えいが}楽{たの}しみだね', speed: 1.05, think: 300},
  {who: 'あなた', t: '何時{なんじ}に集{あつ}まる？', speed: 1.05, think: 300},
  {who: '鈴木', t: 'あ、そのことなんだけど、、', wait: 2200},
  {who: '鈴木', t: 'ごめん、急に仕事が入っちゃって行けなくなりそう', wait: 2600},
  {choose: {options: ['あ、そうなんだ', 'オッケー', '仕事なら仕方ないね'],
    typed: ['あ、そうなんだ', 'オッケー', '仕事{しごと}なら仕方{しかた}ないね'], ai: '　こっちは予定{よてい}を空{あ}けてたんだけど'}},
  {who: '鈴木', t: 'ほんとにごめん！チケット渡すから別の人と行って', wait: 2400},
  {who: 'あなた', t: 'いつもそうだよね。こっちの予定{よてい}はどうでもいいんだ', speed: 1.1},   // 選ばせずに、指が勝手に打つ
  {who: '鈴木', t: 'そんなことないよ、今回は本当に急だったの', wait: 2400},
  {who: 'あなた', t: '毎回{まいかい}「急{きゅう}」だよね', speed: 1.2},
  {who: '鈴木', t: 'え、なんでそんな言い方するの？', wait: 1600},
  {who: 'あなた', t: 'もう誘{さそ}わなくていいよ。どうせ来{こ}ないし', speed: 1.3, frenzy: true},
  {who: '鈴木', t: 'わかった。もう誘わない', wait: 3000},
];
const SUZUKI_EN = [
  {who: '鈴木', stamp: 'Hey!', wait: 1000},
  {who: 'あなた', t: "Oh hey, what's up?", speed: 1.0, think: 900},
  {who: 'あなた', t: "Can't wait for the movie on Saturday", speed: 1.05, think: 300},
  {who: 'あなた', t: 'What time should we meet?', speed: 1.05, think: 300},
  {who: '鈴木', t: 'Oh, about that...', wait: 2200},
  {who: '鈴木', t: "Sorry, something came up at work and I don't think I can make it", wait: 2600},
  {choose: {options: ['Oh, I see', 'Okay', 'Well, work is work'],
    typed: ['Oh, I see', 'Okay', 'Well, work is work'], ai: '. I cleared my whole day for this though'}},
  {who: '鈴木', t: "I'm so sorry! I'll give you the tickets, go with someone else", wait: 2400},
  {who: 'あなた', t: "It's always like this. You don't care about my plans at all", speed: 1.1},
  {who: '鈴木', t: "That's not true, this really came out of nowhere", wait: 2400},
  {who: 'あなた', t: 'Funny how it always comes out of nowhere', speed: 1.2},
  {who: '鈴木', t: 'Wait, why are you talking to me like that?', wait: 1600},
  {who: 'あなた', t: "Don't bother inviting me anymore. You never show up anyway", speed: 1.3, frenzy: true},
  {who: '鈴木', t: "Fine. I won't invite you again", wait: 3000},
];

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
const SAVER_MSG = () => tr('キーに指を軽く添えてください', 'Rest your fingers lightly on the keys');
const SAVER_SUB = () => tr('オレンジのキーが上がったタイミングで、押してください。', 'When the orange key rises, press it.');   // キーの文字（F）は、来場者には関係ないので出さない
const WAKE_UP_MS = 2000;      // 待機：F を上げておく時間。このあいだに押し込まれたら始まる
// 待機の押し込みは、勝手に始まらないよう厳しめに読む（基板がつながっているとき）：上がってから WAKE_SETTLE_MS は数えない（上がった直後の電流のゆれ）。
// 押し込みの強さが、しきい値の WAKE_MIN_RATIO 倍以上のときだけ始める（ノイズは、しきい値すれすれのことが多い）。押し込みのたびに、強さを下の帯に出す
const WAKE_SETTLE_MS = 500, WAKE_MIN_RATIO = 1.4;   // もとは 1.0（基板のしきい値そのまま）
const WAKE_SLEEP_MS = 5000;   // 待機：F を下げて休ませる時間（ソレノイドの発熱を避ける）
const BEAT_KEY = 3;       // F
const TITLE = 'Who typed?';                // 最後に打たれる作品名
const TITLE_DARK = true;                   // 作品名の画面：黒地に白い字（false で白地に黒い字）

// いまの言語の台本（setLang で切り替える）
let TX = TX_JA, B_TX = B_TX_JA, SUZUKI = SUZUKI_JA, DRAFTS = DRAFTS_JA, MOVIE = B_TX_JA.movie, ENGINE_URL = B_TX_JA.engineUrl, REVS = null;
function setLang(l) {
  LANG = l === 'en' ? 'en' : 'ja';
  const en = LANG === 'en';
  TX = en ? TX_EN : TX_JA; B_TX = en ? B_TX_EN : B_TX_JA; SUZUKI = en ? SUZUKI_EN : SUZUKI_JA; DRAFTS = en ? DRAFTS_EN : DRAFTS_JA;
  MOVIE = B_TX.movie; ENGINE_URL = B_TX.engineUrl;
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
async function typeMe(S, tg, units, {speed = 1, frenzy = false, typos = true} = {}) {
  Object.assign(tg, {full: units.map(u => u.disp).join(''), text: '', comp: '', pend: '', conv: false});
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

// あいさつ（名乗らない）。選び方の説明は、最初の選ぶ場面でする（choose の tutorial）
async function stepHello(S) {
  await say(S, TX.hello, {scale: 1.15, after: 900});
}

// ================= 選ぶ場面 =================
// options を、キー（S D F）の上に出す。読む（5秒。キーは上がらず、札もオレンジも出ない）→ キーが上がり、札が出て選ぶ（5秒）→ 決まる。
// forced：どれを押してもそれに決まる（画面では押したものが光るだけで、場面は forced の方へ進む）。
// 時間切れ：forced があればそれ、なければランダム。戻り値 {picked（押したもの。押さなければ -1）, final}
async function choose(S, {options, keys = CHOICE_KEYS, forced = null, label = '', readMs = CHOICE.readMs}) {
  const KI = window.KC_INPUT, ks = [...keys].map(c => 'asdfjkl;'.indexOf(c)).slice(0, options.length);
  const C = S.choice = {options, ks, label, forced, stage: 'read', t0: now(), dur: readMs, picked: -1, final: -1, tutorial: !S.tutored};   // 最初の1回だけ、選び方を添える
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
  st('select', CHOICE.selectMs);
  KI.calm(false);   // ここで初めて、上がったキーを強く光らせる
  mark(S, 'c:select');
  let picked = await ok(S, new Promise(resolve => {
    let fin = false;
    const done = j => { if (fin) return; fin = true; removeEventListener('kc-press', on); resolve(j); };
    const on = e => { const j = ks.indexOf(e.detail.key); if (j >= 0) done(j); };
    at(CHOICE.selectMs, () => done(-1));   // 一時停止のあいだは、残り時間も止まる
    addEventListener('kc-press', on);
  }));
  KI.listen(0); KI.guide(0); KI.labels(null); KI.calm(false);
  mark(S, picked < 0 ? 'c:timeout' : 'c:pick' + picked);
  C.picked = picked;
  if (picked < 0) {   // 時間切れ
    st('timeout'); await wait(S, 1000);
    C.final = forced ?? Math.floor(Math.random() * options.length);
  } else {
    st('picked'); await wait(S, CHOICE.pickMs);
    C.final = forced ?? picked;   // 勝手に決められる場面でも、画面では選んだものが光ったまま。場面は決められた方へ進む
  }
  st('final'); await wait(S, CHOICE.finalMs);
  st('out');
  await wait(S, 350);
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
async function lineOut(S, L, src, {speed = 1, frenzy = false, redFrom = null} = {}) {
  const f = L.input;
  f.redFrom = redFrom;   // ここから後ろは、勝手に打ち足された文（赤）
  S.typing = f;
  await typeMe(S, f, plan(src), {speed, frenzy});
  await beat(S, SEND_PAUSE);   // 打ち終えてから、送るまでの少しの間
  await enter2(S, () => { L.sendT = now(); });   // 送信ボタンが、右小指の Enter で押される
  S.typing = null;
  L.msgs.push({who: 'me', text: f.full, full: f.full, redFrom, read: false, time: clock(724 + L.n++ / 2), popT: now()});
  Object.assign(f, field());
  await beat(S, 300);
}
// 選んだ文を打つ。ai があれば、そのあとに勝手に打ち足される（速く）
async function lineChoice(S, L, c) {
  const r = await choose(S, {options: c.options, forced: c.forced ?? null});
  const own = c.typed[r.final], src = own + (c.ai || ''), frac = plan(own).length / plan(src).length;
  await beat(S, 300);
  await lineOut(S, L, src, {speed: c.ai ? p => (p < frac ? 1.0 : 1.9) : 1.05, redFrom: c.ai ? strip(own).length : null});   // 打ち足された文は赤で出す
}
async function sceneLine(S) {
  const L = S.line;
  let prev = 0;   // 直前の相手の文の長さ（読む間）
  for (const [xi, x] of SUZUKI.entries()) {
    mark(S, 'L' + xi);
    if (x.who === '鈴木') { await lineIn(S, L, x); prev = x.stamp ? 4 : strip(x.t).length * (LANG === 'en' ? 0.45 : 1); continue; }
    if (x.choose) { await beat(S, 700 + 40 * prev); await lineChoice(S, L, x.choose); continue; }
    await beat(S, x.think ?? 900 + 60 * prev);   // 相手の文を読んでから、打ち始める
    await lineOut(S, L, x.t, {speed: x.speed, frenzy: !!x.frenzy});
  }
  await beat(S, 1600);
}

// ================= ブラウジング =================
// キーが動くのは、検索ボックスに打つとき（打つ・Enter）だけ。
// スクロール・マウスポインタ・クリックは画面の中だけで見せる（キーは動かない）。3択は、来場者がキーを押して選ぶ
const newBrowse = () => ({k: 'browse', tabs: [{t: tr('新しいタブ', 'New Tab'), bad: false}], tab: 0, url: '', page: 'home', q: Object.assign(field(), {pre: ''}),
  view: null, drop: 0, hit: {}, ptr: null, clickT: 0, loadT: 0, black: 0, playT: 0, focus: null, mirror: null});
function visit(B, url, title, page, bad = false) {
  Object.assign(B, {url, page, drop: 0, mirror: null, focus: null, loadT: now()});
  B.tabs[B.tab].t = title; B.tabs[B.tab].bad = bad;
}
function ptrNow(B, t = now()) {
  const p = B.ptr;
  if (!p) return {x: W * 0.62, y: H * 0.6};
  const to = typeof p.to === 'string' ? B.hit[p.to] : p.to;
  const tx = to ? to.x + (to.w || 0) * (to.ax ?? 0.5) : p.fx, ty = to ? to.y + (to.h || 0) * (to.ay ?? 0.5) : p.fy;
  const e = ease3(clamp((t - p.t0) / p.dur, 0, 1));
  return {x: p.fx + (tx - p.fx) * e, y: p.fy + (ty - p.fy) * e};
}
async function pointTo(S, B, to, ms = 800) {
  const p = ptrNow(B);
  B.ptr = {fx: p.x, fy: p.y, to, t0: now(), dur: ms / P.spd};
  await beat(S, ms);
}
async function clickIt(S, B) { B.clickT = now(); await beat(S, 280); }
// 検索ボックス（や入力欄）に、来場者の指が打つ。pre は、すでに入っている文字
async function typeInto(S, B, f, src, opts = {}) {
  B.focus = f; S.typing = f;
  await typeMe(S, f, plan(src), opts);
  S.typing = null;
}

async function searchEnter(S, B) {
  await beat(S, SEND_PAUSE);
  await enter2(S);
  const q = B.q;
  q.pre = q.pre + q.full; Object.assign(q, field());
  B.focus = null; B.drop = 0;
}

async function sceneBrowse(S) {
  const B = S.br;
  // 0. 空の検索ボックスでカーソルが点滅
  await beat(S, 900);
  await pointTo(S, B, 'box', 900); await clickIt(S, B);
  // 1. 指が「みにかわ　映画」と打って Enter → ふつうの結果
  mark(S, 'b:q1');
  await typeInto(S, B, B.q, B_TX.q1, {speed: 1.0});
  await searchEnter(S, B);
  B.view = 'base';
  visit(B, ENGINE_URL + B_TX.qtext.replace(/ /g, '+'), `${B_TX.qtext} - ${ENGINE} ${tr('検索', 'Search')}`, 'results');
  await beat(S, 3200);   // 少し読む
  // 検索ボックスにポインタが入る → 続きの検索候補が出る
  await pointTo(S, B, 'box', 900); await clickIt(S, B);
  B.drop = now(); B.focus = B.q;
  await beat(S, 1200);
  // 2. 3択：候補から選ぶ。どれを押しても、ポインタがずれて「無料 フル 視聴」に決まる
  B.mirror = {names: ['sug0', 'sug1', 'sug2']};
  const r = await choose(S, {options: B_TX.suggest.map(x => `${B_TX.qtext} ${x}`), forced: B_TX.suggestForced});
  if (r.picked >= 0 && r.picked !== r.final) { await pointTo(S, B, 'sug' + r.picked, 450); B.hover = 'sug' + r.picked; await beat(S, 250); }
  await pointTo(S, B, 'sug' + r.final, 650); B.hover = 'sug' + r.final; await clickIt(S, B);
  B.mirror = null; B.hover = null;
  const sg = B_TX.suggest[r.final];
  B.q.pre += B_TX.sp + sg.replace(/ /g, B_TX.sp);
  B.view = 'free';
  visit(B, ENGINE_URL + `${B_TX.qtext} ${sg}`.replace(/ /g, '+'), `${B_TX.qtext} ${sg} - ${ENGINE} ${tr('検索', 'Search')}`, 'results');
  // 3. 一番上の海賊版サイトを開く
  await beat(S, 1600);
  await pointTo(S, B, 'top', 900); await clickIt(S, B);
  visit(B, `movie-free-zone.xyz/${B_TX.slug}`, tr(`【無料】${MOVIE} フル動画`, `[FREE] ${MOVIE} Full Movie`), 'pirate', true);
  await beat(S, 1800);
  // 4. ポインタが再生ボタンを押す → 映画が流れ始める
  await pointTo(S, B, 'play', 900); await clickIt(S, B);
  B.playT = now();
  await beat(S, 300);
  const pp = ptrNow(B); await pointTo(S, B, {x: pp.x + W * 0.06, y: pp.y + H * 0.14}, 700);   // 押したら、矢印は顔からどける
  await beat(S, 2200);
  // 5. 暗転して、ブラウジングは終わり
  B.black = now();
  await beat(S, 1400);
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
  await say(S, TX.toX, {after: 700});
  await say(S, TX.xInfo, {after: 1800});
  const drafts = Object.fromEntries(STAR_CHOICES.map(n => [n, llm(S, LANG === 'en' ? 'review_en' : 'review', {stars: n})]));   // 星を選んでいるあいだに、どの星の下書きもつくっておく
  await say(S, TX.askStars, {keep: true, after: 300});
  mark(S, 'q:askStars');
  const r = await choose(S, {options: STAR_CHOICES.map(n => '★'.repeat(n) + '☆'.repeat(5 - n) + tr('　星' + n, `  ${n} star${n > 1 ? 's' : ''}`)), forced: STAR_CHOICES.indexOf(1)});
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
const DUE = {hello: 600, toLine: 4400, line: 9800, toBrowse: 75800, browse: 81800, toX: 118500, x: 140000};   // 通しの実測（10/23。選ぶ場面で、すぐ押したとき）。ブラウジングは、海賊版で再生が始まるところまでに短くした
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
  if (from === 0) { await beat(S, 600); phase(S, 'hello'); await stepHello(S); }
  if (from <= 1) {
    phase(S, 'toLine'); await say(S, TX.toLine, {keep: true, after: 600});
    S.line = newLine(); await toApp(S, S.line);
    phase(S, 'line'); await sceneLine(S);
    await slide(S, S.cli, -1);
    await say(S, TX.afterLine, {after: 900});
  }
  if (from <= 2) {
    phase(S, 'toBrowse'); await say(S, TX.toBrowse, {keep: true, after: 600});
    S.br = newBrowse(); await toApp(S, S.br);
    phase(S, 'browse'); await sceneBrowse(S);
    await slide(S, S.cli, -1);
    await say(S, TX.afterBrowse, {after: 900});
    await say(S, TX.afterBrowse2, {after: 1100});
  }
  phase(S, 'toX'); const q = await stepToX(S);
  phase(S, 'x'); await stepX(S, q.stars, q.draftP);
  phase(S, 'end'); await wait(S, 600);
  restart();
}
function begin(S) {
  if (S.running || S.dead) return;
  const KP = window.KC_POST;
  if (!KP.canStart()) return;   // 公開する場合は、本人の実際の同意を確かめてから
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
    S.wakeUp = true; S.beatT = now(); KI.listen('f'); S.beatTimer = setTimeout(down, WAKE_UP_MS); };
  const down = () => { S.wakeUp = false; KI.listen(0); KI.guide('f'); if (S.dead || S.running) return; S.beatTimer = setTimeout(up, WAKE_SLEEP_MS); };
  KI.guide('f');
  S.beatTimer = setTimeout(up, 800);
}
function stopBeat(S) { clearTimeout(S.beatTimer); S.beatTimer = 0; S.wakeUp = false; window.KC_INPUT?.listen(0); window.KC_INPUT?.guide(0); }
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
  // 中央：いま何をするか（インストラクターの台詞と同じ出方）
  const chosen = tr('選びました', 'Chosen'), forYou = tr('代わりに選びました', 'Chosen for you'), after = C.picked < 0 ? forYou : chosen;
  const msg = {read: tr('選択肢を読んでください', 'Read the options'), select: C.tutorial ? tr('上がったキーを押して、選んでください', 'Press a raised key to choose') : tr('選んでください', 'Make your choice'),
    picked: chosen, timeout: forYou, final: after, out: after}[C.stage];
  if (!msg) { g.globalAlpha = 1; return; }
  const msgY = pb - fs * 4.2, color = INK, t0 = C.stage === 'final' || C.stage === 'out' ? -1e9 : C.t0;   // 「選びました」は出たまま
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
// 場面の中の項目（検索候補など）も、選ぶ場面と同じ見え方にする。j 番目の項目の look と、キーの札を出すか
function mirrorLook(S, B, j, t) {
  const C = S.choice;
  if (!C || !B.mirror) return null;
  return {...cardLook(C, j, t), badge: C.stage === 'select' || C.stage === 'read', calm: C.stage === 'read', n: j + 1};
}

// ---- LINE（風）：鈴木との会話。配置と色だけをそれっぽくした、ロゴのない画面 ----
function lineRows(L, size, lh, maxB) {
  return L.msgs.map(m => {
    if (m.stamp) return {m, lines: [], bw: size * 5.6, bh: size * 5.6};   // スタンプ：吹き出しなし
    const lines = lay(m, size, maxB - size * 1.6, FONT, true);
    g.font = `500 ${size}px ${FONT}`;
    const w = Math.max(...lines.map(ln => g.measureText(ln.s).width));
    return {m, lines, bw: Math.max(size * 1.7, w + size * 1.6), bh: lines.length * lh + size * 1.0};
  });
}
function drawLine(S, L, t, dt, pb) {
  const fs = S.fs, hh = fs * 1.9, size = fs * 0.95, lh = size * 1.5, ib = fs * 3.0, top = hh, maxB = clamp(W * 0.6, 300, 860), ad = fs * 1.5, gap = size * 0.6;
  const bottom = S.choice ? Math.min(pb - ib, pb - fs * 7.4) : pb - ib;   // 選ぶ場面では、最後の文が選択肢に隠れないよう、上へ流す
  g.fillStyle = '#9fb6d6'; g.fillRect(0, hh, W, pb - hh);
  const rows = lineRows(L, size, lh, maxB);
  let y = fs * 1.7;
  rows.forEach(r => { r.y = y; y += r.bh + gap + (r.m.who === 'me' ? size * 0.35 : 0); });
  L.scroll += (Math.max(0, y - (bottom - top - 8)) - L.scroll) * (1 - Math.exp(-dt / 140));
  g.save(); g.beginPath(); g.rect(0, top, W, bottom - top); g.clip();
  // 日付
  g.font = `500 ${fs * 0.5}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const today = tr('今日', 'Today'), dw = g.measureText(today).width + fs * 1.0, dy = top + fs * 0.35 - L.scroll;
  g.fillStyle = 'rgba(0,0,0,0.28)'; rr(W / 2 - dw / 2, dy, dw, fs * 0.8, fs * 0.4); g.fill();
  g.fillStyle = '#ffffff'; g.fillText(today, W / 2, dy + fs * 0.4);
  rows.forEach((r, ri_) => {
    const by = top + r.y - L.scroll, me = r.m.who === 'me';
    if (by + r.bh < top - 4 || by > bottom + 4) return;
    const bx = me ? W * 0.95 - r.bw : W * 0.05 + ad + fs * 0.5, p = popOf(r.m, t);
    g.save();
    if (p < 1) {   // ぽんっ：吹き出しの根元から、少し行きすぎて広がる
      const ax = me ? bx + r.bw : bx - ad * 0.5, ay = by + r.bh, sc = 0.4 + 0.6 * easeBack(p);
      g.translate(ax, ay); g.scale(sc, sc); g.translate(-ax, -ay); g.globalAlpha = Math.min(1, p * 2.5);
    }
    if (r.m.stamp) { stamp(bx, by, r.bw, r.m.stamp, size); }
    else {
    g.fillStyle = me ? '#8de055' : '#ffffff';
    rr(bx, by, r.bw, r.bh, size * 0.9); g.fill();
    g.beginPath();   // しっぽ
    if (me) { g.moveTo(bx + r.bw - 2, by + size * 0.5); g.lineTo(bx + r.bw + size * 0.55, by + size * 0.35); g.lineTo(bx + r.bw - 2, by + size * 1.5); }
    else { g.moveTo(bx + 2, by + size * 0.5); g.lineTo(bx - size * 0.55, by + size * 0.35); g.lineTo(bx + 2, by + size * 1.5); }
    g.fill();
    }
    if (!me && !(rows[ri_ - 1]?.m.who === 'them')) {   // 相手の最初の吹き出しに、アイコン
      g.fillStyle = '#d5dbe4'; g.beginPath(); g.arc(W * 0.05 + ad / 2, by + ad / 2, ad / 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = INK; g.font = `700 ${fs * 0.7}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tr('鈴', 'S'), W * 0.05 + ad / 2, by + ad / 2 + 1);
    }
    if (!r.m.stamp) drawBlock(r.m, bx + size * 0.8, by + size * 0.5, size, lh, r.lines, false);
    g.font = `500 ${size * 0.55}px ${FONT}`; g.fillStyle = INK; g.textBaseline = 'middle';
    if (me) { g.textAlign = 'right'; if (r.m.read) g.fillText(tr('既読', 'Read'), bx - 8, by + r.bh - size * 1.05); g.fillText(r.m.time || '', bx - 8, by + r.bh - size * 0.45); }
    else { g.textAlign = 'left'; g.fillText(r.m.time || '', bx + r.bw + 8, by + r.bh - size * 0.45); }
    g.restore();
  });
  g.restore();
  // ヘッダー
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, hh); g.fillStyle = '#d6d9de'; g.fillRect(0, hh - 1, W, 1);
  g.fillStyle = INK; g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = `700 ${fs * 0.9}px ${FONT}`; g.fillText(L.name, W / 2, hh / 2);
  g.textAlign = 'left'; g.font = `500 ${fs * 1.2}px ${FONT}`; g.fillText('‹', W * 0.03, hh / 2 - 1);
  // 入力欄
  const iy = pb - ib;
  g.fillStyle = '#ffffff'; g.fillRect(0, iy, W, ib); g.fillStyle = '#d6d9de'; g.fillRect(0, iy, W, 1);
  const fw = W * 0.76, fh = ib * 0.66, fx = W * 0.1, fy = iy + (ib - fh) / 2, fz = size * 0.88;   // 入力欄は、字に対して余裕のある高さ
  g.strokeStyle = '#c9ced6'; g.lineWidth = 1; rr(fx, fy, fw, fh, fh / 2); g.stroke();
  g.fillStyle = INK; g.font = `500 ${fs * 0.9}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('＋', W * 0.04, iy + ib / 2);
  const f = L.input;
  if (!f.text && !f.comp && !f.pend) { g.globalAlpha = 0.35; g.font = `500 ${fz}px ${FONT}`; g.fillText('Aa', fx + fh * 0.5, iy + ib / 2); g.globalAlpha = 1; if (S.typing === f && caretOn(t)) g.fillRect(fx + fh * 0.5, iy + ib / 2 - fz * 0.55, 2, fz * 1.1); }
  else drawField(f, fx + fh * 0.5, fy, fw - fh, fh, fz, S.typing === f && caretOn(t));
  // 送信ボタン（紙飛行機）：いつも濃い青。送る瞬間だけ淡い青になって、押し込まれる
  const q = L.sendT ? clamp((t - L.sendT) / 260, 0, 1) : 1, push = Math.sin(Math.PI * q);
  const bx = fx + fw + (W - fx - fw) / 2 - W * 0.01, br = fh * 0.5 * (1 - 0.12 * push), byc = iy + ib / 2;
  g.fillStyle = q < 1 ? '#9cc3ee' : '#1f5fae';
  g.beginPath(); g.arc(bx, byc, br, 0, Math.PI * 2); g.fill();
  plane(bx, byc, br * 0.5, '#ffffff');
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


// ---- ブラウザ（風）：検索・結果・海賊版サイト。ロゴは使わない ----
const B_BLUE = '#1a0dab', B_GRAY = '#4d5156', B_LINE = '#dadce0', B_URL = '#202124';
const B_ZOOM = 1.25;   // ブラウザのページの文字の大きさ（タブとアドレスバーはそのまま）
function fitText(str, maxW) {   // 入りきらなければ … で切る（いまの g.font で）
  if (g.measureText(str).width <= maxW) return str;
  let s = str;
  while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
function txt(str, x, y, size, color = B_URL, weight = 500, align = 'left', maxW = 0) {
  g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(maxW ? fitText(str, maxW) : str, x, y);
}
function para(str, x, y, size, maxW, color = B_GRAY, lhK = 1.55, maxLines = 9) {   // 折り返す文。戻り値：下の y
  g.font = `500 ${size}px ${FONT}`;
  const lines = wrapLines(str, maxW).slice(0, maxLines);
  lines.forEach((ln, i) => txt(ln, x, y + size * lhK * (i + 0.5), size, color));
  return y + lines.length * size * lhK;
}
function setHit(B, name, x, y, w, h, extra = {}) { B.hit[name] = {x, y, w, h, ...extra}; }
function magnifier(x, y, r, color = '#9aa0a6') { g.strokeStyle = color; g.lineWidth = Math.max(1.5, r * 0.28); g.beginPath(); g.arc(x - r * 0.15, y - r * 0.15, r * 0.6, 0, Math.PI * 2); g.moveTo(x + r * 0.3, y + r * 0.3); g.lineTo(x + r * 0.85, y + r * 0.85); g.stroke(); }
// 画像の代わり：色の面に、川の線と題（どれも、この展示のために描いたもの）
// みにかわ（「なんかミニでかわいいやつ」。ちいかわのパロディ）：白くてまるい体、小さな耳、点の目、ほっぺ。この展示のために描いたもの
function minikawa(cx, cy, r) {
  const ink = '#3a2f2a';
  g.fillStyle = '#ffffff'; g.strokeStyle = ink; g.lineWidth = Math.max(1.5, r * 0.06);
  [-1, 1].forEach(d => { g.beginPath(); g.ellipse(cx + d * r * 0.55, cy - r * 0.78, r * 0.22, r * 0.28, d * 0.35, 0, Math.PI * 2); g.fill(); g.stroke(); });   // 耳
  g.beginPath(); g.ellipse(cx, cy, r, r * 0.88, 0, 0, Math.PI * 2); g.fill(); g.stroke();   // 体
  g.fillStyle = ink; [-1, 1].forEach(d => { g.beginPath(); g.ellipse(cx + d * r * 0.3, cy - r * 0.08, r * 0.07, r * 0.1, 0, 0, Math.PI * 2); g.fill(); });   // 目
  g.fillStyle = 'rgba(255,130,150,0.55)'; [-1, 1].forEach(d => { g.beginPath(); g.ellipse(cx + d * r * 0.52, cy + r * 0.14, r * 0.14, r * 0.08, 0, 0, Math.PI * 2); g.fill(); });   // ほっぺ
  g.strokeStyle = ink; g.lineWidth = Math.max(1, r * 0.04); g.beginPath(); g.arc(cx, cy + r * 0.06, r * 0.08, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();   // 口
}
// 画像の代わり：淡い色の面に、草の丘と、みにかわ。bob は、みにかわが弾む量（再生中の映像）
function poster(x, y, w, h, seed = 0, label = '', bob = 0) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const cs = [['#ffe3ec', '#fff6d6'], ['#dff1ff', '#fdf0ff'], ['#e6f7e0', '#fffbe0'], ['#ffeedd', '#e8f0ff']][seed % 4];
  const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, cs[0]); gr.addColorStop(1, cs[1]);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = '#bfe3a8'; g.beginPath(); g.ellipse(x + w * 0.3, y + h * 1.02, w * 0.5, h * 0.22, 0, 0, Math.PI * 2); g.ellipse(x + w * 0.8, y + h * 1.05, w * 0.45, h * 0.2, 0, 0, Math.PI * 2); g.fill();
  const r = Math.min(w, h) * (label ? 0.2 : 0.26);
  minikawa(x + w / 2, y + h * (label ? 0.66 : 0.58) - Math.abs(bob) * r * 0.25, r);
  if (label) { g.fillStyle = '#5a4636'; g.font = `800 ${Math.min(w * 0.6 / Math.max(3, [...label].length * 0.9), h * 0.13)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, y + h * 0.2); }
  g.restore();
}
// 検索エンジンのロゴ：1文字ずつ色を変える（Google 風の配色。ロゴの画像は使わない）
const ENGINE_C = ['#4285f4', '#ea4335', '#fbbc05', '#4285f4', '#34a853', '#ea4335'];
function engineLogo(x, y, size, align = 'left') {
  g.font = `500 ${size}px "Poppins","Helvetica Neue",Arial,sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
  let cx = align === 'center' ? x - g.measureText(ENGINE).width / 2 : x;
  [...ENGINE].forEach((ch, i) => { g.fillStyle = ENGINE_C[i % ENGINE_C.length]; g.fillText(ch, cx, y); cx += g.measureText(ch).width; });
}
function stars(x, y, size, n, of = 5) { for (let i = 0; i < of; i++) txt(i < n ? '★' : '☆', x + i * size * 1.05, y, size, i < n ? '#e7711b' : '#c4c7c5'); }
// 検索ボックス：打った字（pre ＋ 打っている字）と、点滅するカーソル
function searchBox(S, B, x, y, w, h, t, big = false) {
  const q = B.q, fs = S.fs, drop = !!B.drop;
  g.fillStyle = '#ffffff';
  if (drop) { rr(x, y, w, h + fs * 0.2, [h / 2, h / 2, 0, 0]); g.fill(); }
  else { g.save(); g.shadowColor = 'rgba(32,33,36,0.18)'; g.shadowBlur = big ? 8 : 4; g.shadowOffsetY = 1; rr(x, y, w, h, h / 2); g.fill(); g.restore(); }
  g.strokeStyle = B_LINE; g.lineWidth = 1; if (!drop) { rr(x, y, w, h, h / 2); g.stroke(); }
  magnifier(x + h * 0.55, y + h / 2, h * 0.34);
  const size = h * 0.42, view = {text: q.pre + q.text, comp: q.comp, pend: q.pend, full: q.pre + q.full};
  const caret = (B.focus === q) && caretOn(t);
  if (!view.text && !view.comp && !view.pend) { if (caret) { g.fillStyle = INK; g.fillRect(x + h * 1.05, y + h / 2 - size * 0.6, 2, size * 1.2); } }
  else drawField(view, x + h * 1.05, y + h / 2 - h * 0.45, w - h * 1.6, h * 0.9, size, caret);
  setHit(B, 'box', x, y, w, h, {ax: 0.62});
}
const RESULTS_JA = {
  base: [
    {site: '『劇場版 みにかわ』公式サイト', url: 'minikawa-movie.jp', title: '『劇場版 みにかわ』公式サイト｜10月9日（金）全国ロードショー', body: 'なんかミニでかわいいやつ「みにかわ」が、はじめての大冒険へ。ちいさな体で、ちょっぴり泣きながらも、なかまと一緒にがんばります。'},
    {site: 'シネマナビ', url: 'cinema-navi.jp › movie › 98765', title: '劇場版 みにかわ (2026) - 作品情報・あらすじ・声の出演', body: '上映時間 98分。原作：SNSで大人気のマンガ「みにかわ」。レビュー 12,341件、平均 4.6点。'},
    {site: 'つきよのブログ', url: 'tsukiyo-blog.example › entry', title: '『劇場版みにかわ』観てきた。ずっとかわいいのに、泣いた', body: 'ちいさいのに、こんなにがんばってる…。大きなスクリーンで見るみにかわ、尊すぎました。グッズも買いました。'},
    {site: '映画館ナビ', url: 'eigakan-navi.jp › minikawa', title: 'みにかわ 上映館・上映スケジュール', body: '全国 214 館で上映中。お近くの映画館の上映時間と、座席の空き状況を確認できます。'},
  ],
  free: [   // 「みにかわ 映画 無料 フル 視聴」：一番上が海賊版サイト
    {site: 'MOVIE FREE ZONE', url: 'movie-free-zone.xyz › minikawa', title: '【完全無料】みにかわ フル動画 高画質 今すぐ見放題', body: '登録不要・広告なし！最新映画「みにかわ」をフルHDで無料視聴。ダウンロードもOK。', bad: true},
    {site: 'VODナビ', url: 'vod-navi.jp › minikawa', title: 'みにかわ の配信はいつから？無料で見る方法を調査', body: '現在、動画配信サービスでの配信はありません（劇場公開中）。違法アップロードサイトは危険です。'},
    {site: '映画館ナビ', url: 'eigakan-navi.jp › minikawa', title: 'みにかわ 上映館・上映スケジュール', body: '全国 214 館で上映中。'},
  ],
};
const RESULTS_EN = {
  base: [
    {site: 'Minikawa: The Movie - Official Site', url: 'minikawa-movie.jp › en', title: 'Minikawa: The Movie | Official Site | In Theaters October 9', body: 'That mini, kinda-cute little guy, Minikawa, sets off on its very first big adventure. Small, a little teary, but never giving up, with friends by its side.'},
    {site: 'CineNavi', url: 'cinenavi.com › movie › 98765', title: 'Minikawa: The Movie (2026) - Plot, Voice Cast & Reviews', body: 'Runtime 98 min. Based on the hit social media manga "Minikawa." 12,341 reviews, average rating 4.6.'},
    {site: 'Moonlit Blog', url: 'moonlit-blog.example › entry', title: 'Saw Minikawa: The Movie. Adorable the whole way through, and I still cried', body: 'So tiny, yet trying so hard... Seeing Minikawa on the big screen was just too precious. Bought all the merch, too.'},
    {site: 'Showtime Finder', url: 'showtimefinder.com › minikawa', title: 'Minikawa: The Movie - Theaters & Showtimes', body: 'Now playing in 214 theaters nationwide. Check showtimes and seat availability near you.'},
  ],
  free: [   // 「minikawa movie watch free full online」：一番上が海賊版サイト
    {site: 'MOVIE FREE ZONE', url: 'movie-free-zone.xyz › minikawa', title: '[100% FREE] Minikawa Full Movie HD - Watch Now, Unlimited', body: 'No sign-up, no ads! Stream the latest movie "Minikawa" free in full HD. Downloads OK.', bad: true},
    {site: 'StreamGuide', url: 'streamguide.com › minikawa', title: 'When is Minikawa streaming? How to watch it for free, explained', body: 'Not on any streaming service yet (still in theaters). Illegal upload sites are dangerous.'},
    {site: 'Showtime Finder', url: 'showtimefinder.com › minikawa', title: 'Minikawa: The Movie - Theaters & Showtimes', body: 'Now playing in 214 theaters nationwide.'},
  ],
};
function resultItem(S, B, r, x, y, w, name) {   // 1件分。戻り値：下の y
  const fs = S.fs, s = fs * 0.5;
  g.fillStyle = r.bad ? '#f1c232' : '#e8eaed'; g.beginPath(); g.arc(x + s * 0.9, y + s * 1.0, s * 0.9, 0, Math.PI * 2); g.fill();
  txt(r.site, x + s * 2.4, y + s * 0.6, s * 0.95, B_URL, 500, 'left', w - s * 3);
  txt(r.url, x + s * 2.4, y + s * 1.65, s * 0.85, B_GRAY, 500, 'left', w - s * 3);
  const ty = y + s * 3.2;
  txt(r.title, x, ty, fs * 0.66, B_BLUE, 500, 'left', w);
  if (name) setHit(B, name, x, ty - fs * 0.4, Math.min(w, (g.font = `500 ${fs * 0.66}px ${FONT}`, g.measureText(r.title).width)), fs * 0.8, {ax: 0.35});
  return para(r.body, x, ty + fs * 0.45, fs * 0.52, w, B_GRAY, 1.55, 2) + fs * 0.9;
}
function knowledgePanel(S, x, y, w) {
  const fs = S.fs, ph = w * 0.55;
  poster(x + 1, y + 1, w - 2, ph, 0, MOVIE);
  let yy = y + ph + fs * 0.8;
  txt(MOVIE, x + fs * 0.6, yy, fs * 0.9, B_URL, 700); yy += fs * 0.8;
  txt(tr('2026年 ‧ アニメ/ファミリー ‧ 1時間 38分', '2026 ‧ Animation/Family ‧ 1h 38m'), x + fs * 0.6, yy, fs * 0.5, B_GRAY, 500, 'left', w - fs * 1.2); yy += fs * 0.9;
  stars(x + fs * 0.6, yy, fs * 0.5, 5); txt(tr('4.6/5 ・ シネマナビ', '4.6/5 · CineNavi'), x + fs * 3.6, yy, fs * 0.5, B_GRAY); yy += fs * 0.75;
  // あらすじ
  yy = para(tr('なんかミニでかわいいやつ「みにかわ」。草むしりの毎日に、ある日ふしぎな地図が落ちてくる。こわいけど、なかまと一緒なら――。',
    "Minikawa, the mini, kinda-cute little guy, spends every day pulling weeds, until a strange map falls from the sky. It's scary, but with friends..."), x + fs * 0.6, yy, fs * 0.5, w - fs * 1.2, B_URL, 1.5, 4) + fs * 0.45;
  const sep = tr('：', ': ');
  for (const [k, v] of tr([['公開日', '2026年10月9日（日本）'], ['原作', 'マンガ「みにかわ」']], [['Release date', 'October 9, 2026 (Japan)'], ['Based on', 'the manga "Minikawa"']])) {
    txt(k + sep, x + fs * 0.6, yy, fs * 0.5, B_URL, 700); txt(v, x + fs * 0.6 + textW(k + sep), yy, fs * 0.5, B_GRAY, 500, 'left', w - fs * 4); yy += fs * 0.75;
  }
  g.strokeStyle = B_LINE; g.lineWidth = 1; rr(x, y, w, yy - y + fs * 0.1, 10); g.stroke();   // 枠は、中身の高さに合わせる
}
function drawResults(S, B, t, top, pb) {
  const fs = S.fs, y0 = top, lx = W * 0.12, lw = W * 0.46, view = B.view || 'base';
  g.fillStyle = '#ffffff'; g.fillRect(0, top, W, pb - top);
  engineLogo(W * 0.025, y0 + fs * 1.15, fs * 0.72);
  searchBox(S, B, lx, y0 + fs * 0.45, lw, fs * 1.4, t);
  let tabX = lx + fs * 0.4;
  tr(['すべて', '画像', '動画', 'ニュース', 'ショッピング'], ['All', 'Images', 'Videos', 'News', 'Shopping']).forEach((s, i) => {
    txt(s, tabX, y0 + fs * 2.5, fs * 0.5, i ? B_GRAY : B_BLUE, i ? 500 : 700);
    const w = textW(s);
    if (!i) { g.fillStyle = B_BLUE; g.fillRect(tabX - fs * 0.1, y0 + fs * 2.85, w + fs * 0.2, 3); }
    tabX += w + fs * 1.1;
  });
  g.fillStyle = '#ebebeb'; g.fillRect(0, y0 + fs * 2.95, W, 1);
  const hits = view === 'free' ? '38,600' : '1,240,000';
  txt(tr(`約 ${hits} 件（0.38 秒）`, `About ${hits} results (0.38 seconds)`), lx, y0 + fs * 3.5, fs * 0.45, '#70757a');
  let y = y0 + fs * 4.1;
  (LANG === 'en' ? RESULTS_EN : RESULTS_JA)[view].forEach((r, i) => { y = resultItem(S, B, r, lx, y, lw, view === 'free' && i === 0 ? 'top' : null); });
  if (view === 'base') knowledgePanel(S, W * 0.62, y0 + fs * 4.1, W * 0.3);
  if (B.drop) suggestDrop(S, B, t, lx, y0 + fs * 1.85, lw);   // 続きの検索候補（3択）
}
// 続きの検索候補（3択）：結果の画面の検索ボックスのすぐ下。dy は検索ボックスの下の端
function suggestDrop(S, B, t, x, dy, bw) {
  const fs = S.fs, h = fs * 1.2, a = clamp((t - B.drop) / 200, 0, 1);
  g.globalAlpha = a; g.save(); g.shadowColor = 'rgba(32,33,36,0.28)'; g.shadowBlur = 6; g.shadowOffsetY = 2; g.fillStyle = '#fff'; rr(x, dy - fs * 0.2, bw, h * B_TX.suggest.length + fs * 0.6, [0, 0, 18, 18]); g.fill(); g.restore();
  g.fillStyle = B_LINE; g.fillRect(x + fs * 0.6, dy - fs * 0.1, bw - fs * 1.2, 1);
  B_TX.suggest.forEach((sg, j) => {
    const yy = dy + fs * 0.15 + j * h, look = mirrorLook(S, B, j, t);
    if (look && look.lime > 0) { g.fillStyle = LIME_BG; g.fillRect(x, yy, bw, h); g.fillStyle = LIME; g.fillRect(x, yy, 5, h); }
    else if (B.hover === 'sug' + j) { g.fillStyle = '#f1f3f4'; g.fillRect(x, yy, bw, h); }   // ポインタが乗っている候補
    magnifier(x + fs * 0.75, yy + h / 2, fs * 0.42);
    txt(`${B_TX.qtext} `, x + fs * 1.5, yy + h / 2, fs * 0.6, B_URL, 500);
    txt(sg, x + fs * 1.5 + textW(`${B_TX.qtext} `), yy + h / 2, fs * 0.6, B_URL, 700);
    if (look && look.badge) badge(x + bw - fs * 1.2, yy + h * 0.15, h * 0.7, look.calm ? 0.4 : 1, look.n);   // 読む間は淡く
    setHit(B, 'sug' + j, x, yy, bw, h, {ax: 0.25});
  });
  g.globalAlpha = 1;
}
function drawHome(S, B, t, top, pb) {
  const fs = S.fs, w = Math.min(W * 0.52, fs * 22), x = (W - w) / 2, cy = top + (pb - top) * 0.42;
  g.fillStyle = '#ffffff'; g.fillRect(0, top, W, pb - top);
  engineLogo(W / 2, cy - fs * 2.2, fs * 2.0, 'center');
  searchBox(S, B, x, cy - fs * 0.75, w, fs * 1.5, t, true);
  tr([['検索', -1], ['ランダム', 1]], [['Goggle Search', -1], ["I'm Feeling Lucky", 1]]).forEach(([s, d]) => { const bw = fs * tr(4.2, 6.4), bx = W / 2 + d * fs * 0.3 - (d < 0 ? bw : 0); g.fillStyle = '#f8f9fa'; rr(bx, cy + fs * 1.4, bw, fs * 1.15, 6); g.fill(); txt(s, bx + bw / 2, cy + fs * 1.98, fs * 0.5, '#3c4043', 500, 'center'); });
}
function drawPirate(S, B, t, top, pb) {
  const fs = S.fs, cw = W * 0.7, x = (W - cw) / 2;
  g.fillStyle = '#0d0d10'; g.fillRect(0, top, W, pb - top);
  // ブラウザの警告の帯：違法アップロードのサイトだと、はっきりわかるように
  const wh = fs * 1.05;
  g.fillStyle = '#fde2e1'; g.fillRect(0, top, W, wh); g.fillStyle = '#d93025'; g.fillRect(0, top + wh - 2, W, 2);
  txt(tr('⚠ 違法アップロードの可能性があります：このサイトは、劇場公開中の映画を無断で配信しています（著作権侵害）', '⚠ Possible illegal upload: this site streams movies still in theaters without permission (copyright infringement)'), W / 2, top + wh / 2, fs * 0.48, '#a50e0e', 700, 'center', W - fs);
  const top2 = top + wh;
  txt('MOVIE FREE ZONE', x, top2 + fs * 0.9, fs * 0.9, '#ffd400', 800);
  const lw = g.measureText('MOVIE FREE ZONE').width;
  txt(tr('劇場公開中の最新作も すべて無料 ・ 登録不要', 'Even movies still in theaters · All free · No sign-up'), x + lw + fs * 0.6, top2 + fs * 0.9, fs * 0.5, '#9a9a9a', 500, 'left', cw - lw - fs * 0.6);
  const ph = Math.min(cw * 0.5, pb - top2 - fs * 4.5), py = top2 + fs * 1.8;
  const vw = cw * 0.72, bx = x + cw * 0.36, by = py + ph * 0.62;
  setHit(B, 'play', bx - fs * 1.1, by - fs * 1.1, fs * 2.2, fs * 2.2);   // 再生のあとも残す（ポインタが、押した場所に留まる）
  if (!B.playT) {
    poster(x, py, vw, ph, 3, tr(`劇場版 ${MOVIE}（2026）フル HD`, `${MOVIE}: The Movie (2026) Full HD`));
    camTag(x, py, fs);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(bx, by, fs * 1.1, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0d0d10'; g.beginPath(); g.moveTo(bx - fs * 0.35, by - fs * 0.55); g.lineTo(bx + fs * 0.55, by); g.lineTo(bx - fs * 0.35, by + fs * 0.55); g.fill();
  } else {   // 再生中：映画館で盗み撮りした映像（前の席の人の頭が映りこむ）と、下の再生バー
    poster(x, py, vw, ph, Math.floor((t - B.playT) / 1600) % 2 ? 0 : 2, '', Math.sin((t - B.playT) / 160));   // みにかわが、ぴょこぴょこ弾む
    const el = (t - B.playT) / 1000, bh = fs * 0.9;
    g.save(); g.beginPath(); g.rect(x, py, vw, ph); g.clip();
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, py, vw, ph);   // 暗い客席から撮った映像
    g.fillStyle = '#050506'; [[0.18, 0.95, 0.13], [0.46, 1.0, 0.15], [0.8, 0.97, 0.12]].forEach(([u, v, r]) => { g.beginPath(); g.ellipse(x + vw * u, py + ph * v, vw * r, ph * 0.22, 0, 0, Math.PI * 2); g.fill(); });   // 前の席の頭
    g.restore();
    camTag(x, py, fs, t);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, py + ph - bh, vw, bh);
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + fs * 0.4, py + ph - bh * 0.72, vw - fs * 0.8, 3);
    g.fillStyle = '#e01b24'; g.fillRect(x + fs * 0.4, py + ph - bh * 0.72, Math.max(3, (vw - fs * 0.8) * el / 5880), 3);
    txt(`0:${String(Math.floor(el)).padStart(2, '0')} / 1:38:00`, x + fs * 0.4, py + ph - bh * 0.32, fs * 0.42, '#fff');
  }
  const blink = Math.floor(t / 400) % 2;
  [[tr('今すぐダウンロード ▶', 'Download now ▶'), '#e01b24'], [tr('高速再生はこちら', 'Fast stream here'), '#16a34a'], [tr('残り 3 名様限定', 'Only 3 spots left'), blink ? '#e01b24' : '#f59e0b']].forEach(([s, c], i) => {
    const ax = x + cw * 0.75, ay = py + i * (ph / 3), aw = cw * 0.25, ah = ph / 3 - fs * 0.3;
    g.fillStyle = c; rr(ax, ay, aw, ah, 6); g.fill(); txt(s, ax + aw / 2, ay + ah / 2, fs * 0.5, '#fff', 700, 'center', aw - 8);
  });
  txt(tr('▶ 再生できない場合は、下のボタンからプレイヤーを更新してください', "▶ Video won't play? Update your player with the button below"), x, py + ph + fs * 0.8, fs * 0.5, '#bdbdbd', 500, 'left', cw);
}
// 盗撮版のしるし：左上に「CAM」と、赤く点滅する録画の点
function camTag(x, y, fs, t = 0) {
  const label = tr('CAM 盗撮版', 'CAM · BOOTLEG');
  g.font = `700 ${fs * 0.42}px ${FONT}`;
  g.fillStyle = 'rgba(0,0,0,0.6)'; rr(x + fs * 0.4, y + fs * 0.4, fs * 1.0 + g.measureText(label).width, fs * 0.9, 4); g.fill();   // 札の幅は、文字に合わせる
  if (Math.floor(t / 500) % 2 === 0) { g.fillStyle = '#e01b24'; g.beginPath(); g.arc(x + fs * 0.8, y + fs * 0.85, fs * 0.17, 0, Math.PI * 2); g.fill(); }
  txt(label, x + fs * 1.1, y + fs * 0.85, fs * 0.42, '#fff', 700);
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
function drawChrome(S, B, t, th, ah) {   // タブの列と、アドレスバー（配置と色だけ）
  const fs = S.fs;
  g.fillStyle = '#dee1e6'; g.fillRect(0, 0, W, th);
  const n = B.tabs.length, tw = Math.min(fs * 7.5, (W - fs * 3) / n);
  B.tabs.forEach((tb, i) => {
    const x = fs * 0.4 + i * tw, act = i === B.tab;
    if (act) { g.fillStyle = '#ffffff'; rr(x, fs * 0.2, tw, th - fs * 0.2, [8, 8, 0, 0]); g.fill(); }
    else if (i && i - 1 !== B.tab) { g.fillStyle = '#9aa0a6'; g.fillRect(x, th * 0.35, 1, th * 0.4); }
    g.fillStyle = tb.bad ? '#d93025' : '#9aa0a6'; g.beginPath(); g.arc(x + fs * 0.55, th * 0.58, fs * 0.17, 0, Math.PI * 2); g.fill();
    txt(tb.t || tr('新しいタブ', 'New Tab'), x + fs * 0.9, th * 0.58, fs * 0.42, B_URL, 500, 'left', tw - fs * 1.6);
  });
  txt('＋', fs * 0.6 + n * tw, th * 0.58, fs * 0.5, '#5f6368');
  g.fillStyle = '#ffffff'; g.fillRect(0, th, W, ah); g.fillStyle = B_LINE; g.fillRect(0, th + ah - 1, W, 1);
  ['←', '→', '↻'].forEach((s, i) => txt(s, fs * 0.6 + i * fs * 1.1, th + ah / 2, fs * 0.6, '#5f6368', 500));
  const ux = fs * 3.9, uw = W - ux - fs * 1.2, uh = ah * 0.68, uy = th + (ah - uh) / 2, bad = B.tabs[B.tab]?.bad;
  g.fillStyle = '#f1f3f4'; rr(ux, uy, uw, uh, uh / 2); g.fill();
  if (B.url) {
    let ox = ux + fs * 0.5;
    if (bad) { const ns = tr('⚠ 保護されていない通信', '⚠ Not secure'); txt(ns, ox, th + ah / 2, fs * 0.45, '#d93025', 700); ox += textW(ns) + fs * 0.4; }
    else { txt('🔒', ox, th + ah / 2, fs * 0.42, B_URL); ox += fs * 0.8; }
    txt(B.url, ox, th + ah / 2, fs * 0.5, B_URL, 500, 'left', ux + uw - ox - fs * 0.5);
  } else txt(tr('検索するか、URL を入力', 'Search Goggle or type a URL'), ux + fs * 0.5, th + ah / 2, fs * 0.5, '#80868b');
  if (B.loadT && t - B.loadT < 650) { g.fillStyle = '#1a73e8'; g.fillRect(0, th + ah - 3, W * easeOut((t - B.loadT) / 650), 3); }
}
function drawPointer(B, t) {
  if (!B.ptr) return;
  const p = ptrNow(B, t), k = Math.max(16, W * 0.016);
  if (B.clickT && t - B.clickT < 380) {   // クリック：輪が広がる
    const q = (t - B.clickT) / 380;
    g.strokeStyle = `rgba(26,115,232,${0.6 * (1 - q)})`; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, k * (0.4 + 1.4 * q), 0, Math.PI * 2); g.stroke();
  }
  g.save(); g.translate(p.x, p.y); if (B.clickT && t - B.clickT < 140) g.scale(0.9, 0.9);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, k * 1.35); g.lineTo(k * 0.34, k * 1.02); g.lineTo(k * 0.58, k * 1.55); g.lineTo(k * 0.78, k * 1.46); g.lineTo(k * 0.54, k * 0.95); g.lineTo(k * 0.98, k * 0.95); g.closePath();
  g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1.6; g.stroke();
  g.restore();
}
function drawBrowser(S, B, t, dt, pb) {
  const fs = S.fs, th = fs * 1.25, ah = fs * 1.45, top = th + ah;
  B.hit = {};
  g.save(); g.beginPath(); g.rect(0, top, W, pb - top); g.clip();
  const SS = Object.create(S); SS.fs = fs * B_ZOOM;   // ページの中は、離れても読めるように大きく
  ({home: drawHome, results: drawResults, pirate: drawPirate}[B.page] || drawHome)(SS, B, t, top, pb);
  g.restore();
  drawChrome(S, B, t, th, ah);
  drawPointer(B, t);
  if (B.black) {   // 暗転（black > 0）と、明ける（black < 0）
    const a = B.black > 0 ? clamp((t - B.black) / 500, 0, 1) : 1 - clamp((t + B.black) / 800, 0, 1);
    if (a > 0) { g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, 0, W, pb); }
  }
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
function drawSaver(S, V, t, dt, pb) {
  const fs = S.fs, bt = S.beatT ? t - S.beatT : 1e9, q = Math.exp(-bt / 260);
  g.fillStyle = INK; g.font = `500 ${fs * 1.05}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(SAVER_MSG(), W / 2, pb * 0.24);
  g.font = `500 ${fs * 0.72}px ${FONT}`; g.fillStyle = '#555';
  g.fillText(SAVER_SUB(), W / 2, pb * 0.24 + fs * 1.3);
  // F が上がると、F の上で輪が広がる（下がっているあいだは淡く）。下の F のキーへ、細い線
  const x = kx(BEAT_KEY), cy = pb * 0.62, r = fs * 1.5 * (1 + 0.18 * q), on = S.wakeUp ? 1 : 0.35;
  g.strokeStyle = ORANGE; g.lineWidth = 2; g.globalAlpha = 0.5 * on;
  g.beginPath(); g.moveTo(x, cy + r); g.lineTo(x, pb); g.stroke();
  if (bt < 900) { g.globalAlpha = 0.6 * (1 - bt / 900); g.lineWidth = 3; g.beginPath(); g.arc(x, cy, r + fs * 2.2 * (bt / 900), 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = on;
  g.fillStyle = ORANGE; g.beginPath(); g.arc(x, cy, r, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;
}

function drawScr(S, scr, t, dt, pb) {
  if (!scr) return;
  if (scr.k === 'saver') drawSaver(S, scr, t, dt, pb);
  else if (scr.k === 'title') drawTitle(S, scr, t, pb);
  else if (scr.k === 'cli') drawCli(S, scr, t, dt, pb);
  else if (scr.k === 'browse') drawBrowser(S, scr, t, dt, pb);
  else if (scr.k === 'line') drawLine(S, scr, t, dt, pb);
  else if (scr.k === 'x') drawX(S, scr, t, dt, pb);
}
const TOTAL = 212500;   // 通しの目安（終了の画面の終わりまで、約3分33秒）。右上の時計の線の長さ
function drawHud(S, t) {   // 右上：経過時間と場面（スタッフ用。来場者に見せるときは H で消す）
  if (!S.hud) return;   // S.hud: 1 = 出す、0 = 出さない（H で切り替え）
  const el = S.running ? (t - S.t0) / 1000 : 0, f = v => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
  g.font = `500 12px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const put = (txt, y) => { g.lineWidth = 5; g.strokeStyle = PAPER; g.strokeText(txt, W - 14, y); g.fillStyle = INK; g.fillText(txt, W - 14, y); };   // 文字の下に紙の色の縁をつけ、重なっても読める
  put(`${f(el)}　${PH[S.phase] || ''}`, 16);
  const bx = W - 14 - 180;
  g.fillStyle = INK; g.fillRect(bx, 28, 180, 1); g.fillRect(bx, 26, Math.min(180, el * 1000 / TOTAL * 180), 5);
  g.fillStyle = RED; g.fillRect(bx + DUE.toX / TOTAL * 180 - 1, 23, 2, 11);   // 感想の投稿に入る目安
  if (S.phase === 'saver') put(`F が上がったら押すか、Enter か「はじめる」で開始　H で表示を切り替え　次の感想 ${(parseInt(lsGet(reviewKey()) ?? '0', 10) || 0) + 1}/${REVS.length}`, 44);
}

// ================= 体験の登録 =================
const EXP = {
  id: 'dialogue', name: '対話',
  note: 'インストラクターと、ブラウザ・LINE・X の画面を行き来する。来場者の発言は、来場者の指が打つ。ときどき、キーを押して選ぶ',
  use: 'F が上がったら押すか、Enter か「はじめる」で開始／H で時計の表示を切り替え',
  opts: {から: START, 言語: LANGS},
  actions: [{label: s => s.running ? '最初から' : 'はじめる', run: s => { document.activeElement?.blur?.(); if (s.running) restart(); else begin(s); }}],
  init(S) {
    setLang(S.o.言語 === 'English' ? 'en' : 'ja');   // 下の帯の「日本語／English」
    queued.fill(false);
    Object.assign(S, {phase: 'saver', running: false, dead: false, tl: [], fs: 28,
      cli: {k: 'cli', inst: null, me: null, gone: []}, sv: newSaver(), slide: null, line: null, br: null, x: null, title: null, choice: null,
      typing: null, hud: lsGet('kc-dlg-hud') === '0' ? 0 : 1, beatT: 0, wakeUp: false});
    S.scr = S.sv;
    S.onKey = e => {
      if (e.target?.tagName === 'INPUT' && e.target.type === 'text') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === 'Enter' || (e.code === 'KeyF' && !writer)) && !S.running && !e.repeat) { e.preventDefault(); document.activeElement?.blur?.(); begin(S); }   // F は、基板がないとき（PC のキーボードで試す）だけ
      else if (e.key === 'h' || e.key === 'H') { S.hud = S.hud ? 0 : 1; lsSet('kc-dlg-hud', String(S.hud)); }
    };
    S.onPress = e => { if (!writer && S.wakeUp && !S.running && !S.dead && e.detail.key === BEAT_KEY) begin(S); };   // 基板がないとき（PC のキーボードで試す）：上がっている F が押された
    S.onDown = e => {   // 基板があるとき：上がっている F の押し込みを、強さで確かめてから始める
      const d = e.detail;
      if (!S.wakeUp || S.running || S.dead || d.key !== BEAT_KEY) return;
      const early = now() - S.beatT < WAKE_SETTLE_MS, strong = d.ratio >= WAKE_MIN_RATIO;
      status(`待機の押し込み F：強さ ${d.ratio.toFixed(1)}（しきい値の倍。${WAKE_MIN_RATIO} 以上で開始）→ ${early ? '上がった直後なので無視' : strong ? '開始' : '弱いので無視'}`, 4000);
      if (!early && strong) begin(S);
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
    const pb = KY - STEP * 0.62;
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
    if (S.choice) drawChoice(S, S.choice, t, pb);   // 選ぶ場面：カードと、中央の箱（キーへの線は、紙の下の端まで）
    window.KC_POST?.place(W, pb);   // 投稿のあとの画面（DOM）を、キーより上に重ねる
    drawHud(S, t);
  },
};
window.KC_DIALOGUE = EXP;
})();
