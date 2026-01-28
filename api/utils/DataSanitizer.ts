
import { Logger } from '../services/LoggerService.js';

export class DataSanitizer {
    /**
     * Normalize Image/Video URLs to HTTPS
     */
    static normalizeUrl(url: string | null | undefined): string {
        if (!url) return '';
        if (url.startsWith('//')) return `https:${url}`;
        if (url.startsWith('http://')) return url.replace('http://', 'https://');
        return url;
    }

    /**
     * Parse counts like "1.2万", "10w+", "1,234" to integers
     */
    static parseCount(str: string | null | undefined): number {
        if (!str) return 0;
        str = str.trim().toLowerCase();
        
        try {
            if (str.includes('万') || str.includes('w')) {
                const num = parseFloat(str.replace(/[^\d.]/g, ''));
                return Math.floor(num * 10000);
            }
            // Remove commas and non-numeric chars (except dots)
            return parseInt(str.replace(/[^\d]/g, ''), 10) || 0;
        } catch (e) {
            Logger.warn('DataSanitizer', `Failed to parse count: ${str}`);
            return 0;
        }
    }

    /**
     * Sanitize text for DB storage (remove weird chars if needed, truncate)
     */
    static sanitizeText(text: string | null | undefined, maxLength = 2000): string {
        if (!text) return '';
        const trimmed = text.trim();
        return trimmed.length > maxLength ? trimmed.substring(0, maxLength) + '...' : trimmed;
    }

    /**
     * Ensure JSON is valid, return default if not
     */
    static safeJsonParse(jsonStr: string | null, defaultValue: any = {}): any {
        if (!jsonStr) return defaultValue;
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            return defaultValue;
        }
    }

    /**
     * Extract User ID from URL
     */
    static extractUserId(input: string): string {
        if (!input) return '';
        // If it's already an ID (alphanumeric, 24 chars)
        if (/^[a-fA-F0-9]{24}$/.test(input)) return input;
        
        // Handle URL formats
        // https://www.xiaohongshu.com/user/profile/5ff2e80800000000010065a3?xhsshare=...
        if (input.includes('/user/profile/')) {
            return input.split('/user/profile/')[1].split('?')[0];
        }
        
        return input;
    }
}
