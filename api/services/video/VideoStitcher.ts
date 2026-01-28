import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { VideoDownloader } from './VideoDownloader.js';

// Set ffmpeg path
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

export interface StitchScene {
    videoUrl: string;
    audioUrl?: string;
}

export class VideoStitcher {
    private tempDir: string;
    private outputDir: string;
    private downloader: VideoDownloader;

    constructor() {
        this.tempDir = path.resolve(process.cwd(), 'temp', 'stitch');
        this.outputDir = path.resolve(process.cwd(), 'public', 'outputs'); // Public accessible
        this.downloader = new VideoDownloader();

        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Get duration of a file in seconds
     */
    private getDuration(filePath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) return reject(err);
                const duration = metadata.format.duration;
                resolve(duration || 0);
            });
        });
    }

    /**
     * Stitch multiple videos into one, merging audio if provided
     * Now supports XFADE transitions!
     */
    async stitch(scenes: StitchScene[], bgmUrl?: string): Promise<string> {
        if (!scenes || scenes.length < 1) {
            throw new Error('At least 1 scene is required for stitching');
        }

        console.log(`[VideoStitcher] Starting stitch for ${scenes.length} scenes (BGM: ${!!bgmUrl})...`);
        const processedFiles: string[] = [];
        const cleanupFiles: string[] = [];

        try {
            // 1. Process each scene (Download & Merge Audio/Video)
            // We need to normalize them first to ensure consistent framerate/resolution for xfade
            for (const scene of scenes) {
                const videoPath = await this.downloader.download(scene.videoUrl);
                cleanupFiles.push(videoPath);

                let segmentPath = '';

                if (scene.audioUrl) {
                    const audioPath = await this.downloader.download(scene.audioUrl);
                    cleanupFiles.push(audioPath);
                    
                    // Merge Video + Audio
                    segmentPath = path.join(this.tempDir, `merged_${randomUUID()}.mp4`);
                    await this.mergeAudioVideo(videoPath, audioPath, segmentPath);
                } else {
                    segmentPath = path.join(this.tempDir, `std_${randomUUID()}.mp4`);
                    await this.standardizeVideo(videoPath, segmentPath);
                }
                
                processedFiles.push(segmentPath);
                cleanupFiles.push(segmentPath);
            }

            // 2. Stitch with Transitions (or simple concat if only 1 scene)
            let stitchedVideoPath: string;
            if (processedFiles.length > 1) {
                const transitionFileName = `trans_${randomUUID()}.mp4`;
                stitchedVideoPath = path.join(this.tempDir, transitionFileName);
                cleanupFiles.push(stitchedVideoPath);
                await this.applyTransitions(processedFiles, stitchedVideoPath);
            } else {
                stitchedVideoPath = processedFiles[0];
            }

            // 3. Mix BGM if provided
            const finalFileName = `final_${randomUUID()}.mp4`;
            const finalFilePath = path.join(this.outputDir, finalFileName);

            if (bgmUrl) {
                const bgmPath = await this.downloader.download(bgmUrl);
                cleanupFiles.push(bgmPath);
                
                await this.mixBgm(stitchedVideoPath, bgmPath, finalFilePath);
            } else {
                fs.copyFileSync(stitchedVideoPath, finalFilePath);
            }

            return `/outputs/${finalFileName}`;

        } catch (error) {
            console.error('[VideoStitcher] Stitch failed:', error);
            throw error;
        } finally {
            // Cleanup
            cleanupFiles.forEach(f => {
                if (fs.existsSync(f)) {
                    try { fs.unlinkSync(f); } catch(e) {}
                }
            });
        }
    }

    private async applyTransitions(inputFiles: string[], outputPath: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            if (inputFiles.length < 2) return resolve();

            const durationPromises = inputFiles.map(f => this.getDuration(f));
            const durations = await Promise.all(durationPromises);
            
            const transitionDuration = 0.5; // 0.5s transition
            const cmd = ffmpeg();

            // Add all inputs
            inputFiles.forEach(f => cmd.input(f));

            // Build Complex Filter
            // We need to chain xfade for video and acrossfade for audio
            // Logic:
            // V0 + V1 -> V01 (offset = D0 - T)
            // V01 + V2 -> V012 (offset = D0 + D1 - 2T)
            // ...
            
            let filterComplex: string[] = [];
            let currentOffset = 0;
            let lastV = '0:v';
            let lastA = '0:a';

            for (let i = 1; i < inputFiles.length; i++) {
                const prevDuration = durations[i-1];
                const offset = currentOffset + prevDuration - transitionDuration;
                
                // Video Crossfade
                const nextV = `v${i}`;
                filterComplex.push(`[${lastV}][${i}:v]xfade=transition=fade:duration=${transitionDuration}:offset=${offset}[${nextV}]`);
                lastV = nextV;

                // Audio Crossfade
                const nextA = `a${i}`;
                // acrossfade doesn't use offset, it just overlaps the end of stream1 with start of stream2
                // But we are chaining, so we merge stream (i-1) result with stream i
                filterComplex.push(`[${lastA}][${i}:a]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[${nextA}]`);
                lastA = nextA;

                currentOffset = offset;
            }

            cmd.complexFilter(filterComplex, [lastV, lastA]) // Map the final labels
                .outputOptions([
                    '-c:v', 'libx264',
                    '-c:a', 'aac',
                    '-pix_fmt', 'yuv420p'
                ])
                .save(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => {
                    console.error('Transition Error:', err);
                    reject(err);
                });
        });
    }

    private mixBgm(videoPath: string, bgmPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg()
            .input(videoPath)
            .input(bgmPath)
            // [1:a]aloop=loop=-1:size=2e+09[bgm];[0:a][bgm]amix=inputs=2:duration=first:weights=4 1[aout]
            // weights=4 1 means voice is 4x louder than bgm
            .complexFilter([
                {
                    filter: 'aloop',
                    options: { loop: -1, size: 2147483647 },
                    inputs: '1:a',
                    outputs: 'bgm_looped'
                },
                {
                    filter: 'volume',
                    options: { volume: 0.15 }, // Lower BGM volume even more
                    inputs: 'bgm_looped',
                    outputs: 'bgm_low'
                },
                {
                    filter: 'amix',
                    options: { inputs: 2, duration: 'first', dropout_transition: 2, weights: '4 1' },
                    inputs: ['0:a', 'bgm_low'],
                    outputs: 'audio_mix'
                }
            ])
            .outputOptions([
                '-map', '0:v',
                '-map', '[audio_mix]',
                '-c:v', 'copy', // Copy video stream
                '-c:a', 'aac',
                '-shortest'
            ])
            .save(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
        });
    }

    private mergeAudioVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(videoPath)
                .inputOptions(['-stream_loop', '-1']) // Loop video to match audio duration
                .input(audioPath)
                // Normalize resolution to 1080x1920 (9:16) for xfade consistency
                .outputOptions([
                    '-map', '0:v:0',
                    '-map', '1:a:0',
                    '-c:v', 'libx264',
                    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30', 
                    '-c:a', 'aac',
                    '-shortest',
                    '-fflags', 'shortest',
                    '-max_interleave_delta', '100M'
                ])
                .save(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });
    }

    private standardizeVideo(videoPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                // Normalize resolution and add silent audio
                .outputOptions([
                    '-c:v', 'libx264',
                    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30',
                    '-c:a', 'aac',
                    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', // Input 1: silent audio
                    '-map', '0:v',
                    '-map', '1:a',
                    '-shortest' // Cut silence to video length
                ])
                .save(outputPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });
    }
}
