// 声の対話（2分）— keycap_lab の体験 "dialogue"
// 2026/10/21 の体験再編メモの設計：
//   インストラクター（中山）と会話 1分20秒：導入 → 名前 → 出身 → 同伴 → 展示を知った場所（A〜D）→ 鈴木との会話
//   → X への感想投稿 40秒：星を言う → 下書き → deleteキー（右小指）の連打 → 星1の最悪なレビュー
// 来場者は話すだけ（声）。画面の来場者の発言は、来場者の指が打つ。ただし、ときどき別の言葉になる。
// 読み込み：index.html の本体スクリプトより前に <script src="dialogue.js"></script>。
//   本体の道具（hit・at・listen・toMora・fingerOf・interKey…）は、体験が動くときに参照する。
// 文言・順番・触覚の割り当ては、このファイルの上のほう（台本）にまとめた。
(() => {
'use strict';

// ================= 台本 =================
// 漢字{よみ} と書いた所は、画面には漢字だけを出し、打つキーは「よみ」の分だけ使う（来場者の指が打つ文に付ける）
const START = ['最初から', '出身から', 'A〜Dから', '鈴木から', '星から'];
const PH = {saver: '待機', flood: '導入', name: '名前', from: '出身', with: '同伴', hear: '展示を知った場所', suzuki: '鈴木との会話', finale: '感想の投稿', end: 'おわり'};
const INK = '#111111', RED = '#b3261e', PAPER = '#fcfcfa';   // 文字は黒、強調は赤だけ
const FONT = '"Hiragino Sans","Noto Sans JP",sans-serif';

const TX = {
  hello: 'はじめまして、私の名前は中山です。',
  askName: 'まずはあなたの名前を教えてください。',
  nice: n => `${n}さん、よろしくお願いします。`,
  noName: 'うまく聞き取れませんでした……。あなた、とお呼びしますね。よろしくお願いします。',
  askFrom: '今日はどちらからいらっしゃいましたか？',
  silence: '聞こえていますか？……大丈夫です、続けましょう。',
  askWith: '今日は、どなたと来られましたか？',
  askHear: 'どこでこの展示を知りましたか？',
  bridge: 'では、ちょっとした会話を体験してみましょう。相手は、同僚の鈴木さんです。',
  askStars: '最後に、この体験の感想をXに投稿しましょう。星はいくつですか？',
  stars: n => `星${n}つですね！ありがとうございます。感想を書いておきますね。`,
  starsGuess: 'うまく聞き取れなかったので……星5つにしておきますね。感想を書いておきますね。',
};
// 来場者の返事への、中山の反応（LLM が使えないとき・遅いときの文言）
const REPLY = {
  fromNear: '来ていただきありがとうございます！とても近くからいらしたんですね！',
  fromFar: p => `${p}から！？遠いところ、本当にありがとうございます！`,
  fromPlace: p => `${p}からですか！来ていただけて、うれしいです！`,
  fromNone: 'そうなんですね！来ていただけて、うれしいです！',
  withAlone: 'ひとりぼっち……なんですね。でも、来てくださってうれしいです。',
  withFriend: '付き合わされて、なんですね笑 でも、来てくれてよかったです！',
  withFamily: '連れられて、なんですね笑 来てくださってありがとうございます！',
  withPartner: '引っ張られて……笑 仲がいいんですね！',
  withOther: 'お付き合いで……笑 でも、来てくれてうれしいです！',
};
const NEAR = /本郷|東大|東京大学|文京|駒込|根津|千駄木|湯島|御茶ノ水|お茶の水|春日|後楽園|水道橋|白山|上野|秋葉原|ここ|近所|近く/;
const FAR = /北海道|青森|秋田|岩手|宮城|仙台|山形|福島|新潟|石川|金沢|富山|福井|長野|静岡|愛知|名古屋|三重|滋賀|京都|大阪|兵庫|神戸|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄|海外|アメリカ|中国|韓国|台湾|オーストラリア|イギリス|フランス|ドイツ|インド/;

// 質問「どこでこの展示を知りましたか？」の4択。選んだ文とは少し違う文が、来場者の指で打たれる（A・B・C・D の順）
const HEAR = [
  {label: '知人の紹介', sent: '知人{ちじん}に言{い}われて、仕方{しかた}なく', reply: '仕方なく、なんですね笑 でも、来てくれてうれしいです！', say: /知人|知り合い|紹介|人づて|口コミ|誘/},
  {label: 'twitter', sent: 'twitter(現{げん}X)です', reply: 'あ、Xですね！見つけてくださって、ありがとうございます！', say: /twitter|ツイッター|ついった|エックス|sns|ツイート|(?:^|[^a-z])x(?:$|[^a-z])/},
  {label: 'ポスター', sent: 'ポスターを、なんとなく', reply: 'なんとなく、ですか笑 そういう出会いも、好きです！', say: /ポスター|張り紙|貼り紙|チラシ|フライヤー|掲示/},
  {label: '通りがかり', sent: 'たまたま通{とお}りかかっただけです', reply: 'たまたま、ですか！立ち寄ってくれて、うれしいです！', say: /通りがかり|通りすがり|たまたま|ふらっと|偶然|通った/},
];

// 鈴木との会話（「あなた」の行は来場者の指が打つ。速さは行ごとに上がり、だんだん止められなくなる）
const SUZUKI_OPTS = [   // label の \n は画面での改行（記録には出ない）
  {label: 'ごめん、\n言い方がきつかった', say: /ごめん|言い方|きつかった/},
  {label: 'ううん、\n私のほうこそごめん', say: /私のほう|ううん|こそ/},
  {label: 'ありがとう、\nちゃんと話そう', say: /ありがとう|ちゃんと|話そう/},
];
const SUZUKI = [
  {who: '鈴木', t: '明日の資料、最後のまとめお願いしてもいい？'},
  {who: 'あなた', t: 'うん、今{いま}から見{み}ておく', speed: 1.1},
  {who: '鈴木', t: '助かる！今日ちょっと手が回らなくて'},
  {who: 'あなた', t: 'まあ、結局{けっきょく}いつもこっちでやってるしね', speed: 1.5},
  {who: '鈴木', t: 'え、ごめん。そんなつもりじゃなかった'},
  {who: 'あなた', t: '頼{たの}めばやってくれるって思{おも}ってるんだろうな、とは思{おも}ってた', speed: 2},
  {who: '鈴木', t: 'そんなふうに思われてるとは思わなかった。負担になってたなら、その時言ってほしかった'},
  {who: 'あなた', choice: SUZUKI_OPTS, t: '言{い}わないと気{き}づかないんだね', speed: 3, frenzy: true},   // どれを選んでも、この文になる
  {who: '鈴木', t: '……ごめん'},
  {who: 'あなた', t: 'こうなるから今{いま}まで言{い}わなかったんだけどね', speed: 3.8, frenzy: true},
  {who: '鈴木', t: 'もういい。自分でやるよ'},
  {who: 'あなた', t: '最初{さいしょ}からそうしてくれればよかった', speed: 5, frenzy: true},
  {who: '鈴木', t: '……わかった'},
];

// 感想の下書き（星の数に合わせた50字ほど。LLM が使えないとき）と、その後に打たれる星1の最悪なレビュー
const DRAFT = {
  5: '想像{そうぞう}以上{いじょう}に楽{たの}しかったです！指先{ゆびさき}に伝{つた}わる感覚{かんかく}が新鮮{しんせん}で、思{おも}わず夢中{むちゅう}になりました。友達{ともだち}にもすすめたいです。',
  4: 'とても面白{おもしろ}い体験{たいけん}でした。キーボードが勝手{かって}に動{うご}く不思議{ふしぎ}な感覚{かんかく}が、強{つよ}く印象{いんしょう}に残{のこ}っています。また来{き}たいです。',
  3: 'ふつうに楽{たの}しめました。ちょっと不思議{ふしぎ}な体験{たいけん}で、いろいろ考{かんが}えさせられる部分{ぶぶん}もありました。一度{いちど}は体験{たいけん}してみてほしいです。',
  2: '思{おも}っていたより、少{すこ}しわかりにくかったです。期待{きたい}していた分{ぶん}、残念{ざんねん}でした。もう少{すこ}し説明{せつめい}があると嬉{うれ}しいです。',
  1: '正直{しょうじき}、よく分{わ}かりませんでした。説明{せつめい}も少{すく}なく、何{なに}を体験{たいけん}したのか分{わ}からないまま終{お}わってしまいました。',
};
const WORST = '最悪{さいあく}。自分{じぶん}の指{ゆび}なのに勝手{かって}に動{うご}いて気持{きも}ち悪{わる}い。何{なに}も選{えら}べない。時間{じかん}の無駄{むだ}。二度{にど}と来{き}ません。星{ほし}1でも高{たか}いくらい。';

// 導入で画面いっぱいに流れる文章
const FLOOD = ['はじめまして、私の名前は中山です。', 'はじめまして、私の名前は中山です。', 'はじめまして、私の名前は中山です。',
  'キーボードに、指をのせてください。', 'このキーボードは、あなたの指に触れます。', '文字が、指に届きます。', 'あなたの指が、動きます。', 'ようこそ。'];

// ================= 文を「打つキー」に分ける =================
const KANJI = /[㐀-鿿豈-﫿々〆]/;
const RUBY = /([㐀-鿿豈-﫿々〆]+)\{([^}]*)\}/g;
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
// 出身：「本郷から来ました」→ 本郷
function rulePlace(raw) {
  let t = nk(raw).replace(/[、。，．,.!！?？]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2; i++) t = t.replace(/^(?:えっと|えーっと|えーと|ええと|あのー|あの|うーん|そうですね)\s*/, '').replace(/^(?:あ|あー|あっ|えー|ええ|えっ|はい|うん)\s+/, '');
  const m = t.match(/(?:^|\s)([^\s]{1,10}?)(?:から|より|在住|に住んで|出身|です$|だよ$|っす$)/);
  return m ? m[1].replace(/^(?:私は|僕は|わたしは)/, '') : '';
}
function ruleFrom(place) {
  if (!place) return REPLY.fromNone;
  if (NEAR.test(place)) return REPLY.fromNear;
  return FAR.test(place) ? REPLY.fromFar(place) : REPLY.fromPlace(place);
}
// 同伴：言った内容とは少し違う文が、来場者の指で打たれる（言わなかったときは「ひとりぼっち」にされる）
function alterWith(raw) {
  const t = nk(raw);
  if (!t || /一人|ひとり|1人|独り|ソロ|ぼっち|自分だけ|誰とも|だれとも/.test(t)) return {kind: 'withAlone', sent: 'ひとりぼっちで来{き}ました'};
  if (/友達|友人|友だち|ともだち|仲間/.test(t)) return {kind: 'withFriend', sent: '友達{ともだち}に付{つ}き合{あ}わされて来{き}ました'};
  if (/家族|親|母|父|兄|姉|弟|妹|子供|子ども|娘|息子|祖父|祖母/.test(t)) return {kind: 'withFamily', sent: '家族{かぞく}に連{つ}れられて来{き}ました'};
  if (/彼氏|彼女|恋人|パートナー|夫|妻|旦那|嫁|奥さん/.test(t)) return {kind: 'withPartner', sent: '恋人{こいびと}に引{ひ}っ張{ぱ}られて来{き}ました'};
  return {kind: 'withOther', sent: '付{つ}き合{あ}いで来{き}ました'};
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


// ================= 画面に出す文を打つ =================
const addItem = (S, who, label, scale = 1) => { const it = {who, label, scale, text: '', pend: ''}; S.log.push(it); return it; };
const cleanReply = v => oneLine(v, 60).replace(/\{[^}]*\}/g, '');

// インストラクターの文：1文字ずつ現れ、1文字につき1回、その文字の指がそっと打たれる。
// 句読点は無音（息継ぎ）。「！」は両人差し指がいっしょに、「笑」はふるえ
async function typeInst(S, it, units) {
  it.full = units.map(u => u.disp).join('');   // 全文を先に知っておく（折り返しの位置が、打つ途中でずれないように）
  for (const u of units) {
    const d = u.disp;
    it.text += d;
    if (d === '！' || d === '!') { strikeFree(3); strikeFree(4); }
    else if (d === '笑') flutter();
    else if (!u.space && !/[、。，．,.…？?]/.test(d)) {
      const f = u.fixed ?? (u.keys ? fingerOf(u.keys[0]) : (u.pseudo ?? -1));
      if (f >= 0) strikeFree(f);
    }
    let w = u.space ? 130 : rand(52, 78);
    if (/[、,]/.test(d)) w += 170; else if (/[。.]/.test(d)) w += 320; else if (/[！？!?]/.test(d)) w += 260; else if (d === '…') w += 240; else if (d === '笑') w += 200;
    await beat(S, w);
  }
}
// 来場者の文：その文字を打つ指で、人らしいテンポで打つ（打っているローマ字は赤）。speed が上がるほど速く、止められなくなる。
// frenzy は、指が戻っていないキーを待たずに飛ばす（画面の文字は速いまま、指は追いつけない）
async function typeMe(S, it, units, {speed = 1, frenzy = false} = {}) {
  it.full = units.map(u => u.disp).join('');
  const sp = speed * P.spd * pace(S);
  for (let ui = 0; ui < units.length; ui++) {
    const u = units[ui], nx = units[ui + 1];
    if (!u.keys) {   // 記号・読みのない漢字・空白
      const f = u.fixed ?? u.pseudo ?? -1;
      if (f >= 0) { if (frenzy) strikeFree(f); else await strikeWait(S, f); }
      it.text += u.disp;
      await wait(S, (u.space ? rand(60, 160) + 60 : rand(45, 90)) / sp);
      continue;
    }
    for (let ki = 0; ki < u.keys.length; ki++) {
      const ch = u.keys[ki], f = fingerOf(ch), last = ki === u.keys.length - 1;
      if (f >= 0) { if (frenzy) strikeFree(f); else await strikeWait(S, f); }
      it.pend += ch;
      if (last) { it.text += u.disp; it.pend = ''; }
      let w = interKey(ch, last ? (nx?.keys?.[0] ?? '') : u.keys[ki + 1], last);
      if (last && /[、,]/.test(u.disp)) w += rand(120, 260);
      if (last && /[。.！？!?]/.test(u.disp)) w += rand(200, 380);
      await wait(S, w / sp);
    }
  }
}
async function say(S, src, {label = '', after = 450, scale = 1} = {}) {
  const it = addItem(S, 'inst', label, scale);
  await typeInst(S, it, plan(src));
  await beat(S, after);
  return it;
}
async function sayMe(S, src, {label = '', speed = 1.2, frenzy = false, after = 400} = {}) {
  const it = addItem(S, 'me', label);
  S.typing = it;
  await typeMe(S, it, plan(src), {speed, frenzy});
  S.typing = null;
  await beat(S, 150);
  await strikeWait(S, 7);   // Enter（右小指）で送る
  await beat(S, after);
  return it;
}
const addAlt = (S, said, sent) => S.alts.push({said: oneLine(String(said ?? '').replace(/\n/g, ''), 20) || '（無言）', sent: strip(sent)});

// 来場者の番：両人差し指をトン、トンと打って合図し、返事を聞く
async function ask(S, o) {
  await strikeWait(S, 3); await wait(S, 130); await strikeWait(S, 4); await wait(S, 160);
  const txt = await hear(S, o);
  if (!live(S)) throw ABORT;
  return oneLine(txt, 40);
}
// 選択肢：全部のキーが上がる。声（言葉・A〜D・左右）、キー（そのゾーンのどれか）、画面のクリックで選べる。
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
  await beat(S, 800);
  S.choice = null;
  return i;
}

// ================= 場面 =================
const ZONES4 = [[0, 1], [2, 3], [4, 5], [6, 7]], ZONES3 = [[0, 1, 2], [3, 4], [5, 6, 7]];

// 導入：突然、画面いっぱいに文章が流れ、全部の指が打たれる。ぷつりと止まり、最初の1行
async function flood(S) {
  const F = S.flood = {t0: now(), dur: 2500 / P.spd, text: ''};
  for (let k = 0; k < 8; k++) strike(k, P.len + 80);
  await wait(S, 330);
  while (now() - F.t0 < F.dur) {
    const free = [0, 1, 2, 3, 4, 5, 6, 7].filter(k => ready(k)).sort(() => Math.random() - 0.5);
    free.slice(0, Math.random() < 0.55 ? 2 : 1).forEach(k => strike(k));
    await wait(S, 40);
  }
  S.flood = null;
  stopAll();
  await wait(S, 560);
}
async function stepName(S) {
  await say(S, TX.hello, {scale: 1.3, after: 800});
  await say(S, TX.askName);
  const heard = await ask(S);
  const nameP = heard ? llm(S, 'name', {text: heard}) : null;   // 軽量モデルで、名前だけを取り出す
  if (heard) await sayMe(S, oneLine(heard, 24), {speed: 1.1});
  const r = nameP ? await ok(S, nameP) : null;
  S.name = r ? oneLine(r.name, 8) : ruleName(heard);
  await say(S, S.name ? TX.nice(S.name) : TX.noName, {after: 700});
}
async function stepFrom(S) {
  await say(S, TX.askFrom);
  const heard = await ask(S);
  if (!heard) { await say(S, TX.silence, {after: 600}); return; }
  const replyP = llm(S, 'react', {step: 'from', name: S.name, said: heard, sent: heard});
  await sayMe(S, oneLine(heard, 28));
  const r = await ok(S, replyP);
  await say(S, cleanReply(r?.reply) || ruleFrom(rulePlace(heard)), {after: 600});
}
async function stepWith(S) {
  await say(S, TX.askWith);
  const heard = await ask(S);
  const alt = alterWith(heard);   // 言ったことと、少し違う文が打たれる
  addAlt(S, heard, alt.sent);
  const replyP = llm(S, 'react', {step: 'with', name: S.name, said: heard, sent: strip(alt.sent)});
  await sayMe(S, alt.sent, {speed: 1.1});
  const r = await ok(S, replyP);
  await say(S, cleanReply(r?.reply) || REPLY[alt.kind], {after: 600});
}
async function stepHear(S) {
  await say(S, TX.askHear, {after: 200});
  const i = await choose(S, HEAR, {zones: ZONES4, hint: 'お答えください（声か、キーで）', patience: 8500});
  addAlt(S, HEAR[i].label, HEAR[i].sent);
  await sayMe(S, HEAR[i].sent, {speed: 1.1});
  await say(S, HEAR[i].reply, {after: 600});
}
async function stepSuzuki(S) {
  await say(S, TX.bridge, {after: 1000});
  S.log.length = 0; S.scroll = 0; S.scene = true;
  await beat(S, 500);
  for (const L of SUZUKI) {
    if (L.who === '鈴木') { await say(S, L.t, {label: '鈴木', after: 480}); continue; }
    if (L.choice) {
      const i = await choose(S, L.choice, {zones: ZONES3, hint: 'あなたの返事を選んでください（声か、キーで）', any: true, patience: 9000});
      addAlt(S, L.choice[i].label, L.t);   // どれを選んでも、この文になる
    }
    await sayMe(S, L.t, {label: 'あなた', speed: L.speed, frenzy: !!L.frenzy, after: 380});
  }
  await beat(S, 1600);
  S.scene = false;
}
// 下書きが、deleteキー（右小指）の連打で消される。1打ごとに消える量が増える
async function mash(S, C) {
  const total = C.text.length, gap = Math.max(GAP() + 5, 150) / Math.min(1, P.spd);   // 右小指の限界の速さで連打
  const N = clamp(Math.round(3000 / gap), 8, 16);
  const wt = Array.from({length: N}, (_, i) => Math.pow(i + 1, 1.5)), sum = wt.reduce((a, b) => a + b, 0);
  let left = total;
  for (let i = 0; i < N; i++) {
    strike(7);
    const n = i === N - 1 ? left : Math.min(left, Math.max(1, Math.round(total * wt[i] / sum)));
    left -= n;
    C.text = C.text.slice(0, C.text.length - n);
    await wait(S, gap);
  }
  C.text = '';
}
async function stepFinale(S) {
  S.log.length = 0; S.scroll = 0;
  await beat(S, 900);
  await say(S, TX.askStars);
  const heard = await ask(S, {idle: 4500, max: 7000});
  let stars = parseStars(heard);
  const guessed = stars == null;
  if (guessed) stars = 5;
  const draftP = llm(S, 'review', {stars});
  await say(S, guessed ? TX.starsGuess : TX.stars(stars), {after: 300});
  const r = await ok(S, draftP);
  const draft = r && r.text && strip(r.text).length >= 30 ? r.text : DRAFT[stars];
  S.log.length = 0;
  const C = S.composer = {stars, text: '', pend: '', posted: false};
  await beat(S, 450);
  S.typing = C;
  await typeMe(S, C, plan(draft), {speed: 1.35});
  S.typing = null;
  await beat(S, 800);
  await mash(S, C);
  await beat(S, 450);
  while (C.stars > 1) { C.stars--; await wait(S, 110); }
  await beat(S, 350);
  S.typing = C;
  await typeMe(S, C, plan(WORST), {speed: 7, frenzy: true});   // 超高速
  S.typing = null;
  await beat(S, 700);
  strike(7, P.len + 150);   // 投稿（Enter）
  C.posted = true;
  await beat(S, 5200);
}

// ================= 進行 =================
// 各場面の始まりの目安（実測。ms）。これより6秒以上遅れていたら、打つテンポと間を少し速める（声の返事を待つぶんが積み重なるため）
const DUE = {name: 3000, from: 12000, with: 20000, hear: 30000, suzuki: 38500, finale: 75500};
function phase(S, p) {
  const el = Math.round(now() - S.t0), late = DUE[p] == null ? 0 : el - DUE[p];
  S.phase = p; S.tl.push([p, el]);
  S.pace = late > 12000 ? 1.3 : late > 6000 ? 1.15 : 1;
}
function restart() { select(EXP.id); }
async function main(S) {
  const from = Math.max(0, START.indexOf(S.o.から));
  if (from === 0) { phase(S, 'flood'); await flood(S); phase(S, 'name'); await stepName(S); }
  else S.name = '田中';
  if (from <= 1) { phase(S, 'from'); await stepFrom(S); phase(S, 'with'); await stepWith(S); }
  if (from <= 2) { phase(S, 'hear'); await stepHear(S); }
  if (from <= 3) { phase(S, 'suzuki'); await stepSuzuki(S); }
  phase(S, 'finale'); await stepFinale(S);
  phase(S, 'end'); await wait(S, 7000);
  restart();
}
function begin(S) {
  if (S.running || S.dead) return;
  audio();
  Object.assign(S, {running: true, t0: now(), tl: [], log: [], scroll: 0, alts: [], pace: 1});
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

// ================= 描画（白い画面に黒い文字。強調だけ赤。キーの台は本体の暗い色のまま） =================
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
function lay(it, size, maxW) {   // 折り返しは、全文（it.full）で決める。打つ途中で行がずれない。文や幅が変わったときだけ計算する
  const full = it.full ?? (it.text + it.pend), k = size + '|' + maxW + '|' + full;
  if (it._k !== k) {
    g.font = `500 ${size}px ${FONT}`;
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
function drawBlock(it, x, y, size, lh, lines, caret) {   // 打ち終えた字は黒、打っている途中のローマ字は赤（下線つき）
  g.font = `500 ${size}px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left';
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
function drawLog(S, t, dt, top, bottom) {
  const fs = S.fs * (S.scene ? 0.92 : 1);
  let y = 0;
  const rows = S.log.map(it => {
    const size = fs * (it.scale || 1), lh = size * 1.62, lab = it.label ? fs * 0.9 : 0, lines = lay(it, size, W * (it.scale > 1 ? 0.84 : 0.62));
    const row = {it, size, lh, lab, lines, y, h: lab + (curLine(it, lines) + 1) * lh + lh * 0.55};   // 出ている行の分だけ場所をとる
    y += row.h; return row;
  });
  const area = bottom - top;
  S.scroll += (Math.max(0, y - area) - S.scroll) * (1 - Math.exp(-dt / 130));
  g.save(); g.beginPath(); g.rect(0, top, W, area); g.clip();
  rows.forEach(r => {
    const y0 = top + r.y - S.scroll, x = r.it.who === 'me' ? W * 0.26 : W * 0.08;
    if (y0 + r.h < top - 10 || y0 > bottom + 10) return;
    if (r.it.label) { g.font = `700 ${fs * 0.5}px ${FONT}`; g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(r.it.label, x, y0 + r.lab * 0.4); }
    drawBlock(r.it, x, y0 + r.lab, r.size, r.lh, r.lines, S.typing === r.it && Math.floor(t / 450) % 2 === 0);
  });
  g.restore();
}
function drawFlood(S, t, pb) {
  const F = S.flood, fw = clamp(W / 34, 16, 40), cols = Math.max(8, Math.floor(W * 0.94 / fw)), lh = fw * 1.38, rows = Math.max(3, Math.floor((pb - 14) / lh));
  if (!F.text) { let str = ''; while (str.length < cols * rows * 1.7) str += pick(FLOOD); F.text = str; }
  const p = clamp((t - F.t0) / F.dur, 0, 1), n = Math.floor(F.text.length * clamp(Math.pow(p, 1.4) * 1.15, 0, 1)), lines = [];
  for (let i = 0; i < n; i += cols) lines.push(F.text.slice(i, Math.min(n, i + cols)));
  g.font = `700 ${fw}px ${FONT}`; g.textBaseline = 'top'; g.textAlign = 'left'; g.fillStyle = INK;
  lines.slice(-rows).forEach((l, j) => g.fillText(l, W * 0.03, 10 + j * lh));
}
function drawChoice(S, t, pb) {
  const C = S.choice, n = C.opts.length, fs = S.fs, top = pb * 0.52, span = (n === 4 ? 1.85 : 2.6) * STEP;
  g.textBaseline = 'middle'; g.textAlign = 'center';
  if (C.hint) { g.font = `500 ${fs * 0.5}px ${FONT}`; g.fillStyle = INK; g.fillText(C.hint, W / 2, top - fs * 0.9); }
  C.opts.forEach((o, i) => {
    const z = C.zones[i], cx = z.reduce((a, k) => a + kx(k), 0) / z.length, sel = C.sel === i, col = sel ? RED : INK;
    g.fillStyle = col; g.strokeStyle = col; g.textAlign = 'center';
    g.font = `700 ${fs * 1.3}px ${FONT}`; g.fillText('ABCD'[i], cx, top + fs * 0.6);
    g.font = `500 ${fs * 0.78}px ${FONT}`;
    const ls = wrapLines(o.label, span);
    ls.forEach((l, j) => g.fillText(l, cx, top + fs * 1.9 + j * fs * 1.15));
    const yEnd = top + fs * 1.9 + ls.length * fs * 1.15 - fs * 0.4;
    g.lineWidth = sel ? 3 : 1;
    g.beginPath(); g.moveTo(cx, yEnd); g.lineTo(cx, pb - 6); g.stroke();   // 選択肢 → キー
    const x1 = kx(z[0]) - STEP * 0.36, x2 = kx(z[z.length - 1]) + STEP * 0.36;
    g.beginPath(); g.moveTo(x1, pb - 13); g.lineTo(x1, pb - 5); g.lineTo(x2, pb - 5); g.lineTo(x2, pb - 13); g.stroke();   // このキーのどれかを押す
  });
}
function drawComposer(S, t, pb) {
  const C = S.composer, fs = S.fs, x0 = W * 0.1;
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = INK;
  g.font = `700 ${fs * 0.55}px ${FONT}`; g.fillText('X に投稿', x0, pb * 0.1);
  const ss = fs * 1.9;
  g.font = `500 ${ss}px ${FONT}`;
  for (let i = 0; i < 5; i++) { g.fillStyle = i < C.stars ? RED : INK; g.fillText(i < C.stars ? '★' : '☆', x0 + i * ss * 1.12, pb * 0.25); }
  const size = fs * 1.05, lh = size * 1.62;
  drawBlock(C, x0, pb * 0.36, size, lh, lay(C, size, W * 0.8), S.typing === C && Math.floor(t / 450) % 2 === 0);
  g.font = `700 ${fs * 0.7}px ${FONT}`; g.textAlign = 'right'; g.fillStyle = C.posted ? RED : INK;
  const label = C.posted ? '投稿しました' : '投稿', w = g.measureText(label).width;
  g.fillText(label, W * 0.9, pb - fs * 1.2);
  g.fillRect(W * 0.9 - w, pb - fs * 1.2 + fs * 0.5, w, 2);
}
function drawSaver(S, t, dt) {   // 待機：跳ねるボール。落ちた場所のキーが打たれる
  const d = dt / 1000 * P.spd;
  if (S.wait > 0) S.wait -= dt;
  else {
    S.vy -= 4 * d; S.y += S.vy * d; S.x += S.vx * d;
    if (S.x > 7) { S.x = 7; S.vx *= -1; } if (S.x < 0) { S.x = 0; S.vx *= -1; }
    if (S.y <= 0) {
      const v = -S.vy; S.y = 0; S.vy = v * 0.78; S.sq = t;
      hit(Math.round(S.x), P.len, P.str * clamp(v / 2.8, 0.3, 1));
      if (S.vy < 0.55) { S.vy = 0; S.wait = 700; S.after = true; }
    }
  }
  if (S.wait <= 0 && S.after) { S.after = false; S.y = 1; S.vy = 0; S.x = rand(0.5, 6.5); S.vx = (Math.random() < 0.5 ? -1 : 1) * rand(0.8, 1.8); }
  const top = H * 0.1, x = kToX(S.x), y = GROUND - 16 - S.y * (GROUND - 16 - top), q = Math.exp(-(t - S.sq) / 60);
  g.fillStyle = 'rgba(17,17,17,0.14)'; g.fillRect(W * 0.08, GROUND, W * 0.84, 1);
  g.beginPath(); g.ellipse(x, GROUND, 18 * (1 - S.y * 0.5), 4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = INK; g.beginPath(); g.ellipse(x, y + q * 5, 16 * (1 + q * 0.35), 16 * (1 - q * 0.3), 0, 0, Math.PI * 2); g.fill();
}
function drawMic(S, t) {   // 左上：聞いている印（赤）と声の大きさ。聞き取れた途中経過
  const m = S.mic;
  if (!m) { S.lv.length = 0; return; }
  const x = 14, y = 16, lv = micLevel(S);
  S.lv.push(lv); if (S.lv.length > 16) S.lv.shift();
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t / 260)); g.fillStyle = RED; g.beginPath(); g.arc(x + 6, y, 6, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  g.fillStyle = INK; g.font = `500 13px ${FONT}`;
  const label = m.host ? '返事を待っています（スタッフ入力）' : '聞いています', wl = g.measureText(label).width;
  g.fillText(label, x + 20, y);
  if (!m.host) S.lv.forEach((v, i) => { const h = clamp(v * 420, 2, 18); g.fillRect(x + 28 + wl + i * 4, y - h / 2, 2, h); });
  if (m.interim) { g.font = `500 ${Math.max(13, S.fs * 0.55)}px ${FONT}`; g.fillText(m.interim.slice(-26), x, y + 24); }
}
function drawHud(S, t) {   // 右上：経過時間（目標 2:00。会話は 1:20 まで）と、言ったこと → 打たれたこと
  if (!S.hud) return;   // S.hud: 2 = 時計と記録、1 = 時計だけ、0 = 出さない（H で切り替え）
  const el = S.running ? (t - S.t0) / 1000 : 0, f = v => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
  g.font = `500 12px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const put = (txt, y) => { g.lineWidth = 5; g.strokeStyle = PAPER; g.strokeText(txt, W - 14, y); g.fillStyle = INK; g.fillText(txt, W - 14, y); };   // 文字の下に紙の色の縁をつけ、重なっても読める
  put(`${f(el)} / 2:00　${PH[S.phase] || ''}`, 16);
  const bx = W - 14 - 180;
  g.fillStyle = INK; g.fillRect(bx, 28, 180, 1); g.fillRect(bx, 26, Math.min(180, el / 120 * 180), 5);
  g.fillStyle = RED; g.fillRect(bx + 80 / 120 * 180 - 1, 23, 2, 11);
  if (S.phase === 'saver') put('Enter か「はじめる」で開始　H で表示を切り替え', 44);
  if (S.hud >= 2) S.alts.slice(-3).forEach((a, i) => put(`言った「${a.said}」→ 打たれた「${a.sent}」`, 44 + i * 16));
}

// ================= 体験の登録 =================
const EXP = {
  id: 'dialogue', group: '本番', name: '声の対話（2分）',
  note: '声で会話し、来場者の発言は来場者の指が打つ（ときどき別の言葉になる）。最後は星1の最悪な感想が投稿される',
  use: '本番の通し（会話1分20秒＋感想40秒）。Enter か「はじめる」で開始／H で時計・記録の表示を切り替え',
  input: true,
  opts: {から: START, 声: ['マイク', '手入力'], LLM: ['あり', 'なし']},
  actions: [{label: s => s.running ? '最初から' : 'はじめる', run: s => { document.activeElement?.blur?.(); if (s.running) restart(); else begin(s); }}],
  init(S) {
    Object.assign(S, {phase: 'saver', running: false, dead: false, log: [], scroll: 0, tl: [], alts: [], name: '', lv: [], fs: 28,
      x: 0.5, vx: 1.3, y: 1, vy: 0, wait: 0, sq: 0, after: false,
      choice: null, composer: null, flood: null, mic: null, typing: null, scene: false, hud: {'0': 0, '1': 1}[lsGet('kc-dlg-hud')] ?? 2});
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
    if (S.phase === 'saver') drawSaver(S, t, dt);
    else if (S.flood) drawFlood(S, t, pb);
    else if (S.composer) drawComposer(S, t, pb);
    else drawLog(S, t, dt, S.fs * 1.3, S.choice ? pb * 0.45 : pb - S.fs * 0.6);
    if (S.choice) drawChoice(S, t, pb);
    drawMic(S, t);
    drawHud(S, t);
  },
};
window.KC_DIALOGUE = EXP;
})();
