# 视频深度拆解与仿写系统架构设计

## 1. 核心目标
针对小红书热门视频笔记，实现“逐字、逐帧、深度拆解”，提取其脚本结构、视觉策略和语音文案，为用户提供高质量的仿写参考。

## 2. 架构设计

### 2.1 数据流 (Pipeline)
```mermaid
graph TD
    A[视频笔记URL] --> B(视频下载模块)
    B --> C{多模态提取}
    C -->|音频流| D[ASR 语音转写]
    C -->|视频流| E[关键帧抽取]
    E -->|关键帧图片| F[OCR 文字提取]
    E -->|关键帧图片| G[视觉内容分析(AI)]
    D --> H[口播文案 (Transcript)]
    F --> I[画面文字 (On-Screen Text)]
    G --> J[视觉策略 (Visual Strategy)]
    H & I & J --> K[大模型深度拆解]
    K --> L[结构化分析报告]
    L --> M[仿写生成]
```

### 2.2 核心模块

#### A. 媒体处理层 (Media Processing)
*   **VideoDownloader**: 负责从 CDN 下载视频流，支持断点续传和超时重试。
*   **AudioExtractor**: 使用 `ffmpeg` 将视频分离为 `.mp3` 或 `.wav` 音频文件。
*   **FrameExtractor**: 使用 `ffmpeg` 每隔 N 秒（如 2s）截取关键帧，保存为临时图片。

#### B. 智能识别层 (AI Perception)
*   **ASR Service**: 语音转文字。
    *   *实现*: `OpenAIAudioProvider` (Whisper API) + `AliyunProvider` (Qwen-Audio-Turbo)。
    *   *策略*: 优先使用 OpenAI。若失败，自动降级到阿里云 Qwen-Audio（无需 OSS，直接支持文件上传）。
    *   *接口*: `AudioProvider.transcribe(path)`
    *   *产出*: 带时间戳的文本 (SRT格式最佳)。
*   **OCR Service**: 画面文字识别 (Planned)。
    *   *选型*: Tesseract.js (本地) 或 百度/阿里 OCR API。
    *   *产出*: 关键帧上的标题、字幕、贴纸文字。
*   **Vision Service**: 画面内容理解 (Planned)。
    *   *选型*: Qwen-VL 或 Doubao-Vision。
    *   *产出*: "第3秒：博主拿着口红试色，背景是化妆间"。

#### C. 数据存储层 (Storage)
*   **TrendingNotes Table 扩展**:
    *   `video_url`: 原始视频链接 (已存在)。
    *   `transcript`: 口播文案全文 (Text)。
    *   `ocr_content`: 画面提取文字 (Text)。
    *   `video_meta`: JSON, 包含时长、分辨率、编码等。
    *   `deep_analysis`: JSON, 包含分镜拆解表。

#### D. 业务逻辑层 (Business Logic)
*   **VideoProcessor**:
    *   编排：下载 -> 提取音频 -> ASR -> 清理。
    *   集成于 Worker 的 `ANALYZE_NOTE` 任务中。
*   **Cost Guard**:
    *   每日 API 调用熔断机制。
    *   视频时长限制 (< 5分钟)。

## 3. 技术栈选型
*   **Media**: `fluent-ffmpeg`, `ffmpeg-static` (确保跨平台兼容性，无需系统安装)。
*   **ASR**: `openai-whisper` (API)。
*   **Orchestration**: Node.js `Worker` 线程。

## 4. 阶段规划
*   **Phase 1 (MVP)**: 实现视频下载 + 音频提取 + 基础 ASR (获取口播文案)。 [COMPLETED]
    *   基础设施: VideoDownloader, AudioExtractor, VideoProcessor.
    *   ASR: OpenAIAudioProvider.
    *   DB: Schema updated.
*   **Phase 2**: 实现关键帧抽取 + OCR (获取画面文字)。
*   **Phase 3**: 接入视觉大模型，生成完整分镜脚本。
