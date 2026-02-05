import { AIFactory } from '../ai/AIFactory.js';
import { Logger } from '../LoggerService.js';

export class VideoService {
    static async generateVideo(prompt: string, imageUrl?: string, model?: string): Promise<string> {
        // AliyunProvider is the only one implementing generateVideo currently
        const provider = AIFactory.getImageProvider() as any; 
        if (!provider.generateVideo) {
             throw new Error("Current AI Provider does not support video generation");
        }
        try {
            Logger.info('VideoService', 'Generating video...', { prompt, imageUrl, model });
            return await provider.generateVideo(prompt, imageUrl, { model });
        } catch (error: any) {
            Logger.error("VideoService", "Video Generation Error", error);
            throw error;
        }
    }
}
