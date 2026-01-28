
import { BrowserService } from '../api/services/rpa/BrowserService.js';

async function inspectDetailPage() {
    const targetUrl = process.argv[2];
    if (!targetUrl) {
        console.error('Please provide a URL');
        process.exit(1);
    }

    console.log(`Navigating to ${targetUrl}...`);
    const session = await BrowserService.getInstance().getAuthenticatedPage('MAIN_SITE', true);
    const { page } = session;

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Inspect the page content more broadly
    const info = await page.evaluate(() => {
        const divs = Array.from(document.querySelectorAll('div[class]'));
        const classes = divs.map(d => d.className).filter(c => c.length < 50); 
        
        const videoEl = document.querySelector('video');
        const videoContainer = document.querySelector('.video-player-container, .player-container, .video-card');
        const hasPlayButton = !!document.querySelector('.player-play, .play-icon');

        const isVideo = !!videoEl || !!videoContainer || hasPlayButton;
        
        // Check for State
        const state = (window as any).__INITIAL_STATE__;
        let noteData = null;
        if (state && state.note && state.note.noteDetailMap) {
             const keys = Object.keys(state.note.noteDetailMap);
             if (keys.length > 0) {
                 noteData = state.note.noteDetailMap[keys[0]];
             }
        }

        return {
            title: document.title,
            currentUrl: window.location.href,
            classes: [...new Set(classes)].slice(0, 50),
            isVideo,
            videoSrc: videoEl?.src,
            securityCheck: {
                hasAccessLimit: !!document.querySelector('.access-limit-container'),
                hasAlert: !!document.querySelector('.reds-alert'),
                hasVerify: document.body.innerText.includes('安全验证')
            },
            noteDataVideo: noteData ? noteData.note.video : 'Not Found',
            noteDataId: noteData ? noteData.id : 'Not Found'
        };
    });

    console.log('--- Page Inspection Info ---');
    console.log(JSON.stringify(info, null, 2));
    
    process.exit(0);
}

inspectDetailPage();
