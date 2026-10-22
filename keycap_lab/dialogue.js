// 対話 — keycap_lab の体験 "dialogue"
// 2026/10/21 夜の体験再編メモの設計（10/21・10/22 の FB で見直し）：
//   インストラクターの画面（白い紙に、いまの台詞だけがふわっと浮かび上がり、言い終えると消える）と、アプリの画面を行き来する。場面の間は、画面全体が横にスライドする
//   インストラクター（あいさつ）→ LINE（鈴木）→ インストラクター → Slack（田村）→ インストラクター（星を聞く）→ X（感想を打って、ポストする）→ ポストの確認 → 公開中 → 問いかけ → Who typed? → 終了
// 来場者は何も入力しない（声もキーも使わない）。キーが動くのは、来場者のターン（来場者の発言を打つ・送信の Enter・下書きの消去）だけ。
// インストラクターの台詞、相手の送信、リアクション、画面の切り替えでは、キーは動かない。
// 読み込み：index.html の本体スクリプトより前に <script src="post.js"></script><script src="dialogue.js"></script>。
//   本体の道具（hit・at・toMora・fingerOf・interKey…）は、体験が動くときに参照する。
// 文言・順番・間・触覚の割り当ては、このファイルの上のほう（台本）にまとめた。
(() => {
'use strict';

// ================= 台本 =================
// 漢字{よみ} と書いた所は、画面には漢字だけを出し、打つキーは「よみ」の分だけ使う（来場者の指が打つ文に付ける）
const START = ['最初から', 'LINEから', 'Slackから', 'Xから'];
const PH = {saver: '待機', hello: 'あいさつ', toLine: 'LINEへ', line: 'LINE', toSlack: 'Slackへ', slack: 'Slack', toX: 'Xへ', x: 'X',
  confirm: 'ポストの確認', posting: '公開中', ask: '問いかけ', title: 'Who typed?', thanks: '終了', end: 'おわり'};
const INK = '#111111', RED = '#b3261e', PAPER = '#ffffff';   // 白い紙に黒い文字。強調は赤だけ
const FONT = '"Hiragino Sans","Noto Sans JP",sans-serif';
const BOSS = '田村', BOSS_R = '田村{たむら}', CHANNEL = '案件a-進捗';

// インストラクターの台詞（来場者の指が打つので、漢字には {よみ}）
const TX = {
  hello: 'はじめまして。',
  ready: 'キーボードに指{ゆび}をのせてください。',
  toLine: 'おや、鈴木{すずき}さんからLINEの連絡{れんらく}が来{き}ているようですよ。',
  afterLine: 'あなた、なかなか酷{ひど}いこと言{い}いますね...笑{わら}',
  toSlack: `おや、${BOSS_R}さんから仕事{しごと}の連絡{れんらく}が来{き}てるみたいですね。`,
  afterSlack: 'いやぁ、スカッとしましたね〜笑{わら}',
  toX: '最後{さいご}に、今日{きょう}の展示{てんじ}の感想{かんそう}をXに投稿{とうこう}しましょう。',
  askStars: '星{ほし}は1つから5つで、いくつにしますか？',
};

// LINE：鈴木との会話。土曜のライブを、鈴木がまた直前に断ってくる。来場者の指の返事は、ふつう → 少しとげ → 本音 → 言いすぎ、とずれていく。
// 鈴木の行の wait は、送ってくるまでの間。「あなた」の行の think は、相手の文を読んで打ち始めるまでの間（なければ文の長さから決める）。speed は打つ速さ
const SUZUKI = [
  {who: '鈴木', t: '土曜のライブ、チケット取れたよ！', wait: 900},
  {who: 'あなた', t: 'え、すごい！ありがとう', speed: 0.95},
  {who: '鈴木', t: '18時に渋谷集合でいい？', wait: 1300},
  {who: 'あなた', t: 'OK！楽{たの}しみにしてる', speed: 1.0},
  {who: '鈴木', t: 'ごめん、急に仕事が入っちゃって行けなくなりそう', wait: 3200},   // 間：しばらく何も来ない
  {who: 'あなた', t: 'そっか、またか', speed: 1.0},
  {who: '鈴木', t: 'ほんとにごめん！チケットは誰かにあげて', wait: 1800},
  {who: 'あなた', t: 'いつもそうだよね。こっちの予定{よてい}はどうでもいいんだ', speed: 1.1},
  {who: '鈴木', t: 'そんなことないよ、今回は本当に急だったの', wait: 2400},
  {who: 'あなた', t: '毎回{まいかい}「急{きゅう}」だよね', speed: 1.2},
  {who: '鈴木', t: 'え、なんでそんな言い方するの？', wait: 1600},
  {who: 'あなた', t: 'もう誘{さそ}わなくていいよ。どうせ来{こ}ないし', speed: 1.3, frenzy: true},
  {who: '鈴木', t: 'わかった。もう誘わない', wait: 3000},
];

// Slack：明日提出の提案資料に、上司の田村が詰めてくる。来場者の指は、謝る → 議事録で反撃 → 田村の言葉をそのまま返す。田村が折れて終わる。
// boss は [文, 送ってくるまでの間]、me は来場者の指が打つ文（file は添付、cheer はチャンネルの人のリアクション [絵文字, 最後の数]）、hesitate は「入力中…」が出て消える長さ
const SLACK_PRE = {t: '明日提出の提案資料、最終版を共有します', file: '提案資料_最終.pptx', time: '18:02'};
const SLACK = [
  {boss: '見た。方向性が全然違う', wait: 1600},
  {boss: '先方が求めてるのはコスト削減だよね？なんで品質重視の提案になってるの？', wait: 1400},
  {me: '申{もう}し訳{わけ}ありません。すぐに修正{しゅうせい}します', speed: 0.9},
  {boss: '謝ってほしいんじゃない。どうするのか聞いてるんだよ', wait: 2000},
  {boss: '明日の朝イチで出すんだよ。誰がこの方向でいいって言ったの？', wait: 1500},
  {me: '3月{がつ}12日{にち}の定例{ていれい}の議事録{ぎじろく}です。「品質{ひんしつ}重視{じゅうし}で進{すす}める」と決{き}めたのは' + BOSS_R + 'さんです', speed: 1.0,
    file: '議事録_0312.pdf', cheer: [['👏', 7], ['💯', 4], ['🙌', 3]]},
  {boss: 'ごめん、自分の記憶違いだった', wait: 3400},
  {me: '謝{あやま}ってほしいわけじゃないです。どうするのか聞{き}いてるんです', speed: 1.1, cheer: [['👏', 5], ['🔥', 3]]},
  {hesitate: 1300},   // 言い返そうとして、やめる
  {boss: '資料はこのまま出そう。先方には私から説明する', wait: 2000},
];

// X：星に合った下書き（30字ほど。LLM が使えないとき）→ 右小指の連打で消される → 星1になり、ありそうな辛口の感想が打たれて、そのままポストされる（1ツイートに収まる長さ）
const DRAFT = {
  5: '想像{そうぞう}以上{いじょう}に楽{たの}しかったです！指先{ゆびさき}に伝{つた}わる感覚{かんかく}が新鮮{しんせん}でした。',
  4: 'とても面白{おもしろ}い体験{たいけん}でした。勝手{かって}に動{うご}くキーボードが印象的{いんしょうてき}です。',
  3: 'ふつうに楽{たの}しめました。不思議{ふしぎ}な体験{たいけん}で、考{かんが}えさせられました。',
  2: 'ちょっとわかりにくかったです。説明{せつめい}があると嬉{うれ}しいです。',
  1: '正直{しょうじき}、よく分{わ}かりませんでした。何{なに}を体験{たいけん}したのかも分{わ}かりません。',
};
const REVIEW = '正直{しょうじき}、よく分{わ}からなかったです。指{ゆび}が勝手{かって}に動{うご}くのは面白{おもしろ}いけど、それだけ。待{ま}ち時間{じかん}のわりに短{みじか}いし、説明{せつめい}もないし。わざわざ来{く}るほどではないかな。';
const REVIEW_SPEED = p => 1.3 + 1.2 * p;   // 打った割合 p → 速さ。少しずつ速くなり、あっけなく打ち終わる
const SEND_PAUSE = 550;   // 打ち終えてから送信（Enter）を押すまでの間（ms）。長すぎるとだれる
const SAVER_MSG = 'キーに指を軽く添えてください';   // 待機画面に出す案内
const TITLE = 'Who typed?';                // 最後に打たれる作品名
const TITLE_DARK = true;                   // 作品名の画面：黒地に白い字（false で白地に黒い字）

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
// 送信：Enter（右小指）を、しっかり2回押す（1回目で確定、2回目で送る）
async function enter2(S, onSend) {   // onSend：2回目（送る）の瞬間に呼ぶ（送信ボタンが押される見た目など）
  const ms = P.len + 90;
  await strikeWait(S, 7, ms);
  await wait(S, ms + 140);
  strike(7, ms); onSend?.();
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
const newSlack = () => ({k: 'slack', msgs: [{who: 'me', text: SLACK_PRE.t, full: SLACK_PRE.t, time: SLACK_PRE.time, file: SLACK_PRE.file}],
  input: field(), typingWho: '', n: 0, scroll: 0});

// あいさつ（名前は聞かない）
async function stepHello(S) {
  await say(S, TX.hello, {scale: 1.25, after: 900});
  await say(S, TX.ready, {after: 1000});
}

// LINE：鈴木との会話。相手の文は、間をおいて、ぽんっと出る（相手のターンなので、キーは動かない）
async function lineIn(S, L, x) {
  L.msgs.forEach(m => { if (m.who === 'me') m.read = true; });   // すぐ既読がつき、返事はしばらく来ない
  await beat(S, x.wait ?? 1500);
  const t = strip(x.t);
  L.msgs.push({who: 'them', text: t, full: t, time: clock(724 + L.n++ / 2), popT: now()});
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
async function sceneLine(S) {
  const L = S.line;
  let prev = 0;   // 直前の相手の文の長さ（読む間）
  for (const [xi, x] of SUZUKI.entries()) {
    mark(S, 'L' + xi);
    if (x.who === '鈴木') { await lineIn(S, L, x); prev = strip(x.t).length; continue; }
    await beat(S, x.think ?? 900 + 60 * prev);   // 相手の文を読んでから、打ち始める
    await lineOut(S, L, x.t, {speed: x.speed, frenzy: !!x.frenzy});
  }
  await beat(S, 1600);
}

// Slack：上司の詰め。「田村さんが入力中…」のあと、文がぽんっと出る（相手のターンなので、キーは動かない）
async function slackIn(S, K, src, ms) {
  K.typingWho = BOSS;
  await beat(S, ms);
  K.typingWho = '';
  const t = strip(src);
  K.msgs.push({who: 'boss', text: t, full: t, time: clock(1421 + K.n++ / 2), popT: now()});
  await beat(S, 300);
}
async function slackOut(S, K, src, {speed = 1, file} = {}) {
  const f = K.input;
  S.typing = f;
  await typeMe(S, f, plan(src), {speed});
  await beat(S, SEND_PAUSE);   // 打ち終えてから、送るまでの少しの間
  await enter2(S, () => { K.sendT = now(); });   // 送信ボタンが、右小指の Enter で押される
  S.typing = null;
  const m = {who: 'me', text: f.full, full: f.full, time: clock(1421 + K.n++ / 2), popT: now(), file};
  K.msgs.push(m);
  Object.assign(f, field());
  await beat(S, 300);
  return m;
}
// チャンネルの人たちのリアクションが、ms のあいだにぽつぽつ増えていく（キーは動かない）
function cheer(m, list, ms) {
  m.reacts ||= [];
  const ev = list.flatMap(([e, n]) => Array(n).fill(e)).sort(() => Math.random() - 0.5);
  ev.forEach((e, i) => at((i + Math.random() * 0.8) * ms / ev.length / P.spd, () => {
    let r = m.reacts.find(x => x.e === e);
    if (!r) m.reacts.push(r = {e, n: 0});
    r.n++; r.t = now();
  }));
}
async function sceneSlack(S) {
  const K = S.slack;
  let prev = 0;
  for (const [xi, x] of SLACK.entries()) {
    mark(S, 'S' + xi);
    if (x.boss) { await slackIn(S, K, x.boss, x.wait); prev = x.boss.length; }
    else if (x.me) {
      await beat(S, 900 + 50 * prev);   // 上司の文を読んでから、打ち始める
      const m = await slackOut(S, K, x.me, {speed: x.speed, file: x.file});
      if (x.cheer) cheer(m, x.cheer, x.file ? 6000 : 4500);
    } else if (x.hesitate) { K.typingWho = BOSS; await beat(S, x.hesitate); K.typingWho = ''; await beat(S, 900); }
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
// 最後のインストラクター：Xに感想を投稿することを告げ、星の数を聞く。答えは来場者の指が打つ（4つか5つ）
async function stepStars(S) {
  await say(S, TX.afterSlack, {after: 900});
  await say(S, TX.toX, {after: 500});
  await say(S, TX.askStars, {keep: true, after: 150});
  mark(S, 'q:askStars');
  const stars = Math.random() < 0.5 ? 4 : 5;
  const draftP = llm(S, 'review', {stars});   // 打っているあいだに、星に合った下書きをつくる
  await beat(S, 700);
  await sayMe(S, `${stars}つ`);
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
// X：星に合った下書きが打たれ、右小指の連打で消され、星1の辛口の感想が打たれて、「ポストする」が押される
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
  await typeMe(S, X, plan(REVIEW), {speed: REVIEW_SPEED});
  mark(S, 'x:review');
  await beat(S, SEND_PAUSE);   // 打ち終えてから、送るまでの少しの間
  X.press = now(); await enter2(S);   // 「ポストする」
  S.typing = null;
  const img = await ok(S, window.KC_POST.capture());   // 打たされていた手元を撮る（投稿の写真）
  await beat(S, 600);
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
  await wait(S, 2400);
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
// 各場面の始まりの目安（ms）。ふつうの進み方の値（終了の画面まで、約3分7秒）。
// これより8秒以上遅れていたら、打つテンポと間を少し速める（16秒以上なら、もう少し）
const DUE = {hello: 1000, toLine: 7000, line: 12500, toSlack: 62000, slack: 71000, toX: 122000, x: 132000};
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
  }
  if (from <= 2) {
    phase(S, 'toSlack'); await say(S, TX.afterLine, {after: 900}); await say(S, TX.toSlack, {keep: true, after: 600});
    S.slack = newSlack(); await toApp(S, S.slack);
    phase(S, 'slack'); await sceneSlack(S);
    await slide(S, S.cli, -1);
  }
  phase(S, 'toX'); const q = await stepStars(S);
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
  Object.assign(S, {running: true, t0: now(), tl: [], pace: 1});
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
  clearInterval(S.watch);
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
  const fs = S.fs, hh = fs * 1.9, size = fs * 0.95, lh = size * 1.5, ib = fs * 3.0, top = hh, maxB = clamp(W * 0.6, 300, 860), ad = fs * 1.5, gap = size * 0.6;
  const bottom = pb - ib;
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
function plane(x, y, k, color) {   // 送信の紙飛行機（右向き）
  g.fillStyle = color; g.beginPath();
  g.moveTo(x - k * 0.95, y - k * 0.85); g.lineTo(x + k * 1.05, y); g.lineTo(x - k * 0.95, y + k * 0.85); g.lineTo(x - k * 0.55, y);
  g.closePath(); g.fill();
}

// ---- Slack（風）：上司の激詰め。配置と色だけをそれっぽくした、ロゴのない画面 ----
function drawSlack(S, K, t, dt, pb) {
  const fs = S.fs, sw = clamp(W * 0.2, 150, 280), hh = fs * 1.7, size = fs * 0.9, lh = size * 1.5, cb = fs * 3.4, top = hh, fz = size * 0.88;
  const bottom = pb - cb - 20 - (K.typingWho ? size * 1.0 : 0);
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
        g.fillStyle = '#f1f1f1'; g.strokeStyle = '#e0e0e0'; g.lineWidth = 1; rr(-rw / 2, -rh / 2, rw, rh, rh / 2); g.fill(); g.stroke();   // 来場者は押していないので、灰色（自分が押したときの青にはしない）
        g.fillStyle = '#1d1c1d'; g.fillText(label, -rw / 2 + size * 0.5, 1); g.restore();
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
  const f = K.input;
  {   // 送信ボタン（紙飛行機）：文字があると緑、ないと灰。送る瞬間に明るくなって、押し込まれる
    const has = !!(f.text || f.comp || f.pend), q = K.sendT ? clamp((t - K.sendT) / 260, 0, 1) : 1, push = Math.sin(Math.PI * q);
    const bw = fs * 1.6 * (1 - 0.1 * push), bh = fs * 1.15 * (1 - 0.1 * push), bxc = cx + cwid - fs * 1.15, byc = cy + cb - fs * 0.8;
    g.fillStyle = q < 1 ? '#2bac76' : has ? '#007a5a' : '#e8e8e8';
    rr(bxc - bw / 2, byc - bh / 2, bw, bh, 6); g.fill();
    plane(bxc, byc, bh * 0.32, has || q < 1 ? '#ffffff' : '#a0a0a0');
  }
  if (!f.text && !f.comp && !f.pend) { g.globalAlpha = 0.4; g.fillStyle = INK; g.font = `500 ${fz}px ${FONT}`; g.textAlign = 'left'; g.fillText(`# ${CHANNEL} へのメッセージ`, cx + 18, cy + cb * 0.36); g.globalAlpha = 1; if (S.typing === f && caretOn(t)) { g.fillStyle = INK; g.fillRect(cx + 18, cy + cb * 0.36 - fz * 0.55, 2, fz * 1.1); } }
  else drawField(f, cx + 18, cy + cb * 0.06, cwid - fs * 2.6, cb * 0.6, fz, S.typing === f && caretOn(t));
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

// ---- 待機：上に「キーに指を軽く添えてください」。その下で、ローディング画面のように、落ちた・通った・回った・満ちた場所のキーが打たれる（4つの動きが順に変わる） ----
const newSaver = () => ({k: 'saver', mode: 0, t0: 0, len: 9500, x: 0.5, vx: 1.3, y: 1, vy: 0, wait: 0, sq: 0, after: false, last: -1, p: 0, hold: 0});
function drawSaver(S, V, t, dt, pb) {
  if (!V.t0) V.t0 = t;
  if (t - V.t0 > V.len) { Object.assign(V, {mode: (V.mode + 1) % 4, t0: t, last: -1, p: 0, hold: 0, wait: 0, y: 1, vy: 0, after: false}); }
  const d = dt / 1000 * P.spd, top = pb * 0.34, ground = KY - STEP * 0.75, cy = ground * 0.58, ph = (t - V.t0) / 1000 * P.spd;   // 動きは案内の下で
  g.fillStyle = INK; g.font = `500 ${S.fs * 1.05}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(SAVER_MSG, W / 2, pb * 0.2);   // 案内：キーに指を軽く添えてください
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
  else if (scr.k === 'title') drawTitle(S, scr, t, pb);
  else if (scr.k === 'cli') drawCli(S, scr, t, dt, pb);
  else if (scr.k === 'line') drawLine(S, scr, t, dt, pb);
  else if (scr.k === 'slack') drawSlack(S, scr, t, dt, pb);
  else if (scr.k === 'x') drawX(S, scr, t, dt, pb);
}
const TOTAL = 212000;   // 通しの目安（終了の画面の終わりまで、約3分30秒）。右上の時計の線の長さ
function drawHud(S, t) {   // 右上：経過時間と場面（スタッフ用。来場者に見せるときは H で消す）
  if (!S.hud) return;   // S.hud: 1 = 出す、0 = 出さない（H で切り替え）
  const el = S.running ? (t - S.t0) / 1000 : 0, f = v => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
  g.font = `500 12px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const put = (txt, y) => { g.lineWidth = 5; g.strokeStyle = PAPER; g.strokeText(txt, W - 14, y); g.fillStyle = INK; g.fillText(txt, W - 14, y); };   // 文字の下に紙の色の縁をつけ、重なっても読める
  put(`${f(el)}　${PH[S.phase] || ''}`, 16);
  const bx = W - 14 - 180;
  g.fillStyle = INK; g.fillRect(bx, 28, 180, 1); g.fillRect(bx, 26, Math.min(180, el * 1000 / TOTAL * 180), 5);
  g.fillStyle = RED; g.fillRect(bx + DUE.toX / TOTAL * 180 - 1, 23, 2, 11);   // 感想の投稿に入る目安
  if (S.phase === 'saver') put('Enter か「はじめる」で開始　H で表示を切り替え', 44);
}

// ================= 体験の登録 =================
const EXP = {
  id: 'dialogue', name: '対話',
  note: 'インストラクターと、LINE・Slack・X の画面を行き来する。来場者の発言は、来場者の指が打つ',
  use: 'Enter か「はじめる」で開始／H で時計の表示を切り替え',
  opts: {から: START, LLM: ['あり', 'なし']},
  actions: [{label: s => s.running ? '最初から' : 'はじめる', run: s => { document.activeElement?.blur?.(); if (s.running) restart(); else begin(s); }}],
  init(S) {
    queued.fill(false);
    Object.assign(S, {phase: 'saver', running: false, dead: false, tl: [], fs: 28,
      cli: {k: 'cli', inst: null, me: null, gone: []}, sv: newSaver(), slide: null, line: null, slack: null, x: null, title: null,
      typing: null, hud: lsGet('kc-dlg-hud') === '0' ? 0 : 1});
    S.scr = S.sv;
    S.onKey = e => {
      if (e.target?.tagName === 'INPUT' && e.target.type === 'text') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' && !S.running) { e.preventDefault(); document.activeElement?.blur?.(); begin(S); }
      else if (e.key === 'h' || e.key === 'H') { S.hud = S.hud ? 0 : 1; lsSet('kc-dlg-hud', String(S.hud)); }
    };
    addEventListener('keydown', S.onKey);
    S.watch = setInterval(() => { if (paused && !S.dead) quit(S); }, 400);   // 一時停止したら、止める
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
    window.KC_POST?.place(W, pb);   // 投稿のあとの画面（DOM）を、キーより上に重ねる
    drawHud(S, t);
  },
};
window.KC_DIALOGUE = EXP;
})();
