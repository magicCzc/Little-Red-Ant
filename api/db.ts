import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, 'app.db');
const db = new Database(dbPath);

// Initialize tables
export function initDB() {
  console.log('Initializing database...');
  
  // User Table (Single user for MVP, or multiple based on id)
  // We'll assume a single user system for now or use a fixed ID for the "current user"
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      niche TEXT, -- 专注领域
      identity_tags TEXT, -- 身份标签 (JSON)
      style TEXT, -- 账号风格
      benchmark_accounts TEXT, -- 对标账号 (JSON)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add writing_samples to users
  try {
      const columns = db.prepare("PRAGMA table_info(users)").all() as any[];
      const columnNames = columns.map(c => c.name);
      
      if (!columnNames.includes('writing_samples')) {
          console.log('Migrating users table: Adding writing_samples...');
          db.prepare("ALTER TABLE users ADD COLUMN writing_samples TEXT").run(); // JSON Array
      }

      if (!columnNames.includes('name')) {
          console.log('Migrating users table: Adding name...');
          db.prepare("ALTER TABLE users ADD COLUMN name TEXT DEFAULT '默认人设'").run();
      }

      if (!columnNames.includes('is_active')) {
          console.log('Migrating users table: Adding is_active...');
          db.prepare("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 0").run();
          // Set the latest one as active by default
          db.prepare("UPDATE users SET is_active = 1 WHERE id = (SELECT id FROM users ORDER BY id DESC LIMIT 1)").run();
      }
  } catch (e) {
      console.error('Migration users failed:', e);
  }

  // Drafts Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      tags TEXT, -- JSON array
      images TEXT, -- JSON array of image URLs
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add images to drafts
  try {
      const columns = db.prepare("PRAGMA table_info(drafts)").all() as any[];
      const columnNames = columns.map(c => c.name);
      
      if (!columnNames.includes('images')) {
          console.log('Migrating drafts table: Adding images...');
          db.prepare("ALTER TABLE drafts ADD COLUMN images TEXT").run(); // JSON Array
      }
      if (!columnNames.includes('content_type')) {
          console.log('Migrating drafts table: Adding content_type...');
          db.prepare("ALTER TABLE drafts ADD COLUMN content_type TEXT DEFAULT 'note'").run(); // 'note', 'article', 'video_script'
      }
  } catch (e) {
      console.error('Migration drafts failed:', e);
  }

  // Accounts Table (For Matrix Management)
  // Updated Schema for Separate Cookies
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT,
      avatar TEXT,
      creator_cookies TEXT, -- Creator Center Session
      main_site_cookies TEXT, -- Main Site Session
      cookies TEXT, -- Legacy: kept for migration, will be deprecated
      profile_path TEXT, 
      is_active BOOLEAN DEFAULT 0,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Migration: Add new columns if not exist
  try {
    const columns = db.prepare("PRAGMA table_info(accounts)").all() as any[];
    const columnNames = columns.map(c => c.name);
    
    if (!columnNames.includes('creator_cookies')) {
        console.log('Migrating accounts table: Adding creator_cookies...');
        db.prepare('ALTER TABLE accounts ADD COLUMN creator_cookies TEXT').run();
        // Migrate legacy cookies to creator_cookies
        db.prepare('UPDATE accounts SET creator_cookies = cookies').run();
    }
    
    if (!columnNames.includes('main_site_cookies')) {
        console.log('Migrating accounts table: Adding main_site_cookies...');
        db.prepare('ALTER TABLE accounts ADD COLUMN main_site_cookies TEXT').run();
    }
  } catch (e) {
    console.error('Migration failed:', e);
  }

  // Migration: Add status column to accounts
  try {
      const columns = db.prepare("PRAGMA table_info(accounts)").all() as any[];
      const columnNames = columns.map(c => c.name);
      
      if (!columnNames.includes('status')) {
          console.log('Migrating accounts table: Adding status...');
          db.prepare("ALTER TABLE accounts ADD COLUMN status TEXT DEFAULT 'UNKNOWN'").run(); // 'ACTIVE', 'EXPIRED', 'UNKNOWN'
      }
  } catch (e) {
      console.error('Migration accounts status failed:', e);
  }

  // Migration: Add alias to accounts
  try {
      const columns = db.prepare("PRAGMA table_info(accounts)").all() as any[];
      const columnNames = columns.map(c => c.name);
      
      if (!columnNames.includes('alias')) {
          console.log('Migrating accounts table: Adding alias...');
          db.prepare("ALTER TABLE accounts ADD COLUMN alias TEXT").run();
      }
      if (!columnNames.includes('user_id')) {
          console.log('Migrating accounts table: Adding user_id...');
          db.prepare("ALTER TABLE accounts ADD COLUMN user_id TEXT").run();
      }

      // Persona Fields
      if (!columnNames.includes('persona_desc')) {
          console.log('Migrating accounts table: Adding persona_desc...');
          db.prepare("ALTER TABLE accounts ADD COLUMN persona_desc TEXT").run();
      }
      if (!columnNames.includes('tone')) {
          console.log('Migrating accounts table: Adding tone...');
          db.prepare("ALTER TABLE accounts ADD COLUMN tone TEXT").run();
      }
      if (!columnNames.includes('writing_sample')) {
          console.log('Migrating accounts table: Adding writing_sample...');
          db.prepare("ALTER TABLE accounts ADD COLUMN writing_sample TEXT").run();
      }
      if (!columnNames.includes('niche')) {
          console.log('Migrating accounts table: Adding niche...');
          db.prepare("ALTER TABLE accounts ADD COLUMN niche TEXT").run();
      }
  } catch (e) {
      console.error('Migration accounts alias failed:', e);
  }

  // Note Statistics Table (Data Analytics)
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT, -- Xiaohongshu Note ID
      title TEXT,
      cover_image TEXT,
      views INTEGER DEFAULT 0, -- 阅读/小眼睛
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      collects INTEGER DEFAULT 0, -- 收藏
      shares INTEGER DEFAULT 0, -- 分享
      publish_date DATETIME, -- Note creation time
      account_id INTEGER,
      record_date DATETIME DEFAULT CURRENT_TIMESTAMP, -- Snapshot time
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    )
  `);

  // Migration: Add publish_date to note_stats if not exists
  try {
    const columns = db.prepare("PRAGMA table_info(note_stats)").all() as any[];
    const columnNames = columns.map(c => c.name);
    
    if (!columnNames.includes('publish_date')) {
        console.log('Migrating note_stats table: Adding publish_date...');
        db.prepare('ALTER TABLE note_stats ADD COLUMN publish_date DATETIME').run();
    }
    if (!columnNames.includes('xsec_token')) {
        console.log('Migrating note_stats table: Adding xsec_token...');
        db.prepare('ALTER TABLE note_stats ADD COLUMN xsec_token TEXT').run();
    }
  } catch (e) {
    console.error('Migration note_stats failed:', e);
  }

  // Note Statistics History Table (For Trend Charts)
  // Removed Foreign Key to avoid mismatch issues (note_id in note_stats is not UNIQUE)
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_stats_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT,
      competitor_id INTEGER, -- Added for filtering
      views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      collects INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      record_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Fix Foreign Key Mismatch for existing table
  try {
      const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='note_stats_history'").get() as { sql: string };
      if (schema && schema.sql.includes('REFERENCES note_stats(note_id)')) {
          console.log('Fixing schema for note_stats_history...');
          db.transaction(() => {
              db.exec('ALTER TABLE note_stats_history RENAME TO note_stats_history_old');
              db.exec(`
                CREATE TABLE note_stats_history (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  note_id TEXT,
                  competitor_id INTEGER,
                  views INTEGER DEFAULT 0,
                  likes INTEGER DEFAULT 0,
                  comments INTEGER DEFAULT 0,
                  collects INTEGER DEFAULT 0,
                  shares INTEGER DEFAULT 0,
                  record_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
              `);
              db.exec('INSERT INTO note_stats_history (id, note_id, views, likes, comments, collects, shares, record_time) SELECT id, note_id, views, likes, comments, collects, shares, record_time FROM note_stats_history_old');
              db.exec('DROP TABLE note_stats_history_old');
          })();
          console.log('Schema fixed.');
      }
      
      // Check if competitor_id exists (for non-recreated tables)
      const columns = db.prepare("PRAGMA table_info(note_stats_history)").all() as any[];
      if (!columns.map(c => c.name).includes('competitor_id')) {
           console.log('Migrating note_stats_history: Adding competitor_id...');
           db.prepare("ALTER TABLE note_stats_history ADD COLUMN competitor_id INTEGER").run();
      }

  } catch (e) {
      console.error('Migration failed:', e);
  }

  // Task Queue Table (Async Operations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, -- UUID
      type TEXT NOT NULL, -- 'PUBLISH', 'SCRAPE', etc.
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
      payload TEXT, -- JSON arguments
      result TEXT, -- JSON result data
      error TEXT, -- Error message
      attempts INTEGER DEFAULT 0,
      scheduled_at DATETIME, -- Scheduled execution time (null = immediate)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add scheduled_at to tasks if not exists
  try {
      const columns = db.prepare("PRAGMA table_info(tasks)").all() as any[];
      const columnNames = columns.map(c => c.name);
      
      if (!columnNames.includes('scheduled_at')) {
          console.log('Migrating tasks table: Adding scheduled_at...');
          db.prepare("ALTER TABLE tasks ADD COLUMN scheduled_at TEXT").run();
      }

      if (!columnNames.includes('attempts')) {
          console.log('Migrating tasks table: Adding attempts...');
          db.prepare("ALTER TABLE tasks ADD COLUMN attempts INTEGER DEFAULT 0").run();
      }
      if (!columnNames.includes('progress')) {
          console.log('Migrating tasks table: Adding progress...');
          db.prepare("ALTER TABLE tasks ADD COLUMN progress INTEGER DEFAULT 0").run();
      }
  } catch (e) {
      console.error('Migration tasks failed:', e);
  }

  // Settings Table (Key-Value Store for Global Config)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Trends Table (Hot Search Cache)
  db.exec(`
    CREATE TABLE IF NOT EXISTS trends (
      source TEXT PRIMARY KEY, -- 'weibo', 'baidu', 'zhihu', 'douyin'
      data TEXT, -- JSON Array
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Trending Notes Table (Rich Content for Gallery)
    db.exec(`
      CREATE TABLE IF NOT EXISTS trending_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT DEFAULT 'xiaohongshu',
        note_id TEXT UNIQUE, -- Original ID from platform, ensure uniqueness
        title TEXT,
        author_name TEXT,
        author_avatar TEXT,
        cover_url TEXT,
        note_url TEXT,
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        collects_count INTEGER DEFAULT 0,
        content TEXT, -- Full text content
        type TEXT, -- 'video' or 'image'
        tags TEXT, -- JSON Array
        analysis_result TEXT, -- JSON Object from AI
        scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add new metrics columns to trending_notes
    try {
        const columns = db.prepare("PRAGMA table_info(trending_notes)").all() as any[];
        const columnNames = columns.map(c => c.name);
        
        if (!columnNames.includes('comments_count')) {
            console.log('Migrating trending_notes table: Adding comments_count...');
            db.prepare("ALTER TABLE trending_notes ADD COLUMN comments_count INTEGER DEFAULT 0").run();
        }
        if (!columnNames.includes('collects_count')) {
            console.log('Migrating trending_notes table: Adding collects_count...');
            db.prepare("ALTER TABLE trending_notes ADD COLUMN collects_count INTEGER DEFAULT 0").run();
        }
        
        // Video Analysis Columns
        if (!columnNames.includes('transcript')) {
            console.log('Migrating trending_notes table: Adding transcript...');
            db.prepare("ALTER TABLE trending_notes ADD COLUMN transcript TEXT").run();
        }
        if (!columnNames.includes('ocr_content')) {
            console.log('Migrating trending_notes table: Adding ocr_content...');
            db.prepare("ALTER TABLE trending_notes ADD COLUMN ocr_content TEXT").run();
        }
        if (!columnNames.includes('video_meta')) {
            console.log('Migrating trending_notes table: Adding video_meta...');
            db.prepare("ALTER TABLE trending_notes ADD COLUMN video_meta TEXT").run();
        }
    } catch (e) {
        console.error('Migration trending_notes failed:', e);
    }

  // Comments Table (Interaction Management)
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, -- Xiaohongshu Comment ID
      note_id TEXT,
      user_id TEXT,
      user_nickname TEXT,
      user_avatar TEXT,
      content TEXT,
      create_time DATETIME,
      like_count INTEGER DEFAULT 0,
      sub_comment_count INTEGER DEFAULT 0,
      parent_id TEXT, -- If it is a reply
      reply_status TEXT DEFAULT 'UNREAD', -- 'UNREAD', 'READ', 'REPLIED', 'IGNORED'
      account_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    )
  `);

  // Migration: Add intent and ai_reply_suggestion to comments
  try {
      const columns = db.prepare("PRAGMA table_info(comments)").all() as any[];
      const columnNames = columns.map(c => c.name);
      
      if (!columnNames.includes('intent')) {
          console.log('Migrating comments table: Adding intent...');
          db.prepare("ALTER TABLE comments ADD COLUMN intent TEXT").run(); // 'PRAISE', 'COMPLAINT', 'INQUIRY', 'OTHER'
      }

      if (!columnNames.includes('ai_reply_suggestion')) {
          console.log('Migrating comments table: Adding ai_reply_suggestion...');
          db.prepare("ALTER TABLE comments ADD COLUMN ai_reply_suggestion TEXT").run();
      }

      if (!columnNames.includes('type')) {
          console.log('Migrating comments table: Adding type...');
          db.prepare("ALTER TABLE comments ADD COLUMN type TEXT DEFAULT 'COMMENT'").run(); // 'COMMENT', 'MENTION'
      }

      if (!columnNames.includes('root_note_id')) {
          console.log('Migrating comments table: Adding root_note_id...');
          db.prepare("ALTER TABLE comments ADD COLUMN root_note_id TEXT").run();
      }
  } catch (e) {
      console.error('Migration comments intent failed:', e);
  }

  // Competitors Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS competitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE, -- XHS User ID
      nickname TEXT,
      avatar TEXT,
      latest_notes TEXT, -- JSON Array of recent notes
      analysis_result TEXT, -- AI Analysis
      fans_count INTEGER DEFAULT 0,
      last_updated DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add columns to competitors if not exists
  try {
      const columns = db.prepare("PRAGMA table_info(competitors)").all() as any[];
      const columnNames = columns.map(c => c.name);
      
      if (!columnNames.includes('last_updated')) {
          console.log('Migrating competitors table: Adding last_updated...');
          db.prepare("ALTER TABLE competitors ADD COLUMN last_updated DATETIME").run();
      }
      if (!columnNames.includes('latest_notes')) {
          console.log('Migrating competitors table: Adding latest_notes...');
          db.prepare("ALTER TABLE competitors ADD COLUMN latest_notes TEXT").run();
      }
      if (!columnNames.includes('analysis_result')) {
          console.log('Migrating competitors table: Adding analysis_result...');
          db.prepare("ALTER TABLE competitors ADD COLUMN analysis_result TEXT").run();
      }
      if (!columnNames.includes('fans_count')) {
          console.log('Migrating competitors table: Adding fans_count...');
          db.prepare("ALTER TABLE competitors ADD COLUMN fans_count INTEGER DEFAULT 0").run();
      }
      if (!columnNames.includes('notes_count')) {
          console.log('Migrating competitors table: Adding notes_count...');
          db.prepare("ALTER TABLE competitors ADD COLUMN notes_count INTEGER DEFAULT 0").run();
      }
      if (!columnNames.includes('status')) {
          console.log('Migrating competitors table: Adding status...');
          db.prepare("ALTER TABLE competitors ADD COLUMN status TEXT DEFAULT 'active'").run(); // 'active', 'pending', 'refreshing', 'error'
      }
      if (!columnNames.includes('last_error')) {
          console.log('Migrating competitors table: Adding last_error...');
          db.prepare("ALTER TABLE competitors ADD COLUMN last_error TEXT").run();
      }
  } catch (e) {
      console.error('Migration competitors failed:', e);
  }

  // Competitor Notes Table (Normalized Data)
  db.exec(`
    CREATE TABLE IF NOT EXISTS competitor_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER NOT NULL,
      note_id TEXT, -- Optional, parsed from URL
      title TEXT,
      cover TEXT,
      url TEXT,
      likes INTEGER DEFAULT 0,
      publish_date TEXT,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
    )
  `);

  // Competitor Stats History (For Trends)
  db.exec(`
    CREATE TABLE IF NOT EXISTS competitor_stats_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_id INTEGER NOT NULL,
      fans_count INTEGER DEFAULT 0,
      notes_count INTEGER DEFAULT 0,
      likes_count INTEGER DEFAULT 0, -- Total likes
      record_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
    )
  `);

  // Admin Users Table (For System Login)
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin', -- 'admin', 'editor'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add alias and permissions to admin_users
  try {
      const columns = db.prepare("PRAGMA table_info(admin_users)").all() as any[];
      const columnNames = columns.map(c => c.name);
      
      if (!columnNames.includes('alias')) {
          console.log('Migrating admin_users table: Adding alias...');
          db.prepare("ALTER TABLE admin_users ADD COLUMN alias TEXT").run();
      }

      if (!columnNames.includes('permissions')) {
          console.log('Migrating admin_users table: Adding permissions...');
          db.prepare("ALTER TABLE admin_users ADD COLUMN permissions TEXT").run(); // JSON Array
      }
  } catch (e) {
      console.error('Migration admin_users failed:', e);
  }

  // Prompt Templates Table (For Custom AI Styles)
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL, -- e.g. "发疯文学"
      description TEXT,
      template TEXT NOT NULL, -- The system prompt content
      is_default BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Notifications Table (System Alerts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- 'SUCCESS', 'WARNING', 'ERROR', 'INFO'
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Init Default Prompts
  try {
      const count = db.prepare('SELECT COUNT(*) as c FROM prompt_templates').get() as { c: number };
      if (count.c === 0) {
          console.log('Initializing default prompt templates...');
          const defaults = [
              { name: '干货实用', desc: '结构清晰，强调价值', tpl: '你是一个知识分享博主。风格要求：逻辑严密，干货满满，分点论述，多用✅📌等图标。拒绝废话。' },
              { name: '闺蜜唠嗑', desc: '亲切自然，情感共鸣', tpl: '你是一个邻家大姐姐。风格要求：像和闺蜜聊天一样，多用“宝子们”、“咱就是说”，语气亲切，情感充沛。' },
              { name: '疯狂安利', desc: '情绪激动，强力推荐', tpl: '你是一个带货达人。风格要求：情绪非常激动，多用感叹号！！！多用“绝绝子”、“真的哭死”、“按头安利”。' },
              { name: '清冷高级', desc: '极简主义，高冷范儿', tpl: '你是一个高冷的生活美学家。风格要求：文字极简，惜字如金。多用短句。不使用浮夸的表情。' }
          ];
          const stmt = db.prepare('INSERT INTO prompt_templates (name, description, template, is_default) VALUES (?, ?, ?, 1)');
          defaults.forEach(d => stmt.run(d.name, d.desc, d.tpl));
      }
  } catch(e) { console.error('Init prompts failed', e); }

  // Video Projects Table (For Persistent Video Assembly)
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_projects (
      id TEXT PRIMARY KEY, -- UUID
      title TEXT,
      script_content TEXT, -- JSON Structure of the script
      status TEXT DEFAULT 'DRAFT', -- 'DRAFT', 'GENERATING', 'COMPLETED'
      final_video_url TEXT, -- Stitched video result
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add final_video_url to video_projects
  try {
      const columns = db.prepare("PRAGMA table_info(video_projects)").all() as any[];
      const columnNames = columns.map(c => c.name);
      
      if (!columnNames.includes('final_video_url')) {
          console.log('Migrating video_projects table: Adding final_video_url...');
          db.prepare("ALTER TABLE video_projects ADD COLUMN final_video_url TEXT").run();
      }
      if (!columnNames.includes('bgm_url')) {
          console.log('Migrating video_projects table: Adding bgm_url...');
          db.prepare("ALTER TABLE video_projects ADD COLUMN bgm_url TEXT").run();
      }
      if (!columnNames.includes('character_desc')) {
          console.log('Migrating video_projects table: Adding character_desc...');
          db.prepare("ALTER TABLE video_projects ADD COLUMN character_desc TEXT").run();
      }
      if (!columnNames.includes('tags')) {
          console.log('Migrating video_projects table: Adding tags...');
          db.prepare("ALTER TABLE video_projects ADD COLUMN tags TEXT").run(); // JSON Array
      }
      if (!columnNames.includes('description')) {
          console.log('Migrating video_projects table: Adding description...');
          db.prepare("ALTER TABLE video_projects ADD COLUMN description TEXT").run();
      }
      if (!columnNames.includes('publish_status')) {
        console.log('Migrating video_projects table: Adding publish_status...');
        db.prepare("ALTER TABLE video_projects ADD COLUMN publish_status TEXT DEFAULT 'UNPUBLISHED'").run(); // UNPUBLISHED, PUBLISHING, PUBLISHED, FAILED
      }
      if (!columnNames.includes('publish_task_id')) {
        console.log('Migrating video_projects table: Adding publish_task_id...');
        db.prepare("ALTER TABLE video_projects ADD COLUMN publish_task_id TEXT").run();
      }
      if (!columnNames.includes('note_id')) {
        console.log('Migrating video_projects table: Adding note_id...');
        db.prepare("ALTER TABLE video_projects ADD COLUMN note_id TEXT").run();
      }
  } catch (e) {
      console.error('Migration video_projects failed:', e);
  }

  // Video Scenes Table (Individual Clips)
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_scenes (
      id TEXT PRIMARY KEY, -- UUID
      project_id TEXT NOT NULL,
      scene_index INTEGER NOT NULL,
      script_visual TEXT,
      script_audio TEXT,
      status TEXT DEFAULT 'PENDING', -- 'PENDING', 'GENERATING', 'COMPLETED', 'FAILED'
      video_url TEXT,
      audio_url TEXT, -- TTS result
      duration REAL, -- Exact duration in seconds
      task_id TEXT, -- Associated generation task ID
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE
    )
  `);

  // Migration: Add audio_url and duration to video_scenes
  try {
      const columns = db.prepare("PRAGMA table_info(video_scenes)").all() as any[];
      const columnNames = columns.map(c => c.name);
      
      if (!columnNames.includes('audio_url')) {
          console.log('Migrating video_scenes table: Adding audio_url and duration...');
          db.prepare("ALTER TABLE video_scenes ADD COLUMN audio_url TEXT").run();
          db.prepare("ALTER TABLE video_scenes ADD COLUMN duration REAL").run();
      }
  } catch (e) {
      console.error('Migration video_scenes failed:', e);
  }

  // Assets Table (User Uploads)
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY, -- UUID
      user_id TEXT, -- Optional owner
      type TEXT NOT NULL, -- 'audio', 'image', 'video'
      filename TEXT NOT NULL,
      url TEXT NOT NULL,
      size INTEGER,
      mime_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('Database initialized.');
}

export default db;
