# 交接文档（HANDOFF）

> 写给接手开发的人 / Cursor。最后更新：2026-10-23。先读本文，再读 README.md。

## 1. 项目是什么

给演员**李一桐**的私人 AI 体验站，手机打开用。目标用户是“不懂电脑”的人：**简单、快、点一下就能用**。
首页是 3D 书架，五本书 = 五个功能，点书直接进功能页（没有中间的说明页），左上角“‹ 返回”。

- 线上：https://crazygoudanli.github.io/liyitong-ai-lab/ （GitHub Pages，`gh-pages` 分支）
- 仓库：https://github.com/CrazyGoudanli/liyitong-ai-lab （**公开**）
- 需求文档（Notion）：《网站需求文档：李一桐的 AI 体验站（v0.1）》，id `401d2753-0d28-814c-8892-f4cfb904dab0`；方案文档 id `401d27530d28813d9bbbd7eef0bf13f0`
- AI：火山方舟（豆包），默认模型 `doubao-seed-2-1-pro-260915`

## 2. 技术形态（刻意保持简单）

- **零依赖**：没有 npm 依赖、没有构建工具、没有框架。Node 18+。
- `app.html`（约 1260 行）：**整个前端都在这一个文件里**（CSS + 原生 JS + 3D 书架模块）。不是完整 HTML 文档，只是 `<body>` 内的片段。
- `server.js`：把 `app.html` 套上 `<head>` 外壳发出去；`/api/chat`（SSE 转发到火山方舟，密钥在服务器）、`/api/health`、`/vendor/*` 静态文件。内置限流、访问码。
- `scripts/build-static.js`：同样的外壳 + `app.html` → `dist/index.html`，并复制 `vendor/` 和 `.nojekyll`。`dist/` 被 `.gitignore` 忽略。
- `scripts/mock-ark.js`：本地模拟火山方舟，开发时不花钱。
- `vendor/three/`：three.js r165（本地化，**不要改成 CDN**，国内访问 jsdelivr 不稳）。
- `mockups/`：首页 UI 方案草稿（A–F），F 是最终采用的。只作历史参考，可删。

### app.html 结构地图（按注释标题搜）

| 区块 | 内容 |
|---|---|
| CSS：首页书架 / 按钮 / 场次页 | 深色 + 金色主题，变量在 `:root` |
| `ROLES` / `RULES` | 公开角色资料、对 AI 的统一规则（不评价表演、不打分、不提外貌年龄） |
| 小工具 | `el()` 建元素、`store`（localStorage，前缀 `ytlab.`）、`ICON`、`parseJSON` |
| AI 接入 | `initAI` 判断模式：`server`（/api/chat）→ `direct`（浏览器直连方舟，key 在 `ytlab.ark`）→ `claude`（仅 claude.ai 预览）→ `demo`；`ask()` 统一出口，`finishSSE` 解析流 |
| 访问码 / 朗读 `TTS` / 说话输入 `sayBox` / 收藏 `save` | 基础组件 |
| `SCENES` | 五本书的定义：id、名称、封面图类型、颜色、说明文字、`render` 函数 |
| 视图切换 `render` / `go` / `goHome` | 单页路由，hash：`#web #pro #press #line #bio #saved #script #setup` |
| `sceneWeb` `scenePro` `scenePress` `sceneLine` `sceneBio` | 五个功能的实现 |
| `renderSaved` `renderScript` `renderSetup` | 收藏页、话术卡、API Key 设置（`renderSetup(root, inline)`，inline=首页底部面板用） |
| `FALLBACK_QUIZ` | AI 没连上时“做网页”功能给的示例网页 |
| 启动 | `renderHome(); initAI();` + 按 hash 直达 |
| 3D 书架（文件末尾 `<script type="module">`） | importmap 指向 `./vendor/three/`；封面是 canvas 2D 现画的；无 WebGL 或加载失败 → `#shelf.nogl` → 显示 `#fallback-list` 列表 |

## 3. 五个功能（对应需求文档）

| id | 名称 | 要点 |
|---|---|---|
| `web` | 做一个粉丝测试页 | 说一句话 → AI 生成单文件网页，可继续说“换个颜色”；无 AI 时给示例页 |
| `pro` | 职业功课卡 | 选律师（默认）/记者/老板，AI 扮演聊天，最后整理成功课卡 |
| `press` | 采访问答练习 | 模拟 5 个记者问题，每题要点 + 一句能直接说的话，支持“再问一遍” |
| `line` | 古装台词速懂 | 拍照或点示例台词 → 白话、典故、人物动作、读音提醒 |
| `bio` | 人物小传生成 | 回答 8 个问题，只用她说过的话整理小传 |

另有：我的收藏（`ytlab.saved`，最多 50 条）、随身话术卡、访问码弹窗、AI 回答朗读开关。

## 4. 本地开发

```bash
npm run mock       # 终端 1：模拟火山方舟（端口 9799）
npm run dev:mock   # 终端 2：http://localhost:8787
node server.js     # 真实 AI：先 cp .env.example .env 填 ARK_API_KEY
```

不需要安装任何东西。改完 `app.html` 刷新即可。

## 5. 部署（GitHub Pages，静态版）

```bash
git checkout main && git pull
npm run build:static
# 把 dist/ 的全部内容（index.html、vendor/、.nojekyll）覆盖到 gh-pages 分支根目录并推送：
git clone --branch gh-pages --single-branch <repo> /tmp/ghp
cd /tmp/ghp && git rm -rq . ; cp -r <项目>/dist/. . ; git add -A && git commit -m "部署" && git push origin gh-pages
```

推送后 1–2 分钟生效。必须带 `vendor/`，否则书架退化成列表。
服务器版（VPS + Caddy HTTPS）的步骤见 README。

## 6. 当前状态

**已完成**：五个功能全部可用（演示模式 + 真实 AI 两条路径都测过，AI 用的是 mock）；3D 书架首页（滑动、点中间进入、点旁边拉到中间、返回按钮 + 返回手势）；无 WebGL 兜底列表；首页底部可展开的 API Key 设置；收藏 / 话术卡；已上线。

**测试方式**：Playwright（python）+ `--use-gl=swiftshader` 模拟 390px 手机，沙箱内无法访问外网。**从未在真机上测过。**

## 7. 未完成 / 下一步（按优先级）

1. **真机测试（最重要）**：iPhone Safari 上验证 3D 书架流畅度、字体（宋体回退）、说话输入、朗读、拍照上传。
2. **火山方舟浏览器直连是否可行**：取决于方舟是否允许网页跨域（CORS）。没测过。若不行 → 部署服务器版（`server.js` 已就绪，需 VPS + HTTPS），或用 Cloudflare Worker 之类做转发。
3. **密钥安全**：早先的 API Key 曾在对话里明文出现，**应在火山方舟后台作废并换新**。仓库是公开的，任何情况下不要提交密钥；直连模式下 key 存在手机 localStorage，只给她一个人用。考虑给方舟 key 设额度上限。
4. **内容待团队核对**（需求文档里的待定项）：`ROLES` 角色资料、记者题库（10 个问题）、古装示例台词及解释。
5. 需求文档（Notion）尚未更新首页为“书架”的说明。
6. 可选：`mockups/` 清理；把 `app.html` 拆成多个文件（目前一个文件靠注释分区，够用，别过早拆）；首页书架在小屏下上下留白偏多，可再调。

## 8. 约定与坑

- **产品底线**：只用公开资料；AI 不评价/打分表演；不提外貌身材年龄；不保存录音和照片；服务器不记录对话。改提示词时保留 `RULES`。
- **别加依赖/框架/构建步骤**，这是项目的卖点之一（任何人拿 Node 就能跑）。
- **history API 要 try/catch**：沙箱 iframe（claude.ai 预览）里 `pushState` 会抛 SecurityError，`go()`/`goHome()` 已处理，别去掉。
- **书架动画用时间缓动**（`1-exp(-dt*8)`），不要改回按帧，低性能手机会滑不到位。
- 书架在首页隐藏时不渲染（省电）；回到首页靠 `render("home")` 里触发 `resize` + `shelfGo(picked,true)`。
- 功能页的 UI 文案面向“不懂电脑的人”：短句、大按钮、不要术语。
- 提交信息用中文；没有测试框架，改动后用 `npm run dev:mock` 手点一遍五个功能 + 首页底部设置。
- 微信内置浏览器不支持说话输入（已知限制，README 有说明）。

## 9. 给 Cursor 的建议起手式

1. 读 README.md + 本文，`npm run mock` / `npm run dev:mock` 跑起来。
2. 手机宽度（390px）下把五个功能各点一遍。
3. 从“下一步”第 1、2 条开始；改动尽量小步，保持零依赖。
