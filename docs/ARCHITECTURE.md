# 小红蚁 (Little Red Ant) - Technical Architecture

> Last Updated: 2026-01-28
> Version: 2.1 (Enhanced Persistence & Stability)

## 1. System Overview
Little Red Ant is a full-stack automation platform for Xiaohongshu (Little Red Book) content creation and management. It combines AI content generation, RPA (Robotic Process Automation) for publishing/scraping, and data analytics.

### Tech Stack
- **Frontend**: React, Vite, TailwindCSS
- **Backend**: Node.js, Express
- **Database**: SQLite (via `better-sqlite3`)
- **RPA Engine**: Playwright (with `puppeteer-extra-plugin-stealth`)
- **AI Integration**: Aliyun (Wanx/Wan2.6/Qwen), DeepSeek

## 2. Core Architectures

### 2.1 Task Queue System (Modular Worker)
The system uses a polling-based asynchronous task queue to handle long-running operations (publishing, scraping, generating).

*   **Entry Point**: `api/worker.ts`
*   **Mechanism**:
    1.  Worker polls `tasks` table every 2 seconds for `PENDING` tasks.
    2.  Dispatcher identifies `task.type`.
    3.  **Task Registry**: `api/services/tasks/TaskRegistry.ts` looks up the appropriate handler.
    4.  **Handler Execution**: Specific `Handler` class executes the logic.
    5.  Result is saved to DB; Status updated to `COMPLETED` or `FAILED`.

**Directory Structure**:
```
api/services/tasks/
├── TaskRegistry.ts          # Central Registry (Singleton)
├── TaskHandler.ts           # Interface Definition
└── handlers/                # Implementation Classes
    ├── PublishHandler.ts    # Publishing Logic
    ├── ScrapeStatsHandler.ts
    ├── GenerateMediaHandler.ts # Image/Video Generation (with auto-download)
    └── ...
```

### 2.2 RPA Infrastructure (Robust & Stealth)
All interactions with Xiaohongshu are handled via a hardened RPA layer designed for stability and anti-detection.

*   **Browser Management**: `api/services/rpa/BrowserService.ts`
    *   Uses **Persistent Contexts** stored in `browser_data/`.
    *   Manages cookies, stealth plugins, and browser lifecycles.
    *   Implements concurrency locks to prevent conflicts.
*   **Selector Registry**: `api/services/rpa/config/selectors.ts`
    *   **Single Source of Truth**: All CSS selectors are defined here.
    *   Categorized by module (Login, Publish, NoteDetail, etc.).
*   **RPA Utils**: `api/services/rpa/utils/RPAUtils.ts`
    *   Standardized human-like interactions (`safeClick`, `humanDelay`, `safeType`).
    *   **Context Safety**: Uses `initPage` to inject polyfills (e.g., `__name`) to prevent arrow function crashes in `page.evaluate`.

### 2.3 Asset Management System (Stability Core)
To handle the high volatility of external media links (expiration, 403 Forbidden), the system implements a dual-strategy approach.

#### Plan A: Immediate Localization (For AI Content)
*   **Target**: High-value assets created by users (AI Images, Videos).
*   **Workflow**:
    1.  Worker generates content via AI Provider (Aliyun).
    2.  `GenerateMediaHandler` **immediately downloads** the asset to local disk (`public/uploads/assets/`).
    3.  Database stores the **local path** (e.g., `/uploads/assets/uuid.png`).
*   **Benefit**: Zero data loss. Assets are permanently available even if the draft is not saved immediately.

#### Plan B: Smart Proxy (For Scraped Content)
*   **Target**: High-volume, low-value assets (Trending notes covers, competitor posts).
*   **Workflow**:
    1.  Scraper saves the **original external URL**.
    2.  Frontend renders images using the Proxy Endpoint: `/api/assets/proxy?url=<external_url>`.
    3.  Backend fetches the image with **forged Referer headers** (mimicking Xiaohongshu/Weibo) and streams it back.
*   **Benefit**: Solves 403 Forbidden errors without the performance penalty of downloading thousands of images.

### 2.4 Data & Content Flow
1.  **Content Generation**: User Request -> `ContentService` -> LLM -> `ContentGeneration.tsx`.
2.  **Publishing**: Frontend -> API (`/api/publish`) -> Task Queue -> `PublishHandler` -> `openPublishPageWithContent` -> Playwright -> Xiaohongshu.
3.  **Analytics**: Worker -> `ScrapeStatsHandler` -> Playwright -> DB -> Frontend Dashboard.

## 3. Database Schema (Key Tables)
*   `accounts`: Stores user cookies, login status, and persona settings.
*   `tasks`: Async task queue (id, type, payload, status, result).
*   `trending_notes`: Scraped note data for analysis.
*   `assets`: Tracks localized files (id, type, filename, original_url).
*   `drafts`: User content drafts (images field stores local paths).
