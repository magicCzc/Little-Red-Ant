
export const Selectors = {
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
        },
        Upload: {
            FileInput: '.upload-container input[type="file"], .upload-box input[type="file"], .upload-video-box input[type="file"], input[type="file"]',
            ConfirmCrop: '.crop-confirm-btn, button:has-text("确认"), button:has-text("确定")'
        },
        Form: {
            TitleInput: '.c-input_inner, input[placeholder*="标题"], .title-input',
            ContentEditor: '#post-textarea, .post-content, .c-input.type-textarea, div[contenteditable="true"]',
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
