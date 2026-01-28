# 小红蚁 (Little Red Ant) - V2.0 架构升级文档: 爆款驱动的 AI 视频工厂

**日期**: 2026-01-27
**版本**: V2.0 (Draft)

## 1. 核心设计理念 (Core Philosophy)

传统的视频制作工具流程是线性且孤立的（脚本 -> 素材 -> 剪辑）。
V2.0 架构旨在打破这种孤岛，构建一个 **"爆款驱动 (Trend-Driven)"** 和 **"AI 原生 (AI-Native)"** 的闭环工作流。

**核心公式**:
> **爆款结构 (Structure)** + **用户变量 (Topic)** + **AI 实例化 (Generation)** = **高概率爆款视频**

---

## 2. 业务流程重构 (Workflow Re-engineering)

### 2.1 旧流程 (Legacy) vs 新流程 (V2.0)

*   **旧流程**:
    1.  用户在“智能创作”凭空输入主题。
    2.  AI 生成纯文本脚本。
    3.  用户进入“视频工程”，手动找图、手动配音、手动合成。
    *   *痛点*: 门槛高，素材难找，音画不对齐，缺乏爆款基因。

*   **新流程 (V2.0)**:
    1.  **灵感 (Inspiration)**: 用户在 **"爆款库"** 浏览热门笔记/视频。
    2.  **仿写 (Remix)**: 点击 **"一键同款"**，系统提取爆款的**叙事结构** (Hook -> Body -> CTA)。
    3.  **裂变 (Instantiation)**: 用户输入新主题，AI 基于提取的结构生成**分镜脚本**。
    4.  **生产 (Production)**: 脚本自动进入 **"视频工程"**。
31→        *   **画面**: AI (Wanx/Wan2.6) 自动根据分镜生成图片/视频。
        *   **声音**: TTS 自动生成配音。
        *   **合成**: 后端自动根据音频时长，对齐画面（循环/慢放）。
    5.  **成品 (Delivery)**: 用户直接预览最终视频，仅需微调。

---

## 3. 技术架构 (Technical Architecture)

### 3.1 模块交互图

```mermaid
graph LR
    A[爆款库 (Trending)] -->|提取结构+元数据| B[智能创作 (Smart Gen)]
    B -->|生成结构化分镜脚本| C[视频工程 (Video Studio)]
    
    subgraph Video Engine
    C -->|分镜Prompt| D[AI 绘图/视频 (Aliyun Wan)]
    C -->|分镜Text| E[TTS 配音 (Edge/Paraformer)]
    D & E -->|Assets + Duration| F[智能合成器 (Stitcher)]
    end
    
    F -->|Final MP4| G[用户预览/导出]
```

### 3.2 关键数据结构

#### 3.2.1 爆款结构对象 (Remix Template)
```typescript
interface RemixTemplate {
  sourceId: string; // 来源爆款ID
  structure: {
    hook: string; // "3秒悬念：你是不是也..."
    body: string; // "核心干货..."
    cta: string;  // "关注我..."
  };
  style: string; // "激昂" | "温婉" | "快节奏"
}
```

#### 3.2.2 智能分镜 (Smart Scene)
```typescript
interface VideoScene {
  script_audio: string; // 口播文案
  script_visual: string; // AI绘图提示词 (English optimized)
  duration: number; // 预估/实际时长
  asset_type: 'image' | 'video'; // AI生成偏好
}
```

---

## 4. 功能开发规划 (Implementation Roadmap)

### 阶段一：连通性 (Connectivity) [Completed]
- [x] **爆款库改造**: 新增 "Remix" 按钮，传递数据到生成页。
- [x] **智能创作改造**: 接收 Remix 数据，调用 LLM 生成分镜脚本（而非纯文本）。

### 阶段二：AI 生产力 (AI Power) [Completed]
- [x] **视频工程升级**:
    - 集成 Aliyun Wanx (文生图) 接口到分镜卡片。
92→    - 集成 Aliyun Wan2.6 (图生视频) 接口，实现“图片动效化”。
93→- [x] **合成引擎升级**:
    - 实现 `Duration-Driven` (时长驱动) 的合成逻辑。
    - **技术细节**: 使用 `ffmpeg -stream_loop -1` 将短视频素材无限循环，配合 `-shortest` 参数，强制视频画面长度与 TTS 音频长度完全对齐。

### 阶段三：全自动 (Auto-Pilot) [Next Step]
- [ ] **一键成片**: 从脚本确认到视频生成，后台全自动队列执行。

---

## 5. 风险控制 (Risk Management)

1.104→1.  **成本控制**: 视频生成 API (Wan2.6) 成本较高，需在前端增加明确的“消耗点数”提示。
2.  **生成耗时**: 视频生成较慢，需实现异步队列 + 进度条轮询，避免前端超时。
