
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { AudioProvider } from '../interfaces/AudioProvider.js';
import { SettingsService } from '../../SettingsService.js';

export class OpenAIAudioProvider implements AudioProvider {
    private apiUrl = 'https://api.openai.com/v1/audio/transcriptions';

    private async getApiKey(): Promise<string> {
        // Try to get OpenAI key from settings
        let apiKey = await SettingsService.get('openai_api_key');
        
        // Fallback to env
        if (!apiKey && process.env.OPENAI_API_KEY) {
            apiKey = process.env.OPENAI_API_KEY;
        }

        if (!apiKey) {
            // Check if user has a custom base URL that might imply a different provider (e.g. OpenRouter)
            // But usually OpenRouter also needs a key.
            // If no key found, check for Aliyun key and maybe warn?
            // For MVP, just throw error.
            throw new Error('OpenAI API Key not found. Please configure it in settings.');
        }
        return apiKey;
    }

    private async getBaseUrl(): Promise<string> {
        const baseUrl = await SettingsService.get('openai_base_url');
        return baseUrl || 'https://api.openai.com/v1';
    }

    async transcribe(audioPath: string): Promise<string> {
        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        const apiKey = await this.getApiKey();
        let baseUrl = await this.getBaseUrl();
        
        // Ensure base URL doesn't end with slash
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        
        // Construct full URL (handle v1 suffix if present/missing)
        // Standard OpenAI: https://api.openai.com/v1/audio/transcriptions
        // User might provide: https://api.openai.com/v1 or https://api.openai.com
        let endpoint = `${baseUrl}/audio/transcriptions`;
        if (baseUrl.endsWith('/v1')) {
             endpoint = `${baseUrl}/audio/transcriptions`;
        } else {
             // If user provided root url without v1, append v1? 
             // Safest is to assume user provides valid base like https://api.openai.com/v1
             // But for safety, let's just use what we constructed if it looks standard.
             // If user set https://openrouter.ai/api/v1, then it works.
        }

        console.log(`[OpenAIAudioProvider] Transcribing ${audioPath} via ${endpoint}...`);

        const form = new FormData();
        form.append('file', fs.createReadStream(audioPath));
        form.append('model', 'whisper-1');
        form.append('response_format', 'text'); // Plain text output

        try {
            const response = await axios.post(endpoint, form, {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': `Bearer ${apiKey}`
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });

            return response.data; // Since we requested text format
        } catch (error: any) {
            console.error('[OpenAIAudioProvider] Transcription failed:', error.response?.data || error.message);
            throw new Error(`Transcription failed: ${error.message}`);
        }
    }
}
