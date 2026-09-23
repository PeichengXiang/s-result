# SparkArena · EgoVLA Benchmark

公开成绩页面：总榜在前、单任务领先图在后，支持筛选全部已完成权重，不展示逐次测评明细。任务名同时显示中文和英文。访客无需登录；管理员登录后可添加持久化备注和异常标记。

## 数据

`data/results.json` 是从评测 Web 核对后同步的公开快照，最近上传时间见其中的 `updatedAt`。仅包含正式任务、完整回合和成功完成的运行，保留有效的 0 分。服务器地址、账号、checkpoint 路径及日志未公开。

- SparkArena 使用 Web 当前 7 项正式任务：点击鼠标、收集物体、双瓶抓取、锤击、微波炉放食物、缝隙取物、堆叠碗。
- EgoVLA 为 12 项 humanoid 任务，每次 93 回合（Seen 27 / Unseen 66）。总评测表按 eval web 的 Short（7 项）/ Long（5 项）拆成四个配置：Short-Seen、Short-Unseen、Long-Seen、Long-Unseen；每个配置内按任务逐项选择同一模型、同一权重的最佳完整测评，再按 Mean SR 排名，release-v7 PSR 作为同分比较并同时展示。
- 原始数据与筛选沿用实际 checkpoint 步数。SparkArena 的 π0.5 79999 权重显示为 8w，筛选项标为“8w（π0.5）”以区别实际 80000 的选项；不改写原始权重或成绩。
- 总榜每模型类型使用同一权重的全任务等权平均最高值。SparkArena 与当前评测 Web 总榜一致：同一模型、同一权重下，每个任务取结果 ID 最新的完整单次；更新的独立重测可以替换旧完整批次中的对应任务。若这一整层任务全部为 0 分，则剥掉整层后按相同规则选择更早记录，仍须七任务齐全；单个任务的 0 分不会单独回退。
- EgoVLA 的 setting 分组完全沿用 eval web：Spark 细分为 no pretrain、visual pretrain、tactile-100h pretrain、tactile-full pretrain、inspire，ACT 作为一个模型行，其余策略按策略名合并。没有完整配置或 Mean SR 为 0 的 setting 不进入排名，但会保留空行提示。
- 表格后面的图展示各任务最佳完整单次，可能来自不同权重，与总榜口径有意区分。低分或 0 分不会自动标记异常。
- 这是本项目测评成绩，不是 benchmark 原作者的官方排行榜。历史测评可能使用不同适配版本；请结合人工备注解读。
- ACT 的 SparkArena 与 EgoVLA 成绩已公开；同一 ACT 模型的分任务测评会合并展示为一个模型。SparkArena 计入完整总榜；EgoVLA 在四个 Short/Long × Seen/Unseen 配置中按同一 ACT 行展示。

## 开发与发布

Node.js 22.13+，pnpm。`pnpm install`、`pnpm dev`、`pnpm build`。

完整网站为 Cloudflare Worker 兼容输出，备注、会话和登录限流存储于 D1。`db/schema.ts` 定义 schema，`pnpm db:generate` 生成迁移，迁移随部署应用。

`pnpm build:pages` 生成 `docs/`，GitHub Pages 可从 `main` 分支的 `/docs` 发布。GitHub Pages 同时展示完整成绩、备注和管理员登录框；认证和备注保存请求由远端服务处理，因此登录和编辑始终留在当前 GitHub 页面，管理员密码不会写入前端文件。

运行环境需配置 `.env.example` 中的变量。密码校验采用带随机盐的 PBKDF2-SHA256（100,000 次）；设置值到托管平台的 secret，切勿提交 `.env` / `.dev.vars`。

`pnpm check:metrics` 对比导出时 Web 总榜基线、检查权重隔离、任务覆盖和发布字段。API 权限、CSRF、持久化、并发版本及退出失效已在本地独立数据库验证。

## 更新成绩

更新 `data/results.json` 后运行指标检查并重新构建、发布。当前为明确注明日期的快照，不会自动抓取私有评测系统。备注独立保存在数据库，发布新代码不会覆盖备注。

每次上传新的成绩快照时，将 `updatedAt` 更新为本次上传的 UTC ISO 时间（带 `Z` 或时区偏移），不是评测任务结束时间。页头“公开成绩 · 最近上传”统一按北京时间显示年月日、小时和分钟，与访客所在时区无关。仅修改页面或重新构建而未上传新成绩时，不刷新这个时间。
