
import db from '../../db.js';
import { AIFactory } from './AIFactory.js';

export interface GenerateNoteParams {
  niche: string;
  identity_tags: string[];
  style: string;
  topic: string;
  keywords?: string[];
  writing_samples?: string[];
  remix_structure?: any;
  contentType?: 'note' | 'article' | 'video_script';
  persona_desc?: string; // New: Full persona description from Account
}

export interface GeneratedNote {
  title: string;
  options: {
    type: 'dry_goods' | 'experience' | 'discussion' | 'article' | 'video_script';
    label: string;
    content: string;
  }[];
  tags: string[];
  image_prompts: string[];
}

export class ContentService {
    static async generateNote(params: GenerateNoteParams): Promise<GeneratedNote> {
        const { niche, identity_tags, style, topic, keywords, writing_samples, remix_structure, contentType = 'note', persona_desc } = params;

        let styleInstruction = '';
        let systemPromptTemplate = '';

        // Persona Description Block (Reusable)
        const personaBlock = persona_desc 
            ? `- 完整人设：${persona_desc}`
            : `- 专注领域：${niche}\n- 身份标签：${identity_tags.join(', ')}`;

        // 0. Special Handling for Long Article
        if (contentType === 'article') {
             styleInstruction = `- 写作风格：${style || '深度专业'}`;
             
             // Handle Remix for Article
             let remixInstruction = '';
             if (remix_structure) {
                 remixInstruction = `
【参考爆款结构】
该文章必须**基于以下爆款笔记的逻辑框架**进行深度扩展：
1. **开头钩子**：${remix_structure.hook_type || ''} (${remix_structure.hook_analysis || ''}) - 请将其改写为适合长文的引入方式。
2. **核心脉络**：
${remix_structure.structure_breakdown?.map((s: string) => `   - ${s}`).join('\n') || ''}
3. **互动策略**：${remix_structure.cta_strategy || ''}

请将上述短笔记结构，扩展为 800字+ 的深度长文。
`;
             }

             systemPromptTemplate = `你是一个资深的公众号/专栏作家。
你的任务是根据用户的人设和选题，创作一篇**深度长文 (Long-form Article)**。

【作者人设】
${personaBlock}
${styleInstruction}

${remixInstruction}

【创作要求】
1. **深度与逻辑**：文章必须有深度，逻辑严密。采用“引入-核心观点-论证-升华”的结构。
2. **篇幅**：800 - 1500 字。
3. **格式**：使用 Markdown 格式（一级标题、二级标题、加粗）。
4. **排版**：段落分明，适当留白，不要堆砌文字。
5. **去 AI 化**：避免教科书式的说教，多用案例、故事、数据来支撑观点。拒绝“综上所述”、“总之”等 AI 常用词。

【输出结构】
请务必返回纯 JSON 格式：
{
  "title": "极具吸引力的长文标题",
  "options": [
    {
      "type": "article",
      "label": "深度长文",
      "content": "# 一级标题\\n\\n正文内容..."
    }
  ],
  "tags": ["标签1", "标签2"],
  "image_prompts": ["封面图: 画面描述...", "配图1: ...", "配图2: ..."]
}`;
        }
        // 0.1 Special Handling for Video Script
        if (contentType === 'video_script') {
             styleInstruction = `- 视频风格：${style || '快节奏/吸睛'}`;
             
             // Handle Remix for Script
             let remixInstruction = '';
             if (remix_structure) {
                 // Build detailed context from remix structure
                 const structureText = remix_structure.structure_breakdown?.map((s: string) => `   - ${s}`).join('\n') || '无结构信息';
                 const visualText = remix_structure.visual_analysis || '无视觉分析';
                 const hookText = `${remix_structure.hook_type || ''} - ${remix_structure.hook_analysis || ''}`;
                 
                 remixInstruction = `
【参考爆款结构 (必须严格遵守)】
该脚本必须**基于以下爆款视频的逻辑框架**进行创作：
1. **视觉分析 (Visual Style)**：${visualText}
   - *指令*：请在生成的分镜中，尽可能还原此视觉风格（如色调、构图、剪辑节奏）。
2. **开头钩子 (Hook)**：${hookText}
   - *指令*：请模仿此Hook的形式（例如：如果是“视觉反差”，请在新脚本中也设计一个视觉反差）。
3. **脚本结构 (Structure)**：
${structureText}
4. **互动策略 (CTA)**：${remix_structure.cta_strategy || '无'}

【结构迁移指南】
你的任务是将上述结构**迁移**到新主题 "${topic}" 上。
- 保留**骨架**（节奏、情绪曲线、运镜逻辑）。
- 替换**血肉**（具体内容、道具、场景）。
例如：如果原结构是“美妆前后对比（视觉冲击）”，新主题是“数码测评”，则应迁移为“新旧设备性能对比（视觉冲击）”。
`;
             }

             systemPromptTemplate = `你是一个专业的短视频导演和脚本编剧，精通镜头语言和视听叙事。
你的任务是根据用户的人设和选题，创作一份**电影级分镜脚本 (Cinematic Storyboard Script)**。

【作者人设】
${personaBlock}
${styleInstruction}

${remixInstruction}

【创作要求】
1. **格式要求**：脚本内容必须以 **Markdown 表格** 形式呈现。
   - 列包含：**景别/时长**、**画面描述 (Visual)**、**口播文案 (Audio)**、**导演备注 (Note)**。
2. **时长控制**：总时长控制在 45-60秒（约 180-240 字口播）。
3. **视觉思维 (Critical)**：
   - **画面描述**必须包含具体的**运镜指令**（如：推近、摇摄、跳剪）、**灯光氛围**、**关键道具**。
   - 不要写“博主在说话”，要写“特写：博主眼神坚定，背景虚化，侧逆光”。
4. **黄金前3秒**：开头必须有极强的视觉或听觉钩子，必须在第一镜中标注出来。
5. **全局人设提取 (Character Extraction)**：
   - 请根据人设标签 (${identity_tags.join(', ')}) 和视频风格，提炼出一个**通用的英文人物/场景描述 (Character Prompt)**。
   - 这个描述将被用于 AI 视频生成，以确保所有分镜中的人物一致性。
   - 格式："[Age/Gender], [Hair Style], [Clothing], [Style/Vibe], high quality, aesthetic, xiaohongshu style" (e.g., "Young Asian woman, black short hair, white shirt, professional look, high quality, soft lighting").

【输出结构】
请务必返回纯 JSON 格式：
{
  "title": "视频脚本标题",
  "character_desc": "Young Asian woman, black short hair, white shirt, professional look, high quality", 
  "options": [
    {
      "type": "video_script",
      "label": "分镜脚本 (Storyboard)",
      "content": "| 景别/时长 | 画面 (Visual) | 口播 (Audio) | 导演备注 |\\n|---|---|---|---|\\n| 特写 (3s) | (运镜: 快速推近) 桌面上一片狼藉，博主手足无措。冷色调，压抑氛围。 | (音效: 玻璃破碎声) 谁能想到，只要3步... | 视觉钩子：制造焦虑感 |"
    }
  ],
  "tags": ["视频标签1", "视频标签2"],
  "image_prompts": []
}`;
        }
        // 1. Use Remix Structure if provided (Standard Note Mode)
        else if (remix_structure && (!contentType || contentType === 'note')) {
             styleInstruction = `- 文案风格：${remix_structure.tone || style || '亲切自然'}`;
             systemPromptTemplate = `你是一个小红书爆款文案专家。
你的任务是**严格按照给定的爆款结构**，结合用户的人设和选题，创作一篇高质量笔记。

【爆款结构模板 (必须遵守)】
1. **开头钩子**：${remix_structure.hook_type} (${remix_structure.hook_analysis})
2. **正文脉络**：
${remix_structure.structure_breakdown?.map((s: string) => `   - ${s}`).join('\n')}
3. **互动策略**：${remix_structure.cta_strategy}

【账号人设】
- 专注领域：${niche}
- 身份标签：${identity_tags.join(', ')}
${styleInstruction}

【创作要求】
1. **去 AI 化**：禁止使用“首先/其次/综上所述”。口语化，多用Emoji。
2. **内容重构（Critical）**：
   - 必须**重新创作内容**，严禁直接照抄参考结构的原文或符号。
   - 如果参考结构非常简单（如纯表情），请理解为其“极简/氛围感”的风格，并使用**全新的文案**或**不同的表情组合**来演绎。
   - 必须基于本次选题 "${topic}" 进行创作。如果选题与参考结构的内容不符，以**选题为准**，仅借鉴结构。
3. **格式**：严格返回纯 JSON 格式。

【输出结构】
{
  "title": "标题",
  "options": [{"type": "remix", "label": "爆款仿写版", "content": "..."}],
  "tags": [],
  "image_prompts": []
}`;
        } else {
            // 1. Try to load custom template from DB
            try {
                const template = db.prepare('SELECT * FROM prompt_templates WHERE name = ?').get(style) as any;
                if (template) {
                    // Use Custom Template
                    styleInstruction = `- 文案风格：${style} (${template.description})`;
                    systemPromptTemplate = template.template;
                }
            } catch (e) { console.warn('Failed to load custom template', e); }

            // 2. Fallback to default instruction if no custom template found (or if style is "默认")
            if (!systemPromptTemplate) {
                 styleInstruction = `- 文案风格：${style || '亲切自然'}`;
                 // Default System Prompt
                 systemPromptTemplate = `你是一个拥有百万粉丝的小红书爆款文案专家。
你的任务是根据用户的账号人设和选题，创作一篇高质量的小红书笔记。

【账号人设】
- 专注领域：${niche}
- 身份标签：${identity_tags.join(', ')}
${styleInstruction}

【核心原则：去 AI 化 & 拟人化】
1. **禁止使用 AI 常用连接词**：绝对不要出现“首先”、“其次”、“此外”、“综上所述”、“总之”、“不仅仅是”等逻辑连接词。用空行或 Emoji 代替逻辑转折。
2. **口语化表达**：像和闺蜜聊天一样说话。多用“咱”、“宝子们”、“绝绝子”、“真的哭死”、“避雷”等小红书黑话。
3. **短句为主**：每句话不超过 15 个字。多用感叹号！多用反问句？
4. **排版留白**：段落之间必须空行。每一段文字不要超过 3 行。

【创作要求】
1. **标题**：必须极具吸引力，使用“二极管标题法”（制造反差）、“数字悬念法”或“情绪共鸣法”。**严格控制在 20 字以内（包含标点符号），绝对不能超长**。包含 1-2 个表情。
2. **正文**：你需要提供 **3个不同侧重点** 的正文选项：
   - **选项A (干货实用)**：结构清晰，分点列出步骤或知识点，强调实用价值。但不要像说明书，要像“学姐分享”。
   - **选项B (个人体验)**：以第一人称讲述故事，注重情感流露和真实感，引发共鸣。
   - **选项C (互动讨论)**：提出观点或争议性话题，结尾引导粉丝在评论区站队或分享。
   
   *通用要求*：
   - **Emoji 含量**：全篇 Emoji 数量不少于 10 个。
   - **视觉锚点**：在关键信息前加上 🌟、📌、💡 等图标。
   - **语气**：${style}。如果风格不符，优先遵守“口语化”原则。

3. **标签**：生成 5-8 个标签，包含 2-3 个高热度大词和 3-5 个精准长尾词。
4. **图片提示词 (image_prompts)**：请规划 4-6 张“多图轮播”的画面内容。
   - **重要：** 在所有提示词后必须追加以下风格词： "high quality, aesthetic, xiaohongshu style, soft lighting, 8k resolution, detailed, trending on social media, bright and clean composition".
   - 第一张必须是**封面图**，要求视觉冲击力强，包含大字标题（提示词中描述为 "text overlay with big title"）。
   - 后续图片为内容详情页，逻辑递进。
   - 描述要具体，包含画面主体、构图、风格建议（如：极简、高饱和度、手绘风）。
   - 提示词将用于 AI 绘图，请描述画面视觉元素。
5. **格式**：严格返回纯 JSON 格式。

【输出结构】
{
  "title": "标题字符串",
  "options": [
    {
      "type": "dry_goods",
      "label": "干货实用版",
      "content": "正文内容..."
    },
    {
      "type": "experience",
      "label": "个人体验版",
      "content": "正文内容..."
    },
    {
      "type": "discussion",
      "label": "互动讨论版",
      "content": "正文内容..."
    }
  ],
  "tags": ["标签1", "标签2", ...],
  "image_prompts": ["封面图提示词, high quality, aesthetic...", "图2提示词, high quality...", ...]
}`;
            } else {
                // Inject dynamic variables into custom template
                // We support placeholders like {{niche}}, {{identity_tags}}, {{topic}}, {{keywords}}
                systemPromptTemplate = systemPromptTemplate
                    .replace(/{{niche}}/g, niche)
                    .replace(/{{identity_tags}}/g, persona_desc || identity_tags.join(', '))
                    .replace(/{{topic}}/g, topic)
                    .replace(/{{keywords}}/g, keywords ? keywords.join(', ') : '');
                
                // Append Output Format Enforcement if missing
                if (!systemPromptTemplate.includes('【输出结构】')) {
                    systemPromptTemplate += `
                    
【重要：输出格式要求】
请务必返回纯 JSON 格式，结构如下：
{
  "title": "标题",
  "options": [{"type": "default", "label": "生成内容", "content": "..."}],
  "tags": [],
  "image_prompts": []
}`;
                }
            }
        }
        
        if (writing_samples && writing_samples.length > 0) {
            systemPromptTemplate += `
\n【文风模仿 - 核心要求】
请仔细阅读以下 ${writing_samples.length} 段范文，深入分析其语气、用词习惯。
你的生成结果必须**严格模仿**这种文风。
---范文开始---
${writing_samples.map((s, i) => `[范文${i+1}]: ${s}`).join('\n')}
---范文结束---`;
        }

        const userPrompt = `本次选题：${topic}
${keywords && keywords.length > 0 ? `关键词要求：${keywords.join(', ')}` : ''}

请开始创作。`;

        const provider = AIFactory.getTextProvider();
        
        try {
            const result = await provider.generateJSON<GeneratedNote>([
                { role: "system", content: systemPromptTemplate },
                { role: "user", content: userPrompt }
            ]);

            // Post-processing
            if (result.title.length > 20) {
                result.title = result.title.substring(0, 19) + '…'; 
            }
            return result;
        } catch (error: any) {
            console.error("AI Generation Error:", error);
            throw new Error(`AI generation failed: ${error.message}`);
        }
    }

    static async generateImage(prompt: string): Promise<string> {
        const provider = AIFactory.getImageProvider();
        try {
            return await provider.generateImage(prompt);
        } catch (error: any) {
            console.error("Image Generation Error:", error);
            throw new Error(`Image generation failed: ${error.message}`);
        }
    }

    static async generateVideo(prompt: string, imageUrl?: string, model?: string): Promise<string> {
        // AliyunProvider is the only one implementing generateVideo currently
        const provider = AIFactory.getImageProvider() as any; 
        if (!provider.generateVideo) {
             throw new Error("Current AI Provider does not support video generation");
        }
        return provider.generateVideo(prompt, imageUrl, { model });
    }

    static async optimizeVideoPrompt(userIdea: string): Promise<string> {
        const provider = AIFactory.getTextProvider();
        const systemPrompt = `你是一个专业的 AI 视频提示词工程专家。
你的任务是将用户提供的模糊、简单的视频创意，优化为结构完整、细节丰富的 AI 视频生成提示词。

【优化原则】
1. **结构化**：包含主体(Subject)、环境(Environment)、动作(Action)、运镜(Camera Movement)、风格(Style)、光影(Lighting)。
2. **细节丰富**：补充画面细节，如颜色、材质、氛围。
3. **英文输出**：目前主流视频模型（如 Sora, Wanx, Runway）对英文提示词支持更好。请输出英文提示词。
4. **长度适中**：控制在 50-100 个单词左右。
5. **风格预设**：默认加入 "high quality, aesthetic, cinematic lighting, 4k, detailed" 等提升质感的词汇。

【输出格式】
直接返回优化后的英文提示词，不要包含任何解释或前缀后缀。`;

        const userPrompt = `用户创意：${userIdea}
请优化为专业的英文视频提示词。`;

        try {
            const result = await provider.generateText([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);
            return result.replace(/```/g, '').trim();
        } catch (error: any) {
            console.error("Prompt Optimization Error:", error);
            throw new Error("Failed to optimize prompt");
        }
    }

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
            const response = await provider.generateText([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);
            
            // Clean up code blocks if any
            const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return jsonStr;
        } catch (error: any) {
            console.error("Competitor Analysis Error:", error);
            return JSON.stringify({
                content_strategy: "分析失败",
                keywords: "无",
                strategies: []
            });
        }
    }

    static async analyzeNoteStructure(content: string, title: string, type: string = 'image', videoFrames: string[] = [], audioPath?: string): Promise<any> {
        let visualAnalysis = '';
        let transcript = '';

        // Step 0.1: ASR Analysis (if audio exists for video)
        if (type === 'video' && audioPath) {
             try {
                // Use AliyunProvider for ASR
                const { AliyunProvider } = await import('./providers/AliyunProvider.js');
                const aliyun = new AliyunProvider();
                
                console.log('[ContentService] Transcribing video audio...');
                transcript = await aliyun.transcribe(audioPath);
                console.log('[ContentService] Transcript Length:', transcript.length);
             } catch (e) {
                 console.warn('[ContentService] Audio transcription failed:', e);
             }
        }
        
        // Step 0.2: Visual Analysis (if frames exist)
        if (videoFrames.length > 0) {
            try {
                // Use AliyunProvider for Vision
                const { AliyunProvider } = await import('./providers/AliyunProvider.js');
                const aliyun = new AliyunProvider();
                
                const imageUrls = [];
                for (const framePath of videoFrames) {
                     // Upload local file to get accessible URL (OSS or DashScope)
                     const url = await aliyun.uploadFile(framePath);
                     imageUrls.push(url);
                }
                
                if (imageUrls.length > 0) {
                      console.log('[ContentService] Analyzing visual content with Qwen-VL...');
                      const contentParts: any[] = imageUrls.map(url => ({ image: url }));
                      contentParts.push({ text: `这是一组${type === 'video' ? '视频关键帧' : '笔记配图'}。请作为专业导演/美编，分析：1. 视觉风格（色彩、构图、滤镜） 2. ${type === 'video' ? '运镜与剪辑节奏' : '排版逻辑与留白'} 3. 画面主体与情感氛围。请忽略画面中的文字内容，专注于视觉语言分析。` });
                      
                      const vlMessages = [
                          {
                              role: 'user',
                              content: contentParts
                          }
                      ];
                      visualAnalysis = await aliyun.generateMultimodalText(vlMessages);
                      console.log('[ContentService] Visual Analysis Result:', visualAnalysis);
                 }
            } catch (e) {
                console.warn('[ContentService] Visual analysis failed:', e);
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
  "remix_template": "建议的仿写框架..."
}`; 

        const userPrompt = `【笔记标题】${title}
【笔记正文】
${content}

请拆解这篇笔记。`;

        try {
            const result = await provider.generateJSON<any>([
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]);

            // Ensure visual_analysis is preserved if AI missed it, or force inject it if we have it locally
            if (visualAnalysis && (!result.visual_analysis || result.visual_analysis.length < 10)) {
                result.visual_analysis = visualAnalysis;
            }

            return result;
        } catch (error: any) {
            console.error("Note Analysis Error:", error);
            throw new Error("Failed to analyze note");
        }
    }
}
