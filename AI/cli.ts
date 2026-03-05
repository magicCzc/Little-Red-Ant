import db from '../api/db.js';
import { enqueueTask, getTask, cancelTask, completeTask, failTask } from '../api/services/queue.js';
import { TaskRegistry } from '../api/services/tasks/TaskRegistry.js';
import { VideoProjectService } from '../api/services/video/VideoProjectService.js';
import { AssetService } from '../api/services/asset/AssetService.js';
import { FileCleanupService } from '../api/services/core/FileCleanupService.js';
import { DataSanitizer } from '../api/utils/DataSanitizer.js';
import { ComplianceService } from '../api/services/core/ComplianceService.js';
import { ContentService } from '../api/services/ai/ContentService.js';
import { SettingsService } from '../api/services/SettingsService.js';
import { NotificationService } from '../api/services/NotificationService.js';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

type TaskStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

type DbTaskRow = {
  id: string;
  type: string;
  status: TaskStatus;
  payload: string;
  result?: string | null;
  error?: string | null;
  attempts: number;
  progress: number;
  scheduled_at?: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
};

type LockedTask = Omit<DbTaskRow, 'payload' | 'result'> & {
  payload: any;
  result?: any;
};

const CATEGORIES = [
  'recommend',
  'video',
  'fashion',
  'beauty',
  'food',
  'home',
  'travel',
  'tech',
  'emotion',
  'baby',
  'movie',
  'knowledge',
  'game',
  'fitness',
  'career',
  'pets',
  'photography',
  'art',
  'music',
  'books',
  'automobile',
  'wedding',
  'outdoors',
  'acg',
  'sports',
  'news'
];

type TrendRow = {
  source: string;
  data: string;
  updated_at: string;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function getFlag(args: string[], flag: string) {
  return args.includes(flag);
}

function getOption(args: string[], key: string) {
  const idx = args.indexOf(key);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function parseIntOption(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseJsonOption(value: string | undefined) {
  if (!value) return undefined;
  return JSON.parse(value);
}

function parseListOption(value: string | undefined): any[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return JSON.parse(trimmed);
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function localizeImages(images: any[]) {
  if (!images || !Array.isArray(images)) return [];

  const localized = await Promise.all(
    images.map(async (img) => {
      const url = typeof img === 'string' ? img : img?.url;
      const prompt = typeof img === 'string' ? '' : img?.prompt;

      if (!url) return img;

      let localUrl = url;
      if (typeof url === 'string' && url.startsWith('http') && !url.includes('localhost')) {
        localUrl = await AssetService.downloadAndLocalize(url, 'image');
      }

      if (typeof img === 'string') return localUrl;
      return { ...img, url: localUrl, prompt };
    })
  );

  return localized;
}

function safeIsoDate(d: Date) {
  return d.toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function resolveLocalVideoPath(videoPath: string) {
  const publicDir = path.resolve(process.cwd(), 'public');
  const normalizedPath = videoPath.replace(/\\/g, '/');

  let resolvedVideoPath = videoPath;
  if (normalizedPath.startsWith('/outputs/') || normalizedPath.startsWith('/uploads/')) {
    const relativePath = normalizedPath.substring(1);
    resolvedVideoPath = path.join(publicDir, relativePath);
  } else if (!path.isAbsolute(videoPath) && !videoPath.startsWith('http')) {
    resolvedVideoPath = path.join(publicDir, videoPath);
  }

  if (!videoPath.startsWith('http') && !fs.existsSync(resolvedVideoPath)) {
    throw new Error(`Video file not found: ${resolvedVideoPath}`);
  }

  return resolvedVideoPath;
}

function readTrendsRow(source: string) {
  const row = db.prepare('SELECT * FROM trends WHERE source = ?').get(source) as TrendRow | undefined;
  if (!row) return undefined;
  const updatedAtTs = new Date(row.updated_at + 'Z').getTime();
  const data = row.data ? JSON.parse(row.data) : [];
  return { source: row.source, updatedAtTs: Number.isFinite(updatedAtTs) ? updatedAtTs : 0, data };
}

function isFresh(updatedAtTs: number, ttlMs: number) {
  if (!updatedAtTs) return false;
  return Date.now() - updatedAtTs <= ttlMs;
}

function parseSource(args: string[]) {
  return getOption(args, '--source') || 'weibo';
}

function parseDays(args: string[]) {
  return parseIntOption(getOption(args, '--days'), 7);
}

function buildTrendReport(source: string, days: number) {
  const reportDir = path.join(process.cwd(), 'public', 'outputs', 'reports');
  ensureDir(reportDir);

  const now = new Date();
  const baseName = `trend_report_${source}_${safeIsoDate(now)}`;
  const xlsxPath = path.join(reportDir, `${baseName}.xlsx`);
  const mdPath = path.join(reportDir, `${baseName}.md`);

  const row = readTrendsRow(source);
  const trends = Array.isArray(row?.data) ? row?.data : [];

  const hotTrendsSheetRows = trends.map((t: any, idx: number) => {
    const title = t?.title ?? t?.name ?? t?.word ?? '';
    const hotValue = t?.hot_value ?? t?.hotValue ?? t?.score ?? t?.heat ?? '';
    return {
      '排名': idx + 1,
      '标题': title,
      '热度': hotValue,
      '来源': source,
      '更新时间': row?.updatedAtTs ? new Date(row.updatedAtTs).toISOString() : ''
    };
  });

  const cutoff = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();
  const notes = db
    .prepare(
      `
        SELECT
          note_id as '笔记ID',
          title as '标题',
          author_name as '作者',
          likes_count as '点赞',
          comments_count as '评论',
          collects_count as '收藏',
          type as '类型',
          tags as '标签',
          note_url as '链接',
          scraped_at as '抓取时间'
        FROM trending_notes
        WHERE platform = 'xiaohongshu'
          AND scraped_at >= ?
        ORDER BY likes_count DESC, comments_count DESC
        LIMIT 200
      `
    )
    .all(cutoff);

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(hotTrendsSheetRows.length ? hotTrendsSheetRows : [{ '提示': '暂无 trends 数据，请先抓取。' }]);
  ws1['!cols'] = [{ wch: 6 }, { wch: 40 }, { wch: 12 }, { wch: 10 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'HotTrends');

  const ws2 = XLSX.utils.json_to_sheet(notes.length ? notes : [{ '提示': `近 ${days} 天暂无 trending_notes 数据。` }]);
  ws2['!cols'] = [
    { wch: 18 },
    { wch: 40 },
    { wch: 16 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 24 },
    { wch: 50 },
    { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'TrendingNotes');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(xlsxPath, buf);

  const mdTop10 = hotTrendsSheetRows.slice(0, 10).map((r: any) => `- ${r['排名']}. ${r['标题']}（${r['热度']}）`).join('\n');
  const md = [
    `# 趋势报告`,
    ``,
    `- 来源：${source}`,
    `- trends 条数：${hotTrendsSheetRows.length}`,
    `- trending_notes（近 ${days} 天）条数：${notes.length}`,
    `- 生成时间：${now.toISOString()}`,
    ``,
    `## Top 10 热搜`,
    mdTop10 || '- 暂无',
    ``,
    `## 文件`,
    `- Excel：${xlsxPath}`,
    `- Markdown：${mdPath}`
  ].join('\n');
  fs.writeFileSync(mdPath, md, 'utf8');

  return { xlsxPath, mdPath, trendsCount: hotTrendsSheetRows.length, notesCount: notes.length };
}

function printHelp() {
  const help = [
    '',
    '用法：',
    '  npm run ai -- do <action> [options]',
    '  npm run ai -- say <一句话> [options]',
    '  npm run ai -- enqueue <type> --payload <json> [--scheduledAt <iso>] [--priority <n>]',
    '  npm run ai -- wait <taskId> [--timeoutSec <n>]',
    '  npm run ai -- cancel <taskId>',
    '',
    'actions：',
    '  gen-content                   --topic <text> [--keywords <a,b>] [--style <text>] [--contentType <note|article>]',
    '  gen-image                     --prompt <text> [--refImg <url>] [--accountId <n>]',
    '  gen-video                     --prompt <text> [--imageUrl <url>] [--duration <n>] [--model <text>] [--sceneId <n>]',
    '  publish-cycle                 --topic <text> [--keywords <a,b>] [--style <text>] [--option <n>] [--days <n>] [--scheduledAt <iso>] [--fix] [--withImages <n>]',
    '  draft-list                    [--limit <n>] [--offset <n>]',
    '  draft-save                    --title <text> --content <text> [--tags <a,b>] [--images <json|a,b>] [--contentType <note|article>] [--meta <json>]',
    '  draft-update                  --id <n> [--title <text>] [--content <text>] [--tags <a,b>] [--images <json|a,b>] [--contentType <note|article>] [--meta <json>]',
    '  draft-delete                  --id <n>',
    '  publish                       --title <text> --content <text> [--tags <a,b>] [--images <json|a,b>] [--videoPath <path>] [--auto] [--scheduledAt <iso>]',
    '  tasks-list                    [--status <PENDING|PROCESSING|COMPLETED|FAILED|CANCELLED>] [--type <TASK_TYPE>] [--limit <n>] [--offset <n>]',
    '  tasks-active',
    '  task-status                   --id <taskId>',
    '  task-cancel                   --id <taskId>',
    '  comments-scrape',
    '  comments-reply                --id <commentId> --content <text>',
    '  competitor-analyze             --url <xhs user url|userId>',
    '  compliance-check              --content <text>',
    '  compliance-fix                --content <text> [--blockedWords <json|a,b>] [--suggestions <json|a,b>]',
    '  assets-list                   [--type <audio|image|video>] [--limit <n>] [--offset <n>]',
    '  notifications-list            [--limit <n>] [--offset <n>]',
    '  notifications-unread-count',
    '  notification-read             --id <n>',
    '  notifications-read-all',
    '  prompts-list',
    '  prompts-add                   --name <text> --template <text> [--description <text>]',
    '  prompts-delete                --id <n>',
    '  optimizations-list            [--status <PENDING|APPLIED|REJECTED>]',
    '  optimizations-apply           --id <n>',
    '  optimizations-reject          --id <n>',
    '  settings-list',
    '  settings-get                  --key <text>',
    '  settings-set                  --key <text> --value <text> [--description <text>]',
    '  selectors-list                [--platform <text>] [--category <text>] [--key <text>]',
    '  selectors-export              [--file <path>]',
    '  selectors-import              --file <path>',
    '  selectors-reload',
    '  video-projects-list',
    '  video-project-get             --id <uuid>',
    '  video-project-stitch          --id <uuid>',
    '  daily-cycle                   --source <weibo|...> [--days <n>] [--categories <a,b>] [--topN <n>] [--refresh]',
    '  scrape-trends                 --source <weibo|baidu|douyin|zhihu...>',
    '  scrape-trending-notes         --category <recommend|fashion|...>',
    '  full-scrape-trending-notes    (全类目入队)',
    '  refresh-analytics',
    '  check-health',
    '  analyze-note                  --noteId <id>',
    '  report-trends                 --source <weibo|...> [--days <n>] [--refresh]',
    '',
    'say options：',
    '  --json         只输出 JSON（便于脚本消费）',
    '',
    'do options：',
    '  --dry-run        仅输出将执行的动作（不落库/不发布）',
    '  --yes            确认执行高风险动作（发布/自动回复等）',
    '  --enqueue-only    只入队，不处理，不等待',
    '  --no-process      不启动本地处理器（依赖已有 worker）',
    '  --no-wait         不等待完成（但仍可处理）',
    '  --timeoutSec <n>  默认 1800（30 分钟）',
    ''
  ].join('\n');
  console.log(help);
}

function normalizeText(input: string) {
  return input
    .trim()
    .replace(/[，。；、]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function extractTimeoutSec(normalized: string) {
  const m = normalized.match(/(?:timeout|超时)\s*(\d{1,6})\s*(?:s|sec|秒|m|分钟)?/i);
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (normalized.includes('分钟') || normalized.includes(' m') || normalized.includes('min')) return n * 60;
  return n;
}

function parseSay(normalized: string) {
  const enqueueOnly = normalized.includes('只入队') || normalized.includes('只排队') || normalized.includes('enqueue-only');
  const noProcess = normalized.includes('不处理') || normalized.includes('no-process');
  const noWait = normalized.includes('不等待') || normalized.includes('no-wait');
  const timeoutSec = extractTimeoutSec(normalized);
  const yes = normalized.includes('--yes') || normalized.includes('确认') || normalized.includes('执行') || normalized.includes('立即');
  const dryRun = normalized.includes('--dry-run') || normalized.includes('预览') || normalized.includes('不执行');

  const sayArgs: string[] = [];
  const flags = { enqueueOnly, noProcess, noWait, timeoutSec, yes, dryRun };

  const isTrends = normalized.includes('热搜') || normalized.includes('趋势') || normalized.includes('trends');
  const isReport =
    normalized.includes('趋势报告') ||
    normalized.includes('热搜报告') ||
    normalized.includes('导出趋势') ||
    normalized.includes('export trends') ||
    normalized.includes('report');
  const isXhsNotes =
    normalized.includes('小红书') ||
    normalized.includes('xhs') ||
    normalized.includes('笔记') ||
    normalized.includes('trending notes');
  const isAnalytics = normalized.includes('看板') || normalized.includes('统计') || normalized.includes('analytics');
  const isHealth = normalized.includes('体检') || normalized.includes('健康检查') || normalized.includes('check health');
  const isAnalyze = normalized.includes('分析') || normalized.includes('analyze');
  const isTaskList = normalized.includes('任务列表') || normalized.includes('任务清单') || normalized.includes('tasks list');
  const isTaskActive = normalized.includes('进行中任务') || normalized.includes('活跃任务') || normalized.includes('tasks active');
  const isTaskCancel = normalized.includes('取消任务') || normalized.includes('停止任务') || normalized.includes('cancel task');
  const isTaskStatus = normalized.includes('任务状态') || normalized.includes('查询任务') || normalized.includes('task status');
  const isDraftList = normalized.includes('草稿列表') || normalized.includes('draft list');
  const isDraftDelete = normalized.includes('删除草稿') || normalized.includes('draft delete');
  const isPublish = normalized.includes('发布') || normalized.includes('publish');
  const isGenContent = (normalized.includes('生成') || normalized.includes('写')) && (normalized.includes('文案') || normalized.includes('内容'));
  const isGenImage = normalized.includes('生成图片') || normalized.includes('配图') || normalized.includes('gen image');
  const isGenVideo = normalized.includes('生成视频') || normalized.includes('gen video');
  const isCommentsScrape = normalized.includes('抓评论') || normalized.includes('评论抓取') || normalized.includes('comments scrape');
  const isCommentsReply = normalized.includes('回复评论') || normalized.includes('评论回复') || normalized.includes('comments reply');
  const isCompetitor = normalized.includes('竞品') || normalized.includes('对标') || normalized.includes('competitor');
  const isComplianceCheck = normalized.includes('合规检测') || normalized.includes('合规检查') || normalized.includes('compliance check');
  const isComplianceFix = normalized.includes('合规改写') || normalized.includes('合规修复') || normalized.includes('compliance fix');
  const isDailyCycle = normalized.includes('日报') || normalized.includes('每日复盘') || normalized.includes('daily cycle');
  const isPublishCycle = normalized.includes('发布流程') || normalized.includes('一键发布') || normalized.includes('publish cycle');
  const isSelectorsExport = normalized.includes('导出selector') || normalized.includes('导出 selectors') || normalized.includes('selectors export');
  const isSelectorsImport = normalized.includes('导入selector') || normalized.includes('导入 selectors') || normalized.includes('selectors import');
  const isSelectorsList = normalized.includes('selectors 列表') || normalized.includes('selector 列表') || normalized.includes('selectors list');
  const isSelectorsReload = normalized.includes('重载selector') || normalized.includes('重载 selectors') || normalized.includes('selectors reload');
  const isSettingsGet = normalized.includes('查看设置') || normalized.includes('settings get');
  const isSettingsSet = normalized.includes('修改设置') || normalized.includes('settings set');
  const isPromptsList = normalized.includes('模板列表') || normalized.includes('prompts list');
  const isNotifications = normalized.includes('通知') || normalized.includes('notifications');

  const sources: Array<{ keys: string[]; value: string }> = [
    { keys: ['weibo', '微博'], value: 'weibo' },
    { keys: ['baidu', '百度'], value: 'baidu' },
    { keys: ['douyin', '抖音'], value: 'douyin' },
    { keys: ['zhihu', '知乎'], value: 'zhihu' }
  ];

  const categories = new Set(CATEGORIES);

  const findSource = () => {
    for (const s of sources) {
      if (s.keys.some((k) => normalized.includes(k))) return s.value;
    }
    return undefined;
  };

  const findCategory = () => {
    for (const c of categories) {
      if (normalized.includes(c)) return c;
    }
    const map: Array<{ keys: string[]; value: string }> = [
      { keys: ['推荐'], value: 'recommend' },
      { keys: ['视频'], value: 'video' },
      { keys: ['时尚', '穿搭'], value: 'fashion' },
      { keys: ['美妆', '护肤'], value: 'beauty' },
      { keys: ['美食', '吃'], value: 'food' },
      { keys: ['家居', '家装'], value: 'home' },
      { keys: ['旅行', '旅游'], value: 'travel' },
      { keys: ['科技', '数码'], value: 'tech' },
      { keys: ['情感'], value: 'emotion' },
      { keys: ['母婴', '宝宝'], value: 'baby' },
      { keys: ['影视', '电影'], value: 'movie' },
      { keys: ['知识', '科普'], value: 'knowledge' },
      { keys: ['游戏'], value: 'game' },
      { keys: ['健身', '运动'], value: 'fitness' },
      { keys: ['职场', '工作'], value: 'career' },
      { keys: ['宠物'], value: 'pets' },
      { keys: ['摄影'], value: 'photography' },
      { keys: ['艺术'], value: 'art' },
      { keys: ['音乐'], value: 'music' },
      { keys: ['读书', '书'], value: 'books' },
      { keys: ['汽车'], value: 'automobile' },
      { keys: ['婚礼', '结婚'], value: 'wedding' },
      { keys: ['户外'], value: 'outdoors' },
      { keys: ['二次元', 'acg'], value: 'acg' },
      { keys: ['体育'], value: 'sports' },
      { keys: ['新闻'], value: 'news' }
    ];
    for (const item of map) {
      if (item.keys.some((k) => normalized.includes(k))) return item.value;
    }
    return undefined;
  };

  if (isAnalyze) {
    const m = normalized.match(/(?:noteid|note-id|笔记id|id)\s*[:：]?\s*([a-z0-9_-]+)/i);
    const noteId = m?.[1];
    if (noteId) {
      sayArgs.push('--noteId', noteId);
      return { action: 'analyze-note', args: sayArgs, flags };
    }
  }

  if (isTaskCancel) {
    const m = normalized.match(/(?:taskid|task-id|任务id|id)\s*[:：]?\s*([a-z0-9_-]+)/i);
    const id = m?.[1];
    if (!id) throw new Error('取消任务需要提供 taskId，例如：取消任务 id:xxxx');
    sayArgs.push('--id', id);
    return { action: 'task-cancel', args: sayArgs, flags };
  }

  if (isTaskStatus) {
    const m = normalized.match(/(?:taskid|task-id|任务id|id)\s*[:：]?\s*([a-z0-9_-]+)/i);
    const id = m?.[1];
    if (!id) throw new Error('查询任务需要提供 taskId，例如：任务状态 id:xxxx');
    sayArgs.push('--id', id);
    return { action: 'task-status', args: sayArgs, flags };
  }

  if (isTaskActive) return { action: 'tasks-active', args: sayArgs, flags };
  if (isTaskList) return { action: 'tasks-list', args: sayArgs, flags };
  if (isDraftList) return { action: 'draft-list', args: sayArgs, flags };

  if (isDraftDelete) {
    const m = normalized.match(/(?:draftid|draft-id|草稿id|id)\s*[:：]?\s*(\d{1,12})/i);
    const id = m?.[1];
    if (!id) throw new Error('删除草稿需要提供 id，例如：删除草稿 id:12');
    sayArgs.push('--id', id);
    return { action: 'draft-delete', args: sayArgs, flags };
  }

  if (isAnalytics) return { action: 'refresh-analytics', args: sayArgs, flags };
  if (isHealth) return { action: 'check-health', args: sayArgs, flags };

  if (isCommentsReply) {
    const m = normalized.match(/(?:commentid|comment-id|评论id|id)\s*[:：]?\s*([a-z0-9_-]+)/i);
    const id = m?.[1];
    const contentMatch = normalized.match(/(?:内容|content)\s*[:：]?\s*(.+)$/i);
    const content = contentMatch?.[1]?.trim();
    if (!id || !content) throw new Error('回复评论需要 commentId 与 内容，例如：回复评论 id:123 内容:谢谢支持');
    sayArgs.push('--id', id, '--content', content);
    return { action: 'comments-reply', args: sayArgs, flags };
  }

  if (normalized.includes('评论列表') || normalized.includes('comments list')) {
    return { action: 'comments-list', args: sayArgs, flags };
  }

  if (isCommentsScrape) return { action: 'comments-scrape', args: sayArgs, flags };

  if (isCompetitor) {
    const m = normalized.match(/(?:url|链接|主页|user)\s*[:：]?\s*([a-z0-9_:/.-]+)/i);
    const url = m?.[1];
    if (url) {
      sayArgs.push('--url', url);
      return { action: 'competitor-analyze', args: sayArgs, flags };
    }
    if (normalized.includes('列表') || normalized.includes('list')) {
      return { action: 'competitor-list', args: sayArgs, flags };
    }
    throw new Error('竞品分析需要提供 url，或使用“竞品列表”。');
  }

  if (isComplianceFix) {
    const contentMatch = normalized.match(/(?:内容|content)\s*[:：]?\s*(.+)$/i);
    const content = contentMatch?.[1]?.trim();
    if (!content) throw new Error('合规改写需要提供内容，例如：合规改写 内容:xxx');
    sayArgs.push('--content', content);
    return { action: 'compliance-fix', args: sayArgs, flags };
  }

  if (isComplianceCheck) {
    const contentMatch = normalized.match(/(?:内容|content)\s*[:：]?\s*(.+)$/i);
    const content = contentMatch?.[1]?.trim();
    if (!content) throw new Error('合规检测需要提供内容，例如：合规检测 内容:xxx');
    sayArgs.push('--content', content);
    return { action: 'compliance-check', args: sayArgs, flags };
  }

  if (isPublishCycle) {
    const topicMatch = normalized.match(/(?:主题|topic)\s*[:：]?\s*(.+)$/i);
    const topic = topicMatch?.[1]?.trim();
    if (topic) sayArgs.push('--topic', topic);
    if (normalized.includes('修复') || normalized.includes('fix')) sayArgs.push('--fix');
    if (normalized.includes('定时') || normalized.includes('预约') || normalized.includes('scheduledat')) {
      const scheduledAtMatch = normalized.match(/(?:scheduledat|定时|预约)\s*[:：]?\s*([0-9t:.-]+z?)/i);
      if (scheduledAtMatch?.[1]) sayArgs.push('--scheduledAt', scheduledAtMatch[1]);
    }
    return { action: 'publish-cycle', args: sayArgs, flags };
  }

  if (isSelectorsReload) return { action: 'selectors-reload', args: sayArgs, flags };
  if (isSelectorsList) return { action: 'selectors-list', args: sayArgs, flags };
  if (isSelectorsExport) return { action: 'selectors-export', args: sayArgs, flags };
  if (isSelectorsImport) {
    const m = normalized.match(/(?:file|文件)\s*[:：]?\s*([a-z0-9_:/\\\\.-]+)/i);
    const file = m?.[1];
    if (file) sayArgs.push('--file', file);
    return { action: 'selectors-import', args: sayArgs, flags };
  }

  if (isSettingsGet) {
    const m = normalized.match(/(?:key|键)\s*[:：]?\s*([a-z0-9_.-]+)/i);
    const key = m?.[1];
    if (key) sayArgs.push('--key', key);
    return { action: 'settings-get', args: sayArgs, flags };
  }

  if (isSettingsSet) {
    const km = normalized.match(/(?:key|键)\s*[:：]?\s*([a-z0-9_.-]+)/i);
    const vm = normalized.match(/(?:value|值)\s*[:：]?\s*(.+)$/i);
    if (km?.[1]) sayArgs.push('--key', km[1]);
    if (vm?.[1]) sayArgs.push('--value', vm[1].trim());
    return { action: 'settings-set', args: sayArgs, flags };
  }

  if (isPromptsList) return { action: 'prompts-list', args: sayArgs, flags };
  if (isNotifications) return { action: 'notifications-list', args: sayArgs, flags };

  if (isDailyCycle) {
    const source = findSource() || 'weibo';
    const daysMatch = normalized.match(/(?:最近|近)?\s*(\d{1,3})\s*(?:天|days?)/i);
    const days = daysMatch ? Number.parseInt(daysMatch[1], 10) : undefined;
    sayArgs.push('--source', source);
    if (days && Number.isFinite(days)) sayArgs.push('--days', String(days));
    if (normalized.includes('刷新') || normalized.includes('最新') || normalized.includes('refresh')) sayArgs.push('--refresh');
    return { action: 'daily-cycle', args: sayArgs, flags };
  }

  if (isReport) {
    const source = findSource() || 'weibo';
    const daysMatch = normalized.match(/(?:最近|近)?\s*(\d{1,3})\s*(?:天|days?)/i);
    const days = daysMatch ? Number.parseInt(daysMatch[1], 10) : undefined;
    sayArgs.push('--source', source);
    if (days && Number.isFinite(days)) sayArgs.push('--days', String(days));
    if (normalized.includes('刷新') || normalized.includes('最新') || normalized.includes('refresh')) sayArgs.push('--refresh');
    return { action: 'report-trends', args: sayArgs, flags };
  }

  if (isPublish) {
    const draftMatch = normalized.match(/(?:draftid|draft-id|草稿id|草稿)\s*[:：]?\s*(\d{1,12})/i);
    const scheduledAtMatch = normalized.match(/(?:scheduledat|schedule|定时|预约)\s*[:：]?\s*([0-9t:.-]+z?)/i);
    const draftId = draftMatch?.[1];
    const scheduledAt = scheduledAtMatch?.[1];
    if (draftId) sayArgs.push('--draftId', draftId);
    if (scheduledAt) sayArgs.push('--scheduledAt', scheduledAt);
    if (normalized.includes('自动') || normalized.includes('autopublish')) sayArgs.push('--auto');
    return { action: 'publish', args: sayArgs, flags };
  }

  if (isGenVideo) {
    const prompt = normalized.replace(/生成视频|gen video/gi, '').trim();
    if (prompt) sayArgs.push('--prompt', prompt);
    return { action: 'gen-video', args: sayArgs, flags };
  }

  if (isGenImage) {
    const prompt = normalized.replace(/生成图片|配图|gen image/gi, '').trim();
    if (prompt) sayArgs.push('--prompt', prompt);
    return { action: 'gen-image', args: sayArgs, flags };
  }

  if (isGenContent) {
    const m = normalized.match(/(?:主题|topic)\s*[:：]?\s*(.+)$/i);
    const topic = m?.[1]?.trim();
    if (topic) sayArgs.push('--topic', topic);
    return { action: 'gen-content', args: sayArgs, flags };
  }

  if (normalized.includes('全类目') || normalized.includes('全分类') || normalized.includes('full scrape')) {
    return { action: 'full-scrape-trending-notes', args: sayArgs, flags };
  }

  if (isXhsNotes) {
    const category = findCategory() || 'recommend';
    sayArgs.push('--category', category);
    return { action: 'scrape-trending-notes', args: sayArgs, flags };
  }

  if (isTrends) {
    const source = findSource() || 'weibo';
    sayArgs.push('--source', source);
    return { action: 'scrape-trends', args: sayArgs, flags };
  }

  const fallbackSource = findSource();
  if (fallbackSource) {
    sayArgs.push('--source', fallbackSource);
    return { action: 'scrape-trends', args: sayArgs, flags };
  }

  throw new Error('无法解析这句指令。试试：抓取热搜 weibo / 抓小红书 时尚 类目 / 刷新看板 / 账号体检 / 分析 笔记id:xxx');
}

function areAllDone(taskIds: string[]) {
  for (const id of taskIds) {
    const t = getTask(id);
    if (!t) return false;
    if (t.status !== 'COMPLETED' && t.status !== 'FAILED') return false;
  }
  return true;
}

function lockNextTargetTask(targetIds: string[]): LockedTask | undefined {
  const ids = targetIds.slice().filter(Boolean);
  if (ids.length === 0) return undefined;

  let locked: LockedTask | undefined;

  const transaction = db.transaction(() => {
    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');
    const row = db
      .prepare(
        `
          SELECT * FROM tasks
          WHERE id IN (${placeholders})
            AND status = 'PENDING'
            AND (scheduled_at IS NULL OR scheduled_at <= ?)
          ORDER BY priority DESC, created_at ASC
          LIMIT 1
        `
      )
      .get(...ids, now) as DbTaskRow | undefined;

    if (!row) return;

    db.prepare(
      `
        UPDATE tasks
        SET status = 'PROCESSING', updated_at = ?
        WHERE id = ?
      `
    ).run(new Date().toISOString(), row.id);

    locked = {
      ...row,
      status: 'PROCESSING',
      payload: JSON.parse(row.payload),
      result: row.result ? JSON.parse(row.result) : undefined
    };
  });

  (transaction as any).immediate();
  return locked;
}

async function processTargetTasks(taskIds: string[], timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (areAllDone(taskIds)) return;

    const task = lockNextTargetTask(taskIds);
    if (!task) {
      await delay(300);
      continue;
    }

    try {
      const handler = TaskRegistry.getHandler(task.type);
      const result = await handler.handle(task as any);
      completeTask(task.id, result);
    } catch (error: any) {
      failTask(task.id, error?.message || 'Unknown error');

      if (task.type === 'PUBLISH') {
        try {
          const payload = task.payload;
          if (payload?.projectId) {
            VideoProjectService.updateProjectStatus(payload.projectId, 'COMPLETED', undefined, 'FAILED');
          }
        } catch {}
      }
    }
  }

  throw new Error(`Timeout after ${Math.round(timeoutMs / 1000)}s`);
}

async function waitForTasks(taskIds: string[], timeoutMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (areAllDone(taskIds)) return;
    await delay(500);
  }
  throw new Error(`Timeout after ${Math.round(timeoutMs / 1000)}s`);
}

function getTaskPayloads(action: string, args: string[]) {
  switch (action) {
    case 'gen-content': {
      const topic = getOption(args, '--topic');
      if (!topic) throw new Error('Missing --topic');
      const keywords = parseListOption(getOption(args, '--keywords'));
      const style = getOption(args, '--style');
      const contentType = getOption(args, '--contentType');
      const accountIdRaw = getOption(args, '--accountId');
      const accountId = accountIdRaw ? Number.parseInt(accountIdRaw, 10) : undefined;
      return [
        {
          type: 'GENERATE_CONTENT',
          payload: {
            topic,
            keywords,
            style,
            contentType,
            accountId
          }
        }
      ];
    }
    case 'gen-image': {
      const prompt = getOption(args, '--prompt');
      if (!prompt) throw new Error('Missing --prompt');
      const refImg = getOption(args, '--refImg') || getOption(args, '--ref_img');
      const accountIdRaw = getOption(args, '--accountId');
      const accountId = accountIdRaw ? Number.parseInt(accountIdRaw, 10) : undefined;
      return [{ type: 'GENERATE_IMAGE', payload: { prompt, ref_img: refImg, accountId } }];
    }
    case 'gen-video': {
      const prompt = getOption(args, '--prompt');
      if (!prompt) throw new Error('Missing --prompt');
      const imageUrl = getOption(args, '--imageUrl');
      const durationRaw = getOption(args, '--duration');
      const duration = durationRaw ? Number.parseInt(durationRaw, 10) : undefined;
      const model = getOption(args, '--model');
      const sceneIdRaw = getOption(args, '--sceneId');
      const sceneId = sceneIdRaw ? Number.parseInt(sceneIdRaw, 10) : undefined;
      const accountIdRaw = getOption(args, '--accountId');
      const accountId = accountIdRaw ? Number.parseInt(accountIdRaw, 10) : undefined;
      return [
        { type: 'GENERATE_VIDEO', payload: { prompt, imageUrl, duration, model, sceneId, accountId } }
      ];
    }
    case 'scrape-trends': {
      const source = getOption(args, '--source') || 'weibo';
      return [{ type: 'SCRAPE_TRENDS', payload: { source } }];
    }
    case 'scrape-trending-notes': {
      const category = getOption(args, '--category') || 'recommend';
      return [
        { type: 'SCRAPE_TRENDS', payload: { source: 'xiaohongshu', type: 'notes', category } }
      ];
    }
    case 'full-scrape-trending-notes': {
      return CATEGORIES.map((category) => ({
        type: 'SCRAPE_TRENDS',
        payload: { source: 'xiaohongshu', type: 'notes', category }
      }));
    }
    case 'refresh-analytics': {
      return [{ type: 'SCRAPE_STATS', payload: {} }];
    }
    case 'check-health': {
      return [{ type: 'CHECK_HEALTH', payload: {} }];
    }
    case 'analyze-note': {
      const noteId = getOption(args, '--noteId');
      if (!noteId) throw new Error('Missing --noteId');
      return [{ type: 'ANALYZE_NOTE', payload: { noteId } }];
    }
    case 'report-trends': {
      const source = parseSource(args);
      const shouldRefresh = args.includes('--refresh') || args.includes('--force');
      const row = readTrendsRow(source);
      if (!row || shouldRefresh) {
        return [{ type: 'SCRAPE_TRENDS', payload: { source } }];
      }
      return [];
    }
    case 'comments-scrape': {
      return [{ type: 'SCRAPE_COMMENTS', payload: {} }];
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function runLocalAction(
  action: string,
  actionArgs: string[],
  opts?: { yes?: boolean; dryRun?: boolean; timeoutSec?: number }
) {
  switch (action) {
    case 'assets-list': {
      const type = getOption(actionArgs, '--type');
      const limit = parseIntOption(getOption(actionArgs, '--limit'), 50);
      const offset = parseIntOption(getOption(actionArgs, '--offset'), 0);
      const where: string[] = [];
      const params: any[] = [];
      if (type) {
        where.push('type = ?');
        params.push(type);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const rows = db
        .prepare(`SELECT * FROM assets ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);
      return { assets: rows };
    }
    case 'notifications-list': {
      const limit = parseIntOption(getOption(actionArgs, '--limit'), 20);
      const offset = parseIntOption(getOption(actionArgs, '--offset'), 0);
      return { notifications: NotificationService.getNotifications(limit, offset) };
    }
    case 'notifications-unread-count': {
      return { count: NotificationService.getUnreadCount() };
    }
    case 'notification-read': {
      const idRaw = getOption(actionArgs, '--id');
      if (!idRaw) throw new Error('Missing --id');
      const id = Number.parseInt(idRaw, 10);
      NotificationService.markAsRead(id);
      return { success: true, id };
    }
    case 'notifications-read-all': {
      NotificationService.markAllAsRead();
      return { success: true };
    }
    case 'prompts-list': {
      const rows = db.prepare('SELECT * FROM prompt_templates ORDER BY is_default DESC, created_at DESC').all();
      return { prompts: rows };
    }
    case 'prompts-add': {
      const name = getOption(actionArgs, '--name');
      const template = getOption(actionArgs, '--template');
      const description = getOption(actionArgs, '--description') || '';
      if (!name) throw new Error('Missing --name');
      if (!template) throw new Error('Missing --template');
      const info = db.prepare('INSERT INTO prompt_templates (name, description, template) VALUES (?, ?, ?)').run(name, description, template);
      return { success: true, id: info.lastInsertRowid };
    }
    case 'prompts-delete': {
      const idRaw = getOption(actionArgs, '--id');
      if (!idRaw) throw new Error('Missing --id');
      const tpl = db.prepare('SELECT is_default FROM prompt_templates WHERE id = ?').get(idRaw) as any;
      if (tpl && tpl.is_default) throw new Error('Cannot delete default templates');
      db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(idRaw);
      return { success: true, id: Number.parseInt(idRaw, 10) };
    }
    case 'optimizations-list': {
      const status = getOption(actionArgs, '--status');
      let query = 'SELECT * FROM prompt_optimizations';
      const params: any[] = [];
      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }
      query += ' ORDER BY created_at DESC';
      const data = db.prepare(query).all(...params);
      const formatted = data.map((item: any) => ({
        ...item,
        performance_metrics: item.performance_metrics ? JSON.parse(item.performance_metrics) : null
      }));
      return { optimizations: formatted };
    }
    case 'optimizations-apply': {
      const id = getOption(actionArgs, '--id');
      if (!id) throw new Error('Missing --id');
      const opt = db.prepare('SELECT * FROM prompt_optimizations WHERE id = ?').get(id) as any;
      if (!opt) throw new Error('Optimization not found');
      if (opt.status === 'APPLIED') throw new Error('Already applied');

      const isAllowed = opts?.yes === true;
      const shouldDryRun = opts?.dryRun === true || !isAllowed;
      if (shouldDryRun) return { dryRun: true, id, hint: '该操作会修改 prompt_templates，追加 --yes 才会执行。' };

      db.transaction(() => {
        if (opt.original_template_id) {
          db.prepare('UPDATE prompt_templates SET template = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
            opt.optimized_template,
            opt.original_template_id
          );
        } else {
          const existing = db.prepare('SELECT id FROM prompt_templates WHERE name = ?').get(opt.target_style) as any;
          if (existing) {
            db.prepare('UPDATE prompt_templates SET template = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
              opt.optimized_template,
              existing.id
            );
          } else {
            db.prepare('INSERT INTO prompt_templates (name, description, template, is_default, version) VALUES (?, ?, ?, 0, 1)').run(
              opt.target_style,
              `AI Optimized for ${opt.target_style}`,
              opt.optimized_template
            );
          }
        }
        db.prepare("UPDATE prompt_optimizations SET status = 'APPLIED' WHERE id = ?").run(id);
      })();

      return { success: true, id: Number.parseInt(id, 10) };
    }
    case 'optimizations-reject': {
      const id = getOption(actionArgs, '--id');
      if (!id) throw new Error('Missing --id');

      const isAllowed = opts?.yes === true;
      const shouldDryRun = opts?.dryRun === true || !isAllowed;
      if (shouldDryRun) return { dryRun: true, id, hint: '该操作会更新优化状态为 REJECTED，追加 --yes 才会执行。' };

      db.prepare("UPDATE prompt_optimizations SET status = 'REJECTED' WHERE id = ?").run(id);
      return { success: true, id: Number.parseInt(id, 10) };
    }
    case 'settings-list': {
      const all = await SettingsService.getAll();
      return { settings: all };
    }
    case 'settings-get': {
      const key = getOption(actionArgs, '--key');
      if (!key) throw new Error('Missing --key');
      const value = await SettingsService.get(key);
      return { key, value };
    }
    case 'settings-set': {
      const key = getOption(actionArgs, '--key');
      const value = getOption(actionArgs, '--value');
      const description = getOption(actionArgs, '--description');
      if (!key) throw new Error('Missing --key');
      if (value === undefined) throw new Error('Missing --value');

      const isAllowed = opts?.yes === true;
      const shouldDryRun = opts?.dryRun === true || !isAllowed;
      if (shouldDryRun) return { dryRun: true, key, value, hint: '修改 settings 属于高风险动作，追加 --yes 才会写入。' };

      await SettingsService.set(key, value, description);
      return { success: true, key, value };
    }
    case 'selectors-list': {
      const platform = getOption(actionArgs, '--platform') || 'xiaohongshu';
      const category = getOption(actionArgs, '--category');
      const key = getOption(actionArgs, '--key');
      const where: string[] = ['platform = ?'];
      const params: any[] = [platform];
      if (category) {
        where.push('category LIKE ?');
        params.push(`${category}%`);
      }
      if (key) {
        where.push('key = ?');
        params.push(key);
      }
      const rows = db
        .prepare(`SELECT * FROM rpa_selectors WHERE ${where.join(' AND ')} ORDER BY category ASC, key ASC`)
        .all(...params);
      return { selectors: rows };
    }
    case 'selectors-export': {
      const file = getOption(actionArgs, '--file');
      const outDir = path.join(process.cwd(), 'public', 'outputs', 'selectors');
      ensureDir(outDir);
      const outFile = file ? path.resolve(file) : path.join(outDir, `rpa_selectors_${safeIsoDate(new Date())}.json`);
      const rows = db.prepare('SELECT * FROM rpa_selectors ORDER BY platform, category, key').all();
      fs.writeFileSync(outFile, JSON.stringify(rows, null, 2), 'utf8');
      return { success: true, file: outFile, count: rows.length };
    }
    case 'selectors-import': {
      const file = getOption(actionArgs, '--file');
      if (!file) throw new Error('Missing --file');
      const content = fs.readFileSync(path.resolve(file), 'utf8');
      const rows = JSON.parse(content);
      if (!Array.isArray(rows)) throw new Error('Invalid selectors file: expected array');

      const isAllowed = opts?.yes === true;
      const shouldDryRun = opts?.dryRun === true || !isAllowed;
      if (shouldDryRun) return { dryRun: true, file, count: rows.length, hint: '导入会 upsert rpa_selectors，追加 --yes 才会执行。' };

      const stmt = db.prepare(
        `
          INSERT INTO rpa_selectors (platform, category, key, selector, description)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(platform, category, key) DO UPDATE SET
            selector = excluded.selector,
            description = excluded.description,
            updated_at = CURRENT_TIMESTAMP
        `
      );
      db.transaction(() => {
        for (const r of rows) {
          if (!r?.category || !r?.key || !r?.selector) continue;
          stmt.run(r.platform || 'xiaohongshu', r.category, r.key, r.selector, r.description || '');
        }
      })();
      return { success: true, file, count: rows.length };
    }
    case 'selectors-reload': {
      const mod = await import('../api/services/rpa/config/selectors.js');
      if (typeof mod.updateSelectorsFromDB === 'function') {
        mod.updateSelectorsFromDB();
      }
      return { success: true };
    }
    case 'video-projects-list': {
      const rows = VideoProjectService.listProjects().map((p: any) => {
        let scriptContent: any = null;
        try {
          scriptContent = p.script_content ? JSON.parse(p.script_content) : null;
        } catch {
          scriptContent = null;
        }

        let tags: any[] = [];
        try {
          tags = p.tags ? JSON.parse(p.tags) : [];
        } catch {
          tags = [];
        }

        return { ...p, script_content: scriptContent, tags };
      });
      return { projects: rows };
    }
    case 'video-project-get': {
      const id = getOption(actionArgs, '--id');
      if (!id) throw new Error('Missing --id');
      const project = VideoProjectService.getProject(id);
      return { project };
    }
    case 'video-project-stitch': {
      const id = getOption(actionArgs, '--id');
      if (!id) throw new Error('Missing --id');
      const project = VideoProjectService.getProject(id);
      if (!project) throw new Error('Project not found');
      const taskId = enqueueTask('VIDEO_STITCH', { projectId: id, scenes: project.scenes, bgmUrl: project.bgm_url });
      return { success: true, taskId };
    }
    case 'publish-cycle': {
      const timeoutSec = opts?.timeoutSec ?? 1800;
      const timeoutMs = timeoutSec * 1000;

      const topic = getOption(actionArgs, '--topic');
      if (!topic) throw new Error('Missing --topic');
      const keywords = parseListOption(getOption(actionArgs, '--keywords'));
      const style = getOption(actionArgs, '--style');
      const contentType = getOption(actionArgs, '--contentType') as any;
      const optionIndex = parseIntOption(getOption(actionArgs, '--option'), 0);
      const scheduledAt = getOption(actionArgs, '--scheduledAt');
      const withImages = parseIntOption(getOption(actionArgs, '--withImages'), 0);
      const fix = getFlag(actionArgs, '--fix');

      if (opts?.dryRun) {
        return {
          dryRun: true,
          plan: {
            steps: [
              { action: 'GENERATE_CONTENT', payload: { topic, keywords, style, contentType, optionIndex } },
              { action: 'COMPLIANCE_CHECK', payload: { fix } },
              { action: 'DRAFT_SAVE', payload: { withImages } },
              { action: 'PUBLISH', payload: { scheduledAt, requiresYes: true } }
            ]
          },
          hint: 'publish-cycle 使用 --dry-run 时只输出计划，不会调用 AI/落库/入队。'
        };
      }

      const genId = enqueueTask('GENERATE_CONTENT', { topic, keywords, style, contentType });
      await processTargetTasks([genId], timeoutMs);
      await waitForTasks([genId], timeoutMs);

      const genTask = getTask(genId) as any;
      const note = genTask?.result;
      if (!note?.title || !Array.isArray(note.options) || note.options.length === 0) throw new Error('Generate content returned unexpected result');
      const selected = note.options[Math.max(0, Math.min(optionIndex, note.options.length - 1))];
      const draftTitle = note.title;
      let draftContent = selected?.content || '';
      const draftTags = Array.isArray(note.tags) ? note.tags : [];
      const draftType = selected?.type === 'article' ? 'article' : 'note';

      const compliance = ComplianceService.check([draftTitle, draftContent].join('\n'));
      if (!compliance.isCompliant && fix) {
        draftContent = await ContentService.fixContentCompliance(draftContent, compliance.blockedWords, compliance.suggestions);
      }

      let images: any[] = [];
      if (withImages > 0 && Array.isArray(note.image_prompts) && note.image_prompts.length > 0) {
        const prompts = note.image_prompts.slice(0, Math.max(0, withImages));
        const ids = prompts.map((p: string) => enqueueTask('GENERATE_IMAGE', { prompt: p }));
        await processTargetTasks(ids, timeoutMs);
        await waitForTasks(ids, timeoutMs);
        images = ids
          .map((id: string) => getTask(id) as any)
          .map((t: any) => t?.result?.url)
          .filter(Boolean);
      }

      const localImages = await localizeImages(images);
      const stmt = db.prepare('INSERT INTO drafts (title, content, tags, images, content_type, meta_data) VALUES (?, ?, ?, ?, ?, ?)');
      const meta = { topic, keywords, style, optionIndex, compliance, sourceTaskId: genId };
      const info = stmt.run(
        draftTitle,
        draftContent,
        JSON.stringify(draftTags),
        JSON.stringify(localImages),
        draftType,
        JSON.stringify(meta)
      );
      const draftId = Number(info.lastInsertRowid);

      const payload = {
        title: draftTitle,
        content: draftContent,
        tags: draftTags,
        imageData: localImages.length ? localImages : undefined,
        autoPublish: true,
        draftId,
        contentType: draftType
      };

      const isAllowed = opts?.yes === true;
      const shouldDryRun = opts?.dryRun === true || !isAllowed;
      if (shouldDryRun) {
        return {
          dryRun: true,
          draftId,
          compliance,
          payload,
          hint: 'publish-cycle 最后一步会触发发布任务，追加 --yes 才会执行发布（草稿已落库）。'
        };
      }

      const publishTaskId = enqueueTask('PUBLISH', payload, scheduledAt);
      return { success: true, draftId, genTaskId: genId, publishTaskId };
    }
    case 'draft-list': {
      const limit = parseIntOption(getOption(actionArgs, '--limit'), 50);
      const offset = parseIntOption(getOption(actionArgs, '--offset'), 0);
      const rows = db
        .prepare('SELECT * FROM drafts ORDER BY created_at DESC LIMIT ? OFFSET ?')
        .all(limit, offset) as any[];
      const drafts = rows.map((d) => ({
        ...d,
        tags: JSON.parse(d.tags || '[]'),
        images: JSON.parse(d.images || '[]'),
        meta_data: d.meta_data ? JSON.parse(d.meta_data) : null
      }));
      return { drafts };
    }
    case 'draft-save': {
      const title = getOption(actionArgs, '--title');
      const content = getOption(actionArgs, '--content');
      if (!title) throw new Error('Missing --title');
      if (!content) throw new Error('Missing --content');
      const tags = parseListOption(getOption(actionArgs, '--tags'));
      const images = parseListOption(getOption(actionArgs, '--images'));
      const contentType = getOption(actionArgs, '--contentType') || 'note';
      const meta = parseJsonOption(getOption(actionArgs, '--meta'));
      const localImages = await localizeImages(images);

      const stmt = db.prepare(
        'INSERT INTO drafts (title, content, tags, images, content_type, meta_data) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const info = stmt.run(title, content, JSON.stringify(tags), JSON.stringify(localImages), contentType, meta ? JSON.stringify(meta) : null);
      return { id: info.lastInsertRowid, success: true, images: localImages };
    }
    case 'draft-update': {
      const id = getOption(actionArgs, '--id');
      if (!id) throw new Error('Missing --id');
      const existing = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id) as any;
      if (!existing) throw new Error(`Draft not found: ${id}`);

      const title = getOption(actionArgs, '--title') ?? existing.title;
      const content = getOption(actionArgs, '--content') ?? existing.content;
      const tagsRaw = getOption(actionArgs, '--tags');
      const imagesRaw = getOption(actionArgs, '--images');
      const tags = tagsRaw !== undefined ? parseListOption(tagsRaw) : JSON.parse(existing.tags || '[]');
      const images = imagesRaw !== undefined ? parseListOption(imagesRaw) : JSON.parse(existing.images || '[]');
      const contentType = getOption(actionArgs, '--contentType') ?? existing.content_type ?? 'note';
      const metaRaw = getOption(actionArgs, '--meta');
      const meta = metaRaw !== undefined ? parseJsonOption(metaRaw) : existing.meta_data ? JSON.parse(existing.meta_data) : null;
      const localImages = await localizeImages(images);

      db.prepare(
        'UPDATE drafts SET title = ?, content = ?, tags = ?, images = ?, content_type = COALESCE(?, content_type), meta_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(title, content, JSON.stringify(tags), JSON.stringify(localImages), contentType, meta ? JSON.stringify(meta) : null, id);

      return { success: true, id, images: localImages };
    }
    case 'draft-delete': {
      const id = getOption(actionArgs, '--id');
      if (!id) throw new Error('Missing --id');
      const draft = db.prepare('SELECT images FROM drafts WHERE id = ?').get(id) as any;
      if (draft) {
        let images: string[] = [];
        try {
          const parsed = JSON.parse(draft.images || '[]');
          images = parsed.map((img: any) => (typeof img === 'string' ? img : img.url));
        } catch {}
        if (images.length > 0) {
          await FileCleanupService.deleteFiles(images);
        }
      }
      db.prepare('DELETE FROM drafts WHERE id = ?').run(id);
      return { success: true, id };
    }
    case 'publish': {
      const draftIdRaw = getOption(actionArgs, '--draftId');
      const draftId = draftIdRaw ? Number.parseInt(draftIdRaw, 10) : undefined;

      const draft = draftId ? (db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as any) : undefined;
      if (draftId && !draft) throw new Error(`Draft not found: ${draftId}`);

      const title = getOption(actionArgs, '--title') ?? draft?.title;
      const content = getOption(actionArgs, '--content') ?? draft?.content;
      if (!title) throw new Error('Missing --title (or provide --draftId)');
      if (!content) throw new Error('Missing --content (or provide --draftId)');

      const tags =
        getOption(actionArgs, '--tags') !== undefined
          ? parseListOption(getOption(actionArgs, '--tags'))
          : draft?.tags
            ? JSON.parse(draft.tags || '[]')
            : [];
      const images =
        getOption(actionArgs, '--images') !== undefined
          ? parseListOption(getOption(actionArgs, '--images'))
          : draft?.images
            ? JSON.parse(draft.images || '[]')
            : [];
      const videoPath = getOption(actionArgs, '--videoPath');
      const scheduledAt = getOption(actionArgs, '--scheduledAt');
      const autoPublish = getFlag(actionArgs, '--auto') || getFlag(actionArgs, '--autoPublish');
      const contentType = getOption(actionArgs, '--contentType');
      const projectIdRaw = getOption(actionArgs, '--projectId');
      const projectId = projectIdRaw ? Number.parseInt(projectIdRaw, 10) : undefined;
      const accountIdRaw = getOption(actionArgs, '--accountId');
      const accountId = accountIdRaw ? Number.parseInt(accountIdRaw, 10) : undefined;

      const resolvedVideoPath = videoPath ? resolveLocalVideoPath(videoPath) : undefined;

      const payload = {
        title,
        content,
        tags,
        imageData: images.length ? images : undefined,
        videoPath: resolvedVideoPath,
        autoPublish,
        accountId,
        projectId,
        draftId,
        contentType
      };

      const isAllowed = opts?.yes === true;
      const shouldDryRun = opts?.dryRun === true || !isAllowed;
      if (shouldDryRun) {
        return { dryRun: true, payload, hint: '发布属于高风险动作，追加 --yes 或在 say 里包含“确认/执行/立即”才会执行。' };
      }

      const taskId = enqueueTask('PUBLISH', payload, scheduledAt);
      if (projectId) {
        VideoProjectService.updateProjectStatus(projectId, 'COMPLETED', undefined, 'PUBLISHING', taskId);
      }
      return { success: true, taskId };
    }
    case 'tasks-list': {
      const status = getOption(actionArgs, '--status');
      const type = getOption(actionArgs, '--type');
      const limit = parseIntOption(getOption(actionArgs, '--limit'), 50);
      const offset = parseIntOption(getOption(actionArgs, '--offset'), 0);

      const where: string[] = [];
      const params: any[] = [];
      if (status) {
        where.push('status = ?');
        params.push(status);
      }
      if (type) {
        where.push('type = ?');
        params.push(type);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const rows = db
        .prepare(`SELECT id, type, status, progress, attempts, priority, scheduled_at, error, created_at, updated_at FROM tasks ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);
      return { tasks: rows };
    }
    case 'tasks-active': {
      const rows = db
        .prepare(
          `SELECT id, type, status, progress, attempts, priority, scheduled_at, error, created_at, updated_at
           FROM tasks
           WHERE status IN ('PENDING','PROCESSING')
           ORDER BY priority DESC, created_at ASC
           LIMIT 200`
        )
        .all();
      return { tasks: rows };
    }
    case 'task-status': {
      const id = getOption(actionArgs, '--id');
      if (!id) throw new Error('Missing --id');
      const task = getTask(id);
      return { task };
    }
    case 'task-cancel': {
      const id = getOption(actionArgs, '--id');
      if (!id) throw new Error('Missing --id');
      const ok = cancelTask(id);
      return { status: ok ? 'CANCELLED' : 'NOT_FOUND_OR_NOT_CANCELLABLE', id };
    }
    case 'daily-cycle': {
      const timeoutSec = opts?.timeoutSec ?? 1800;
      const timeoutMs = timeoutSec * 1000;

      const source = getOption(actionArgs, '--source') || 'weibo';
      const days = parseDays(actionArgs);
      const topN = parseIntOption(getOption(actionArgs, '--topN'), 10);
      const refresh = getFlag(actionArgs, '--refresh') || getFlag(actionArgs, '--force');
      const categories = (() => {
        const raw = getOption(actionArgs, '--categories');
        if (!raw) return ['recommend'];
        const list = parseListOption(raw).map((x) => String(x));
        return list.length ? list : ['recommend'];
      })();

      const taskIds: string[] = [];

      const row = readTrendsRow(source);
      const ttlMs = 10 * 60 * 1000;
      if (refresh || !row || !isFresh(row.updatedAtTs, ttlMs)) {
        const id = enqueueTask('SCRAPE_TRENDS', { source });
        taskIds.push(id);
        await processTargetTasks([id], timeoutMs);
        await waitForTasks([id], timeoutMs);
      }

      for (const category of categories) {
        const id = enqueueTask('SCRAPE_TRENDS', { source: 'xiaohongshu', type: 'notes', category });
        taskIds.push(id);
        await processTargetTasks([id], timeoutMs);
        await waitForTasks([id], timeoutMs);
      }

      const cutoff = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();
      const noteRows = db
        .prepare(
          `
            SELECT note_id
            FROM trending_notes
            WHERE platform = 'xiaohongshu'
              AND scraped_at >= ?
              AND (analysis_result IS NULL OR analysis_result = '')
            ORDER BY likes_count DESC, comments_count DESC
            LIMIT ?
          `
        )
        .all(cutoff, Math.max(0, topN)) as Array<{ note_id: string }>;

      for (const r of noteRows) {
        if (!r?.note_id) continue;
        const id = enqueueTask('ANALYZE_NOTE', { noteId: r.note_id });
        taskIds.push(id);
        await processTargetTasks([id], timeoutMs);
        await waitForTasks([id], timeoutMs);
      }

      const report = buildTrendReport(source, days);
      return { success: true, taskIds, report };
    }
    case 'comments-reply': {
      const id = getOption(actionArgs, '--id');
      const content = getOption(actionArgs, '--content');
      if (!id) throw new Error('Missing --id');
      if (!content) throw new Error('Missing --content');

      const isAllowed = opts?.yes === true;
      const shouldDryRun = opts?.dryRun === true || !isAllowed;
      if (shouldDryRun) {
        return { dryRun: true, payload: { commentId: id, content }, hint: '自动回复属于高风险动作，追加 --yes 或在 say 里包含“确认/执行/立即”才会执行。' };
      }

      const mod = await import('../api/services/rpa/comments.js');
      const result = await mod.replyToComment(id, content);
      return { success: true, result };
    }
    case 'comments-list': {
      const limit = parseIntOption(getOption(actionArgs, '--limit'), 50);
      const offset = parseIntOption(getOption(actionArgs, '--offset'), 0);
      const rows = db.prepare('SELECT * FROM comments ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
      return { comments: rows };
    }
    case 'competitor-list': {
      const rows = db.prepare('SELECT * FROM competitors ORDER BY last_updated DESC').all();
      return { competitors: rows };
    }
    case 'competitor-analyze': {
      const url = getOption(actionArgs, '--url');
      if (!url) throw new Error('Missing --url');

      const userId = DataSanitizer.extractUserId(url);
      const existing = db.prepare('SELECT * FROM competitors WHERE user_id = ?').get(userId) as any;
      let dbId = existing?.id as number | undefined;
      if (existing) {
        db.prepare("UPDATE competitors SET status = 'refreshing', last_error = NULL WHERE id = ?").run(existing.id);
      } else {
        const result = db
          .prepare(
            `
              INSERT INTO competitors (user_id, nickname, status, created_at, last_updated)
              VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `
          )
          .run(userId, 'New Competitor');
        dbId = Number(result.lastInsertRowid);
      }

      const taskId = enqueueTask('SCRAPE_COMPETITOR', { url: userId, id: dbId });
      return { success: true, taskId, id: dbId, status: existing ? 'refreshing' : 'pending' };
    }
    case 'compliance-check': {
      const content = getOption(actionArgs, '--content');
      if (!content) throw new Error('Missing --content');
      const result = ComplianceService.check(content);
      return { result };
    }
    case 'compliance-fix': {
      const content = getOption(actionArgs, '--content');
      if (!content) throw new Error('Missing --content');
      const blockedWords = parseListOption(getOption(actionArgs, '--blockedWords'));
      const suggestions = parseListOption(getOption(actionArgs, '--suggestions'));
      const fixedContent = await ContentService.fixContentCompliance(content, blockedWords, suggestions);
      return { fixedContent };
    }
  }

  return undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const jsonOnly = getFlag(args, '--json');
  const yes = getFlag(args, '--yes');
  const dryRun = getFlag(args, '--dry-run') || getFlag(args, '--dryrun');

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    process.exit(0);
  }

  if (cmd === 'enqueue') {
    const type = args[1];
    if (!type) throw new Error('Missing type');
    const payload = parseJsonOption(getOption(args, '--payload'));
    if (payload === undefined) throw new Error('Missing --payload <json>');
    const scheduledAt = getOption(args, '--scheduledAt');
    const priority = parseIntOption(getOption(args, '--priority'), 0);
    const id = enqueueTask(type, payload, scheduledAt, priority);
    console.log(id);
    return;
  }

  if (cmd === 'wait') {
    const id = args[1];
    if (!id) throw new Error('Missing taskId');
    const timeoutSec = parseIntOption(getOption(args, '--timeoutSec'), 1800);
    await waitForTasks([id], timeoutSec * 1000);
    const task = getTask(id);
    console.log(JSON.stringify(task, null, 2));
    return;
  }

  if (cmd === 'cancel') {
    const id = args[1];
    if (!id) throw new Error('Missing taskId');
    const ok = cancelTask(id);
    console.log(ok ? 'CANCELLED' : 'NOT_FOUND_OR_NOT_CANCELLABLE');
    return;
  }

  if (cmd === 'do') {
    const action = args[1];
    if (!action) throw new Error('Missing action');

    const timeoutSec = parseIntOption(getOption(args, '--timeoutSec'), 1800);
    const enqueueOnly = getFlag(args, '--enqueue-only');
    const noProcess = getFlag(args, '--no-process');
    const noWait = getFlag(args, '--no-wait');

    const actionArgs = args.slice(2);

    const localResult = await runLocalAction(action, actionArgs, { yes, dryRun, timeoutSec });
    if (localResult !== undefined) {
      console.log(jsonOnly ? JSON.stringify(localResult) : JSON.stringify(localResult, null, 2));
      return;
    }

    const payloads = getTaskPayloads(action, actionArgs);
    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            plan: payloads,
            hint: 'Use --yes or remove --dry-run to execute.'
          },
          null,
          2
        )
      );
      return;
    }

    const taskIds = payloads.map((p) => enqueueTask(p.type, p.payload, p.scheduledAt, p.priority));
    console.log(JSON.stringify({ taskIds }, null, 2));

    if (enqueueOnly) return;

    const timeoutMs = timeoutSec * 1000;

    if (!noProcess) {
      await processTargetTasks(taskIds, timeoutMs);
    }

    if (!noWait) {
      await waitForTasks(taskIds, timeoutMs);
      const tasks = taskIds.map((id) => getTask(id)).filter(Boolean);
      console.log(JSON.stringify({ tasks }, null, 2));
    }

    if (action === 'report-trends') {
      const source = parseSource(actionArgs);
      const days = parseDays(actionArgs);
      const ttlMs = 10 * 60 * 1000;
      const row = readTrendsRow(source);
      if (!row) throw new Error(`No trends cached for source=${source}. Try: --refresh`);
      if (!isFresh(row.updatedAtTs, ttlMs) && !actionArgs.includes('--refresh') && !actionArgs.includes('--force')) {
        const tip = { warning: '趋势缓存可能过期，建议加 --refresh', updatedAt: row.updatedAtTs };
        console.log(JSON.stringify(tip, null, 2));
      }
      const report = buildTrendReport(source, days);
      console.log(JSON.stringify({ report }, null, 2));
    }

    return;
  }

  if (cmd === 'say') {
    const text = args.slice(1).filter((x) => x !== '--json').join(' ');
    if (!text) throw new Error('Missing text');
    const normalized = normalizeText(text);
    const parsed = parseSay(normalized);

    const timeoutSec = parsed.flags.timeoutSec ?? 1800;
    const enqueueOnly = parsed.flags.enqueueOnly;
    const noProcess = parsed.flags.noProcess;
    const noWait = parsed.flags.noWait;
    const sayYes = parsed.flags.yes === true || yes;
    const sayDryRun = parsed.flags.dryRun === true || dryRun;

    const localResult = await runLocalAction(parsed.action, parsed.args, { yes: sayYes, dryRun: sayDryRun, timeoutSec });
    if (localResult !== undefined) {
      const output = { parsed: { action: parsed.action, args: parsed.args, flags: parsed.flags }, local: localResult };
      console.log(jsonOnly ? JSON.stringify(output) : JSON.stringify(output, null, 2));

      const taskId = (localResult as any)?.taskId as string | undefined;
      if (!taskId || enqueueOnly) return;

      const timeoutMs = timeoutSec * 1000;
      if (!noProcess) {
        await processTargetTasks([taskId], timeoutMs);
      }

      if (!noWait) {
        await waitForTasks([taskId], timeoutMs);
        const task = getTask(taskId);
        const finalOut = { task };
        console.log(jsonOnly ? JSON.stringify(finalOut) : JSON.stringify(finalOut, null, 2));
      }
      return;
    }

    const payloads = getTaskPayloads(parsed.action, parsed.args);
    if (sayDryRun) {
      console.log(
        JSON.stringify(
          {
            dryRun: true,
            parsed: { action: parsed.action, args: parsed.args, flags: parsed.flags },
            plan: payloads,
            hint: 'Use --yes or remove --dry-run to execute.'
          },
          null,
          2
        )
      );
      return;
    }

    const taskIds = payloads.map((p) => enqueueTask(p.type, p.payload, p.scheduledAt, p.priority));
    const output = { parsed: { action: parsed.action, args: parsed.args, flags: parsed.flags }, taskIds };
    console.log(jsonOnly ? JSON.stringify(output) : JSON.stringify(output, null, 2));

    if (enqueueOnly) return;

    const timeoutMs = timeoutSec * 1000;
    if (!noProcess) {
      await processTargetTasks(taskIds, timeoutMs);
    }

    if (!noWait) {
      await waitForTasks(taskIds, timeoutMs);
      const tasks = taskIds.map((id) => getTask(id)).filter(Boolean);
      const finalOut = { tasks };
      console.log(jsonOnly ? JSON.stringify(finalOut) : JSON.stringify(finalOut, null, 2));
    }

    if (parsed.action === 'report-trends') {
      const sourceIdx = parsed.args.indexOf('--source');
      const daysIdx = parsed.args.indexOf('--days');
      const source = sourceIdx >= 0 ? parsed.args[sourceIdx + 1] : 'weibo';
      const days = daysIdx >= 0 ? Number.parseInt(parsed.args[daysIdx + 1], 10) : 7;

      const row = readTrendsRow(source);
      if (!row) throw new Error(`No trends cached for source=${source}. Try: 刷新`);
      const report = buildTrendReport(source, Number.isFinite(days) ? days : 7);
      const out = { report };
      console.log(jsonOnly ? JSON.stringify(out) : JSON.stringify(out, null, 2));
    }

    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
