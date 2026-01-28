
import { Page } from 'playwright';
import { ScrapingStrategy, ScrapeResult } from './ScrapingStrategy.js';
import { Logger } from '../../LoggerService.js';
import { DataSanitizer } from '../../../utils/DataSanitizer.js';

export class ApiInterceptStrategy implements ScrapingStrategy {
    async execute(page: Page, userId: string): Promise<ScrapeResult | null> {
        let apiData: any = null;

        // Setup Request Interception
        await page.route('**/api/sns/web/v1/user_posted**', async (route) => {
            const response = await route.fetch();
            try {
                const json = await response.json();
                if (json.success && json.data && json.data.notes) {
                    apiData = json.data;
                }
            } catch(e) {}
            route.fulfill({ response });
        });

        const targetUrl = `https://www.xiaohongshu.com/user/profile/${userId}`;
        Logger.info('RPA:Strategy:API', `Navigating to ${targetUrl} (Intercept Mode)...`);
        
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
        
        // Wait for API data (scroll to trigger if needed)
        if (!apiData) {
            await page.evaluate(function() { window.scrollBy(0, 500); });
            await page.waitForTimeout(2000);
        }

        if (!apiData) return null;

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
