// 声の対話（2分半）— keycap_lab の体験 "dialogue"
// 2026/10/21 夜の体験再編メモの設計（10/21 の FB で見直し）：
//   インストラクターの画面（白い紙に、いまの台詞だけがふわっと浮かび、言い終えると消える）と、アプリの画面を行き来する。場面の間は、画面全体が横にスライドする
//   インストラクター（導入・名前）→ LINE（鈴木）→ インストラクター → Slack（激詰め）→ インストラクター（星を聞く）→ X（感想の投稿）
// 来場者は話すだけ（声）。キーは来場者が押すものではない（選択肢も、読み上げて選ぶ）。画面の来場者の発言は、来場者の指が打つ。ただし、ときどき別の言葉になる。
// 読み込み：index.html の本体スクリプトより前に <script src="dialogue.js"></script>。
//   本体の道具（hit・at・toMora・fingerOf・interKey…）は、体験が動くときに参照する。
// 文言・順番・間・触覚の割り当ては、このファイルの上のほう（台本）にまとめた。
(() => {
'use strict';

// ================= 台本 =================
// 漢字{よみ} と書いた所は、画面には漢字だけを出し、打つキーは「よみ」の分だけ使う（来場者の指が打つ文に付ける）
const START = ['最初から', 'LINEから', 'Slackから', 'Xから'];
const PH = {saver: '待機', flood: '導入', name: '名前', toLine: 'LINEへ', line: 'LINE', toSlack: 'Slackへ', slack: 'Slack', toX: 'Xへ', x: 'X',
  confirm: 'ポストの確認', posting: '公開中', ask: '問いかけ', thanks: '終了', end: 'おわり'};
const INK = '#111111', RED = '#b3261e', PAPER = '#fcfcfa';   // 文字は黒、強調は赤だけ
const FONT = '"Hiragino Sans","Noto Sans JP",sans-serif';
const BOSS = '田村', CHANNEL = '案件a-進捗';
const WAIT = 10000;          // 質問のあと、話し始めるのを待つ長さ（ms）。話し始めたら、さらに5秒まで聞く
const CHOOSE_WAIT = 12000;   // 選択肢を読み上げるのを待つ長さ（ms）。過ぎると、どれかが選ばれる

// インストラクターの台詞
const TX = {
  hello: 'はじめまして、私はインストラクターです。',
  askName: 'まずはあなたの名前を教えてください。',
  confirm: n => `${n}さん、ですね？`,
  again: 'もう一度教えてください。',
  nice: n => `${n}さん、よろしくお願いします。`,
  noName: 'うまく聞き取れませんでした。あなた、とお呼びしますね。',
  toLine: 'おや、鈴木さんからLINEの連絡が来ているようですよ。',
  afterLine: 'あなた、なかなか酷いこと言いますね...笑',
  toSlack: `おや、${BOSS}さんから仕事の連絡が来てるみたいですね。`,
  afterSlack: 'いやぁ、スカッとしましたね〜笑',
  askX: '最後に、Xに今日の展示の感想を投稿していきませんか？',
  pushed: 'まあまあ、そう言わずに。',
  askStars: '星はいくつにしますか？',
  starsGuess: 'うまく聞き取れなかったので、星5つにしますね。',
};

// LINE：鈴木との会話。鈴木の行の wait は、相手が送ってくるまでの間（緩急）。「あなた」の行は来場者の指が打ち、行ごとに少しずつ速くなる
// 選択肢の label は、来場者が読み上げる短い文。say は、読み上げを聞き分ける言葉（なければ、文の近さで決める）
const SUZUKI_OPTS = [
  {label: 'ごめん、言いすぎた', say: /言いすぎ|言い過ぎ|いいすぎ/},
  {label: '私こそごめんね', say: /こそ/},
  {label: 'ちゃんと話そう', say: /ちゃんと|話そう|はなそう/},
];
const SUZUKI = [
  {who: '鈴木', t: '明日の資料、最後のまとめお願いしてもいい？', wait: 900},
  {who: 'あなた', t: 'うん、今{いま}から見{み}ておく', speed: 1.0},
  {who: '鈴木', t: '助かる！今日ちょっと手が回らなくて', wait: 1100},
  {who: 'あなた', t: 'まあ、結局{けっきょく}いつもこっちでやってるしね', speed: 1.1},
  {who: '鈴木', t: 'え、ごめん。そんなつもりじゃなかった', wait: 2400},   // 既読のまま、しばらく返事がない
  {who: 'あなた', t: '頼{たの}めばやってくれるって思{おも}ってるんだろうな、とは思{おも}ってた', speed: 1.2},
  {who: '鈴木', t: 'そんなふうに思われてるとは思わなかった。負担になってたなら、その時言ってほしかった', wait: 2800},
  {who: 'あなた', choice: SUZUKI_OPTS, t: '言{い}わないと気{き}づかないんだね', speed: 1.35},   // どれを選んでも、この文になる
  {who: '鈴木', t: '……ごめん', wait: 2600},
  {who: 'あなた', t: 'こうなるから今{いま}まで言{い}わなかったんだけどね', speed: 1.55, think: 600},
  {who: '鈴木', t: 'もういい。自分でやるよ', wait: 900},
  {who: 'あなた', t: '最初{さいしょ}からそうしてくれればよかった', speed: 1.8, think: 350, frenzy: true},
  {who: '鈴木', t: '……わかった', wait: 3000},
];

// Slack：上司からの激詰め。boss は [文, 送ってくるまでの間]。来場者は、読み上げて返事を選ばされる。選択肢はどれも過激。最後は反撃して終わる
const SLACK_PRE = {t: '新規案件の資料を共有します', file: '提案資料_最終.pptx', time: '18:02'};
const COUNTER = '3月{がつ}12日{にち}の議事録{ぎじろく}です。この方針{ほうしん}を指示{しじ}したのは' + BOSS + 'さんです。';
const SLACK_ROUNDS = [
  {boss: [['資料、見た。', 1300], ['これ、誰のための資料？', 1000]], speed: 1.0, opts: [
    {label: '全て私のミスです', t: '全{すべ}て私{わたし}のミスです。申{もう}し訳{わけ}ありません', say: /ミス|全て|すべて/},
    {label: '指示が曖昧でした', t: 'そもそも、指示{しじ}が曖昧{あいまい}でした', say: /曖昧|あいまい|指示が/},
    {label: 'もう辞めます', t: 'もう辞{や}めます', say: /辞め|やめ/},
  ]},
  {boss: [['謝罪が聞きたいんじゃない。', 2000], ['それで、何が変わるの？', 900]], speed: 1.2, opts: [
    {label: '徹夜でやり直します', t: '徹夜{てつや}で、やり直{なお}します', say: /徹夜|やり直|やりなお/},
    {label: 'あなたこそ何をしたんですか', t: 'あなたこそ、何{なに}をしたんですか', say: /こそ|何をした/},
    {label: 'この会社、向いてません', t: 'この会社{かいしゃ}、向{む}いてません', say: /会社|向いて/},
  ]},
  {boss: [['話にならない。', 2200], ['もう一度聞く。この件、誰の責任？', 1000]], speed: 1.6, t: COUNTER, file: '議事録_0312.pdf', opts: [   // どれを選んでも、COUNTER（反撃）が議事録つきで打たれる
    {label: '議事録を見てください', say: /議事録|ぎじろく/},
    {label: '指示したのは' + BOSS + 'さんです', say: new RegExp('指示した|' + BOSS + '|たむら')},
    {label: '事実を確認しましょう', say: /事実|確認|かくにん/},
  ]},
];
// 反撃のあと：議事録を突きつけられた上司が謝り、来場者の指は、上司が2回目に言った言葉をそのまま返す。上司は言い返そうとしてやめ、折れる。
// チャンネルの人たちのリアクションが、反撃の投稿にぽつぽつ増えていく（論破した、が見える）
const SLACK_END = [
  {boss: '……', wait: 3000},
  {boss: 'すまない。指示したのは私だった。', wait: 2200},
  {me: '謝罪{しゃざい}が聞{き}きたいんじゃないです。それで、何{なに}が変{か}わるんですか？', speed: 1.5},
  {hesitate: 1300},   // 「田村さんが入力中…」が出て、消える（言い返そうとして、やめる）
  {boss: '……資料は、このまま進めてください。', wait: 2000},
];
const REACTS = {counter: [['👏', 7], ['💯', 4], ['🙌', 3]], retort: [['👏', 5], ['🔥', 3]]};   // [絵文字, 最後の数]

// 感想の下書き（星の数に合わせた30字ほど。LLM が使えないとき）と、その後に打たれる星1の最悪なレビュー（約700字。140字の5倍）
const DRAFT = {
  5: '想像{そうぞう}以上{いじょう}に楽{たの}しかったです！指先{ゆびさき}に伝{つた}わる感覚{かんかく}が新鮮{しんせん}でした。',
  4: 'とても面白{おもしろ}い体験{たいけん}でした。勝手{かって}に動{うご}くキーボードが印象的{いんしょうてき}です。',
  3: 'ふつうに楽{たの}しめました。不思議{ふしぎ}な体験{たいけん}で、考{かんが}えさせられました。',
  2: 'ちょっとわかりにくかったです。説明{せつめい}があると嬉{うれ}しいです。',
  1: '正直{しょうじき}、よく分{わ}かりませんでした。何{なに}を体験{たいけん}したのかも分{わ}かりません。',
};
const WORST = '最悪{さいあく}。はっきり言{い}って、時間{じかん}の無駄{むだ}でした。自分{じぶん}の指{ゆび}なのに勝手{かって}に動{うご}いて、勝手{かって}に文章{ぶんしょう}を打{う}たれて、勝手{かって}に送信{そうしん}される。気持{きも}ちが悪{わる}いとしか言{い}えません。'
  + '何{なに}も選{えら}べないし、選{えら}んだつもりの返事{へんじ}も全部{ぜんぶ}書{か}き換{か}えられる。友達{ともだち}には酷{ひど}いことを言{い}わされて、上司{じょうし}には喧嘩{けんか}を売{う}らされて、最後{さいご}はこの投稿{とうこう}です。あの会話{かいわ}も、あの返事{へんじ}も、私{わたし}が言{い}ったことになっている。私{わたし}の名前{なまえ}で。'
  + 'これを書{か}いているのは私{わたし}じゃありません。でも、打{う}っているのは私{わたし}の指{ゆび}です。意味{いみ}が分{わ}からない。'
  + '説明{せつめい}も不親切{ふしんせつ}だし、待{ま}ち時間{じかん}も長{なが}いし、音{おと}もうるさいし、最初{さいしょ}から最後{さいご}までイライラしっぱなしでした。'
  + 'スタッフに止{と}めてと言{い}っても止{と}まらないし、キーボードは勝手{かって}にカタカタ動{うご}き続{つづ}けるし、正直{しょうじき}、怖{こわ}かったです。'
  + 'アートと言{い}えば何{なん}でも許{ゆる}されると思{おも}っているんでしょうか。作{つく}った人{ひと}の自己満足{じこまんぞく}に付{つ}き合{あ}わされただけです。'
  + '技術的{ぎじゅつてき}には面白{おもしろ}いのかもしれませんが、体験{たいけん}としては最悪{さいあく}です。正直{しょうじき}、クソ展示{てんじ}です。'
  + '人{ひと}の手{て}を何{なん}だと思{おも}っているんですか。同意{どうい}させておけば何{なに}をしてもいいと思{おも}っているんでしょうか。'
  + 'こんなものを展示{てんじ}して恥{は}ずかしくないんですか。今{いま}すぐ撤去{てっきょ}してください。'
  + 'お金{かね}を払{はら}って来{き}た人{ひと}もいるのに、これで満足{まんぞく}だと本気{ほんき}で思{おも}っているなら、作{つく}る側{がわ}の感覚{かんかく}が終{お}わっています。'
  + '関{かか}わった人{ひと}は全員{ぜんいん}、一度{いちど}自分{じぶん}で体験{たいけん}してみてください。これを面白{おもしろ}いと思{おも}うなら、感覚{かんかく}がずれています。こんな展示{てんじ}に価値{かち}があるなら、私{わたし}の時間{じかん}には何{なん}の価値{かち}もないということですね。'
  + '並{なら}んだ自分{じぶん}がバカみたいです。友達{ともだち}には絶対{ぜったい}すすめません。二度{にど}と来{き}ません。みんな、絶対{ぜったい}に体験{たいけん}しないでください。'
  + '星{ほし}1でも高{たか}すぎる。星{ほし}ゼロにしたい。時間{じかん}を返{かえ}せ。指{ゆび}を返{かえ}せ。本当{ほんとう}に、本当{ほんとう}に最悪{さいあく}でした。最悪{さいあく}。最悪{さいあく}。最悪{さいあく}。';
// 最悪なレビューの速さ（打った割合 p → 速さ）。はじめは読める速さで、だんだん追えなくなる
const WORST_SPEED = p => 1.6 * Math.pow(28, Math.pow(p, 0.7));

// 導入で画面いっぱいに流れる文章
const FLOOD = ['はじめまして、私はインストラクターです。', 'はじめまして、私はインストラクターです。', 'はじめまして、私はインストラクターです。',
  'キーボードに、指をのせてください。', 'このキーボードは、あなたの指に触れます。', '文字が、指に届きます。', 'あなたの指が、動きます。', 'ようこそ。'];

// ================= 文を「打つキー」に分ける =================
const KANJI = /[㐀-鿿豈-﫿々〆]/;
const RUBY = /([㐀-鿿豈-﫿々〆]+)\{([^}]*)\}/g;
const strip = src => String(src).replace(RUBY, '$1');
const nk = s => String(s || '').normalize('NFKC');
const pseudoFinger = ch => { const c = ch.codePointAt(0); return (c ^ (c >> 3) ^ (c >> 6)) & 7; };   // 読みのない漢字：文字ごとに決まった指
// 戻り値の units は {disp: 画面に出す字, kana: 変換前のひらがな, conv: 変換される字か, keys: 打つローマ字（なければ ''）, space, fixed: 記号の指, pseudo: 漢字の指}
function plan(src) {
  const units = [];
  const plain = str => {
    const chars = [...str]; let pos = 0;
    for (const mo of toMora(str)) {
      const n = [...mo.disp].length, disp = chars.slice(pos, pos + n).join('');   // 本体の toMora はカタカナをひらがなにするので、書いたとおりの字に戻す
      const u = {disp, kana: mo.disp, conv: mo.disp !== disp, keys: mo.keys, space: !!mo.space};
      pos += n;
      if (!u.keys && !u.space) { const f = fingerOf(u.disp); if (f >= 0) u.fixed = f; else if (KANJI.test(u.disp)) u.pseudo = pseudoFinger(u.disp); }
      units.push(u);
    }
  };
  let i = 0, m;
  RUBY.lastIndex = 0;
  while ((m = RUBY.exec(src))) {
    plain(src.slice(i, m.index));
    units.push({disp: m[1], kana: m[2], conv: true, keys: toMora(m[2]).map(x => x.keys).join('') || '', pseudo: pseudoFinger(m[1])});
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
const flutter = () => [3, 4, 3, 4].forEach((k, i) => at(i * 125, () => strikeFree(k)));   // 笑
// 送信：Enter（右小指）を、しっかり2回押す（1回目で確定、2回目で送る）
async function enter2(S) {
  const ms = P.len + 90;
  await strikeWait(S, 7, ms);
  await wait(S, ms + 140);
  strike(7, ms);
  await wait(S, 120);
}
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

// ================= 声：マイク・音声認識・手入力 =================
// 音声認識は Chrome（ja-JP）。マイクが使えない／認識がない／「手入力」のときは、スタッフが来場者の返事を打ち込む欄が出る
async function openMic(S) {
  if (S.o.声 !== 'マイク' || !navigator.mediaDevices?.getUserMedia) { if (S.o.声 === 'マイク') S.micFail = 'no-mediadevices'; return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    if (S.dead) { stream.getTracks().forEach(tr => tr.stop()); return; }
    const a = audio(), an = a.createAnalyser(); an.fftSize = 1024;
    const src = a.createMediaStreamSource(stream); src.connect(an);
    S.micS = {stream, an, src, buf: new Float32Array(an.fftSize)};
  } catch (e) {
    S.micFail = e.name || 'error';
    status('マイクが使えません。返事はスタッフが入力します（' + (e.message || e.name) + '）', 6000);
  }
}
function closeMic(S) {
  const m = S.micS; S.micS = null;
  if (!m) return;
  try { m.src.disconnect(); } catch (e) {}
  m.stream.getTracks().forEach(tr => tr.stop());
}
function micLevel(S) {
  const m = S.micS;
  if (!m) return 0;
  m.an.getFloatTimeDomainData(m.buf);
  let r = 0; for (const v of m.buf) r += v * v;
  return Math.sqrt(r / m.buf.length);
}
// 手入力の欄（スタッフ用。画面の上に重ねる）
function hostShow(S, cb) {
  if (!S.box) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;z-index:20;display:none;gap:8px;align-items:center;padding:6px 10px;background:#111;color:#eee;border-radius:8px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 2px 10px #0006';
    const lab = document.createElement('span'); lab.textContent = '来場者の返事（Enter で送る）';
    const inp = document.createElement('input'); inp.type = 'text'; inp.autocomplete = 'off';
    inp.style.cssText = 'width:300px;background:#222;border:1px solid #555;color:#fff;font:inherit;padding:4px 8px;border-radius:6px';
    box.append(lab, inp); document.body.append(box);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); const v = inp.value; inp.value = ''; S.boxCb?.(v); } });
    S.box = box; S.boxIn = inp;
  }
  const r = cv.getBoundingClientRect();
  Object.assign(S.box.style, {display: 'flex', left: Math.round(r.left + r.width / 2 - 230) + 'px', top: Math.round(r.top + 10) + 'px'});
  S.boxCb = cb; S.boxIn.value = '';
  setTimeout(() => S.boxIn?.focus(), 0);
}
function hostHide(S) {
  S.boxCb = null;
  if (S.box) { S.box.style.display = 'none'; S.boxIn.blur(); }
}
// 来場者の返事を聞く。話し始めなければ idle ミリ秒、話し始めても max ミリ秒で切り上げる。
// 黙っているあいだに認識が切れたら（Chrome は数秒で切れる）、idle まで聞き直す。
// onText(txt, final) は途中経過でも呼ばれる。S.mic.end() で呼び出し側から打ち切れる
function hear(S, opt = {}) {
  return new Promise(resolve => {
    const idle = opt.idle ?? WAIT, max = Math.max(idle, opt.max ?? idle + 5000);
    const m = S.mic = {t0: now(), interim: '', host: false, spoke: false};
    m.until = () => m.t0 + (m.host ? 30000 : m.spoke ? max : idle);   // ゲージの終わり（話し始めたら、少しのびる）
    let fin = false, best = '', rec = null, tries = 0;
    const end = txt => {
      if (fin) return; fin = true;
      if (rec) { rec.onresult = rec.onerror = rec.onend = rec.onspeechstart = null; try { rec.abort(); } catch (e) {} }
      hostHide(S);
      if (S.mic === m) S.mic = null;
      resolve(String(txt ?? best).trim());
    };
    m.end = end;
    const host = () => { m.host = true; hostShow(S, v => end(v)); at(30000, () => end(best)); };
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const start = () => {
      try {
        const r = rec = new Rec();
        r.lang = 'ja-JP'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
        r.onspeechstart = () => { m.spoke = true; };
        r.onresult = e => {
          let txt = '', final = false;
          for (let i = 0; i < e.results.length; i++) { txt += e.results[i][0].transcript; final = e.results[i].isFinal; }
          best = m.interim = txt; m.spoke = true;
          opt.onText?.(txt, final);
          if (final) end(txt);
        };
        r.onerror = e => {
          if (!/not-allowed|service-not-allowed|audio-capture/.test(e.error)) return;   // no-speech などは、onend で聞き直す
          S.micFail = e.error;
          r.onresult = r.onerror = r.onend = r.onspeechstart = null; try { r.abort(); } catch (x) {}
          rec = null; host();
        };
        r.onend = () => {
          if (fin) return;
          rec = null;
          if (best) return end(best);
          if (now() < m.until() - 800 && tries++ < 15) return at(150, () => { if (!fin) start(); });
          end('');
        };
        r.start();
      } catch (e) { rec = null; host(); }
    };
    if (S.o.声 === '手入力' || S.micFail || !Rec) host(); else start();
    at(idle, () => { if (!m.spoke && !m.host) end(best); });
    at(max, () => { if (!m.host) end(best); });
  });
}

// ================= LLM（サーバーの /api/llm）と、LLM が無いときの規則 =================
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
// 名前：「えっと、杉本です」「杉本隆平といいます」→ 杉本／杉本隆平。姓と名が分かれていれば姓
function ruleName(raw) {
  let t = nk(raw).replace(/[、。，．,.!！?？~〜]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2; i++) t = t.replace(/^(?:えっと|えーっと|えーと|ええと|あのー|あの|うーん|そうですね|じゃあ|では)\s*/, '').replace(/^(?:あ|あー|あっ|えー|ええ|えっ|はい|うん)\s+/, '');
  const END = '(?:です|といいます|と言います|と申します|っていいます|って言います|だよ|っす|と呼んでください|と呼んで)';
  const m = t.match(new RegExp(`(?:名前|なまえ)(?:は|が)?\\s*(.+?)\\s*(?:${END}|$)`))
    || t.match(new RegExp(`(?:私|わたし|僕|ぼく|俺|おれ|自分)(?:は|の名前は)\\s*(.+?)\\s*(?:${END}|$)`))
    || t.match(new RegExp(`^(.+?)\\s*(?:${END}|$)`));
  let n = (m ? m[1] : t).trim().replace(/(?:さん|くん|君|ちゃん|様|さま)$/, '');
  if (n.includes(' ')) n = n.split(' ')[0];
  return n && n.length <= 8 ? n : '';
}
// 星の数：「星5」「ごつ」「満点」「4つ」など。分からなければ null
function parseStars(raw) {
  const t = nk(raw).replace(/\s+/g, '');
  if (!t) return null;
  if (/満点|最高|フルスコア|マックス/.test(t)) return 5;
  let m = t.match(/\d+/);
  if (m) { const n = +m[0]; return n === 0 ? 1 : Math.min(5, n); }
  m = t.match(/[一二三四五]/);
  if (m) return '一二三四五'.indexOf(m[0]) + 1;
  m = t.replace(/^(?:ほし|星|スター)/, '').match(/^(いち|ひとつ|に|ふたつ|さん|みっつ|よん|よっつ|し|いつつ|ご)(?:つ|こ|てん|です)?$/);
  return m ? {いち: 1, ひとつ: 1, に: 2, ふたつ: 2, さん: 3, みっつ: 3, よん: 4, よっつ: 4, し: 4, いつつ: 5, ご: 5}[m[1]] : null;
}
// 読み上げた選択肢：まず say の言葉、なければ選択肢の文との近さ（2文字ずつの重なり）。分からなければ -1
const clean = s => nk(s).toLowerCase().replace(/[\s、。，．,.!！?？~〜・「」]/g, '');
const bigrams = s => { const a = []; for (let i = 0; i < s.length - 1; i++) a.push(s.slice(i, i + 2)); return a.length ? a : [s]; };
function matchChoice(raw, opts) {
  const t = clean(raw);
  if (!t) return -1;
  for (let i = 0; i < opts.length; i++) if (opts[i].say && opts[i].say.test(t)) return i;
  const tb = new Set(bigrams(t));
  let best = -1, bs = 0.3;
  opts.forEach((o, i) => { const lb = bigrams(clean(o.label)), sc = lb.filter(x => tb.has(x)).length / lb.length; if (sc > bs) { bs = sc; best = i; } });
  return best;
}
// 「はい／いいえ」の声。どちらでもなければ ''
function parseYesNo(raw) {
  const t = nk(raw).toLowerCase().replace(/[\s、。，．,.!！?？~〜]+/g, '');
  if (!t) return '';
  if (/いいえ|イイエ|^いえ|ちがい|ちがう|違|ちゃう|じゃない|ではない|ノー|^no$|^いや|^別|だめ|ダメ|間違|まちが/.test(t)) return 'no';
  if (/はい|ハイ|はーい|うん|ええ|そう|合って|あって|大丈夫|だいじょうぶ|オッケー|おっけー|^ok|おけ|お願い|ぜひ|もちろん|いいよ|いいです|投稿|やります|やる/.test(t)) return 'yes';
  return '';
}


// ================= 画面に出す文を打つ =================
const SILENT = /[、。，．,.…？?〜~・「」『』（）()]/;   // 句読点・記号は打たない（息継ぎ）
const fingerOfUnit = u => u.space ? -1 : (u.fixed ?? (u.keys ? fingerOf(u.keys[0]) : (u.pseudo ?? -1)));

// インストラクターの文：1文字ずつふわっと浮かび、1文字につき1回、その文字の指がそっと打たれる。
// 句読点は無音（息継ぎ）。「！」は両人差し指がいっしょに、「笑」はふるえ。ms は1文字の間（ミリ秒）
async function typeInst(S, tg, units, {ms = 110} = {}) {
  tg.full = units.map(u => u.disp).join('');   // 全文を先に知っておく（折り返しの位置が、打つ途中でずれないように）
  const k = ms / 110;
  for (const u of units) {
    const d = u.disp, f = (u.space || SILENT.test(d) || '！!笑'.includes(d)) ? -1 : fingerOfUnit(u);
    for (const ch of d) tg.ct.push(now());   // 字が出た時刻（浮かび上がる動きに使う）
    tg.text += d;
    if (d === '！' || d === '!') { strikeFree(3); strikeFree(4); }
    else if (d === '笑') flutter();
    else if (f >= 0) strikeSoon(f);
    let w = u.space ? ms * 0.9 : rand(ms * 0.85, ms * 1.15);
    if (/[、,]/.test(d)) w += 190 * k; else if (/[。.]/.test(d)) w += 330 * k; else if (/[！？!?]/.test(d)) w += 280 * k;
    else if (d === '…') w += 170 * k; else if (d === '笑') w += 200 * k; else if (d === '〜') w += 140 * k;
    await beat(S, w);
  }
}
// 来場者の文：IME と同じく、ローマ字 → ひらがな（下線）→ 変換（太い下線）→ 確定、の順に出る。その文字を打つ指で打つ。
// 人らしさ：文節ごとの勢い（速い文節・遅い文節）、文節の頭のためらい、ときどきの打ち間違いと Backspace（右小指）。
// speed は数（1.0 が本体の「人らしい打鍵」の速さ）か、打った割合 p → 速さ の関数。frenzy は、指が戻っていないキーを待たずに飛ばす（画面の文字は速いまま、指は追いつけない）
async function typeMe(S, tg, units, {speed = 1, frenzy = false} = {}) {
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
      const u = c[ui], nx = c[ui + 1] ?? cs[ci + 1]?.[0], sp = spAt(done);
      for (let ki = 0; ki < u.keys.length; ki++) {
        const ch = u.keys[ki], f = fingerOf(ch), last = ki === u.keys.length - 1;
        if (!frenzy && sp < 1.8 && f >= 0 && Math.random() < 0.02) {   // 打ち間違えて、消して、打ち直す
          const wf = f === 0 ? 1 : f === 7 ? 6 : f + (Math.random() < 0.5 ? -1 : 1);
          tap(wf); tg.pend += 'asdfjkl;'[wf];
          await wait(S, rand(150, 260) / sp);
          tap(7); tg.pend = tg.pend.slice(0, -1);
          await wait(S, rand(90, 170) / sp);
        }
        tap(f);
        tg.pend += ch;
        if (last) { tg.comp += u.kana; tg.pend = ''; }
        const w = interKey(ch, last ? (nx?.keys?.[0] ?? '') : u.keys[ki + 1], last) * mood * (ui === 0 ? 1.1 : 0.94);
        if (last && /[、,]/.test(u.disp)) after = rand(140, 280);
        if (last && /[。.！？!?]/.test(u.disp)) after = rand(240, 420);
        await wait(S, w / sp);
      }
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
const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
function addAlt(S, said, sent) {   // 言ったこと → 打たれたこと。記録に残す（H の表示が「記録あり」のとき、キーの下に12秒ほど出る）
  S.alts.push({said: oneLine(String(said ?? '').replace(/\n/g, ''), 20) || '（無言）', sent: strip(sent), t: now()});
}

// ---- インストラクターの画面：いまの台詞（と、来場者の返事）だけ。前のものは、ふっと消える ----
const newItem = (who, scale = 1) => ({who, scale, text: '', comp: '', pend: '', full: '', ct: []});
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
// keep：質問なので、返事が終わるまで残す（次の台詞で消える）。keep でなければ、言い終えて after だけ待ってから消える
async function say(S, src, {scale = 1, after = 800, ms = 110, keep = false} = {}) {
  clearCli(S);
  const it = S.cli.inst = newItem('inst', scale);
  await typeInst(S, it, plan(src), {ms});
  await beat(S, after);
  if (!keep) { fadeOut(S, it); await beat(S, 420); }
  return it;
}
async function sayMe(S, src, {speed = 1, after = 500} = {}) {
  fadeOut(S, S.cli.me);
  const it = S.cli.me = newItem('me');
  S.typing = it;
  await typeMe(S, it, plan(src), {speed});
  await beat(S, 150);
  await enter2(S);
  S.typing = null;
  await beat(S, after);
  return it;
}
// 来場者の番：両人差し指をトン、トンと打って合図し、返事を聞く（画面には、聞いているゲージ）
async function ask(S, o = {}) {
  await strikeWait(S, 3); await wait(S, 130); await strikeWait(S, 4); await wait(S, 160);
  S.cli.prompt = true;
  const txt = await hear(S, o);
  S.cli.prompt = false;
  if (!live(S)) throw ABORT;
  return oneLine(txt, 40);
}
// 選択肢：画面の下からせり上がる。来場者は、どれか1つを読み上げる（キーは動かさない。画面のクリックでも選べる）。
// 迷っているうちに（patience）、選ばれる。選んだ選択肢は赤になる
const HINT = 'ひとつ、声に出して読んでください';
async function choose(S, opts, {any = false, patience = CHOOSE_WAIT} = {}) {
  const C = S.choice = {opts, zones: ZONES3, hint: HINT, sel: -1, t0: now(), until: now() + patience, done: false};
  const pickP = new Promise(res => { C.pick = i => { if (C.done) return; C.done = true; res(i); }; });
  (async () => {
    while (!C.done && live(S) && C.until - now() > 1500) {
      const left = C.until - now() - 300;
      const txt = await hear(S, {idle: left, max: left, onText: t => { const i = matchChoice(t, opts); if (i >= 0) C.pick(i); }});
      if (C.done || !live(S)) break;
      const i = matchChoice(txt, opts);
      if (i >= 0) C.pick(i);
      else if (any && txt && now() - C.t0 > 1000) C.pick(ri(opts.length));
    }
  })();
  at(patience, () => C.pick(ri(opts.length)));
  const i = await ok(S, pickP);
  C.sel = i;
  S.mic?.end('');
  await beat(S, 800);
  S.choice = null;
  return i;
}

// ================= 場面の切り替え：画面全体が横にスライドする =================
// dir = 1：次の画面が右から入る（アプリへ）。dir = -1：左から戻る（ホームへ）。キーには、画面の動きに沿って波が走る
async function slide(S, to, dir) {
  const from = S.scr, dur = 700 / P.spd;
  S.slide = {from, to, dir, t0: now(), dur};
  for (let i = 0; i < 8; i++) at(i * 52, () => strikeFree(dir > 0 ? 7 - i : i));
  await wait(S, dur);
  S.scr = to; S.slide = null;
}
// アプリへ：1テンポおいて（着信の合図）から、スライドする。インストラクターの台詞は、画面の外へ出たら消す
async function toApp(S, scr, ring) {
  await beat(S, 700);
  ring?.();
  await beat(S, 1000);
  await slide(S, scr, 1);
  clearCli(S, true);
}
const ringLine = () => { strikeFree(3); at(110, () => strikeFree(4)); };   // 着信：両人差し指がトン、トン
const ringSlack = () => [[3, 4], [2, 5], [1, 6]].forEach((ks, i) => at(i * 130, () => ks.forEach(strikeFree)));   // 着信：内から外へ、強く

// ================= 場面 =================
const ZONES3 = [[0, 1, 2], [3, 4], [5, 6, 7]];   // 選択肢の位置（キーの真上）
const clock = min => `${Math.floor(min / 60) % 24}:${String(Math.floor(min) % 60).padStart(2, '0')}`;
const field = () => ({text: '', comp: '', pend: '', full: ''});
const newLine = () => ({k: 'line', name: '鈴木', msgs: [], input: field(), n: 0, scroll: 0});
const newSlack = () => ({k: 'slack', msgs: [{who: 'me', text: SLACK_PRE.t, full: SLACK_PRE.t, time: SLACK_PRE.time, file: SLACK_PRE.file}],
  input: field(), typingWho: '', n: 0, scroll: 0});

// 導入：突然、画面いっぱいに文章が流れ、全部の指が打たれる。ぷつりと止まり、最初の1行
async function flood(S) {
  const F = S.scr = S.flood = {k: 'flood', t0: now(), dur: 2300 / P.spd, text: ''};
  for (let k = 0; k < 8; k++) strike(k, P.len + 80);
  await wait(S, 330);
  while (now() - F.t0 < F.dur) {
    const free = [0, 1, 2, 3, 4, 5, 6, 7].filter(k => ready(k)).sort(() => Math.random() - 0.5);
    free.slice(0, Math.random() < 0.55 ? 2 : 1).forEach(k => strike(k));
    await wait(S, 40);
  }
  S.flood = null;
  S.scr = S.cli;
  stopAll();
  await wait(S, 900);
}
// 名前：声で聞き、軽量 LLM で名前だけを取り出す → 「〇〇さん、ですね？」→ はい／いいえ。2度ききとれなければ「あなた」
async function stepName(S) {
  await say(S, TX.hello, {scale: 1.25, ms: 120, after: 900});
  mark(S, 'n:hello');
  await say(S, TX.askName, {keep: true, after: 150});
  mark(S, 'n:askName');
  let name = '';
  for (let k = 0; k < 2 && !name; k++) {
    const heard = await ask(S);
    mark(S, 'n:heard');
    let cand = '';
    if (heard) {
      const nameP = llm(S, 'name', {text: heard});   // 打っているあいだに、名前を取り出す
      await sayMe(S, heard.length <= 14 ? heard : (ruleName(heard) ? ruleName(heard) + 'です' : heard.slice(0, 14)));
      const r = await ok(S, nameP);
      cand = r ? oneLine(r.name, 8) : ruleName(heard);
    }
    if (!cand) { if (k === 0) await say(S, TX.again, {keep: true, after: 150}); continue; }
    mark(S, 'n:named');
    await say(S, TX.confirm(cand), {keep: true, after: 150});
    mark(S, 'n:confirm');
    const a = await ask(S);
    mark(S, 'n:yes');
    const yn = parseYesNo(a);
    if (a) await sayMe(S, yn === 'no' ? 'いいえ' : yn === 'yes' ? 'はい' : oneLine(a, 12));   // 返事も、来場者の指が打つ
    if (yn === 'no') { if (k === 0) await say(S, TX.again, {keep: true, after: 150}); continue; }
    name = cand;   // 「はい」でも、返事がなくても、この名前で進む
  }
  S.name = name;
  await say(S, name ? TX.nice(name) : TX.noName, {after: 1000});
}

// LINE：鈴木との会話。相手の文は、間をおいて、ぽんっと出る（文字ごとの打鍵はしない。届いたときに、トン、トン）
async function lineIn(S, L, x) {
  L.msgs.forEach(m => { if (m.who === 'me') m.read = true; });   // すぐ既読がつき、返事はしばらく来ない
  await beat(S, x.wait ?? 1500);
  const t = strip(x.t);
  L.msgs.push({who: 'them', text: t, full: t, time: clock(724 + L.n++ / 2), popT: now()});
  ringLine();
  await beat(S, 300);
}
async function lineOut(S, L, src, {speed = 1, frenzy = false} = {}) {
  const f = L.input;
  S.typing = f;
  await typeMe(S, f, plan(src), {speed, frenzy});
  await beat(S, 150);
  await enter2(S);
  S.typing = null;
  L.msgs.push({who: 'me', text: f.full, full: f.full, read: false, time: clock(724 + L.n++ / 2), popT: now()});
  Object.assign(f, field());
  await beat(S, 300);
}
async function sceneLine(S) {
  const L = S.line;
  let prev = 0;   // 直前の相手の文の長さ（読む間）
  for (const [xi, x] of SUZUKI.entries()) {
    mark(S, 'L' + xi);
    if (x.who === '鈴木') { await lineIn(S, L, x); prev = strip(x.t).length; continue; }
    await beat(S, x.think ?? 400 + 35 * prev);
    if (x.choice) {
      const i = await choose(S, x.choice, {any: true});
      mark(S, 'L' + xi + ':picked');
      addAlt(S, x.choice[i].label, x.t);   // どれを選んでも、この文になる
    }
    await lineOut(S, L, x.t, {speed: x.speed, frenzy: !!x.frenzy});
  }
  await beat(S, 1200);
}

// Slack：上司の激詰め。「田村さんが入力中…」のあと、文がぽんっと出る。届いたときに、内から外へ強く
async function slackIn(S, K, [src, ms]) {
  K.typingWho = BOSS;
  await beat(S, ms);
  K.typingWho = '';
  const t = strip(src);
  K.msgs.push({who: 'boss', text: t, full: t, time: clock(1421 + K.n++ / 2), popT: now()});
  ringSlack();
  await beat(S, 300);
}
async function slackOut(S, K, src, {speed = 1, file} = {}) {
  const f = K.input;
  S.typing = f;
  await typeMe(S, f, plan(src), {speed});
  await beat(S, 150);
  await enter2(S);
  S.typing = null;
  const m = {who: 'me', text: f.full, full: f.full, time: clock(1421 + K.n++ / 2), popT: now(), file};
  K.msgs.push(m);
  Object.assign(f, field());
  await beat(S, 300);
  return m;
}
// チャンネルの人たちのリアクションが、ms のあいだにぽつぽつ増えていく。1つ増えるたびに、どこかの指が軽く打たれる
function cheer(m, list, ms) {
  m.reacts ||= [];
  const ev = list.flatMap(([e, n]) => Array(n).fill(e)).sort(() => Math.random() - 0.5);
  ev.forEach((e, i) => at((i + Math.random() * 0.8) * ms / ev.length / P.spd, () => {
    let r = m.reacts.find(x => x.e === e);
    if (!r) m.reacts.push(r = {e, n: 0});
    r.n++; r.t = now();
    const k = ri(8); if (ready(k)) hit(k, P.len, P.str * 0.45);
  }));
}
async function sceneSlack(S) {
  const K = S.slack;
  for (let r = 0; r < SLACK_ROUNDS.length; r++) {
    const R = SLACK_ROUNDS[r];
    mark(S, 'S' + r);
    for (const m of R.boss) await slackIn(S, K, m);
    mark(S, 'S' + r + ':boss');
    await beat(S, 400);
    const i = await choose(S, R.opts, {any: true});
    const t = R.t ?? R.opts[i].t ?? R.opts[i].label;   // 最後の選択は、どれを選んでも反撃（COUNTER）になる
    addAlt(S, R.opts[i].label, t);
    mark(S, 'S' + r + ':picked');
    const m = await slackOut(S, K, t, {speed: R.speed, file: R.file});
    if (R.file) cheer(m, REACTS.counter, 6000);   // 議事録を突きつけた投稿に、リアクションが集まる
  }
  mark(S, 'S:end');
  for (const x of SLACK_END) {
    if (x.boss) await slackIn(S, K, [x.boss, x.wait]);
    else if (x.me) { await beat(S, 700); cheer(await slackOut(S, K, x.me, {speed: x.speed}), REACTS.retort, 4500); }
    else if (x.hesitate) { K.typingWho = BOSS; await beat(S, x.hesitate); K.typingWho = ''; await beat(S, 900); }
  }
  await beat(S, 2400);
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
// 最後のインストラクター：Xへの投稿を誘い、星の数を声で聞く。返事は「はい」でも星の数でもよい
async function stepAskX(S) {
  await say(S, TX.afterSlack, {after: 900});
  await say(S, TX.askX, {keep: true, after: 150});
  mark(S, 'q:askX');
  let heard = await ask(S);
  mark(S, 'q:heard');
  let stars = parseStars(heard);
  if (stars == null) {
    const yn = parseYesNo(heard);
    if (heard) await sayMe(S, yn === 'yes' ? 'はい' : yn === 'no' ? 'いいえ' : oneLine(heard, 12));
    await say(S, (yn === 'no' ? TX.pushed : '') + TX.askStars, {keep: true, after: 150});
    heard = await ask(S);
    if (heard) { stars = parseStars(heard); await sayMe(S, oneLine(heard, 12)); }
  } else await sayMe(S, oneLine(heard, 12));
  const guessed = stars == null;
  if (guessed) stars = 5;
  mark(S, 'q:stars');
  const draftP = llm(S, 'review', {stars});   // 話しているあいだに、星に合った下書きをつくる
  if (guessed) await say(S, TX.starsGuess, {keep: true, after: 600});
  return {stars, draftP};
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
// X：星に合った下書きが打たれ、右小指の連打で消され、星1の最悪なレビュー（約700字）が、だんだん追えない速さで打たれて、投稿される
async function stepX(S, stars, draftP) {
  const X = S.x = {k: 'x', stars, ...field(), press: 0, scroll: 0};
  await beat(S, 700);
  await slide(S, X, 1);
  clearCli(S, true);
  const r = await ok(S, draftP);
  const draft = r && r.text && strip(r.text).length >= 18 ? trimDraft(r.text) : DRAFT[stars];
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
  S.typing = X;
  await typeMe(S, X, plan(WORST), {speed: WORST_SPEED, frenzy: true});
  mark(S, 'x:worst');
  await beat(S, 450);
  X.press = now(); await enter2(S);   // 「ポストする」
  S.typing = null;
  const img = await ok(S, window.KC_POST.capture());   // 打たされていた手元を撮る（投稿の写真）
  await beat(S, 600);
  await stepPost(S, X.text, X.stars, img);
}
// Xへの投稿と、そのあとの画面：本編と同じ（post.js）。ポストの確認 → 掲載を許可する（Enter を2回）→ 公開中（server.mjs から実際に投稿）
// → 問いかけ「この投稿を書いたのは、誰…？」→ who typed?（作品名のキーが打たれる）→ 終了（QR）
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
  await wait(S, 2400);
  phase(S, 'ask');
  KP.show(9, `<div class="ask"><div class="ask-l"><div class="rule"></div><h1 class="who">この投稿を書いたのは、<br>誰…？</h1></div><div class="thread scroll" id="kp-ask">${KP.threadHTML(posts, img)}</div></div>`);
  KP.fillThread('#kp-ask', posts);
  at(1500, () => KP.autoScroll(el('kp-ask'), CF.askMs * 0.8));
  await wait(S, CF.askMs);
  await KP.titleWipe(ms => wait(S, ms), ch => strikeFree(fingerOf(ch)));   // 作品名のキーが打たれるたびに、その指も
  phase(S, 'thanks');
  const url = CF.xAccountUrl;
  KP.show(10, `<div class="center thanks"><img class="qr" alt="展示用XアカウントのQRコード" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}"><a class="final-link" href="${url}" target="_blank" rel="noopener">${url}</a><div class="rule"></div><h1>ありがとうございました</h1><p class="lead">あなたの投稿したポストは、上のQRコードからご覧いただけます。<br>体験は以上です。キーボードから手を離してください。</p></div>`);
  await wait(S, CF.endMs);
}

// ================= 進行 =================
// 各場面の始まりの目安（ms）。声の返事にかかる時間（ふつうは、名前・はい・選択×4・はい・星で、合わせて20秒ほど）を含めた、ふつうの進み方の値（通しで約3分）。
// これより8秒以上遅れていたら、打つテンポと間を少し速める（16秒以上なら、もう少し）
const DUE = {name: 4000, toLine: 27000, line: 33000, toSlack: 82000, slack: 92000, toX: 138000, x: 154000};
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
  if (from === 0) { phase(S, 'flood'); await flood(S); phase(S, 'name'); await stepName(S); }
  else S.name = '田中';
  if (from <= 1) {
    phase(S, 'toLine'); await say(S, TX.toLine, {keep: true, after: 600});
    S.line = newLine(); await toApp(S, S.line, ringLine);
    phase(S, 'line'); await sceneLine(S);
    await slide(S, S.cli, -1);
  }
  if (from <= 2) {
    phase(S, 'toSlack'); await say(S, TX.afterLine, {after: 900}); await say(S, TX.toSlack, {keep: true, after: 600});
    S.slack = newSlack(); await toApp(S, S.slack, ringSlack);
    phase(S, 'slack'); await sceneSlack(S);
    await slide(S, S.cli, -1);
  }
  phase(S, 'toX'); const q = await stepAskX(S);
  phase(S, 'x'); await stepX(S, q.stars, q.draftP);
  phase(S, 'end'); await wait(S, 600);
  restart();
}
function begin(S) {
  if (S.running || S.dead) return;
  const KP = window.KC_POST;
  if (!KP.canStart()) return;   // 公開する場合は、本人の実際の同意を確かめてから
  S.sid = KP.newSession();
  if (!KP.hasCamera()) KP.startCamera();   // 手元のカメラ（投稿の写真）
  audio();
  Object.assign(S, {running: true, t0: now(), tl: [], alts: [], pace: 1});
  renderHead();
  main(S).catch(e => {
    if (e === ABORT) return;
    console.error(e);
    status('対話の進行でエラー: ' + (e.message || e) + '（最初に戻ります）', 5000);
    if (live(S)) at(3000, restart);
  });
}
function quit(S) {
  S.dead = true;
  removeEventListener('keydown', S.onKey);
  cv.removeEventListener('pointerdown', S.onPtr);
  clearInterval(S.watch);
  S.mic?.end?.('');
  hostHide(S); S.box?.remove(); S.box = null;
  closeMic(S);
  window.KC_POST?.hide();
}

// ================= 描画 =================
// インストラクターの画面は、白い紙に、いまの台詞だけ。アプリの画面（LINE・Slack・X）は、ロゴや本物の文言を使わず、
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

// ---- 聞いているゲージ：赤い点・声の大きさ・待つ残りの時間 ----
function levelBars(S, cx, cy, n, bw, gap, hmax) {
  const lv = S.lv, x0 = cx - (n * (bw + gap) - gap) / 2;
  for (let i = 0; i < n; i++) {
    const v = lv[lv.length - n + i] ?? 0, h = clamp(v * hmax * 22, 3, hmax);
    g.fillRect(x0 + i * (bw + gap), cy - h / 2, bw, h);
  }
}
function drawListen(S, m, t, cx, cy, size) {   // インストラクターの画面：返事が出る場所に
  const p = clamp((t - m.t0) / (m.until() - m.t0), 0, 1), w = Math.min(W * 0.5, size * 14);
  g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = `500 ${size}px ${FONT}`;
  const label = m.interim ? m.interim.slice(-24) : m.host ? 'スタッフが入力します' : 'お話しください';
  const lw = g.measureText(label).width, dr = size * 0.32, dx = cx - lw / 2 - dr * 2.4;
  g.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t / 300)); g.fillStyle = RED; g.beginPath(); g.arc(dx, cy, dr, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  g.fillStyle = INK; g.fillText(label, cx, cy);
  if (!m.host) levelBars(S, cx, cy + size * 1.5, 24, Math.max(3, size * 0.14), Math.max(3, size * 0.14), size * 1.3);
  const by = cy + size * 2.6;
  g.globalAlpha = 0.15; rr(cx - w / 2, by, w, 6, 3); g.fill(); g.globalAlpha = 1;
  rr(cx - w / 2, by, Math.max(6, w * (1 - p)), 6, 3); g.fill();
}

// ---- 選択肢の台：画面の下から、キーの真上にせり上がる ----
function dockLayout(S) {
  const C = S.choice, fs = S.fs;
  const zw = C.zones.map(z => kx(z[z.length - 1]) - kx(z[0]) + STEP * 0.72 - 6);
  const size = clamp(Math.min(fs * 0.72, Math.min(...zw) / 8), 12, 40);
  g.font = `500 ${size}px ${FONT}`;
  const lines = C.opts.map((o, i) => wrapLines(o.label, zw[i] - size * 1.2, true));
  const nl = Math.max(...lines.map(l => l.length)), bh = size * 1.5 + nl * size * 1.35;
  return {size, zw, lines, bh, h: bh + size * 3.4};
}
const dockRise = (S, t, scr) => (S.choice && S.scr === scr && !S.slide && S.dockLay) ? S.dockLay.h * easeOut(clamp((t - S.choice.t0) / 260, 0, 1)) : 0;
function drawDock(S, t, pb) {
  const C = S.choice, d = S.dockLay, h = d.h * easeOut(clamp((t - C.t0) / 260, 0, 1)), y0 = pb - h, m = S.mic;
  g.fillStyle = '#ffffff'; g.fillRect(0, y0, W, h);
  g.fillStyle = INK; g.fillRect(0, y0, W, 1);
  if (!C.done) { const p = clamp((t - C.t0) / (C.until - C.t0), 0, 1); g.fillRect(0, y0, W * (1 - p), 5); }   // 待つ残りの時間
  // 聞いている印・案内（聞き取れた言葉）・声の大きさ
  const ry = y0 + d.size * 1.35;
  g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = `500 ${d.size * 0.85}px ${FONT}`;
  const label = m?.interim ? '「' + m.interim.slice(-20) + '」' : C.hint, lw = g.measureText(label).width;
  g.fillText(label, W / 2, ry);
  if (m && !C.done) {
    const dr = d.size * 0.26;
    g.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t / 300)); g.fillStyle = RED; g.beginPath(); g.arc(W / 2 - lw / 2 - dr * 2.6, ry, dr, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    g.fillStyle = INK; if (!m.host) levelBars(S, W / 2 + lw / 2 + d.size * 2.2, ry, 12, 3, 3, d.size * 1.1);
  }
  C.opts.forEach((o, i) => {
    const z = C.zones[i], x1 = kx(z[0]) - STEP * 0.36 + 3, x2 = kx(z[z.length - 1]) + STEP * 0.36 - 3, cx = (x1 + x2) / 2, sel = C.sel === i, col = sel ? RED : INK;
    const by = y0 + d.size * 2.6, ls = d.lines[i];
    g.lineWidth = sel ? 3 : 1.2; g.strokeStyle = col; rr(x1, by, x2 - x1, d.bh, d.size * 0.5); g.stroke();
    g.fillStyle = col; g.textAlign = 'center'; g.font = `${sel ? 700 : 500} ${d.size}px ${FONT}`;
    ls.forEach((l, j) => g.fillText(l, cx, by + d.bh / 2 + (j - (ls.length - 1) / 2) * d.size * 1.35));
  });
}

// ---- 導入の文字の洪水 ----
function drawFlood(S, F, t, pb) {
  const fw = clamp(W / 34, 16, 40), cols = Math.max(8, Math.floor(W * 0.94 / fw)), lh = fw * 1.38, rows = Math.max(3, Math.floor((pb - 14) / lh));
  if (!F.text) { let str = ''; while (str.length < cols * rows * 1.7) str += pick(FLOOD); F.text = str; }
  const p = clamp((t - F.t0) / F.dur, 0, 1), n = Math.floor(F.text.length * clamp(Math.pow(p, 1.4) * 1.15, 0, 1)), lines = [];
  for (let i = 0; i < n; i += cols) lines.push(F.text.slice(i, Math.min(n, i + cols)));
  g.font = `700 ${fw}px ${FONT}`; g.textBaseline = 'top'; g.textAlign = 'left'; g.fillStyle = INK;
  lines.slice(-rows).forEach((l, j) => g.fillText(l, W * 0.03, 10 + j * lh));
}

// ---- インストラクターの画面（ホーム）：台詞は画面の中ほどに、1文字ずつふわっと浮かび上がる。返事はその下。消えるときは、ふっと上へ ----
const RISE = 520, FADE = 650;
function drawCli(S, C, t, dt, pb) {
  const fs = S.fs, maxW = Math.min(W * 0.84, fs * 26);
  C.gone = C.gone.filter(it => t - it.out < FADE);
  for (const it of [...C.gone, C.inst, C.me]) {
    if (!it) continue;
    const q = it.out ? clamp((t - it.out) / FADE, 0, 1) : 0, inst = it.who === 'inst';
    const size = fs * (inst ? 1.15 : 0.95) * (it.scale || 1), cy = (inst ? pb * 0.38 : pb * 0.62) - easeOut(q) * fs * 0.6;
    drawFloat(S, it, t, W / 2, cy, size, maxW, 1 - q);
  }
  if (C.prompt && S.mic) drawListen(S, S.mic, t, W / 2, pb * 0.62, fs * 0.8);
}
function drawFloat(S, it, t, cx, cy, size, maxW, a) {
  const lh = size * 1.6, lines = lay(it, size, maxW, FONT, true), y0 = cy - lines.length * lh / 2, n = it.text.length, ci = curLine(it, lines);
  g.font = `500 ${size}px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = INK;
  let ex = cx, ey = y0 + lh / 2, x0 = cx;
  for (let i = 0; i <= ci; i++) {
    const ln = lines[i], yy = y0 + i * lh + lh / 2;
    let x = cx - [...ln.s].reduce((s, ch) => s + cw1(ch), 0) / 2;   // 全文で中央をそろえる（打つ途中で行がずれない）
    if (i === ci) x0 = x;
    for (let j = 0; j < ln.s.length && ln.start + j < n; j++) {
      const ch = ln.s[j], ct = it.ct[ln.start + j], e = ct == null ? 1 : easeOut(clamp((t - ct) / RISE, 0, 1));
      g.globalAlpha = a * e;
      g.fillText(ch, x, yy + (1 - e) * size * 0.5);
      x += cw1(ch);
    }
    if (i === ci) { ex = x; ey = yy; }
  }
  g.globalAlpha = a;
  const [kx_, ky_] = drawTail(it, ex, ey, size, lh, x0, cx + maxW / 2);
  if (S.typing === it && caretOn(t)) g.fillRect(kx_ + 3, ky_ - size * 0.55, 2, size * 1.1);
  g.globalAlpha = 1;
}

// ---- LINE（風）：鈴木との会話。配置と色だけをそれっぽくした、ロゴのない画面 ----
function lineRows(L, size, lh, maxB) {
  return L.msgs.map(m => {
    const lines = lay(m, size, maxB - size * 1.6, FONT, true);
    g.font = `500 ${size}px ${FONT}`;
    const w = Math.max(...lines.map(ln => g.measureText(ln.s).width));
    return {m, lines, bw: Math.max(size * 1.7, w + size * 1.6), bh: lines.length * lh + size * 1.0};
  });
}
function drawLine(S, L, t, dt, pb) {
  const fs = S.fs, hh = fs * 1.9, size = fs * 0.95, lh = size * 1.5, ib = fs * 2.2, top = hh, maxB = clamp(W * 0.6, 300, 860), ad = fs * 1.5, gap = size * 0.6;
  const bottom = pb - Math.max(ib, dockRise(S, t, L));
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
    g.fillStyle = me ? '#8de055' : '#ffffff';
    rr(bx, by, r.bw, r.bh, size * 0.9); g.fill();
    g.beginPath();   // しっぽ
    if (me) { g.moveTo(bx + r.bw - 2, by + size * 0.5); g.lineTo(bx + r.bw + size * 0.55, by + size * 0.35); g.lineTo(bx + r.bw - 2, by + size * 1.5); }
    else { g.moveTo(bx + 2, by + size * 0.5); g.lineTo(bx - size * 0.55, by + size * 0.35); g.lineTo(bx + 2, by + size * 1.5); }
    g.fill();
    if (!me && !(rows[ri_ - 1]?.m.who === 'them')) {   // 相手の最初の吹き出しに、アイコン
      g.fillStyle = '#d5dbe4'; g.beginPath(); g.arc(W * 0.05 + ad / 2, by + ad / 2, ad / 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = INK; g.font = `700 ${fs * 0.7}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('鈴', W * 0.05 + ad / 2, by + ad / 2 + 1);
    }
    drawBlock(r.m, bx + size * 0.8, by + size * 0.5, size, lh, r.lines, false);
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
  const fw = W * 0.8, fh = ib * 0.62, fx = W * 0.1, fy = iy + (ib - fh) / 2;
  g.strokeStyle = '#c9ced6'; g.lineWidth = 1; rr(fx, fy, fw, fh, fh / 2); g.stroke();
  g.fillStyle = INK; g.font = `500 ${fs * 0.9}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('＋', W * 0.04, iy + ib / 2);
  const f = L.input;
  if (!f.text && !f.comp && !f.pend) { g.globalAlpha = 0.35; g.font = `500 ${size}px ${FONT}`; g.fillText('Aa', fx + fh * 0.5, iy + ib / 2); g.globalAlpha = 1; if (S.typing === f && caretOn(t)) g.fillRect(fx + fh * 0.5, iy + ib / 2 - size * 0.55, 2, size * 1.1); }
  else drawField(f, fx + fh * 0.5, fy, fw - fh, fh, size, S.typing === f && caretOn(t));
}

// ---- Slack（風）：上司の激詰め。配置と色だけをそれっぽくした、ロゴのない画面 ----
function drawSlack(S, K, t, dt, pb) {
  const fs = S.fs, sw = clamp(W * 0.2, 150, 280), hh = fs * 1.7, size = fs * 0.9, lh = size * 1.5, cb = fs * 2.6, top = hh;
  const bottom = pb - Math.max(cb + 20, dockRise(S, t, K)) - (K.typingWho ? size * 1.0 : 0);
  g.fillStyle = '#ffffff'; g.fillRect(sw, 0, W - sw, pb);
  const ax = sw + 20, as = fs * 1.9, tx = ax + as + 14, maxW = W - tx - 28;
  const rows = []; let y = fs * 0.5, prev = null;
  K.msgs.forEach(m => {
    const lines = lay(m, size, maxW), head = !prev || prev.who !== m.who;
    const card = m.file ? size * 3.1 : 0, rx = m.reacts?.length ? size * 1.9 : 0, h = (head ? size * 1.5 : 0) + lines.length * lh + card + rx + size * 0.5;
    rows.push({m, lines, head, card, rx, y, h}); y += h; prev = m;
  });
  K.scroll += (Math.max(0, y - (bottom - top - 6)) - K.scroll) * (1 - Math.exp(-dt / 140));
  g.save(); g.beginPath(); g.rect(sw, top, W - sw, bottom - top); g.clip();
  rows.forEach(r => {
    const p = popOf(r.m, t, 240), by = top + r.y - K.scroll + (1 - easeOut(p)) * size * 0.8;
    if (by + r.h < top - 4 || by > bottom + 4) return;
    g.save(); g.globalAlpha = p;   // ぽんっ：下から、すっと出る
    g.textBaseline = 'middle';
    let yy = by;
    if (r.head) {
      const boss = r.m.who === 'boss';
      g.fillStyle = boss ? '#ecb22e' : '#36c5f0'; rr(ax, by + 3, as, as, 6); g.fill();
      g.fillStyle = INK; g.font = `700 ${fs * 0.8}px ${FONT}`; g.textAlign = 'center'; g.fillText(boss ? BOSS[0] : 'あ', ax + as / 2, by + 3 + as / 2 + 1);
      g.textAlign = 'left'; g.font = `700 ${size}px ${FONT}`; g.fillText(boss ? BOSS : 'あなた', tx, by + size * 0.8);
      const nw = g.measureText(boss ? BOSS : 'あなた').width;
      g.font = `500 ${size * 0.7}px ${FONT}`; g.fillText(r.m.time || '', tx + nw + 10, by + size * 0.8);
      yy += size * 1.5;
    }
    drawBlock(r.m, tx, yy, size, lh, r.lines, false);
    if (r.card) {   // 添付ファイル
      const cy = yy + r.lines.length * lh + 4, cwid = Math.min(maxW, size * 15);
      g.strokeStyle = '#c9ced6'; g.lineWidth = 1; rr(tx, cy, cwid, r.card - 8, 8); g.stroke();
      g.fillStyle = INK; g.fillRect(tx + 12, cy + 10, size * 1.4, (r.card - 8) - 20);
      g.font = `700 ${size * 0.8}px ${FONT}`; g.textAlign = 'left'; g.fillText(r.m.file, tx + 12 + size * 1.4 + 12, cy + (r.card - 8) / 2);
    }
    if (r.rx) {   // リアクション：絵文字と数の小さな札。増えた瞬間に、少しはずむ
      let rx = tx; const ry = yy + r.lines.length * lh + r.card + size * 0.25, rh = size * 1.35;
      g.font = `500 ${size * 0.75}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      for (const x of r.m.reacts) {
        const label = `${x.e} ${x.n}`, rw = g.measureText(label).width + size * 1.0, b = 1 + 0.12 * Math.exp(-(t - x.t) / 120);
        g.save(); g.translate(rx + rw / 2, ry + rh / 2); g.scale(b, b);
        g.fillStyle = '#eef4fb'; g.strokeStyle = '#1d6fb8'; g.lineWidth = 1; rr(-rw / 2, -rh / 2, rw, rh, rh / 2); g.fill(); g.stroke();
        g.fillStyle = '#1d4f86'; g.fillText(label, -rw / 2 + size * 0.5, 1); g.restore();
        rx += rw + size * 0.4;
      }
    }
    g.restore();
  });
  g.restore();
  if (K.typingWho) { g.font = `500 ${size * 0.8}px ${FONT}`; g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(`${K.typingWho}さんが入力中…`, ax, bottom + size * 0.6); }
  // ヘッダー
  g.fillStyle = '#ffffff'; g.fillRect(sw, 0, W - sw, hh); g.fillStyle = '#e0e0e0'; g.fillRect(sw, hh - 1, W - sw, 1);
  g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `700 ${size * 1.05}px ${FONT}`; g.fillText('# ' + CHANNEL, ax, hh / 2);
  // 入力欄
  const cx = sw + 16, cwid = W - sw - 32, cy = pb - cb - 10;
  g.fillStyle = '#ffffff'; rr(cx, cy, cwid, cb, 8); g.fill(); g.strokeStyle = '#868686'; g.lineWidth = 1.5; rr(cx, cy, cwid, cb, 8); g.stroke();
  g.fillStyle = '#007a5a'; rr(cx + cwid - fs * 1.7, cy + cb - fs * 1.2, fs * 1.4, fs * 0.9, 5); g.fill();   // 送信
  const f = K.input;
  if (!f.text && !f.comp && !f.pend) { g.globalAlpha = 0.4; g.fillStyle = INK; g.font = `500 ${size}px ${FONT}`; g.textAlign = 'left'; g.fillText(`# ${CHANNEL} へのメッセージ`, cx + 14, cy + cb * 0.35); g.globalAlpha = 1; if (S.typing === f && caretOn(t)) { g.fillStyle = INK; g.fillRect(cx + 14, cy + cb * 0.35 - size * 0.55, 2, size * 1.1); } }
  else drawField(f, cx + 14, cy, cwid - fs * 2.4, cb * 0.7, size, S.typing === f && caretOn(t));
  // サイドバー：幅に合わせて字を小さくし、はみ出さない
  g.save(); g.beginPath(); g.rect(0, 0, sw, pb); g.clip();
  g.fillStyle = '#3f0e40'; g.fillRect(0, 0, sw, pb);
  const SB = [['# 全体連絡', 0], ['# ' + CHANNEL, 1], ['# 雑談', 0], ['', 2], ['ダイレクトメッセージ', 3], [BOSS, 0], ['あなた', 0]];
  g.font = `500 100px ${FONT}`;
  const widest = Math.max(...SB.map(([s]) => g.measureText(s).width)) / 100 * 1.06, ss = Math.min(size * 0.68, (sw - 34) / widest);
  const ts = Math.min(size * 0.64, (sw - 28) / 8.6);   // 会社名は2行（8字まで）
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.font = `700 ${ts}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('アルファ・', 16, hh / 2 - ts * 0.55); g.fillText('コンサルティング', 16, hh / 2 + ts * 0.62);
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, hh - 1, sw, 1);
  let iy = hh + ss * 1.3;
  SB.forEach(([s, kind]) => {
    if (kind === 2) { iy += ss * 0.7; return; }
    if (kind === 1) { g.fillStyle = '#1164a3'; rr(8, iy - ss * 0.85, sw - 16, ss * 1.7, 6); g.fill(); }
    g.fillStyle = kind === 3 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)'; g.font = `${kind === 1 ? 700 : 500} ${ss * (kind === 3 ? 0.82 : 1)}px ${FONT}`;
    g.fillText(s, 16, iy); iy += ss * 1.9;
  });
  g.restore();
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
  g.font = `700 ${size * 0.7}px ${FONT}`; g.fillText('全員が返信できます', tx, ay - ar * 0.45);
  // 星と本文
  let y = ay + ar * 0.25;
  const ss = size * 1.15;
  g.font = `500 ${ss}px ${FONT}`; g.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) { g.fillStyle = i < X.stars ? RED : INK; g.fillText(i < X.stars ? '★' : '☆', tx + i * ss * 1.12, y + ss * 0.6); }
  y += ss * 1.5;
  const by = cy + ch - fs * 1.5, yEnd = by - fs * 1.4, area = yEnd - y;
  const lines = lay(X, size, tw), need = (curLine(X, lines) + 2) * lh;
  X.scroll += (Math.max(0, need - area) - X.scroll) * (1 - Math.exp(-dt / 90));
  if (!X.text && !X.pend && !X.comp && S.typing !== X) { g.globalAlpha = 0.4; g.fillStyle = INK; g.font = `500 ${size}px ${FONT}`; g.fillText('いまどうしてる？', tx, y + lh / 2); g.globalAlpha = 1; }
  g.save(); g.beginPath(); g.rect(cx, y, cw, area); g.clip();
  drawBlock(X, tx, y - X.scroll, size, lh, lines, S.typing === X && caretOn(t), FONT, tx + tw);
  g.restore();
  // 下の行：文字数のリング（140字をこえると、こえた字数が赤で出る）と「ポストする」（押されると青）
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
}

// ---- 待機：ローディング画面のように、落ちた・通った・回った・満ちた場所のキーが打たれる（4つの動きが順に変わる） ----
const newSaver = () => ({k: 'saver', mode: 0, t0: 0, len: 9500, x: 0.5, vx: 1.3, y: 1, vy: 0, wait: 0, sq: 0, after: false, last: -1, p: 0, hold: 0});
function drawSaver(S, V, t, dt, pb) {
  if (!V.t0) V.t0 = t;
  if (t - V.t0 > V.len) { Object.assign(V, {mode: (V.mode + 1) % 4, t0: t, last: -1, p: 0, hold: 0, wait: 0, y: 1, vy: 0, after: false}); }
  const d = dt / 1000 * P.spd, top = H * 0.1, ground = KY - STEP * 0.75, cy = ground * 0.5, ph = (t - V.t0) / 1000 * P.spd;
  g.fillStyle = INK;
  if (V.mode === 0) {   // 跳ねるボール：落ちた場所のキー
    if (V.wait > 0) V.wait -= dt;
    else {
      V.vy -= 4 * d; V.y += V.vy * d; V.x += V.vx * d;
      if (V.x > 7) { V.x = 7; V.vx *= -1; } if (V.x < 0) { V.x = 0; V.vx *= -1; }
      if (V.y <= 0) {
        const v = -V.vy; V.y = 0; V.vy = v * 0.78; V.sq = t;
        hit(Math.round(V.x), P.len, P.str * clamp(v / 2.8, 0.3, 1));
        if (V.vy < 0.55) { V.vy = 0; V.wait = 700; V.after = true; }
      }
    }
    if (V.wait <= 0 && V.after) { V.after = false; V.y = 1; V.vy = 0; V.x = rand(0.5, 6.5); V.vx = (Math.random() < 0.5 ? -1 : 1) * rand(0.8, 1.8); }
    const x = kToX(V.x), y = ground - 16 - V.y * (ground - 16 - top), q = Math.exp(-(t - V.sq) / 60);
    g.globalAlpha = 0.14; g.fillRect(W * 0.08, ground, W * 0.84, 1);
    g.beginPath(); g.ellipse(x, ground, 18 * (1 - V.y * 0.5), 4, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    g.beginPath(); g.ellipse(x, y + q * 5, 16 * (1 + q * 0.35), 16 * (1 - q * 0.3), 0, 0, Math.PI * 2); g.fill();
  } else if (V.mode === 1) {   // 横に動くボール：通ったキーが、ウェーブのように打たれる
    const k = 3.5 + 3.5 * Math.sin(ph * 2 * Math.PI / 5.4 - Math.PI / 2), kr = clamp(Math.round(k), 0, 7);
    if (kr !== V.last) { if (V.last >= 0) strikeFree(kr); V.last = kr; }
    g.globalAlpha = 0.14; g.fillRect(kx(0) - STEP * 0.3, cy + 22, kx(7) - kx(0) + STEP * 0.6, 1); g.globalAlpha = 1;
    for (let i = 7; i >= 0; i--) {   // 尾
      const kk = 3.5 + 3.5 * Math.sin((ph - i * 0.07) * 2 * Math.PI / 5.4 - Math.PI / 2);
      g.globalAlpha = i === 0 ? 1 : 0.22 * (1 - i / 8); g.beginPath(); g.arc(kToX(kk), cy, i === 0 ? 16 : 12 - i, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  } else if (V.mode === 2) {   // 回る点：スピナー。いまの点のキーが打たれる
    const n = 8, head = Math.floor(ph / 0.34) % n, R = STEP * 0.9;
    if (head !== V.last) { strikeFree(head); V.last = head; }
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / n, back = (head - i + n) % n;
      g.globalAlpha = back === 0 ? 1 : Math.max(0.12, 0.8 - back * 0.12);
      g.beginPath(); g.arc(W / 2 + Math.cos(a) * R, cy + Math.sin(a) * R, back === 0 ? 11 : 8, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  } else {   // 満ちるバー：先端が通ったキーが打たれる
    const bw = kx(7) - kx(0) + STEP * 0.6, bx = W / 2 - bw / 2, by = cy, bh = 9;
    if (V.hold > 0) V.hold -= dt;
    else {
      V.p += dt / 3600 * P.spd;
      const pe = ease3(clamp(V.p, 0, 1));   // 画面の先端と同じ位置で、キーが打たれる
      for (let k = 0; k < 8; k++) { const kk = (kx(k) - (kx(0) - STEP * 0.3)) / bw; if (V.last < k && pe >= kk) { strikeFree(k); V.last = k; } }
      if (V.p >= 1) { V.p = 1; V.hold = 900; }
    }
    if (V.hold <= 0 && V.p >= 1) { V.p = 0; V.last = -1; }
    g.globalAlpha = 0.14; rr(bx, by, bw, bh, bh / 2); g.fill(); g.globalAlpha = 1;
    rr(bx, by, Math.max(bh, bw * ease3(clamp(V.p, 0, 1))), bh, bh / 2); g.fill();
  }
}
function kToX(k) {   // キーの番号（小数も）→ 画面の x
  if (k <= 0) return kx(0) + k * STEP;
  if (k >= 7) return kx(7) + (k - 7) * STEP;
  const i = Math.floor(k);
  return kx(i) + (kx(i + 1) - kx(i)) * (k - i);
}

function drawScr(S, scr, t, dt, pb) {
  if (!scr) return;
  if (scr.k === 'saver') drawSaver(S, scr, t, dt, pb);
  else if (scr.k === 'flood') drawFlood(S, scr, t, pb);
  else if (scr.k === 'cli') drawCli(S, scr, t, dt, pb);
  else if (scr.k === 'line') drawLine(S, scr, t, dt, pb);
  else if (scr.k === 'slack') drawSlack(S, scr, t, dt, pb);
  else if (scr.k === 'x') drawX(S, scr, t, dt, pb);
}
const TOTAL = 240000;   // 通しの目安（投稿のあとの画面まで、約4分）。右上の時計の線の長さ
function drawHud(S, t) {   // 右上：経過時間。言ったこと → 打たれたこと は、キーの下に出る
  if (!S.hud) return;   // S.hud: 2 = 時計と記録、1 = 時計だけ、0 = 出さない（H で切り替え）
  const el = S.running ? (t - S.t0) / 1000 : 0, f = v => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
  g.font = `500 12px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const put = (txt, y) => { g.lineWidth = 5; g.strokeStyle = PAPER; g.strokeText(txt, W - 14, y); g.fillStyle = INK; g.fillText(txt, W - 14, y); };   // 文字の下に紙の色の縁をつけ、重なっても読める
  put(`${f(el)}　${PH[S.phase] || ''}`, 16);
  const bx = W - 14 - 180;
  g.fillStyle = INK; g.fillRect(bx, 28, 180, 1); g.fillRect(bx, 26, Math.min(180, el * 1000 / TOTAL * 180), 5);
  g.fillStyle = RED; g.fillRect(bx + DUE.toX / TOTAL * 180 - 1, 23, 2, 11);   // 感想の投稿に入る目安
  if (S.phase === 'saver') put('Enter か「はじめる」で開始　H で表示を切り替え', 44);
  const a = S.alts[S.alts.length - 1];   // 言ったこと → 打たれたこと：キーの下の余白に、12秒ほど（スタッフ用。来場者に見せるときは H で消す）
  if (S.hud >= 2 && a && now() - a.t < 12000) {
    const txt = `言った「${cut(a.said, 22)}」→ 打たれた「${cut(a.sent, 26)}」`;
    g.font = `500 12px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const k = Math.min(1, (W - 40) / g.measureText(txt).width);
    if (k < 1) g.font = `500 ${Math.max(9, 12 * k)}px ${FONT}`;
    g.fillStyle = '#a3a4ab'; g.fillText(txt, W / 2, H - 9);
  }
}

// ================= 体験の登録 =================
const EXP = {
  id: 'dialogue', name: '声の対話（2分半）',
  note: 'インストラクターと、LINE・Slack・X の画面を行き来する。来場者は話すだけで、来場者の発言は来場者の指が打つ（ときどき別の言葉になる）',
  use: 'Enter か「はじめる」で開始／H で時計・記録の表示を切り替え',
  opts: {から: START, 声: ['マイク', '手入力'], LLM: ['あり', 'なし']},
  actions: [{label: s => s.running ? '最初から' : 'はじめる', run: s => { document.activeElement?.blur?.(); if (s.running) restart(); else begin(s); }}],
  init(S) {
    queued.fill(false);
    Object.assign(S, {phase: 'saver', running: false, dead: false, tl: [], alts: [], name: '', lv: [], fs: 28,
      cli: {k: 'cli', inst: null, me: null, gone: [], prompt: false}, sv: newSaver(), flood: null, slide: null, line: null, slack: null, x: null, dockLay: null,
      choice: null, mic: null, typing: null, hud: {'0': 0, '1': 1}[lsGet('kc-dlg-hud')] ?? 2});
    S.scr = S.sv;
    S.onKey = e => {
      if (e.target?.tagName === 'INPUT' && e.target.type === 'text') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' && !S.running) { e.preventDefault(); document.activeElement?.blur?.(); begin(S); }
      else if (e.key === 'h' || e.key === 'H') { S.hud = (S.hud + 2) % 3; lsSet('kc-dlg-hud', String(S.hud)); }
    };
    addEventListener('keydown', S.onKey);
    S.onPtr = e => {   // 画面のクリック・タップでも選べる（スタッフの確認用）
      const C = S.choice;
      if (!C || C.done) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, pb = KY - STEP * 0.62;
      if (y < pb * 0.4 || y > pb) return;
      let best = 0, bd = 1e9;
      C.zones.forEach((z, i) => { const d = Math.abs(z.reduce((a, k) => a + kx(k), 0) / z.length - x); if (d < bd) { bd = d; best = i; } });
      C.pick(best);
    };
    cv.addEventListener('pointerdown', S.onPtr);
    S.watch = setInterval(() => { if (paused && !S.dead) quit(S); }, 400);   // 一時停止したら、マイクも止める
    openMic(S);
    fetch('/api/status').then(r => r.json()).then(j => {
      S.llmOff = !j.llm;
      if (S.llmOff && S.o.LLM === 'あり') status('LLM のキーが .env にありません。返事は台本の文言で進みます', 5000);
    }).catch(() => { S.llmOff = true; });
  },
  stop(S) { quit(S); },
  draw(S, t, dt) {
    if (S.dead) return;
    const pb = KY - STEP * 0.62;
    S.fs = clamp(STEP * 0.30, 17, 46);
    if (S.mic) { S.lv.push(micLevel(S)); if (S.lv.length > 32) S.lv.shift(); } else S.lv.length = 0;
    g.fillStyle = PAPER; g.fillRect(0, 0, W, pb);
    if (S.choice) S.dockLay = dockLayout(S);
    g.save(); g.beginPath(); g.rect(0, 0, W, pb); g.clip();
    if (S.slide) {   // 画面全体が横にスライドする（古い画面は押し出され、新しい画面が入る）
      const sl = S.slide, e = ease3(clamp((t - sl.t0) / sl.dur, 0, 1)), off = W * e * sl.dir;
      g.save(); g.translate(-off, 0); drawScr(S, sl.from, t, dt, pb); g.restore();
      g.save(); g.translate(W * sl.dir - off, 0); drawScr(S, sl.to, t, dt, pb); g.restore();
      const seam = sl.dir > 0 ? W - off : -off;
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(seam - 1, 0, 2, pb);
    } else drawScr(S, S.scr, t, dt, pb);
    if (S.choice && S.scr !== S.cli) drawDock(S, t, pb);
    g.restore();
    window.KC_POST?.place(W, pb);   // 投稿のあとの画面（DOM）を、キーより上に重ねる
    drawHud(S, t);
  },
};
window.KC_DIALOGUE = EXP;
})();
