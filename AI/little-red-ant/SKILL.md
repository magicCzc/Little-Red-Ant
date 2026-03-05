---
name: "little-red-ant"
description: "为小红蚁仓库提供架构地图与改动配方。用户要新增/排查 AI 生成、任务队列、RPA、趋势/竞品/数据能力时调用。"
---

# 小红蚁（Little Red Ant）项目技能

## 什么时候调用

- 用户要在本仓库新增、修改或重构“小红书运营闭环”功能：趋势/选题、AI 生成、发布、互动、复盘、竞品监控、资产处理
- 用户要排查：任务队列卡住、Worker 不消费、RPA 选择器失效、抓取/发布流程不稳定、图片 403/链接失效等
- 用户要理解代码结构：入口文件、服务分层、任务处理模式、RPA 基建、AI Provider 模式

## 你要做什么

- 先定位“业务链路”属于哪一段：前端页面 → API 路由 → Service →（同步/异步）→ DB/文件系统 →（可选）RPA/外部站点
- 对耗时/不稳定/需要重试的动作，优先走异步任务队列（Task Handler），避免在 API 请求里长时间阻塞
- RPA 变更优先集中到 selectors（单一真相），交互统一走 RPAUtils（拟人化、安全点击/输入）
- 涉及密钥、Cookie、JWT、账号数据时，默认不输出、不记录日志、不写入文档

## 一句话动作（让它更像“功能”）

你可以直接用下面这种句式给我下达“动作指令”，我会按仓库约定自动完成代码改动、必要的验证，并返回改动文件清单与可运行结果。

### 动作指令格式

- `动作：<动作名>｜<参数...>｜<验收标准...>`

参数不需要很长，最少给到：目标（做什么）+ 输入（有什么数据/页面）+ 输出（要得到什么）。

### 动作清单（常用）

- `动作：新增 API｜<METHOD> <PATH>｜<请求/响应示例>｜<鉴权要求>`
  - 产物：`api/routes/*` + 对应 `api/services/*` 调用；必要时补 `api/schemas/*`
- `动作：新增异步任务｜<task.type>｜<payload 字段>｜<结果结构/成功条件>`
  - 产物：新建 Handler、注册 TaskRegistry、提供创建任务的 API 或复用现有入口
- `动作：排障任务队列｜<现象>｜<期望行为>`
  - 产物：定位链路（入队/消费/状态回写/失败重试），给出修复补丁或诊断脚本
- `动作：修复 RPA｜<模块> <页面> <元素>｜<失败现象/截图描述>`
  - 产物：优先改 selectors；必要时调整 `RPAUtils` 交互与等待策略
- `动作：新增 RPA 流程｜<模块>｜<步骤列表>｜<完成条件>`
  - 产物：新模块文件 + selectors + 可复用的流程函数（遵循 BrowserService/RPAUtils）
- `动作：新增 AI Provider｜<provider 名称>｜<能力范围: 文本/图/音频/视频>｜<调用约束>`
  - 产物：实现 interfaces、接入 AIFactory/组合 Provider、加配置读取与最小用例验证
- `动作：做一个小改动｜<文件/模块>｜<变更点>｜<验收标准>`
  - 产物：直接给出补丁与最小验证

### 返回内容约定（我会按这个给你结果）

- 变更摘要：做了什么、为什么这样做
- 文件清单：每个文件的作用与改动点
- 验证结果：类型检查/单测/最小复现路径（按仓库现有脚本）

### 可执行动作（CLI）

仓库提供了一个可执行入口，用于把常见动作“直接跑起来”（入队 + 可选本地处理 + 等待结果）。

- 入口脚本：`AI/cli.ts`
- 运行命令：`npm run ai -- <command>`

### 全量命令速查表

#### 1. 核心工作流 (Workflow)
| 命令 | 说明 | 关键参数 |
| :--- | :--- | :--- |
| `publish-cycle` | **一键发布闭环**：生成→合规→草稿→发布 | `--topic`, `--dry-run`, `--yes`, `--scheduledAt`, `--fix` |
| `daily-cycle` | **每日复盘闭环**：抓取→分析→生成日报 | `--source`, `--days`, `--refresh` |

#### 2. 内容与草稿 (Content & Drafts)
| 命令 | 说明 | 关键参数 |
| :--- | :--- | :--- |
| `gen-content` | 生成笔记/文章文案 | `--topic`, `--keywords`, `--style` |
| `gen-image` | 生成配图 | `--prompt`, `--refImg` |
| `gen-video` | 生成视频 | `--prompt`, `--imageUrl` |
| `draft-list` | 查看草稿列表 | `--limit`, `--offset` |
| `draft-save` | 保存新草稿 | `--title`, `--content`, `--tags`, `--images` |
| `draft-update` | 更新草稿 | `--id`, `--content`... |
| `draft-delete` | 删除草稿 | `--id` |
| `publish` | 发布草稿（或直接发布） | `--draftId`, `--scheduledAt`, `--auto` |

#### 3. 趋势与数据 (Trends & Data)
| 命令 | 说明 | 关键参数 |
| :--- | :--- | :--- |
| `scrape-trends` | 抓取热搜榜单 | `--source` (weibo/baidu/douyin...) |
| `scrape-trending-notes` | 抓取类目热门笔记 | `--category` (fashion/food...) |
| `report-trends` | 生成趋势报告 (Excel/MD) | `--source`, `--days` |
| `analyze-note` | 深入分析单篇笔记 | `--noteId` |
| `refresh-analytics` | 刷新数据看板统计 | 无 |
| `competitor-analyze` | 竞品分析（入队） | `--url` (主页链接) |

#### 4. 互动与合规 (Interaction & Compliance)
| 命令 | 说明 | 关键参数 |
| :--- | :--- | :--- |
| `comments-scrape` | 抓取最新评论 | 无 |
| `comments-reply` | 回复评论 | `--id`, `--content`, `--yes` |
| `compliance-check` | 合规性检测 | `--content` |
| `compliance-fix` | 合规性自动修复 | `--content`, `--blockedWords` |

#### 5. 任务管理 (Task System)
| 命令 | 说明 | 关键参数 |
| :--- | :--- | :--- |
| `tasks-list` | 查看历史任务 | `--status`, `--type`, `--limit` |
| `tasks-active` | 查看进行中任务 | 无 |
| `task-status` | 查询任务详情 | `--id` |
| `task-cancel` | 取消/停止任务 | `--id` |
| `wait` | 等待任务完成 | `<taskId>`, `--timeoutSec` |

#### 6. 配置与运维 (Config & Ops)
| 命令 | 说明 | 关键参数 |
| :--- | :--- | :--- |
| `check-health` | 账号/系统健康检查 | 无 |
| `settings-list/get/set` | 系统设置管理 | `--key`, `--value`, `--yes` |
| `selectors-list` | 查看 RPA 选择器 | `--platform`, `--category` |
| `selectors-export/import` | 导出/导入选择器配置 | `--file` |
| `assets-list` | 查看本地资产 | `--type` |
| `notifications-list` | 查看系统通知 | `--limit` |

#### 7. 研发辅助 (Dev Tools)
| 命令 | 说明 | 关键参数 |
| :--- | :--- | :--- |
| `prompts-list/add` | Prompt 模板管理 | `--name`, `--template` |
| `optimizations-list` | Prompt 优化记录 | `--status` |
| `video-projects-list` | 视频工程查看 | 无 |

### 自然语言示例 (Say)

你可以直接说出以下指令（支持模糊匹配）：

- **一键发布**：`say 一键发布 主题:春节穿搭 预览`
- **趋势报告**：`say 生成趋势报告 weibo 最近7天`
- **抓取热搜**：`say 抓取热搜 douyin`
- **数据看板**：`say 刷新看板`
- **账号体检**：`say 账号体检`
- **竞品分析**：`say 竞品分析 url:https://...`
- **回复评论**：`say 回复评论 id:123 内容:谢谢`
- **任务查询**：`say 任务列表` / `say 任务状态 id:xxx`
- **草稿管理**：`say 草稿列表` / `say 删除草稿 id:12`

### 通用参数说明

- `--json`: 仅输出 JSON 格式（便于工具调用）
- `--dry-run`: 试运行，不产生副作用（不落库/不发布）
- `--yes`: 确认执行高风险动作（如发布、回复、修改设置）
- `--enqueue-only`: 仅入队，不等待也不在本地处理
- `--no-process`: 仅入队和等待，依赖外部 Worker 处理
- `--timeoutSec <n>`: 设置等待超时时间（默认 1800秒）

## 仓库地图（关键入口）

### 技术栈

- 前端：React + TypeScript + Vite + TailwindCSS
- 后端：Node.js + Express（ESM）
- 数据：SQLite（better-sqlite3）
- 异步任务：轮询 Worker + TaskRegistry + Handler
- RPA：Playwright + stealth，持久化浏览器上下文
- AI：Provider 模式（Aliyun / DeepSeek / OpenAI 兼容等）

### 重要路径

- Worker/任务队列
  - `api/worker.ts`：Worker 入口
  - `api/services/tasks/TaskRegistry.ts`：任务类型到 Handler 的注册/分发
  - `api/services/tasks/handlers/*`：具体任务实现（发布、抓取、生成、多媒体等）
- RPA 基建
  - `api/services/rpa/BrowserService.ts`：浏览器上下文、Cookie、生命周期与并发锁
  - `api/services/rpa/config/selectors.ts`：选择器注册表（单点维护）
  - `api/services/rpa/utils/RPAUtils.ts`：安全交互/拟人化/初始化 page.evaluate 环境
  - `api/services/rpa/*`：发布、评论、竞品、趋势等模块
- AI Provider
  - `api/services/ai/AIFactory.ts`：Provider 选择/组合
  - `api/services/ai/providers/*`：各供应商实现
  - `api/services/ai/*Service.ts`：内容生成、图片、视频、分析等服务
- API 路由
  - `api/routes/*`：各业务路由
  - `api/app.ts`：Express 组装（中间件、路由挂载）

## 常用配方

### 新增一个 API 能力（同步）

1. 在 `api/routes/` 新增或扩展路由文件
2. 把业务逻辑放进对应的 `api/services/` Service，路由只做参数校验与调用
3. 若需要鉴权/权限，复用 `api/middleware/` 下的中间件

### 新增一个异步任务能力（推荐用于耗时动作）

1. 在 `api/services/tasks/handlers/` 新增一个 Handler（实现既定接口）
2. 在 `TaskRegistry` 注册任务类型 → Handler 的映射
3. API 路由只负责创建任务记录并返回 taskId；Worker 消费并回写状态/结果

### 修复或新增一个 RPA 流程

1. 先更新 `api/services/rpa/config/selectors.ts`（不要在业务逻辑里硬编码 selector）
2. 页面交互统一使用 `RPAUtils` 的安全方法（click/type/delay 等）
3. 涉及登录态与多账号时，优先走 `BrowserService` 的持久化上下文与并发锁策略

### 新增一个 AI Provider

1. 按 `api/services/ai/interfaces/*` 约束实现 Provider
2. 在 `AIFactory` 或组合 Provider 中注册/接入
3. 不要在代码里写死 Key；通过环境变量或设置表读取（并避免日志泄露）

## 常用命令（脚本）

- `npm run dev`：前后端并行开发
- `npm run client:dev`：仅前端
- `npm run server:dev`：仅后端（nodemon）
- `npm run check`：TypeScript 类型检查
- `npm run lint`：ESLint
- `npm run build`：构建
