import test from 'node:test';
import assert from 'node:assert';
import { EncryptionService } from '../EncryptionService.js';

test('EncryptionService', async (t) => {
    await t.test('should encrypt and decrypt correctly', () => {
        const original = 'test-secret-cookie-value';
        const encrypted = EncryptionService.encrypt(original);
        
        assert.notStrictEqual(encrypted, original, 'Encrypted value should be different from original');
        assert.ok(encrypted.includes(':'), 'Encrypted value should contain IV separator');
        
        const decrypted = EncryptionService.decrypt(encrypted);
        assert.strictEqual(decrypted, original, 'Decrypted value should match original');
    });

    await t.test('should handle plain text gracefully (lazy migration)', () => {
        const plainText = 'legacy-plain-text-cookie';
        const decrypted = EncryptionService.decrypt(plainText);
        assert.strictEqual(decrypted, plainText, 'Should return plain text as is if not encrypted');
    });

    await t.test('should handle empty strings', () => {
        assert.strictEqual(EncryptionService.encrypt(''), '');
        assert.strictEqual(EncryptionService.decrypt(''), '');
    });

    await t.test('should handle corrupted data safely', () => {
        const corrupted = '1234:invalid-hex-data';
        // Depending on implementation, it might return original or throw or return empty
        // Current implementation returns original on failure
        const result = EncryptionService.decrypt(corrupted);
        assert.strictEqual(result, corrupted);
    });
});
