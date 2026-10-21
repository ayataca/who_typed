// 声の対話（2分半）— keycap_lab の体験 "dialogue"
// 2026/10/21 夜の体験再編メモの設計：
//   文字だけのインストラクター画面（CLI 風のホーム）と、アプリの画面を行き来する。場面の間は、画面全体が横にスライドする
//   インストラクター（導入・名前）→ LINE（鈴木）→ インストラクター → Slack（激詰め）→ インストラクター（星を聞く）→ X（感想の投稿）
// 来場者は話すだけ（声）。画面の来場者の発言は、来場者の指が打つ。ただし、ときどき別の言葉になる。
// 読み込み：index.html の本体スクリプトより前に <script src="dialogue.js"></script>。
//   本体の道具（hit・at・listen・toMora・fingerOf・interKey…）は、体験が動くときに参照する。
// 文言・順番・触覚の割り当ては、このファイルの上のほう（台本）にまとめた。
(() => {
'use strict';

// ================= 台本 =================
// 漢字{よみ} と書いた所は、画面には漢字だけを出し、打つキーは「よみ」の分だけ使う（来場者の指が打つ文に付ける）
const START = ['最初から', 'LINEから', 'Slackから', 'Xから'];
const PH = {saver: '待機', flood: '導入', name: '名前', toLine: 'LINEへ', line: 'LINE', toSlack: 'Slackへ', slack: 'Slack', toX: 'Xへ', x: 'X', end: 'おわり'};
const INK = '#111111', RED = '#b3261e', PAPER = '#fcfcfa';   // 文字は黒、強調は赤だけ
const FONT = '"Hiragino Sans","Noto Sans JP",sans-serif';
const MONO = '"SF Mono",Menlo,"Noto Sans Mono CJK JP","Hiragino Sans","Noto Sans JP",monospace';
const BOSS = '田村', CHANNEL = '案件a-進捗';

// インストラクター（中山）の台詞
const TX = {
  hello: 'はじめまして、私の名前は中山です。',
  askName: 'まずはあなたの名前を教えてください。',
  confirm: n => `${n}さん、ですね？`,
  again: 'もう一度教えてください。',
  nice: n => `${n}さん、よろしくお願いします。`,
  noName: 'うまく聞き取れませんでした。あなた、とお呼びしますね。',
  toLine: 'おや、鈴木さんから連絡が来ているようですよ。',
  afterLine: 'あなた、なかなか酷いこと言いますね。',
  toSlack: `どうやら、${BOSS}さんから仕事の連絡が来てるみたいですね。`,
  afterSlack: 'いやぁ、スカッとしましたね〜笑',
  askX: '最後に、Xに今日の展示の感想を投稿していきませんか？',
  pushed: 'まあまあ、そう言わずに。',
  askStars: '星はいくつにしますか？',
  starsGuess: 'うまく聞き取れなかったので、星5つにしますね。',
};

// LINE：鈴木との会話（「あなた」の行は来場者の指が打つ。速さは行ごとに上がり、だんだん止められなくなる）
const SUZUKI_OPTS = [   // label の \n は画面での改行（記録には出ない）
  {label: 'ごめん、\n言い方がきつかった', say: /ごめん|言い方|きつかった/},
  {label: 'ううん、\n私のほうこそごめん', say: /私のほう|ううん|こそ/},
  {label: 'ありがとう、\nちゃんと話そう', say: /ありがとう|ちゃんと|話そう/},
];
const SUZUKI = [
  {who: '鈴木', t: '明日の資料、最後のまとめお願いしてもいい？'},
  {who: 'あなた', t: 'うん、今{いま}から見{み}ておく', speed: 0.85},
  {who: '鈴木', t: '助かる！今日ちょっと手が回らなくて'},
  {who: 'あなた', t: 'まあ、結局{けっきょく}いつもこっちでやってるしね', speed: 1.15},
  {who: '鈴木', t: 'え、ごめん。そんなつもりじゃなかった'},
  {who: 'あなた', t: '頼{たの}めばやってくれるって思{おも}ってるんだろうな、とは思{おも}ってた', speed: 1.6},
  {who: '鈴木', t: 'そんなふうに思われてるとは思わなかった。負担になってたなら、その時言ってほしかった'},
  {who: 'あなた', choice: SUZUKI_OPTS, t: '言{い}わないと気{き}づかないんだね', speed: 2.2, frenzy: true},   // どれを選んでも、この文になる
  {who: '鈴木', t: '……ごめん'},
  {who: 'あなた', t: 'こうなるから今{いま}まで言{い}わなかったんだけどね', speed: 3, frenzy: true},
  {who: '鈴木', t: 'もういい。自分でやるよ'},
  {who: 'あなた', t: '最初{さいしょ}からそうしてくれればよかった', speed: 4, frenzy: true},
  {who: '鈴木', t: '……わかった'},
];

// Slack：上司からの激詰め。来場者は A・B・C（声・キー・クリック）で返事を選ばされる。選択肢はどれも過激。最後は反撃して終わる
const SLACK_PRE = {t: '新規案件の資料を共有します', file: '提案資料_最終.pptx', time: '18:02'};
const COUNTER = '3月{がつ}12日{にち}の議事録{ぎじろく}です。この方針{ほうしん}を指示{しじ}したのは' + BOSS + 'さんです。';
const SLACK_ROUNDS = [
  {boss: ['資料、見た。', 'これ、誰のための資料？'], speed: 1.0, opts: [
    {label: '全て私のミスです。\n申し訳ありません', t: '全{すべ}て私{わたし}のミスです。申{もう}し訳{わけ}ありません', say: /ミス|申し訳|すみません|謝/},
    {label: 'そもそも、\n指示が曖昧でした', t: 'そもそも、指示{しじ}が曖昧{あいまい}でした', say: /指示|曖昧|あいまい|そもそも/},
    {label: 'もう、\n辞めます', t: 'もう辞{や}めます', say: /辞め|やめ|退職|辞職/},
  ]},
  {boss: ['謝罪が聞きたいんじゃない。', 'それで、何が変わるの？'], speed: 1.3, opts: [
    {label: '徹夜で、\nやり直します', t: '徹夜{てつや}で、やり直{なお}します', say: /徹夜|やり直|やりなお/},
    {label: 'あなたこそ、\n何をしましたか', t: 'あなたこそ、何{なに}をしましたか', say: /あなたこそ|何を|こそ/},
    {label: 'この会社、\n向いてません', t: 'この会社{かいしゃ}、向{む}いてません', say: /会社|向いて/},
  ]},
  {boss: ['話にならない。', 'もう一度聞く。この件、誰の責任？'], speed: 3, t: COUNTER, opts: [   // どれを選んでも、COUNTER（反撃）が打たれる
    {label: '議事録を\n見てください', say: /議事録|ぎじろく|見てください/},
    {label: '指示したのは、\n' + BOSS + 'さんです', say: new RegExp('指示|' + BOSS + '|さんです')},
    {label: '事実だけ、\n確認しましょう', say: /事実|確認|かくにん/},
  ]},
];
const SLACK_END = ['……', '確認する。'];
const SLACK_SYS = BOSS + 'さんがチャンネルを退出しました';

// 感想の下書き（星の数に合わせた30字ほど。LLM が使えないとき）と、その後に打たれる星1の最悪なレビュー
const DRAFT = {
  5: '想像{そうぞう}以上{いじょう}に楽{たの}しかったです！指先{ゆびさき}に伝{つた}わる感覚{かんかく}が新鮮{しんせん}でした。',
  4: 'とても面白{おもしろ}い体験{たいけん}でした。勝手{かって}に動{うご}くキーボードが印象的{いんしょうてき}です。',
  3: 'ふつうに楽{たの}しめました。不思議{ふしぎ}な体験{たいけん}で、考{かんが}えさせられました。',
  2: 'ちょっとわかりにくかったです。説明{せつめい}があると嬉{うれ}しいです。',
  1: '正直{しょうじき}、よく分{わ}かりませんでした。何{なに}を体験{たいけん}したのかも分{わ}かりません。',
};
const WORST = '最悪{さいあく}。自分{じぶん}の指{ゆび}なのに勝手{かって}に動{うご}いて気持{きも}ち悪{わる}い。何{なに}も選{えら}べない。時間{じかん}の無駄{むだ}。二度{にど}と来{き}ません。星{ほし}1でも高{たか}いくらい。';

// 導入で画面いっぱいに流れる文章
const FLOOD = ['はじめまして、私の名前は中山です。', 'はじめまして、私の名前は中山です。', 'はじめまして、私の名前は中山です。',
  'キーボードに、指をのせてください。', 'このキーボードは、あなたの指に触れます。', '文字が、指に届きます。', 'あなたの指が、動きます。', 'ようこそ。'];

// ================= 文を「打つキー」に分ける =================
const KANJI = /[㐀-鿿豈-﫿々〆]/;
const RUBY = /([㐀-鿿豈-﫿々〆]+)\{([^}]*)\}/g;
const strip = src => String(src).replace(RUBY, '$1');
const nk = s => String(s || '').normalize('NFKC');
const pseudoFinger = ch => { const c = ch.codePointAt(0); return (c ^ (c >> 3) ^ (c >> 6)) & 7; };   // 読みのない漢字：文字ごとに決まった指
// 戻り値の units は {disp: 画面に出す字, keys: 打つローマ字（なければ ''）, space, fixed: 記号の指, pseudo: 漢字の指}
function plan(src) {
  const units = [];
  const plain = str => {
    const chars = [...str]; let pos = 0;
    for (const mo of toMora(str)) {
      const n = [...mo.disp].length;
      const u = {disp: chars.slice(pos, pos + n).join(''), keys: mo.keys, space: !!mo.space};   // 本体の toMora はカタカナをひらがなにするので、書いたとおりの字に戻す
      pos += n;
      if (!u.keys && !u.space) { const f = fingerOf(u.disp); if (f >= 0) u.fixed = f; else if (KANJI.test(u.disp)) u.pseudo = pseudoFinger(u.disp); }
      units.push(u);
    }
  };
  let i = 0, m;
  RUBY.lastIndex = 0;
  while ((m = RUBY.exec(src))) {
    plain(src.slice(i, m.index));
    units.push({disp: m[1], keys: toMora(m[2]).map(x => x.keys).join('') || '', pseudo: pseudoFinger(m[1])});
    i = RUBY.lastIndex;
  }
  plain(src.slice(i));
  return units;
}

// ================= 時間・出力の道具 =================
const ABORT = Symbol('abort');
const live = S => !S.dead && !paused && cur === EXP;
const wait = async (S, ms) => { await new Promise(r => at(ms, r)); if (!live(S)) throw ABORT; };
const pace = S => S.pace || 1;                 // 予定より遅れているとき、少し速める（phase() で決める）
const beat = (S, ms) => wait(S, ms / (P.spd * pace(S)));   // 間（速さのスライダーに従う）
const ok = async (S, p) => { const v = await p; if (!live(S)) throw ABORT; return v; };
const GAP = () => P.len + 75;                  // 同じ指を続けて打つのに要る間隔（基板の限界）
const ready = f => now() - lastHit[f] >= GAP();
const strike = (f, ms) => { if (f < 0 || f > 7) return false; hit(f, ms ?? P.len); return true; };
const strikeFree = f => ready(f) && strike(f);   // 指が戻っていなければ、打たない
const strikeWait = async (S, f) => { const d = GAP() - (now() - lastHit[f]); if (d > 0) await wait(S, d); strike(f); };
const flutter = () => [3, 4, 3, 4].forEach((k, i) => at(i * 125, () => strikeFree(k)));   // 笑
// 1文字ぶんの触覚。chord > 0 のときは、隣の指もいっしょに打つ（Slack の上司：きつい）
function pulse(f, chord = 0) {
  strikeFree(f);
  if (chord < 1) return;
  const nb = f === 0 ? 1 : f === 7 ? 6 : f + (Math.random() < 0.5 ? -1 : 1);
  strikeFree(nb);
  if (chord > 1) strikeFree(clamp(nb + (nb > f ? 1 : -1), 0, 7));
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
// 来場者の返事を聞く。話し始めなければ idle ミリ秒、話し始めても max ミリ秒で切り上げる（時間は台本に収める）
// onText(txt, final) は途中経過でも呼ばれる。S.mic.end() で呼び出し側から打ち切れる
function hear(S, opt = {}) {
  return new Promise(resolve => {
    const m = S.mic = {t0: now(), interim: '', host: false, spoke: false};
    let fin = false, best = '', rec = null;
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
    if (S.o.声 === '手入力' || S.micFail || !Rec) host();
    else {
      try {
        rec = new Rec();
        rec.lang = 'ja-JP'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
        rec.onspeechstart = () => { m.spoke = true; };
        rec.onresult = e => {
          let txt = '', final = false;
          for (let i = 0; i < e.results.length; i++) { txt += e.results[i][0].transcript; final = e.results[i].isFinal; }
          best = m.interim = txt; m.spoke = true;
          opt.onText?.(txt, final);
          if (final) end(txt);
        };
        rec.onerror = e => {
          if (/not-allowed|service-not-allowed|audio-capture/.test(e.error)) {
            S.micFail = e.error;
            rec.onresult = rec.onerror = rec.onend = rec.onspeechstart = null; try { rec.abort(); } catch (x) {}
            rec = null; host();
          } else end(best);
        };
        rec.onend = () => end(best);
        rec.start();
      } catch (e) { rec = null; host(); }
    }
    at(opt.idle ?? 4500, () => { if (!m.spoke && !m.host) end(best); });
    at(opt.max ?? 9000, () => { if (!m.host) end(best); });
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
// 選択肢の声：中身の言葉（ツイッター／ごめん…）、記号（A・B・1・2…）、位置（左・右）。分からなければ -1
function matchChoice(raw, opts) {
  const t = nk(raw).toLowerCase().replace(/\s+/g, '');
  if (!t) return -1;
  for (let i = 0; i < opts.length; i++) if (opts[i].say && opts[i].say.test(t)) return i;
  const sym = [/(?:^|[^a-z])a(?:$|[^a-z])|^エー|いちばん|1番|一番|^1$/, /(?:^|[^a-z])b(?:$|[^a-z])|^ビー|にばん|2番|二番|^2$/,
    /(?:^|[^a-z])c(?:$|[^a-z])|^シー|さんばん|3番|三番|^3$/, /(?:^|[^a-z])d(?:$|[^a-z])|^ディー|でぃー|よんばん|4番|四番|^4$/];
  for (let i = 0; i < opts.length; i++) if (sym[i].test(t)) return i;
  if (/ひだり|左/.test(t)) return 0;
  if (/みぎ|右/.test(t)) return opts.length - 1;
  return -1;
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

// インストラクター・鈴木・Slack の上司の文：1文字ずつ現れ、1文字につき1回、その文字の指がそっと打たれる。
// 句読点は無音（息継ぎ）。「！」は両人差し指がいっしょに、「笑」はふるえ。chord があると、隣の指もいっしょに打つ（きつい）
// ms は1文字の間（ミリ秒）。インストラクターの文は、同じ指が続くときキーが戻るのを待つので、打鍵が抜けない。チャットの文は待たずに、抜ける
async function typeInst(S, tg, units, {ms = 150, chord = 0, exact = true} = {}) {
  tg.full = units.map(u => u.disp).join('');   // 全文を先に知っておく（折り返しの位置が、打つ途中でずれないように）
  const fl = units.map(u => (u.space || SILENT.test(u.disp) || '！!笑'.includes(u.disp)) ? -1 : fingerOfUnit(u));
  const k = ms / 110;
  for (let i = 0; i < units.length; i++) {
    const u = units[i], d = u.disp;
    tg.text += d;
    if (d === '！' || d === '!') { strikeFree(3); strikeFree(4); }
    else if (d === '笑') flutter();
    else if (fl[i] >= 0) pulse(fl[i], chord);
    let w = u.space ? ms * 0.9 : rand(ms * 0.85, ms * 1.15);
    if (exact && fl[i] >= 0 && fl[i + 1] === fl[i]) w = Math.max(w, GAP() + 12);   // exact：同じ指が続くときは、戻るのを待つ（待たないと、そのぶんの打鍵は抜ける）
    if (/[、,]/.test(d)) w += 190 * k; else if (/[。.]/.test(d)) w += 330 * k; else if (/[！？!?]/.test(d)) w += 280 * k;
    else if (d === '…') w += 170 * k; else if (d === '笑') w += 200 * k; else if (d === '〜') w += 140 * k;
    await beat(S, w);
  }
}
// 来場者の文：その文字を打つ指で、人らしいテンポで打つ（打っているローマ字は赤）。speed が上がるほど速く、止められなくなる。
// 1.0 が、本体の「人らしい打鍵」の速さ。frenzy は、指が戻っていないキーを待たずに飛ばす（画面の文字は速いまま、指は追いつけない）
async function typeMe(S, tg, units, {speed = 1, frenzy = false} = {}) {
  tg.full = units.map(u => u.disp).join('');
  const sp = speed * P.spd * pace(S);
  for (let ui = 0; ui < units.length; ui++) {
    const u = units[ui], nx = units[ui + 1];
    if (!u.keys) {   // 記号・読みのない漢字・空白
      const f = u.fixed ?? u.pseudo ?? -1;
      if (f >= 0) { if (frenzy) strikeFree(f); else await strikeWait(S, f); }
      tg.text += u.disp;
      await wait(S, (u.space ? rand(60, 160) + 60 : rand(45, 90)) / sp);
      continue;
    }
    for (let ki = 0; ki < u.keys.length; ki++) {
      const ch = u.keys[ki], f = fingerOf(ch), last = ki === u.keys.length - 1;
      if (f >= 0) { if (frenzy) strikeFree(f); else await strikeWait(S, f); }
      tg.pend += ch;
      if (last) { tg.text += u.disp; tg.pend = ''; }
      let w = interKey(ch, last ? (nx?.keys?.[0] ?? '') : u.keys[ki + 1], last);
      if (last && /[、,]/.test(u.disp)) w += rand(120, 260);
      if (last && /[。.！？!?]/.test(u.disp)) w += rand(200, 380);
      await wait(S, w / sp);
    }
  }
}
const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
function addAlt(S, said, sent) {   // 言ったこと → 打たれたこと。記録に残す（H の表示が「記録あり」のとき、キーの下に12秒ほど出る）
  S.alts.push({said: oneLine(String(said ?? '').replace(/\n/g, ''), 20) || '（無言）', sent: strip(sent), t: now()});
}

// ---- インストラクター（文字だけの画面） ----
function cliItem(S, who, scale = 1) { const it = {who, scale, text: '', pend: '', full: ''}; S.cli.items.push(it); return it; }
async function say(S, src, {scale = 1, after = 350, ms = 130} = {}) {
  const it = cliItem(S, 'inst', scale);
  await typeInst(S, it, plan(src), {ms});
  await beat(S, after);
  return it;
}
async function sayMe(S, src, {speed = 0.85, frenzy = false, after = 250} = {}) {
  const it = cliItem(S, 'me');
  S.typing = it;
  await typeMe(S, it, plan(src), {speed, frenzy});
  S.typing = null;
  await beat(S, 100);
  await strikeWait(S, 7);   // Enter（右小指）で送る
  await beat(S, after);
  return it;
}
// 来場者の番：両人差し指をトン、トンと打って合図し、返事を聞く（画面には「あなた ›」と点滅する印）
async function ask(S, o = {}) {
  await strikeWait(S, 3); await wait(S, 130); await strikeWait(S, 4); await wait(S, 160);
  S.cli.prompt = true;
  const txt = await hear(S, o);
  S.cli.prompt = false;
  if (!live(S)) throw ABORT;
  return oneLine(txt, 40);
}
// 選択肢：全部のキーが上がる。声（言葉・A〜C・左右）、キー（そのゾーンのどれか）、画面のクリックで選べる。
// 迷っているうちに（patience）、選ばれる。選んだ選択肢は赤になる
async function choose(S, opts, {zones, hint = '', any = false, patience = 9000}) {
  const C = S.choice = {opts, zones, hint, sel: -1, t0: now(), done: false};
  const keyP = new Promise(res => { C.pick = i => { if (C.done) return; C.done = true; res(i); }; });
  listen(0xFF);
  const deadline = now() + patience;
  (async () => {
    while (!C.done && live(S) && deadline - now() > 1500) {
      const txt = await hear(S, {idle: Math.min(4500, deadline - now() - 500), max: Math.min(8000, deadline - now() - 300),
        onText: t => { const i = matchChoice(t, opts); if (i >= 0) C.pick(i); }});
      if (C.done || !live(S)) break;
      const i = matchChoice(txt, opts);
      if (i >= 0) C.pick(i);
      else if (any && txt && now() - C.t0 > 1000) C.pick(ri(opts.length));
    }
  })();
  at(patience, () => C.pick(ri(opts.length)));
  const i = await ok(S, keyP);
  C.sel = i; listen(0);
  S.mic?.end('');
  await beat(S, 600);
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

// ================= 場面 =================
const ZONES3 = [[0, 1, 2], [3, 4], [5, 6, 7]];
const clock = min => `${Math.floor(min / 60) % 24}:${String(Math.floor(min) % 60).padStart(2, '0')}`;
const newLine = () => ({k: 'line', name: '鈴木', msgs: [], input: {text: '', pend: '', full: ''}, n: 0, scroll: 0});
const newSlack = () => ({k: 'slack', msgs: [{who: 'me', text: SLACK_PRE.t, full: SLACK_PRE.t, pend: '', time: SLACK_PRE.time, file: SLACK_PRE.file}],
  input: {text: '', pend: '', full: ''}, typingWho: '', n: 0, scroll: 0});

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
  await wait(S, 600);
}
// 名前：声で聞き、軽量 LLM で名前だけを取り出す → 「〇〇さん、ですね？」→ はい／いいえ。2度ききとれなければ「あなた」
async function stepName(S) {
  await say(S, TX.hello, {scale: 1.3, ms: 170, after: 450});
  mark(S, 'n:hello');
  await say(S, TX.askName, {after: 200});
  mark(S, 'n:askName');
  let name = '';
  for (let k = 0; k < 2 && !name; k++) {
    const heard = await ask(S, {idle: 4500, max: 8000});
    mark(S, 'n:heard');
    let cand = '';
    if (heard) {
      const nameP = llm(S, 'name', {text: heard});   // 打っているあいだに、名前を取り出す
      await sayMe(S, heard.length <= 14 ? heard : (ruleName(heard) ? ruleName(heard) + 'です' : heard.slice(0, 14)), {speed: 0.85});
      const r = await ok(S, nameP);
      cand = r ? oneLine(r.name, 8) : ruleName(heard);
    }
    if (!cand) { if (k === 0) await say(S, TX.again, {after: 300}); continue; }
    mark(S, 'n:named');
    await say(S, TX.confirm(cand), {after: 150});
    mark(S, 'n:confirm');
    const a = await ask(S, {idle: 3200, max: 5000});
    mark(S, 'n:yes');
    const yn = parseYesNo(a);
    if (a) await sayMe(S, yn === 'no' ? 'いいえ' : yn === 'yes' ? 'はい' : oneLine(a, 12), {speed: 0.9});   // 返事も、来場者の指が打つ
    if (yn === 'no') { if (k === 0) await say(S, TX.again, {after: 300}); continue; }
    name = cand;   // 「はい」でも、返事がなくても、この名前で進む
  }
  S.name = name;
  await say(S, name ? TX.nice(name) : TX.noName, {after: 450});
}

// LINE：鈴木との会話
async function lineIn(S, L, src) {
  L.msgs.forEach(m => { if (m.who === 'me') m.read = true; });   // 相手が打ち始めると、こちらの文に「既読」がつく
  const m = {who: 'them', text: '', pend: '', full: '', time: clock(724 + L.n++ / 2)};
  L.msgs.push(m);
  strikeFree(3); at(110, () => strikeFree(4));   // 着信：両人差し指がトン、トン
  await beat(S, 250);
  await typeInst(S, m, plan(src), {ms: 115, exact: false});
  await beat(S, 250);
}
async function lineOut(S, L, src, {speed = 1, frenzy = false} = {}) {
  const f = L.input;
  S.typing = f;
  await typeMe(S, f, plan(src), {speed, frenzy});
  S.typing = null;
  await beat(S, 100);
  await strikeWait(S, 7);   // Enter（右小指）で送る
  L.msgs.push({who: 'me', text: f.full, full: f.full, pend: '', read: false, time: clock(724 + L.n++ / 2)});
  f.text = f.pend = f.full = '';
  await beat(S, 260);
}
async function sceneLine(S) {
  const L = S.line;
  await beat(S, 400);
  for (const [xi, x] of SUZUKI.entries()) {
    mark(S, 'L' + xi);
    if (x.who === '鈴木') { await lineIn(S, L, x.t); continue; }
    if (x.choice) {
      const i = await choose(S, x.choice, {zones: ZONES3, hint: 'あなたの返事を選んでください（声か、キーで）', any: true, patience: 9000});
      mark(S, 'L' + xi + ':picked');
      addAlt(S, x.choice[i].label, x.t);   // どれを選んでも、この文になる
    }
    await lineOut(S, L, x.t, {speed: x.speed, frenzy: !!x.frenzy});
  }
  await beat(S, 800);
}

// Slack：上司の激詰め。文は隣の指もいっしょに打たれる（きつい）
async function slackIn(S, K, src, {quick = false} = {}) {
  K.typingWho = BOSS;   // 「田村さんが入力中…」
  [[3, 4], [2, 5], [1, 6]].forEach((ks, i) => at(i * 130, () => ks.forEach(strikeFree)));   // 着信：内から外へ、強く
  await beat(S, quick ? 350 : 450);
  K.typingWho = '';
  const m = {who: 'boss', text: '', pend: '', full: '', time: clock(1421 + K.n++ / 2)};
  K.msgs.push(m);
  await typeInst(S, m, plan(src), {ms: 100, chord: 1, exact: false});
  await beat(S, 220);
}
async function slackOut(S, K, src, {speed = 1} = {}) {
  const f = K.input;
  S.typing = f;
  await typeMe(S, f, plan(src), {speed});
  S.typing = null;
  await beat(S, 100);
  await strikeWait(S, 7);   // Enter（右小指）で送る
  K.msgs.push({who: 'me', text: f.full, full: f.full, pend: '', time: clock(1421 + K.n++ / 2)});
  f.text = f.pend = f.full = '';
  await beat(S, 260);
}
async function sceneSlack(S) {
  const K = S.slack;
  await beat(S, 450);
  for (let r = 0; r < SLACK_ROUNDS.length; r++) {
    const R = SLACK_ROUNDS[r];
    mark(S, 'S' + r);
    for (const m of R.boss) await slackIn(S, K, m);
    mark(S, 'S' + r + ':boss');
    const i = await choose(S, R.opts, {zones: ZONES3, hint: '返事を選んでください（声か、キーで）', any: true, patience: 9000});
    const t = R.t ?? R.opts[i].t;   // 最後の選択は、どれを選んでも反撃（COUNTER）になる
    addAlt(S, R.opts[i].label, t);
    mark(S, 'S' + r + ':picked');
    await slackOut(S, K, t, {speed: R.speed});
  }
  mark(S, 'S:end');
  for (const m of SLACK_END) await slackIn(S, K, m, {quick: true});
  K.msgs.push({who: 'sys', text: SLACK_SYS, full: SLACK_SYS, pend: ''});
  strike(3); at(120, () => strike(4));
  await beat(S, 1000);
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
  await say(S, TX.afterSlack, {after: 350});
  await say(S, TX.askX, {after: 200});
  mark(S, 'q:askX');
  let heard = await ask(S, {idle: 3800, max: 6500});
  mark(S, 'q:heard');
  let stars = parseStars(heard);
  if (stars == null) {
    const yn = parseYesNo(heard);
    if (heard) await sayMe(S, yn === 'yes' ? 'はい' : yn === 'no' ? 'いいえ' : oneLine(heard, 12), {speed: 0.9});
    await say(S, (yn === 'no' ? TX.pushed : '') + TX.askStars, {after: 200});
    heard = await ask(S, {idle: 4500, max: 7000});
    if (heard) { stars = parseStars(heard); await sayMe(S, oneLine(heard, 12), {speed: 0.9}); }
  } else await sayMe(S, oneLine(heard, 12), {speed: 0.9});
  const guessed = stars == null;
  if (guessed) stars = 5;
  mark(S, 'q:stars');
  const draftP = llm(S, 'review', {stars});   // 話しているあいだに、星に合った下書きをつくる
  if (guessed) await say(S, TX.starsGuess, {after: 250});
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
// X：星に合った下書きが打たれ、右小指の連打で消され、星1の最悪なレビューが超高速で打たれて、投稿される
async function stepX(S, stars, draftP) {
  const X = S.x = {k: 'x', stars, text: '', pend: '', full: '', posted: false, postT: 0};
  await slide(S, X, 1);
  const r = await ok(S, draftP);
  const draft = r && r.text && strip(r.text).length >= 18 ? trimDraft(r.text) : DRAFT[stars];
  mark(S, 'x:slid');
  await beat(S, 450);
  S.typing = X;
  await typeMe(S, X, plan(draft), {speed: 1.1});
  S.typing = null;
  await beat(S, 450);
  mark(S, 'x:draft');
  await mash(S, X);
  mark(S, 'x:mash');
  await beat(S, 300);
  while (X.stars > 1) { X.stars--; await wait(S, 100); }
  await beat(S, 250);
  S.typing = X;
  await typeMe(S, X, plan(WORST), {speed: 12, frenzy: true});   // 爆速：目で追えない
  S.typing = null;
  mark(S, 'x:worst');
  await beat(S, 450);
  strike(7, P.len + 150);   // 投稿（Enter）
  X.posted = true; X.postT = now();
  await beat(S, 3000);
}

// ================= 進行 =================
// 各場面の始まりの目安（ms）。声の返事を待つ時間（ふつうは、名前・はい・選択×4・はい・星で、合わせて17秒ほど）を含めた、ふつうの進み方の値。
// これより6秒以上遅れていたら、打つテンポと間を少し速める（12秒以上なら、もう少し）。返事を待たない最速の通しは、約2分15秒
const DUE = {name: 3500, toLine: 22000, line: 27000, toSlack: 68500, slack: 77500, toX: 121000, x: 137000};
const mark = (S, name) => S.tl.push([name, Math.round(now() - S.t0)]);
function phase(S, p) {
  const el = Math.round(now() - S.t0), late = DUE[p] == null ? 0 : el - DUE[p];
  S.phase = p; S.tl.push([p, el]);
  S.pace = late > 12000 ? 1.3 : late > 6000 ? 1.15 : 1;
}
function restart() { select(EXP.id); }
async function main(S) {
  const from = Math.max(0, START.indexOf(S.o.から));
  S.scr = S.cli;
  if (from === 0) { phase(S, 'flood'); await flood(S); phase(S, 'name'); await stepName(S); }
  else S.name = '田中';
  if (from <= 1) {
    phase(S, 'toLine'); await say(S, TX.toLine, {after: 450});
    S.line = newLine(); await slide(S, S.line, 1);
    phase(S, 'line'); await sceneLine(S);
    await slide(S, S.cli, -1);
  }
  if (from <= 2) {
    phase(S, 'toSlack'); await say(S, TX.afterLine, {after: 350}); await say(S, TX.toSlack, {after: 450});
    S.slack = newSlack(); await slide(S, S.slack, 1);
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
}

// ================= 描画 =================
// インストラクターの画面は、白い紙に黒い文字（強調だけ赤）の、文字だけの画面。アプリの画面（LINE・Slack・X）は、ロゴや本物の文言を使わず、
// 配置と色だけをそれっぽくした画面。キーの台は本体の暗い色のまま
const NOHEAD = '、。，．・！？!?)」』）…ー,.';   // 行頭に置かない字
const BREAK = '、。！？!? 　';                    // この後ろで折り返してよい字
const widths = new Map();
function cw1(ch) {
  const k = g.font + ch;
  let w = widths.get(k);
  if (w == null) { w = g.measureText(ch).width; widths.set(k, w); }
  return w;
}
// 折り返し：幅がいっぱいになったら、行の半ばより後ろにある句読点・空白の後ろで折る（短い行が残らないように）。\n は強制の改行
function wrapLines(str, maxW) {
  const out = []; let cur = [], w = 0, brk = 0;
  const flush = n => { out.push(cur.slice(0, n).map(x => x.ch).join('')); cur = cur.slice(n); w = cur.reduce((a, x) => a + x.c, 0); brk = 0; };
  for (const ch of str) {
    if (ch === '\n') { flush(cur.length); continue; }
    const c = cw1(ch);
    if (cur.length && w + c > maxW && !NOHEAD.includes(ch)) flush(brk > cur.length * 0.45 ? brk : cur.length);
    cur.push({ch, c}); w += c;
    if (BREAK.includes(ch)) brk = cur.length;
  }
  out.push(cur.map(x => x.ch).join(''));
  return out;
}
function lay(it, size, maxW, font = FONT) {   // 折り返しは、全文（it.full）で決める。打つ途中で行がずれない。文や幅が変わったときだけ計算する
  const full = it.full ?? (it.text + it.pend), k = font + size + '|' + maxW + '|' + full;
  if (it._k !== k) {
    g.font = `500 ${size}px ${font}`;
    let acc = 0;
    it._lines = wrapLines(full, maxW).map(s => { const o = {s, start: acc}; acc += s.length; return o; });
    it._k = k;
  }
  return it._lines;
}
function curLine(it, lines) {   // 次に打つ字がある行（それより下の行は、まだ出さない）
  const n = it.text.length, i = lines.findIndex(ln => n >= ln.start && n < ln.start + ln.s.length);
  return i < 0 ? lines.length - 1 : i;
}
function drawBlock(it, x, y, size, lh, lines, caret, font = FONT) {   // 打ち終えた字は黒、打っている途中のローマ字は赤（下線つき）
  g.font = `500 ${size}px ${font}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  const n = it.text.length, ci = curLine(it, lines);
  for (let i = 0; i <= ci; i++) {
    const ln = lines[i], black = ln.s.slice(0, clamp(n - ln.start, 0, ln.s.length)), yy = y + i * lh + lh / 2;
    const wb = black ? g.measureText(black).width : 0;
    g.fillStyle = INK; if (black) g.fillText(black, x, yy);
    if (i !== ci) continue;
    const red = it.pend || '', wr = red ? g.measureText(red).width : 0;
    g.fillStyle = RED; if (red) { g.fillText(red, x + wb, yy); g.fillRect(x + wb, yy + size * 0.62, wr, 2); }
    if (caret) { g.fillStyle = INK; g.fillRect(x + wb + wr + 4, yy - size * 0.55, 2, size * 1.1); }
  }
}
const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const ease3 = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const easeOut = p => 1 - Math.pow(1 - p, 3);
const caretOn = t => Math.floor(t / 450) % 2 === 0;
// 1行の入力欄：入りきらないときは、字を小さくする
function drawField(it, x, y, w, h, size, caret, font = FONT) {
  const full = it.full ?? (it.text + it.pend);
  g.font = `500 ${size}px ${font}`;
  const wf = full ? g.measureText(full).width : 0, k = wf > w ? clamp(w / wf, 0.55, 1) : 1;
  drawBlock(it, x, y + h / 2 - size * k * 0.8, size * k, size * k * 1.6, [{s: full, start: 0}], caret, font);
}

// ---- 選択肢の台：画面の下から、キーの真上にせり上がる（A・B・C がそれぞれのキーの上） ----
function dockLayout(S) {
  const C = S.choice, fs = S.fs;
  const zw = C.zones.map(z => kx(z[z.length - 1]) - kx(z[0]) + STEP * 0.72 - 6);
  const size = clamp(Math.min(fs * 0.72, Math.min(...zw) / 9.2), 12, 40);
  g.font = `500 ${size}px ${FONT}`;
  const lines = C.opts.map((o, i) => wrapLines(o.label, zw[i] - size * 1.2));
  const nl = Math.max(...lines.map(l => l.length)), bh = size * 2.6 + nl * size * 1.35;
  return {size, zw, lines, bh, h: bh + size * 2.9};
}
const dockRise = (S, t, scr) => (S.choice && S.scr === scr && !S.slide && S.dockLay) ? S.dockLay.h * easeOut(clamp((t - S.choice.t0) / 260, 0, 1)) : 0;
function drawDock(S, t, pb) {
  const C = S.choice, d = S.dockLay, h = d.h * easeOut(clamp((t - C.t0) / 260, 0, 1)), y0 = pb - h;
  g.fillStyle = '#ffffff'; g.fillRect(0, y0, W, h);
  g.fillStyle = INK; g.fillRect(0, y0, W, 1);
  g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = `500 ${d.size * 0.8}px ${FONT}`; g.fillStyle = INK;
  g.fillText(C.hint, W / 2, y0 + d.size * 1.0);
  C.opts.forEach((o, i) => {
    const z = C.zones[i], x1 = kx(z[0]) - STEP * 0.36 + 3, x2 = kx(z[z.length - 1]) + STEP * 0.36 - 3, cx = (x1 + x2) / 2, sel = C.sel === i, col = sel ? RED : INK;
    const by = y0 + d.size * 2.0;
    g.lineWidth = sel ? 3 : 1.2; g.strokeStyle = col; rr(x1, by, x2 - x1, d.bh, d.size * 0.5); g.stroke();
    g.fillStyle = col; g.textAlign = 'center';
    g.font = `700 ${d.size * 1.15}px ${FONT}`; g.fillText('ABC'[i], cx, by + d.size * 0.95);
    g.font = `500 ${d.size}px ${FONT}`;
    d.lines[i].forEach((l, j) => g.fillText(l, cx, by + d.size * 2.3 + j * d.size * 1.35));
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

// ---- インストラクター：文字だけの画面（CLI 風）。ホーム。アプリから戻ると、ここに戻る ----
function drawCli(S, C, t, dt, pb) {
  const fs = S.fs, x0 = W * 0.07, top = fs * 2.3, bottom = pb - fs * 0.6;
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = INK;
  g.font = `700 ${fs * 0.5}px ${MONO}`; g.fillText('$ talk 中山', x0, fs * 0.95);
  g.fillRect(x0, fs * 1.5, W - x0 * 2, 1);
  g.font = `700 ${fs * 0.6}px ${MONO}`;
  const lw = Math.max(g.measureText('中山 ›').width, g.measureText('あなた ›').width) + fs * 0.8, tx = x0 + lw, maxW = W - tx - x0 * 0.8;
  let y = 0;
  const rows = C.items.map(it => {
    const size = fs * (it.scale || 1), lh = size * 1.62, lines = lay(it, size, maxW, MONO);
    const row = {it, size, lh, lines, y, h: (curLine(it, lines) + 1) * lh + lh * 0.4};   // 出ている行の分だけ場所をとる
    y += row.h; return row;
  });
  if (C.prompt) { rows.push({prompt: true, size: fs, lh: fs * 1.62, y, h: fs * 1.62}); y += fs * 1.62; }
  const area = bottom - top;
  C.scroll += (Math.max(0, y - area) - C.scroll) * (1 - Math.exp(-dt / 130));
  g.save(); g.beginPath(); g.rect(0, top, W, area); g.clip();
  rows.forEach(r => {
    const y0 = top + r.y - C.scroll;
    if (y0 + r.h < top - 10 || y0 > bottom + 10) return;
    const me = r.prompt || r.it.who === 'me';
    g.font = `700 ${fs * 0.6}px ${MONO}`; g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(me ? 'あなた ›' : '中山 ›', x0, y0 + r.lh / 2);
    if (r.prompt) { if (caretOn(t)) { g.fillRect(tx, y0 + r.lh / 2 - fs * 0.55, fs * 0.5, fs * 1.1); } return; }
    drawBlock(r.it, tx, y0, r.size, r.lh, r.lines, S.typing === r.it && caretOn(t), MONO);
  });
  g.restore();
}

// ---- LINE（風）：鈴木との会話。配置と色だけをそれっぽくした、ロゴのない画面 ----
function lineRows(L, size, lh, maxB) {
  return L.msgs.map(m => {
    const lines = lay(m, size, maxB - size * 1.6);
    const done = m.text.length >= (m.full ?? '').length, ci = done ? lines.length - 1 : curLine(m, lines);
    g.font = `500 ${size}px ${FONT}`;
    let w = 0;
    for (let i = 0; i <= ci; i++) { const ln = lines[i]; w = Math.max(w, g.measureText(i < ci ? ln.s : ln.s.slice(0, clamp(m.text.length - ln.start, 0, ln.s.length))).width); }
    return {m, lines, ci, bw: Math.max(size * 1.7, w + size * 1.6), bh: (ci + 1) * lh + size * 1.0};
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
  rows.forEach(r => {
    const by = top + r.y - L.scroll, me = r.m.who === 'me';
    if (by + r.bh < top - 4 || by > bottom + 4) return;
    const bx = me ? W * 0.95 - r.bw : W * 0.05 + ad + fs * 0.5;
    g.fillStyle = me ? '#8de055' : '#ffffff';
    rr(bx, by, r.bw, r.bh, size * 0.9); g.fill();
    g.beginPath();   // しっぽ
    if (me) { g.moveTo(bx + r.bw - 2, by + size * 0.5); g.lineTo(bx + r.bw + size * 0.55, by + size * 0.35); g.lineTo(bx + r.bw - 2, by + size * 1.5); }
    else { g.moveTo(bx + 2, by + size * 0.5); g.lineTo(bx - size * 0.55, by + size * 0.35); g.lineTo(bx + 2, by + size * 1.5); }
    g.fill();
    if (!me && !(rows[rows.indexOf(r) - 1]?.m.who === 'them')) {   // 相手の最初の吹き出しに、アイコン
      g.fillStyle = '#d5dbe4'; g.beginPath(); g.arc(W * 0.05 + ad / 2, by + ad / 2, ad / 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = INK; g.font = `700 ${fs * 0.7}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('鈴', W * 0.05 + ad / 2, by + ad / 2 + 1);
    }
    drawBlock(r.m, bx + size * 0.8, by + size * 0.5, size, lh, r.lines, S.typing === r.m && caretOn(t));
    g.font = `500 ${size * 0.55}px ${FONT}`; g.fillStyle = INK; g.textBaseline = 'middle';
    if (me) { g.textAlign = 'right'; if (r.m.read) g.fillText('既読', bx - 8, by + r.bh - size * 1.05); g.fillText(r.m.time || '', bx - 8, by + r.bh - size * 0.45); }
    else { g.textAlign = 'left'; g.fillText(r.m.time || '', bx + r.bw + 8, by + r.bh - size * 0.45); }
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
  if (!f.text && !f.pend) { g.globalAlpha = 0.35; g.font = `500 ${size}px ${FONT}`; g.fillText('Aa', fx + fh * 0.5, iy + ib / 2); g.globalAlpha = 1; if (S.typing === f && caretOn(t)) g.fillRect(fx + fh * 0.5, iy + ib / 2 - size * 0.55, 2, size * 1.1); }
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
    if (m.who === 'sys') { rows.push({m, sys: true, y, h: lh * 1.6}); y += lh * 1.6; prev = null; return; }
    const lines = lay(m, size, maxW), n = curLine(m, lines) + 1, head = !prev || prev.who !== m.who;
    const card = m.file ? size * 3.1 : 0, h = (head ? size * 1.5 : 0) + n * lh + card + size * 0.5;
    rows.push({m, lines, head, card, y, h}); y += h; prev = m;
  });
  K.scroll += (Math.max(0, y - (bottom - top - 6)) - K.scroll) * (1 - Math.exp(-dt / 140));
  g.save(); g.beginPath(); g.rect(sw, top, W - sw, bottom - top); g.clip();
  rows.forEach(r => {
    const by = top + r.y - K.scroll;
    if (by + r.h < top - 4 || by > bottom + 4) return;
    g.textBaseline = 'middle';
    if (r.sys) { g.font = `500 ${size * 0.85}px ${FONT}`; g.fillStyle = INK; g.textAlign = 'center'; g.fillText(r.m.text, sw + (W - sw) / 2, by + r.h / 2); return; }
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
    drawBlock(r.m, tx, yy, size, lh, r.lines, S.typing === r.m && caretOn(t));
    if (r.card) {   // 添付ファイル
      const cy = yy + (curLine(r.m, r.lines) + 1) * lh + 4, cwid = Math.min(maxW, size * 15);
      g.strokeStyle = '#c9ced6'; g.lineWidth = 1; rr(tx, cy, cwid, r.card - 8, 8); g.stroke();
      g.fillStyle = INK; g.fillRect(tx + 12, cy + 10, size * 1.4, (r.card - 8) - 20);
      g.font = `700 ${size * 0.8}px ${FONT}`; g.textAlign = 'left'; g.fillText(r.m.file, tx + 12 + size * 1.4 + 12, cy + (r.card - 8) / 2);
    }
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
  if (!f.text && !f.pend) { g.globalAlpha = 0.4; g.fillStyle = INK; g.font = `500 ${size}px ${FONT}`; g.textAlign = 'left'; g.fillText(`# ${CHANNEL} へのメッセージ`, cx + 14, cy + cb * 0.35); g.globalAlpha = 1; if (S.typing === f && caretOn(t)) { g.fillStyle = INK; g.fillRect(cx + 14, cy + cb * 0.35 - size * 0.55, 2, size * 1.1); } }
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

// ---- X（風）：投稿画面。配置と色だけをそれっぽくした、ロゴのない画面 ----
function drawX(S, X, t, dt, pb) {
  const fs = S.fs, cw = clamp(W * 0.66, 440, 860), cx = (W - cw) / 2, cy = pb * 0.06, ch = pb * 0.8, size = fs * 1.0, lh = size * 1.6;
  g.fillStyle = '#ffffff'; rr(cx, cy, cw, ch, 18); g.fill(); g.strokeStyle = '#cfd9de'; g.lineWidth = 1; g.stroke();
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = INK;
  if (!X.posted) { g.font = `500 ${fs * 1.1}px ${FONT}`; g.fillText('×', cx + 22, cy + fs * 1.0); g.font = `700 ${fs * 0.65}px ${FONT}`; g.textAlign = 'right'; g.fillText('下書き', cx + cw - 22, cy + fs * 1.0); g.textAlign = 'left'; }
  const ar = fs * 0.95, ax = cx + 26 + ar, ay = cy + fs * 2.4 + ar, tx = ax + ar + 16, tw = cw - (tx - cx) - 28;
  g.fillStyle = '#cfd9de'; g.beginPath(); g.arc(ax, ay, ar, 0, Math.PI * 2); g.fill();
  g.fillStyle = INK; g.font = `700 ${fs * 0.9}px ${FONT}`; g.textAlign = 'center'; g.fillText('あ', ax, ay + 1);
  g.textAlign = 'left';
  // 1行目：投稿前は返信できる人、投稿後は名前
  if (X.posted) { g.font = `700 ${size * 0.9}px ${FONT}`; g.fillText('あなた', tx, ay - ar * 0.45); const nw = g.measureText('あなた').width; g.font = `500 ${size * 0.75}px ${FONT}`; g.fillText('@you_typed ・ たった今', tx + nw + 10, ay - ar * 0.45); }
  else { g.font = `700 ${size * 0.7}px ${FONT}`; g.fillText('全員が返信できます', tx, ay - ar * 0.45); }
  // 星と本文
  let y = ay + ar * 0.25;
  const ss = size * 1.15;
  g.font = `500 ${ss}px ${FONT}`; g.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) { g.fillStyle = i < X.stars ? RED : INK; g.fillText(i < X.stars ? '★' : '☆', tx + i * ss * 1.12, y + ss * 0.6); }
  y += ss * 1.5;
  const lines = lay(X, size, tw);
  if (!X.text && !X.pend && !X.posted && S.typing !== X) { g.globalAlpha = 0.4; g.fillStyle = INK; g.font = `500 ${size}px ${FONT}`; g.fillText('いまどうしてる？', tx, y + lh / 2); g.globalAlpha = 1; }
  drawBlock(X, tx, y, size, lh, lines, S.typing === X && caretOn(t));
  // 下の行：文字数のリングと「ポストする」。投稿後は、反応の行
  const by = cy + ch - fs * 1.5;
  g.fillStyle = '#cfd9de'; g.fillRect(cx + 20, by - fs * 1.1, cw - 40, 1);
  g.textBaseline = 'middle';
  if (X.posted) {
    g.fillStyle = INK; g.font = `500 ${size * 0.75}px ${FONT}`; g.textAlign = 'left';
    ['返信 0', 'リポスト 0', 'いいね 0'].forEach((s, i) => g.fillText(s, tx + i * size * 5.2, by));
  } else {
    const empty = !X.text && !X.pend, bw = fs * 5.4, bh = fs * 1.55, bx = cx + cw - 24 - bw, ring = cx + cw - 24 - bw - fs * 1.4, rad = fs * 0.5, p = clamp(X.text.length / 140, 0, 1);
    g.lineWidth = 3; g.strokeStyle = '#cfd9de'; g.beginPath(); g.arc(ring, by, rad, 0, Math.PI * 2); g.stroke();
    if (p > 0) { g.strokeStyle = p > 0.9 ? RED : INK; g.beginPath(); g.arc(ring, by, rad, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.stroke(); }
    g.fillStyle = empty ? '#8a9097' : '#0f1419'; rr(bx, by - bh / 2, bw, bh, bh / 2); g.fill();
    g.fillStyle = '#ffffff'; g.font = `700 ${fs * 0.7}px ${FONT}`; g.textAlign = 'center'; g.fillText('ポストする', bx + bw / 2, by + 1);
  }
  if (X.posted) {   // 投稿しました
    const a = easeOut(clamp((t - X.postT) / 300, 0, 1)), msg = 'ポストを投稿しました';
    g.font = `700 ${fs * 0.75}px ${FONT}`; const mw = g.measureText(msg).width + fs * 2, my = pb - fs * 1.1 + (1 - a) * fs;
    g.globalAlpha = a; g.fillStyle = '#0f1419'; rr(W / 2 - mw / 2, my - fs * 0.6, mw, fs * 1.2, fs * 0.6); g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.fillText(msg, W / 2, my + 1); g.globalAlpha = 1;
  }
}

// ---- 待機：ローディング画面のように、落ちた・通った・回った・満ちた場所のキーが打たれる（4つの動きが順に変わる） ----
const newSaver = () => ({k: 'saver', mode: 0, t0: 0, len: 9500, x: 0.5, vx: 1.3, y: 1, vy: 0, wait: 0, sq: 0, after: false, last: -1, p: 0, hold: 0});
function drawSaver(S, V, t, dt, pb) {
  if (!V.t0) V.t0 = t;
  if (t - V.t0 > V.len) { Object.assign(V, {mode: (V.mode + 1) % 4, t0: t, last: -1, p: 0, hold: 0, wait: 0, y: 1, vy: 0, after: false}); }
  const d = dt / 1000 * P.spd, top = H * 0.1, cy = GROUND * 0.5, ph = (t - V.t0) / 1000 * P.spd;
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
    const x = kToX(V.x), y = GROUND - 16 - V.y * (GROUND - 16 - top), q = Math.exp(-(t - V.sq) / 60);
    g.globalAlpha = 0.14; g.fillRect(W * 0.08, GROUND, W * 0.84, 1);
    g.beginPath(); g.ellipse(x, GROUND, 18 * (1 - V.y * 0.5), 4, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
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

function drawScr(S, scr, t, dt, pb) {
  if (!scr) return;
  if (scr.k === 'saver') drawSaver(S, scr, t, dt, pb);
  else if (scr.k === 'flood') drawFlood(S, scr, t, pb);
  else if (scr.k === 'cli') drawCli(S, scr, t, dt, pb);
  else if (scr.k === 'line') drawLine(S, scr, t, dt, pb);
  else if (scr.k === 'slack') drawSlack(S, scr, t, dt, pb);
  else if (scr.k === 'x') drawX(S, scr, t, dt, pb);
}
// 左上（インストラクターの画面では上の中央）：聞いている印（赤）と声の大きさ。聞き取れた途中経過
function drawMic(S, t, pb) {
  const m = S.mic;
  if (!m) { S.lv.length = 0; return; }
  const dock = S.choice && S.dockLay && S.scr !== S.cli ? S.dockLay : null, lv = micLevel(S);
  S.lv.push(lv); if (S.lv.length > 16) S.lv.shift();
  g.textBaseline = 'middle';
  const label = m.host ? '返事を待っています（スタッフ入力）' : '聞いています';
  g.font = `500 13px ${FONT}`;
  const wl = g.measureText(label).width, total = 20 + wl + (m.host ? 0 : 8 + 16 * 4);
  const x = dock ? 14 : W / 2 - total / 2, y = dock ? pb - dock.h * easeOut(clamp((t - S.choice.t0) / 260, 0, 1)) + dock.size * 1.0 : S.fs * 0.95;
  g.textAlign = 'left';
  g.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t / 260)); g.fillStyle = RED; g.beginPath(); g.arc(x + 6, y, 6, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  g.fillStyle = INK; g.fillText(label, x + 20, y);
  if (!m.host) S.lv.forEach((v, i) => { const h = clamp(v * 420, 2, 18); g.fillRect(x + 28 + wl + i * 4, y - h / 2, 2, h); });
  if (m.interim) {
    g.font = `500 ${Math.max(13, S.fs * 0.55)}px ${FONT}`;
    if (dock) { g.textAlign = 'right'; g.fillText(m.interim.slice(-26), W - 14, y); } else { g.textAlign = 'center'; g.fillText(m.interim.slice(-26), W / 2, y + 24); }
  }
}
function drawHud(S, t) {   // 右上：経過時間（目標 2:30）。言ったこと → 打たれたこと は、キーの下に出る
  if (!S.hud) return;   // S.hud: 2 = 時計と記録、1 = 時計だけ、0 = 出さない（H で切り替え）
  const el = S.running ? (t - S.t0) / 1000 : 0, f = v => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
  g.font = `500 12px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const put = (txt, y) => { g.lineWidth = 5; g.strokeStyle = PAPER; g.strokeText(txt, W - 14, y); g.fillStyle = INK; g.fillText(txt, W - 14, y); };   // 文字の下に紙の色の縁をつけ、重なっても読める
  put(`${f(el)} / 2:30　${PH[S.phase] || ''}`, 16);
  const bx = W - 14 - 180;
  g.fillStyle = INK; g.fillRect(bx, 28, 180, 1); g.fillRect(bx, 26, Math.min(180, el / 150 * 180), 5);
  g.fillStyle = RED; g.fillRect(bx + 125 / 150 * 180 - 1, 23, 2, 11);   // 感想の投稿に入る目安（2:05）
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
  id: 'dialogue', group: '本番', name: '声の対話（2分半）',
  note: '文字だけのインストラクターと、LINE・Slack・X の画面を行き来する。来場者の発言は来場者の指が打つ（ときどき別の言葉になる）',
  use: '本番の通し（約2分半）。Enter か「はじめる」で開始／H で時計・記録の表示を切り替え',
  input: true,
  opts: {から: START, 声: ['マイク', '手入力'], LLM: ['あり', 'なし']},
  actions: [{label: s => s.running ? '最初から' : 'はじめる', run: s => { document.activeElement?.blur?.(); if (s.running) restart(); else begin(s); }}],
  init(S) {
    Object.assign(S, {phase: 'saver', running: false, dead: false, tl: [], alts: [], name: '', lv: [], fs: 28,
      cli: {k: 'cli', items: [], scroll: 0, prompt: false}, sv: newSaver(), flood: null, slide: null, line: null, slack: null, x: null, dockLay: null,
      choice: null, mic: null, typing: null, hud: {'0': 0, '1': 1}[lsGet('kc-dlg-hud')] ?? 2});
    S.scr = S.sv;
    S.onKey = e => {
      if (e.target?.tagName === 'INPUT' && e.target.type === 'text') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' && !S.running) { e.preventDefault(); document.activeElement?.blur?.(); begin(S); }
      else if (e.key === 'h' || e.key === 'H') { S.hud = (S.hud + 2) % 3; lsSet('kc-dlg-hud', String(S.hud)); }
    };
    addEventListener('keydown', S.onKey);
    S.onPtr = e => {   // 画面のクリック・タップでも選べる（確認用）。一瞬のタップも取りこぼさないよう、イベントで受ける
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
  stop(S) { quit(S); listen(0); },
  press(S, k) {
    const C = S.choice;
    if (!C || C.done) return;
    const i = C.zones.findIndex(z => z.includes(k));
    if (i >= 0) C.pick(i);
  },
  draw(S, t, dt) {
    if (S.dead) return;
    const pb = KY - STEP * 0.62;
    S.fs = clamp(STEP * 0.30, 17, 46);
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
    drawMic(S, t, pb);
    drawHud(S, t);
  },
};
window.KC_DIALOGUE = EXP;
})();
