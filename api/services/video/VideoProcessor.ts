
import { VideoDownloader } from './VideoDownloader.js';
import { AudioExtractor } from './AudioExtractor.js';
import { AIFactory } from '../ai/AIFactory.js';
import fs from 'fs';
import path from 'path';

export class VideoProcessor {
    private downloader: VideoDownloader;
    private audioExtractor: AudioExtractor;

    constructor() {
        this.downloader = new VideoDownloader();
        this.audioExtractor = new AudioExtractor();
    }

    /**
     * Process a video URL: Download -> Extract Audio -> ASR -> Cleanup
     * @param url Video URL
     */
    async processVideo(url: string) {
        console.log(`[VideoProcessor] Starting processing for ${url}`);
        let videoPath = '';
        let audioPath = '';

        try {
            // 1. Download
            videoPath = await this.downloader.download(url);
            console.log(`[VideoProcessor] Video downloaded to ${videoPath}`);

            // 2. Extract Audio
            audioPath = await this.audioExtractor.extract(videoPath);
            console.log(`[VideoProcessor] Audio extracted to ${audioPath}`);

            // 3. Extract Keyframes (New Step 2)
            console.log('[VideoProcessor] Extracting keyframes...');
            let frames: string[] = [];
            try {
                frames = await this.extractKeyframes(videoPath);
                console.log(`[VideoProcessor] Extracted ${frames.length} keyframes`);
            } catch (e: any) {
                console.warn(`[VideoProcessor] Keyframe extraction failed: ${e.message}`);
            }

            // 4. ASR
            console.log('[VideoProcessor] Starting ASR...');
            let transcript = '';
            try {
                const provider = AIFactory.getAudioProvider();
                transcript = await provider.transcribe(audioPath);
                console.log(`[VideoProcessor] Transcript generated (${transcript.length} chars)`);
                
                // Save transcript to file (User Request)
                if (transcript && transcript.length > 0) {
                    const txtPath = videoPath.replace(/\.(mp4|mov|avi)$/i, '.txt');
                    fs.writeFileSync(txtPath, transcript, 'utf8');
                    console.log(`[VideoProcessor] Transcript saved to ${txtPath}`);
                }
            } catch (asrError: any) {
                console.error('[VideoProcessor] ASR failed:', asrError.message);
                transcript = `(语音转写失败: ${asrError.message})`;
            }

            return {
                videoPath,
                audioPath,
                transcript,
                frames // Return frames
            };

        } catch (error: any) {
            console.error('[VideoProcessor] Processing failed:', error);
            throw error;
        } finally {
            // Cleanup done by caller or explicit method
            // this.cleanup(videoPath, audioPath);
        }
    }
    
    /**
     * Extract 6 keyframes (0%, 20%, 40%, 60%, 80%, 100%)
     */
    private async extractKeyframes(videoPath: string): Promise<string[]> {
        const importFfmpeg = (await import('fluent-ffmpeg')).default;
        const ffmpegPath = (await import('ffmpeg-static')).default;
        if (ffmpegPath) importFfmpeg.setFfmpegPath(ffmpegPath);

        const frames: string[] = [];
        const timestamps = ['0%', '20%', '40%', '60%', '80%', '99%']; // 6 frames for better coverage
        const outputDir = path.dirname(videoPath);
        const baseName = path.basename(videoPath, path.extname(videoPath));

        return new Promise((resolve) => {
             let completed = 0;
             timestamps.forEach((ts, index) => {
                 const filename = `${baseName}_frame_${index + 1}.jpg`;
                 const outputPath = path.join(outputDir, filename);
                 
                 importFfmpeg(videoPath)
                    .screenshots({
                        timestamps: [ts],
                        filename: filename,
                        folder: outputDir,
                        size: '1280x720'
                    })
                    .on('end', () => {
                        frames.push(outputPath);
                        completed++;
                        if (completed === timestamps.length) resolve(frames);
                    })
                    .on('error', (err) => {
                         console.warn(`[VideoProcessor] Failed to extract frame at ${ts}:`, err);
                         completed++;
                         if (completed === timestamps.length) resolve(frames);
                    });
             });
        });
    }
    
    cleanup(videoPath: string, audioPath?: string, frames?: string[]) {
         this.downloader.cleanup(videoPath);
         if (audioPath && fs.existsSync(audioPath)) {
             try { fs.unlinkSync(audioPath); } catch (e) {}
         }
         if (frames) {
             frames.forEach(f => {
                 if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (e) {}
             });
         }
    }
}
