const crypto = require('crypto');

/**
 * Secure random number generation utilities
 * Replaces Math.random() with cryptographically secure alternatives
 */
class SecureRandom {
    /**
     * Generate a secure random float between 0 (inclusive) and 1 (exclusive)
     * Replacement for Math.random()
     */
    static random() {
        // Generate 32 bits of randomness
        const randomBytes = crypto.randomBytes(4);
        const randomInt = randomBytes.readUInt32BE(0);
        
        // Convert to float between 0 and 1
        return randomInt / 0x100000000; // Divide by 2^32
    }
    
    /**
     * Generate a secure random integer between min (inclusive) and max (exclusive)
     */
    static randomInt(min, max) {
        if (min >= max) {
            throw new Error('Min must be less than max');
        }
        
        const range = max - min;
        const bytesNeeded = Math.ceil(Math.log2(range) / 8);
        const maxValue = Math.pow(256, bytesNeeded);
        
        let randomValue;
        do {
            const randomBytes = crypto.randomBytes(bytesNeeded);
            randomValue = 0;
            for (let i = 0; i < bytesNeeded; i++) {
                randomValue = (randomValue * 256) + randomBytes[i];
            }
        } while (randomValue >= maxValue - (maxValue % range));
        
        return min + (randomValue % range);
    }
    
    /**
     * Generate a secure random string of specified length
     * @param {number} length - Length of the string
     * @param {string} charset - Character set to use (default: alphanumeric)
     */
    static randomString(length, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
        const result = [];
        const charsetLength = charset.length;
        
        for (let i = 0; i < length; i++) {
            result.push(charset[this.randomInt(0, charsetLength)]);
        }
        
        return result.join('');
    }
    
    /**
     * Generate a secure random hex string
     * @param {number} bytes - Number of random bytes (output will be 2x this length)
     */
    static randomHex(bytes) {
        return crypto.randomBytes(bytes).toString('hex');
    }
    
    /**
     * Generate a secure random base64 string
     * @param {number} bytes - Number of random bytes
     */
    static randomBase64(bytes) {
        return crypto.randomBytes(bytes).toString('base64');
    }
    
    /**
     * Generate a secure random UUID v4
     */
    static randomUUID() {
        if (crypto.randomUUID) {
            return crypto.randomUUID();
        }
        
        // Fallback for older Node.js versions
        const bytes = crypto.randomBytes(16);
        
        // Set version (4) and variant bits
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        
        const hex = bytes.toString('hex');
        return [
            hex.substring(0, 8),
            hex.substring(8, 12),
            hex.substring(12, 16),
            hex.substring(16, 20),
            hex.substring(20, 32)
        ].join('-');
    }
    
    /**
     * Shuffle an array securely using Fisher-Yates algorithm
     * @param {Array} array - Array to shuffle (will be modified in place)
     */
    static shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.randomInt(0, i + 1);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    /**
     * Generate a secure random API key
     * @param {string} prefix - Key prefix (e.g., 'ak_live_')
     * @param {number} length - Length of random part (default: 32)
     */
    static generateApiKey(prefix = 'key_', length = 32) {
        return prefix + this.randomHex(length);
    }
    
    /**
     * Generate a secure session ID
     */
    static generateSessionId() {
        return 'sess_' + this.randomHex(32);
    }
    
    /**
     * Generate a secure CSRF token
     */
    static generateCsrfToken() {
        return this.randomBase64(32);
    }
}

module.exports = SecureRandom; 