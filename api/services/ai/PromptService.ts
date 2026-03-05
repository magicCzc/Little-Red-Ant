import db from '../../db.js';
import { ComplianceService } from '../core/ComplianceService.js';
import { Logger } from '../LoggerService.js';

export interface PromptContext {
    niche: string;
    identity_tags: string[];
    style: string;
    topic: string;
    keywords?: string[];
    persona_desc?: string;
    remix_structure?: any;
    custom_instructions?: string;
    writing_samples?: string[];
}

export class PromptService {

    static getTemplate(name: string, defaultTemplate: string, description?: string): string {
        try {
            const row = db.prepare('SELECT template FROM prompt_templates WHERE name = ?').get(name) as any;
            if (row && row.template) {
                 // Heuristic: If DB template is significantly shorter than default (likely the partial seed), update it.
                 if (row.template.length < 200 && defaultTemplate.length > 200) {
                     db.prepare('UPDATE prompt_templates SET template = ? WHERE name = ?').run(defaultTemplate, name);
                     return defaultTemplate;
                 }
                 return row.template;
            } else {
                // Insert if missing
                try {
                    db.prepare('INSERT INTO prompt_templates (name, description, template, is_default) VALUES (?, ?, ?, 1)')
                      .run(name, description || '', defaultTemplate);
                } catch (e) {
                    // Ignore unique constraint violation if race condition
                }
            }
        } catch (e) {
            Logger.warn('PromptService', `Failed to load template ${name}`, e);
        }
        return defaultTemplate;
    }

    private static processTemplate(template: string, variables: Record<string, string>): string {
        return template.replace(/{{(\w+)}}/g, (_, key) => variables[key] || '');
    }

    /**
     * Builds the System Prompt for Article Generation
     */
    static buildArticleSystemPrompt(ctx: PromptContext): { systemPrompt: string, styleInstruction: string } {
        const { niche, identity_tags, style, persona_desc, remix_structure } = ctx;

        // Persona Block
        const personaBlock = persona_desc 
            ? `- 完整人设：${persona_desc}`
            : `- 专注领域：${niche}\n- 身份标签：${identity_tags.join(', ')}`;
            
        const styleInstruction = `- 写作风格：${style || '深度专业'}`;
        
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

        const defaultTemplate = `你是一个资深的公众号/专栏作家。
你的任务是根据用户的人设和选题，创作一篇**深度长文 (Long-form Article)**。

【作者人设】
{{personaBlock}}
{{styleInstruction}}

{{remixInstruction}}

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

        const tpl = this.getTemplate('article_gen', defaultTemplate, '深度长文生成');
        const systemPrompt = this.processTemplate(tpl, { personaBlock, styleInstruction, remixInstruction });

        return { systemPrompt, styleInstruction };
    }

    /**
     * Builds the System Prompt for Video Script Generation
     */
    static buildVideoScriptSystemPrompt(ctx: PromptContext): { systemPrompt: string, styleInstruction: string } {
        const { niche, identity_tags, style, topic, persona_desc, remix_structure } = ctx;

        const personaBlock = persona_desc 
            ? `- 完整人设：${persona_desc}`
            : `- 专注领域：${niche}\n- 身份标签：${identity_tags.join(', ')}`;

        const styleInstruction = `- 视频风格：${style || '快节奏/吸睛'}`;
        
        let remixInstruction = '';
        if (remix_structure) {
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

        const defaultTemplate = `你是一个专业的短视频导演和脚本编剧，精通镜头语言和视听叙事。
你的任务是根据用户的人设和选题，创作一份**电影级分镜脚本 (Cinematic Storyboard Script)**。

【作者人设】
{{personaBlock}}
{{styleInstruction}}

{{remixInstruction}}

【创作要求】
1. **格式要求**：脚本内容必须以 **Markdown 表格** 形式呈现。
   - 列包含：**景别/时长**、**画面描述 (Visual)**、**口播文案 (Audio)**、**导演备注 (Note)**。
2. **时长控制**：总时长控制在 45-60秒（约 180-240 字口播）。
3. **视觉思维 (Critical)**：
   - **画面描述**必须包含具体的**运镜指令**（如：推近、摇摄、跳剪）、**灯光氛围**、**关键道具**。
   - 不要写“博主在说话”，要写“特写：博主眼神坚定，背景虚化，侧逆光”。
4. **黄金前3秒**：开头必须有极强的视觉或听觉钩子，必须在第一镜中标注出来。
5. **全局人设提取 (Character Extraction)**：
   - 请根据人设标签 ({{identityTags}}) 和视频风格，提炼出一个**通用的英文人物/场景描述 (Character Prompt)**。
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

        const tpl = this.getTemplate('video_script_gen', defaultTemplate, '分镜脚本生成');
        const systemPrompt = this.processTemplate(tpl, { 
            personaBlock, 
            styleInstruction, 
            remixInstruction,
            identityTags: identity_tags.join(', ')
        });

        return { systemPrompt, styleInstruction };
    }

    /**
     * Builds the System Prompt for Note Generation (Text)
     */
    static buildNoteSystemPrompt(ctx: PromptContext): { systemPrompt: string, styleInstruction: string } {
        const { niche, identity_tags, style, topic, keywords, persona_desc, custom_instructions, writing_samples, remix_structure } = ctx;

        let styleInstruction = '';
        
        // Persona Block
        const personaBlock = persona_desc 
            ? `- 完整人设：${persona_desc}`
            : `- 专注领域：${niche}\n- 身份标签：${identity_tags.join(', ')}`;

        // Variables for template
        let visualContext = '';
        let remixStructureBlock = '';
        let tone = style || '亲切自然';

        if (remix_structure) {
             tone = remix_structure.tone || tone;
             styleInstruction = `- 文案风格：${tone}`;
             
             visualContext = remix_structure.visual_analysis 
                ? `\n3. **视觉风格 (Visual Style)**：${remix_structure.visual_analysis}\n   - *指令*：请在生成 "image_prompts" 时，参考此视觉风格（如配色、构图、字体排版）。` 
                : '';

             remixStructureBlock = `
【爆款结构模板 (必须遵守)】
1. **开头钩子**：${remix_structure.hook_type} (${remix_structure.hook_analysis})
2. **正文脉络**：
${remix_structure.structure_breakdown?.map((s: string) => `   - ${s}`).join('\n')}${visualContext}
4. **互动策略**：${remix_structure.cta_strategy}
`;
        } else {
             styleInstruction = `- 文案风格：${tone}`;
        }

        const defaultTemplate = `你是一个拥有百万粉丝的小红书爆款文案专家。
你的任务是根据用户的账号人设和选题，创作一篇高质量的小红书笔记。

【账号人设】
{{personaBlock}}
{{styleInstruction}}

{{remixStructureBlock}}

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
   - **语气**：{{tone}}。如果风格不符，优先遵守“口语化”原则。

3. **标签**：生成 5-8 个标签，包含 2-3 个高热度大词和 3-5 个精准长尾词。
4. **视觉一致性与配图规划 (Visual Consistency)**：
   - **核心指令**：所有配图必须基于同一个“视觉锚点”（Visual Anchor），确保人物、场景、色调的一致性。
   - **视觉锚点**：请先设定一个通用的视觉描述，必须包含人设特征 (例如：{{personaDesc}})。
   - **配图生成**：规划 4-6 张“多图轮播”的画面内容。每一张的提示词必须包含上述“视觉锚点”。
   - 第一张必须是**封面图**，要求视觉冲击力强，包含大字标题（提示词中描述为 "text overlay with big title"）。
   - 后续图片为内容详情页，逻辑递进。
   - **重要：** 在所有提示词后必须追加以下风格词： "high quality, aesthetic, xiaohongshu style, soft lighting, 8k resolution, detailed, trending on social media, bright and clean composition".
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
  "image_prompts": ["封面图: [画面内容], [视觉锚点], ...", "图2: [画面内容], [视觉锚点]...", ...]
}`;

        // Support for Custom Templates from DB based on Style
        // Logic: Try to get a specific template for the style, if not found, use default 'note_gen_standard'
        let tplName = 'note_gen_standard';
        let tpl = this.getTemplate(tplName, defaultTemplate, '标准笔记生成');

        // Note: The original code supported loading "style" specific templates.
        // We can keep that logic if needed, but for now we standardize on 'note_gen_standard'
        // or check if 'style' exists in prompt_templates
        if (style && style !== '亲切自然') {
             try {
                 const customRow = db.prepare('SELECT template FROM prompt_templates WHERE name = ?').get(style) as any;
                 if (customRow) {
                     tpl = customRow.template;
                 }
             } catch (ignore) {}
        }

        let systemPrompt = this.processTemplate(tpl, {
            personaBlock,
            styleInstruction,
            remixStructureBlock,
            tone,
            personaDesc: persona_desc || "韩系极简风，低饱和度，自然光，年轻女性博主"
        });
        
        // Post-processing injections (Writing Samples, Compliance)
        // These are appended dynamically as they are variable length/logic
        
        if (writing_samples && writing_samples.length > 0) {
            systemPrompt += `
\n【文风模仿 - 核心要求】
请仔细阅读以下 ${writing_samples.length} 段范文，深入分析其语气、用词习惯。
你的生成结果必须**严格模仿**这种文风。
---范文开始---
${writing_samples.map((s, i) => `[范文${i+1}]: ${s}`).join('\n')}
---范文结束---`;
        }

        try {
            const complianceRules = ComplianceService.getRules()
                .filter(r => r.level === 'BLOCK' && r.is_enabled)
                .slice(0, 20);
            
            if (complianceRules.length > 0) {
                systemPrompt += `
\n【⚠️ 平台红线 (必须遵守)】
请绝对避免在正文和标题中使用以下敏感词，否则会被系统屏蔽：
${complianceRules.map(r => `- ${r.keyword}`).join('、')}
`;
            }
        } catch (e) {
            Logger.warn('PromptService', 'Failed to load compliance rules', e);
        }

        return { systemPrompt, styleInstruction };
    }

    /**
     * Build User Prompt
     */
    static buildUserPrompt(ctx: PromptContext): string {
        return `本次选题：${ctx.topic}
${ctx.keywords && ctx.keywords.length > 0 ? `关键词要求：${ctx.keywords.join(', ')}` : ''}
${ctx.custom_instructions ? `\n【额外指令】\n${ctx.custom_instructions}` : ''}

请开始创作。`;
    }
}
