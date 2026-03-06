import db from '../../db.js';
import { Logger } from '../LoggerService.js';
import { AIFactory } from './AIFactory.js';
import { NotificationService } from '../NotificationService.js';
import { SettingsService } from '../SettingsService.js';

export class FeedbackLoopService {
    
    /**
     * Step 1: Link Online Stats (note_stats) to Local Drafts (drafts)
     * This is crucial because stats come from RPA (Creator Center) which only knows 'note_id',
     * while Drafts know 'prompt' and 'style'. We link them by Title.
     */
    static async linkData() {
        Logger.info('FeedbackLoop', '🔗 Starting Data Linking Phase...');
        
        // 1. Get unlinked stats
        const unlinkedNotes = db.prepare('SELECT id, note_id, title FROM note_stats WHERE draft_id IS NULL').all() as any[];
        
        // 2. Get unlinked drafts (that are likely published)
        // We don't have a strict 'published' status in drafts, but we can check if they have content
        const candidateDrafts = db.prepare('SELECT id, title FROM drafts WHERE published_note_id IS NULL AND content IS NOT NULL').all() as any[];
        
        let linkedCount = 0;

        db.transaction(() => {
            for (const note of unlinkedNotes) {
                // Fuzzy match title: Check if draft title contains note title or vice versa
                // Or exact match (safer for now, maybe normalize spaces)
                if (!note.title || note.title === 'Untitled') continue;

                const match = candidateDrafts.find(d => {
                    if (!d.title) return false;
                    const t1 = d.title.trim().toLowerCase();
                    const t2 = note.title.trim().toLowerCase();
                    return t1 === t2 || t1.includes(t2) || t2.includes(t1);
                });

                if (match) {
                    // Link them
                    db.prepare('UPDATE note_stats SET draft_id = ? WHERE id = ?').run(match.id, note.id);
                    db.prepare('UPDATE drafts SET published_note_id = ? WHERE id = ?').run(note.note_id, match.id);
                    linkedCount++;
                }
            }
        })();

        if (linkedCount > 0) {
            Logger.info('FeedbackLoop', `✅ Linked ${linkedCount} notes to their original drafts.`);
        } else {
            Logger.info('FeedbackLoop', 'No new links found.');
        }
    }

    /**
     * Step 2: Analyze High-Performing Notes and Optimize Prompts
     */
    static async analyzeAndOptimize() {
        Logger.info('FeedbackLoop', '🧠 Starting Analysis & Optimization Phase...');

        // Configuration from Settings
        const minLikesStr = await SettingsService.get('FEEDBACK_MIN_LIKES');
        const minSamplesStr = await SettingsService.get('FEEDBACK_MIN_SAMPLES');
        
        const MIN_LIKES = parseInt(minLikesStr || '10', 10);
        const MIN_SAMPLES = parseInt(minSamplesStr || '3', 10);

        Logger.info('FeedbackLoop', `Config: Min Likes=${MIN_LIKES}, Min Samples=${MIN_SAMPLES}`);

        // 1. Find High-Performing Styles
        // We group by the 'style' stored in draft metadata
        const goodNotes = db.prepare(`
            SELECT 
                ns.likes, ns.views, ns.title, 
                d.meta_data, d.content
            FROM note_stats ns
            JOIN drafts d ON ns.draft_id = d.id
            WHERE ns.likes >= ?
        `).all(MIN_LIKES) as any[];

        if (goodNotes.length === 0) {
            Logger.info('FeedbackLoop', 'Not enough data for analysis yet.');
            return;
        }

        // Group by Style
        const styleGroups: Record<string, any[]> = {};
        for (const note of goodNotes) {
            try {
                const meta = JSON.parse(note.meta_data || '{}');
                const style = meta.style || 'default';
                if (!styleGroups[style]) styleGroups[style] = [];
                styleGroups[style].push(note);
            } catch {
                // Ignore parsing errors
            }
        }

        // 2. Process each style
        for (const [style, notes] of Object.entries(styleGroups)) {
            if (notes.length < MIN_SAMPLES) continue;

            // Check if we already have a PENDING optimization for this style
            const pending = db.prepare('SELECT id FROM prompt_optimizations WHERE target_style = ? AND status = "PENDING"').get(style);
            if (pending) {
                Logger.info('FeedbackLoop', `Skipping style "${style}" (Optimization already pending).`);
                continue;
            }

            Logger.info('FeedbackLoop', `🔍 Analyzing style "${style}" with ${notes.length} high-performing samples...`);
            await this.generateOptimizationProposal(style, notes);
        }
    }

    private static async generateOptimizationProposal(style: string, notes: any[]) {
        try {
            // 1. Fetch current template if exists
            const currentTemplateObj = db.prepare('SELECT * FROM prompt_templates WHERE name = ?').get(style) as any;
            const currentTemplate = currentTemplateObj ? currentTemplateObj.template : "(No explicit template found, using dynamic generation)";

            // 2. Prepare Context for AI
            const samples = notes.slice(0, 5).map(n => `
                - Title: ${n.title}
                - Likes: ${n.likes}
                - Views: ${n.views}
                - Key Content Snippet: ${n.content.substring(0, 100)}...
            `).join('\n');

            const systemPrompt = `You are an expert Content Strategist for Xiaohongshu (RedNote). 
            Your goal is to analyze high-performing content and optimize the underlying AI System Prompt to replicate this success.
            
            Current System Prompt (Template) for style "${style}":
            "${currentTemplate}"

            Here are the High-Performing Notes generated using this style:
            ${samples}

            Task:
            1. Analyze WHY these notes performed well (Patterns in tone, structure, hooks, emojis).
            2. Propose an IMPROVED System Prompt that enforces these winning patterns.
            3. The new prompt must be ready to use.

            Output Format (JSON):
            {
                "analysis": "Brief analysis of success factors...",
                "optimized_prompt": "The new full system prompt..."
            }
            `;

            // 3. Call AI
            const ai = AIFactory.getTextProvider();
            const result = await ai.generateJSON<{ analysis: string, optimized_prompt: string }>([
                { role: 'user', content: systemPrompt }
            ]);

            // 4. Save Proposal
            db.prepare(`
                INSERT INTO prompt_optimizations (
                    original_template_id, target_style, analysis_report, 
                    optimized_template, performance_metrics, status
                ) VALUES (?, ?, ?, ?, ?, 'PENDING')
            `).run(
                currentTemplateObj ? currentTemplateObj.id : null,
                style,
                result.analysis,
                result.optimized_prompt,
                JSON.stringify({ sample_count: notes.length, avg_likes: Math.round(notes.reduce((a,b)=>a+b.likes,0)/notes.length) })
            );

            // 5. Notify
            NotificationService.create(
                'INFO', 
                'AI 自我迭代完成', 
                `针对风格 "${style}" 的优化建议已生成，请在“提示词优化”中查看。`
            );
            
            Logger.info('FeedbackLoop', `✅ Optimization proposal saved for "${style}"`);

        } catch (error: any) {
            Logger.error('FeedbackLoop', `Optimization failed for ${style}: ${error.message}`);
        }
    }

    /**
     * Main Entry Point
     */
    static async runCycle() {
        try {
            await this.linkData();
            await this.analyzeAndOptimize();
        } catch (e: any) {
            Logger.error('FeedbackLoop', 'Cycle failed', e);
        }
    }
}
