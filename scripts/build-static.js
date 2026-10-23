// 把 app.html 包成完整的静态网页，输出到 dist/index.html（给 GitHub Pages 用）。
// 静态版没有服务器，接不了豆包，会自动进入演示模式（每场显示示例结果）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const head = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>`;
const out = path.join(ROOT, "dist");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), head + fs.readFileSync(path.join(ROOT, "app.html"), "utf8") + "</body></html>");
fs.writeFileSync(path.join(out, ".nojekyll"), "");
// 书架用的 three.js 一起打包，不依赖外部网站（国内也能稳定加载）
fs.rmSync(path.join(out, "vendor"), { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "vendor"), path.join(out, "vendor"), { recursive: true });
// 表情对比是独立页面，参考视频在 assets/expression-compare/，静态站也要带上。
fs.copyFileSync(path.join(ROOT, "compare.html"), path.join(out, "compare.html"));
fs.rmSync(path.join(out, "assets"), { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "assets"), path.join(out, "assets"), { recursive: true });
console.log("已生成 dist/index.html、dist/compare.html、dist/assets/");
