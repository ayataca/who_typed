// Xへの投稿と、そのあとの画面（ポストの確認 → 公開中 → 問いかけ → 終了）— keycap_lab の声の対話の最後
// 本編（who-typed-exhibition-scenario.html）の仕組みと画面を使う（X の画面は白地のまま）：
//   server.mjs の /api/post に、本文（125字ごとのスレッド）と手元写真を送る。鍵はブラウザに置かない。同じセッションの再送は、サーバーが最初の結果を返す
//   画面は本編と同じ 1180×720 の大きさで組み、シナリオの画面（キーの上）に収まるよう拡大縮小する
// 読み込み：index.html の本体スクリプトより前に <script src="post.js"></script>。下の帯の #realConsent・#publicSession などを使う
(() => {
'use strict';
const CONFIG = {
  // アカウント名は server.mjs（.env の X_HANDLE）から読み込んで上書きする
  xAccountUrl: 'https://x.com/',
  xHandle: '@who_typed_exhibit',
  // node server.mjs で配信したときだけ投稿する。file:// で開いた場合は模擬投稿
  postEndpoint: location.protocol.startsWith('http') ? '/api/post' : '',
  postTimeoutMs: 25000,
  previewMs: 5000,    // ポストの確認を見せる時間
  postingMs: 2500,    // 投稿中（くるくる）の表示時間
  askMs: 6000,        // 「この投稿を書いたのは、誰…？」を見せる時間
  endMs: 25000,       // 終了画面を見せてから、待機に戻るまで（次のお客さんへ）
};
const $ = id => document.getElementById(id);
let stream = null, postAbort = null, lastPostIds = null, publishAllowed = true, stopPublishedOnce = null;

// ---- 改行：日本語を文節ほどの塊に分け、塊の間にだけ改行できる位置（ゼロ幅スペース）を入れる（本編と同じ） ----
// 漢字・カタカナ・英数字で始まる語（と、その直前の「お」「ご」）の前と、句読点の後だけで区切る
const SEG = 'Segmenter' in Intl ? new Intl.Segmenter('ja', {granularity: 'word'}) : null;
function phraseBreak(text) {
  if (!SEG || !text) return text;
  const parts = [...SEG.segment(text.replace(/​/g, ''))].map(x => x.segment);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i], prev = out.slice(-1), next = parts[i + 1] || '';
    const head = /^[\p{Script=Han}\p{Script=Katakana}A-Za-z0-9]/u.test(w) || (/^[おご]$/.test(w) && /^\p{Script=Han}/u.test(next));
    const afterPrefix = /[おご]$/.test(out) && parts[i - 1] && /^[おご]$/.test(parts[i - 1]);
    if (out && !/^[、。！？」）]/.test(w) && (/[、。！？]/.test(prev) || (head && !afterPrefix && /[\p{Script=Hiragana}ー]/u.test(prev)))) out += '​';
    out += w;
  }
  return out;
}
function breakStage(root) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: n => n.parentElement.closest('.post-text,svg,script') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
  const ns = []; while (tw.nextNode()) ns.push(tw.currentNode);
  for (const n of ns) n.data = phraseBreak(n.data);
}

// ---- 画面（シナリオの画面の上に重ねる） ----
// n は本編の場面の番号：7 ポストの確認・8 公開中・9 問いかけ・10 終了。X の画面も白地のまま（本編の黒地にはしない）
let root = null, stage = null;
function mount() {
  if (root) return;
  root = $('post');
  root.innerHTML = '<div class="terminal"><section class="stage"></section></div>';
  stage = root.querySelector('.stage');
}
function show(n, html, cls = '') {
  mount();
  root.classList.add('on');
  stage.innerHTML = '<div class="card ' + cls + '">' + html + '</div>';
  breakStage(stage);
}
function hide() { if (!root) return; root.classList.remove('on'); stage.innerHTML = ''; }
// シナリオの画面（キーより上）の大きさ w × h に、1180×720 の画面を収める
function place(w, h) {
  if (!root || !root.classList.contains('on')) return;
  const k = Math.min(w / 1180, h / 720);
  Object.assign(root.style, {width: w + 'px', height: h + 'px'});
  root.firstChild.style.transform = `translate(-50%,-50%) scale(${k})`;
}

// ---- 投稿の本文：1件目に星とハッシュタグ。長文は1ポスト125字までに区切り、2つ目以降はスレッド（返信）にする ----
function buildPosts(review, rating) {
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating), head = `【来場者の声】${stars} #who_typed #TechBias2026_Who_typed\n\n`, LIMIT = 125, out = [];
  let cur = head;
  const push = () => { out.push(cur.trimEnd()); cur = ''; };
  for (const sent of review.match(/[^。！？]+[。！？]*|[。！？]+/g) || []) {
    let rest = sent;
    while (cur.length + rest.length > LIMIT) {
      if (cur.length > (out.length ? 0 : head.length)) { push(); continue; }
      const room = LIMIT - cur.length; cur += rest.slice(0, room); rest = rest.slice(room); push();
    }
    cur += rest;
  }
  if (cur.trim() && cur !== head) push();
  return out;
}
const XSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
// 投稿の下に並ぶアイコン（返信・リポスト・いいね・表示回数）。数は投稿した瞬間なのですべて0
const TW_ACT = '<div class="tw-act" aria-hidden="true">' + ['<path d="M4 5h16v11H9l-5 4z"/>', '<path d="M7 4 4 7l3 3M4 7h12v4M17 20l3-3-3-3M20 17H8v-4"/>', '<path d="M12 20s-7-4.4-7-9.5A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.5C19 15.6 12 20 12 20z"/>', '<path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/>'].map(d => `<span><svg viewBox="0 0 24 24">${d}</svg>0</span>`).join('') + '</div>';
function tweetHTML(text, photo) {
  return `<article class="tw"><div class="avatar">W</div><div><div class="tw-head"><b>来場者の声</b><span class="handle">${CONFIG.xHandle}</span><span class="when">· 今</span><span class="xm">${XSVG}</span></div><div class="post-text"></div>${photo === undefined ? '' : photo ? `<img class="photo" src="${photo}" alt="このセッションで撮影した手元">` : '<div class="photo" style="display:grid;place-items:center;color:#69737d">カメラ画像なし</div>'}${TW_ACT}</div></article>`;
}
const threadHTML = (posts, img) => posts.map((t, i) => tweetHTML(t, i ? undefined : img)).join('');
function fillThread(sel, posts) { stage.querySelectorAll(sel + ' .post-text').forEach((el, i) => el.textContent = phraseBreak(posts[i])); }
function autoScroll(el, ms) {
  if (!el) return;
  const max = el.scrollHeight - el.clientHeight; if (max <= 0) return;
  const t0 = performance.now();
  (function step(t) { const k = Math.min(1, (t - t0) / ms); el.scrollTop = max * k; if (k < 1 && el.isConnected) requestAnimationFrame(step); })(t0);
}
// ---- 手元のカメラ（投稿の写真）。下の帯で、使うカメラを選べる（選んだものはブラウザに保存） ----
const CAM_KEY = 'kc-camera';
const camGet = () => { try { return localStorage.getItem(CAM_KEY) || ''; } catch { return ''; } };
const camSet = v => { try { localStorage.setItem(CAM_KEY, v); } catch {} };
async function listCameras() {
  const sel = $('cameraSel'); if (!sel || !navigator.mediaDevices?.enumerateDevices) return;
  const cams = (await navigator.mediaDevices.enumerateDevices().catch(() => [])).filter(d => d.kind === 'videoinput');
  const cur = stream?.getVideoTracks()[0]?.getSettings().deviceId || camGet();
  sel.replaceChildren(new Option('カメラ（自動）', ''), ...cams.map((d, i) => new Option(d.label || `カメラ ${i + 1}`, d.deviceId)));
  sel.value = cams.some(d => d.deviceId === cur) ? cur : '';
}
async function startCamera() {
  try {
    stream?.getTracks().forEach(t => t.stop());
    const id = camGet(), base = {width: {ideal: 1280}, height: {ideal: 720}, frameRate: {ideal: 30, max: 30}};
    try { stream = await navigator.mediaDevices.getUserMedia({video: id ? {...base, deviceId: {exact: id}} : base, audio: false}); }
    catch (e) { if (!id) throw e; stream = await navigator.mediaDevices.getUserMedia({video: base, audio: false}); status('選んだカメラが見つからないので、ほかのカメラを使います', 5000); }
    const pv = $('pv-hands'); pv.srcObject = stream; pv.play().catch(() => {});
    $('cameraBtn').textContent = 'カメラ接続済み';
    listCameras();
    return true;
  } catch (e) { $('cameraBtn').textContent = 'カメラを再試行'; status('カメラ: ' + e.message, 5000); return false; }
}
async function capture() {
  if (!stream) return '';
  try {
    const v = document.createElement('video'); v.srcObject = stream; v.muted = true; v.playsInline = true;
    await Promise.race([v.play(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))]);
    await new Promise(r => setTimeout(r, 350));
    const c = document.createElement('canvas'); c.width = v.videoWidth || 960; c.height = v.videoHeight || 720;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); v.pause();
    return c.toDataURL('image/jpeg', .88);
  } catch (e) { status('撮影失敗: ' + e.message, 5000); return ''; }
}

// ---- Xへの投稿（server.mjs 経由） ----
function showPostResult(r) {
  const el = $('postResult');
  lastPostIds = r.ok && r.id ? (r.ids || [r.id]) : lastPostIds; $('deletePost').disabled = !lastPostIds;
  if (r.ok && r.url) el.innerHTML = `投稿成功${r.ids && r.ids.length > 1 ? '（スレッド' + r.ids.length + '件）' : ''}${r.duplicate ? '（再送のため前回の結果）' : ''}${r.warning ? '［' + r.warning + '］' : ''}：<a href="${r.url}" target="_blank" rel="noopener">${r.url}</a>`;
  else el.textContent = r.ok ? (r.dryRun ? '模擬投稿：Xには投稿していません（DRY_RUN）' : '模擬投稿：サーバー未使用（file:// で開いています）') : '投稿なし／失敗：' + (r.error || '不明なエラー');
}
async function submitPost({sessionId, rating, texts, image}) {
  if (!image) { showPostResult({ok: false, error: '手元写真がないため投稿しません'}); return false; }
  if (!CONFIG.postEndpoint) { showPostResult({ok: true}); return true; }
  postAbort = new AbortController(); const timer = setTimeout(() => postAbort?.abort('timeout'), CONFIG.postTimeoutMs);
  try {
    const r = await fetch(CONFIG.postEndpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({sessionId, rating, texts, imageData: image}), signal: postAbort.signal});
    const j = await r.json().catch(() => ({ok: false, error: 'HTTP ' + r.status}));
    showPostResult(j); return !!j.ok;
  } catch (e) {
    showPostResult({ok: false, error: postAbort?.signal.reason === 'timeout' ? 'タイムアウト（Xへの投稿は完了している可能性があります。アカウントを確認してください）' : '公開中止により待機を中断（すでに投稿された可能性があります）'});
    return false;
  } finally { clearTimeout(timer); postAbort = null; }
}
const wantPost = () => publishAllowed && $('publicSession').checked;
// 公開する場合は、本人の実際の同意を確かめてから始める
function canStart() {
  if (!$('realConsent').checked && $('publicSession').checked) { status('公開する場合は、実際の同意確認が必要です', 5000); return false; }
  return true;
}
// 次のお客さんへ：「このセッションの公開を中止」は、そのセッションだけ
function newSession() {
  publishAllowed = true;
  if (stopPublishedOnce !== null) { $('publicSession').checked = stopPublishedOnce; stopPublishedOnce = null; $('stopPublish').textContent = 'このセッションの公開を中止'; $('stopPublish').disabled = false; }
  return crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function initControls() {
  $('cameraBtn').onclick = startCamera;
  $('cameraSel').onchange = e => { camSet(e.target.value); startCamera(); };   // 選んだら、そのカメラにつなぎ直す
  listCameras();
  navigator.mediaDevices?.addEventListener?.('devicechange', listCameras);
  $('stopPublish').onclick = () => {
    if (stopPublishedOnce === null) stopPublishedOnce = $('publicSession').checked;
    publishAllowed = false; postAbort?.abort('stop'); $('publicSession').checked = false;
    $('stopPublish').textContent = '公開中止済み'; $('stopPublish').disabled = true;
  };
  $('deletePost').onclick = async () => {
    if (!lastPostIds || !confirm('直前の投稿（スレッド全体）をXから削除しますか？')) return;
    const r = await fetch('/api/delete', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids: lastPostIds})}).then(r => r.json()).catch(e => ({ok: false, error: e.message}));
    $('postResult').textContent = r.ok ? '投稿を削除しました。' : '削除失敗：' + r.error;
    if (r.ok) { lastPostIds = null; $('deletePost').disabled = true; }
  };
  if (CONFIG.postEndpoint) fetch('/api/status').then(r => r.json()).then(st => {
    if (st.handle && st.handle !== '@') { CONFIG.xHandle = st.handle; CONFIG.xAccountUrl = 'https://x.com/' + st.handle.slice(1); }
    $('xStatus').textContent = 'X投稿: ' + (st.dryRun ? (st.configured ? '模擬（DRY_RUN=1）' : '模擬（.env に鍵が未設定）') : '本番 ' + st.handle);
  }).catch(() => { $('xStatus').textContent = 'X投稿: サーバーに接続できません'; });
  else $('xStatus').textContent = 'X投稿: 模擬（file:// で開いています。node server.mjs で起動してください）';
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initControls); else initControls();

window.KC_POST = {CONFIG, show, hide, place, buildPosts, threadHTML, fillThread, autoScroll, phraseBreak,
  startCamera, capture, hasCamera: () => !!stream, submitPost, showPostResult, wantPost, canStart, newSession};
})();
