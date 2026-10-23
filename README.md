# 一桐的 AI 排练室

给演员李一桐的私人 AI 体验网站。手机打开，首页是一个 3D 书架，五本书对应五个功能，点书直接进去用。

需求文档：Notion《网站需求文档：李一桐的 AI 体验站（v0.1）》。

> **接手开发请先读 [HANDOFF.md](HANDOFF.md)**（架构、已完成/未完成、坑、下一步）。

## 五个功能（五本书）

| 顺序 | 体验 | 她做什么 | 得到什么 |
|---|---|---|---|
| 1 | 说一句话，做一个网页 | 说想要什么网页 | 当场生成、能点着玩的粉丝测试页，可以继续说“换个颜色” |
| 2 | 和“律师”聊十分钟 | 和扮成律师 / 记者 / 老板的 AI 聊天 | 一张职业功课卡 |
| 3 | 车上的“记者” | 回答记者的 5 个问题 | 每题 2–3 个要点和一句话版本 |
| 4 | 古装台词速懂 | 拍一句或点一句台词 | 白话、典故、人物这时候怎么做、读音提醒 |
| 5 | 回答问题，得到小传 | 回答 8 个问题 | 只用她说过的话整理成的人物小传 |

另有“我的收藏”（存在她手机本地）和“随身话术卡”。

## 表情对比（单独一页）

手机竖屏打开。上面放参考视频，五个标签切换：愤怒排斥、害羞躲闪、害怕躲避、伤心抗拒、疲惫低头。下面用前置摄像头，点「录制」再点「停止」，然后点「播放」，上面的参考和刚录的一段一起从头放。

- 本地：`npm run dev:mock` 后打开 http://localhost:8787/compare.html
- 摄像头只在 **localhost** 或 **https** 下能用。手机不要打开 `http://电脑的局域网 IP`，浏览器会拒绝摄像头。
- 用自己的手机测：电脑按下面的方式套上 HTTPS（Caddy），手机打开 `https://你的域名/compare.html`。或者等这页部署到 GitHub Pages 后，用手机打开 https://crazygoudanli.github.io/liyitong-ai-lab/compare.html
- 电脑上先看布局：浏览器宽度调到约 390px。localhost 本身就能调摄像头。
- 录像只在这一页的内存里，不上传、不进服务器，刷新就没了。

换参考视频：把新的 mp4 放进 `assets/expression-compare/`，改 `compare.html` 里的 `REFS`（五行 `label` / `src`，顺序就是标签从左到右、从上到下）。现用文件：

| 标签 | 文件 |
|---|---|
| 愤怒排斥 | `assets/expression-compare/01-愤怒排斥.mp4` |
| 害羞躲闪 | `assets/expression-compare/02-害羞躲闪.mp4` |
| 害怕躲避 | `assets/expression-compare/03-害怕躲避.mp4` |
| 伤心抗拒 | `assets/expression-compare/04-伤心抗拒.mp4` |
| 疲惫低头 | `assets/expression-compare/05-疲惫低头.mp4` |

`npm run build:static` 会把 `compare.html` 和 `assets/` 一起放进 `dist/`。

**演示顺序建议**：1 → 2 → 3，最容易“哇”。

**首页书架**：three.js 放在 `vendor/three/`（不依赖外部网站）；手机没有 WebGL 或加载失败时，首页自动变成列表。`npm run build:static` 会把 `vendor/` 一起打进 `dist/`。

## 三种运行状态（网页自动判断）

1. **自建服务器 + 豆包**（正式用）：`/api/health` 显示已配置 → 走火山方舟。
2. **Claude 预览**：在 claude.ai 的 Artifact 里打开时，用 Claude 回答（只给胶布预览用，她在国内用第 1 种）。
3. **演示模式**：AI 连不上时，每个功能都有提前写好的示例结果，不会报错。

在线版还有第 4 种：**浏览器直连**——手机里填了 API Key 后，网页直接调用火山方舟（见下）。

## 在线版（GitHub Pages）

网址：https://crazygoudanli.github.io/liyitong-ai-lab/

静态网页，没有服务器。要用 AI：打开网页，滑到**首页最底部**，点“AI 状态”那一行（右侧“设置 ›”）展开，填一次火山方舟的 API Key，点“保存并测试”。之后网页直接从手机调用火山方舟。（`网址#setup` 仍可打开独立的设置页。）

- 密钥只存在那台手机的浏览器里，**不要写进仓库**（仓库是公开的）
- 是否能直接调用，取决于火山方舟是否允许网页跨域请求，需要在手机上点“保存并测试”确认；不行的话用下面的服务器版
- 更新在线版：合并到 `main` → `npm run build:static` → 把 `dist/` 的内容（含 `compare.html`、`assets/`、`vendor/`、`.nojekyll`）推到 `gh-pages` 分支。部署步骤详见 HANDOFF.md

## 部署服务器版（以搬瓦工 VPS 为例）

```bash
git clone https://github.com/CrazyGoudanli/liyitong-ai-lab.git
cd liyitong-ai-lab
cp .env.example .env      # 填 ARK_API_KEY、ARK_MODEL、ACCESS_CODE
node server.js            # 需要 Node 18+，没有任何 npm 依赖
```

长期运行可以用 pm2：`pm2 start server.js --name yitong`。

**必须上 HTTPS**：麦克风（说话输入）只在 HTTPS 下可用。用 Caddy 最省事：

```
yitong.你的域名.com {
  reverse_proxy 127.0.0.1:8787
}
```

> 国内访问：海外 VPS 在国内可能慢或不稳。正式给她用之前，在她的网络环境下实测；要稳定可以换国内已备案的服务器。具体备案要求请找懂的人确认。

## 配置项（.env）

| 变量 | 说明 |
|---|---|
| `ARK_API_KEY` | 火山方舟 API Key，只放在服务器上 |
| `ARK_MODEL` | 模型 ID 或接入点 ID。功能 4（古装台词）拍照需要支持图片输入的模型；演示讲究快，选响应快的 |
| `ARK_BASE_URL` | 默认 `https://ark.cn-beijing.volces.com/api/v3` |
| `ARK_EXTRA` | 可选，额外请求参数 JSON，比如关闭深度思考。先确认模型支持 |
| `ACCESS_CODE` | 访问码，她第一次打开输一次。强烈建议设置 |
| `PORT` | 默认 8787 |

## 本地测试（不花钱）

```bash
npm run mock       # 终端 1：模拟火山方舟
npm run dev:mock   # 终端 2：打开 http://localhost:8787
```

## 演示前检查清单

- [ ] 核对 `app.html` 顶部 `ROLES` 里的角色资料（来自公开报道）
- [ ] 功能 3 的 10 个记者问题让宣传团队过一遍口径
- [ ] 功能 4 的示例台词可以换成她已播剧里的台词，并核对解释
- [ ] 用她的手机实际跑一遍五个功能，看速度和朗读声音
- [ ] 确认模型服务的数据使用条款（不用于训练）

## 底线

- 只用公开资料，不上传未播剧本
- AI 不评价她的表演，不打分，不提外貌、身材、年龄
- 不保存录音和照片；收藏只存在她自己的手机里。表情对比的录像同样只留在当次打开的页面里
- 服务器不记录对话内容

## 已知限制

- 说话输入依赖浏览器：iPhone Safari 可用；微信内置浏览器不支持，这时用手机键盘上的麦克风
- 朗读用手机自带的语音，声音因机型而异
- 还没有做“实时语音通话”式的对话，现在是“说一句 → AI 回一句并朗读”
- 表情对比的摄像头：iPhone 用 Safari、安卓用 Chrome。微信里经常打不开摄像头
