import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { ttsSave } from './EdgeTTSClient.js';

export class TTSService {
    private outputDir: string;

    constructor() {
        this.outputDir = path.resolve(process.cwd(), 'public', 'audio');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Generate speech from text
     * @param text Text to speak
     * @param voice Voice ID (default: zh-CN-XiaoxiaoNeural)
     * @returns Object containing url and duration
     */
    async generate(text: string, voice: string = 'zh-CN-XiaoxiaoNeural'): Promise<{ url: string, duration: number }> {
        if (!text) throw new Error('Text is required');

        const fileName = `${randomUUID()}.mp3`;
        const filePath = path.join(this.outputDir, fileName);

        try {
            await ttsSave(text, filePath, { voice: voice });
        } catch (e: any) {
             console.error('EdgeTTS failed:', e);
             console.warn('Falling back to mock audio.');
             return this.mockGenerate(text);
        }

        const duration = await this.getAudioDuration(filePath);

        return {
            url: `/audio/${fileName}`,
            duration: duration
        };
    }
    
    private async mockGenerate(text: string): Promise<{ url: string, duration: number }> {
        const fileName = `${randomUUID()}.mp3`;
        const filePath = path.join(this.outputDir, fileName);
        
        // Use ffmpeg to generate silence
        try {
            const ffmpeg = (await import('fluent-ffmpeg')).default;
            const ffmpegPath = (await import('ffmpeg-static')).default;
            if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
            
            await new Promise<void>((resolve, reject) => {
                ffmpeg()
                    .input('anullsrc')
                    .inputFormat('lavfi')
                    .duration(3)
                    .save(filePath)
                    .on('end', () => resolve())
                    .on('error', (e) => reject(e));
            });
            return {
                url: `/audio/${fileName}`,
                duration: 3
            };
        } catch (e) {
            // Fallback if ffmpeg fails: write empty file
            fs.writeFileSync(filePath, 'mock mp3 content');
            return {
                url: `/audio/${fileName}`,
                duration: 3
            };
        }
    }

    private async getAudioDuration(filePath: string): Promise<number> {
        const ffmpeg = (await import('fluent-ffmpeg')).default;
        const ffmpegPath = (await import('ffmpeg-static')).default;
        if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) return reject(err);
                resolve(metadata.format.duration || 0);
            });
        });
    }
}
