# 系统架构回顾与深度优化方案 (System Architecture Review & Optimization Plan)

**日期**: 2026-01-29
**状态**: 执行中 (Phase 4 - Scheduler Refactor)

## 1. 现状回顾与痛点分析 (Current Situation & Pain Points)

### 1.1 核心痛点
*   **任务阻塞 (Task Blocking)**: 任务处理是单线程串行的。长耗时任务（如视频生成）会完全阻塞短耗时的高优先级任务（如文本生成）。
*   **脆弱性 (Fragility)**: 代码对外部依赖高度敏感。
*   **RPA 稳定性差**: 指纹冲突已在 Phase 3 解决，但选择器依赖 CSS 类名仍存在风险。
*   **僵尸任务**: 服务崩溃后，`PROCESSING` 状态的任务无法自动恢复。

### 1.2 根本原因 (Root Causes)
1.  **调度器设计缺陷**: `worker.ts` 使用全局锁 `isWorking`，不支持并发。
2.  **缺乏优先级**: 数据库查询仅按时间排序，未区分用户实时请求和后台任务。
3.  **缺乏恢复机制**: 没有 Application Lifecycle 管理来处理启动时的脏数据清理。

---

## 2. 深度优化方案 (Optimization Strategy)

### 2.1 调度系统重构 (Scheduler Refactor) - 🚀 本次重点
升级为支持并发、优先级的现代化任务队列。

*   **架构设计**:
    *   **并发控制 (Concurrency)**: Worker 维护一个 `activeCount`，允许配置最大并发数（如 3）。
    *   **优先级队列 (Priority Queue)**: `tasks` 表增加 `priority` 字段 (High=10, Normal=0, Low=-10)。数据库查询优先获取高优先级任务。
    *   **崩溃恢复 (Crash Recovery)**: 系统启动时，扫描所有 `updated_at` 超过 30分钟且状态为 `PROCESSING` 的任务，将其重置或标记失败。

### 2.2 RPA 模块加固 (RPA Hardening) - ✅ Phase 3 已完成部分
*   **统一底层库**: 移除 Playwright/Puppeteer 混用冲突。
*   **行为模拟**: 引入 `ghost-cursor`。

### 2.3 基础设施增强 (Infrastructure) - ✅ Phase 1/2 已完成
*   **配置中心**: `api/config.ts`。
*   **服务拆分**: Service Layer 微服务化。

---

## 3. 执行路线图 (Execution Roadmap)

### Phase 1: 基础设施与 AI 模块标准化 (✅ 已完成)
*   [x] 统一配置中心与日志。
*   [x] Zod 输入验证。
*   [x] Service 拆分。

### Phase 2 & 3: RPA 模块加固 (✅ 已完成)
*   [x] 移除冲突代码。
*   [x] 集成 Ghost Cursor。

### Phase 4: 调度系统重构 (🚀 已完成)
*   [x] **Schema 升级**: `tasks` 表添加 `priority` 字段。
*   [x] **队列逻辑升级**: `getNextPendingTask` 支持优先级排序。
*   [x] **并发 Worker**: 重写 `worker.ts`，支持多任务并行处理。
*   [x] **崩溃恢复**: 实现 `recoverStaleTasks`。
*   [x] **安全加固**: 实现 Cookie 加密存储 (EncryptionService)。
*   [x] **单元测试**: 引入 Vitest，完成 Queue 和 Encryption 模块的测试覆盖。

---

**总结**: Phase 4 已彻底解决系统“假死”和“阻塞”的问题，并消除了明文存储敏感数据的安全隐患。项目代码现已具备生产级稳定性。
