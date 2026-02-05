
import { enqueueTask } from '../../queue.js';
import { scrapeTrending } from '../../rpa/trends.js';
import { fetchWeiboHotSearch } from '../../crawler/weibo.js';
import { fetchBaiduHotSearch } from '../../crawler/baidu.js';
import { fetchZhihuHotSearch } from '../../crawler/zhihu.js';
import { fetchDouyinHotSearch } from '../../crawler/douyin.js';
import { TaskHandler } from '../TaskHandler.js';
import { TrendService } from '../../core/TrendService.js';
import { Logger } from '../../LoggerService.js';

export class ScrapeTrendsHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        const source = task.payload.source || 'weibo';
        const category = task.payload.category || 'recommend';
        
        Logger.info('Worker', `Scraping trends from ${source} (Category: ${category})...`);

        if (source === 'xiaohongshu') {
            const rawTrends = await scrapeTrending(category);
            
            if (!rawTrends || rawTrends.length === 0) {
                Logger.warn('Worker', `No trends found for ${category}`);
                return { source, count: 0, type: 'gallery', category, status: 'EMPTY' };
            }

            // Use TrendService for persistence
            await TrendService.saveTrends(rawTrends, category);
            
            // Auto-trigger analysis for viral notes
            const viralCandidates = await TrendService.getViralNotesCandidates(rawTrends);
            
            if (viralCandidates.length > 0) {
                Logger.info('Worker', `Triggering auto-analysis for ${viralCandidates.length} viral notes...`);
                // Fire and forget loop
                (async () => {
                    for (const candidate of viralCandidates) {
                        Logger.info('Worker', `Auto-analyzing viral note: ${candidate.title} (${candidate.noteId})`);
                        enqueueTask('ANALYZE_NOTE', { noteId: candidate.noteId });
                        // Random delay
                        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
                    }
                })().catch(e => Logger.error('Worker', 'Auto-analyze loop failed', e));
            }

            return { source, count: rawTrends.length, type: 'gallery', category, status: 'SUCCESS' };
        } else {
            return this.handleExternalTrends(source);
        }
    }

    private async handleExternalTrends(source: string) {
        let rawTrends = [];
        if (source === 'baidu') rawTrends = await fetchBaiduHotSearch();
        else if (source === 'zhihu') rawTrends = await fetchZhihuHotSearch();
        else if (source === 'douyin') rawTrends = await fetchDouyinHotSearch();
        else rawTrends = await fetchWeiboHotSearch();

        const formattedTrends = rawTrends.map((t: any, index: number) => ({
            id: index + 1,
            title: t.title,
            hot_value: t.heat,
            url: t.url
        }));

        TrendService.saveExternalTrends(source, formattedTrends);

        return { source, count: formattedTrends.length };
    }
}
