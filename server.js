// 一桐的 AI 排练室 · 轻量服务器
// 零依赖：Node 18+ 自带 http 和 fetch。负责两件事：
// 1) 把 app.html 包成完整网页发给浏览器；
// 2) 把 /api/chat 转发给火山方舟（豆包），密钥只放在服务器上。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ── 读取 .env（不引依赖，只认 KEY=VALUE）──
try {
  for (const line of fs.readFileSync(path.join(DIR, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const ARK_API_KEY = process.env.ARK_API_KEY || "";
const ARK_BASE_URL = (process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3").replace(/\/$/, "");
const ARK_MODEL = process.env.ARK_MODEL || "doubao-seed-2-1-pro-260915";
const ACCESS_CODE = process.env.ACCESS_CODE || "";
// Seed 系列默认会开深度思考：流式先长时间只推 reasoning_content，页面会一直转圈。
// 排练室场景要快，默认先关思考；若模型不支持 disabled（会 400），自动去掉该字段重试。
// 需要思考时在 ARK_EXTRA 里显式打开：{"thinking":{"type":"enabled"}}
let ARK_EXTRA = {};
try { if (process.env.ARK_EXTRA) ARK_EXTRA = JSON.parse(process.env.ARK_EXTRA); } catch { console.warn("ARK_EXTRA 不是合法 JSON，已忽略"); }
const EXTRA_HAS_THINKING = Object.prototype.hasOwnProperty.call(ARK_EXTRA, "thinking");
// "disable" | "omit" —— 记住该模型是否接受 thinking.disabled，避免每次都撞 400
let thinkMode = EXTRA_HAS_THINKING ? "omit" : "disable";

function arkPayload(messages, maxTokens) {
  const base = { ...ARK_EXTRA, model: ARK_MODEL, messages, stream: true, max_tokens: maxTokens };
  if (thinkMode === "disable" && !EXTRA_HAS_THINKING) return { thinking: { type: "disabled" }, ...base };
  return base;
}
function thinkingUnsupported(status, detail) {
  if (status !== 400) return false;
  return /thinking|深度思考|reasoning/i.test(detail || "");
}

const SHELL_HEAD = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>`;
const page = () => SHELL_HEAD + fs.readFileSync(path.join(DIR, "app.html"), "utf8") + "</body></html>";

// ── 简单限流：每个 IP 每分钟 40 次 ──
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = 60_000;
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 40;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 60_000)) hits.delete(k); }, 60_000).unref();

function codeOK(given) {
  if (!ACCESS_CODE) return true;
  const a = Buffer.from(String(given || "")), b = Buffer.from(ACCESS_CODE);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readBody(req, max = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > max) { reject(new Error("too_large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); };

async function chat(req, res) {
  if (!ARK_API_KEY) return send(res, 503, { error: "AI 还没配置（缺 ARK_API_KEY）" });
  if (!codeOK(req.headers["x-access-code"])) return send(res, 401, { error: "访问码不对" });
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress;
  if (limited(ip)) return send(res, 429, { error: "太快了，歇一会儿再试" });

  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: "请求格式不对" }); }
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  if (!msgs.length || msgs.length > 60) return send(res, 400, { error: "messages 不对" });
  let total = 0;
  for (const m of msgs) {
    if (!["system", "user", "assistant"].includes(m.role) || typeof m.content !== "string") return send(res, 400, { error: "messages 不对" });
    total += m.content.length;
  }
  if (total > 80_000) return send(res, 413, { error: "内容太长" });

  const images = (Array.isArray(body.images) ? body.images : []).slice(0, 3).filter(u => typeof u === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(u));
  const messages = msgs.map(m => ({ role: m.role, content: m.content }));
  if (images.length) {
    const last = [...messages].reverse().find(m => m.role === "user");
    if (last) last.content = [{ type: "text", text: last.content }, ...images.map(url => ({ type: "image_url", image_url: { url } }))];
  }
  const maxTokens = Math.min(Math.max(Number(body.maxTokens) || 1500, 256), 8192);

  const ctl = new AbortController();
  res.on("close", () => ctl.abort());
  const headers = { "content-type": "application/json", authorization: "Bearer " + ARK_API_KEY };
  let up, detail = "";
  try {
    up = await fetch(ARK_BASE_URL + "/chat/completions", {
      method: "POST", signal: ctl.signal, headers,
      body: JSON.stringify(arkPayload(messages, maxTokens)),
    });
    if (!up.ok) {
      detail = (await up.text().catch(() => "")).slice(0, 400);
      // 部分模型不接受 thinking.disabled → 去掉后重试一次
      if (thinkingUnsupported(up.status, detail) && thinkMode === "disable" && !EXTRA_HAS_THINKING) {
        console.warn("[ark] 模型不支持关闭思考，改为不传 thinking 重试");
        thinkMode = "omit";
        up = await fetch(ARK_BASE_URL + "/chat/completions", {
          method: "POST", signal: ctl.signal, headers,
          body: JSON.stringify(arkPayload(messages, maxTokens)),
        });
        if (!up.ok) detail = (await up.text().catch(() => "")).slice(0, 400);
      }
    }
  } catch (e) {
    if (ctl.signal.aborted) return;
    console.error("[ark] 连接失败：", e.message);
    return send(res, 502, { error: "连不上 AI 服务" });
  }
  if (!up.ok || !up.body) {
    console.error("[ark] HTTP", up.status, detail);
    return send(res, 502, { error: "AI 服务返回错误", status: up.status, detail: detail.slice(0, 200) });
  }
  res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", "x-accel-buffering": "no" });
  try { for await (const chunk of up.body) res.write(chunk); } catch {}
  res.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
      return res.end(page());
    }
    // 书架用的 three.js 放在 vendor/ 下，只允许读这个目录里的 .js / 授权文件
    if (req.method === "GET" && url.pathname.startsWith("/vendor/")) {
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const file = path.resolve(DIR, rel);
      if (!file.startsWith(path.join(DIR, "vendor") + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: "not found" });
      const type = file.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/plain; charset=utf-8";
      res.writeHead(200, { "content-type": type, "cache-control": "public, max-age=86400" });
      return fs.createReadStream(file).pipe(res);
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, { ok: true, ai: !!ARK_API_KEY, needCode: !!ACCESS_CODE, label: "豆包" });
    }
    if (req.method === "POST" && url.pathname === "/api/chat") return await chat(req, res);
    send(res, 404, { error: "not found" });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: "服务器出错了" });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`一桐的 AI 排练室：http://localhost:${PORT}`);
  console.log(ARK_API_KEY ? `AI：火山方舟 ${ARK_MODEL}` : "AI：未配置 ARK_API_KEY，网页会进入演示模式");
  if (EXTRA_HAS_THINKING) console.log(`深度思考：按 ARK_EXTRA ${JSON.stringify(ARK_EXTRA.thinking)}`);
  else console.log("深度思考：默认尝试关闭（模型不支持时自动去掉该参数）");
  if (!ACCESS_CODE) console.log("提醒：没有设置 ACCESS_CODE，任何拿到链接的人都能用");
});
