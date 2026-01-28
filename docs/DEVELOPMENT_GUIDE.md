# Development Guide & Standards

> Please follow these guidelines to maintain system stability and scalability.

## 1. Adding New Background Tasks

The system uses a **Task Registry** pattern. Do NOT add logic directly to `worker.ts`.

**Step-by-Step:**

1.  **Create Handler**:
    Create a new file in `api/services/tasks/handlers/` implementing the `TaskHandler` interface.
    ```typescript
    import { TaskHandler } from '../TaskHandler.js';

    export class MyNewTaskHandler implements TaskHandler {
        async handle(task: any): Promise<any> {
            // Your logic here
            return { success: true };
        }
    }
    ```

2.  **Register Handler**:
    Add your handler to `api/services/tasks/TaskRegistry.ts`.
    ```typescript
    this.register('MY_NEW_TASK_TYPE', new MyNewTaskHandler());
    ```

3.  **Trigger from API**:
    Enqueue the task in your API route.
    ```typescript
    enqueueTask('MY_NEW_TASK_TYPE', { some: 'data' });
    ```

## 2. RPA Development Guidelines

### 2.1 Selector Management
*   **NEVER** hardcode CSS selectors in logic files.
*   **ALWAYS** add them to `api/services/rpa/config/selectors.ts`.
*   Group selectors logically (e.g., `Common.Login`, `Publish.Form`).

### 2.2 Interaction Standards
*   Use `RPAUtils` for interactions to ensure human-like behavior.
    *   ✅ `await RPAUtils.safeClick(page, Selectors.Btn)`
    *   ❌ `await page.click('.btn')`
*   Always implement **Human Delays** between distinct actions.
    *   `await RPAUtils.humanDelay(page)`

### 2.3 Error Handling
*   RPA actions must be wrapped in `try-catch`.
*   Always take a **Progress Screenshot** before and after critical steps using `takeProgressScreenshot(page, taskId)`.
*   Handle "Login Expired" scenarios gracefully (throw error to trigger status update).

### 2.4 Browser Context Safety (CRITICAL)
*   **NEVER use Arrow Functions** `() => {}` inside `page.evaluate()`.
*   **ALWAYS use Function Expressions** `function() {}`.
    *   ✅ `await page.evaluate(function() { return window.scrollY; })`
    *   ❌ `await page.evaluate(() => window.scrollY)`
*   *Reason*: TypeScript compilation injects `__name` variables into arrow functions which are not accessible in the browser's execution context, causing `ReferenceError`.

## 3. Frontend Development

### 3.1 Async Task Management
*   Use the `useTaskPoller` hook for all background task operations.
    *   ✅ `const { startTask } = useTaskPoller(...)`
    *   ❌ Manually implementing `setInterval` or `while` loops in components.

### 3.2 Content Types
*   When adding new content types (e.g., Article, Video), ensure `contentType` is passed correctly in the API payload.
*   Update `ContentGeneration.tsx` to hide/show relevant UI components (e.g., hide image generator for Articles).

## 4. Database
*   Use `better-sqlite3` synchronous methods.
*   For complex writes, wrap in `db.transaction(() => { ... })`.
*   Always use Prepared Statements (`db.prepare(...)`) to prevent SQL injection.

## 5. Asset Handling Guidelines (New in v2.1)

### 5.1 Internal Assets (AI Generated)
*   **Rule**: NEVER save external temporary URLs (e.g., from Aliyun OSS) directly to the database.
*   **Action**: Use `AssetService.downloadAndLocalize(url, type)` immediately after generation.
*   **Example**:
    ```typescript
    // In GenerateMediaHandler
    const tempUrl = await Provider.generate();
    const localUrl = await AssetService.downloadAndLocalize(tempUrl, 'image');
    // Save localUrl to DB
    ```

### 5.2 External Assets (Scraped)
*   **Rule**: Do NOT download massive amounts of images from scraped lists (Trends/Spy).
*   **Action**: Use the Proxy Endpoint to display them in Frontend.
*   **Frontend**:
    ```tsx
    <img src={`/api/assets/proxy?url=${encodeURIComponent(externalUrl)}`} />
    ```

