
import db from '../../db.js';
import { Logger } from '../LoggerService.js';
import axios from 'axios';

export interface ComplianceResult {
  isCompliant: boolean;
  blockedWords: string[];
  warningWords: string[];
  suggestions: string[];
  score: number; // 0-100, 100 means fully compliant
}

export interface ComplianceRule {
  id: number;
  category: string;
  keyword: string;
  level: 'BLOCK' | 'WARN';
  suggestion?: string;
  is_enabled: boolean;
}

interface RuleSource {
    name: string;
    url: string;
    category: 'forbidden' | 'sensitive' | 'ad' | 'medical';
    level: 'BLOCK' | 'WARN';
    parser: (text: string) => string[];
}

// GitHub Proxy to ensure connectivity
const PROXIES = [
    'https://mirror.ghproxy.com/',
    'https://ghproxy.com/',
    'https://cdn.jsdelivr.net/gh/', // Special handling for jsdelivr
];

// Fallback data for XHS (Simulated Scrape Result)
const XHS_BLOCK_WORDS = [
    // 极限词
    '第一', '唯一', '顶级', '国家级', '金牌', '首选', '最', '绝无仅有', '万能', '100%', 
    '史无前例', '永久', '王牌', '掌门人', '领袖', '独一无二', '最佳', '最大', '最新技术',
    '全球首发', '全网首发', '世界领先', '顶级工艺', '销量冠军', 'NO.1', 'Top1', '极致',
    
    // 引流/营销
    '微信', '微信号', '加V', '私我', '私信', '主页', '传送门', '链接', '点击', '留号',
    '购买', '下单', '入手', '价格', '多少钱', '米', '某宝', '淘宝', '京东', '拼多多',
    '闲鱼', '转转', '包邮', '免费送', '福利', '抽奖', '秒杀', '抢购', '限时',
    
    // 医疗/功效 (虚假宣传高发区)
    '治疗', '治愈', '药方', '彻底消除', '排毒', '美白', '丰胸', '减肥', '瘦身', '增高',
    '抗癌', '防癌', '降血压', '根治', '无副作用', '纯天然', '不反弹', '特效', '神效'
];

const XHS_WARN_WORDS = [
    // 诱导互动 (Lower Risk, just sensitive)
    '点赞', '收藏', '关注', '转发', '评论区见', '蹲', '交作业', '打卡', '互粉', '互赞'
];

const SOURCES: RuleSource[] = [
    {
        name: '广告违禁词 (Ad)',
        url: 'https://raw.githubusercontent.com/jkiss/sensitive-words/master/ad.txt',
        category: 'ad',
        level: 'BLOCK',
        parser: (text) => text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    },
    {
        name: '色情/低俗 (Sensitive)',
        url: 'https://raw.githubusercontent.com/konsheng/Sensitive-lexicon/master/色情词库.txt',
        category: 'sensitive',
        level: 'BLOCK',
        parser: (text) => text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    },
    {
        name: '小红书违禁词 (XHS Block)',
        url: 'MOCK_XHS_BLOCK', 
        category: 'forbidden',
        level: 'BLOCK',
        parser: () => XHS_BLOCK_WORDS
    },
    {
        name: '小红书敏感词 (XHS Warn)',
        url: 'MOCK_XHS_WARN', 
        category: 'sensitive',
        level: 'WARN',
        parser: () => XHS_WARN_WORDS
    }
];

async function fetchWithRetry(url: string): Promise<string> {
    // 1. Try Direct
    try {
        Logger.info('ComplianceService', `Trying direct access: ${url}`);
        const res = await axios.get(url, { timeout: 3000 });
        return res.data;
    } catch (e) { /* ignore */ }

    // 2. Try Proxies
    for (const proxy of PROXIES) {
        try {
            let targetUrl = proxy + url;
            if (proxy.includes('jsdelivr')) {
                // Convert raw github url to jsdelivr format
                const match = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
                if (match) {
                    targetUrl = `https://cdn.jsdelivr.net/gh/${match[1]}/${match[2]}@${match[3]}/${match[4]}`;
                } else {
                    continue;
                }
            }
            
            Logger.info('ComplianceService', `Trying proxy: ${targetUrl}`);
            const res = await axios.get(targetUrl, { timeout: 5000 });
            return res.data;
        } catch (e) { /* ignore */ }
    }
    
    throw new Error('All connection methods failed');
}

export class ComplianceService {
  /**
   * Sync rules from external sources
   */
  static async syncRules(): Promise<{ added: number, updated: number, failed: number }> {
    Logger.info('ComplianceService', '🚀 Starting Compliance Rules Sync...');
    
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    for (const source of SOURCES) {
        Logger.info('ComplianceService', `📥 Fetching source: ${source.name}...`);
        
        let keywords: string[] = [];

        try {
            if (source.url.startsWith('MOCK_')) {
                keywords = source.parser('');
                Logger.info('ComplianceService', `   - Loaded ${keywords.length} built-in rules.`);
            } else {
                const data = await fetchWithRetry(source.url);
                keywords = source.parser(data);
                Logger.info('ComplianceService', `   - Fetched ${keywords.length} rules.`);
            }

            // Batch Process
            const stmt = db.prepare(`
                INSERT INTO compliance_rules (category, keyword, level, suggestion, is_enabled)
                VALUES (?, ?, ?, ?, 1)
                ON CONFLICT(keyword) DO UPDATE SET
                category = excluded.category,
                level = excluded.level,
                updated_at = CURRENT_TIMESTAMP
            `);

            const checkStmt = db.prepare('SELECT id FROM compliance_rules WHERE keyword = ?');

            db.transaction(() => {
                for (const word of keywords) {
                    if (!word || word.length < 2) continue; // Skip too short words
                    
                    const exists = checkStmt.get(word);
                    stmt.run(source.category, word, source.level, '');
                    
                    if (exists) {
                        totalUpdated++;
                    } else {
                        totalAdded++;
                    }
                }
            })();

        } catch (error: any) {
            Logger.error('ComplianceService', `❌ Failed to fetch ${source.name}: ${error.message}`);
            totalFailed++;
        }
    }

    Logger.info('ComplianceService', `✅ Sync Completed. Added: ${totalAdded}, Updated: ${totalUpdated}, Failed Sources: ${totalFailed}`);
    return { added: totalAdded, updated: totalUpdated, failed: totalFailed };
  }

  /**
   * Check content against compliance rules
   */
  static check(content: string): ComplianceResult {
    if (!content) return { isCompliant: true, blockedWords: [], warningWords: [], suggestions: [], score: 100 };

    try {
      const rules = db.prepare('SELECT * FROM compliance_rules WHERE is_enabled = 1').all() as ComplianceRule[];
      
      const blocked: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];
      
      for (const rule of rules) {
        // Simple includes check for now. Could be upgraded to Regex if needed.
        if (content.includes(rule.keyword)) {
          if (rule.level === 'BLOCK') {
            blocked.push(rule.keyword);
          } else {
            warnings.push(rule.keyword);
          }
          
          if (rule.suggestion) {
            suggestions.push(`建议将 "${rule.keyword}" 修改为 "${rule.suggestion}"`);
          }
        }
      }
      
      const isCompliant = blocked.length === 0;
      
      // Calculate simple score
      // Base 100. Each block -20, each warning -5. Min 0.
      let score = 100;
      score -= (blocked.length * 20);
      score -= (warnings.length * 5);
      if (score < 0) score = 0;

      return {
        isCompliant,
        blockedWords: [...new Set(blocked)],
        warningWords: [...new Set(warnings)],
        suggestions: [...new Set(suggestions)],
        score
      };
    } catch (error: any) {
      Logger.error('ComplianceService', `Check failed: ${error.message}`);
      // Fail open or closed? Fail open for now to avoid blocking user on system error, but log it.
      return { isCompliant: true, blockedWords: [], warningWords: [], suggestions: [], score: 100 };
    }
  }

  /**
   * Add a new rule
   */
  static addRule(category: string, keyword: string, level: 'BLOCK' | 'WARN', suggestion: string = ''): void {
    try {
      const stmt = db.prepare(`
        INSERT INTO compliance_rules (category, keyword, level, suggestion)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(keyword) DO UPDATE SET
        category = excluded.category,
        level = excluded.level,
        suggestion = excluded.suggestion,
        is_enabled = 1
      `);
      stmt.run(category, keyword, level, suggestion);
    } catch (error: any) {
      Logger.error('ComplianceService', `Failed to add rule: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all rules
   */
  static getRules(): ComplianceRule[] {
    return db.prepare('SELECT * FROM compliance_rules ORDER BY created_at DESC').all() as ComplianceRule[];
  }

  /**
   * Toggle rule status
   */
  static toggleRule(id: number, isEnabled: boolean): void {
    db.prepare('UPDATE compliance_rules SET is_enabled = ? WHERE id = ?').run(isEnabled ? 1 : 0, id);
  }
  
  /**
   * Delete rule
   */
  static deleteRule(id: number): void {
    db.prepare('DELETE FROM compliance_rules WHERE id = ?').run(id);
  }
}
