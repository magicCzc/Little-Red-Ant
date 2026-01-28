
import db from '../../../db.js';
import { ContentService } from '../../ai/ContentService.js';
import { TaskHandler } from '../TaskHandler.js';
import { AssetService } from '../../asset/AssetService.js';

export class GenerateMediaHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        if (task.type === 'GENERATE_IMAGE') {
            const tempUrl = await ContentService.generateImage(task.payload.prompt);
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
            const tempUrl = await ContentService.generateVideo(task.payload.prompt, task.payload.imageUrl, task.payload.model);
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
                db.prepare(`
                    UPDATE video_scenes 
                    SET video_url = ?, status = 'COMPLETED', updated_at = ? 
                    WHERE id = ?
                `).run(result.url, new Date().toISOString(), task.payload.sceneId);
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
        }
        
        throw new Error(`Unsupported media generation task type: ${task.type}`);
    }
}
