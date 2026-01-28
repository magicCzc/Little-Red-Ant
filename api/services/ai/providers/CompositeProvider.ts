import { AIProvider } from '../interfaces/AIProvider.js';

export class CompositeProvider implements AIProvider {
    private providers: AIProvider[];
    private name: string;

    constructor(name: string, providers: AIProvider[]) {
        this.name = name;
        this.providers = providers;
    }

    async generateText(messages: any[], options?: any): Promise<string> {
        const errors: string[] = [];
        for (const provider of this.providers) {
            try {
                return await provider.generateText(messages, options);
            } catch (error: any) {
                console.warn(`[CompositeProvider] ${this.name} text generation failed with ${provider.constructor.name}:`, error.message);
                errors.push(`${provider.constructor.name}: ${error.message}`);
                // Continue to next provider
            }
        }
        throw new Error(`All providers failed for ${this.name} text generation: ${errors.join('; ')}`);
    }

    async generateJSON<T>(messages: any[], options?: any): Promise<T> {
        const errors: string[] = [];
        for (const provider of this.providers) {
            try {
                return await provider.generateJSON<T>(messages, options);
            } catch (error: any) {
                console.warn(`[CompositeProvider] ${this.name} JSON generation failed with ${provider.constructor.name}:`, error.message);
                errors.push(`${provider.constructor.name}: ${error.message}`);
            }
        }
        throw new Error(`All providers failed for ${this.name} JSON generation: ${errors.join('; ')}`);
    }

    async generateImage(prompt: string, options?: any): Promise<string> {
        const errors: string[] = [];
        for (const provider of this.providers) {
            try {
                return await provider.generateImage(prompt, options);
            } catch (error: any) {
                // If the provider explicitly says "not supported", don't count it as a failure to warn about, just skip
                if (error.message.includes('not support')) {
                    continue;
                }
                console.warn(`[CompositeProvider] ${this.name} image generation failed with ${provider.constructor.name}:`, error.message);
                errors.push(`${provider.constructor.name}: ${error.message}`);
            }
        }
        throw new Error(`All providers failed for ${this.name} image generation: ${errors.join('; ')}`);
    }
    
    // Optional: Video generation (extended interface)
    async generateVideo(prompt: string, imageUrl?: string): Promise<string> {
        const errors: string[] = [];
        for (const provider of this.providers) {
            // Check if provider has generateVideo method (duck typing)
            if ((provider as any).generateVideo) {
                try {
                    return await (provider as any).generateVideo(prompt, imageUrl);
                } catch (error: any) {
                    console.warn(`[CompositeProvider] ${this.name} video generation failed with ${provider.constructor.name}:`, error.message);
                    errors.push(`${provider.constructor.name}: ${error.message}`);
                }
            }
        }
        throw new Error(`All providers failed for ${this.name} video generation: ${errors.join('; ')}`);
    }
}
