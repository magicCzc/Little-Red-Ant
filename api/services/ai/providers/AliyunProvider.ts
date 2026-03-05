import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import OSS from 'ali-oss';
import { AIProvider } from '../interfaces/AIProvider.js';
import { AudioProvider } from '../interfaces/AudioProvider.js';
import { SettingsService } from '../../SettingsService.js';
import config from '../../../config.js';
import { Logger } from '../../LoggerService.js';

export class AliyunProvider implements AIProvider, AudioProvider {
    // Endpoints
    private textToImageId = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-to-image/generation';
    private multimodalUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
    private videoGenerationUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis';
    // Text Generation Endpoint (Qwen)
    private textGenerationUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    
    // ASR Endpoints
    private uploadUrl = 'https://dashscope.aliyuncs.com/api/v1/files';
    private asrUrl = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription';

    private ossClient: any = null;

    private async getOssClient() {
        if (this.ossClient) return this.ossClient;

        const region = config.ai.aliyun.ossRegion || 'oss-cn-hangzhou';
        const bucket = config.ai.aliyun.ossBucket;
        const accessKeyId = config.ai.aliyun.accessKeyId;
        const accessKeySecret = config.ai.aliyun.accessKeySecret;

        if (!bucket || !accessKeyId || !accessKeySecret) {
            throw new Error('OSS configuration missing (Bucket/AccessKey). Please check config/env');
        }

        this.ossClient = new OSS({
            region,
            accessKeyId,
            accessKeySecret,
            bucket,
            secure: true
        });

        return this.ossClient;
    }

    private async getHeaders(isAsync = true) {
        let bearerToken = '';
        
        // 1. Try DB Settings
        const dbKey = await SettingsService.get('aliyun_api_key');
        if (dbKey) bearerToken = dbKey;

        // 2. Fallback to Config
        if (!bearerToken) {
             if (config.ai.aliyun.dashscopeApiKey) {
                bearerToken = config.ai.aliyun.dashscopeApiKey;
            } else if (config.ai.aliyun.accessKeyId?.startsWith('sk-')) {
                 bearerToken = config.ai.aliyun.accessKeyId;
            }
        }
        
        if (!bearerToken || !bearerToken.startsWith('sk-')) {
            throw new Error('Invalid DashScope API Key. It must start with "sk-". Check your settings or .env file.');
        }

        const headers: any = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`
        };

        if (isAsync) {
            headers['X-DashScope-Async'] = 'enable';
        }

        return headers;
    }

    async generateText(messages: any[], options?: any): Promise<string> {
        // Aliyun Qwen API uses 'input.messages' and 'parameters'
        // Endpoint: https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
        
        // Default to qwen-plus if not specified
        const dbModel = await SettingsService.get('aliyun_text_model');
        const model = options?.model || dbModel || 'qwen-plus';
        
        // Transform standard OpenAI messages to Qwen format if needed (they are mostly compatible)
        // Qwen expects: { role: 'user'|'system'|'assistant', content: '...' }
        
        const payload = {
            model: model,
            input: {
                messages: messages
            },
            parameters: {
                result_format: 'message', // Returns OpenAI-compatible format
                temperature: options?.temperature || 0.8,
                top_p: options?.top_p || 0.8
            }
        };

        const headers = await this.getHeaders(false); // Sync call for text

        try {
            Logger.info('AliyunProvider', `Generating text with ${model}...`);
            const res = await axios.post(this.textGenerationUrl, payload, { headers });
            
            if (res.data.output?.choices?.[0]?.message?.content) {
                return res.data.output.choices[0].message.content;
            } else if (res.data.code) {
                throw new Error(`Aliyun Error: ${res.data.message}`);
            }
            
            throw new Error('No content in Aliyun response');
        } catch (error: any) {
            Logger.error('AliyunProvider', 'Text API Error', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || error.message);
        }
    }

    /**
     * Multimodal Chat (Qwen-VL)
     * @param messages Standard messages array, but content can be array of {text, image}
     */
    async generateMultimodalText(messages: any[]): Promise<string> {
        const headers = await this.getHeaders(false);
        const dbModel = await SettingsService.get('aliyun_vl_model');
        const model = dbModel || 'qwen-vl-max'; // Default to max if not set

        const payload = {
            model: model,
            input: {
                messages: messages
            }
        };

        try {
            Logger.info('AliyunProvider', `Generating multimodal text with model ${model}...`);
            const res = await axios.post(this.multimodalUrl, payload, { headers });
            
            if (res.data.output?.choices?.[0]?.message?.content) {
                // Qwen-VL returns content as array usually? No, sometimes object.
                // The API spec says choices[0].message.content is the response text/object.
                const content = res.data.output.choices[0].message.content;
                if (Array.isArray(content)) {
                    return content.map((c: any) => c.text).join('');
                }
                return typeof content === 'string' ? content : JSON.stringify(content);
            }
            throw new Error('No content in Aliyun VL response');
        } catch (error: any) {
            Logger.error('AliyunProvider', 'VL API Error', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || error.message);
        }
    }

    async generateJSON<T>(messages: any[], options?: any): Promise<T> {
        // Qwen doesn't strictly support "response_format: json_object" like OpenAI in all versions.
        // We simulate it by appending instruction to system prompt.
        
        const systemMsgIdx = messages.findIndex(m => m.role === 'system');
        const jsonInstruction = `\n\nIMPORTANT: You must output strictly valid JSON only. Do not wrap in markdown code blocks.`;
        
        if (systemMsgIdx > -1) {
            messages[systemMsgIdx].content += jsonInstruction;
        } else {
            messages.unshift({ role: 'system', content: jsonInstruction });
        }

        const raw = await this.generateText(messages, options);
        
        // Clean markdown
        const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(clean) as T;
        } catch (e) {
            Logger.error('AliyunProvider', 'JSON Parse Error', clean);
            throw new Error('Failed to parse AI response as JSON');
        }
    }

    async generateVideo(prompt: string, imageUrl?: string, options: any = {}): Promise<string> {
        // Video API is inherently async and returns a task_id immediately.
        // It typically requires the 'X-DashScope-Async' header for some account types/models (e.g., Wan2.1).
        const headers = await this.getHeaders(true); // Enable async mode
        
        const dbModel = await SettingsService.get('aliyun_video_model');
        // Default to wan2.6 if not set
        const model = options.model || dbModel || (imageUrl ? 'wan2.6-i2v-flash' : 'wan2.6-t2v'); 
        
        const payload: any = {
            model: model,
            input: {
                prompt: prompt
            },
            parameters: {
                size: "1280*720",
                duration: 5,
                n: 1
            }
        };

        if (imageUrl) {
            payload.input.image_url = imageUrl;
        }

        try {
            Logger.info('AliyunProvider', `Submitting video task (${model})...`);
            // 1. Submit Task
            const submitRes = await axios.post(this.videoGenerationUrl, payload, { headers });
            
            if (!submitRes.data.output?.task_id) {
                throw new Error('Failed to get task_id from Aliyun video submission');
            }
            
            const taskId = submitRes.data.output.task_id;
            Logger.info('AliyunProvider', `Video task submitted: ${taskId}`);

            // 2. Poll for Result
            // Remove Async Header for polling
            const pollHeaders = await this.getHeaders(false);

            let attempts = 0;
            const maxAttempts = 120; // 120 * 5s = 10 minutes max
            
            while (attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 5000)); // Wait 5s
                attempts++;
                
                const taskUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
                const pollRes = await axios.get(taskUrl, { headers: pollHeaders });
                const taskStatus = pollRes.data.output?.task_status;
                
                if (taskStatus === 'SUCCEEDED') {
                    const videoUrl = pollRes.data.output.video_url;
                    if (!videoUrl) throw new Error('Task succeeded but no video_url found');
                    return videoUrl;
                } else if (taskStatus === 'FAILED' || taskStatus === 'CANCELED') {
                    throw new Error(`Aliyun video task failed: ${pollRes.data.output?.message || 'Unknown error'}`);
                }
                
                Logger.debug('AliyunProvider', `Polling video task ${taskId}: ${taskStatus} (${attempts}/${maxAttempts})`);
            }
            
            throw new Error('Video generation timed out');

        } catch (error: any) {
             Logger.error('AliyunProvider', 'Video API Error', error.response?.data || error.message);
             throw new Error(error.response?.data?.message || error.message);
        }
    }

    async generateImage(prompt: string, options: any = {}): Promise<string> {
        // Allow model override from settings
        const dbModel = await SettingsService.get('aliyun_image_model');
        const model = options.model || dbModel || 'wanx-v1';
        
        // For Image generation, "wanx-v1" and "wanx-v2" support async, but sync is usually preferred for simplicity if allowed.
        // However, the error "current user api does not support asynchronous calls" implies we might be sending Async header when we shouldn't, or vice versa.
        // If we are using qwen-image-plus (multimodal), it might not support async in some regions/users.
        // Let's try disabling async for image generation by default unless explicitly needed.
        
        const isAsync = false; // Force sync for image generation to fix "AccessDenied"
        const headers = await this.getHeaders(isAsync);
        
        let payload: any;
        let apiUrl = this.multimodalUrl;

        // Support Reference Image (Image-to-Image)
        // If ref_img is provided, we must use a model that supports it (e.g. wanx-v1 with ref_img, or wanx-style-repaint)
        // Currently Aliyun Wanx V1 supports `ref_img` parameter for Style Repaint or similar tasks.
        // Or "wanx-background-generation" etc.
        // For standard "wanx-v1" text-to-image, it might not support ref_img directly in the same payload structure.
        // Let's assume we use 'wanx-v1' and check if we need to switch model or payload.
        
        // Wanx V1 documentation: https://help.aliyun.com/zh/dashscope/developer-reference/api-details-9
        // Input can have 'ref_img' for "style_ref" or similar.
        
        if (options.ref_img && model.includes('wanx')) {
             Logger.info('AliyunProvider', `Using Reference Image: ${options.ref_img}`);
             apiUrl = this.textToImageId;
             payload = {
                model: model,
                input: { 
                    prompt: prompt,
                    ref_img: options.ref_img 
                },
                parameters: {
                    style: "<auto>",
                    size: "1024*1024",
                    n: 1,
                    // ref_strength: 0.5 // Optional, default 0.5
                }
            };
        } else if (model.includes('wanx')) {
            apiUrl = this.textToImageId; // Wanx uses Text-to-Image endpoint
            payload = {
                model: model,
                input: { prompt: prompt },
                parameters: {
                    style: "<auto>",
                    size: "1024*1024",
                    n: 1
                }
            };
        } else {
            // Qwen or other multimodal models
            // Qwen-VL normally is for understanding, Qwen-Image-Plus is for generation.
            // Qwen-Image-Plus doesn't support ref_img in the same way as Wanx.
            payload = {
                model: model,
                input: {
                    messages: [{ role: "user", content: [{ text: prompt }] }]
                },
                parameters: { size: "1024*1024", n: 1 }
            };
        }

        try {
            Logger.info('AliyunProvider', `Generating image with model ${model} at ${apiUrl}...`);
            if (model.includes('wanx')) {
                Logger.debug('AliyunProvider', `Final Prompt: ${payload.input.prompt}`);
            } else {
                Logger.debug('AliyunProvider', `Final Prompt: ${payload.input.messages[0].content[0].text}`);
            }
            
            const res = await axios.post(apiUrl, payload, { headers });
            
            // Parse response
            if (res.data.output?.choices?.[0]?.message?.content) {
                const content = res.data.output.choices[0].message.content;
                if (Array.isArray(content)) {
                    const imgItem = content.find((c: any) => c.image || c.img);
                    if (imgItem) return imgItem.image || imgItem.img;
                }
            }
            if (res.data.output?.results?.[0]?.url) {
                return res.data.output.results[0].url;
            }
            // Wanx sync response structure
            if (res.data.output?.task_status === 'SUCCEEDED' && res.data.output?.results) {
                 return res.data.output.results[0].url;
            }
            
            throw new Error('No image URL found in Aliyun response');
        } catch (error: any) {
            Logger.error('AliyunProvider', 'Image API Error', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || error.message);
        }
    }

    async uploadFile(filePath: string): Promise<string> {
        // Reuse upload logic from transcribe
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        try {
            // Use OSS if configured
            const client = await this.getOssClient();
            const ext = filePath.split('.').pop() || 'jpg';
            const objectName = `images/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            
            await client.put(objectName, filePath);
            // Use signatureUrl for secure access (default 3600s expiration)
            let url = client.signatureUrl(objectName, { expires: 3600 });
            return url.replace('http://', 'https://');
        } catch (e: any) {
             Logger.warn('AliyunProvider', 'OSS Upload failed, trying DashScope upload...', e.message);
             // DashScope Upload fallback for Qwen-VL (uses DashScope File API)
             // https://help.aliyun.com/zh/dashscope/developer-reference/upload-file
             try {
                const form = new FormData();
                form.append('file', fs.createReadStream(filePath));
                form.append('purpose', 'file-extract'); // or 'multimodal' depending on API requirements, usually 'file-extract' for general use
                
                const headers = await this.getHeaders(false);
                // DashScope file upload endpoint: https://dashscope.aliyuncs.com/api/v1/files
                // Note: The generic getHeaders adds Content-Type: application/json, we need to let FormData set it.
                delete headers['Content-Type']; 
                
                const res = await axios.post(this.uploadUrl, form, { headers: { ...headers, ...form.getHeaders() } });
                if (res.data.output?.uploaded_file_url) {
                    return res.data.output.uploaded_file_url;
                } else if (res.data.id) {
                    // Some APIs return file id like "file-fe..." which can be used in messages directly as "fileid://..."
                    return `fileid://${res.data.id}`;
                }
                throw new Error('No file URL in DashScope response');
             } catch (dashError: any) {
                 throw new Error(`All upload methods failed. OSS: ${e.message}, DashScope: ${dashError.message}`);
             }
        }
    }

    async transcribe(audioPath: string): Promise<string> {
        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        let audioUrl = '';

        try {
            // 1. Upload to OSS (Preferred for Paraformer)
            Logger.info('AliyunProvider', `Uploading file ${audioPath} to OSS...`);
            const client = await this.getOssClient();
            
            // Generate a unique object name
            const objectName = `audio/${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
            
            const result = await client.put(objectName, audioPath);
            
            // OSS usually returns result.url which might be http. Force https if needed.
            // audioUrl = result.url.replace('http://', 'https://');
            
            // Use signatureUrl for secure access (default 3600s expiration)
            audioUrl = client.signatureUrl(objectName, { expires: 3600 });
            // Ensure https
            audioUrl = audioUrl.replace('http://', 'https://');
            
            Logger.info('AliyunProvider', `OSS Upload success (Signed URL): ${audioUrl}`);

        } catch (ossError: any) {
            Logger.warn('AliyunProvider', 'OSS Upload failed, falling back to DashScope Upload:', ossError.message);
            // If OSS fails (e.g. not configured), throw error since we committed to OSS strategy
            throw new Error(`OSS Upload Failed: ${ossError.message}. Please configure ALIYUN_OSS_* env vars.`);
        }

        // 2. Transcribe using Paraformer (file-transcription)
        try {
             // ASR Task submission usually requires Async header
             const asrHeaders = await this.getHeaders(true);
             const dbModel = await SettingsService.get('aliyun_audio_model');
             const model = dbModel || 'paraformer-8k-v1'; // Default
             
             const payload = {
                 model: model,
                 input: {
                     file_urls: [audioUrl] 
                 },
                 parameters: {
                    auto_chapters: false
                 }
             };

             Logger.info('AliyunProvider', `Submitting ASR task (${payload.model})...`);
             const asrRes = await axios.post(this.asrUrl, payload, { headers: asrHeaders });
             
             if (!asrRes.data.output?.task_id) {
                 throw new Error(`Aliyun ASR Task Failed: ${JSON.stringify(asrRes.data)}`);
             }
             const taskId = asrRes.data.output.task_id;
             Logger.info('AliyunProvider', `ASR Task submitted: ${taskId}`);

             // 3. Poll
             return await this.pollAsrTask(taskId, asrHeaders);

        } catch (error: any) {
             Logger.error('AliyunProvider', 'ASR Error', error.response?.data || error.message);
             throw new Error(error.response?.data?.message || error.message);
        }
    }

    // Deprecated: Paraformer polling (kept for reference or future OSS support)
    private async pollAsrTask(taskId: string, headers: any): Promise<string> {
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes max
        
        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 3000));
            attempts++;
            
            const taskUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
            const res = await axios.get(taskUrl, { headers });
            const status = res.data.output?.task_status;
            
            if (status === 'SUCCEEDED') {
                const results = res.data.output?.results;
                if (results && results.length > 0) {
                     // Extract text
                     let text = '';
                     if (results[0].sentences) {
                         text = results[0].sentences.map((s: any) => s.text).join('');
                     } else if (results[0].text) {
                         text = results[0].text;
                     }
                     return text;
                }
                return '';
            } else if (status === 'FAILED' || status === 'CANCELED') {
                 throw new Error(`ASR Task Failed: ${res.data.output?.message}`);
            }
            
            if (attempts % 5 === 0) Logger.debug('AliyunProvider', `Polling ASR ${taskId}: ${status}`);
        }
        throw new Error('ASR Task Timeout');
    }
}
