
import { Page } from 'playwright';
import { ScrapingStrategy, ScrapeResult } from './ScrapingStrategy.js';
import { Logger } from '../../LoggerService.js';
import { DataSanitizer } from '../../../utils/DataSanitizer.js';

export class ApiInterceptStrategy implements ScrapingStrategy {
    async execute(page: Page, userId: string): Promise<ScrapeResult | null> {
        let apiData: any = null;

        // Setup Request Interception - Updated to match current XHS API patterns
        const apiPatterns = [
            '**/api/sns/web/v1/user_posted**',
            '**/api/sns/web/v1/user/profile**',
            '**/api/sns/web/v2/user/note**',
            '**/api/sns/web/v1/user/note**'
        ];
        
        for (const pattern of apiPatterns) {
            await page.route(pattern, async (route) => {
                const response = await route.fetch();
                try {
                    const json = await response.json();
                    Logger.info('RPA:Strategy:API', `Intercepted ${pattern}: success=${json.success}, hasNotes=${!!json.data?.notes}, hasData=${!!json.data}`);
                    if (json.success && json.data) {
                        // Handle different API response structures
                        if (json.data.notes) {
                            apiData = json.data;
                        } else if (json.data.user_info && json.data.notes_list) {
                            // Alternative API structure
                            apiData = {
                                notes: json.data.notes_list,
                                user: json.data.user_info
                            };
                        }
                    }
                } catch(e) {
                    Logger.warn('RPA:Strategy:API', `Failed to parse API response from ${pattern}: ${e}`);
                }
                route.fulfill({ response });
            });
        }

        // Note: Page navigation is now done in CompetitorScraper before calling this strategy
        Logger.info('RPA:Strategy:API', `Executing API intercept strategy...`);
        
        // Wait for API data (scroll to trigger if needed)
        if (!apiData) {
            await page.evaluate(function() { window.scrollBy(0, 500); });
            await page.waitForTimeout(2000);
        }

        if (!apiData) {
            Logger.warn('RPA:Strategy:API', 'No API data intercepted, API strategy failed');
            return null;
        }

        // Extract Profile Info from DOM (API usually only has notes)
        const domInfo = await page.evaluate(function() {
            const nameEl = document.querySelector('.user-name, .user-nickname, .name');
            const avatarEl = document.querySelector('.user-avatar img, .avatar img');
            const descEl = document.querySelector('.user-desc, .desc');
            // Stats
            const statsMap: any = {};
            const statEls = document.querySelectorAll('.user-interactions div, .data-info div');
            statEls.forEach(function(el) {
                const text = (el as HTMLElement).innerText;
                if (text.includes('粉丝')) statsMap.fans = text;
                if (text.includes('关注')) statsMap.follows = text;
                if (text.includes('获赞')) statsMap.likes = text;
            });

            return {
                nickname: nameEl ? (nameEl as HTMLElement).innerText : '',
                avatar: avatarEl ? (avatarEl as HTMLImageElement).src : '',
                desc: descEl ? (descEl as HTMLElement).innerText : '',
                fansRaw: statsMap.fans || '0',
                likesRaw: statsMap.likes || '0'
            };
        });

        const info = {
            nickname: domInfo.nickname,
            avatar: domInfo.avatar,
            desc: domInfo.desc,
            stats: `${domInfo.fansRaw} | ${domInfo.likesRaw}`
        };

        const normalizedNotes = apiData.notes.map((n: any) => ({
            note_id: n.note_id,
            title: n.display_title,
            likes: n.interact_info?.liked_count || 0,
            cover: n.cover?.url_default || n.cover?.url_pre || n.cover?.url || '',
            url: `https://www.xiaohongshu.com/explore/${n.note_id}`,
            publish_date: (n.last_update_time || n.time) ? new Date((n.last_update_time || n.time)).toISOString() : null
        }));

        return {
            info,
            notes: normalizedNotes,
            source: 'API'
        };
    }
}
