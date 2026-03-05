import { z } from 'zod';

// --- Shared Schemas ---
const AccountIdSchema = z.union([z.string(), z.number()]).optional();

// --- Generate Routes ---

// POST /api/generate/content
export const GenerateContentSchema = z.object({
    topic: z.string().min(1, "Topic is required").max(200, "Topic too long"),
    keywords: z.array(z.string()).optional(),
    style: z.string().optional(),
    remix_structure: z.any().optional(), // Can be complex object, keep loose for now or define stricter if known
    contentType: z.enum(['note', 'article', 'video_script']).optional().default('note'),
    accountId: AccountIdSchema,
    persona_desc: z.string().optional(),
    custom_instructions: z.string().optional(),
});

// POST /api/generate/image
export const GenerateImageSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    ref_img: z.string().url("Reference image must be a valid URL").optional(),
    accountId: AccountIdSchema
});

// POST /api/generate/video
export const GenerateVideoSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    imageUrl: z.string().url("Image URL must be valid").optional(),
    duration: z.number().min(1).max(60).optional(),
    sceneId: z.string().optional(),
    model: z.string().optional(),
    accountId: AccountIdSchema
});

// POST /api/generate/optimize-prompt
export const OptimizePromptSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    type: z.enum(['video', 'article', 'note', 'text']).optional()
});


// --- Publish Routes ---

// POST /api/publish/publish
export const PublishSchema = z.object({
    title: z.string().min(1, "Title is required").max(100, "Title too long"),
    content: z.string().min(1, "Content is required"),
    tags: z.array(z.string()).optional(),
    
    // Media
    imageData: z.array(z.string()).optional(), // Array of URLs or Base64
    videoPath: z.string().optional(), // Path or URL
    
    // Settings
    autoPublish: z.boolean().optional(),
    scheduledAt: z.string().datetime({ offset: true }).optional(), // ISO 8601
    
    // Context
    accountId: AccountIdSchema,
    projectId: z.string().optional(),
    draftId: z.union([z.string(), z.number()]).optional(),
    contentType: z.enum(['note', 'video', 'article']).optional()
}).refine(data => {
    // Custom validation: Must have either images OR video
    const hasImages = data.imageData && data.imageData.length > 0;
    const hasVideo = !!data.videoPath;
    const isArticle = data.contentType === 'article';
    return hasImages || hasVideo || isArticle;
}, {
    message: "Must provide either imageData or videoPath",
    path: ["imageData", "videoPath"]
});

// POST /api/publish/login
// POST /api/publish/login-main
// (Simple object)
export const LoginSchema = z.object({
    accountId: AccountIdSchema
});
