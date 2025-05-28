export interface PurchaseResult {
  success: boolean;
  transactionId: string;
  service: string;
  amount: number;
  details?: any;
  error?: string;
}

// Import the real Twilio service for actual API calls
import TwilioService from './twilioService';

export class TestPurchaseService {
  
  // **REAL** Twilio SMS purchase (actual API call!)
  static async sendRealSMS(to: string, message: string): Promise<PurchaseResult> {
    console.log('🚨 MAKING REAL TWILIO API CALL! 🚨');
    const result = await TwilioService.sendSMS(to, message);
    return {
      success: result.success,
      transactionId: result.transactionId,
      service: result.service,
      amount: result.amount,
      details: result.details,
      error: result.error
    };
  }
  
  // Simulate buying a domain name (for demo)
  static async buyDomain(domain: string, years: number = 1): Promise<PurchaseResult> {
    const cost = 12.99 * years; // Standard domain cost
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          transactionId: `dom_${Date.now()}`,
          service: 'domain',
          amount: cost,
          details: { 
            domain, 
            years,
            registrar: 'TestRegistrar',
            expires: new Date(Date.now() + years * 365 * 24 * 60 * 60 * 1000).toISOString()
          }
        });
      }, 1000);
    });
  }

  // Simulate buying AWS credits
  static async buyAWSCredits(amount: number): Promise<PurchaseResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          transactionId: `aws_${Date.now()}`,
          service: 'aws-credits',
          amount: amount,
          details: { 
            credits: amount,
            account: 'test-account-123',
            validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          }
        });
      }, 1500);
    });
  }

  // Simulate buying a gift card
  static async buyGiftCard(brand: string, amount: number): Promise<PurchaseResult> {
    const brands = ['amazon', 'starbucks', 'target', 'walmart', 'apple'];
    
    if (!brands.includes(brand.toLowerCase())) {
      return {
        success: false,
        transactionId: '',
        service: 'gift-card',
        amount: 0,
        error: `Brand ${brand} not supported. Available: ${brands.join(', ')}`
      };
    }
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          transactionId: `gc_${Date.now()}`,
          service: 'gift-card',
          amount: amount,
          details: { 
            brand,
            cardNumber: '**** **** **** ' + Math.floor(1000 + Math.random() * 9000),
            pin: Math.floor(1000 + Math.random() * 9000),
            expires: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString()
          }
        });
      }, 800);
    });
  }

  // Simulate VPS/hosting purchase
  static async buyVPS(plan: string, months: number = 1): Promise<PurchaseResult> {
    const plans: Record<string, number> = {
      'basic': 5.99,
      'standard': 12.99,
      'premium': 24.99,
      'enterprise': 49.99
    };
    
    const monthlyRate = plans[plan.toLowerCase()];
    if (!monthlyRate) {
      return {
        success: false,
        transactionId: '',
        service: 'vps',
        amount: 0,
        error: `Plan ${plan} not found. Available: ${Object.keys(plans).join(', ')}`
      };
    }
    
    const totalCost = monthlyRate * months;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          transactionId: `vps_${Date.now()}`,
          service: 'vps',
          amount: totalCost,
          details: { 
            plan,
            months,
            monthlyRate,
            serverIP: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            username: 'root',
            setupTime: '2-5 minutes'
          }
        });
      }, 2000);
    });
  }

  // Simulate SaaS subscription
  static async buySaaS(service: string, plan: string): Promise<PurchaseResult> {
    const services: Record<string, Record<string, number>> = {
      'slack': { 'pro': 8.75, 'business': 15 },
      'notion': { 'personal': 5, 'team': 10, 'enterprise': 20 },
      'github': { 'pro': 4, 'team': 4, 'enterprise': 21 },
      'figma': { 'professional': 12, 'organization': 45 }
    };
    
    const serviceRates = services[service.toLowerCase()];
    if (!serviceRates) {
      return {
        success: false,
        transactionId: '',
        service: 'saas',
        amount: 0,
        error: `Service ${service} not found. Available: ${Object.keys(services).join(', ')}`
      };
    }
    
    const monthlyRate = serviceRates[plan.toLowerCase()];
    if (!monthlyRate) {
      return {
        success: false,
        transactionId: '',
        service: 'saas',
        amount: 0,
        error: `Plan ${plan} not found for ${service}. Available: ${Object.keys(serviceRates).join(', ')}`
      };
    }
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          transactionId: `saas_${Date.now()}`,
          service: 'saas',
          amount: monthlyRate,
          details: { 
            service,
            plan,
            monthlyRate,
            billingCycle: 'monthly',
            nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        });
      }, 1200);
    });
  }

  // Generic purchase handler
  static async makePurchase(service: string, params: any): Promise<PurchaseResult> {
    console.log(`Processing ${service} purchase:`, params);
    
    switch (service) {
      case 'sms':
        // **REAL API CALL** - This will actually send an SMS!
        return this.sendRealSMS(params.to, params.message);
      case 'domain':
        return this.buyDomain(params.domain, params.years || 1);
      case 'aws-credits':
        return this.buyAWSCredits(params.amount);
      case 'gift-card':
        return this.buyGiftCard(params.brand, params.amount);
      case 'vps':
        return this.buyVPS(params.plan, params.months || 1);
      case 'saas':
        return this.buySaaS(params.service, params.plan);
      default:
        return {
          success: false,
          transactionId: '',
          service,
          amount: 0,
          error: `Unknown service: ${service}. Available: sms (REAL!), domain, aws-credits, gift-card, vps, saas`
        };
    }
  }

  // Generic purchase for any service type
  static async genericPurchase(service: string, amount: number, params: any): Promise<PurchaseResult> {
    try {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      const transactionId = `${service}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`✅ Generic purchase completed: ${service} for $${amount}`);
      
      return {
        success: true,
        transactionId,
        service,
        amount,
        details: {
          service,
          amount,
          params,
          note: `Successfully purchased ${service}`,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error: any) {
      console.error(`❌ Generic purchase failed for ${service}:`, error);
      return {
        success: false,
        error: `Failed to purchase ${service}: ${error.message}`,
        transactionId: `failed_${service}_${Date.now()}`,
        service,
        amount: 0
      };
    }
  }
}

export default TestPurchaseService; 