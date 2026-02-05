import { AIFactory } from '../ai/AIFactory.js';
import { Logger } from '../LoggerService.js';
import { SettingsService } from '../SettingsService.js';

export class AnalysisService {
    static async analyzeCompetitor(profile: { nickname: string, desc: string, notes: any[] }): Promise<string> {
        // Build a richer summary for analysis
        let notesSummary = '';
        
        // If notes have content (Deep Scrape), use it
        const deepNotes = profile.notes.filter(n => n.content);
        
        if (deepNotes.length > 0) {
            notesSummary = `【深度分析数据：该博主最火的 ${deepNotes.length} 篇笔记详情】\n\n` + 
            deepNotes.map((n, i) => `
[爆款笔记 ${i+1}]
标题：${n.title}
点赞数：${n.likes}
正文内容：
${n.content.substring(0, 500)}... (截取部分)
Tags: ${n.tags ? n.tags.join(',') : '无'}
`).join('\n------------------\n');
        } else {
            // Fallback to title only
            notesSummary = profile.notes.slice(0, 10).map(n => 
                `- 标题: "${n.title}" (点赞: ${n.likes})`
            ).join('\n');
        }

        const systemPrompt = `你是一个小红书运营专家和数据分析师。
你的任务是根据竞品账号的简介和爆款笔记（特别是笔记的正文内容），深度拆解其运营策略。
你需要分析出它的“流量密码”到底是什么。

【输出格式】
请返回纯 JSON 格式，不要包含 Markdown 代码块标记。
{
  "content_strategy": "一句话总结其核心人设和内容形式（如：极简风家居种草，强调性价比）。请分析其行文风格（如：情绪化、干货型、故事型）。",
  "keywords": "3-5个高频爆款关键词",
  "strategies": [
    {
      "tip": "具体的模仿建议（如：使用清单体）",
      "suggested_topic": "具体的参考选题（如：卧室收纳清单）",
      "suggested_title": "极具吸引力的参考标题（如：租房党必看！50块搞定卧室收纳）"
    }
  ]
}`;

        const userPrompt = `【竞品档案】
- 昵称: ${profile.nickname}
- 简介: ${profile.desc}

${notesSummary}

请分析该账号的爆款逻辑，并给出3条可执行的策略。`;

        const provider = AIFactory.getTextProvider();
        try {
            Logger.info('AnalysisService', 'Analyzing competitor...', { nickname: profile.nickname });
            const response = await provider.generateText([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);
            
            // Clean up code blocks if any
            const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return jsonStr;
        } catch (error: any) {
            Logger.error("AnalysisService", "Competitor Analysis Error", error);
            return JSON.stringify({
                content_strategy: "分析失败",
                keywords: "无",
                strategies: []
            });
        }
    }

    static async analyzeNoteStructure(content: string, title: string, type: string = 'image', videoFrames: string[] = [], audioPath?: string, noteImages: string[] = []): Promise<any> {
        let visualAnalysis = '';
        let transcript = '';

        // Step 0.1: ASR Analysis (if audio exists for video)
        if (type === 'video' && audioPath) {
             try {
                // Use AliyunProvider for ASR
                // TODO: Refactor AIFactory to support AudioProvider better
                const { AliyunProvider } = await import('./providers/AliyunProvider.js');
                const aliyun = new AliyunProvider();
                
                Logger.info('AnalysisService', 'Transcribing video audio...');
                transcript = await aliyun.transcribe(audioPath);
                Logger.info('AnalysisService', `Transcript Length: ${transcript.length}`);
             } catch (e) {
                 Logger.warn('AnalysisService', 'Audio transcription failed', e);
             }
        }
        
        // Step 0.2: Visual Analysis (if frames exist OR note images exist)
        const visualContent = videoFrames.length > 0 ? videoFrames : noteImages;
        
        if (visualContent.length > 0) {
            try {
                // Use AliyunProvider for Vision
                const { AliyunProvider } = await import('./providers/AliyunProvider.js');
                const aliyun = new AliyunProvider();
                
                const imageUrls = [];
                // Process up to 5 images to save tokens/time
                const imagesToAnalyze = visualContent.slice(0, 5);
                
                for (const pathOrUrl of imagesToAnalyze) {
                     if (pathOrUrl.startsWith('http')) {
                         imageUrls.push(pathOrUrl);
                     } else {
                         const url = await aliyun.uploadFile(pathOrUrl);
                         imageUrls.push(url);
                     }
                }
                
                if (imageUrls.length > 0) {
                      Logger.info('AnalysisService', `Analyzing visual content (${imageUrls.length} images) with Qwen-VL...`);
                      const contentParts: any[] = imageUrls.map(url => ({ image: url }));
                      contentParts.push({ text: `这是一组${type === 'video' ? '视频关键帧' : '笔记配图'}。请作为专业导演/美编，分析：1. 视觉风格（色彩、构图、滤镜） 2. ${type === 'video' ? '运镜与剪辑节奏' : '排版逻辑与留白'} 3. 画面主体与情感氛围。请忽略画面中的文字内容，专注于视觉语言分析。` });
                      
                      const vlMessages = [
                          {
                              role: 'user',
                              content: contentParts
                          }
                      ];
                      visualAnalysis = await aliyun.generateMultimodalText(vlMessages);
                      Logger.info('AnalysisService', 'Visual Analysis Result', { visualAnalysis: visualAnalysis.substring(0, 100) + '...' });
                 }
            } catch (e) {
                Logger.warn('AnalysisService', 'Visual analysis failed', e);
            }
        }

        const provider = AIFactory.getTextProvider();
        
        let contextInstruction = '';
        if (type === 'video') {
            contextInstruction = `
【特别注意：视频笔记分析】
这是一篇**视频笔记**。
${visualAnalysis ? `\n【视觉分析报告 (基于画面)】\n${visualAnalysis}\n请务必将这份视觉分析融入到“结构拆解”和“仿写建议”中，不要只分析文案！` : ''}
${transcript ? `\n【口播文案 (Transcript)】\n${transcript}\n这是通过 ASR 提取的视频语音内容，请将其视为正文的核心部分进行分析。` : ''}

提供的“正文”包含标题、简介和视频口播文案（Transcript）。
- **重点分析**：
  1. **视听结合**：画面（视觉报告）和口播（文案）是如何配合的？
  2. **脚本结构**：还原视频的脚本逻辑（时间轴/分镜）。
  3. **节奏感**：分析信息密度和情绪曲线。
- **在“仿写建议”中**：必须输出**分镜脚本建议**（画面+台词），而不仅仅是文案。`;
        } else {
            contextInstruction = `
【特别注意：图文笔记分析】
这是一篇**图文笔记**。
${visualAnalysis ? `\n【图片分析报告 (基于配图)】\n${visualAnalysis}\n请务必结合这份视觉分析，拆解其“图文配合”逻辑。` : ''}

- **重点分析**：
  1. **首图策略**：封面图是如何吸引点击的？（根据视觉报告）
  2. **排版逻辑**：图片和文字是如何互补的？
  3. **留白与氛围**：如果是极简风，分析其“少即是多”的策略。
- **在“仿写建议”中**：除了文案结构，必须包含**作图/排版建议**。`;
        }

        const systemPrompt = `你是一个小红书爆款内容拆解专家。
你的任务是深度分析一篇爆款笔记，拆解其成功的底层逻辑。

${contextInstruction}

【分析维度】
1. **钩子 (Hook)**：开头第一句（或标题/首图）是如何吸引注意力的？
2. **结构 (Structure)**：全文的逻辑脉络是怎样的？
   - 视频：分析脚本分镜。
   - 图文：分析“图+文”的组合拳。
3. **情绪价值 (Tone)**：内容传达了什么情绪？
4. **互动诱饵 (CTA)**：引导互动的策略。
5. **仿写建议 (Remix Tips)**：如果我要做一篇类似的笔记，应该怎么做？
   - **关键**：提供可执行的操作指南（拍什么、写什么、怎么排版）。

【输出格式】
请返回纯 JSON 格式：
{
  "note_type": "${type}",
  "visual_analysis": "这里放入上一步生成的视觉分析报告原文...",
  "hook_type": "悬念型/痛点型/视觉冲击...",
  "hook_analysis": "分析...",
  "structure_breakdown": ["第一部分：...", "第二部分：...", "第三部分：..."],
  "tone": "真诚/犀利/...",
  "cta_strategy": "分析...",
  "remix_template": "建议的仿写框架...",
  "ref_images": ["http://image1.jpg", "http://image2.jpg"]
}`; 

        const userPrompt = `【笔记标题】${title}
【笔记正文】
${content}

请拆解这篇笔记。`;

        try {
            Logger.info('AnalysisService', 'Analyzing note structure...');
            const result = await provider.generateJSON<any>([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);

            // Ensure visual_analysis is preserved if AI missed it, or force inject it if we have it locally
            if (visualAnalysis && (!result.visual_analysis || result.visual_analysis.length < 10)) {
                result.visual_analysis = visualAnalysis;
            }

            // Inject original images for frontend reference
            result.ref_images = noteImages || [];

            return result;
        } catch (error: any) {
            Logger.error("AnalysisService", "Note Analysis Error", error);
            throw new Error("Failed to analyze note");
        }
    }
}
