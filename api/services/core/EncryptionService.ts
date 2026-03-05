import crypto from 'crypto';
import config from '../../config.js';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16

export class EncryptionService {
    private static getKey(): Buffer {
        // Derive a 32-byte key from the secret
        // Using scrypt or just hashing the secret to ensure length
        const secret = typeof config.security.jwtSecret === 'string' 
            ? config.security.jwtSecret 
            : 'fallback-secret-if-config-fails'; // Should not happen in prod due to config check
            
        return crypto.createHash('sha256').update(secret).digest();
    }

    static encrypt(text: string): string {
        if (!text) return text;
        
        try {
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(ALGORITHM, this.getKey(), iv);
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            
            // Format: iv:encryptedData
            return iv.toString('hex') + ':' + encrypted.toString('hex');
        } catch (error) {
            console.error('[Encryption] Encrypt failed:', error);
            throw new Error('Encryption failed');
        }
    }

    static decrypt(text: string): string {
        if (!text) return text;
        
        // Lazy Migration: If it doesn't look like encrypted (no colon or wrong length), return original
        // This supports legacy plain-text cookies until they are re-saved
        if (!text.includes(':')) {
            return text;
        }

        try {
            const textParts = text.split(':');
            const ivHex = textParts.shift();
            if (!ivHex || ivHex.length !== IV_LENGTH * 2) {
                // Not a valid IV, assume plain text or corrupted
                return text; 
            }

            const iv = Buffer.from(ivHex, 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv(ALGORITHM, this.getKey(), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            
            return decrypted.toString();
        } catch (error) {
            // If decryption fails, it might be plain text that accidentally contained a colon
            // Or corrupted data. Return original to be safe (or empty string?)
            // Returning original allows "graceful failure" for legacy data
            // console.warn('[Encryption] Decrypt failed, returning original:', error);
            return text;
        }
    }
}
