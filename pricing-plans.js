// AslanPay Subscription Plans Configuration
// Matches the exact pricing structure from the business requirements

const SUBSCRIPTION_PLANS = {
  sandbox: {
    id: 'sandbox',
    name: 'Sandbox',
    monthlyFee: 0,
    includedTransactions: 750,
    overageFeePerTransaction: 0.05, // $0.05
    stripePriceId: null, // Free plan
    features: [
      'Test mode only',
      '750 included transactions/month',
      '$0.05 per additional transaction'
    ]
  },
  
  starter: {
    id: 'starter', 
    name: 'Starter',
    monthlyFee: 29,
    includedTransactions: 3000,
    overageFeePerTransaction: 0.03, // $0.03
    stripePriceId: 'price_starter_monthly', // To be set in Stripe
    features: [
      'Production payments',
      '3,000 included transactions/month',
      '$0.03 per additional transaction',
      'API access',
      'Email support'
    ]
  },
  
  builder: {
    id: 'builder',
    name: 'Builder', 
    monthlyFee: 129,
    includedTransactions: 12000,
    overageFeePerTransaction: 0.02, // $0.02
    stripePriceId: 'price_builder_monthly', // To be set in Stripe
    features: [
      'Production payments',
      '12,000 included transactions/month', 
      '$0.02 per additional transaction',
      'Priority API access',
      'Priority support',
      'Advanced analytics'
    ]
  },
  
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyFee: 1000, // Minimum
    includedTransactions: null, // Unlimited
    overageFeePerTransaction: 0.005, // $0.005 (0.5 cents)
    stripePriceId: 'price_enterprise_custom', // Custom pricing
    features: [
      'Custom pricing (≥$1,000/month)',
      'Unlimited included transactions',
      '$0.005-$0.01 per transaction',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantees'
    ]
  }
};

// Helper functions
function getPlanById(planId) {
  return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.sandbox;
}

function calculateMonthlyBill(planId, transactionsUsed) {
  const plan = getPlanById(planId);
  
  if (!plan) {
    throw new Error(`Invalid plan: ${planId}`);
  }
  
  let monthlyFee = plan.monthlyFee;
  let overageCharges = 0;
  let overageTransactions = 0;
  
  // Calculate overage if transactions exceed included amount
  if (plan.includedTransactions && transactionsUsed > plan.includedTransactions) {
    overageTransactions = transactionsUsed - plan.includedTransactions;
    overageCharges = overageTransactions * plan.overageFeePerTransaction;
  }
  
  return {
    planId,
    planName: plan.name,
    monthlyFee,
    includedTransactions: plan.includedTransactions,
    transactionsUsed,
    overageTransactions,
    overageCharges,
    totalBill: monthlyFee + overageCharges,
    overageFeePerTransaction: plan.overageFeePerTransaction
  };
}

function getOverageFeeForTransaction(planId) {
  const plan = getPlanById(planId);
  return plan.overageFeePerTransaction;
}

module.exports = {
  SUBSCRIPTION_PLANS,
  getPlanById,
  calculateMonthlyBill,
  getOverageFeeForTransaction
}; 