
import db from '../../../db.js';
import { ContentService } from '../../ai/ContentService.js';
import { TaskHandler } from '../TaskHandler.js';
import { AssetService } from '../../asset/AssetService.js';
import { VideoProjectService } from '../../video/VideoProjectService.js';
import { enqueueTask } from '../../queue.js';

export class GenerateMediaHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        if (task.type === 'GENERATE_IMAGE') {
            let refImg = task.payload.ref_img;
            const accountId = task.payload.accountId;

            // Smart Injection of Persona Image
            if (!refImg && accountId) {
                try {
                    const account = db.prepare('SELECT persona_image_url FROM accounts WHERE id = ?').get(accountId) as any;
                    if (account && account.persona_image_url) {
                        // Heuristic: Only use persona image if prompt implies a person
                        const prompt = task.payload.prompt.toLowerCase();
                        const personKeywords = [
                            // English
                            'person', 'woman', 'girl', 'man', 'boy', 'human', 'lady', 'gentleman',
                            'selfie', 'portrait', 'face', 'posing', 'body', 'outfit', 'wearing', 'fashion', 'style', 'look',
                            'ceo', 'boss', 'teacher', 'doctor', 'nurse', 'student', 'worker', 'influencer', 'model', 'blogger',
                            'myself', 'me', 
                            // Chinese
                            '博主', '女生', '女孩', '男生', '男孩', '男人', '女人', '人像', '自拍', '穿搭', '全身', '半身',
                            '老板', '老师', '医生', '护士', '学生', '工人', '网红', '模特', '我自己', '时尚', '造型', '职业照', '写真'
                        ];
                        
                        if (personKeywords.some(k => prompt.includes(k))) {
                            console.log(`[GenerateMediaHandler] Auto-injecting persona image for account ${accountId}`);
                            refImg = account.persona_image_url;
                        }
                    }
                } catch (e) {
                    console.warn('Failed to fetch account persona:', e);
                }
            }

            const tempUrl = await ContentService.generateImage(task.payload.prompt, refImg);
            // Plan A: Localize immediately
            try {
                const localUrl = await AssetService.downloadAndLocalize(tempUrl, 'image');
                return { url: localUrl };
            } catch (e) {
                console.error('Failed to localize generated image:', e);
                return { url: tempUrl }; // Fallback to temp url
            }
        }  
        
        if (task.type === 'GENERATE_VIDEO') {
            try {
            let imageUrl = task.payload.imageUrl;
            const accountId = task.payload.accountId;

            // Smart Injection of Persona Image for Video (Text-to-Video only)
            if (!imageUrl && accountId) {
                try {
                    const account = db.prepare('SELECT persona_image_url FROM accounts WHERE id = ?').get(accountId) as any;
                    if (account && account.persona_image_url) {
                         const prompt = task.payload.prompt.toLowerCase();
                         // Reuse same person keyword list
                         const personKeywords = [
                            'person', 'woman', 'girl', 'man', 'boy', 'human', 'lady', 'gentleman',
                            'selfie', 'portrait', 'face', 'posing', 'body', 'outfit', 'wearing', 'fashion', 'style', 'look',
                            'ceo', 'boss', 'teacher', 'doctor', 'nurse', 'student', 'worker', 'influencer', 'model', 'blogger',
                            'myself', 'me', 
                            '博主', '女生', '女孩', '男生', '男孩', '男人', '女人', '人像', '自拍', '穿搭', '全身', '半身',
                            '老板', '老师', '医生', '护士', '学生', '工人', '网红', '模特', '我自己', '时尚', '造型', '职业照', '写真'
                        ];
                        
                        if (personKeywords.some(k => prompt.includes(k))) {
                            console.log(`[GenerateMediaHandler] Auto-injecting persona image for VIDEO generation (Account ${accountId})`);
                            imageUrl = account.persona_image_url;
                        }
                    }
                } catch (e) {
                    console.warn('Failed to fetch account persona for video:', e);
                }
            }

            const tempUrl = await ContentService.generateVideo(
                task.payload.prompt, 
                imageUrl, 
                imageUrl ? undefined : task.payload.model // If using persona image, let provider pick i2v model
            );
            let finalUrl = tempUrl;
            
            // Try to localize video immediately (optional, as videos are large)
            // But for consistency, let's do it if under limit. 
            // AssetService downloadAndLocalize handles stream so it's okay for < 50MB
            try {
                 finalUrl = await AssetService.downloadAndLocalize(tempUrl, 'video');
            } catch(e) {
                 console.warn('Video localization failed, using remote url:', e);
            }

            const result = { url: finalUrl };
            
            if (task.payload.sceneId) {
                // Default duration to 5s if not provided (standard for AI clips)
                const duration = task.payload.duration || 5;

                // Update scene status
                db.prepare(`
                    UPDATE video_scenes 
                    SET video_url = ?, duration = ?, status = 'COMPLETED', updated_at = ? 
                    WHERE id = ?
                `).run(result.url, duration, new Date().toISOString(), task.payload.sceneId);
                console.log(`[Worker] Scene ${task.payload.sceneId} updated with generated video URL.`);

                // Check for Auto-Pilot Stitching
                try {
                    const scene = db.prepare('SELECT project_id FROM video_scenes WHERE id = ?').get(task.payload.sceneId) as any;
                    if (scene && scene.project_id) {
                        const projectId = scene.project_id;
                        const isReady = VideoProjectService.checkProjectCompletion(projectId);
                        
                        if (isReady) {
                            console.log(`[Worker] Project ${projectId} is ready for Auto-Pilot Stitching.`);
                            const project = VideoProjectService.getProject(projectId);
                            if (project) {
                                // Trigger Stitch Task
                                enqueueTask('VIDEO_STITCH', {
                                    projectId: projectId,
                                    scenes: project.scenes,
                                    bgmUrl: project.bgm_url
                                });
                                console.log(`[Worker] Auto-Pilot Stitching triggered for project ${projectId}`);
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[Worker] Failed to check for auto-pilot stitching:', err);
                }
            }
            return result;
        } catch (error: any) {
            console.error(`[Worker] Video generation failed for scene ${task.payload.sceneId}:`, error);
            
            // NEW: Update DB status to FAILED
            if (task.payload.sceneId) {
                db.prepare(`
                    UPDATE video_scenes 
                    SET status = 'FAILED', error_msg = ?, updated_at = ? 
                    WHERE id = ?
                `).run(error.message, new Date().toISOString(), task.payload.sceneId);
            }
            throw error; // Re-throw so the task is also marked as failed
        }
    }
        
        throw new Error(`Unsupported media generation task type: ${task.type}`);
    }
}
