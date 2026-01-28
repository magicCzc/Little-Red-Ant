
import db from '../../../db.js';
import { scrapeTrending } from '../../rpa/trends.js';
import { fetchWeiboHotSearch } from '../../crawler/weibo.js';
import { fetchBaiduHotSearch } from '../../crawler/baidu.js';
import { fetchZhihuHotSearch } from '../../crawler/zhihu.js';
import { fetchDouyinHotSearch } from '../../crawler/douyin.js';
import { TaskHandler } from '../TaskHandler.js';

export class ScrapeTrendsHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        const source = task.payload.source || 'weibo';
        const category = task.payload.category || 'recommend';
        
        console.log(`[Worker] Scraping trends from ${source} (Category: ${category})...`);

        if (source === 'xiaohongshu') {
            const rawTrends = await scrapeTrending(category);
            this.saveXiaohongshuTrends(rawTrends, category);
            return { source, count: rawTrends.length, type: 'gallery', category };
        } else {
            return this.handleExternalTrends(source);
        }
    }

    private saveXiaohongshuTrends(rawTrends: any[], category: string) {
        const insertNote = db.prepare(`
            INSERT INTO trending_notes (
                platform, note_id, title, content, author_name, cover_url, 
                note_url, likes_count, comments_count, collects_count, scraped_at, category
            ) VALUES (
                'xiaohongshu', @note_id, @title, @content, @author, @cover, 
                @url, @heat, @comments, @collects, CURRENT_TIMESTAMP, @category
            )
            ON CONFLICT(note_id) DO UPDATE SET
            likes_count = @heat,
            comments_count = @comments,
            collects_count = @collects,
            cover_url = excluded.cover_url,
            note_url = excluded.note_url,
            title = excluded.title,
            content = COALESCE(excluded.content, content),
            author_name = excluded.author_name,
            scraped_at = CURRENT_TIMESTAMP,
            category = excluded.category
        `);

        db.transaction(() => {
            for (const note of rawTrends) {
                let noteId = note.url;
                const noteIdMatch = note.url.match(/\/(explore|discovery\/item)\/([a-zA-Z0-9]+)/);
                if (noteIdMatch && noteIdMatch[2]) {
                    noteId = noteIdMatch[2];
                }

                try {
                    insertNote.run({
                        note_id: noteId,
                        title: note.title,
                        content: note.summary || '',
                        author: note.author,
                        cover: note.cover,
                        url: note.url,
                        heat: note.heat,
                        comments: note.comments || 0,
                        collects: note.collects || 0,
                        category: category
                    });
                } catch (e) {
                    console.error('Failed to insert note:', note.title, e);
                }
            }
        })();
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

        db.prepare(`
            INSERT INTO trends (source, data, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(source) DO UPDATE SET 
            data = excluded.data,
            updated_at = CURRENT_TIMESTAMP
        `).run(source, JSON.stringify(formattedTrends));

        return { source, count: formattedTrends.length };
    }
}
