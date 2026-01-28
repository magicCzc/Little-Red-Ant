import { AIProvider } from './interfaces/AIProvider.js';
import { AudioProvider } from './interfaces/AudioProvider.js';
import { DeepSeekProvider } from './providers/DeepSeekProvider.js';
import { AliyunProvider } from './providers/AliyunProvider.js';
import { CompositeProvider } from './providers/CompositeProvider.js';
import { OpenAIAudioProvider } from './providers/OpenAIAudioProvider.js';
import { CompositeAudioProvider } from './providers/CompositeAudioProvider.js';

export class AIFactory {
    private static textProvider: AIProvider;
    private static imageProvider: AIProvider;
    private static audioProvider: AudioProvider;

    static getTextProvider(): AIProvider {
        if (!this.textProvider) {
            // Priority: DeepSeek -> Aliyun
            // This ensures if DeepSeek is down/out of credits, we fall back to Aliyun Qwen
            this.textProvider = new CompositeProvider('TextService', [
                new DeepSeekProvider(),
                new AliyunProvider()
            ]);
        }
        return this.textProvider;
    }

    static getImageProvider(): AIProvider {
        if (!this.imageProvider) {
            // Priority: Aliyun (Wanx/Qwen) -> DeepSeek (Currently no image support, but kept for future)
            this.imageProvider = new CompositeProvider('ImageService', [
                new AliyunProvider(),
                new DeepSeekProvider()
            ]);
        }
        return this.imageProvider;
    }

    static getAudioProvider(): AudioProvider {
        if (!this.audioProvider) {
            // Use Aliyun Paraformer directly as requested
            this.audioProvider = new AliyunProvider();
        }
        return this.audioProvider;
    }
}
