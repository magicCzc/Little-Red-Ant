import db from '../../../db.js';
import { Logger } from '../../LoggerService.js';

const DefaultSelectors = {
    Common: {
        Login: {
            Container: '.login-container, .login-box',
            PhoneInput: 'input[placeholder*="手机号"]',
            QrCode: '.qrcode-img, canvas',
            LoggedInIndicators: {
                Creator: '.menu-container, #side-bar, .avatar-container, .publish-btn',
                MainSite: '.user-container, .avatar-wrapper, #user-avatar, .user-avatar, .red-header-avatar, a[href*="/user/profile"], .side-bar, .channel-list'
            },
            LoggedOutIndicators: {
                MainSite: '.login-btn, .login-container'
            }
        },
        UserInfo: {
            Name: '.user-name, .name, .header-name, .name-box, h1, h2',
            Avatar: '.user-avatar img, .avatar-container img, .header-avatar img'
        },
        AntiBot: {
            Captcha: '.verify-slider-container, .geetest_holder',
            AccessLimit: '.access-limit-container',
            ErrorPage: '.error-container, .not-found'
        }
    },
    Publish: {
        Url: {
            Video: 'https://creator.xiaohongshu.com/publish/publish?from=menu&target=video',
            Image: 'https://creator.xiaohongshu.com/publish/publish?from=menu&target=image',
            Article: 'https://creator.xiaohongshu.com/publish/publish?from=menu&target=article'
        },
        Article: {
            StartBtn: 'button:has-text("写长文")', // Landing page button
            TitleInput: 'input[placeholder="输入标题"], textarea[placeholder="输入标题"]', // Page 1 Editor Title
            OneClickLayout: 'button:has-text("一键排版")', // Page 1 Bottom Button
            NextStep: 'button:has-text("下一步")', // Page 2 Bottom Button
        },
        Upload: {
            FileInput: '.upload-container input[type="file"], .upload-box input[type="file"], .upload-video-box input[type="file"], input[type="file"]',
            ConfirmCrop: '.crop-confirm-btn, button:has-text("确认"), button:has-text("确定")'
        },
        Form: {
            // Broaden title selectors to include div/textarea and generic inputs
            TitleInput: 'input#post-title, .title-input input, input[placeholder="输入标题"], input[type="text"], textarea[placeholder="输入标题"], div[contenteditable="true"][placeholder="输入标题"], .title-input',
            // Specialized Selectors based on UI mode
            TitleInputImage: 'input[placeholder*="填写标题"], input.c-input_inner, .title-input input',
            TitleInputArticle: 'input[placeholder="输入标题"], div[class*="title"] input, div[contenteditable="true"]',
            
            ContentEditor: '#post-textarea, .post-content, .c-input.type-textarea, div[contenteditable="true"], .ql-editor, .editor',
            PublishButton: 'button.publish-btn, button:has-text("发布")',
            SuccessIndicator: '.publish-success, .success-container, .success-tip'
        },
        AI: {
            DeclarationBtn: 'div:has-text("内容类型声明") >> text="添加内容类型声明"',
            Option: 'li:has-text("AI"), span:has-text("AI"), div:has-text("AI"), input[value*="AI"]'
        }
    },
    NoteDetail: {
        Title: '#detail-title, .note-container .title, .title',
        Content: '#detail-desc, .note-container .desc, .content, .note-text',
        Date: '.bottom-container .date, .date',
        Tags: '#hashtag, a[href*="/topic/"], .tag',
        Stats: {
            Likes: '.interact-container .like-wrapper .count, .interaction-container .like .count',
            Collects: '.interact-container .collect-wrapper .count, .interaction-container .collect .count',
            Comments: '.interact-container .chat-wrapper .count, .interaction-container .comment .count'
        },
        Media: {
            ImageList: '.swiper-slide .note-slider-img, .swiper-slide img, .note-content img',
            Video: 'video',
            VideoContainer: '.video-player-container, .player-container, .video-card',
            PlayButton: '.player-play, .play-icon'
        }
    },
    CreatorCenter: {
        NoteList: {
            Item: 'tr, div[class*="note-list-item"], div[class*="content-item"], .note-item, .note-card, .business-card, .manager-item, .publish-item',
            Title: '.title, .note-title, .name, div[class*="title"], .manager-title',
            Image: 'img'
        },
        Stats: {
            Icons: {
                Views: ['eye', 'read', 'view', 'liulan'],
                Likes: ['heart', 'like', 'dianzan'],
                Comments: ['message', 'comment', 'pinglun'],
                Collects: ['star', 'collect', 'shoucang', 'fav']
            },
            Keywords: {
                Views: ['阅读', 'View', '浏览', '小眼睛'],
                Likes: ['点赞', 'Like', '喜欢'],
                Comments: ['评论', 'Comment', '回复'],
                Collects: ['收藏', 'Collect', 'Fav']
            }
        }
    }
};

// Deep clone to create the exportable object
export const Selectors = JSON.parse(JSON.stringify(DefaultSelectors));

/**
 * Loads selectors from the database and overlays them on top of the default selectors.
 * This allows for dynamic updates without code changes.
 */
export function updateSelectorsFromDB() {
    try {
        // Safe check if table exists (in case migration hasn't run yet in dev)
        try {
            db.prepare('SELECT 1 FROM rpa_selectors LIMIT 1').get();
        } catch (e) {
            Logger.warn('Selectors', 'rpa_selectors table does not exist, skipping DB load.');
            return;
        }

        const rows = db.prepare('SELECT category, key, selector FROM rpa_selectors').all() as any[];
        
        let updateCount = 0;
        for (const row of rows) {
             // row.category = "Common.Login", row.key = "Container"
             const parts = row.category.split('.');
             let current: any = Selectors;
             let valid = true;
             
             // Traverse the path
             for (const part of parts) {
                 if (current[part] === undefined) {
                     current[part] = {}; // Create if missing
                 }
                 current = current[part];
             }
             
             if (valid) {
                 current[row.key] = row.selector;
                 updateCount++;
             }
        }
        
        if (updateCount > 0) {
            Logger.info('Selectors', `Loaded/Updated ${updateCount} selectors from DB`);
        }
    } catch (e: any) {
        Logger.error('Selectors', 'Failed to load selectors from DB', e);
    }
}

// Initialize on load
updateSelectorsFromDB();
