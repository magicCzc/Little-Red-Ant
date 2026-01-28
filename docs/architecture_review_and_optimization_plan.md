# 系统架构回顾与深度优化方案 (System Architecture Review & Optimization Plan)

**日期**: 2026-01-23
**状态**: 拟定中

## 1. 现状回顾与痛点分析 (Current Situation & Pain Points)

近期我们在 **爬虫 (Scraper)** 和 **AI 生成 (AI Generation)** 两个核心模块上频繁遇到问题。虽然通过多次“热修复”解决了燃眉之急，但暴露出了系统架构层面的深层次问题。

### 1.1 核心痛点
*   **脆弱性 (Fragility)**: 代码对外部依赖（小红书 API 结构、阿里云模型参数）高度敏感。外部一点微小的变动（如字段改名、模型升级），就会导致整个功能崩溃。
*   **缺乏抽象 (Lack of Abstraction)**: 业务逻辑与底层实现紧耦合。例如 `aliyun.ts` 中直接硬编码了 `wanx-v1` 的特殊 Payload 结构，导致切换模型或升级 SDK 时需要修改核心逻辑。
*   **调试困难 (Poor Observability)**: 错误提示往往含糊不清（如 "url error"），缺乏统一的日志上下文，导致定位问题依赖“猜”和“试”。

### 1.2 根本原因 (Root Causes)
1.  **“脚本式”开发思维**: 早期为了快速 MVP，大量代码采用了“脚本式”写法（从头到尾的流水账逻辑），缺乏面向对象的封装和设计模式的应用。
2.  **硬编码假设**: 代码中充斥着对特定环境、特定 API 返回格式的硬编码假设，缺乏防御性编程和适配层。
3.  **缺乏统一的服务层**: 各个模块（RPA、AI、DB）各自为政，没有统一的接口规范和错误处理机制。

---

## 2. 深度优化方案 (Optimization Strategy)

为了摆脱“缝缝补补”的困境，我们需要对核心模块进行**架构级重构**。

### 2.1 AI 服务模块重构：适配器模式 (Adapter Pattern)
目前的 AI 服务是散乱的函数。我们需要建立一个统一的 AI 网关。

*   **架构设计**:
    *   `AIProvider` (Interface): 定义统一的 `generateText`, `generateImage` 接口。
    *   `AliyunProvider` (Class): 实现阿里云的具体逻辑，内部处理 `wanx` vs `qwen` 的参数差异。
    *   `DeepSeekProvider` (Class): 实现 DeepSeek 的逻辑。
    *   `AIFactory`: 根据配置自动分发请求。
*   **收益**: 新增模型或厂商时，只需增加一个 Provider 文件，不影响现有业务。

### 2.2 爬虫模块重构：管道模式 (Pipeline Pattern)
爬虫不应是一个 300 行的巨型函数，而应是一条处理流水线。

*   **架构设计**:
    *   **Navigator**: 负责浏览器操作（登录、滚动、跳转）。
    *   **Interceptor**: 负责网络层面的数据拦截与缓存。
    *   **Extractor**: 负责从 API 响应或 DOM 中提取原始数据（策略模式处理不同页面）。
    *   **Normalizer**: 负责数据清洗（时间格式化、数字归一化）。
    *   **Persister**: 负责数据库存储与去重。
*   **收益**: 任何一个环节出错（如小红书改了时间格式），只需修改 `Normalizer`，不影响浏览器控制逻辑。

### 2.3 基础设施增强 (Infrastructure)
*   **配置验证 (Config Validation)**: 服务启动时检查所有必要 `.env` 变量（如 API Key 格式），配置错误直接阻止启动，而不是等到运行时报错。
*   **结构化日志 (Structured Logging)**: 引入 `winston` 或类似库，记录包含 `requestId`、`module`、`input` 的结构化日志，便于追踪链路。

---

## 3. 执行路线图 (Execution Roadmap)

拒绝盲目修补，按以下顺序推进重构：

### Phase 1: AI 模块标准化 (立即执行)
*   [ ] 创建 `services/ai/providers` 目录。
*   [ ] 实现 `AliyunImageProvider`，将 Payload 构造逻辑封装在内部。
*   [ ] 统一错误处理，将厂商的奇怪错误码（如 `InvalidParameter`）转换为人类可读的 `AppError`。

### Phase 2: 爬虫模块组件化 (接下来的重点)
*   [ ] 提取 `TimeParser` 和 `NumberParser` 为独立工具类。
*   [ ] 将 `stats.ts` 拆分为 `StatsScraper` 类，分离 `scroll()` 和 `parse()` 逻辑。

### Phase 3: 全局健壮性 (长期)
*   [ ] 引入 `zod` 或 `joi` 进行运行时的数据结构校验。
*   [ ] 为核心解析逻辑补充单元测试 (Unit Tests)。

---

**总结**: 我们的目标是将项目从“能用的脚本”进化为“健壮的工程”。
