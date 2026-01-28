import { AIFactory } from './AIFactory.js';
import { Logger } from '../LoggerService.js';
import db from '../../db.js';

interface CommentAnalysisResult {
    intent: 'PRAISE' | 'COMPLAINT' | 'INQUIRY' | 'OTHER';
    suggestion: string;
}

export class CommentAnalysisService {
    
    static async analyzeComment(content: string): Promise<CommentAnalysisResult> {
        const provider = AIFactory.getTextProvider();
        
        const systemPrompt = `你是一个小红书评论分析助手。
请分析用户评论的意图，并生成一条高情商、符合小红书社区氛围的回复建议。

【意图分类定义】
- PRAISE: 夸奖、赞美、表示喜欢
- COMPLAINT: 吐槽、抱怨、不满
- INQUIRY: 询问价格、链接、教程、具体信息
- OTHER: 其他闲聊或无意义内容

【回复原则】
- 语气亲切、活泼，多用Emoji。
- 对于夸奖：表示感谢，互动。
- 对于吐槽：态度诚恳，安抚情绪。
- 对于询问：引导私信或查看主页（如果是敏感词），或者直接回答。
- 字数控制在 50 字以内。

【输出格式】
严格返回 JSON 格式：
{
  "intent": "意图分类",
  "suggestion": "回复建议内容"
}`;

        const userPrompt = `用户评论内容：${content}`;

        try {
            const result = await provider.generateJSON<CommentAnalysisResult>([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);
            return result;
        } catch (error: any) {
            Logger.error('AI:Analysis', `Failed to analyze comment: ${error.message}`);
            // Fallback
            return {
                intent: 'OTHER',
                suggestion: '谢谢关注！😊'
            };
        }
    }

    static async processUnanalyzedComments(limit = 10) {
        // Find comments that haven't been analyzed yet (intent is null)
        const comments = db.prepare(`
            SELECT id, content FROM comments 
            WHERE intent IS NULL AND content IS NOT NULL AND content != ''
            LIMIT ?
        `).all(limit) as { id: string, content: string }[];

        if (comments.length === 0) return;

        Logger.info('AI:Analysis', `Processing ${comments.length} unanalyzed comments...`);

        for (const comment of comments) {
            const analysis = await this.analyzeComment(comment.content);
            
            db.prepare(`
                UPDATE comments 
                SET intent = ?, ai_reply_suggestion = ?
                WHERE id = ?
            `).run(analysis.intent, analysis.suggestion, comment.id);
            
            Logger.info('AI:Analysis', `Analyzed ${comment.id}: [${analysis.intent}] ${analysis.suggestion}`);
        }
    }
}
