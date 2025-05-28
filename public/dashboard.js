// Developer Dashboard JavaScript
class DeveloperDashboard {
    constructor() {
        this.apiKeys = this.loadApiKeys();
        this.activity = this.generateActivity();
        this.init();
    }
    
    init() {
        this.renderApiKeys();
        this.renderActivity();
        this.animateStats();
    }
    
    loadApiKeys() {
        const stored = localStorage.getItem('agentpayApiKeys');
        if (stored) {
            return JSON.parse(stored);
        }
        
        // Default demo API keys
        return [
            {
                id: 'key_1',
                name: 'Production Key',
                key: 'sk_live_' + this.generateKeyId(),
                environment: 'live',
                created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                permissions: ['read', 'write'],
                status: 'active'
            },
            {
                id: 'key_2', 
                name: 'Development Key',
                key: 'sk_test_' + this.generateKeyId(),
                environment: 'test',
                created: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                lastUsed: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                permissions: ['read', 'write'],
                status: 'active'
            }
        ];
    }
    
    saveApiKeys() {
        localStorage.setItem('agentpayApiKeys', JSON.stringify(this.apiKeys));
    }
    
    generateKeyId() {
        return Array.from({length: 24}, () => 
            'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]
        ).join('');
    }
    
    generateActivity() {
        const activities = [
            { type: 'api_call', message: 'Successful purchase: $25 Amazon Gift Card', time: '2 minutes ago', status: 'success' },
            { type: 'api_call', message: 'Agent authorization validated', time: '5 minutes ago', status: 'success' },
            { type: 'webhook', message: 'Webhook delivered: payment.completed', time: '8 minutes ago', status: 'success' },
            { type: 'api_call', message: 'Domain registration: my-startup.com', time: '12 minutes ago', status: 'success' },
            { type: 'error', message: 'Rate limit exceeded for agent_123', time: '15 minutes ago', status: 'warning' },
            { type: 'api_call', message: 'SMS sent via Twilio integration', time: '18 minutes ago', status: 'success' },
            { type: 'webhook', message: 'Webhook retry successful', time: '22 minutes ago', status: 'success' },
            { type: 'api_call', message: 'New agent created: ChatGPT Bot', time: '1 hour ago', status: 'success' }
        ];
        
        return activities;
    }
    
    renderApiKeys() {
        const container = document.getElementById('api-keys-list');
        
        if (this.apiKeys.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <div class="text-4xl mb-3">🔑</div>
                    <div class="text-lg font-medium mb-2">No API Keys</div>
                    <div class="text-sm mb-4">Create your first API key to get started</div>
                    <button onclick="dashboard.showCreateKeyModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Create API Key
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.apiKeys.map(key => `
            <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                    <div>
                        <h3 class="font-medium text-gray-900">${key.name}</h3>
                        <div class="flex items-center space-x-2 mt-1">
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                key.environment === 'live' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                            }">
                                ${key.environment === 'live' ? '🟢 Live' : '🔵 Test'}
                            </span>
                            <span class="text-xs text-gray-500">Created ${this.formatDate(key.created)}</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="dashboard.toggleKeyVisibility('${key.id}')" class="text-gray-400 hover:text-gray-600">
                            <span id="eye-${key.id}">👁️</span>
                        </button>
                        <button onclick="dashboard.deleteKey('${key.id}')" class="text-red-400 hover:text-red-600">
                            🗑️
                        </button>
                    </div>
                </div>
                
                <div class="bg-gray-50 rounded p-3 font-mono text-sm">
                    <span id="key-${key.id}" data-key="${key.key}">
                        ${this.maskKey(key.key)}
                    </span>
                    <button onclick="dashboard.copyKey('${key.id}')" class="ml-2 text-blue-600 hover:text-blue-800">
                        📋
                    </button>
                </div>
                
                <div class="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>Last used: ${this.formatDate(key.lastUsed)}</span>
                    <span>Permissions: ${key.permissions.join(', ')}</span>
                </div>
            </div>
        `).join('');
    }
    
    renderActivity() {
        const container = document.getElementById('recent-activity');
        
        container.innerHTML = this.activity.map(activity => `
            <div class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50">
                <div class="flex-shrink-0 mt-1">
                    ${this.getActivityIcon(activity.type, activity.status)}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-900">${activity.message}</p>
                    <p class="text-xs text-gray-500">${activity.time}</p>
                </div>
            </div>
        `).join('');
    }
    
    getActivityIcon(type, status) {
        if (status === 'warning') return '⚠️';
        if (status === 'error') return '❌';
        
        switch (type) {
            case 'api_call': return '🔗';
            case 'webhook': return '📡';
            case 'payment': return '💳';
            default: return '✅';
        }
    }
    
    maskKey(key) {
        if (key.length <= 8) return key;
        return key.substring(0, 8) + '•'.repeat(key.length - 12) + key.substring(key.length - 4);
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
    
    animateStats() {
        // Animate the stats with realistic fluctuations
        setTimeout(() => {
            document.getElementById('api-calls').textContent = (1247 + Math.floor(Math.random() * 20)).toString();
            document.getElementById('response-time').textContent = (120 + Math.floor(Math.random() * 20)) + 'ms';
        }, 2000);
    }
    
    showCreateKeyModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        
        modal.innerHTML = `
            <div class="bg-white rounded-xl max-w-md w-full">
                <div class="p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold">🔑 Create API Key</h3>
                        <button onclick="document.body.removeChild(this.closest('.fixed'))" class="text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                    
                    <form id="create-key-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
                            <input type="text" id="key-name" placeholder="e.g., Production API Key" class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Environment</label>
                            <select id="key-environment" class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="test">🔵 Test</option>
                                <option value="live">🟢 Live</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Permissions</label>
                            <div class="space-y-2">
                                <label class="flex items-center">
                                    <input type="checkbox" id="perm-read" checked class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                                    <span class="ml-2 text-sm">Read access (view data)</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" id="perm-write" checked class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                                    <span class="ml-2 text-sm">Write access (make purchases)</span>
                                </label>
                            </div>
                        </div>
                        
                        <button type="submit" class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                            Create API Key
                        </button>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('create-key-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createApiKey();
            document.body.removeChild(modal);
        });
    }
    
    createApiKey() {
        const name = document.getElementById('key-name').value;
        const environment = document.getElementById('key-environment').value;
        const permissions = [];
        
        if (document.getElementById('perm-read').checked) permissions.push('read');
        if (document.getElementById('perm-write').checked) permissions.push('write');
        
        const newKey = {
            id: 'key_' + Date.now(),
            name: name,
            key: (environment === 'live' ? 'sk_live_' : 'sk_test_') + this.generateKeyId(),
            environment: environment,
            created: new Date().toISOString(),
            lastUsed: null,
            permissions: permissions,
            status: 'active'
        };
        
        this.apiKeys.push(newKey);
        this.saveApiKeys();
        this.renderApiKeys();
        
        // Show success notification
        this.showNotification('✅ API key created successfully!', 'success');
    }
    
    deleteKey(keyId) {
        if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
            this.apiKeys = this.apiKeys.filter(key => key.id !== keyId);
            this.saveApiKeys();
            this.renderApiKeys();
            this.showNotification('🗑️ API key deleted', 'warning');
        }
    }
    
    toggleKeyVisibility(keyId) {
        const keyElement = document.getElementById(`key-${keyId}`);
        const eyeElement = document.getElementById(`eye-${keyId}`);
        const fullKey = keyElement.dataset.key;
        
        if (keyElement.textContent.includes('•')) {
            keyElement.textContent = fullKey;
            eyeElement.textContent = '🙈';
        } else {
            keyElement.textContent = this.maskKey(fullKey);
            eyeElement.textContent = '👁️';
        }
    }
    
    copyKey(keyId) {
        const keyElement = document.getElementById(`key-${keyId}`);
        const fullKey = keyElement.dataset.key;
        
        navigator.clipboard.writeText(fullKey).then(() => {
            this.showNotification('📋 API key copied to clipboard', 'success');
        });
    }
    
    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white ${
            type === 'success' ? 'bg-green-600' : 
            type === 'warning' ? 'bg-orange-600' : 'bg-blue-600'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Onboarding Wizard
function showOnboardingWizard() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
        <div class="bg-white rounded-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div class="p-6">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-semibold">🧭 AgentPay Setup Wizard</h3>
                    <button onclick="document.body.removeChild(this.closest('.fixed'))" class="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                
                <div class="space-y-6">
                    <div class="flex items-start space-x-4">
                        <div class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</div>
                        <div>
                            <h4 class="font-medium text-gray-900">Install AgentPay SDK</h4>
                            <div class="mt-2 bg-gray-100 rounded p-3 font-mono text-sm">
                                npm install agentpay
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-start space-x-4">
                        <div class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</div>
                        <div>
                            <h4 class="font-medium text-gray-900">Initialize with your API key</h4>
                            <div class="mt-2 bg-gray-100 rounded p-3 font-mono text-sm">
import AgentPay from 'agentpay';

const agentpay = new AgentPay({
  apiKey: 'your_api_key_here',
  environment: 'test' // or 'live'
});
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-start space-x-4">
                        <div class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</div>
                        <div>
                            <h4 class="font-medium text-gray-900">Make your first purchase</h4>
                            <div class="mt-2 bg-gray-100 rounded p-3 font-mono text-sm">
const result = await agentpay.purchase('gift-card', {
  brand: 'amazon',
  amount: 25
});

console.log(result);
// ✅ { success: true, transactionId: 'txn_...' }
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-start space-x-4">
                        <div class="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">✓</div>
                        <div>
                            <h4 class="font-medium text-gray-900">You're all set! 🎉</h4>
                            <p class="text-sm text-gray-600 mt-1">Your AI agents can now make autonomous purchases</p>
                        </div>
                    </div>
                </div>
                
                <div class="mt-8 flex space-x-3">
                    <button onclick="window.open('demo.html', '_blank')" class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                        Try Demo
                    </button>
                    <button onclick="window.open('local-docs.html', '_blank')" class="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors">
                        View Docs
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Integration Guides
function showIntegrationGuides() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
        <div class="bg-white rounded-xl max-w-3xl w-full max-h-96 overflow-y-auto">
            <div class="p-6">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-semibold">🔌 Integration Guides</h3>
                    <button onclick="document.body.removeChild(this.closest('.fixed'))" class="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                
                <div class="grid md:grid-cols-2 gap-6">
                    <div class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer" onclick="showFrameworkGuide('openai')">
                        <div class="flex items-center space-x-3 mb-3">
                            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">🧠</div>
                            <div>
                                <h4 class="font-medium">OpenAI ChatGPT</h4>
                                <p class="text-sm text-gray-500">Function calling integration</p>
                            </div>
                        </div>
                        <p class="text-xs text-gray-600">Add purchase powers to ChatGPT with native function calling support.</p>
                    </div>
                    
                    <div class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer" onclick="showFrameworkGuide('langchain')">
                        <div class="flex items-center space-x-3 mb-3">
                            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">🔗</div>
                            <div>
                                <h4 class="font-medium">LangChain</h4>
                                <p class="text-sm text-gray-500">Python tool integration</p>
                            </div>
                        </div>
                        <p class="text-xs text-gray-600">Native LangChain tool for seamless AI agent commerce.</p>
                    </div>
                    
                    <div class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer" onclick="showFrameworkGuide('crewai')">
                        <div class="flex items-center space-x-3 mb-3">
                            <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">👥</div>
                            <div>
                                <h4 class="font-medium">CrewAI</h4>
                                <p class="text-sm text-gray-500">Multi-agent coordination</p>
                            </div>
                        </div>
                        <p class="text-xs text-gray-600">Enable multiple AI agents to coordinate purchases safely.</p>
                    </div>
                    
                    <div class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer" onclick="showFrameworkGuide('anthropic')">
                        <div class="flex items-center space-x-3 mb-3">
                            <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">🤖</div>
                            <div>
                                <h4 class="font-medium">Anthropic Claude</h4>
                                <p class="text-sm text-gray-500">Tool use integration</p>
                            </div>
                        </div>
                        <p class="text-xs text-gray-600">Give Claude the ability to make autonomous purchases.</p>
                    </div>
                </div>
                
                <div class="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 class="font-medium text-blue-900 mb-2">📚 Need a custom integration?</h4>
                    <p class="text-sm text-blue-800 mb-3">AgentPay works with any AI framework through our universal REST API.</p>
                    <button onclick="window.open('local-docs.html', '_blank')" class="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                        View API Documentation
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Support functions
function openSupport() {
    alert('📧 Support Contact:\n\nEmail: support@agentpay.com\nDiscord: Join our developer community\nResponse time: < 4 hours\n\nFor urgent issues, please include:\n- Your API key ID\n- Error messages\n- Steps to reproduce');
}

// Initialize dashboard
const dashboard = new DeveloperDashboard(); 