#!/usr/bin/env node

/**
 * 🤖 CrewAI + Aslan Integration Example
 * 
 * This example shows how to create a CrewAI crew with specialized agents
 * that coordinate to make intelligent purchasing decisions using Aslan.
 */

require('dotenv').config();

// Mock CrewAI implementation (replace with actual CrewAI)
class MockCrewAIAgent {
    constructor(name, role, tools) {
        this.name = name;
        this.role = role;
        this.tools = tools;
    }
    
    async execute(task, context = {}) {
        console.log(`🤖 ${this.name} (${this.role}) starting task: "${task}"`);
        
        // Simulate agent thinking time
        await new Promise(resolve => setTimeout(resolve, 300));
        
        return await this.performRole(task, context);
    }
    
    async performRole(task, context) {
        switch (this.role) {
            case 'Purchase Researcher':
                return await this.researchPurchase(task, context);
            case 'Budget Analyst': 
                return await this.analyzeBudget(task, context);
            case 'Compliance Officer':
                return await this.checkCompliance(task, context);
            case 'Purchase Specialist':
                return await this.executePurchase(task, context);
            default:
                return `I'm not sure how to handle this task as a ${this.role}`;
        }
    }
    
    async researchPurchase(task, context) {
        console.log(`🔍 ${this.name}: Researching vendors and pricing...`);
        
        // Mock research results
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (task.toLowerCase().includes('aws')) {
            return {
                vendor: 'Amazon Web Services',
                recommended_amount: 5000, // $50
                pricing: '$0.10 per compute hour',
                alternatives: ['Google Cloud', 'Microsoft Azure'],
                confidence: 0.95,
                recommendation: 'AWS offers the best ML compute value for this use case'
            };
        }
        
        if (task.toLowerCase().includes('github')) {
            return {
                vendor: 'GitHub',
                recommended_amount: 400, // $4
                pricing: '$4/month for Pro features',
                alternatives: ['GitLab Premium', 'Bitbucket'],
                confidence: 0.90,
                recommendation: 'GitHub Pro provides essential collaboration features'
            };
        }
        
        return {
            vendor: 'Unknown',
            recommended_amount: 1000,
            confidence: 0.50,
            recommendation: 'Need more specific requirements to provide accurate recommendation'
        };
    }
    
    async analyzeBudget(task, context) {
        console.log(`📊 ${this.name}: Analyzing budget impact...`);
        
        // Check current limits
        const limits = await this.tools.check_spending_limits.func({});
        const requestedAmount = context.recommended_amount || 1000;
        
        const analysis = {
            requested_amount: requestedAmount,
            available_budget: limits.remaining,
            impact_percentage: (requestedAmount / limits.daily_limit * 100).toFixed(1),
            risk_level: requestedAmount > limits.transaction_limit ? 'HIGH' : 
                       requestedAmount > limits.remaining * 0.5 ? 'MEDIUM' : 'LOW',
            recommendation: null
        };
        
        if (requestedAmount > limits.remaining) {
            analysis.recommendation = 'REJECT - Exceeds available budget';
        } else if (requestedAmount > limits.transaction_limit) {
            analysis.recommendation = 'REQUIRES_APPROVAL - Exceeds transaction limit';
        } else {
            analysis.recommendation = 'APPROVE - Within acceptable limits';
        }
        
        console.log(`📈 Budget Analysis: ${analysis.recommendation} (${analysis.impact_percentage}% of daily limit)`);
        
        return analysis;
    }
    
    async checkCompliance(task, context) {
        console.log(`🛡️ ${this.name}: Checking compliance and policies...`);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const compliance = {
            vendor_approved: true,
            purpose_valid: true,
            spending_authorized: context.budget_analysis?.recommendation === 'APPROVE',
            security_review: true,
            final_decision: null
        };
        
        compliance.final_decision = Object.values(compliance).every(v => v === true) ? 'APPROVED' : 'REJECTED';
        
        console.log(`⚖️ Compliance Check: ${compliance.final_decision}`);
        
        return compliance;
    }
    
    async executePurchase(task, context) {
        console.log(`💳 ${this.name}: Executing approved purchase...`);
        
        if (context.compliance?.final_decision !== 'APPROVED') {
            throw new Error('Cannot execute purchase - compliance check failed');
        }
        
        // Execute the purchase
        const auth = await this.tools.authorize_payment.func({
            amount: context.recommended_amount,
            description: `${context.vendor} - ${task}`,
            merchant: context.vendor
        });
        
        console.log(`✅ Purchase executed successfully: ${auth.id}`);
        
        return {
            authorization_id: auth.id,
            amount: auth.amount,
            vendor: auth.merchant,
            status: 'completed',
            receipt_available: true
        };
    }
}

class MockCrewAICrew {
    constructor(agents) {
        this.agents = agents;
        this.name = "Purchase Decision Crew";
    }
    
    async execute(task) {
        console.log(`🚀 ${this.name} starting collaborative task: "${task}"\n`);
        
        let context = { task };
        
        // Sequential workflow: Research → Budget → Compliance → Execute
        for (const agent of this.agents) {
            try {
                const result = await agent.execute(task, context);
                
                // Update context with results
                if (agent.role === 'Purchase Researcher') {
                    context = { ...context, ...result, vendor: result.vendor };
                } else if (agent.role === 'Budget Analyst') {
                    context.budget_analysis = result;
                } else if (agent.role === 'Compliance Officer') {
                    context.compliance = result;
                } else if (agent.role === 'Purchase Specialist') {
                    context.purchase_result = result;
                }
                
                console.log(`✅ ${agent.name} completed their task\n`);
                
                // Stop if compliance rejects
                if (agent.role === 'Compliance Officer' && result.final_decision === 'REJECTED') {
                    console.log('🛑 Purchase workflow stopped - compliance rejection\n');
                    break;
                }
                
            } catch (error) {
                console.error(`❌ ${agent.name} failed:`, error.message);
                break;
            }
        }
        
        return context;
    }
}

// Aslan payment tools for CrewAI agents
const aslanPaymentTools = {
    authorize_payment: {
        name: "authorize_payment",
        description: "Authorize a payment for making a purchase", 
        func: async (args) => {
            const { amount, description, merchant = 'Unknown' } = args;
            
            console.log(`💳 ASLAN: Authorizing $${(amount/100).toFixed(2)} for "${description}"`);
            
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 300));
            
            return {
                id: `auth_${Date.now()}`,
                amount: amount,
                description: description,
                merchant: merchant,
                status: 'authorized',
                created_at: new Date().toISOString()
            };
        }
    },
    
    check_spending_limits: {
        name: "check_spending_limits",
        description: "Check current spending limits and available balance",
        func: async (args) => {
            console.log(`📊 ASLAN: Checking spending limits`);
            
            await new Promise(resolve => setTimeout(resolve, 150));
            
            return {
                daily_limit: 100000,   // $1000
                daily_spent: 25000,    // $250
                remaining: 75000,      // $750
                transaction_limit: 50000, // $500 per transaction
                currency: 'USD'
            };
        }
    }
};

// Demo function
async function runCrewAIDemo() {
    console.log('🚀 Starting CrewAI + Aslan Integration Demo\n');
    console.log('════════════════════════════════════════════\n');
    
    // Create specialized agents
    const agents = [
        new MockCrewAIAgent('Sarah', 'Purchase Researcher', aslanPaymentTools),
        new MockCrewAIAgent('Mike', 'Budget Analyst', aslanPaymentTools), 
        new MockCrewAIAgent('Jennifer', 'Compliance Officer', aslanPaymentTools),
        new MockCrewAIAgent('Alex', 'Purchase Specialist', aslanPaymentTools)
    ];
    
    // Create the crew
    const crew = new MockCrewAICrew(agents);
    
    console.log('👥 Crew Members:');
    agents.forEach(agent => {
        console.log(`   • ${agent.name} - ${agent.role}`);
    });
    console.log('');
    
    // Demo scenarios
    const scenarios = [
        "Purchase $50 worth of AWS credits for machine learning compute",
        "Get GitHub Pro subscription for the development team"
    ];
    
    for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];
        
        console.log(`📋 Scenario ${i + 1}: ${scenario}`);
        console.log('─'.repeat(60));
        
        try {
            const result = await crew.execute(scenario);
            
            console.log('📊 Final Results:');
            console.log(`   • Vendor: ${result.vendor || 'Not determined'}`);
            console.log(`   • Budget Status: ${result.budget_analysis?.recommendation || 'Not analyzed'}`);
            console.log(`   • Compliance: ${result.compliance?.final_decision || 'Not checked'}`);
            console.log(`   • Purchase: ${result.purchase_result ? 'Completed' : 'Not executed'}`);
            
            if (result.purchase_result) {
                console.log(`   • Authorization ID: ${result.purchase_result.authorization_id}`);
                console.log(`   • Amount: $${result.purchase_result.amount / 100}`);
            }
            
        } catch (error) {
            console.error(`❌ Scenario ${i + 1} failed:`, error.message);
        }
        
        console.log('\n' + '═'.repeat(60) + '\n');
    }
}

// Advanced coordination demo
async function runAdvancedCoordinationDemo() {
    console.log('🎯 Advanced Coordination Demo: Parallel Research\n');
    
    // Create multiple research agents for parallel processing
    const researchAgents = [
        new MockCrewAIAgent('Sarah-AWS', 'Purchase Researcher', aslanPaymentTools),
        new MockCrewAIAgent('Tom-Azure', 'Purchase Researcher', aslanPaymentTools),
        new MockCrewAIAgent('Lisa-GCP', 'Purchase Researcher', aslanPaymentTools)
    ];
    
    console.log('👥 Parallel Research Crew:');
    researchAgents.forEach(agent => {
        console.log(`   • ${agent.name} - Cloud Platform Specialist`);
    });
    console.log('');
    
    const task = "Research cloud compute options for ML workload";
    
    // Run parallel research
    console.log('🔄 Running parallel research...\n');
    
    const researchPromises = researchAgents.map(agent => 
        agent.execute(task, {})
    );
    
    const results = await Promise.all(researchPromises);
    
    console.log('📊 Research Results Comparison:');
    results.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.vendor}: $${result.recommended_amount/100} (confidence: ${result.confidence})`);
    });
    
    // Find best option
    const bestOption = results.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
    );
    
    console.log(`\n🏆 Best Option Selected: ${bestOption.vendor} ($${bestOption.recommended_amount/100})`);
    console.log(`📝 Reasoning: ${bestOption.recommendation}`);
}

// Run demos
if (require.main === module) {
    Promise.resolve()
        .then(() => runCrewAIDemo())
        .then(() => runAdvancedCoordinationDemo())
        .then(() => {
            console.log('\n✨ CrewAI integration demo completed!');
            console.log('\n📚 Next steps:');
            console.log('   • Replace mock implementations with real CrewAI');
            console.log('   • Add real LLM backing for agent intelligence');
            console.log('   • Integrate with actual Aslan SDK');
            console.log('   • Try the Python version: crewai_purchase_crew.py');
            console.log('   • Experiment with different crew compositions');
        })
        .catch(error => {
            console.error('💥 Demo crashed:', error);
            process.exit(1);
        });
} 