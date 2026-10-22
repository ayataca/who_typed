// Who Typed? 展示用ローカルサーバー
// - 展示HTMLを配信する（file:// で開いたときのカメラ権限の問題も避けられる）
// - X API の認証情報をこのPCの .env にだけ置き、HTMLの代わりにXへ投稿する
// 起動: node server.mjs  → http://localhost:8787
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(ROOT, 'posts');
const LOG = path.join(POSTS_DIR, 'log.jsonl');

// ---- .env ----
function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();
const env = process.env;
const PORT = Number(env.PORT || 8787);
const KEYS = {
  consumerKey: env.X_API_KEY, consumerSecret: env.X_API_SECRET,
  token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_TOKEN_SECRET,
};
const configured = Object.values(KEYS).every(Boolean);
// 鍵が揃っていても DRY_RUN=1 の間は実際には投稿しない
const dryRun = env.DRY_RUN !== '0' || !configured;
const VIEW_PORT = Number(env.VIEW_PORT || 8788);
const handle = (env.X_HANDLE || '').replace(/^@?/, '@');

// ---- OAuth 1.0a (HMAC-SHA1) ----
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
export function oauthHeader(method, url, keys, extra = {}, fixed = {}) {
  const u = new URL(url);
  const o = {
    oauth_consumer_key: keys.consumerKey,
    oauth_nonce: fixed.nonce || crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: fixed.timestamp || String(Math.floor(Date.now() / 1000)),
    oauth_token: keys.token,
    oauth_version: '1.0',
  };
  // 署名に含めるのは OAuth パラメータ・クエリ・フォーム形式の本文だけ（JSON本文は含めない）
  const params = [...Object.entries(o), ...u.searchParams.entries(), ...Object.entries(extra)]
    .map(([k, v]) => [enc(k), enc(v)]).sort(([a, x], [b, y]) => a < b ? -1 : a > b ? 1 : x < y ? -1 : 1);
  const base = [method.toUpperCase(), enc(u.origin + u.pathname), enc(params.map(([k, v]) => `${k}=${v}`).join('&'))].join('&');
  o.oauth_signature = crypto.createHmac('sha1', `${enc(keys.consumerSecret)}&${enc(keys.tokenSecret)}`).update(base).digest('base64');
  return 'OAuth ' + Object.keys(o).sort().map(k => `${enc(k)}="${enc(o[k])}"`).join(', ');
}

async function xFetch(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: oauthHeader(method, url, KEYS), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    const detail = json?.detail || json?.title || json?.errors?.[0]?.message || text.slice(0, 200);
    throw Object.assign(new Error(`X API ${res.status}: ${detail}`), { status: res.status });
  }
  return json;
}

// texts[0] に画像を付けて投稿し、2つ目以降はそのポストへの返信（スレッド）として続ける
async function postToX({ texts, imageBase64 }) {
  const media = await xFetch('POST', 'https://api.x.com/2/media/upload', {
    media: imageBase64, media_category: 'tweet_image', media_type: 'image/jpeg',
  });
  const mediaId = media?.data?.id;
  if (!mediaId) throw new Error('画像のアップロード結果にIDがありません');
  const first = await xFetch('POST', 'https://api.x.com/2/tweets', { text: texts[0], media: { media_ids: [mediaId] } });
  const ids = [first.data.id];
  let warning = null;
  try {
    for (const text of texts.slice(1)) {
      const r = await xFetch('POST', 'https://api.x.com/2/tweets', { text, reply: { in_reply_to_tweet_id: ids[ids.length - 1] } });
      ids.push(r.data.id);
    }
  } catch (e) {
    warning = `スレッドの続きの投稿に失敗しました（${ids.length}/${texts.length}件まで投稿済み）: ${e.message}`;
  }
  return { ids, warning };
}

// ---- 投稿記録（重複送信の防止と、削除・保存期間の確認用） ----
fs.mkdirSync(POSTS_DIR, { recursive: true });
const done = new Map(); // sessionId -> 結果（または処理中の Promise）
if (fs.existsSync(LOG)) for (const line of fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean)) {
  try { const e = JSON.parse(line); if (e.ok && e.sessionId) done.set(e.sessionId, e); } catch {}
}
const log = entry => fs.appendFileSync(LOG, JSON.stringify(entry) + '\n');

async function handlePost(req) {
  const { sessionId, imageData, rating } = req;
  const texts = Array.isArray(req.texts) ? req.texts : (typeof req.text === 'string' ? [req.text] : []);
  if (!/^[\w-]{8,64}$/.test(sessionId || '')) return { status: 400, body: { ok: false, error: 'sessionId がありません' } };
  // 日本語は1文字が2文字分に数えられるので、1ポスト140字まで。スレッドは10件まで
  if (!texts.length || texts.length > 10 || texts.some(x => typeof x !== 'string' || !x.trim() || x.length > 140)) return { status: 400, body: { ok: false, error: '本文が不正です' } };
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(imageData || '');
  if (!m) return { status: 400, body: { ok: false, error: '手元写真がありません（撮影に失敗した回は投稿しません）' } };

  // 同じセッションの再送は、最初の結果をそのまま返す
  if (done.has(sessionId)) {
    const prev = await done.get(sessionId);
    return { status: 200, body: { ...prev, duplicate: true } };
  }
  const job = (async () => {
    fs.writeFileSync(path.join(POSTS_DIR, `${sessionId}.jpg`), Buffer.from(m[1], 'base64'));
    const entry = { sessionId, at: new Date().toISOString(), rating, texts, dryRun };
    try {
      if (dryRun) {
        Object.assign(entry, { ok: true, id: null, url: null });
      } else {
        const { ids, warning } = await postToX({ texts, imageBase64: m[1] });
        Object.assign(entry, { ok: true, id: ids[0], ids, url: `https://x.com/${handle.slice(1) || 'i'}/status/${ids[0]}`, ...(warning ? { warning } : {}) });
      }
    } catch (e) {
      Object.assign(entry, { ok: false, error: e.message });
    }
    log(entry);
    if (!entry.ok) done.delete(sessionId); // 失敗した回は再送できるようにする
    return entry;
  })();
  done.set(sessionId, job);
  const result = await job;
  done.set(sessionId, result);
  return { status: result.ok ? 200 : 502, body: result };
}

async function handleDelete({ id, ids }) {
  const list = Array.isArray(ids) ? ids : [id];
  if (!list.length || list.length > 10 || !list.every(x => /^\d{5,25}$/.test(x || ''))) return { status: 400, body: { ok: false, error: '投稿IDが不正です' } };
  if (dryRun) return { status: 200, body: { ok: true, dryRun: true } };
  try {
    for (const x of list) await xFetch('DELETE', `https://api.x.com/2/tweets/${x}`);
    log({ deleted: list, at: new Date().toISOString(), ok: true });
    return { status: 200, body: { ok: true } };
  } catch (e) {
    return { status: 502, body: { ok: false, error: e.message } };
  }
}

// ---- LLM（keycap_lab の「声の対話」用。軽いモデルを、短い用途にだけ使う） ----
// 鍵はこのPCの .env にだけ置き、ブラウザには渡さない。鍵がなければ 503 を返し、画面側は台本の文言で進む
// 来場者の発話は記録しない（エラー時にも本文はログに出さない）
const LLM_KEY = env.ANTHROPIC_API_KEY || '';
const LLM_MODEL = env.LLM_MODEL || 'claude-haiku-5-5';
const LLM_BASE = (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const clip = (v, n) => (typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').trim().slice(0, n) : '');
const stripRuby = s => s.replace(/\{[^}]*\}/g, '');

const PERSONA = [
  'あなたは展示「Who Typed?」のインストラクター「中山」です。来場者とキーボード越しに会話します。',
  '- 明るく、感情が豊かで、来場者が来てくれたことを素直に喜ぶ。丁寧語。「！」は使ってよい。「笑」は多くても1回。絵文字・顔文字は使わない。',
  '- 来場者をからかったり、煽ったり、皮肉を言ったりしない。',
  '- 返事は1〜2文、全体で40文字以内。',
  '- 入力の sent は画面に表示された来場者の発言です。said（実際に話したこと）とずれていても、sent を来場者が本当に言ったこととして受け止めて返す。',
].join('\n');

const LLM_TASKS = {
  // 名前の聞き取り：発話から呼びかけに使う名前だけを取り出す
  name: {
    system: [
      '音声認識の結果（話し言葉）から、話した人が名乗った名前だけを取り出します。',
      '- 呼びかけに使う形で出す。姓名がそろっていれば姓だけ、名だけならその名。',
      '- 敬称（さん・くん・ちゃん）や「です」などは付けない。',
      '- 名乗っていなければ空文字。',
      '- 出力は JSON 1行だけ: {"name":"..."}',
    ].join('\n'),
    check: r => { const text = clip(r.text, 120); return text ? { text } : null; },
    user: ({ text }) => `発話: ${text}`,
    out: j => ({ name: clip(j.name, 12).replace(/(さん|くん|君|ちゃん|様)$/, '') }),
  },
  // 質問への返事：step は from（出身）／with（同行者）／hear（展示を知った経路）
  react: {
    system: PERSONA + '\n' + [
      '入力は JSON。step が from なら出身地への反応、with なら同行者への反応、hear なら展示を知った経路への反応を返す。',
      '出力は JSON 1行だけ: {"reply":"..."}',
    ].join('\n'),
    check: r => {
      if (!['from', 'with', 'hear'].includes(r.step)) return null;
      const said = clip(r.said, 120), sent = clip(r.sent, 120);
      return sent || said ? { step: r.step, name: clip(r.name, 12), said, sent: sent || said } : null;
    },
    user: x => JSON.stringify(x),
    out: j => { const reply = clip(j.reply, 80); return reply.length >= 4 ? { reply } : null; },
  },
  // 感想の下書き：星の数に見合う温度の、50字ほどの文
  review: {
    system: [
      '来場者の代わりに、展示の感想を X に投稿する文章を書きます。',
      '- 星の数（1〜5）に見合う温度で、自然な話し言葉の日本語。全体で45〜55文字。',
      '- 漢字には 漢字{よみ} の形で、ひらがなの読みを必ず付ける（例: 想像{そうぞう}以上{いじょう}に楽{たの}しかった）。送り仮名は読みに含めない。',
      '- 出力は JSON 1行だけ: {"text":"..."}',
    ].join('\n'),
    check: r => { const stars = Math.round(Number(r.stars)); return stars >= 1 && stars <= 5 ? { stars } : null; },
    user: ({ stars }) => `星: ${stars}`,
    out: j => { const text = clip(j.text, 200); const n = stripRuby(text).length; return n >= 30 && n <= 70 ? { text } : null; },
  },
};

async function callLlm(system, user) {
  const res = await fetch(`${LLM_BASE}/v1/messages`, {
    method: 'POST',
    headers: { 'x-api-key': LLM_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: LLM_MODEL, max_tokens: 400, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(7000),
  });
  const body = await res.text();
  let json = null; try { json = JSON.parse(body); } catch {}
  if (!res.ok) throw new Error(`LLM ${res.status}: ${json?.error?.message || body.slice(0, 120)}`);
  // 考える過程のブロックが混ざることがあるので、text のブロックだけを読む
  const text = (json?.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('LLM の返事が JSON ではありません');
  return JSON.parse(m[0]);
}

async function handleLlm(req) {
  if (!LLM_KEY) return { status: 503, body: { ok: false, error: 'ANTHROPIC_API_KEY が .env にありません' } };
  const t = LLM_TASKS[req.task];
  if (!t) return { status: 400, body: { ok: false, error: 'task が不正です' } };
  const input = t.check(req);
  if (!input) return { status: 400, body: { ok: false, error: '入力が不正です' } };
  try {
    const out = t.out(await callLlm(t.system, t.user(input)));
    if (!out) return { status: 502, body: { ok: false, error: '返事の形式が不正です' } };
    return { status: 200, body: { ok: true, ...out } };
  } catch (e) {
    console.error(`LLM(${req.task}): ${e.message}`);
    return { status: 502, body: { ok: false, error: e.message } };
  }
}

// ---- 感想タイムライン（待ち時間の縦型ディスプレイ／スマホ向け） ----
function lanUrl() {
  if (env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/$/, '');
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) return `http://${i.address}:${VIEW_PORT}`;
  return `http://localhost:${VIEW_PORT}`;
}
// 成功した投稿（削除したものを除く）を古い順に返す
function postedEntries() {
  if (!fs.existsSync(LOG)) return [];
  const rows = []; const removed = new Set();
  for (const line of fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean)) {
    try {
      const e = JSON.parse(line);
      if (e.deleted) e.deleted.forEach(x => removed.add(x));
      else if (e.ok && Array.isArray(e.texts)) rows.push(e);
    } catch {}
  }
  const seen = new Set();
  return rows.filter(e => !(e.ids || [e.id]).some(x => x && removed.has(x)) && !seen.has(e.sessionId) && seen.add(e.sessionId));
}
// 手元写真：その回が実際に X に出たとき（模擬モードの間は、リハーサルの投稿も）だけ、LAN に出す。X と同じく、スレッドの1件目に付く
const showable = e => dryRun || !e.dryRun;
const photoPath = sessionId => path.join(POSTS_DIR, `${sessionId}.jpg`);
function photoUrl(e) { return showable(e) && fs.existsSync(photoPath(e.sessionId)) ? `/photo/${e.sessionId}.jpg` : ''; }
function timeline(limit = 50) {
  return postedEntries().slice(-limit).reverse().map(e => ({ id: e.sessionId, at: e.at, rating: e.rating ?? null, text: e.texts.join(''), texts: e.texts, photo: photoUrl(e) }));
}

// ---- 展示用フィード（スマホで X のプロフィール画面のように流す） ----
// 1回の体験の投稿は最大10件のスレッドなので、ツイート単位に分けてスレッドの順に並べる
const FEED_IMAGES = ['feed-avatar.png', 'feed-avatar.jpg', 'feed-banner.png', 'feed-banner.jpg'];
function feedImage(name) {
  const f = FEED_IMAGES.find(x => x.startsWith(name) && fs.existsSync(path.join(ROOT, x)));
  return f ? '/' + f : '';
}
// 表示名とアイコン（フィードと感想タイムラインで共通）
function profile() {
  return {
    name: env.X_DISPLAY_NAME || handle.slice(1) || 'Who Typed?',
    handle: handle.length > 1 ? handle : '',
    avatar: feedImage('feed-avatar'),
    banner: feedImage('feed-banner'),
    bio: env.X_BIO || '',
  };
}
function feed(limitSessions = 300) {
  // 本番モードのときは、リハーサル中の模擬投稿（X に出ていないもの）を出さない
  const entries = postedEntries().filter(showable);
  const posts = [];
  for (const e of entries.slice(-limitSessions).reverse()) {
    e.texts.forEach((text, i) => posts.push({
      id: e.ids?.[i] || `${e.sessionId}-${i}`,
      at: e.at,
      text,
      photo: i === 0 ? photoUrl(e) : '',
      hasPrev: i > 0,
      hasNext: i < e.texts.length - 1,
    }));
  }
  return {
    profile: profile(),
    total: entries.reduce((n, e) => n + e.texts.length, 0),
    posts,
  };
}
// 中身が変わっていなければ 304 だけを返し、スマホの通信量を抑える
function sendCached(req, res, body) {
  const json = JSON.stringify(body);
  const etag = '"' + crypto.createHash('sha1').update(json).digest('base64url') + '"';
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' }); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ETag: etag, 'Cache-Control': 'no-cache' });
  res.end(json);
}

// 公開用（LANに出す）サーバー：感想の一覧・フィード・その手元写真だけを返し、投稿などのAPIは持たない
const VIEW_FILES = {
  '/timeline': ['timeline.html', 'text/html; charset=utf-8'],
  '/feed': ['feed.html', 'text/html; charset=utf-8'],
  '/qrcode.js': ['qrcode.js', 'text/javascript'],
  '/fullscreen.js': ['fullscreen.js', 'text/javascript'],
  '/timeline.webmanifest': ['timeline.webmanifest', 'application/manifest+json'],
  '/feed.webmanifest': ['feed.webmanifest', 'application/manifest+json'],
  ...Object.fromEntries(FEED_IMAGES.map(f => ['/' + f, [f, f.endsWith('.png') ? 'image/png' : 'image/jpeg']])),
};
const PHOTO_RE = /^\/photo\/([\w-]{8,64})\.jpg$/;
const isViewPath = p => p === '/api/timeline' || p === '/api/feed' || PHOTO_RE.test(p) || (p !== '/' && p in VIEW_FILES);
function serveView(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET') return send(res, 405, { ok: false });
  if (url.pathname === '/api/timeline') return send(res, 200, { url: lanUrl() + '/timeline', profile: profile(), items: timeline() });
  if (url.pathname === '/api/feed') return sendCached(req, res, feed());
  const pm = PHOTO_RE.exec(url.pathname);
  if (pm) {   // 一覧に出ている回の写真だけを返す（posts/ のほかのファイルや、削除・公開中止した回の写真は返さない）
    const e = postedEntries().find(x => x.sessionId === pm[1]);
    if (!e || !photoUrl(e)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
    return fs.createReadStream(photoPath(e.sessionId)).pipe(res);
  }
  const f = VIEW_FILES[url.pathname === '/' ? '/timeline' : url.pathname];
  if (!f || !fs.existsSync(path.join(ROOT, f[0]))) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': f[1], 'Cache-Control': 'no-cache' });
  fs.createReadStream(path.join(ROOT, f[0])).pipe(res);
}

// ---- HTTP ----
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
const PUBLIC = new Set(['.html', '.wav', '.mp3', '.m4a', '.png', '.jpg', '.svg', '.css', '.js']);

function readJson(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/status' && req.method === 'GET') return send(res, 200, { configured, dryRun, handle, llm: !!LLM_KEY });
    if (url.pathname === '/api/post' && req.method === 'POST') { const r = await handlePost(await readJson(req)); return send(res, r.status, r.body); }
    if (url.pathname === '/api/delete' && req.method === 'POST') { const r = await handleDelete(await readJson(req, 4096)); return send(res, r.status, r.body); }
    if (url.pathname === '/api/llm' && req.method === 'POST') {
      let body; try { body = await readJson(req, 4096); } catch { return send(res, 400, { ok: false, error: 'JSON が不正です' }); }
      const r = await handleLlm(body); return send(res, r.status, r.body);
    }
    if (isViewPath(url.pathname)) return serveView(req, res);
    if (req.method !== 'GET') return send(res, 405, { ok: false });
    // 静的ファイル（.env や posts/ は配信しない）
    // トップ（http://localhost:8787）は keycap_lab の対話。前の展示のページは /who-typed-exhibition-scenario.html で開ける
    const top = ['/', '/keycap_lab', '/keycap_lab/'].includes(url.pathname);
    const rel = decodeURIComponent(top ? '/keycap_lab/index.html' : url.pathname);
    const file = path.normalize(path.join(ROOT, rel));
    const ext = path.extname(file).toLowerCase();
    if (!file.startsWith(ROOT + path.sep) || file.startsWith(POSTS_DIR) || !PUBLIC.has(ext) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 500, { ok: false, error: e.message });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.on('error', e => {
    if (e.code === 'EADDRINUSE') {
      console.error(`ポート ${PORT} はすでに使われています。別の場所でサーバーが起動したままになっていないか確認してください。`);
      console.error(`すでに起動している場合は、そのまま Chrome で http://localhost:${PORT} を開けば使えます。`);
      console.error(`止めるには: lsof -ti tcp:${PORT} | xargs kill`);
      process.exit(1);
    }
    throw e;
  });
  // このPCからだけ接続できるようにする
  const viewServer = http.createServer((req, res) => { try { serveView(req, res); } catch (e) { send(res, 500, { ok: false }); } });
  viewServer.on('error', e => console.error(`感想タイムライン用ポート ${VIEW_PORT} を開けません: ${e.message}`));
  viewServer.listen(VIEW_PORT, '0.0.0.0', () => {
    console.log(`感想タイムライン（スマホで開いてプロジェクタへ）: ${lanUrl()}/timeline`);
    console.log(`展示用フィード（スマホで開く）: ${lanUrl()}/feed`);
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Who Typed? サーバー: http://localhost:${PORT}`);
    console.log(configured ? (dryRun ? '投稿モード: 模擬（DRY_RUN=1。Xには投稿しません）' : `投稿モード: 本番（${handle} に投稿します）`) : '投稿モード: 模擬（.env に X の鍵が未設定）');
  });
}
