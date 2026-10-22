# AGENTS.md

先读 `HANDOFF.md`（架构、状态、坑）和 `README.md`。

规则：
- 零依赖、无构建：前端全在 `app.html`，服务端 `server.js`，不要引入框架/npm 依赖。
- `vendor/three/` 是本地化的 three.js，不要改成 CDN。
- 绝不提交 API Key（仓库是公开的）；`.env` 已被忽略。
- 产品底线：不评价/打分表演、不提外貌身材年龄、不保存录音和照片（见 `RULES`）。
- 界面面向不懂电脑的人：短句、大按钮、点一下就能用。
- 本地测试：`npm run mock` + `npm run dev:mock`，手机宽度 390px。
- 提交信息用中文。
