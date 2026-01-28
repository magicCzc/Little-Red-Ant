
import { BrowserService } from './BrowserService.js';
import { Logger } from '../LoggerService.js';

// Define channel mapping
const CHANNEL_MAP: Record<string, string> = {
    'recommend': 'homefeed_recommend',
    'video': 'homefeed.video_v3',
    'fashion': 'homefeed.fashion_v3',
    'beauty': 'homefeed.cosmetics_v3',
    'food': 'homefeed.food_v3',
    'home': 'homefeed.home_v3',
    'travel': 'homefeed.travel_v3',
    'tech': 'homefeed.tech_digital_v3',
    'emotion': 'homefeed.love_v3',
    'baby': 'homefeed.baby_v3',
    'movie': 'homefeed.movie_and_tv_v3',
    'knowledge': 'homefeed.education_v3',
    'game': 'homefeed.game_v3',
    'fitness': 'homefeed.fitness_v3',
    'career': 'homefeed.career_v3',
    'pets': 'homefeed.pets_v3',
    'photography': 'homefeed.photography_v3',
    'art': 'homefeed.art_v3',
    'music': 'homefeed.music_v3',
    'books': 'homefeed.books_v3',
    'automobile': 'homefeed.automotive_v3',
    'wedding': 'homefeed.wedding_v3',
    'outdoors': 'homefeed.outdoors_v3',
    'acg': 'homefeed.anime_v3',
    'sports': 'homefeed.sports_v3',
    'news': 'homefeed.news_v3'
};

export async function scrapeTrending(category: string = 'recommend') {
    let session;
    try {
        session = await BrowserService.getInstance().getAuthenticatedPage('MAIN_SITE', true);
    } catch (e) {
        Logger.warn('RPA:Trends', 'Session issue, trying fallback...');
        throw new Error('Need active session to scrape trends efficiently.');
    }

    const { page } = session;
    const collectedNotes = new Map(); // Use Map to deduplicate by ID

    // Setup listener for Feed API
    const responseHandler = async (response: any) => {
        try {
            const url = response.url();
            
            // Match feed APIs
            if (url.includes('/api/sns/web/v1/homefeed') || url.includes('/api/sns/web/v1/feed')) {
                Logger.info('RPA:Trends', `Intercepted feed response: ${url}`);
                const json = await response.json();
                
                if (json.data && Array.isArray(json.data.items)) {
                    json.data.items.forEach((item: any) => {
                        // Ensure it's a note (model_type might be 'note', 'video', etc. or just check ID)
                        if (item.id && (item.model_type === 'note' || !item.model_type)) {
                            // Construct valid URL with xsec_token
                            // Fallback token if missing (though usually present in API)
                            // Try to find token in item or item.note_card
                            const token = item.xsec_token || item.note_card?.xsec_token || '';
                            const noteUrl = `https://www.xiaohongshu.com/explore/${item.id}?xsec_token=${token}&xsec_source=pc_feed`;
                            
                            // Extract cover
                            // Usually images_list[0].url_default or url
                            let cover = '';
                            if (item.cover) {
                                cover = item.cover.url_default || item.cover.url;
                            } else if (item.note_card && item.note_card.cover) {
                                cover = item.note_card.cover.url_default || item.note_card.cover.url;
                            } else if (item.images_list && item.images_list.length > 0) {
                                cover = item.images_list[0].url_default || item.images_list[0].url;
                            } else if (item.note_card && item.note_card.images_list && item.note_card.images_list.length > 0) {
                                cover = item.note_card.images_list[0].url_default || item.note_card.images_list[0].url;
                            }

                            if (cover && cover.startsWith('http://')) cover = cover.replace('http://', 'https://');

                            // Parse heat (likes count)
                            let rawHeat = item.interact_info?.liked_count || item.note_card?.interact_info?.liked_count || '0';
                            let heat = 0;
                            if (typeof rawHeat === 'number') {
                                heat = rawHeat;
                            } else if (typeof rawHeat === 'string') {
                                if (rawHeat.includes('万')) {
                                    heat = parseFloat(rawHeat.replace('万', '')) * 10000;
                                } else if (rawHeat.includes('w')) {
                                    heat = parseFloat(rawHeat.replace('w', '')) * 10000;
                                } else {
                                    heat = parseInt(rawHeat, 10) || 0;
                                }
                            }

                            // Parse comments count (Feed usually doesn't have it, so return -1 to indicate unknown)
                            // If it exists (unlikely in feed), parse it. If not, -1.
                            let rawComments = item.interact_info?.comment_count || item.note_card?.interact_info?.comment_count;
                            let comments = -1; 
                            if (rawComments !== undefined && rawComments !== null) {
                                if (typeof rawComments === 'number') {
                                    comments = rawComments;
                                } else if (typeof rawComments === 'string') {
                                    if (rawComments.includes('万')) {
                                        comments = parseFloat(rawComments.replace('万', '')) * 10000;
                                    } else if (rawComments.includes('w')) {
                                        comments = parseFloat(rawComments.replace('w', '')) * 10000;
                                    } else {
                                        comments = parseInt(rawComments, 10) || 0;
                                    }
                                }
                            }

                            // Parse collects count (Feed usually doesn't have it, so return -1)
                            let rawCollects = item.interact_info?.collected_count || item.note_card?.interact_info?.collected_count;
                            let collects = -1;
                            if (rawCollects !== undefined && rawCollects !== null) {
                                if (typeof rawCollects === 'number') {
                                    collects = rawCollects;
                                } else if (typeof rawCollects === 'string') {
                                    if (rawCollects.includes('万')) {
                                        collects = parseFloat(rawCollects.replace('万', '')) * 10000;
                                    } else if (rawCollects.includes('w')) {
                                        collects = parseFloat(rawCollects.replace('w', '')) * 10000;
                                    } else {
                                        collects = parseInt(rawCollects, 10) || 0;
                                    }
                                }
                            }

                            // Detect Video
                            const isVideo = item.model_type === 'video' || item.type === 'video' || (item.note_card && item.note_card.type === 'video');

                            collectedNotes.set(item.id, {
                                title: item.display_title || item.title || item.note_card?.display_title || item.note_card?.title || '',
                                heat: heat,
                                comments: comments,
                                collects: collects,
                                url: noteUrl,
                                cover: cover,
                                author: item.user?.nickname || item.note_card?.user?.nickname || '',
                                summary: item.desc || item.note_card?.desc || '',
                                is_video: isVideo
                            });
                        }
                    });
                }
            }
        } catch (e) {
            // Ignore JSON parse errors or other issues
        }
    };

    page.on('response', responseHandler);

    try {
        const channelId = CHANNEL_MAP[category] || 'homefeed_recommend';
        const targetUrl = `https://www.xiaohongshu.com/explore?channel_id=${channelId}`;
        
        Logger.info('RPA:Trends', `Navigating to ${targetUrl} (Category: ${category})...`);
        
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        // Scroll to trigger API calls
        Logger.info('RPA:Trends', 'Scrolling to load content...');
        for (let i = 0; i < 6; i++) { // Increase scroll count
            await page.evaluate(() => { window.scrollBy(0, 1000); });
            await page.waitForTimeout(1500);
        }
        
        // Remove listener
        page.off('response', responseHandler);
        
        const results = Array.from(collectedNotes.values());
        Logger.info('RPA:Trends', `Scraped ${results.length} trending notes for ${category}.`);
        
        return results;

    } catch (error: any) {
        Logger.error('RPA:Trends', `Scrape failed: ${error.message}`, error);
        throw error;
    } finally {
        if (session && session.browser) {
            try { await page.close(); } catch(e) {}
        }
    }
}
