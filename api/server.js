const express = require('express');
const path = require('path');
const app = express();

// --- Health-check for Railway ---
app.get('/health', (_req, res) => res.status(200).send('ok'));

// Basic middleware
app.use(express.json());

// Session middleware for authentication (simplified)
app.use(require('express-session')({
    secret: process.env.SESSION_SECRET || 'aslan-dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

// Simple in-memory store for staging testing (temporary)
const tempUsers = new Map();
const tempSessions = new Map();

// Add a test user for staging
tempUsers.set('test@aslanpay.xyz', {
    id: 'user_test_123',
    email: 'test@aslanpay.xyz',
    name: 'Test User',
    password: '$2a$12$LQv3c1yqBwEHxVi00LqOGekkfojQ1wUF9T2.F9W6GCzgNzBDgaZla' // "password123"
});

// Serve static frontend files FIRST (before API routes)
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Main page routes - serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/docs.html'));
});

app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/demo.html'));
});

app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/auth.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/signup.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/dashboard.html'));
});

app.get('/pricing', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/pricing.html'));
});

app.get('/comparison', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/comparison.html'));
});

app.get('/security', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/security.html'));
});

app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/checkout.html'));
});

app.get('/status', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/status.html'));
});

// Simple Working Auth Routes (temporary for staging testing)
app.get('/api/auth/status', (req, res) => {
    const sessionId = req.session?.id;
    const userSession = sessionId ? tempSessions.get(sessionId) : null;
    
    res.json({
        authenticated: !!userSession,
        user: userSession?.user || null,
        message: 'Authentication status'
    });
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required',
                code: 'MISSING_CREDENTIALS'
            });
        }
        
        // Check if user exists (simple test user)
        const user = tempUsers.get(email.toLowerCase());
        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }
        
        // Simple password check (for test user, accept "password123")
        if (password !== 'password123') {
            return res.status(401).json({
                error: 'Invalid email or password', 
                code: 'INVALID_CREDENTIALS'
            });
        }
        
        // Create session
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        tempSessions.set(sessionId, {
            id: sessionId,
            userId: user.id,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            createdAt: new Date()
        });
        
        // Set session in Express session
        req.session.id = sessionId;
        
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            message: 'Login successful'
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

app.post('/api/auth/logout', (req, res) => {
    const sessionId = req.session?.id;
    if (sessionId) {
        tempSessions.delete(sessionId);
        req.session.destroy();
    }
    
    res.json({ message: 'Logout successful' });
});

app.get('/api/auth/me', (req, res) => {
    const sessionId = req.session?.id;
    const userSession = sessionId ? tempSessions.get(sessionId) : null;
    
    if (!userSession) {
        return res.status(401).json({
            error: 'Not authenticated',
            code: 'NOT_AUTHENTICATED'
        });
    }
    
    res.json({ 
        user: userSession.user
    });
});

// API Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'OK',
        service: 'AslanPay API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Main authorization endpoint (simplified but functional)
app.post('/api/v1/authorize', (req, res) => {
    const { amount, service = 'unknown', description, apiKey } = req.body;
    
    // Basic validation
    if (!amount || amount <= 0) {
        return res.status(400).json({
            error: 'Invalid amount',
            code: 'INVALID_AMOUNT'
        });
    }
    
    if (!apiKey) {
        return res.status(401).json({
            error: 'API key required',
            code: 'MISSING_API_KEY'
        });
    }
    
    // Simple authorization logic
    const approved = amount <= 100; // Approve amounts <= $100
    const approvalId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    res.json({
        approved,
        amount,
        service,
        description,
        approvalId,
        timestamp: new Date().toISOString(),
        limits: {
            maxAmount: 100,
            dailyLimit: 1000
        }
    });
});

// API Keys management endpoints
app.get('/api/keys', (req, res) => {
    res.json({
        message: 'API Keys endpoint',
        action: 'list',
        keys: []
    });
});

app.post('/api/keys', (req, res) => {
    const { name, permissions = ['read'] } = req.body;
    
    if (!name) {
        return res.status(400).json({
            error: 'Key name required'
        });
    }
    
    const apiKey = `ak_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
    
    res.json({
        message: 'API key created',
        keyId: `key_${Date.now()}`,
        apiKey,
        name,
        permissions,
        created: new Date().toISOString()
    });
});

// Spending controls endpoint
app.get('/api/keys/spending-controls', (req, res) => {
    res.json({
        dailyLimit: 100,
        transactionLimit: 25,
        maxTransactions: 10,
        emergencyStop: false,
        lastUpdated: new Date().toISOString()
    });
});

// Demo authorization endpoint
app.post('/api/demo-authorize', (req, res) => {
    const { amount = 50, service = 'demo' } = req.body;
    
    res.json({
        approved: true,
        amount,
        service,
        demo: true,
        approvalId: `demo_${Date.now()}`,
        message: 'Demo authorization successful'
    });
});

// API Documentation page - restored original clean UI
app.get('/api', (req, res) => {
    const apiHTML = `<!DOCTYPE html>
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
                
                <!-- Mobile Menu Button -->
                <button id="mobile-menu-btn" class="md:hidden p-2 rounded-lg text-aslan-gray hover:text-aslan-dark" style="background-color: #f3f4f6;">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                </button>
            </div>
            
            <!-- Mobile Menu -->
            <div id="mobile-menu" class="hidden md:hidden mt-4 pb-4 border-t pt-4" style="border-color: #e5e7eb;">
                <div class="flex flex-col space-y-4">
                    <a href="/" class="text-aslan-gray hover:text-aslan-dark transition-colors">Home</a>
                    <a href="/docs" class="text-aslan-gray hover:text-aslan-dark transition-colors">Documentation</a>
                    <a href="/api" class="text-aslan-orange font-medium">API Reference</a>
                    <a href="/demo" class="bg-aslan-orange text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors text-center">
                        Try Demo
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div class="grid lg:grid-cols-4 gap-8">
            <!-- Sidebar -->
            <div class="lg:col-span-1">
                <div class="sticky top-8 space-y-6">
                    <div>
                        <h3 class="text-lg font-semibold text-aslan-dark mb-3">Authentication</h3>
                        <ul class="space-y-2 text-sm">
                            <li><a href="#auth-overview" class="text-aslan-orange font-medium">Overview</a></li>
                            <li><a href="#api-keys" class="text-aslan-gray hover:text-aslan-dark">API Keys</a></li>
                            <li><a href="#jwt-tokens" class="text-aslan-gray hover:text-aslan-dark">JWT Tokens</a></li>
                        </ul>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-semibold text-aslan-dark mb-3">Endpoints</h3>
                        <ul class="space-y-2 text-sm">
                            <li><a href="#purchase" class="text-aslan-gray hover:text-aslan-dark">POST /purchase</a></li>
                            <li><a href="#authorize" class="text-aslan-gray hover:text-aslan-dark">POST /authorize</a></li>
                            <li><a href="#limits" class="text-aslan-gray hover:text-aslan-dark">GET /limits</a></li>
                            <li><a href="#transactions" class="text-aslan-gray hover:text-aslan-dark">GET /transactions</a></li>
                        </ul>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-semibold text-aslan-dark mb-3">Response Codes</h3>
                        <ul class="space-y-2 text-sm">
                            <li><a href="#success-codes" class="text-aslan-gray hover:text-aslan-dark">Success (2xx)</a></li>
                            <li><a href="#error-codes" class="text-aslan-gray hover:text-aslan-dark">Errors (4xx/5xx)</a></li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- Main Content -->
            <div class="lg:col-span-3">
                <div class="prose prose-lg max-w-none">
                    <h1 id="introduction" class="text-3xl sm:text-4xl font-bold text-aslan-dark mb-6">API Reference</h1>
                    
                    <p class="text-lg text-aslan-gray mb-8">
                        Complete API reference for integrating Aslan payment infrastructure with your AI agents.
                        All endpoints support both REST and SDK-based access.
                    </p>

                    <!-- Base URL -->
                    <div class="border rounded-lg p-4 sm:p-6 mb-8" style="background-color: #eff6ff; border-color: #bfdbfe;">
                        <h3 class="text-lg font-semibold mb-2" style="color: #1e3a8a;">Base URL</h3>
                        <div class="bg-white rounded p-3 font-mono text-sm overflow-x-auto">
                            <span style="color: #2563eb;">https://api.aslanpay.xyz/v1</span>
                        </div>
                    </div>

                    <!-- Authentication -->
                    <section id="authentication" class="mb-12">
                        <h2 class="text-3xl font-bold text-aslan-dark mb-6">Authentication</h2>
                        
                        <p class="text-aslan-gray mb-6">
                            All API requests require authentication using an API key in the Authorization header.
                        </p>

                        <div class="bg-aslan-dark rounded-lg p-6 text-white mb-6">
                            <pre class="text-sm"><code>curl -X POST https://aslanpay.xyz/api/v1/authorize \\
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

                    <!-- Core Endpoints -->
                    <section id="endpoints" class="mb-12">
                        <h2 class="text-3xl font-bold text-aslan-dark mb-6">Core Endpoints</h2>
                        
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

                    <!-- SDKs -->
                    <section class="rounded-lg p-8" style="background-color: #f9fafb;">
                        <h2 class="text-2xl font-bold text-aslan-dark mb-4">SDKs & Libraries</h2>
                        <p class="text-aslan-gray mb-6">
                            Use our official SDKs for easier integration with your AI frameworks.
                        </p>
                        <div class="grid md:grid-cols-2 gap-4">
                            <div class="bg-white rounded-lg p-4">
                                <h3 class="font-semibold text-aslan-dark mb-2">Node.js</h3>
                                <code class="text-sm text-aslan-gray">npm install @aslanpay/sdk</code>
                            </div>
                            <div class="bg-white rounded-lg p-4">
                                <h3 class="font-semibold text-aslan-dark mb-2">Python</h3>
                                <code class="text-sm text-aslan-gray">pip install aslanpay</code>
                            </div>
                        </div>
                        <div class="mt-6 flex gap-4">
                            <a href="/docs" class="bg-aslan-orange text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors">
                                View Documentation
                            </a>
                            <a href="https://github.com/coltonsakamoto/aslanpay" class="border text-aslan-dark px-6 py-3 rounded-lg font-medium transition-colors" style="border-color: #d1d5db;">
                                GitHub Repository
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    </div>

    <!-- JavaScript for mobile menu -->
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const mobileMenuBtn = document.getElementById('mobile-menu-btn');
            const mobileMenu = document.getElementById('mobile-menu');
            
            if (mobileMenuBtn && mobileMenu) {
                mobileMenuBtn.addEventListener('click', function() {
                    mobileMenu.classList.toggle('hidden');
                });
                
                const mobileLinks = mobileMenu.querySelectorAll('a');
                mobileLinks.forEach(link => {
                    link.addEventListener('click', function() {
                        mobileMenu.classList.add('hidden');
                    });
                });
            }
            
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                });
            });
        });
    </script>
</body>
</html>`;
    
    res.send(apiHTML);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('API listening on', PORT));
