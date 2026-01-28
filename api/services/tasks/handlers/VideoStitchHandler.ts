
import { TaskHandler } from '../TaskHandler.js';
import { VideoStitcher } from '../../video/VideoStitcher.js';
import { VideoProjectService } from '../../video/VideoProjectService.js';

export class VideoStitchHandler implements TaskHandler {
    private stitcher: VideoStitcher;

    constructor() {
        this.stitcher = new VideoStitcher();
    }

    async handle(task: any): Promise<any> {
        const { projectId, scenes, bgmUrl } = task.payload;

        console.log(`[VideoStitchHandler] Starting stitch for project ${projectId}`);

        // Update project status to GENERATING
        VideoProjectService.updateProjectStatus(projectId, 'GENERATING');

        try {
            const finalUrl = await this.stitcher.stitch(scenes, bgmUrl);
            
            // Update project status to COMPLETED
            VideoProjectService.updateProjectStatus(projectId, 'COMPLETED', finalUrl);
            
            return { url: finalUrl };
        } catch (error: any) {
            console.error(`[VideoStitchHandler] Failed: ${error.message}`);
            // Revert status or set to FAILED (if supported, otherwise DRAFT)
            // Ideally we should have a FAILED status, but for now DRAFT is safer so user can retry
            VideoProjectService.updateProjectStatus(projectId, 'DRAFT'); 
            throw error;
        }
    }
}
