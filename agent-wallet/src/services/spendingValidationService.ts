import { prisma } from '../lib/prisma';

export interface SpendingValidationRequest {
  agentToken: string;
  amount: number; // USD amount
  service: string; // "flight", "food", "shopping", etc.
  params?: any;
}

export interface SpendingValidationResult {
  approved: boolean;
  reason?: string;
  action?: string;
  requiresApproval?: boolean;
  approvalId?: string;
  remainingLimits?: {
    daily: number;
    monthly: number;
    category: number;
    transaction: number;
  };
}

export interface CategoryLimits {
  flights?: number;
  hotels?: number;
  food?: number;
  shopping?: number;
  entertainment?: number;
  transportation?: number;
  [key: string]: number | undefined;
}

export interface ApprovalSettings {
  requireApprovalOver: number; // Amount in cents
  autoApproveUnder: number; // Amount in cents
  alwaysApprove: string[]; // Categories that never need approval
  neverApprove: string[]; // Categories that always need approval
}

export class SpendingValidationService {
  
  /**
   * Comprehensive spending validation for direct card purchases
   */
  static async validatePurchase(request: SpendingValidationRequest): Promise<SpendingValidationResult> {
    const { agentToken, amount, service } = request;
    const amountCents = Math.round(amount * 100);
    
    try {
      // Get agent with enhanced limits
      const agent = await prisma.agent.findUnique({
        where: { token: agentToken },
        include: { wallet: true }
      });
      
      if (!agent) {
        return {
          approved: false,
          reason: 'Agent not found',
          action: 'check_agent_token'
        };
      }
      
      // Check emergency stop
      if (agent.emergencyStop) {
        return {
          approved: false,
          reason: 'Emergency stop activated. All purchases disabled.',
          action: 'contact_support_or_disable_emergency_stop'
        };
      }
      
      // Parse JSON settings
      const categoryLimits: CategoryLimits = agent.categoryLimits 
        ? JSON.parse(agent.categoryLimits) 
        : {};
      const approvalSettings: ApprovalSettings = agent.approvalSettings 
        ? JSON.parse(agent.approvalSettings)
        : {
            requireApprovalOver: 20000, // $200 default
            autoApproveUnder: 1000,     // $10 default
            alwaysApprove: ['food'],    // Food is always auto-approved
            neverApprove: []            // No categories always require approval
          };
      
      // 1. Check transaction limit
      if (amountCents > agent.transactionLimitUSD) {
        return {
          approved: false,
          reason: `Transaction too large. Maximum $${agent.transactionLimitUSD / 100} per purchase.`,
          action: 'reduce_amount_or_increase_transaction_limit'
        };
      }
      
      // 2. Check daily limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const spentToday = await prisma.payment.aggregate({
        where: {
          agentId: agent.id,
          createdAt: { gte: today },
          status: 'completed'
          // Removed paymentMode filter - field may not exist in schema
        },
        _sum: { amountUSD: true }
      });
      
      const spentTodayAmount = spentToday._sum.amountUSD || 0;
      
      if (spentTodayAmount + amountCents > agent.dailyLimitUSD) {
        return {
          approved: false,
          reason: `Daily limit exceeded. Spent $${spentTodayAmount / 100} of $${agent.dailyLimitUSD / 100} today.`,
          action: 'wait_until_tomorrow_or_increase_daily_limit',
          remainingLimits: {
            daily: Math.max(0, agent.dailyLimitUSD - spentTodayAmount) / 100,
            monthly: 0, // Calculate separately
            category: 0, // Calculate separately  
            transaction: agent.transactionLimitUSD / 100
          }
        };
      }
      
      // 3. Check category limit (if set)
      const categoryLimit = categoryLimits[service];
      let spentThisMonthAmount = 0;
      
      if (categoryLimit) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const spentThisMonth = await prisma.payment.aggregate({
          where: {
            agentId: agent.id,
            service: service,
            createdAt: { gte: startOfMonth },
            status: 'completed'
            // Removed paymentMode filter - field may not exist in schema
          },
          _sum: { amountUSD: true }
        });
        
        spentThisMonthAmount = spentThisMonth._sum.amountUSD || 0;
        
        if (spentThisMonthAmount + amountCents > categoryLimit) {
          return {
            approved: false,
            reason: `Monthly ${service} limit exceeded. Spent $${spentThisMonthAmount / 100} of $${categoryLimit / 100} this month.`,
            action: 'increase_category_limit_or_wait_until_next_month'
          };
        }
      }
      
      // 4. Check velocity limits (transactions per hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentTransactions = await prisma.payment.count({
        where: {
          agentId: agent.id,
          createdAt: { gte: oneHourAgo },
          status: 'completed'
          // Removed paymentMode filter - field may not exist in schema
        }
      });
      
      if (recentTransactions >= agent.velocityLimit) {
        return {
          approved: false,
          reason: `Too many transactions. Maximum ${agent.velocityLimit} purchases per hour.`,
          action: 'wait_before_next_purchase'
        };
      }
      
      // 5. Check if approval is required
      const needsApproval = this.requiresApproval(amountCents, service, approvalSettings);
      
      if (needsApproval) {
        // Create approval request
        const approvalId = await this.createApprovalRequest(agent.id, amountCents, service, request.params);
        
        return {
          approved: false,
          requiresApproval: true,
          reason: `Purchase requires approval (over $${approvalSettings.requireApprovalOver / 100}).`,
          action: 'approval_sent_to_user',
          approvalId
        };
      }
      
      // All checks passed!
      return {
        approved: true,
        remainingLimits: {
          daily: Math.max(0, agent.dailyLimitUSD - spentTodayAmount - amountCents) / 100,
          monthly: 0, // Would calculate if we had monthly limits
          category: categoryLimit ? Math.max(0, categoryLimit - (spentThisMonthAmount || 0) - amountCents) / 100 : 999999,
          transaction: agent.transactionLimitUSD / 100
        }
      };
      
    } catch (error) {
      console.error('Spending validation error:', error);
      return {
        approved: false,
        reason: 'Validation failed due to system error',
        action: 'try_again_or_contact_support'
      };
    }
  }
  
  /**
   * Determine if a purchase requires user approval
   */
  private static requiresApproval(amountCents: number, service: string, settings: ApprovalSettings): boolean {
    // Auto-approve small amounts
    if (amountCents <= settings.autoApproveUnder) {
      return false;
    }
    
    // Always approve certain categories (with null check)
    if (settings.alwaysApprove && settings.alwaysApprove.includes(service)) {
      return false;
    }
    
    // Never approve certain categories (always require approval) (with null check)
    if (settings.neverApprove && settings.neverApprove.includes(service)) {
      return true;
    }
    
    // Require approval for large amounts
    if (amountCents > settings.requireApprovalOver) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Create an approval request for user review
   */
  private static async createApprovalRequest(
    agentId: string, 
    amountCents: number, 
    service: string, 
    params: any
  ): Promise<string> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    const approval = await prisma.purchaseApproval.create({
      data: {
        agentId,
        amount: amountCents,
        service,
        params: JSON.stringify(params || {}),
        status: 'pending',
        expiresAt
      }
    });
    
    // TODO: Send notification to user (email, SMS, push notification)
    // await this.sendApprovalNotification(approval);
    
    return approval.id;
  }
  
  /**
   * Record successful direct card spending
   */
  static async recordDirectCardSpending(
    agentId: string,
    amountCents: number,
    service: string,
    transactionId: string,
    cardLast4?: string,
    approvalId?: string
  ): Promise<void> {
    await prisma.payment.create({
      data: {
        walletId: (await prisma.agent.findUnique({ where: { id: agentId } }))!.walletId,
        agentId,
        amountUSD: amountCents,
        type: 'direct_card',
        service,
        status: 'completed',
        stripeId: transactionId,
        cardLast4,
        approvalId,
        invoice: `direct_${transactionId}`
        // Removed paymentMode field - may not exist in schema
      }
    });
  }
  
  /**
   * Get user's current spending summary
   */
  static async getSpendingSummary(agentToken: string) {
    const agent = await prisma.agent.findUnique({
      where: { token: agentToken }
    });
    
    if (!agent) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    // Daily spending
    const dailySpending = await prisma.payment.aggregate({
      where: {
        agentId: agent.id,
        createdAt: { gte: today },
        status: 'completed'
        // Removed paymentMode filter - field may not exist in schema
      },
      _sum: { amountUSD: true }
    });
    
    // Monthly spending by category
    const monthlyByCategory = await prisma.payment.groupBy({
      by: ['service'],
      where: {
        agentId: agent.id,
        createdAt: { gte: startOfMonth },
        status: 'completed',
        service: { not: null }
        // Removed paymentMode filter - field may not exist in schema
      },
      _sum: { amountUSD: true }
    });
    
    return {
      daily: {
        spent: (dailySpending._sum.amountUSD || 0) / 100,
        limit: agent.dailyLimitUSD / 100,
        remaining: Math.max(0, agent.dailyLimitUSD - (dailySpending._sum.amountUSD || 0)) / 100
      },
      monthlyByCategory: monthlyByCategory.map(cat => ({
        service: cat.service,
        spent: (cat._sum.amountUSD || 0) / 100
      })),
      limits: {
        transaction: agent.transactionLimitUSD / 100,
        velocity: agent.velocityLimit,
        emergencyStop: agent.emergencyStop
      }
    };
  }
} 