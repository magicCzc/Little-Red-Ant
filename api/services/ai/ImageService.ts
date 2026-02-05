import { AIFactory } from '../ai/AIFactory.js';
import { Logger } from '../LoggerService.js';
import { ComplianceService } from '../core/ComplianceService.js';

export class ImageService {
    static async generateImage(prompt: string, refImg?: string): Promise<string> {
        const provider = AIFactory.getImageProvider();
        try {
            Logger.info('ImageService', 'Generating image...', { prompt, refImg });
            return await provider.generateImage(prompt, { ref_img: refImg });
        } catch (error: any) {
            Logger.error("ImageService", "Image Generation Error", error);
            throw new Error(`Image generation failed: ${error.message}`);
        }
    }
}
