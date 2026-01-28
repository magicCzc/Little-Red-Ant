
import { AudioProvider } from '../interfaces/AudioProvider.js';

export class CompositeAudioProvider implements AudioProvider {
    private providers: AudioProvider[];
    private name: string;

    constructor(name: string, providers: AudioProvider[]) {
        this.name = name;
        this.providers = providers;
    }

    async transcribe(audioPath: string): Promise<string> {
        const errors: string[] = [];
        for (const provider of this.providers) {
            try {
                return await provider.transcribe(audioPath);
            } catch (error: any) {
                console.warn(`[CompositeAudioProvider] ${this.name} transcription failed with ${provider.constructor.name}:`, error.message);
                errors.push(`${provider.constructor.name}: ${error.message}`);
            }
        }
        throw new Error(`All providers failed for ${this.name} transcription: ${errors.join('; ')}`);
    }
}
