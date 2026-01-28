
import { Logger } from '../LoggerService.js';
import { ContentService } from '../ai/ContentService.js';
import { scrapeNoteDetail } from './xiaohongshu.js';
import { DataSanitizer } from '../../utils/DataSanitizer.js';
import { CompetitorScraper } from '../scraper/CompetitorScraper.js';
import { CompetitorService } from '../core/CompetitorService.js';

export async function scrapeCompetitor(input: string | { url: string, id?: number }) {
    // Normalize Input
    let targetUrlOrId = typeof input === 'string' ? input : input.url;
    let dbId = typeof input === 'object' ? input.id : undefined;

    let userId = DataSanitizer.extractUserId(targetUrlOrId);

    // Update Status to PROCESSING
    if (dbId) {
        CompetitorService.updateStatus(dbId, 'processing');
    }

    try {
        // 1. Scrape Profile & Basic Notes (Hybrid Strategy)
        const scraper = new CompetitorScraper();
        const scrapeResult = await scraper.scrape(userId);
        
        const { info, notes: normalizedNotes } = scrapeResult;
        
        Logger.info('RPA:Competitor', `Scraped ${info.nickname} via ${scrapeResult.source}, found ${normalizedNotes.length} notes.`);

        // 2. Deep Analysis: Scrape content of Top 3 Notes
        // Sort by likes
        const sortedNotes = [...normalizedNotes].sort((a, b) => b.likes - a.likes).slice(0, 3);
        const detailedNotes: any[] = [];

        Logger.info('RPA:Competitor', `Deep scraping top ${sortedNotes.length} notes for content analysis...`);

        for (const note of sortedNotes) {
            if (!note.url) continue;
            
            try {
                Logger.info('RPA:Competitor', `Fetching detail for ${note.title} (${note.url})...`);
                const detail = await scrapeNoteDetail(note.url);
                detailedNotes.push({
                    ...note,
                    content: detail.content,
                    tags: detail.tags,
                    // If we scraped detail, we might have a better date, but let's stick to the basic flow for now
                });
                // Small delay to be nice
                await new Promise(r => setTimeout(r, 2000));
            } catch (e: any) {
                Logger.warn('RPA:Competitor', `Failed to scrape detail for ${note.title}: ${e.message}`);
                detailedNotes.push(note);
            }
        }

        // 3. AI Analysis
        let analysis = "{}";
        if (normalizedNotes.length > 0) {
            try {
                Logger.info('RPA:Competitor', 'Starting AI analysis with deep data...');
                analysis = await ContentService.analyzeCompetitor({
                    nickname: info.nickname,
                    desc: info.desc,
                    notes: detailedNotes.length > 0 ? detailedNotes : normalizedNotes
                });
            } catch (e: any) {
                Logger.error('RPA:Competitor', 'AI Analysis failed', e);
                analysis = JSON.stringify({ error: "AI Analysis failed: " + e.message });
            }
        }

        // 4. Save to Database
        const saveResult = CompetitorService.saveScrapeResult(dbId!, userId, info, normalizedNotes, analysis);

        return saveResult;

    } catch (error: any) {
        Logger.error('RPA:Competitor', `Task failed: ${error.message}`, error);
        
        // Update Status to ERROR
        if (dbId) {
             CompetitorService.updateStatus(dbId, 'error', error.message);
        }

        throw error;
    }
}
