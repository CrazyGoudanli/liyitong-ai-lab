// 本地测试用：假装是火山方舟，按 OpenAI 兼容格式流式返回。
// 用法：npm run mock（一个终端） + npm run dev:mock（另一个终端）
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 9799);
const QUIZ = `\`\`\`html
<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:sans-serif;background:#f4f6fb;padding:24px}h1{font-size:24px}button{display:block;width:100%;margin:8px 0;padding:14px;font-size:17px;border-radius:12px;border:1px solid #ccd;background:#fff}</style>
</head><body><h1>（模拟）你像一桐的哪个角色？</h1><p>这是本地模拟接口生成的页面。</p>
<button onclick="this.textContent='你最像：黄蓉'">点我看结果</button></body></html>
\`\`\``;

function reply(body) {
  const all = body.messages.map(m => typeof m.content === "string" ? m.content : m.content.map(c => c.text || "").join("")).join("\n");
  if (all.includes("```html") || all.includes("单文件 HTML")) return QUIZ;
  if (all.includes("JSON")) {
    if (all.includes("功课卡")) return JSON.stringify({ "常用说法": ["（模拟）我们先把事实理清楚"], "习惯动作": ["（模拟）手里拿笔"], "一天怎么过": "（模拟）上午开庭，下午写材料。", "可以问剧组顾问的问题": ["（模拟）开庭穿什么"] });
    if (all.includes("要点")) return JSON.stringify({ "要点": ["（模拟）要点一", "（模拟）要点二"], "一句话版本": "（模拟）一句话版本" });
    if (all.includes("台词老师")) return JSON.stringify({ "台词": "（模拟）台词", "白话": "（模拟）白话意思", "典故和讲究": "没有明确出处", "人物这时候会怎么做": "（模拟）停顿一下", "读音提醒": [] });
    return JSON.stringify({ "一句话": "（模拟）小传一句话", "成长经历": "（模拟）", "她想要什么": "（模拟）", "她怕什么": "（模拟）", "和别人的关系": ["（模拟）"], "一个细节": "（模拟）" });
  }
  if (all.includes("表演老师")) return "（模拟）她小时候最喜欢的地方是哪里？";
  return "（模拟回复）你好，我是模拟的从业者。这条回复来自本地测试接口。";
}

http.createServer((req, res) => {
  // 模拟允许网页直接调用（真实火山方舟是否允许，要在手机上实测）
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "authorization, content-type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  let raw = "";
  req.on("data", c => raw += c);
  req.on("end", async () => {
    if (req.headers.authorization !== "Bearer mock") { res.writeHead(401); return res.end("bad key"); }
    const body = JSON.parse(raw);
    // 用模型名含 no-disable 模拟「不支持 thinking.disabled」的 400，便于测重试
    if (body.thinking && body.thinking.type === "disabled" && /no-disable/i.test(String(body.model || ""))) {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "Unsupported thinking type for the current model: disabled", type: "BadRequest" } }));
    }
    const text = reply(body);
    const think = body.thinking && body.thinking.type === "enabled";
    res.writeHead(200, { "content-type": "text/event-stream" });
    // 模拟 Seed 深度思考：先推 reasoning_content，再推 content（客户端应忽略思考、只拼正文）
    if (think) {
      for (const piece of ["先", "想", "一下…"]) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "", reasoning_content: piece } }] })}\n\n`);
        await new Promise(r => setTimeout(r, 20));
      }
    }
    for (let i = 0; i < text.length; i += 24) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 24) } }] })}\n\n`);
      await new Promise(r => setTimeout(r, 15));
    }
    res.end("data: [DONE]\n\n");
  });
}).listen(PORT, "127.0.0.1", () => console.log("mock ark on :" + PORT));
