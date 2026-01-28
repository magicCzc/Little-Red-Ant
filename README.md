# Little Red Ant (小红蚁) - AI 智能小红书运营助手

Little Red Ant 是一个集成了 **AI 内容创作**、**RPA 自动化发布**、**数据趋势分析** 和 **账号矩阵管理** 的全栈小红书运营辅助工具。它旨在帮助创作者和运营团队高效地生成爆款内容、管理多个账号，并基于数据驱动决策。

## 🚀 核心功能

### 1. 🤖 AI 智能创作 (AI Content Generation)
- **多模型支持**：基于 Provider 模式，支持 **Aliyun (通义千问/万相/Wan2.6)** 和 **DeepSeek** 等大模型。
- **去 AI 化引擎**：独家“防 AI”算法，屏蔽逻辑连接词，支持“闺蜜唠嗑”、“疯狂安利”等 8 种特调风格。
- **矩阵人设管理**：支持创建无限个“内容马甲”（Persona），一键切换美妆、宠物、探店等不同人设。
- **图文/长文/视频生成**：
    - **图文**：一键生成小红书风格的标题、正文、标签，并自动匹配 AI 配图 (Aliyun Wanx)。
    - **长文**：深度长文模式，支持 Markdown 格式，适合知识分享与深度解析。
    - **视频**：基于 **Wan2.6** 模型，支持图生视频、文本生成分镜脚本，打造爆款视频工厂。
- **多版本管理**：支持生成多个版本并保存历史记录，不满意的可以重新生成。
- **所见即所得**：内置卡片生成器，预览笔记效果。
- **资源本地化 (Asset Persistence)**：AI 生成的图片/视频自动下载至本地服务器，防止云端链接失效 (404)。

### 2. ⚡ 异步任务中心 (Task Center)
- **全异步架构**：耗时操作（如 AI 生成、爬虫抓取、自动发布）全部通过后台队列处理，前端不再阻塞。
- **实时状态**：在任务中心查看任务进度、耗时和结果。
- **结果回溯**：生成完成后，可直接从任务列表跳转查看结果。

### 3. 📊 数据洞察与趋势 (Analytics & Trends)
- **热点追踪**：聚合微博、百度热搜及 **小红书热搜笔记**，辅助选题。(注：知乎/抖音热搜暂未开放)
- **智能代理 (Smart Proxy)**：内置图片反防盗链代理，解决小红书/微博外链图片 403 裂图问题，实现秒级加载。
- **数据大盘**：可视化展示账号的阅读、点赞、收藏、评论数据。
- **Excel 导出**：支持将笔记数据导出为 Excel 报表，便于二次分析。

### 4. 🤖 RPA 自动化 (Automation Core v2.0)
- **一键发布**：自动操作浏览器上传图片、填写文案、发布笔记，支持定时与自动重试。
- **互动中心 (Engagement Pro)**：
    - **全量同步**：支持回溯抓取 7 天内的所有评论与交互，自动处理懒加载与分页。
    - **智能回复**：精准定位历史评论，支持拟人化输入与自动回车发送，解决“幽灵回复”问题。
    - **AI 辅助**：(开发中) 自动分析评论意图并生成高情商回复建议。
- **竞品监控 (Spy Pro)**：自动拆解对标账号的爆款逻辑、关键词与选题策略，AI 生成模仿建议。
- **账号矩阵**：支持多账号 Cookie 管理与切换，自动检测登录状态，Cookie 失效自动报警。
- **安全风控**：
    - **智能频控**：内置 Daily Limit 策略，限制单账号每日发布数量，防止高频操作封号。
    - **指纹混淆**：Stealth 隐身模式 + Canvas 噪音，通过 Playwright 模拟真实设备特征。
    - **拟人化操作**：模拟真实鼠标轨迹与随机延迟，拒绝机械化行为。

### 5. ⚙️ 系统设置 (Settings)
- **可视化配置**：无需修改 `.env` 文件，直接在页面配置 API Key 和模型参数。
- **数据库管理**：基于 SQLite 的轻量级数据存储，无需安装额外数据库服务。

---

### 6. 🐳 容器化部署 (Docker Support)
- 提供标准 `Dockerfile` 与 `docker-compose.yml`。
- 支持一键部署到云服务器，实现 24 小时无人值守运行。
- 自动处理 Playwright 系统依赖，开箱即用。

### 7. 🔐 安全与权限 (Security & Auth)
- **多用户支持**：内置 JWT 认证系统，支持管理员注册与登录。
- **接口防护**：核心 API 全局鉴权，防止未授权访问。
- **密码加密**：使用 bcrypt 强加密存储，保障账户安全。

### 8. 🔍 竞品深度分析 (Competitor Spy)
- **爆款拆解**：自动抓取对标账号的 Top 10 笔记，分析其标题套路和封面风格。
- **策略复刻**：AI 生成具体的“抄作业”建议，包括选题方向、关键词布局和避坑指南。
- **数据追踪**：定期监控竞品数据变化，发现流量新趋势。

### 9. 🚀 工程化 (DevOps)
- **CI/CD**: 集成 GitHub Actions，自动进行 TypeScript 类型检查与 Docker 镜像构建。
- **Linting**: 严格的 ESLint 规则，保持代码风格统一。

## 🛠️ 技术栈 (Tech Stack)

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Node.js, Express
- **Database**: Better-SQLite3
- **Automation**: Playwright (Headless/Headed Browser)
- **AI Integration**: OpenAI SDK (Compatible), Aliyun SDK

---

## 📦 安装与运行

### 前置要求
- Node.js >= 18
- Chrome/Edge 浏览器 (用于 RPA)

### 1. 克隆项目与安装依赖
```bash
git clone https://github.com/magicCzc/Little-Red-Ant.git
cd Little-Red-Ant
npm install
```

### 2. 环境配置
虽然系统支持 UI 配置，但首次启动建议检查 `.env` 文件（可选）：
```env
PORT=3000
# 初始 API Key 可在此配置，也可在启动后通过“设置”页面配置
ALIYUN_API_KEY=your_key
DEEPSEEK_API_KEY=your_key
```

### 3. 启动开发服务器
```bash
npm run dev
```
此命令将同时启动前端 (Vite) 和后端 (Express Server)。
- 前端地址: `http://localhost:5173`
- 后端 API: `http://localhost:3000`

---

## 📂 项目结构

```
.
├── api/                # 后端源码
│   ├── routes/         # API 路由 (generate, tasks, publish, etc.)
│   ├── services/       # 业务逻辑
│   │   ├── ai/         # AI Providers (Aliyun, DeepSeek)
│   │   ├── crawler/    # 爬虫 (Baidu, Weibo, etc.)
│   │   ├── rpa/        # 浏览器自动化 (Playwright)
│   │   └── queue.js    # 任务队列服务
│   ├── db.ts           # 数据库初始化与连接
│   └── worker.ts       # 后台任务消费者
├── src/                # 前端源码
│   ├── components/     # UI 组件
│   ├── pages/          # 页面 (ContentGeneration, Tasks, Analytics...)
│   └── App.tsx         # 路由配置
├── data/               # SQLite 数据库文件与临时文件
├── docs/               # 项目文档
└── package.json
```

## 📝 待办与计划 (Roadmap)
详情请查看 [docs/ROADMAP.md](./docs/ROADMAP.md)

---

## 📄 License
MIT
