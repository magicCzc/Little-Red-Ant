# API Documentation

> Base URL: `http://localhost:3000/api`

## 1. Authentication (`/auth`)

### 1.1 Login
*   **POST** `/auth/login`
*   **Body**: `{ "username": "admin", "password": "..." }`
*   **Response**: `{ "token": "jwt_token", "user": { ... } }`

### 1.2 Register
*   **POST** `/auth/register`
*   **Body**: `{ "username": "...", "password": "...", "inviteCode": "..." }`

## 2. Content Generation (`/generate`)

### 2.1 Generate Content (Text/Image)
*   **POST** `/generate/content`
*   **Body**:
    ```json
    {
      "topic": "Spring Outfit",
      "type": "note", // or "article"
      "prompt": "Custom instructions...",
      "images": ["url1", "url2"] // Context images
    }
    ```
*   **Response**: `{ "taskId": "uuid" }` (Async)

### 2.2 Generate Video
*   **POST** `/generate/video`
*   **Body**:
    ```json
    {
      "prompt": "A cat running in the field",
      "imageUrl": "optional_reference_image_url"
    }
    ```
*   **Response**: `{ "taskId": "uuid" }` (Async)

## 3. Tasks (`/tasks`)

### 3.1 Poll Task Status
*   **GET** `/tasks/:id`
*   **Response**:
    ```json
    {
      "id": "uuid",
      "status": "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
      "result": { ... }, // Available when COMPLETED
      "error": "..."     // Available when FAILED
    }
    ```

## 4. Assets (`/assets`)

### 4.1 Proxy External Image
*   **GET** `/assets/proxy?url=<external_url>`
*   **Headers**: Returns image content with correct Content-Type.
*   **Usage**: Use this endpoint in `<img>` tags to display external images that block direct access (403).

### 4.2 List Local Assets
*   **GET** `/assets`
*   **Query**: `type` (optional, e.g., 'image', 'video')

## 5. Drafts (`/drafts`)

### 5.1 Create Draft
*   **POST** `/drafts`
*   **Body**: `{ "title": "...", "content": "...", "images": ["/uploads/..."] }`

### 5.2 Update Draft
*   **PUT** `/drafts/:id`
*   **Body**: `{ "title": "...", "content": "...", "images": ["/uploads/..."] }`

## 6. Trends (`/trends`)

### 6.1 Get Trending Notes
*   **GET** `/trending_notes`
*   **Query**: `page`, `limit`, `sort`
*   **Note**: Covers are automatically localized or proxied.

## 7. Accounts (`/accounts`)

### 7.1 List Accounts
*   **GET** `/accounts`

### 7.2 Add Account
*   **POST** `/accounts`
*   **Body**: `{ "name": "...", "platform": "xiaohongshu", "cookie": "..." }`

## 8. Settings (`/settings`)

### 8.1 Get Settings
*   **GET** `/settings`

### 8.2 Update Settings
*   **POST** `/settings`
*   **Body**: `{ "ALIYUN_API_KEY": "...", "DEEPSEEK_API_KEY": "..." }`
