# Configuration Guide

Little Red Ant can be configured via Environment Variables (`.env`) or the UI Settings page.

## 1. Environment Variables (`.env`)

Create a `.env` file in the project root.

```env
# Server Port (Default: 3000)
PORT=3000

# Security (JWT Secret for Auth)
JWT_SECRET=your_super_secret_key_change_this

# AI Providers
# DeepSeek (For Text Generation)
DEEPSEEK_API_KEY=sk-xxxxxxxx

# Aliyun (For Image/Video Generation - Wanx/Qwen)
ALIYUN_API_KEY=sk-xxxxxxxx

# Optional: Proxy Server (For RPA)
# PROXY_SERVER=http://user:pass@host:port
```

## 2. UI Configuration

You can also configure API keys directly in the application:
1.  Navigate to **Settings** (设置) in the sidebar.
2.  Enter your API Keys.
3.  Click **Save**.
4.  *Note*: UI settings take precedence over `.env` files for API Keys.

## 3. Database

The system uses `better-sqlite3`.
*   **Location**: `data/database.sqlite`
*   **Backup**: Simply copy this file to backup your data.
*   **Reset**: Delete this file and restart the server to reset the database.

## 4. RPA Configuration

*   **Headless Mode**: By default, browsers run in headless mode (invisible).
*   **Debug Mode**: To see the browser, set `HEADLESS=false` in `.env`.
*   **User Data**: Browser profiles (cookies, local storage) are saved in `browser_data/` directory.
