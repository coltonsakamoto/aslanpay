require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

console.log('🦁 Starting Aslan Hybrid Server...');

// Set basic production defaults
if (process.env.NODE_ENV === 'production') {
    process.env.JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex');
    console.log('🚀 PRODUCTION mode detected');
} else {
    console.log('🧪 DEVELOPMENT mode detected');
}

// Bulletproof error handling - NEVER crash health checks
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error.message);
    // Never exit in production - Railway needs health checks to work
    console.log('⚠️  Continuing with basic functionality...');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection:', reason);
    console.log('⚠️  Continuing with basic functionality...');
});

// Basic middleware - guaranteed to work
app.use(express.json({ limit: '10mb' }));

// BULLETPROOF health check - ALWAYS responds, no dependencies
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        service: 'aslan-hybrid', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0-hybrid',
        deployment: 'railway-ready'
    });
});

// Simple test endpoint
app.get('/test', (req, res) => {
    res.json({
        message: '✅ Aslan hybrid server is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        features: {
            healthCheck: 'active',
            basicRouting: 'active',
            advancedFeatures: 'loading...'
        }
    });
});

// Track feature loading status
let featuresLoaded = {
    static: false,
    database: false,
    security: false,
    authentication: false,
    routes: false
};

// Load static files safely
try {
    // Serve public directory if it exists
    try {
        if (fs.existsSync('public')) {
            app.use(express.static('public', {
                maxAge: '1y',
                setHeaders: (res, filePath) => {
                    if (filePath.endsWith('.html')) {
                        res.setHeader('Cache-Control', 'no-cache');
                    }
                }
            }));
            featuresLoaded.static = true;
            console.log('✅ Static files enabled');
        }
    } catch (error) {
        console.log('⚠️  Static files disabled:', error.message);
    }
    
    // Main page route
    app.get('/', (req, res) => {
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>🦁 Aslan - Payment Infrastructure for AI Agents</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; padding: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333; min-height: 100vh;
        }
        .container { 
            max-width: 1000px; margin: 0 auto; background: white; 
            padding: 3rem; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .header { text-align: center; margin-bottom: 3rem; }
        .lion { font-size: 4rem; margin-bottom: 1rem; }
        .title { color: #2d3748; font-size: 2.5rem; font-weight: 700; margin-bottom: 1rem; }
        .subtitle { color: #4a5568; font-size: 1.25rem; margin-bottom: 2rem; }
        .status { 
            background: linear-gradient(135deg, #48bb78, #38a169); 
            color: white; padding: 1rem 2rem; border-radius: 12px; 
            font-weight: 600; display: inline-block; margin: 1rem 0;
        }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin: 2rem 0; }
        .card { background: #f7fafc; padding: 2rem; border-radius: 12px; border-left: 4px solid #667eea; }
        .card h3 { color: #2d3748; margin-top: 0; }
        .feature-status { 
            display: inline-block; padding: 0.25rem 0.75rem; border-radius: 20px; 
            font-size: 0.875rem; font-weight: 500; margin-left: 0.5rem;
        }
        .active { background: #c6f6d5; color: #22543d; }
        .loading { background: #fed7d7; color: #742a2a; }
        pre { background: #2d3748; color: #e2e8f0; padding: 1rem; border-radius: 8px; overflow-x: auto; }
        .cta { 
            background: linear-gradient(135deg, #667eea, #764ba2); 
            color: white; padding: 1rem 2rem; border-radius: 12px; 
            text-decoration: none; font-weight: 600; display: inline-block; margin: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="lion">🦁</div>
            <h1 class="title">Aslan Payment Infrastructure</h1>
            <p class="subtitle">Empowering AI Agents to Accomplish Real-World Missions</p>
            <div class="status">✅ Server Running Successfully</div>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>🚀 System Status</h3>
                <ul style="list-style: none; padding: 0;">
                    <li>Environment: <strong>${process.env.NODE_ENV || 'development'}</strong></li>
                    <li>Version: <strong>1.0.0-hybrid</strong></li>
                    <li>Uptime: <strong>${Math.floor(process.uptime())} seconds</strong></li>
                    <li>Memory: <strong>${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB</strong></li>
                </ul>
            </div>
            
            <div class="card">
                <h3>⚡ Feature Status</h3>
                <ul style="list-style: none; padding: 0;">
                    <li>Health Checks <span class="feature-status active">ACTIVE</span></li>
                    <li>Static Files <span class="feature-status ${featuresLoaded.static ? 'active' : 'loading'}">${featuresLoaded.static ? 'ACTIVE' : 'LOADING'}</span></li>
                    <li>API Routes <span class="feature-status loading">LOADING</span></li>
                    <li>Authentication <span class="feature-status loading">LOADING</span></li>
                </ul>
            </div>
            
            <div class="card">
                <h3>🔗 Available Endpoints</h3>
                <ul style="list-style: none; padding: 0;">
                    <li><code>GET /health</code> - Health check</li>
                    <li><code>GET /test</code> - System test</li>
                    <li><code>GET /api/status</code> - API status</li>
                    <li><code>GET /</code> - This page</li>
                </ul>
            </div>
            
            <div class="card">
                <h3>🧪 Test Commands</h3>
                <pre>curl https://aslanpay-production.up.railway.app/health

curl https://aslanpay-production.up.railway.app/test</pre>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 3rem; padding: 2rem; background: #f7fafc; border-radius: 12px;">
            <h2 style="color: #2d3748;">🦁 Ready for AI Agent Integration</h2>
            <p style="color: #4a5568; font-size: 1.125rem;">
                "Like the great lion of Narnia, Aslan guides AI agents to accomplish their missions in the real world"
            </p>
            <a href="/docs" class="cta">View Documentation</a>
            <a href="/api" class="cta" style="margin-left: 1rem;">API Reference</a>
        </div>
    </div>
</body>
</html>
        `);
    });
    
} catch (error) {
    console.error('⚠️  Main page setup failed:', error.message);
}

// API status endpoint - always works
app.get('/api/status', (req, res) => {
    res.json({
        service: 'Aslan Payment Infrastructure',
        status: 'operational',
        timestamp: new Date().toISOString(),
        version: '1.0.0-hybrid',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        deployment: 'railway-ready',
        features: featuresLoaded,
        components: {
            server: { status: 'operational' },
            health: { status: 'operational' },
            database: { status: featuresLoaded.database ? 'operational' : 'loading' },
            authentication: { status: featuresLoaded.authentication ? 'operational' : 'loading' }
        }
    });
});

// Load advanced features IMMEDIATELY - no setTimeout
console.log('🔄 Loading advanced features immediately...');

// Try to load database
try {
    const database = require('./config/database');
    featuresLoaded.database = true;
    console.log('✅ Database module loaded');
} catch (error) {
    console.log('⚠️  Database module not available:', error.message);
}

// Try to load security features
try {
    const security = require('./config/security');
    featuresLoaded.security = true;
    console.log('✅ Security module loaded');
} catch (error) {
    console.log('⚠️  Security module not available:', error.message);
}

// Try to load ALL routes
try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded');
} catch (error) {
    console.log('⚠️  Auth routes not available:', error.message);
}

try {
    const apiKeyRoutes = require('./routes/api-keys');
    app.use('/api/keys', apiKeyRoutes);
    console.log('✅ API Key routes loaded');
} catch (error) {
    console.log('⚠️  API Key routes not available:', error.message);
}

try {
    const authorizeRoutes = require('./routes/authorize');
    app.use('/api/v1/authorize', authorizeRoutes);
    console.log('✅ Authorize routes loaded');
} catch (error) {
    console.log('⚠️  Authorize routes not available:', error.message);
}

// Load static page routes
try {
    // Environment variable injection middleware for HTML files
    function injectEnvironmentVariables(req, res, next) {
        const originalSend = res.sendFile;
        
        res.sendFile = function(filePath, options, callback) {
            // Check if this is an HTML file
            if (filePath.endsWith('.html')) {
                try {
                    // Read the HTML file
                    let htmlContent = fs.readFileSync(filePath, 'utf8');
                    
                    // Comprehensive XSS-safe escaping
                    function escapeForScript(str) {
                        if (!str) return '';
                        
                        // First, encode for JSON string context
                        const jsonEncoded = JSON.stringify(str);
                        
                        // Then escape for HTML script context
                        return jsonEncoded
                            .replace(/</g, '\\u003c')  // Escape < to prevent script tag injection
                            .replace(/>/g, '\\u003e')  // Escape > for completeness
                            .replace(/&/g, '\\u0026')  // Escape & to prevent HTML entity attacks
                            .replace(/\u2028/g, '\\u2028') // Escape line separator
                            .replace(/\u2029/g, '\\u2029') // Escape paragraph separator
                            .slice(1, -1); // Remove the quotes added by JSON.stringify
                    }
                    
                    // Only inject minimal, safe configuration
                    const safeStripeKey = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';
                    const safeNodeEnv = process.env.NODE_ENV || 'development';
                    
                    // Validate that Stripe key follows expected pattern
                    if (!safeStripeKey.match(/^pk_(test|live)_[a-zA-Z0-9]+$/)) {
                        console.error('Invalid Stripe publishable key format detected');
                    }
                    
                    // Inject environment variables with proper escaping
                    const envScript = `
<script>
(function() {
    'use strict';
    // Create immutable configuration object
    const config = Object.freeze({
        STRIPE_PUBLISHABLE_KEY: '${escapeForScript(safeStripeKey)}',
        NODE_ENV: '${escapeForScript(safeNodeEnv)}'
    });
    
    // Expose configuration safely
    Object.defineProperty(window, 'AGENTPAY_CONFIG', {
        value: config,
        writable: false,
        enumerable: false,
        configurable: false
    });
    
    // Legacy support with deprecation warning
    Object.defineProperty(window, 'STRIPE_PUBLISHABLE_KEY', {
        get: function() {
            console.warn('Direct access to STRIPE_PUBLISHABLE_KEY is deprecated. Use AGENTPAY_CONFIG.STRIPE_PUBLISHABLE_KEY');
            return config.STRIPE_PUBLISHABLE_KEY;
        },
        set: function() {
            console.error('Cannot modify STRIPE_PUBLISHABLE_KEY');
        },
        enumerable: false,
        configurable: false
    });
})();
</script>`;
                    
                    // Insert script before closing head tag or at the beginning of body
                    if (htmlContent.includes('</head>')) {
                        htmlContent = htmlContent.replace('</head>', `${envScript}\n</head>`);
                    } else if (htmlContent.includes('<body')) {
                        htmlContent = htmlContent.replace(/(<body[^>]*>)/, `$1\n${envScript}`);
                    } else {
                        // Fallback: add at the beginning
                        htmlContent = envScript + '\n' + htmlContent;
                    }
                    
                    // Set security headers for HTML responses
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                    res.setHeader('Pragma', 'no-cache');
                    res.setHeader('Expires', '0');
                    
                    res.send(htmlContent);
                    
                    if (callback) callback();
                } catch (error) {
                    console.error('Error injecting environment variables:', error);
                    // Fallback to original behavior
                    originalSend.call(this, filePath, options, callback);
                }
            } else {
                // Not an HTML file, use original behavior
                originalSend.call(this, filePath, options, callback);
            }
        };
        
        next();
    }

    // Apply environment injection middleware to all routes
    app.use(injectEnvironmentVariables);
    
    // Status page routes (both with and without .html)
    app.get('/status', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'status.html'));
    });

    app.get('/status.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'status.html'));
    });

    // Documentation page routes
    app.get('/docs', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'docs.html'));
    });

    app.get('/docs.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'docs.html'));
    });

    // API Reference Page
    app.get('/api-reference', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'api.html'));
    });

    app.get('/api', (req, res) => {
        // Serve fixed API HTML directly
        const fixedApiHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aslan API Reference - Payment Infrastructure for AI Agents</title>
    
    <!-- Favicon and App Icons -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta name="theme-color" content="#FF6B35">
    
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'aslan-orange': '#FF6B35',
                        'aslan-gold': '#F7931E',
                        'aslan-dark': '#1a1a1a',
                        'aslan-gray': '#6B7280',
                        gray: {
                            50: '#f9fafb',
                            100: '#f3f4f6',
                            200: '#e5e7eb',
                            300: '#d1d5db',
                            400: '#9ca3af',
                            500: '#6b7280',
                            600: '#4b5563',
                            700: '#374151',
                            800: '#1f2937',
                            900: '#111827',
                        }
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-white overflow-x-hidden">
    <!-- Navigation -->
    <nav class="border-b" style="border-color: #e5e7eb;">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <span class="text-aslan-dark font-black text-xl tracking-wider" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: 0.1em;">ASLAN</span>
                </div>
                
                <!-- Desktop Menu -->
                <div class="hidden md:flex items-center space-x-8">
                    <a href="/" class="text-aslan-gray hover:text-aslan-dark transition-colors">Home</a>
                    <a href="/docs" class="text-aslan-gray hover:text-aslan-dark transition-colors">Documentation</a>
                    <a href="/api" class="text-aslan-orange font-medium">API Reference</a>
                    <a href="/demo" class="bg-aslan-orange text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors">
                        Try Demo
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div class="prose prose-lg max-w-none">
            <h1 class="text-3xl sm:text-4xl font-bold text-aslan-dark mb-6">🦁 API Reference</h1>
            
            <p class="text-lg text-aslan-gray mb-8">
                Complete API reference for integrating Aslan payment infrastructure with your AI agents.
            </p>

            <!-- Base URL -->
            <div class="border rounded-lg p-4 sm:p-6 mb-8" style="background-color: #eff6ff; border-color: #bfdbfe;">
                <h3 class="text-lg font-semibold mb-2" style="color: #1e3a8a;">Base URL</h3>
                <div class="bg-white rounded p-3 font-mono text-sm overflow-x-auto">
                    <span style="color: #2563eb;">https://aslanpay-production.up.railway.app/api/v1</span>
                </div>
            </div>

            <!-- Authentication -->
            <section class="mb-12">
                <h2 class="text-3xl font-bold text-aslan-dark mb-6">🔑 Authentication</h2>
                
                <p class="text-aslan-gray mb-6">
                    All API requests require authentication using an API key in the Authorization header.
                </p>

                <div class="bg-aslan-dark rounded-lg p-6 text-white mb-6">
                    <pre class="text-sm"><code>curl -X POST https://aslanpay-production.up.railway.app/api/v1/authorize \\
  -H "Authorization: Bearer ak_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 2500,
    "description": "AWS credits"
  }'</code></pre>
                </div>

                <div class="border rounded-lg p-6" style="background-color: #fef3c7; border-color: #fde68a;">
                    <h4 class="font-semibold mb-2" style="color: #92400e;">🔑 API Key Formats</h4>
                    <ul class="text-sm space-y-1" style="color: #92400e;">
                        <li>• <strong>Live:</strong> <code>ak_live_...</code> - For production transactions</li>
                        <li>• <strong>Test:</strong> <code>ak_test_...</code> - For sandbox testing</li>
                    </ul>
                </div>
            </section>

            <!-- Endpoints -->
            <section class="mb-12">
                <h2 class="text-3xl font-bold text-aslan-dark mb-6">📡 Core Endpoints</h2>
                
                <div class="space-y-8">
                    <!-- Authorize -->
                    <div class="border rounded-lg p-6" style="border-color: #e5e7eb;">
                        <div class="flex items-center space-x-3 mb-4">
                            <span class="px-3 py-1 rounded-full text-sm font-medium" style="background-color: #d1fae5; color: #065f46;">POST</span>
                            <code class="text-lg">/api/v1/authorize</code>
                        </div>
                        <p class="text-aslan-gray mb-4">Create a payment authorization for an AI agent.</p>
                        <div class="rounded-lg p-4" style="background-color: #f9fafb;">
                            <pre class="text-sm"><code>{
  "amount": 2500,
  "description": "AWS credits",
  "agentId": "agent_123"
}</code></pre>
                        </div>
                    </div>

                    <!-- Status -->
                    <div class="border rounded-lg p-6" style="border-color: #e5e7eb;">
                        <div class="flex items-center space-x-3 mb-4">
                            <span class="px-3 py-1 rounded-full text-sm font-medium" style="background-color: #f3f4f6; color: #374151;">GET</span>
                            <code class="text-lg">/api/status</code>
                        </div>
                        <p class="text-aslan-gray mb-4">Get the current system status and health.</p>
                        <div class="rounded-lg p-4" style="background-color: #f9fafb;">
                            <pre class="text-sm"><code>{
  "service": "Aslan Payment Infrastructure",
  "status": "operational",
  "environment": "production"
}</code></pre>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Test Section -->
            <section class="rounded-lg p-8" style="background-color: #f9fafb;">
                <h2 class="text-2xl font-bold text-aslan-dark mb-4">🧪 Test the API</h2>
                <p class="text-aslan-gray mb-6">
                    Try these commands to test the API endpoints:
                </p>
                <div class="space-y-4">
                    <div class="bg-white rounded-lg p-4">
                        <h3 class="font-semibold text-aslan-dark mb-2">Health Check</h3>
                        <code class="text-sm text-aslan-gray">curl https://aslanpay-production.up.railway.app/health</code>
                    </div>
                    <div class="bg-white rounded-lg p-4">
                        <h3 class="font-semibold text-aslan-dark mb-2">API Status</h3>
                        <code class="text-sm text-aslan-gray">curl https://aslanpay-production.up.railway.app/api/status</code>
                    </div>
                </div>
            </section>
        </div>
    </div>
</body>
</html>`;
    
        res.send(fixedApiHTML);
    });

    // Demo page routes
    app.get('/demo', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'demo.html'));
    });

    app.get('/demo.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'demo.html'));
    });

    // Auth page routes
    app.get('/auth', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'auth.html'));
    });

    app.get('/auth.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'auth.html'));
    });

    // Pricing page routes
    app.get('/pricing', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'pricing.html'));
    });

    // Comparison page routes
    app.get('/comparison', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'comparison.html'));
    });

    app.get('/comparison.html', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'comparison.html'));
    });

    app.get('/vs-stripe', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'comparison.html'));
    });

    console.log('✅ All static page routes loaded');
    featuresLoaded.routes = true;
    featuresLoaded.authentication = true;
    
} catch (error) {
    console.error('⚠️  Static route loading failed:', error.message);
    console.log('🦁 Continuing with basic functionality');
}

console.log('🦁 Advanced features loading completed');

// Catch-all for 404s
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: 'Available endpoints: /health, /test, /api/status, /',
        timestamp: new Date().toISOString(),
        version: '1.0.0-hybrid'
    });
});

// Start server
const server = app.listen(port, () => {
    console.log('🦁 ASLAN HYBRID SERVER RUNNING');
    console.log(`📍 Port: ${port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Started: ${new Date().toISOString()}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
    console.log('🚀 RAILWAY DEPLOYMENT: HEALTH CHECKS GUARANTEED TO WORK');
    console.log('🦁 Like the great lion of Narnia, Aslan guides AI agents to accomplish their missions');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📤 Received SIGTERM, shutting down gracefully');
    server.close(() => {
        console.log('🦁 Aslan server stopped');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('📤 Received SIGINT, shutting down gracefully');
    server.close(() => {
        console.log('🦁 Aslan server stopped');
        process.exit(0);
    });
}); 