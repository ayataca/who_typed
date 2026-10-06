// Who Typed? 展示用ローカルサーバー
// - 展示HTMLと音声を配信する（file:// で開いたときのカメラ権限の問題も避けられる）
// - X API の認証情報をこのPCの .env にだけ置き、HTMLの代わりにXへ投稿する
// 起動: node server.mjs  → http://localhost:8787
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
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

async function postToX({ text, imageBase64 }) {
  const media = await xFetch('POST', 'https://api.x.com/2/media/upload', {
    media: imageBase64, media_category: 'tweet_image', media_type: 'image/jpeg',
  });
  const mediaId = media?.data?.id;
  if (!mediaId) throw new Error('画像のアップロード結果にIDがありません');
  const tweet = await xFetch('POST', 'https://api.x.com/2/tweets', { text, media: { media_ids: [mediaId] } });
  return tweet.data.id;
}

// ---- 投稿記録（重複送信の防止と、削除・保存期間の確認用） ----
fs.mkdirSync(POSTS_DIR, { recursive: true });
const done = new Map(); // sessionId -> 結果（または処理中の Promise）
if (fs.existsSync(LOG)) for (const line of fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean)) {
  try { const e = JSON.parse(line); if (e.ok && e.sessionId) done.set(e.sessionId, e); } catch {}
}
const log = entry => fs.appendFileSync(LOG, JSON.stringify(entry) + '\n');

async function handlePost(req) {
  const { sessionId, text, imageData, rating } = req;
  if (!/^[\w-]{8,64}$/.test(sessionId || '')) return { status: 400, body: { ok: false, error: 'sessionId がありません' } };
  if (!text || typeof text !== 'string' || text.length > 280) return { status: 400, body: { ok: false, error: '本文が不正です' } };
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(imageData || '');
  if (!m) return { status: 400, body: { ok: false, error: '手元写真がありません（撮影に失敗した回は投稿しません）' } };

  // 同じセッションの再送は、最初の結果をそのまま返す
  if (done.has(sessionId)) {
    const prev = await done.get(sessionId);
    return { status: 200, body: { ...prev, duplicate: true } };
  }
  const job = (async () => {
    fs.writeFileSync(path.join(POSTS_DIR, `${sessionId}.jpg`), Buffer.from(m[1], 'base64'));
    const entry = { sessionId, at: new Date().toISOString(), rating, text, dryRun };
    try {
      if (dryRun) {
        Object.assign(entry, { ok: true, id: null, url: null });
      } else {
        const id = await postToX({ text, imageBase64: m[1] });
        Object.assign(entry, { ok: true, id, url: `https://x.com/${handle.slice(1) || 'i'}/status/${id}` });
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

async function handleDelete({ id }) {
  if (!/^\d{5,25}$/.test(id || '')) return { status: 400, body: { ok: false, error: '投稿IDが不正です' } };
  if (dryRun) return { status: 200, body: { ok: true, dryRun: true } };
  try {
    await xFetch('DELETE', `https://api.x.com/2/tweets/${id}`);
    log({ deleted: id, at: new Date().toISOString(), ok: true });
    return { status: 200, body: { ok: true } };
  } catch (e) {
    return { status: 502, body: { ok: false, error: e.message } };
  }
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
    if (url.pathname === '/api/status' && req.method === 'GET') return send(res, 200, { configured, dryRun, handle });
    if (url.pathname === '/api/post' && req.method === 'POST') { const r = await handlePost(await readJson(req)); return send(res, r.status, r.body); }
    if (url.pathname === '/api/delete' && req.method === 'POST') { const r = await handleDelete(await readJson(req, 4096)); return send(res, r.status, r.body); }
    if (req.method !== 'GET') return send(res, 405, { ok: false });
    // 静的ファイル（.env や posts/ は配信しない）
    const rel = decodeURIComponent(url.pathname === '/' ? '/who-typed-exhibition-scenario.html' : url.pathname);
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
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Who Typed? サーバー: http://localhost:${PORT}`);
    console.log(configured ? (dryRun ? '投稿モード: 模擬（DRY_RUN=1。Xには投稿しません）' : `投稿モード: 本番（${handle} に投稿します）`) : '投稿モード: 模擬（.env に X の鍵が未設定）');
  });
}
