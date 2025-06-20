// Demo Configuration with Payment Controls
const DEMO_CONFIG = {
    // Demo Mode Settings
    isDemoMode: true,
    maxDemoTransactions: 10, // Limit demo to 10 transactions
    maxDemoAmount: 100.00, // Maximum $100 total spending in demo
    
    // Per-transaction limits
    transactionLimits: {
        'gift-card': { min: 5, max: 50 },
        'domain': { min: 10, max: 25 },
        'sms': { min: 0.01, max: 1 },
        'cloud-credits': { min: 10, max: 100 },
        'default': { min: 1, max: 25 }
    },
    
    // Velocity controls
    maxTransactionsPerMinute: 3,
    cooldownBetweenTransactions: 2000, // 2 seconds
    
    // Demo approval rules
    requireApprovalOver: 30, // Require approval for amounts > $30
    emergencyStopWords: ['emergency', 'stop', 'cancel', 'abort'],
    
    // Spending categories with different limits
    categoryLimits: {
        'food': 50,
        'travel': 200,
        'shopping': 75,
        'entertainment': 25,
        'business': 100
    },
    
    // Demo user profile
    demoUser: {
        id: 'demo_user_001',
        name: 'Demo User',
        spentToday: 0,
        dailyLimit: 100,
        transactionCount: 0,
        lastTransactionTime: null
    },
    
    // Demo alerts and notifications
    alerts: {
        approaching50Percent: true,
        approaching75Percent: true,
        exceedingLimit: true,
        suspiciousActivity: true
    }
};

// Load saved configuration from localStorage
function loadSavedConfiguration() {
    try {
        const savedConfig = localStorage.getItem('demoSpendingConfig');
        if (savedConfig) {
            const parsedConfig = JSON.parse(savedConfig);
            
            // Merge saved config with defaults, preserving structure
            if (parsedConfig.demoUser) {
                Object.assign(DEMO_CONFIG.demoUser, parsedConfig.demoUser);
            }
            if (parsedConfig.maxDemoTransactions) {
                DEMO_CONFIG.maxDemoTransactions = parsedConfig.maxDemoTransactions;
            }
            if (parsedConfig.requireApprovalOver) {
                DEMO_CONFIG.requireApprovalOver = parsedConfig.requireApprovalOver;
            }
            if (parsedConfig.transactionLimits && parsedConfig.transactionLimits.default) {
                DEMO_CONFIG.transactionLimits.default.max = parsedConfig.transactionLimits.default.max;
            }
            if (parsedConfig.maxTransactionsPerMinute) {
                DEMO_CONFIG.maxTransactionsPerMinute = parsedConfig.maxTransactionsPerMinute;
            }
            if (parsedConfig.cooldownBetweenTransactions) {
                DEMO_CONFIG.cooldownBetweenTransactions = parsedConfig.cooldownBetweenTransactions;
            }
            if (parsedConfig.categoryLimits) {
                Object.assign(DEMO_CONFIG.categoryLimits, parsedConfig.categoryLimits);
            }
            
            console.log('✅ Loaded saved spending configuration');
        }
    } catch (error) {
        console.warn('⚠️ Failed to load saved configuration, using defaults:', error);
    }
}

// Initialize configuration
loadSavedConfiguration();

// Demo Spending Tracker
class DemoSpendingTracker {
    constructor() {
        this.resetDailyLimits();
        this.transactionHistory = [];
        this.isEmergencyStop = false;
    }
    
    resetDailyLimits() {
        const today = new Date().toDateString();
        const stored = localStorage.getItem('demoSpending');
        
        if (stored) {
            const data = JSON.parse(stored);
            if (data.date !== today) {
                // New day - reset limits
                DEMO_CONFIG.demoUser.spentToday = 0;
                DEMO_CONFIG.demoUser.transactionCount = 0;
                this.saveToStorage();
            } else {
                // Same day - load existing data
                DEMO_CONFIG.demoUser.spentToday = data.spentToday || 0;
                DEMO_CONFIG.demoUser.transactionCount = data.transactionCount || 0;
                this.transactionHistory = data.transactionHistory || [];
            }
        }
    }
    
    saveToStorage() {
        const data = {
            date: new Date().toDateString(),
            spentToday: DEMO_CONFIG.demoUser.spentToday,
            transactionCount: DEMO_CONFIG.demoUser.transactionCount,
            transactionHistory: this.transactionHistory
        };
        localStorage.setItem('demoSpending', JSON.stringify(data));
    }
    
    validateTransaction(amount, service, userMessage) {
        const validation = {
            approved: false,
            reason: '',
            requiresApproval: false,
            warnings: []
        };
        
        // Emergency stop check
        if (this.isEmergencyStop) {
            validation.reason = 'Emergency stop activated. All transactions blocked.';
            return validation;
        }
        
        // Check for emergency words
        const hasEmergencyWords = DEMO_CONFIG.emergencyStopWords.some(word => 
            userMessage.toLowerCase().includes(word)
        );
        if (hasEmergencyWords) {
            this.isEmergencyStop = true;
            validation.reason = 'Emergency stop triggered by user message.';
            return validation;
        }
        
        // Amount validation
        const limits = DEMO_CONFIG.transactionLimits[service] || DEMO_CONFIG.transactionLimits.default;
        if (amount < limits.min) {
            validation.reason = `Minimum amount for ${service} is $${limits.min}`;
            return validation;
        }
        if (amount > limits.max) {
            validation.reason = `Maximum amount for ${service} is $${limits.max}`;
            return validation;
        }
        
        // Daily limit check
        const newTotal = DEMO_CONFIG.demoUser.spentToday + amount;
        if (newTotal > DEMO_CONFIG.demoUser.dailyLimit) {
            validation.reason = `Would exceed daily limit of $${DEMO_CONFIG.demoUser.dailyLimit}`;
            return validation;
        }
        
        // Demo total limit check
        if (newTotal > DEMO_CONFIG.maxDemoAmount) {
            validation.reason = `Would exceed demo limit of $${DEMO_CONFIG.maxDemoAmount}`;
            return validation;
        }
        
        // Transaction count limit
        if (DEMO_CONFIG.demoUser.transactionCount >= DEMO_CONFIG.maxDemoTransactions) {
            validation.reason = `Demo limited to ${DEMO_CONFIG.maxDemoTransactions} transactions`;
            return validation;
        }
        
        // Velocity check
        const now = Date.now();
        const recentTransactions = this.transactionHistory.filter(tx => 
            now - tx.timestamp < 60000 // Last minute
        );
        if (recentTransactions.length >= DEMO_CONFIG.maxTransactionsPerMinute) {
            validation.reason = 'Too many transactions. Please wait a minute.';
            return validation;
        }
        
        // Cooldown check
        if (DEMO_CONFIG.demoUser.lastTransactionTime) {
            const timeSinceLastTransaction = now - DEMO_CONFIG.demoUser.lastTransactionTime;
            if (timeSinceLastTransaction < DEMO_CONFIG.cooldownBetweenTransactions) {
                validation.reason = `Please wait ${Math.ceil((DEMO_CONFIG.cooldownBetweenTransactions - timeSinceLastTransaction) / 1000)} seconds between transactions`;
                return validation;
            }
        }
        
        // Approval required check
        if (amount > DEMO_CONFIG.requireApprovalOver) {
            validation.requiresApproval = true;
            validation.approved = false;
            validation.reason = `Amounts over $${DEMO_CONFIG.requireApprovalOver} require approval`;
            return validation;
        }
        
        // Warning checks
        const spentPercentage = (newTotal / DEMO_CONFIG.demoUser.dailyLimit) * 100;
        if (spentPercentage > 75) {
            validation.warnings.push(`⚠️ You've spent ${spentPercentage.toFixed(1)}% of your daily limit`);
        } else if (spentPercentage > 50) {
            validation.warnings.push(`📊 You've spent ${spentPercentage.toFixed(1)}% of your daily limit`);
        }
        
        // All checks passed
        validation.approved = true;
        return validation;
    }
    
    recordTransaction(amount, service) {
        const transaction = {
            amount,
            service,
            timestamp: Date.now(),
            id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        };
        
        DEMO_CONFIG.demoUser.spentToday += amount;
        DEMO_CONFIG.demoUser.transactionCount++;
        DEMO_CONFIG.demoUser.lastTransactionTime = Date.now();
        this.transactionHistory.push(transaction);
        
        this.saveToStorage();
        return transaction;
    }
    
    getDemoStatus() {
        const spentPercentage = (DEMO_CONFIG.demoUser.spentToday / DEMO_CONFIG.demoUser.dailyLimit) * 100;
        const transactionPercentage = (DEMO_CONFIG.demoUser.transactionCount / DEMO_CONFIG.maxDemoTransactions) * 100;
        
        return {
            spentToday: DEMO_CONFIG.demoUser.spentToday,
            dailyLimit: DEMO_CONFIG.demoUser.dailyLimit,
            spentPercentage: spentPercentage.toFixed(1),
            transactionCount: DEMO_CONFIG.demoUser.transactionCount,
            maxTransactions: DEMO_CONFIG.maxDemoTransactions,
            transactionPercentage: transactionPercentage.toFixed(1),
            remainingAmount: DEMO_CONFIG.demoUser.dailyLimit - DEMO_CONFIG.demoUser.spentToday,
            remainingTransactions: DEMO_CONFIG.maxDemoTransactions - DEMO_CONFIG.demoUser.transactionCount,
            isEmergencyStop: this.isEmergencyStop
        };
    }
    
    resetEmergencyStop() {
        this.isEmergencyStop = false;
    }
}

// Export for use in demo
window.DEMO_CONFIG = DEMO_CONFIG;
window.DemoSpendingTracker = DemoSpendingTracker; 