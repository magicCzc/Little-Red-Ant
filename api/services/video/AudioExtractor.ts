
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';

// Set ffmpeg path
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
} else {
    console.warn('ffmpeg-static not found, relying on system ffmpeg');
}

export class AudioExtractor {
    /**
     * Extract audio from video file
     * @param videoPath Path to source video
     * @returns Path to extracted audio file (mp3)
     */
    async extract(videoPath: string): Promise<string> {
        if (!fs.existsSync(videoPath)) {
            throw new Error(`Video file not found: ${videoPath}`);
        }

        const outputPath = videoPath.replace(path.extname(videoPath), '.mp3');

        console.log(`[AudioExtractor] Extracting audio from ${videoPath} to ${outputPath}...`);

        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .noVideo()
                .audioCodec('libmp3lame') // Use mp3 codec
                .audioBitrate(128)
                .on('end', () => {
                    console.log('[AudioExtractor] Extraction finished');
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error('[AudioExtractor] Error:', err);
                    reject(err);
                })
                .save(outputPath);
        });
    }
}
