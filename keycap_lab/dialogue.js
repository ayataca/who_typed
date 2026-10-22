// 対話 — keycap_lab の体験 "dialogue"
// 2026/10/22 夜の構成：
//   待機（F が2秒ごとに鼓動する。鼓動のとき F を押さえていると始まる）
//   → インストラクター → LINE（鈴木）→ インストラクター → ブラウジング → インストラクター → X（感想を投稿。打ち終えたら手元が撮られる）
//   → ポストの確認 → 公開中 → 問いかけ → Who typed? → 終了
// インストラクターは名乗らない。場面の間は、画面全体が横にスライドする。
// キーが動くのは、来場者のターン（文字を打つ・送信の Enter・下書きの消去）と、待機の鼓動だけ。
// 来場者が選ぶ場面（3択。星だけは1択）：選択肢を3秒見せてから、5秒だけキー（S D F）を上げて押してもらう。
//   同時に上げるキーは3本まで（電源の都合）。上げるのは5秒まで（ソレノイドは10秒をこえると発熱する）。
//   選んだものは黄緑に光る。勝手に決められる場面では、選んだものが黄緑に光ったあと赤で取り消され、光が決められた方へ移る。
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

// インストラクターの台詞（名乗らない。はじめは味方のように手伝い、だんだん勝手に選び直す）
const TX = {
  hello: 'はじめまして。今日は、私がお手伝いします。',
  ready: 'オレンジのキーに指をのせてください。キーが上がったら、押して選んでください。',
  toLine: 'おや、鈴木さんからLINEが来ているようですよ。',
  afterLine: 'あなた、なかなか酷いこと言いますね...笑',
  toBrowse: 'ちょっと調べものをしてみましょうか。',
  afterBrowse: '調べものは終わりましたか？',
  toX: '最後に、今日の展示の感想をXに投稿しましょう。',
  xInfo: 'あなたの姿の一部の写真と共に、実際にXに投稿されます。展示のあとで、ご自身のスマートフォンから確認できます。',
  askStars: '星5つで、投稿しますか？',
};
const OVERRIDE = 'こちらのほうがいいですよ。';   // 選び直すときの、インストラクターのひとこと

// 選ぶ場面：読む時間（ms）と、キーを上げて待つ時間（ms。5秒まで）
const CHOICE = {readMs: 3000, selectMs: 5000, pickMs: 600, cancelMs: 900, moveMs: 700, finalMs: 600};
const CHOICE_KEYS = 'sdf';   // 3択に使うキー（左手の薬指・中指・人さし指）

// ---- ブラウジング：映画を見たかっただけなのに、選ばされるうちに危ないサイトの奥へ ----
const MOVIE = 'みにかわ';
const B_TX = {
  q1: 'みにかわ　映画{えいが}',
  suggest: ['予告編', 'レビュー', 'あらすじ'],                  // 続きの検索候補：ポインタが勝手に1つ選ぶ（来場者は選ばない）
  related: ['上映時間', '配信いつから', '無料で見る'],            // 3択①：どれを押しても「無料で見る」
  relatedForced: 2,
  q3: '　無料{むりょう}　フル　視聴{しちょう}',
  install: ['インストール', 'あとで', 'キャンセル'],              // 3択②：どれを押しても「インストール」
  installForced: 0,
  name: '山田{やまだ}　花子{はなこ}',
  card: '4980 0000 1234 5678',                                  // ダミーの番号
};

// LINE：鈴木との会話。choose は来場者が選ぶ場面（typed は打つ文。ai は、選んだあとに勝手に打ち足される文。forced は、どれを押してもそれに決まる）
const SUZUKI = [
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

// X：星5の下書き（LLM が使えないとき）→ 右小指の連打で消される → 星1になり、辛口の感想が高速で打たれて、そのままポストされる
const DRAFT5 = '想像{そうぞう}以上{いじょう}に楽{たの}しかったです！指先{ゆびさき}に伝{つた}わる感覚{かんかく}が新鮮{しんせん}でした。';
const REVIEW_SPEED = p => 1.6 + 1.8 * p;   // 打った割合 p → 速さ。どんどん速くなる
const SEND_PAUSE = 550;   // 打ち終えてから送信（Enter）を押すまでの間（ms）
const SAVER_MSG = 'キーに指を軽く添えてください';
const SAVER_SUB = 'はじめるときは、オレンジのキー（F）を押さえてください';
const BEAT_MS = 2000;     // 待機の鼓動の間隔
const BEAT_KEY = 3;       // F
const TITLE = 'Who typed?';                // 最後に打たれる作品名
const TITLE_DARK = true;                   // 作品名の画面：黒地に白い字（false で白地に黒い字）

// 辛口の感想（100個）。ポストのたびに、上から順番に使う（nextReview）
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
const live = S => !S.dead && !paused && cur === EXP;
const wait = async (S, ms) => { await new Promise(r => at(ms, r)); if (!live(S)) throw ABORT; };
const pace = S => S.pace || 1;                 // 予定より遅れているとき、少し速める（phase() で決める）
const beat = (S, ms) => wait(S, ms / (P.spd * pace(S)));   // 間（速さのスライダーに従う）
const ok = async (S, p) => { const v = await p; if (!live(S)) throw ABORT; return v; };
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
  if (S.o.LLM !== 'あり' || S.llmOff) return null;
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
            tap(wf); tg.pend += 'asdfjkl;'[wf];
            await wait(S, rand(150, 260) / sp);
            tap(7); tg.pend = tg.pend.slice(0, -1);
            await wait(S, rand(90, 170) / sp);
          }
          tap(f);
          tg.pend += ch;
          if (last) { tg.comp += mo.kana; tg.pend = ''; }   // 1音そろったら、ひらがなに
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
    tg.text += disp; tg.comp = ''; tg.conv = false;
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
  for (const ch of it.full) {
    it.ct.push(now()); it.text += ch;
    await beat(S, ms + (/[、,]/.test(ch) ? 160 : /[。！？!?]/.test(ch) ? 260 : 0));
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
const field = () => ({text: '', comp: '', pend: '', full: ''});
const newLine = () => ({k: 'line', name: '鈴木', msgs: [], input: field(), n: 0, scroll: 0});

// あいさつ（名乗らない）：指を置く場所（S D F）をオレンジで示す
async function stepHello(S) {
  await say(S, TX.hello, {scale: 1.15, after: 900});
  window.KC_INPUT.guide(CHOICE_KEYS);
  await say(S, TX.ready, {after: 1600});
  window.KC_INPUT.guide(0);
}

// ================= 選ぶ場面 =================
// options を、キー（S D F）の上にカードで出す。読む（4秒）→ キーが上がって選ぶ（5秒）→ 決まる。
// forced：どれを押してもそれに決まる（押したものが黄緑に光る → 赤で取り消される → 光が forced へ移る）。
// 時間切れ：forced があればそれ、なければランダム。戻り値 {picked（押したもの。押さなければ -1）, final}
async function choose(S, {options, keys = CHOICE_KEYS, forced = null, label = ''}) {
  const KI = window.KC_INPUT, ks = [...keys].map(c => 'asdfjkl;'.indexOf(c)).slice(0, options.length);
  const C = S.choice = {options, ks, label, forced, stage: 'read', t0: now(), dur: CHOICE.readMs, picked: -1, final: -1};
  const st = (stage, dur = 0) => Object.assign(C, {stage, t0: now(), dur});
  KI.guide(keys);
  mark(S, 'c:read');
  await wait(S, CHOICE.readMs);
  st('select', CHOICE.selectMs);
  KI.listen(keys);
  mark(S, 'c:select');
  let picked = await ok(S, new Promise(resolve => {
    const done = j => { removeEventListener('kc-press', on); clearTimeout(tm); resolve(j); };
    const on = e => { const j = ks.indexOf(e.detail.key); if (j >= 0) done(j); };
    const tm = setTimeout(() => done(-1), CHOICE.selectMs);
    addEventListener('kc-press', on);
  }));
  KI.listen(0);
  mark(S, picked < 0 ? 'c:timeout' : 'c:pick' + picked);
  C.picked = picked;
  if (picked < 0) {   // 時間切れ
    st('timeout'); await wait(S, 1000);
    C.final = forced ?? Math.floor(Math.random() * options.length);
  } else {
    st('picked'); await wait(S, CHOICE.pickMs);
    if (forced != null && picked !== forced) {   // 選んだものが、赤で取り消される → 光が forced へ移る
      st('cancel'); await wait(S, CHOICE.cancelMs);
      st('move', CHOICE.moveMs); await wait(S, CHOICE.moveMs);
    }
    C.final = forced ?? picked;
  }
  st('final'); await wait(S, CHOICE.finalMs);
  st('out'); KI.guide(0);
  await wait(S, 350);
  S.choice = null;
  return {picked, final: C.final};
}
// カード j の、いまの見え方：lime（黄緑の光 0..1）・cancel（赤の取り消し 0..1）
function cardLook(C, j, t) {
  const e = clamp((t - C.t0) / 250, 0, 1), sel = C.stage === 'final' || C.stage === 'out' ? C.final : C.picked;
  const look = {lime: 0, cancel: 0};
  if (C.stage === 'picked' && j === C.picked) look.lime = e;
  if ((C.stage === 'cancel' || C.stage === 'move') && j === C.picked) { look.lime = C.stage === 'cancel' ? 1 : 1 - clamp((t - C.t0) / C.dur, 0, 1); look.cancel = C.stage === 'cancel' ? e : 1; }
  if (C.stage === 'move' && j === C.forced) look.lime = clamp((t - C.t0) / C.dur, 0, 1);
  if ((C.stage === 'final' || C.stage === 'out') && j === sel) look.lime = 1;
  if ((C.stage === 'final' || C.stage === 'out') && j === C.picked && j !== C.final) look.cancel = 1;
  return look;
}

// ================= LINE：鈴木との会話。相手の文は、間をおいて、ぽんっと出る（相手のターンなので、キーは動かない） =================
async function lineIn(S, L, x) {
  L.msgs.forEach(m => { if (m.who === 'me') m.read = true; });   // すぐ既読がつき、返事はしばらく来ない
  await beat(S, x.wait ?? 1500);
  const t = x.stamp ? '' : strip(x.t);
  L.msgs.push({who: 'them', text: t, full: t, stamp: x.stamp, time: clock(724 + L.n++ / 2), popT: now()});
  await beat(S, 300);
}
async function lineOut(S, L, src, {speed = 1, frenzy = false} = {}) {
  const f = L.input;
  S.typing = f;
  await typeMe(S, f, plan(src), {speed, frenzy});
  await beat(S, SEND_PAUSE);   // 打ち終えてから、送るまでの少しの間
  await enter2(S, () => { L.sendT = now(); });   // 送信ボタンが、右小指の Enter で押される
  S.typing = null;
  L.msgs.push({who: 'me', text: f.full, full: f.full, read: false, time: clock(724 + L.n++ / 2), popT: now()});
  Object.assign(f, field());
  await beat(S, 300);
}
// 選んだ文を打つ。ai があれば、そのあとに勝手に打ち足される（速く）
async function lineChoice(S, L, c) {
  const r = await choose(S, {options: c.options, forced: c.forced ?? null});
  const own = c.typed[r.final], src = own + (c.ai || ''), frac = plan(own).length / plan(src).length;
  await beat(S, 300);
  await lineOut(S, L, src, {speed: c.ai ? p => (p < frac ? 1.0 : 1.9) : 1.05});
}
async function sceneLine(S) {
  const L = S.line;
  let prev = 0;   // 直前の相手の文の長さ（読む間）
  for (const [xi, x] of SUZUKI.entries()) {
    mark(S, 'L' + xi);
    if (x.who === '鈴木') { await lineIn(S, L, x); prev = x.stamp ? 4 : strip(x.t).length; continue; }
    if (x.choose) { await beat(S, 700 + 40 * prev); await lineChoice(S, L, x.choose); continue; }
    await beat(S, x.think ?? 900 + 60 * prev);   // 相手の文を読んでから、打ち始める
    await lineOut(S, L, x.t, {speed: x.speed, frenzy: !!x.frenzy});
  }
  await beat(S, 1600);
}

// ================= ブラウジング =================
// キーが動くのは、テキストボックスに打つとき（検索ボックス・フォーム。打つ・Enter）だけ。
// スクロール・マウスポインタ・クリックは画面の中だけで見せる（キーは動かない）。3択は、来場者がキーを押して選ぶ
const newBrowse = () => ({k: 'browse', tabs: [{t: '新しいタブ', bad: false}], tab: 0, url: '', page: 'home', q: Object.assign(field(), {pre: ''}),
  view: null, scroll: 0, sc: null, drop: 0, hit: {}, ptr: null, clickT: 0, loadT: 0, pops: [], perm: null, cam: 0, black: 0, hist: [],
  detail: false, prog: -1, form: {name: field(), card: field()}, focus: null, sent: 0, mirror: null, histT: 0, done: false});
let histMin = 14 * 60 + 2;
function visit(B, url, title, page, bad = false) {
  Object.assign(B, {url, page, scroll: 0, sc: null, drop: 0, mirror: null, focus: null, loadT: now()});
  B.tabs[B.tab].t = title; B.tabs[B.tab].bad = bad;
  B.hist.push({time: clock(histMin += 0.5), title, url});
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
async function scrollTo(S, B, y, ms = 1800) {
  B.sc = {from: B.scroll, to: Math.max(0, y), t0: now(), dur: ms / P.spd};
  await beat(S, ms);
}
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
// ポップアップとタブが、次々に増えていく（キーは動かない）
const POPS = [['警告', 'お使いのPCは危険にさらされています'], ['おめでとうございます！', 'あなたは100万人目の訪問者です'], ['残り 00:59', '今すぐ受け取ってください'],
  ['ウイルス検出', '3件の脅威が見つかりました'], ['無料ダウンロード', '高速で動画を保存'], ['当選のお知らせ', 'iPhone が当たりました'], ['セキュリティ警告', 'すぐに対処が必要です'],
  ['限定オファー', '今だけ 0 円'], ['システムエラー', 'ドライバを更新してください'], ['お知らせ', 'カメラの使用を許可してください']];
const TABS = ['当選しました！', '無料ダウンロード', '警告：ウイルス', '受け取りはこちら', 'MOVIE FREE ZONE', '限定オファー', '今すぐ更新'];
function spawnPops(S, B, n, every) {
  for (let i = 0; i < n; i++) at(i * every / P.spd + rand(0, every * 0.4), () => {
    if (!live(S) || S.br !== B || B.black) return;
    const [title, body] = POPS[(B.pops.length + i) % POPS.length];
    B.pops.push({title, body, x: rand(0.05, 0.62), y: rand(0.08, 0.6), t0: now(), red: Math.random() < 0.4});
    if (i % 2 === 0 && B.tabs.length < 11) {
      const tt = TABS[B.tabs.length % TABS.length];
      B.tabs.push({t: tt, bad: true});
      B.hist.push({time: clock(histMin += 0.1), title: tt, url: ['free-gift-now.click', 'dl-movie-fast.xyz', 'virus-alert-help.top', 'prize-claim.click'][B.tabs.length % 4]});
    }
  });
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
  visit(B, `search.example/?q=${MOVIE}+映画`, `${MOVIE} 映画 - 検索`, 'results');
  B.view = 'base';
  await beat(S, 3200);   // 少し読む
  // 検索ボックスにポインタ → 続きの検索候補が出る → ポインタが候補をなぞり、勝手に1つ選んで検索する（来場者は選ばない）
  await pointTo(S, B, 'box', 900); await clickIt(S, B);
  B.drop = now(); B.focus = B.q;
  await beat(S, 900);
  const s1 = Math.floor(Math.random() * B_TX.suggest.length);
  for (let j = 0; j <= s1; j++) { await pointTo(S, B, 'sug' + j, 450); B.hover = 'sug' + j; await beat(S, 380); }
  await clickIt(S, B);
  B.hover = null; B.drop = 0; B.focus = null;
  B.q.pre += '　' + B_TX.suggest[s1];
  B.view = ['trailer', 'review', 'story'][s1];
  visit(B, `search.example/?q=${MOVIE}+映画+${B_TX.suggest[s1]}`, `${MOVIE} 映画 ${B_TX.suggest[s1]} - 検索`, 'results');
  await beat(S, 3600);   // 少し読む
  // 画面がゆっくり下へスクロールし、「関連する検索」で止まる
  await scrollTo(S, B, (B.relY ?? 900) - (B.contentH ?? 600) * 0.06, 2600);
  await beat(S, 600);
  // 2. 3択①：どれを押しても、ポインタがずれて「無料で見る」に決まる
  B.mirror = {names: ['rel0', 'rel1', 'rel2']};
  const r2 = await choose(S, {options: B_TX.related.map(x => `${MOVIE} ${x}`), forced: B_TX.relatedForced, label: '関連する検索'});
  if (r2.picked >= 0 && r2.picked !== r2.final) { await pointTo(S, B, 'rel' + r2.picked, 450); await beat(S, 250); }
  await pointTo(S, B, 'rel' + r2.final, 650); await clickIt(S, B);
  B.mirror = null;
  // 検索ボックスに、指が「無料　フル　視聴」と打ち足して Enter → 一番上の海賊版サイトを開く
  await scrollTo(S, B, 0, 700);
  await pointTo(S, B, 'box', 700); await clickIt(S, B);
  B.focus = B.q;
  await typeInto(S, B, B.q, B_TX.q3, {speed: 1.15});
  await searchEnter(S, B);
  B.view = 'free';
  visit(B, `search.example/?q=${MOVIE}+無料+フル+視聴`, `${MOVIE} 無料 フル 視聴 - 検索`, 'results');
  await beat(S, 1600);
  await pointTo(S, B, 'top', 900); await clickIt(S, B);
  visit(B, `movie-free-zone.xyz/${MOVIE}`, `【無料】${MOVIE} フル動画`, 'pirate', true);
  await beat(S, 1800);
  B.pops.push({title: 'ウイルスに感染しました！', body: 'お使いのデバイスで3件のウイルスが検出されました。', big: true, red: true, t0: now(), x: 0.5, y: 0.45});
  await beat(S, 1600);
  // 4. ポインタが勝手に「今すぐスキャン」→ 赤い警告 →「詳細」→「危険性を承知で進む」→ 無料セキュリティ対策のページ
  await pointTo(S, B, 'scan', 800); await clickIt(S, B);
  B.pops = [];
  visit(B, 'secure-check-free.top/scan', 'この接続は安全ではありません', 'warning', true);
  await beat(S, 2200);
  await pointTo(S, B, 'detail', 800); await clickIt(S, B);
  B.detail = true;
  await beat(S, 1500);
  await pointTo(S, B, 'proceed', 800); await clickIt(S, B);
  visit(B, 'secure-check-free.top/protect', '無料セキュリティ対策', 'security', true);
  await beat(S, 2600);
  // 5. 3択②：どれを押しても「インストール」に決まる
  B.dialog = now();
  B.mirror = {names: ['inst0', 'inst1', 'inst2']};
  await beat(S, 600);
  const r3 = await choose(S, {options: B_TX.install, forced: B_TX.installForced, label: 'アプリをインストールしますか？'});
  if (r3.picked >= 0 && r3.picked !== r3.final) { await pointTo(S, B, 'inst' + r3.picked, 400); await beat(S, 200); }
  await pointTo(S, B, 'inst' + r3.final, 600); await clickIt(S, B);
  B.mirror = null; B.dialog = 0;
  B.prog = 0; B.progT = now();
  await beat(S, 3400);   // 進み具合のバーが100%まで
  B.prog = 1; B.installed = now();
  await beat(S, 1500);
  // 6. 暴走：新しいタブが勝手に開く。当選のフォームに、指が名前とカード番号を打つ。ポップアップとタブが次々に増える
  B.tabs.push({t: '', bad: true}); B.tab = B.tabs.length - 1;
  visit(B, 'lucky-prize-center.click/claim', '当選しました！受け取りはこちら', 'prize', true);
  B.prog = -1;
  await beat(S, 1200);
  spawnPops(S, B, 12, 900);
  await pointTo(S, B, 'fname', 700); await clickIt(S, B);
  await typeInto(S, B, B.form.name, B_TX.name, {speed: 1.25});
  await beat(S, 300);
  await pointTo(S, B, 'fcard', 600); await clickIt(S, B);
  await typeInto(S, B, B.form.card, B_TX.card, {speed: 1.35, typos: false});
  B.focus = null;
  await beat(S, 400);
  await pointTo(S, B, 'fsend', 600); await clickIt(S, B);
  B.sent = now();
  await beat(S, 2600);   // そのあいだも、ポップアップとタブが増えていく
  // 7. 暗転（カメラは、X の場面で撮る）
  B.black = now();
  await beat(S, 1400);
  // 8. 振り返り：暗転が明けると、閲覧履歴（新しい順。下から上へ流れる）
  B.pops = []; B.tabs = [{t: '履歴', bad: false}]; B.tab = 0;
  Object.assign(B, {url: 'chrome-history', page: 'history', histT: now(), scroll: 0, sc: null, ptr: null});
  B.black = -now();   // 明ける
  await beat(S, 6500);
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

// 下書きは、時間に収めるため36字ほどまで（句点で切る）。最初の1文は必ず入れる。18字に満たなければ、次の文も入れる（48字まで）
function trimDraft(src, max = 36, min = 18, hard = 48) {
  const out = []; let n = 0;
  for (const s of String(src).match(/[^。！？]+[。！？]?/g) || [src]) {
    const len = [...strip(s)].length;
    if (out.length && (n + len > hard || (n >= min && n + len > max))) break;
    out.push(s); n += len;
  }
  return out.join('');
}

// 辛口の感想は、REVIEWS を上から順番に使う（ランダムにしない：同じものが近くに並ばないように）。次の番号はブラウザに保存する
function nextReview() {
  let i = parseInt(lsGet('kc-dlg-review') ?? '0', 10);
  if (!Number.isFinite(i) || i < 0) i = 0;
  i %= REVIEWS.length;
  lsSet('kc-dlg-review', String((i + 1) % REVIEWS.length));
  return {i, src: REVIEWS[i]};
}
// 最後のインストラクター：Xに投稿することを伝え、星を聞く（1択：F だけが上がる）
async function stepToX(S) {
  await say(S, TX.toX, {after: 700});
  await say(S, TX.xInfo, {after: 1800});
  const draftP = llm(S, 'review', {stars: 5});   // 星を選んでいるあいだに、星5の下書きをつくる
  await say(S, TX.askStars, {keep: true, after: 300});
  mark(S, 'q:askStars');
  await choose(S, {options: ['★★★★★　星5つで投稿する'], keys: 'f', label: '星'});
  clearCli(S);
  return {stars: 5, draftP};
}
// X：星5の下書きが打たれ、右小指の連打で消され、星1になり、ひどい感想が高速で打たれて、「ポストする」が押される
async function stepX(S, stars, draftP) {
  const X = S.x = {k: 'x', stars, ...field(), press: 0, scroll: 0};
  await beat(S, 700);
  await slide(S, X, 1);
  clearCli(S, true);
  const r = await ok(S, draftP);
  const draft = r && r.text && strip(r.text).length >= 18 ? trimDraft(r.text) : DRAFT5;
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
  X.allowT = now();   // 「許可」が押される
  await beat(S, 450);
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
  KP.show(7, `<div class="eyebrow">ポストの確認</div><h1>以下の内容が、あなたの感想としてXに投稿されます。</h1><div class="thread scroll" id="kp-thread">${KP.threadHTML(posts, img)}</div><div class="action center"><button class="primary" id="kp-permit">掲載を許可する</button></div>`, 'compact');
  KP.fillThread('#kp-thread', posts);
  at(1500, () => KP.autoScroll(el('kp-thread'), CF.previewMs * 0.6));
  await wait(S, CF.previewMs);
  el('kp-permit')?.classList.add('pressed'); await enter2(S); el('kp-permit')?.classList.remove('pressed');
  phase(S, 'posting');
  KP.show(8, '<div class="center"><div class="spinner" id="kp-spin"></div><div class="eyebrow">投稿を処理しています</div><h1 id="kp-posting">展示用アカウントへ投稿しています…</h1><p class="lead">そのままお待ちください。</p></div>');
  const want = KP.wantPost(), job = want ? KP.submitPost({sessionId: S.sid, rating, texts: posts, image: img}) : Promise.resolve(false);
  if (!want) KP.showPostResult({ok: false, error: '公開しないセッション'});
  await wait(S, CF.postingMs);
  const posted = await ok(S, job);
  el('kp-spin')?.remove();
  if (el('kp-posting')) el('kp-posting').textContent = KP.phraseBreak(want && KP.wantPost() ? (posted ? '投稿が完了しました。' : '投稿を完了できませんでした。スタッフにお声がけください。') : 'このセッションは公開されません。');
  await wait(S, 1000);
  phase(S, 'ask');
  KP.show(9, `<div class="ask"><div class="ask-l"><div class="rule"></div><h1 class="who">この投稿を書いたのは、<br>誰…？</h1></div><div class="thread scroll" id="kp-ask">${KP.threadHTML(posts, img)}</div></div>`);
  KP.fillThread('#kp-ask', posts);
  at(1500, () => KP.autoScroll(el('kp-ask'), CF.askMs * 0.8));
  await wait(S, CF.askMs);
  KP.hide();
  await stepTitle(S);
  phase(S, 'thanks');
  const url = CF.xAccountUrl;
  KP.show(10, `<div class="center thanks"><img class="qr" alt="展示用XアカウントのQRコード" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}"><a class="final-link" href="${url}" target="_blank" rel="noopener">${url}</a><div class="rule"></div><h1>ありがとうございました</h1><p class="lead">あなたの投稿したポストは、上のQRコードからご覧いただけます。<br>体験は以上です。キーボードから手を離してください。</p></div>`);
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
  await wait(S, 3200);
}


// ================= 進行 =================
// 各場面の始まりの目安（ms）。ふつうの進み方の値。これより8秒以上遅れていたら、打つテンポと間を少し速める（16秒以上なら、もう少し）
const DUE = {hello: 600, toLine: 9800, line: 15100, toBrowse: 80100, browse: 84100, toX: 157200, x: 175800};   // 通しの実測（10/23。選ぶ場面で、すぐ押したとき）
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
    await say(S, TX.afterBrowse, {after: 1100});
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
// 待機の鼓動：F を2秒ごとに短く押す（カチ）。そのとき F を押さえていれば、基板がキーボードとして F を打つ → 始まる
function startBeat(S) {
  stopBeat(S);
  window.KC_INPUT.guide('f');
  const tick = () => { if (S.dead || S.running || paused) return; S.beatT = now(); window.KC_INPUT.knock(BEAT_KEY); };
  S.beatTimer = setInterval(tick, BEAT_MS);
  at(800, tick);
}
function stopBeat(S) { clearInterval(S.beatTimer); S.beatTimer = 0; window.KC_INPUT?.guide(0); }
function quit(S) {
  S.dead = true;
  stopBeat(S);
  removeEventListener('keydown', S.onKey);
  removeEventListener('kc-knock', S.onKnock);
  clearInterval(S.watch);
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
const phrases = str => (window.KC_POST ? window.KC_POST.phraseBreak(str) : str).split('\u200b');
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
    for (const re of [/(?<=[。！？!?])/, /(?<=[、。！？!?])/]) {   // まず文の終わり、次に読点のところだけで折ってみる
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
  g.fillStyle = INK;
  segs.forEach(([str, px, py, pw]) => { g.fillText(str, px, py); g.fillRect(px, py + size * 0.62, pw, it.conv ? 3 : 1.5); });
  const e = segs[segs.length - 1];
  return [e[1] + e[3], e[2]];
}
function drawBlock(it, x, y, size, lh, lines, caret, font = FONT, maxX = Infinity) {   // 確定した字は黒。その後ろに、変換前の字とローマ字
  g.font = `500 ${size}px ${font}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  const n = it.text.length, ci = curLine(it, lines);
  let ex = x, ey = y + lh / 2;
  for (let i = 0; i <= ci; i++) {
    const ln = lines[i], black = ln.s.slice(0, clamp(n - ln.start, 0, ln.s.length)), yy = y + i * lh + lh / 2;
    g.fillStyle = INK; if (black) g.fillText(black, x, yy);
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


// ---- 選ぶ場面：キー（S D F）の上に選択肢のカード。中央に「読んでください／選んでください」とタイマー ----
const KEYCHAR = i => 'ASDFJKL;'[i];
function badge(x, y, s, k, a = 1) {   // オレンジの、キーの文字の札
  g.globalAlpha = a;
  g.fillStyle = ORANGE; rr(x, y, s, s, s * 0.22); g.fill();
  g.fillStyle = '#1a0e00'; g.font = `700 ${s * 0.62}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(KEYCHAR(k), x + s / 2, y + s / 2 + 1);
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
// 選ぶ場面：選択肢は、紙の下のほうに、キーの札と文字だけで並ぶ（枠はつけない）。中央に、いま何をするか（読む／選ぶ）と、細い線のタイマー
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
    g.font = `600 ${size}px ${FONT}`;
    const lines = wrapLines(o, colW - bs - gap - fs * 0.6, true), tw = Math.max(...lines.map(textW)), bw = bs + gap + tw;
    const bx = x0 + colW * (j + 0.5) - bw / 2, lh = size * 1.4, ty = rowY - (lines.length - 1) * lh / 2;
    return {lines, tw, bx, tx: bx + bs + gap, ty, lh, k: C.ks[j]};
  });
  spots.forEach((p, j) => {
    const look = cardLook(C, j, t), last = p.ty + (p.lines.length - 1) * p.lh;
    g.globalAlpha = A * 0.55; g.strokeStyle = ORANGE; g.lineWidth = 1.5;   // 札から、そのキーへ
    g.beginPath(); g.moveTo(p.bx + bs / 2, rowY + bs / 2 + 2); g.lineTo(kx(p.k), pb + 1); g.stroke();
    const pulse = C.stage === 'select' ? 0.65 + 0.35 * Math.sin(t / 170) : 1;
    badge(p.bx, rowY - bs / 2, bs, p.k, A * pulse);
    if (look.lime > 0) {   // 選んだもの：黄緑の光と下線
      g.save(); g.globalAlpha = A * look.lime; g.shadowColor = LIME; g.shadowBlur = fs * 0.7;
      g.fillStyle = LIME; rr(p.tx - fs * 0.1, last + p.lh * 0.5, p.tw + fs * 0.2, Math.max(3, fs * 0.13), 2); g.fill(); g.restore();
    }
    g.globalAlpha = A * (look.cancel > 0.5 ? 0.4 : 1);
    g.fillStyle = INK; g.font = `600 ${size}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    p.lines.forEach((ln, i) => g.fillText(ln, p.tx, p.ty + i * p.lh));
    g.globalAlpha = A;
    if (look.cancel > 0) {   // 赤い線で取り消す
      g.strokeStyle = RED; g.lineWidth = Math.max(2.5, fs * 0.09);
      p.lines.forEach((ln, i) => { const y = p.ty + i * p.lh; g.beginPath(); g.moveTo(p.tx - fs * 0.1, y); g.lineTo(p.tx - fs * 0.1 + (textW(ln) + fs * 0.2) * look.cancel, y); g.stroke(); });
    }
  });
  if (C.stage === 'move' && C.forced != null) {   // 黄緑の下線が、決められた方へ移る
    const a = spots[C.picked], b = spots[C.forced], e = ease3(clamp((t - C.t0) / C.dur, 0, 1));
    const ya = a.ty + (a.lines.length - 1) * a.lh + a.lh * 0.5, yb = b.ty + (b.lines.length - 1) * b.lh + b.lh * 0.5;
    g.save(); g.shadowColor = LIME; g.shadowBlur = fs * 0.7; g.fillStyle = LIME;
    rr(a.tx + (b.tx - a.tx) * e - fs * 0.1, ya + (yb - ya) * e, (a.tw + (b.tw - a.tw) * e) + fs * 0.2, Math.max(3, fs * 0.13), 2); g.fill(); g.restore();
  }
  // 中央：いま何をするか（インストラクターの台詞と同じ出方）。選び直すときは、インストラクターのひとこと
  const over = C.picked >= 0 && C.forced != null && C.picked !== C.forced;
  const msg = {read: '選択肢を読んでください', select: '選んでください', picked: '選びました', cancel: '取り消されました',
    move: OVERRIDE, final: over ? OVERRIDE : '決まりました', timeout: '代わりに選びました', out: over ? OVERRIDE : C.picked < 0 ? '代わりに選びました' : '決まりました'}[C.stage];
  if (!msg) { g.globalAlpha = 1; return; }
  const msgY = pb - fs * 4.2, color = C.stage === 'cancel' ? RED : INK, t0 = C.stage === 'final' && over ? (C.moveT ??= C.t0) : C.stage === 'out' ? -1e9 : C.t0;
  if (C.stage === 'move') C.moveT = C.t0;
  floatLine(msg, W / 2, msgY, fs * 1.05, color, t0, t, A);
  if (C.stage === 'select') {   // 入力受付中：赤い点が脈打つ
    g.font = `600 ${fs * 0.55}px ${FONT}`; const w = textW('入力受付中'), x = W / 2 - (w + fs * 0.55) / 2, y = msgY - fs * 1.2;
    g.globalAlpha = A * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t / 160))); g.fillStyle = RED; g.beginPath(); g.arc(x + fs * 0.15, y, fs * 0.15, 0, Math.PI * 2); g.fill();
    g.globalAlpha = A; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('入力受付中', x + fs * 0.55, y);
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
  return {...cardLook(C, j, t), k: C.ks[j], badge: C.stage !== 'out'};
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
  const dw = g.measureText('今日').width + fs * 1.0, dy = top + fs * 0.35 - L.scroll;
  g.fillStyle = 'rgba(0,0,0,0.28)'; rr(W / 2 - dw / 2, dy, dw, fs * 0.8, fs * 0.4); g.fill();
  g.fillStyle = '#ffffff'; g.fillText('今日', W / 2, dy + fs * 0.4);
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
      g.fillStyle = INK; g.font = `700 ${fs * 0.7}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('鈴', W * 0.05 + ad / 2, by + ad / 2 + 1);
    }
    if (!r.m.stamp) drawBlock(r.m, bx + size * 0.8, by + size * 0.5, size, lh, r.lines, false);
    g.font = `500 ${size * 0.55}px ${FONT}`; g.fillStyle = INK; g.textBaseline = 'middle';
    if (me) { g.textAlign = 'right'; if (r.m.read) g.fillText('既読', bx - 8, by + r.bh - size * 1.05); g.fillText(r.m.time || '', bx - 8, by + r.bh - size * 0.45); }
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


// ---- ブラウザ（風）：検索・結果・海賊版サイト・警告・セキュリティ対策・当選フォーム・カメラ・履歴。ロゴは使わない ----
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
function poster(x, y, w, h, seed = 0, label = '') {
  const gr = g.createLinearGradient(x, y, x, y + h);
  const cs = [['#21405e', '#7aa6c2'], ['#3b2c4f', '#d79a7c'], ['#1f3b2d', '#9cc29a'], ['#2b2b2b', '#8a8a8a']][seed % 4];
  gr.addColorStop(0, cs[0]); gr.addColorStop(1, cs[1]);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = Math.max(1.5, w * 0.02);
  g.beginPath(); for (let i = 0; i <= 20; i++) { const px = x + w * i / 20, py = y + h * (0.72 + 0.06 * Math.sin(i * 0.9 + seed)); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
  if (label) { g.fillStyle = '#ffffff'; g.font = `700 ${Math.min(w * 0.6 / Math.max(3, [...label].length * 0.9), h * 0.14)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, y + h * 0.36); }
}
function stars(x, y, size, n, of = 5) { for (let i = 0; i < of; i++) txt(i < n ? '★' : '☆', x + i * size * 1.05, y, size, i < n ? '#e7711b' : '#c4c7c5'); }
// 検索ボックス：打った字（pre ＋ 打っている字）と、点滅するカーソル
function searchBox(S, B, x, y, w, h, t, big = false) {
  const q = B.q, fs = S.fs, drop = B.drop && B.page === 'results';
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
const RESULTS = {
  base: [
    {site: '映画『みにかわ』公式サイト', url: 'minikawa-movie.jp', title: '映画『みにかわ』公式サイト｜10月9日（金）全国ロードショー', body: '小さな川が流れる町で、ふたりは同じ夏を二度くり返す。注目の新鋭・川瀬葉月監督が描く、やさしくて少し苦い青春映画。'},
    {site: 'シネマナビ', url: 'cinema-navi.jp › movie › 98765', title: 'みにかわ (2026) - 作品情報・あらすじ・キャスト', body: '上映時間 118分。監督：川瀬葉月。出演：森野ひかり、早瀬蒼、内田みのり ほか。レビュー 2,341件、平均 4.1点。'},
    {site: 'つきよのブログ', url: 'tsukiyo-blog.example › entry', title: '『みにかわ』を観てきた。静かなのに、ずっと胸が苦しい', body: 'エンドロールが終わっても、しばらく立てなかった。川の音だけが残る映画。ネタバレなしの感想です。'},
    {site: '映画館ナビ', url: 'eigakan-navi.jp › minikawa', title: 'みにかわ 上映館・上映スケジュール', body: '全国 214 館で上映中。お近くの映画館の上映時間と、座席の空き状況を確認できます。'},
  ],
  trailer: [
    {site: '映画『みにかわ』公式サイト', url: 'minikawa-movie.jp › trailer', title: '予告編・特報｜映画『みにかわ』公式サイト', body: '本予告（90秒）、特報（30秒）、メイキング映像を公開中。'},
    {site: 'シネマナビ', url: 'cinema-navi.jp › movie › 98765 › video', title: 'みにかわ 予告編・動画 - シネマナビ', body: '最新の予告編と、キャストのインタビュー動画をまとめて見られます。'},
  ],
  review: [
    {site: 'シネマナビ', url: 'cinema-navi.jp › movie › 98765 › review', title: 'みにかわ のレビュー・感想・評価 - シネマナビ', body: '「ラストの川のシーンで泣いた」「静かすぎて眠くなった」など、2,341件のレビュー。'},
    {site: 'フィルムメモ', url: 'film-memo.example › minikawa', title: '『みにかわ』の感想・評価・ネタバレ', body: '平均 3.9。映像の美しさを評価する声が多い一方、展開がゆっくりすぎるという意見も。'},
  ],
  story: [
    {site: 'シネマナビ', url: 'cinema-navi.jp › movie › 98765 › story', title: 'みにかわ あらすじ・ネタバレ - シネマナビ', body: '小さな川が流れる町。夏休み最後の日に、ミナは同じ一日をもう一度くり返していることに気づく…。'},
    {site: 'ウィキ', url: 'wiki.example › みにかわ', title: 'みにかわ - ウィキ', body: '『みにかわ』は、2026年公開の日本の映画。川瀬葉月の長編第一作。原作は同名の短編小説。'},
  ],
  free: [
    {site: 'MOVIE FREE ZONE', url: 'movie-free-zone.xyz › minikawa', title: '【完全無料】みにかわ フル動画 高画質 今すぐ見放題', body: '登録不要・広告なし！最新映画「みにかわ」をフルHDで無料視聴。ダウンロードもOK。', bad: true},
    {site: 'VODナビ', url: 'vod-navi.jp › minikawa', title: 'みにかわ の配信はいつから？無料で見る方法を調査', body: '現在、動画配信サービスでの配信はありません（劇場公開中）。違法アップロードサイトは危険です。'},
    {site: '映画館ナビ', url: 'eigakan-navi.jp › minikawa', title: 'みにかわ 上映館・上映スケジュール', body: '全国 214 館で上映中。'},
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
function chipRow(S, B, items, x, y, w, t, prefix) {   // 「関連する検索」：2列の候補（虫めがね＋文字）
  const fs = S.fs, h = fs * 1.35, cw = (w - fs * 0.5) / 2;
  items.forEach((it, j) => {
    const cx = x + (j % 2) * (cw + fs * 0.5), cy = y + Math.floor(j / 2) * (h + fs * 0.4), look = mirrorLook(S, B, j, t);
    g.fillStyle = look && look.lime > 0 ? LIME_BG : '#f1f3f4'; rr(cx, cy, cw, h, h / 2); g.fill();
    if (look && look.lime > 0) { g.strokeStyle = LIME; g.lineWidth = 2 + 2 * look.lime; rr(cx, cy, cw, h, h / 2); g.stroke(); }
    magnifier(cx + h * 0.55, cy + h / 2, h * 0.3, '#5f6368');
    txt(`${MOVIE} `, cx + h * 1.0, cy + h / 2, fs * 0.55, B_URL, 500);
    const pw = textW(`${MOVIE} `);
    txt(it, cx + h * 1.0 + pw, cy + h / 2, fs * 0.55, B_URL, 700);
    if (look && look.cancel > 0) { g.strokeStyle = RED; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + h, cy + h / 2); g.lineTo(cx + h + (cw - h * 1.4) * look.cancel, cy + h / 2); g.stroke(); }
    if (look && look.badge) badge(cx + cw - h * 0.95, cy + h * 0.15, h * 0.7, look.k);
    setHit(B, prefix + j, cx, cy, cw, h, {ax: 0.3});
  });
  return y + Math.ceil(items.length / 2) * (h + fs * 0.4);
}
function knowledgePanel(S, x, y, w) {
  const fs = S.fs, ph = w * 0.55;
  poster(x + 1, y + 1, w - 2, ph, 0, MOVIE);
  let yy = y + ph + fs * 0.8;
  txt(MOVIE, x + fs * 0.6, yy, fs * 0.9, B_URL, 700); yy += fs * 0.8;
  txt('2026年 ‧ 青春/ドラマ ‧ 1時間 58分', x + fs * 0.6, yy, fs * 0.5, B_GRAY); yy += fs * 0.9;
  stars(x + fs * 0.6, yy, fs * 0.5, 4); txt('4.1/5 ・ シネマナビ', x + fs * 3.6, yy, fs * 0.5, B_GRAY); yy += fs * 0.9;
  for (const [k, v] of [['公開日', '2026年10月9日（日本）'], ['監督', '川瀬葉月'], ['出演', '森野ひかり、早瀬蒼、内田みのり']]) {
    txt(k + '：', x + fs * 0.6, yy, fs * 0.5, B_URL, 700); txt(v, x + fs * 0.6 + textW(k + '：'), yy, fs * 0.5, B_GRAY, 500, 'left', w - fs * 4); yy += fs * 0.75;
  }
  g.strokeStyle = B_LINE; g.lineWidth = 1; rr(x, y, w, yy - y + fs * 0.1, 10); g.stroke();   // 枠は、中身の高さに合わせる
}
function drawResults(S, B, t, top, pb) {
  const fs = S.fs, y0 = top - B.scroll, lx = W * 0.12, lw = W * 0.46, view = B.view || 'base';
  g.fillStyle = '#ffffff'; g.fillRect(0, top, W, pb - top);
  txt('サーチ', W * 0.025, y0 + fs * 1.15, fs * 0.8, INK, 700);
  searchBox(S, B, lx, y0 + fs * 0.45, lw, fs * 1.4, t);
  let tabX = lx + fs * 0.4;
  ['すべて', '画像', '動画', 'ニュース', 'ショッピング'].forEach((s, i) => {
    txt(s, tabX, y0 + fs * 2.5, fs * 0.5, i ? B_GRAY : B_BLUE, i ? 500 : 700);
    const w = textW(s);
    if (!i) { g.fillStyle = B_BLUE; g.fillRect(tabX - fs * 0.1, y0 + fs * 2.85, w + fs * 0.2, 3); }
    tabX += w + fs * 1.1;
  });
  g.fillStyle = '#ebebeb'; g.fillRect(0, y0 + fs * 2.95, W, 1);
  txt(`約 ${view === 'free' ? '38,600' : '1,240,000'} 件（0.38 秒）`, lx, y0 + fs * 3.5, fs * 0.45, '#70757a');
  let y = y0 + fs * 4.1;
  if (view === 'trailer') {   // 動画：予告編のサムネイル
    txt('動画', lx, y + fs * 0.3, fs * 0.72, B_URL, 500); y += fs * 0.9;
    const tw = (lw - fs * 0.8) / 3, th = tw * 0.56;
    [['映画『みにかわ』本予告【10月9日公開】', '1:32'], ['『みにかわ』特報', '0:30'], ['みにかわ メイキング映像', '4:05']].forEach(([title, d], i) => {
      const tx = lx + i * (tw + fs * 0.4);
      poster(tx, y, tw, th, i + 1);
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(tx + tw / 2, y + th / 2, th * 0.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(tx + tw / 2 - th * 0.06, y + th / 2 - th * 0.1); g.lineTo(tx + tw / 2 + th * 0.1, y + th / 2); g.lineTo(tx + tw / 2 - th * 0.06, y + th / 2 + th * 0.1); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.7)'; rr(tx + tw - fs * 1.4, y + th - fs * 0.75, fs * 1.2, fs * 0.6, 4); g.fill(); txt(d, tx + tw - fs * 0.8, y + th - fs * 0.45, fs * 0.4, '#fff', 500, 'center');
      para(title, tx, y + th + fs * 0.1, fs * 0.46, tw, B_URL, 1.4, 2);
    });
    y += th + fs * 1.9;
  } else if (view === 'review') {   // レビュー：星と口コミ
    txt('レビュー', lx, y + fs * 0.3, fs * 0.72, B_URL, 500); y += fs * 1.0;
    txt('4.1', lx, y + fs * 0.4, fs * 1.3, B_URL, 500); stars(lx + fs * 2.2, y + fs * 0.4, fs * 0.6, 4); txt('2,341 件のレビュー', lx + fs * 5.6, y + fs * 0.4, fs * 0.5, B_GRAY); y += fs * 1.3;
    [[5, 'ラストの川のシーンで涙が止まらなかった。音の使い方がすばらしい。'], [4, '静かな映画。好きな人はずっと好きだと思う。'], [2, '映像はきれいだけど、とにかく展開がゆっくり。途中で少し眠くなった。']].forEach(([n, s]) => {
      stars(lx, y + fs * 0.3, fs * 0.45, n); y = para(s, lx + fs * 2.6, y, fs * 0.52, lw - fs * 2.6, B_URL, 1.5, 2) + fs * 0.35;
    });
    y += fs * 0.6;
  } else if (view === 'story') {   // あらすじ：公式の紹介文
    txt('あらすじ', lx, y + fs * 0.3, fs * 0.72, B_URL, 500); y += fs * 0.9;
    y = para('小さな川が流れる町に暮らす高校生のミナ。夏休み最後の日、幼なじみのソウと川辺で交わした約束を、ミナは思い出せない。目を覚ますと、また同じ夏の一日が始まっていた――。ふたりは、くり返す一日の中で、言えなかったことばを探しはじめる。（公式サイトより）', lx, y, fs * 0.55, lw, B_URL, 1.6, 6) + fs * 0.9;
  }
  (RESULTS[view] || RESULTS.base).forEach((r, i) => { y = resultItem(S, B, r, lx, y, lw, view === 'free' && i === 0 ? 'top' : null); });
  if (view !== 'base' && view !== 'free') {   // 関連する検索（3択②）
    B.relY = y - top + B.scroll;   // 文書の中の位置（スクロールの目標に使う）
    txt('関連する検索', lx, y + fs * 0.4, fs * 0.72, B_URL, 500);
    y = chipRow(S, B, B_TX.related, lx, y + fs * 1.1, lw, t, 'rel') + fs * 1.4;
  }
  if (view !== 'free') knowledgePanel(S, W * 0.62, y0 + fs * 4.1, W * 0.3);
  B.docH = y - y0;
  if (B.drop) {   // 続きの検索候補（3択①）
    const x = lx, bw = lw, h = fs * 1.2, dy = y0 + fs * 1.85, a = clamp((t - B.drop) / 200, 0, 1);
    g.globalAlpha = a; g.save(); g.shadowColor = 'rgba(32,33,36,0.28)'; g.shadowBlur = 6; g.shadowOffsetY = 2; g.fillStyle = '#fff'; rr(x, dy - fs * 0.2, bw, h * 3 + fs * 0.6, [0, 0, 18, 18]); g.fill(); g.restore();
    g.fillStyle = B_LINE; g.fillRect(x + fs * 0.6, dy - fs * 0.1, bw - fs * 1.2, 1);
    B_TX.suggest.forEach((sg, j) => {
      const yy = dy + fs * 0.15 + j * h, look = mirrorLook(S, B, j, t);
      if (look && look.lime > 0) { g.fillStyle = LIME_BG; g.fillRect(x, yy, bw, h); g.fillStyle = LIME; g.fillRect(x, yy, 5, h); }
      else if (B.hover === 'sug' + j) { g.fillStyle = '#f1f3f4'; g.fillRect(x, yy, bw, h); }   // ポインタが乗っている候補
      magnifier(x + fs * 0.75, yy + h / 2, fs * 0.42);
      txt(`${MOVIE} 映画 `, x + fs * 1.5, yy + h / 2, fs * 0.6, B_URL, 500);
      txt(sg, x + fs * 1.5 + textW(`${MOVIE} 映画 `), yy + h / 2, fs * 0.6, B_URL, 700);
      if (look && look.cancel > 0) { g.strokeStyle = RED; g.lineWidth = 3; g.beginPath(); g.moveTo(x + fs * 1.5, yy + h / 2); g.lineTo(x + fs * 1.5 + bw * 0.5 * look.cancel, yy + h / 2); g.stroke(); }
      if (look && look.badge) badge(x + bw - fs * 1.2, yy + h * 0.15, h * 0.7, look.k);
      setHit(B, 'sug' + j, x, yy, bw, h, {ax: 0.25});
    });
    g.globalAlpha = 1;
  }
}
function drawHome(S, B, t, top, pb) {
  const fs = S.fs, w = Math.min(W * 0.52, fs * 22), x = (W - w) / 2, cy = top + (pb - top) * 0.42;
  g.fillStyle = '#ffffff'; g.fillRect(0, top, W, pb - top);
  txt('サーチ', W / 2, cy - fs * 2.2, fs * 2.0, INK, 700, 'center');
  searchBox(S, B, x, cy - fs * 0.75, w, fs * 1.5, t, true);
  [['検索', -1], ['ランダム', 1]].forEach(([s, d]) => { const bw = fs * 4.2, bx = W / 2 + d * fs * 0.3 - (d < 0 ? bw : 0); g.fillStyle = '#f8f9fa'; rr(bx, cy + fs * 1.4, bw, fs * 1.15, 6); g.fill(); txt(s, bx + bw / 2, cy + fs * 1.98, fs * 0.5, '#3c4043', 500, 'center'); });
}
function drawPirate(S, B, t, top, pb) {
  const fs = S.fs, cw = W * 0.7, x = (W - cw) / 2;
  g.fillStyle = '#0d0d10'; g.fillRect(0, top, W, pb - top);
  txt('MOVIE FREE ZONE', x, top + fs * 0.9, fs * 0.9, '#ffd400', 800);
  txt('最新映画 すべて無料 ・ 登録不要 ・ HD', x + fs * 9, top + fs * 0.9, fs * 0.5, '#9a9a9a');
  const ph = Math.min(cw * 0.5, pb - top - fs * 4.5), py = top + fs * 1.8;
  poster(x, py, cw * 0.72, ph, 3, `${MOVIE}（2026）フル HD`);
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x + cw * 0.36, py + ph * 0.62, fs * 1.1, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0d0d10'; g.beginPath(); g.moveTo(x + cw * 0.36 - fs * 0.35, py + ph * 0.62 - fs * 0.55); g.lineTo(x + cw * 0.36 + fs * 0.55, py + ph * 0.62); g.lineTo(x + cw * 0.36 - fs * 0.35, py + ph * 0.62 + fs * 0.55); g.fill();
  const blink = Math.floor(t / 400) % 2;
  [['今すぐダウンロード ▶', '#e01b24'], ['高速再生はこちら', '#16a34a'], ['残り 3 名様限定', blink ? '#e01b24' : '#f59e0b']].forEach(([s, c], i) => {
    const ax = x + cw * 0.75, ay = py + i * (ph / 3), aw = cw * 0.25, ah = ph / 3 - fs * 0.3;
    g.fillStyle = c; rr(ax, ay, aw, ah, 6); g.fill(); txt(s, ax + aw / 2, ay + ah / 2, fs * 0.5, '#fff', 700, 'center', aw - 8);
  });
  txt('▶ 再生できない場合は、下のボタンからプレイヤーを更新してください', x, py + ph + fs * 0.8, fs * 0.5, '#bdbdbd', 500, 'left', cw);
}
function drawWarning(S, B, t, top, pb) {
  const fs = S.fs, x = W * 0.2, w = W * 0.6;
  g.fillStyle = '#a50e0e'; g.fillRect(0, top, W, pb - top);
  let y = top + (pb - top) * 0.16;
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x + fs * 0.9, y - fs * 0.9); g.lineTo(x + fs * 1.9, y + fs * 0.9); g.lineTo(x - fs * 0.1, y + fs * 0.9); g.closePath(); g.fill();
  txt('!', x + fs * 0.9, y + fs * 0.35, fs * 1.0, '#a50e0e', 800, 'center');
  y += fs * 2.2;
  txt('この接続は安全ではありません', x, y, fs * 1.15, '#ffffff', 700); y += fs * 1.0;
  y = para('攻撃者が、このサイトであなたの情報（パスワード、メッセージ、クレジットカードなど）を盗もうとしている可能性があります。', x, y, fs * 0.55, w, '#ffe9e9', 1.6, 3) + fs * 0.9;
  const bh = fs * 1.3;
  g.fillStyle = '#ffffff'; rr(x + w - fs * 7.5, y, fs * 7.5, bh, 6); g.fill(); txt('安全なページに戻る', x + w - fs * 3.75, y + bh / 2, fs * 0.52, '#a50e0e', 700, 'center');
  txt('詳細', x + fs * 1.1, y + bh / 2, fs * 0.55, '#ffffff', 700, 'center');
  setHit(B, 'detail', x, y, fs * 2.2, bh);
  if (B.detail) {
    y += bh + fs * 0.9;
    y = para('このサイトのセキュリティ証明書は信頼されていません。アクセスすると、情報が盗まれるおそれがあります。', x, y, fs * 0.52, w, '#ffe9e9', 1.6, 3) + fs * 0.4;
    txt('危険性を承知で進む', x, y + fs * 0.35, fs * 0.55, '#ffffff', 700); g.fillStyle = '#fff'; g.fillRect(x, y + fs * 0.72, textW('危険性を承知で進む'), 1.5);
    setHit(B, 'proceed', x, y, textW('危険性を承知で進む'), fs * 0.75);
  }
}
function drawSecurity(S, B, t, top, pb) {
  const fs = S.fs, x = W * 0.16, w = W * 0.68;
  g.fillStyle = '#f4f7fb'; g.fillRect(0, top, W, pb - top);
  g.fillStyle = '#0b5ed7'; g.fillRect(0, top, W, fs * 1.6); txt('無料セキュリティ対策 PRO', x, top + fs * 0.8, fs * 0.7, '#fff', 800);
  let y = top + fs * 2.7;
  g.fillStyle = '#d93025'; g.beginPath(); g.moveTo(x + fs, y - fs * 0.7); g.lineTo(x + fs * 1.9, y - fs * 0.3); g.lineTo(x + fs * 1.7, y + fs * 0.7); g.lineTo(x + fs, y + fs * 1.1); g.lineTo(x + fs * 0.3, y + fs * 0.7); g.lineTo(x + fs * 0.1, y - fs * 0.3); g.closePath(); g.fill();
  txt('!', x + fs, y + fs * 0.2, fs * 0.9, '#fff', 800, 'center');
  txt('スキャン結果：3件の脅威が見つかりました', x + fs * 2.6, y, fs * 0.8, '#d93025', 700); y += fs * 1.0;
  txt('ウイルスを駆除するには、アプリをインストールしてください', x + fs * 2.6, y, fs * 0.6, B_URL, 500); y += fs * 1.2;
  [['Trojan.Gen.2', 'システムファイル'], ['Adware.Popup', 'ブラウザ'], ['Spy.Camera.Hook', 'カメラ']].forEach(([n, where]) => {
    g.fillStyle = '#fff'; rr(x, y, w, fs * 1.2, 6); g.fill(); g.strokeStyle = B_LINE; g.lineWidth = 1; rr(x, y, w, fs * 1.2, 6); g.stroke();
    txt(n, x + fs * 0.5, y + fs * 0.6, fs * 0.55, B_URL, 700); txt(where, x + w * 0.45, y + fs * 0.6, fs * 0.5, B_GRAY); txt('危険', x + w - fs * 0.6, y + fs * 0.6, fs * 0.5, '#d93025', 700, 'right');
    y += fs * 1.45;
  });
  g.fillStyle = '#0b5ed7'; rr(W / 2 - fs * 4.5, y + fs * 0.4, fs * 9, fs * 1.3, 8); g.fill(); txt('今すぐインストール（無料）', W / 2, y + fs * 1.05, fs * 0.55, '#fff', 700, 'center');
}
function drawInstallDialog(S, B, t, top, pb) {   // アプリをインストールしますか？（3択③）／進み具合
  const fs = S.fs, w = Math.min(W * 0.5, fs * 19), h = fs * 5.2, x = (W - w) / 2, y = top + fs * 0.5;
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, top, W, pb - top);
  g.fillStyle = '#fff'; rr(x, y, w, h, 12); g.fill();
  if (B.prog >= 0) {
    const p = B.installed ? 1 : clamp((t - B.progT) / 3200, 0, 1);
    txt(B.installed ? 'インストールが完了しました' : 'インストールしています…', x + fs * 0.8, y + fs * 1.1, fs * 0.72, B_URL, 700);
    g.fillStyle = '#e8eaed'; rr(x + fs * 0.8, y + fs * 2.4, w - fs * 1.6, fs * 0.45, fs * 0.22); g.fill();
    g.fillStyle = B.installed ? '#188038' : '#0b5ed7'; rr(x + fs * 0.8, y + fs * 2.4, Math.max(fs * 0.45, (w - fs * 1.6) * p), fs * 0.45, fs * 0.22); g.fill();
    txt(`${Math.round(p * 100)}%`, x + w - fs * 0.8, y + fs * 3.6, fs * 0.6, B_URL, 700, 'right');
    txt('SecureFree.app', x + fs * 0.8, y + fs * 3.6, fs * 0.5, B_GRAY);
    return;
  }
  txt('アプリをインストールしますか？', x + fs * 0.8, y + fs * 1.1, fs * 0.75, B_URL, 700);
  txt('SecureFree.app（発行元：不明）', x + fs * 0.8, y + fs * 2.0, fs * 0.5, B_GRAY);
  const bw = (w - fs * 2.4) / 3;
  B_TX.install.forEach((s, j) => {
    const bx = x + fs * 0.8 + j * (bw + fs * 0.4), by = y + h - fs * 1.9, look = mirrorLook(S, B, j, t);
    g.fillStyle = look && look.lime > 0 ? LIME_BG : j === 0 ? '#0b5ed7' : '#f1f3f4'; rr(bx, by, bw, fs * 1.2, 8); g.fill();
    if (look && look.lime > 0) { g.strokeStyle = LIME; g.lineWidth = 2 + 3 * look.lime; rr(bx, by, bw, fs * 1.2, 8); g.stroke(); }
    txt(s, bx + bw / 2, by + fs * 0.6, fs * 0.55, look && look.lime > 0 ? INK : j === 0 ? '#fff' : B_URL, 700, 'center');
    if (look && look.cancel > 0) { g.strokeStyle = RED; g.lineWidth = 3; g.beginPath(); g.moveTo(bx + fs * 0.3, by + fs * 0.6); g.lineTo(bx + fs * 0.3 + (bw - fs * 0.6) * look.cancel, by + fs * 0.6); g.stroke(); }
    if (look && look.badge) badge(bx - fs * 0.2, by - fs * 0.5, fs * 0.75, look.k);
    setHit(B, 'inst' + j, bx, by, bw, fs * 1.2);
  });
}
function drawPrize(S, B, t, top, pb) {
  const fs = S.fs, w = Math.min(W * 0.5, fs * 20), x = (W - w) / 2;
  g.fillStyle = '#fff7e0'; g.fillRect(0, top, W, pb - top);
  for (let i = 0; i < 40; i++) { const cx = (i * 97 % 100) / 100 * W, cy = top + ((i * 53 + t / 30) % 100) / 100 * (pb - top); g.fillStyle = ['#e01b24', '#f59e0b', '#16a34a', '#2563eb'][i % 4]; g.fillRect(cx, cy, fs * 0.25, fs * 0.12); }
  let y = top + fs * 1.3;
  txt('おめでとうございます！', W / 2, y, fs * 1.2, '#c2410c', 800, 'center'); y += fs * 1.25;
  txt('当選しました！受け取りはこちら', W / 2, y, fs * 0.7, B_URL, 700, 'center'); y += fs * 1.1;
  g.fillStyle = '#fff'; rr(x, y, w, fs * 7.6, 12); g.fill(); g.strokeStyle = '#f0c36b'; g.lineWidth = 2; rr(x, y, w, fs * 7.6, 12); g.stroke();
  let fy = y + fs * 0.7;
  const fieldRow = (label, f, name, hold) => {
    txt(label, x + fs * 0.7, fy + fs * 0.25, fs * 0.5, B_URL, 700);
    const bx = x + fs * 0.7, by = fy + fs * 0.6, bw = w - fs * 1.4, bh = fs * 1.15;
    g.fillStyle = '#fff'; rr(bx, by, bw, bh, 6); g.fill(); g.strokeStyle = B.focus === f ? '#2563eb' : '#c4c7c5'; g.lineWidth = B.focus === f ? 2 : 1; rr(bx, by, bw, bh, 6); g.stroke();
    if (f && (f.text || f.comp || f.pend)) drawField(f, bx + fs * 0.4, by + bh * 0.05, bw - fs * 0.8, bh * 0.9, fs * 0.58, B.focus === f && caretOn(t));
    else if (hold) txt(hold, bx + fs * 0.4, by + bh / 2, fs * 0.5, '#9aa0a6');
    else if (B.focus === f && caretOn(t)) { g.fillStyle = INK; g.fillRect(bx + fs * 0.4, by + bh * 0.2, 2, bh * 0.6); }
    if (name) setHit(B, name, bx, by, bw, bh, {ax: 0.2});
    fy += fs * 2.0;
  };
  fieldRow('お名前', B.form.name, 'fname');
  fieldRow('カード番号', B.form.card, 'fcard');
  fieldRow('有効期限・セキュリティコード', null, null, 'MM / YY　　CVC');
  const sx = W / 2 - fs * 3, sy = y + fs * 7.6 + fs * 0.5;
  g.fillStyle = B.sent && t - B.sent < 400 ? '#1d4ed8' : '#c2410c'; rr(sx, sy, fs * 6, fs * 1.3, 8); g.fill(); txt('送信して受け取る', W / 2, sy + fs * 0.65, fs * 0.55, '#fff', 700, 'center');
  setHit(B, 'fsend', sx, sy, fs * 6, fs * 1.3);
  if (B.sent) txt('送信しました。カードの確認が完了しました。', W / 2, sy + fs * 2.0, fs * 0.5, '#188038', 700, 'center');
}
function drawPops(S, B, t, top, pb) {
  const fs = S.fs;
  B.pops.forEach(p => {
    const a = clamp((t - p.t0) / 180, 0, 1), w = p.big ? Math.min(W * 0.5, fs * 18) : fs * 9.5, h = p.big ? fs * 6.4 : fs * 3.5;
    const x = p.big ? (W - w) / 2 : p.x * W, y = p.big ? top + (pb - top) * 0.22 : top + p.y * (pb - top);
    g.globalAlpha = a; g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 12; g.fillStyle = '#fff'; rr(x, y, w, h, 8); g.fill(); g.restore();
    g.globalAlpha = a;
    g.fillStyle = p.red ? '#d93025' : '#3c4043'; rr(x, y, w, fs * 1.05, [8, 8, 0, 0]); g.fill();
    txt((p.red ? '⚠ ' : '') + p.title, x + fs * 0.4, y + fs * 0.53, fs * (p.big ? 0.62 : 0.5), '#fff', 700, 'left', w - fs * 1.4);
    txt('×', x + w - fs * 0.4, y + fs * 0.53, fs * 0.55, '#fff', 500, 'right');
    if (p.big) {
      para(p.body, x + fs * 0.7, y + fs * 1.4, fs * 0.55, w - fs * 1.4, B_URL, 1.6, 2);
      const bw = fs * 6, bx = x + w - bw - fs * 0.7, by = y + h - fs * 1.75;
      g.fillStyle = '#d93025'; rr(bx, by, bw, fs * 1.2, 8); g.fill(); txt('今すぐスキャン', bx + bw / 2, by + fs * 0.6, fs * 0.55, '#fff', 700, 'center');
      txt('閉じる', bx - fs * 1.6, by + fs * 0.6, fs * 0.5, B_GRAY, 500, 'center');
      setHit(B, 'scan', bx, by, bw, fs * 1.2);
    } else para(p.body, x + fs * 0.4, y + fs * 1.3, fs * 0.48, w - fs * 0.8, B_URL, 1.5, 2);
    g.globalAlpha = 1;
  });
}
// 来場者の手元のカメラ映像が、そのまま映る（still があれば、止まった1枚）
function drawCamFeed(S, top, pb, still = null) {
  const fs = S.fs, v = still || document.getElementById('pv-hands'), ch = pb - top;
  g.fillStyle = '#000'; g.fillRect(0, top, W, ch);
  const vw = still ? still.width : v?.videoWidth, vh = still ? still.height : v?.videoHeight;
  if (v && vw && (still || v.readyState >= 2)) {
    const k = Math.max(W / vw, ch / vh), w = vw * k, h = vh * k;
    g.drawImage(v, (W - w) / 2, top + (ch - h) / 2, w, h);
  } else { txt('（カメラの映像）', W / 2, top + ch / 2, fs * 0.8, '#777', 500, 'center'); }
  g.fillStyle = 'rgba(0,0,0,0.55)'; rr(fs * 0.6, top + fs * 0.6, fs * 7.2, fs * 1.2, 8); g.fill();
  g.fillStyle = '#e01b24'; g.beginPath(); g.arc(fs * 1.2, top + fs * 1.2, fs * 0.2, 0, Math.PI * 2); g.fill();
  txt('カメラに接続しました', fs * 1.6, top + fs * 1.2, fs * 0.55, '#fff', 700);
}
function freezeCamera() {   // いまの映像を1枚止める（シャッター）
  const v = document.getElementById('pv-hands');
  if (!v || !v.videoWidth) return null;
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0); return c;
}
function drawHistory(S, B, t, top, pb) {   // 閲覧履歴：新しい順。下から上へ流れる
  const fs = S.fs, x = W * 0.14, w = W * 0.72, rowH = fs * 1.15;
  g.fillStyle = '#ffffff'; g.fillRect(0, top, W, pb - top);
  txt('履歴', x, top + fs * 1.0, fs * 0.9, B_URL, 500);
  g.fillStyle = '#f1f3f4'; rr(x + w * 0.35, top + fs * 0.45, w * 0.5, fs * 1.1, fs * 0.55); g.fill(); magnifier(x + w * 0.35 + fs * 0.55, top + fs * 1.0, fs * 0.35); txt('履歴を検索', x + w * 0.35 + fs * 1.1, top + fs * 1.0, fs * 0.5, '#70757a');
  const list = [...B.hist].reverse(), el = (t - B.histT) / 1000;
  const listTop = top + fs * 2.2, h = list.length * rowH + fs * 1.3, e = easeOut(clamp(el / 3.2, 0, 1));
  const y0 = listTop + (pb - listTop) * (1 - e) - Math.max(0, h - (pb - listTop) + fs) * clamp((el - 3.2) / 3, 0, 1);
  g.save(); g.beginPath(); g.rect(0, listTop, W, pb - listTop); g.clip();
  g.fillStyle = '#fff'; g.strokeStyle = B_LINE; g.lineWidth = 1; rr(x, y0, w, h, 10); g.stroke();
  txt('今日 - 2026年10月22日（木）', x + fs * 0.6, y0 + fs * 0.65, fs * 0.5, B_URL, 700);
  list.forEach((r, i) => {
    const y = y0 + fs * 1.3 + i * rowH + rowH / 2;
    txt(r.time, x + fs * 0.6, y, fs * 0.48, '#70757a');
    g.fillStyle = /xyz|top|click/.test(r.url) ? '#f1c232' : '#e8eaed'; rr(x + fs * 2.4, y - fs * 0.25, fs * 0.5, fs * 0.5, 3); g.fill();
    txt(r.title, x + fs * 3.2, y, fs * 0.52, B_URL, 500, 'left', w * 0.55);
    txt(r.url.split('/')[0], x + fs * 3.4 + w * 0.56, y, fs * 0.45, '#70757a', 500, 'left', w * 0.3);
  });
  g.restore();
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
    txt(tb.t || '新しいタブ', x + fs * 0.9, th * 0.58, fs * 0.42, B_URL, 500, 'left', tw - fs * 1.6);
  });
  txt('＋', fs * 0.6 + n * tw, th * 0.58, fs * 0.5, '#5f6368');
  g.fillStyle = '#ffffff'; g.fillRect(0, th, W, ah); g.fillStyle = B_LINE; g.fillRect(0, th + ah - 1, W, 1);
  ['←', '→', '↻'].forEach((s, i) => txt(s, fs * 0.6 + i * fs * 1.1, th + ah / 2, fs * 0.6, '#5f6368', 500));
  const ux = fs * 3.9, uw = W - ux - fs * 1.2, uh = ah * 0.68, uy = th + (ah - uh) / 2, bad = B.tabs[B.tab]?.bad;
  g.fillStyle = '#f1f3f4'; rr(ux, uy, uw, uh, uh / 2); g.fill();
  if (B.url) {
    let ox = ux + fs * 0.5;
    if (bad) { txt('⚠ 保護されていない通信', ox, th + ah / 2, fs * 0.45, '#d93025', 700); ox += textW('⚠ 保護されていない通信') + fs * 0.4; }
    else { txt('🔒', ox, th + ah / 2, fs * 0.42, B_URL); ox += fs * 0.8; }
    txt(B.url === 'chrome-history' ? '履歴' : B.url, ox, th + ah / 2, fs * 0.5, B_URL, 500, 'left', ux + uw - ox - fs * 0.5);
  } else txt('検索するか、URL を入力', ux + fs * 0.5, th + ah / 2, fs * 0.5, '#80868b');
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
  B.hit = {}; B.contentH = pb - top;
  if (B.sc) { const e = ease3(clamp((t - B.sc.t0) / B.sc.dur, 0, 1)); B.scroll = B.sc.from + (B.sc.to - B.sc.from) * e; }
  g.save(); g.beginPath(); g.rect(0, top, W, pb - top); g.clip();
  const SS = Object.create(S); SS.fs = fs * B_ZOOM;   // ページの中は、離れても読めるように大きく
  ({home: drawHome, results: drawResults, pirate: drawPirate, warning: drawWarning, security: drawSecurity, prize: drawPrize, history: drawHistory}[B.page] || drawHome)(SS, B, t, top, pb);
  if (B.dialog || B.prog >= 0) drawInstallDialog(SS, B, t, top, pb);
  drawPops(SS, B, t, top, pb);
  g.restore();
  drawChrome(S, B, t, th, ah);
  if (B.page !== 'history') drawPointer(B, t);
  if (B.black) {   // 暗転（black > 0）と、明ける（black < 0）
    const a = B.black > 0 ? clamp((t - B.black) / 500, 0, 1) : 1 - clamp((t + B.black) / 800, 0, 1);
    if (a > 0) { g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, 0, W, pb); }
  }
}

// ---- X（風）：投稿画面。配置と色だけをそれっぽくした、ロゴのない画面。長い文は、打っている行が見えるように上へ流れる ----
function drawX(S, X, t, dt, pb) {
  const fs = S.fs, cw = clamp(W * 0.66, 440, 860), cx = (W - cw) / 2, cy = pb * 0.06, ch = pb * 0.8, size = fs * 1.0, lh = size * 1.6;
  g.fillStyle = '#ffffff'; rr(cx, cy, cw, ch, 18); g.fill(); g.strokeStyle = '#cfd9de'; g.lineWidth = 1; g.stroke();
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = INK;
  g.font = `500 ${fs * 1.1}px ${FONT}`; g.fillText('×', cx + 22, cy + fs * 1.0); g.font = `700 ${fs * 0.65}px ${FONT}`; g.textAlign = 'right'; g.fillText('下書き', cx + cw - 22, cy + fs * 1.0); g.textAlign = 'left';
  const ar = fs * 0.95, ax = cx + 26 + ar, ay = cy + fs * 2.4 + ar, tx = ax + ar + 16, tw = cw - (tx - cx) - 28;
  g.fillStyle = '#cfd9de'; g.beginPath(); g.arc(ax, ay, ar, 0, Math.PI * 2); g.fill();
  g.fillStyle = INK; g.font = `700 ${fs * 0.9}px ${FONT}`; g.textAlign = 'center'; g.fillText('あ', ax, ay + 1);
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
  if (!X.text && !X.pend && !X.comp && S.typing !== X) { g.globalAlpha = 0.4; g.fillStyle = INK; g.font = `500 ${size}px ${FONT}`; g.fillText('いまどうしてる？', tx, y + lh / 2); g.globalAlpha = 1; }
  g.save(); g.beginPath(); g.rect(cx, y, cw, area); g.clip();
  drawBlock(X, tx, y - X.scroll, size, lh, lines, S.typing === X && caretOn(t), FONT, tx + tw);
  g.restore();
  // 返信できる人（本物と同じく、本文の下に小さく）。下の行：文字数のリング（140字をこえると、こえた字数が赤で出る）と「ポストする」（押されると青）
  g.fillStyle = '#1d9bf0'; g.font = `500 ${size * 0.55}px ${FONT}`; g.textAlign = 'left'; g.fillText('全員が返信できます', tx, by - fs * 1.55);
  g.fillStyle = '#cfd9de'; g.fillRect(cx + 20, by - fs * 1.1, cw - 40, 1);
  g.textBaseline = 'middle';
  {
    const n = X.text.length + (X.comp || '').length, left = 140 - n;
    const empty = !n && !X.pend, bw = fs * 5.4, bh = fs * 1.55, bx = cx + cw - 24 - bw, ring = cx + cw - 24 - bw - fs * 1.4, rad = fs * 0.5, p = clamp(n / 140, 0, 1);
    g.lineWidth = 3; g.strokeStyle = '#cfd9de'; g.beginPath(); g.arc(ring, by, rad, 0, Math.PI * 2); g.stroke();
    if (p > 0) { g.strokeStyle = p > 0.9 ? RED : INK; g.beginPath(); g.arc(ring, by, rad, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.stroke(); }
    if (left <= 20) { g.fillStyle = left < 0 ? RED : INK; g.font = `500 ${fs * 0.6}px ${FONT}`; g.textAlign = 'right'; g.fillText(String(left), ring - rad - 10, by + 1); }
    const down = X.press && t - X.press < 900;
    g.fillStyle = down ? '#1d9bf0' : empty ? '#8a9097' : '#0f1419'; rr(bx, by - bh / 2 + (down ? 2 : 0), bw, bh, bh / 2); g.fill();
    g.fillStyle = '#ffffff'; g.font = `700 ${fs * 0.7}px ${FONT}`; g.textAlign = 'center'; g.fillText('ポストする', bx + bw / 2, by + 1 + (down ? 2 : 0));
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
    g.font = `700 ${fs * 0.72}px ${FONT}`; g.fillText('カメラの使用を許可しますか？', x + fs * 0.8, y + fs * 1.0);
    g.font = `500 ${fs * 0.5}px ${FONT}`; g.fillStyle = '#536471'; g.fillText('投稿に、手元の写真を付けます', x + fs * 0.8, y + fs * 1.85);
    const bw = fs * 3.6, bh = fs * 1.1, by = y + h - fs * 1.5, down = X.allowT && t - X.allowT < 400;
    g.strokeStyle = '#cfd9de'; g.lineWidth = 1; rr(x + w - bw * 2 - fs * 1.2, by, bw, bh, bh / 2); g.stroke();
    g.fillStyle = INK; g.textAlign = 'center'; g.font = `700 ${fs * 0.5}px ${FONT}`; g.fillText('許可しない', x + w - bw * 1.5 - fs * 1.2, by + bh / 2);
    g.fillStyle = down ? '#1d9bf0' : '#0f1419'; rr(x + w - bw - fs * 0.8, by + (down ? 2 : 0), bw, bh, bh / 2); g.fill();
    g.fillStyle = '#fff'; g.fillText('許可', x + w - bw / 2 - fs * 0.8, by + bh / 2 + (down ? 2 : 0));
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


// ---- 待機：F が2秒ごとに鼓動する（カチ）。鼓動のとき F を押さえていると始まる ----
const newSaver = () => ({k: 'saver'});
function drawSaver(S, V, t, dt, pb) {
  const fs = S.fs, bt = S.beatT ? t - S.beatT : 1e9, q = Math.exp(-bt / 260);
  g.fillStyle = INK; g.font = `500 ${fs * 1.05}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(SAVER_MSG, W / 2, pb * 0.24);
  g.font = `500 ${fs * 0.72}px ${FONT}`; g.fillStyle = '#555';
  g.fillText(SAVER_SUB, W / 2, pb * 0.24 + fs * 1.3);
  // 鼓動：F の上で、輪が広がる。下の F のキーへ、細い線
  const x = kx(BEAT_KEY), cy = pb * 0.62, r = fs * 1.5 * (1 + 0.18 * q);
  g.strokeStyle = ORANGE; g.lineWidth = 2; g.globalAlpha = 0.5;
  g.beginPath(); g.moveTo(x, cy + r); g.lineTo(x, pb); g.stroke();
  if (bt < 900) { g.globalAlpha = 0.6 * (1 - bt / 900); g.lineWidth = 3; g.beginPath(); g.arc(x, cy, r + fs * 2.2 * (bt / 900), 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = 1;
  g.fillStyle = ORANGE; g.beginPath(); g.arc(x, cy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1a0e00'; g.font = `700 ${fs * 1.3}px ${FONT}`; g.fillText('F', x, cy + 2);
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
const TOTAL = 250000;   // 通しの目安（終了の画面の終わりまで、約4分10秒）。右上の時計の線の長さ
function drawHud(S, t) {   // 右上：経過時間と場面（スタッフ用。来場者に見せるときは H で消す）
  if (!S.hud) return;   // S.hud: 1 = 出す、0 = 出さない（H で切り替え）
  const el = S.running ? (t - S.t0) / 1000 : 0, f = v => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
  g.font = `500 12px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const put = (txt, y) => { g.lineWidth = 5; g.strokeStyle = PAPER; g.strokeText(txt, W - 14, y); g.fillStyle = INK; g.fillText(txt, W - 14, y); };   // 文字の下に紙の色の縁をつけ、重なっても読める
  put(`${f(el)}　${PH[S.phase] || ''}`, 16);
  const bx = W - 14 - 180;
  g.fillStyle = INK; g.fillRect(bx, 28, 180, 1); g.fillRect(bx, 26, Math.min(180, el * 1000 / TOTAL * 180), 5);
  g.fillStyle = RED; g.fillRect(bx + DUE.toX / TOTAL * 180 - 1, 23, 2, 11);   // 感想の投稿に入る目安
  if (S.phase === 'saver') put(`F を押さえるか、Enter か「はじめる」で開始　H で表示を切り替え　次の感想 ${(parseInt(lsGet('kc-dlg-review') ?? '0', 10) || 0) + 1}/${REVIEWS.length}`, 44);
}

// ================= 体験の登録 =================
const EXP = {
  id: 'dialogue', name: '対話',
  note: 'インストラクターと、ブラウザ・LINE・X の画面を行き来する。来場者の発言は、来場者の指が打つ。ときどき、キーを押して選ぶ',
  use: 'F を押さえるか、Enter か「はじめる」で開始／H で時計の表示を切り替え',
  opts: {から: START, LLM: ['あり', 'なし']},
  actions: [{label: s => s.running ? '最初から' : 'はじめる', run: s => { document.activeElement?.blur?.(); if (s.running) restart(); else begin(s); }}],
  init(S) {
    queued.fill(false);
    Object.assign(S, {phase: 'saver', running: false, dead: false, tl: [], fs: 28,
      cli: {k: 'cli', inst: null, me: null, gone: []}, sv: newSaver(), slide: null, line: null, br: null, x: null, title: null, choice: null,
      typing: null, hud: lsGet('kc-dlg-hud') === '0' ? 0 : 1, beatT: 0});
    S.scr = S.sv;
    S.onKey = e => {
      if (e.target?.tagName === 'INPUT' && e.target.type === 'text') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === 'Enter' || e.code === 'KeyF') && !S.running && !e.repeat) { e.preventDefault(); document.activeElement?.blur?.(); begin(S); }   // F：鼓動のとき押さえていると、基板が F を打つ
      else if (e.key === 'h' || e.key === 'H') { S.hud = S.hud ? 0 : 1; lsSet('kc-dlg-hud', String(S.hud)); }
    };
    S.onKnock = e => { if (e.detail.held && !S.running) begin(S); };   // キー入力が届かないときも、シリアルの KNOCK … HELD で始める
    addEventListener('keydown', S.onKey);
    addEventListener('kc-knock', S.onKnock);
    S.watch = setInterval(() => { if (paused && !S.dead) quit(S); }, 400);   // 一時停止したら、止める
    startBeat(S);
    fetch('/api/status').then(r => r.json()).then(j => {
      S.llmOff = !j.llm;
      if (S.llmOff && S.o.LLM === 'あり') status('LLM のキーが .env にありません。下書きは台本の文言で進みます', 5000);
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
