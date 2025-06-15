import Stripe from 'stripe';

// Initialize Stripe only if API key is available
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
let stripe: Stripe | null = null;

if (STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.trim() !== '') {
  stripe = new Stripe(STRIPE_SECRET_KEY);
  console.log('Stripe initialized successfully');
} else {
  console.warn('STRIPE_SECRET_KEY not found - Stripe functionality will be disabled');
}

export class StripeService {
  
  private static checkStripeInitialized(): Stripe {
    if (!stripe) {
      throw new Error('Stripe is not initialized. Please check STRIPE_SECRET_KEY environment variable.');
    }
    return stripe;
  }
  
  // Create a Stripe customer
  static async createCustomer(email?: string, name?: string): Promise<Stripe.Customer> {
    try {
      const stripeInstance = this.checkStripeInitialized();
      const customer = await stripeInstance.customers.create({
        email,
        name,
        metadata: {
          source: 'agentpay'
        }
      });
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  // Get or create customer for wallet
  static async getOrCreateCustomer(walletId: string): Promise<Stripe.Customer> {
    try {
      const stripeInstance = this.checkStripeInitialized();
      
      console.log(`🔍 Looking for existing Stripe customer for wallet: ${walletId}`);
      
      // Search for existing customer by wallet_id in metadata
      // We'll list recent customers and check their metadata
      const existingCustomers = await stripeInstance.customers.list({
        limit: 100  // Check last 100 customers for existing wallet
      });
      
      console.log(`📊 Found ${existingCustomers.data.length} existing customers to check`);
      
      // Find customer with matching wallet_id in metadata
      const existingCustomer = existingCustomers.data.find(customer => 
        customer.metadata && customer.metadata.wallet_id === walletId
      );
      
      if (existingCustomer) {
        console.log(`✅ Found existing Stripe customer for wallet ${walletId}:`, existingCustomer.id);
        return existingCustomer;
      }
      
      console.log(`🆕 Creating new Stripe customer for wallet: ${walletId}`);
      
      // Create new customer if none found
      const customer = await stripeInstance.customers.create({
        metadata: {
          source: 'agentpay',
          wallet_id: walletId
        }
      });
      
      console.log(`✅ Created new Stripe customer for wallet ${walletId}:`, customer.id);
      return customer;
    } catch (error: any) {
      console.error('❌ Error getting/creating Stripe customer:', error);
      console.error('❌ Customer error details:', {
        message: error.message,
        type: error.type,
        code: error.code,
        walletId
      });
      throw new Error(`Failed to get or create customer: ${error.message}`);
    }
  }

  // Create payment method from card details
  static async createPaymentMethod(cardToken: string): Promise<Stripe.PaymentMethod> {
    try {
      const stripeInstance = this.checkStripeInitialized();
      const paymentMethod = await stripeInstance.paymentMethods.create({
        type: 'card',
        card: { token: cardToken }
      });
      return paymentMethod;
    } catch (error) {
      console.error('Error creating payment method:', error);
      throw new Error('Failed to create payment method');
    }
  }

  // Create test payment method using Stripe's test card
  static async createTestPaymentMethod(customerId: string): Promise<Stripe.PaymentMethod> {
    try {
      const stripeInstance = this.checkStripeInitialized();
      
      // Create a test payment method using Stripe's test card
      const paymentMethod = await stripeInstance.paymentMethods.create({
        type: 'card',
        card: {
          number: '4242424242424242',  // Stripe's test Visa card
          exp_month: 12,
          exp_year: 2030,
          cvc: '123',
        },
      });
      
      // Attach it to the customer
      await stripeInstance.paymentMethods.attach(paymentMethod.id, {
        customer: customerId
      });
      
      return paymentMethod;
    } catch (error) {
      console.error('Error creating test payment method:', error);
      throw new Error('Failed to create test payment method');
    }
  }

  // Attach payment method to customer
  static async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<Stripe.PaymentMethod> {
    try {
      const stripeInstance = this.checkStripeInitialized();
      
      console.log(`🔗 Attempting to attach payment method ${paymentMethodId} to customer ${customerId}`);
      
      const paymentMethod = await stripeInstance.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
      
      console.log(`✅ Successfully attached payment method ${paymentMethodId} to customer ${customerId}`);
      return paymentMethod;
    } catch (error: any) {
      console.error('❌ Stripe API Error attaching payment method:', error);
      console.error('❌ Error details:', {
        message: error.message,
        type: error.type,
        code: error.code,
        param: error.param,
        paymentMethodId,
        customerId
      });
      
      // Provide more specific error messages based on Stripe error types
      if (error.type === 'StripeInvalidRequestError') {
        if (error.message.includes('No such payment_method')) {
          throw new Error(`Payment method ${paymentMethodId} not found or invalid`);
        }
        if (error.message.includes('No such customer')) {
          throw new Error(`Customer ${customerId} not found`);
        }
        if (error.message.includes('already been attached')) {
          throw new Error(`Payment method ${paymentMethodId} is already attached to a customer`);
        }
      }
      
      // Re-throw with original error message for debugging
      throw new Error(`Failed to attach payment method: ${error.message}`);
    }
  }

  // Create payment intent for funding wallet
  static async createPaymentIntent(
    amount: number, // in cents
    customerId: string,
    paymentMethodId?: string
  ): Promise<Stripe.PaymentIntent> {
    try {
      const stripeInstance = this.checkStripeInitialized();
      
      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customerId,  // Add the customer parameter
        payment_method: paymentMethodId,
        confirmation_method: 'automatic',
        confirm: true,
        return_url: 'http://localhost:3000/stripe-checkout.html?success=true',
        metadata: {
          type: 'wallet_funding',
          source: 'agentpay',
          customerId: customerId
        }
      });
      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error; // Re-throw the original error instead of wrapping it
    }
  }

  // Get customer payment methods
  static async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const stripeInstance = this.checkStripeInitialized();
      const paymentMethods = await stripeInstance.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });
      return paymentMethods.data;
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      throw new Error('Failed to fetch payment methods');
    }
  }

  // Detach/delete payment method
  static async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      const stripeInstance = this.checkStripeInitialized();
      const paymentMethod = await stripeInstance.paymentMethods.detach(paymentMethodId);
      return paymentMethod;
    } catch (error) {
      console.error('Error detaching payment method:', error);
      throw new Error('Failed to detach payment method');
    }
  }

  // Create setup intent for saving card without charging
  static async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const stripeInstance = this.checkStripeInitialized();
      const setupIntent = await stripeInstance.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session'
      });
      return setupIntent;
    } catch (error) {
      console.error('Error creating setup intent:', error);
      throw new Error('Failed to create setup intent');
    }
  }

  // Process refund
  static async createRefund(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    try {
      const stripeInstance = this.checkStripeInitialized();
      const refund = await stripeInstance.refunds.create({
        payment_intent: paymentIntentId,
        amount
      });
      return refund;
    } catch (error) {
      console.error('Error creating refund:', error);
      throw new Error('Failed to create refund');
    }
  }
}

export default StripeService; 