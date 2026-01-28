
import { VideoProcessor } from '../api/services/video/VideoProcessor.js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env manually since we are running a script
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function verify() {
    console.log('🎬 Starting Video Pipeline Verification...');
    console.log('----------------------------------------');
    
    // 1. Check Env
    console.log('Checking Environment...');
    if (process.env.OPENAI_API_KEY) {
        console.log('✅ OpenAI API Key found.');
    } else {
        console.log('⚠️ OpenAI API Key NOT found. ASR step is expected to fail (but that is okay for MVP test).');
    }

    // 2. Instantiate
    console.log('\nInitializing Processor...');
    const processor = new VideoProcessor();
    
    // 3. Process
    // Big Buck Bunny 10s clip (Standard test file)
    const TEST_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';
    console.log(`\nProcessing Test Video: ${TEST_URL}`);
    
    try {
        const start = Date.now();
        const result = await processor.processVideo(TEST_URL);
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        
        console.log('\n----------------------------------------');
        console.log('🎉 Pipeline Execution Completed');
        console.log(`⏱️ Time Taken: ${duration}s`);
        console.log(`📹 Video Path: ${result.videoPath} (Cleaned)`);
        console.log(`🔊 Audio Path: ${result.audioPath} (Cleaned)`);
        console.log(`📝 Transcript Result:`);
        console.log(`> ${result.transcript}`);
        console.log('----------------------------------------');
        
        if (result.transcript.includes('失败') || result.transcript.includes('Key not found')) {
             console.log('\n💡 Tip: To enable real ASR, please configure OPENAI_API_KEY in Settings or .env');
        }

    } catch (e) {
        console.error('\n❌ Pipeline Verification Failed:', e);
    }
}

verify();
