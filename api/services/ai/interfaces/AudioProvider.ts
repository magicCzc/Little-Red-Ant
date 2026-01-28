
import fs from 'fs';

export interface AudioProvider {
    /**
     * Transcribe audio file to text
     * @param audioPath Path to audio file (mp3/wav)
     * @returns Transcribed text
     */
    transcribe(audioPath: string): Promise<string>;
}
