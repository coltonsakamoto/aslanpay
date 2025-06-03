const axios = require('axios');
const dns = require('dns').promises;
const { URL } = require('url');
const ipRangeCheck = require('ip-range-check');

// Private IP ranges that should be blocked
const PRIVATE_IP_RANGES = [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '127.0.0.0/8',
    '169.254.0.0/16',
    'fc00::/7',
    '::1/128',
    'ff00::/8'
];

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
    'localhost',
    '*.local',
    'metadata.google.internal',
    'metadata.amazonaws.com',
    '169.254.169.254' // AWS metadata service
];

// Allowed protocols
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

class SecureHttpClient {
    /**
     * Validate URL is safe from SSRF attacks
     */
    static async validateUrl(url) {
        try {
            const parsed = new URL(url);
            
            // Check protocol
            if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
                throw new Error(`Protocol ${parsed.protocol} not allowed`);
            }
            
            // Check for blocked hostnames
            const hostname = parsed.hostname;
            for (const blocked of BLOCKED_HOSTNAMES) {
                if (blocked.includes('*')) {
                    const regex = new RegExp(blocked.replace('*', '.*'));
                    if (regex.test(hostname)) {
                        throw new Error(`Hostname ${hostname} is blocked`);
                    }
                } else if (hostname === blocked) {
                    throw new Error(`Hostname ${hostname} is blocked`);
                }
            }
            
            // Resolve hostname to IP
            const addresses = await dns.resolve4(hostname).catch(() => []);
            const ipv6Addresses = await dns.resolve6(hostname).catch(() => []);
            const allAddresses = [...addresses, ...ipv6Addresses];
            
            if (allAddresses.length === 0) {
                throw new Error(`Unable to resolve hostname ${hostname}`);
            }
            
            // Check if any resolved IP is in private range
            for (const ip of allAddresses) {
                if (ipRangeCheck(ip, PRIVATE_IP_RANGES)) {
                    throw new Error(`IP ${ip} is in private range`);
                }
            }
            
            return { valid: true, url: parsed.toString() };
            
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
    
    /**
     * Create a secure axios instance with SSRF protection
     */
    static createSecureInstance(options = {}) {
        const instance = axios.create({
            timeout: options.timeout || 30000,
            maxRedirects: options.maxRedirects || 5,
            validateStatus: (status) => status < 500,
            ...options
        });
        
        // Add request interceptor for SSRF protection
        instance.interceptors.request.use(async (config) => {
            const validation = await this.validateUrl(config.url);
            
            if (!validation.valid) {
                throw new Error(`SSRF Protection: ${validation.error}`);
            }
            
            // Add security headers
            config.headers = {
                ...config.headers,
                'User-Agent': 'AgentPay/1.0 (Security-Enhanced)',
                'X-Request-ID': require('crypto').randomUUID()
            };
            
            return config;
        });
        
        // Add response interceptor for security checks
        instance.interceptors.response.use(
            (response) => {
                // Check for suspicious redirects
                if (response.request.res && response.request.res.responseUrl) {
                    const finalUrl = response.request.res.responseUrl;
                    this.validateUrl(finalUrl).then((validation) => {
                        if (!validation.valid) {
                            console.error(`SSRF: Suspicious redirect to ${finalUrl}`);
                        }
                    });
                }
                
                return response;
            },
            (error) => {
                // Log security-relevant errors
                if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                    console.error('SecureHttp: Connection failed', {
                        url: error.config?.url,
                        code: error.code
                    });
                }
                
                return Promise.reject(error);
            }
        );
        
        return instance;
    }
    
    /**
     * Safe wrapper for making HTTP requests
     */
    static async request(method, url, options = {}) {
        const validation = await this.validateUrl(url);
        
        if (!validation.valid) {
            throw new Error(`Invalid URL: ${validation.error}`);
        }
        
        const client = this.createSecureInstance(options);
        
        return client({
            method,
            url: validation.url,
            ...options
        });
    }
    
    // Convenience methods
    static get(url, options) {
        return this.request('GET', url, options);
    }
    
    static post(url, data, options) {
        return this.request('POST', url, { ...options, data });
    }
    
    static put(url, data, options) {
        return this.request('PUT', url, { ...options, data });
    }
    
    static delete(url, options) {
        return this.request('DELETE', url, options);
    }
}

module.exports = SecureHttpClient; 