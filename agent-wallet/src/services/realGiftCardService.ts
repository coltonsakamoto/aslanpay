import axios from 'axios';

export interface GiftCardResult {
  success: boolean;
  transactionId: string;
  service: string;
  amount: number;
  details?: any;
  error?: string;
}

export class RealGiftCardService {
  
  // Buy a real gift card via Tango Card API
  static async buyGiftCard(brand: string, amount: number): Promise<GiftCardResult> {
    try {
      // Tango Card API - easier to set up than CardCash
      const response = await axios.post('https://integration-api.tangocard.com/raas/v2/orders', {
        accountIdentifier: process.env.TANGO_ACCOUNT_ID,
        customerIdentifier: `agent-${Date.now()}`,
        amount: {
          currencyCode: 'USD',
          total: amount
        },
        utid: brand, // Amazon: 'B01lyocvfr', Starbucks: 'B01lyl8ccu'
        recipient: {
          name: 'AI Agent',
          email: process.env.GIFT_CARD_EMAIL || 'test@example.com'
        }
      }, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.TANGO_PLATFORM_NAME}:${process.env.TANGO_PLATFORM_KEY}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: true,
        transactionId: response.data.referenceOrderID,
        service: 'tango-gift-card',
        amount: amount,
        details: { 
          brand,
          giftCard: {
            number: response.data.reward.credentials.number,
            pin: response.data.reward.credentials.pin,
            url: response.data.reward.redemptionInstructions
          },
          recipient: response.data.recipient.email,
          expires: response.data.reward.expirationDate
        }
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        service: 'tango-gift-card',
        amount: 0,
        error: `Gift card purchase failed: ${error.response?.data?.message || error.message}`
      };
    }
  }

  // Alternative: Use Gyft API (also real)
  static async buyGyftCard(brand: string, amount: number): Promise<GiftCardResult> {
    try {
      const response = await axios.post('https://api.gyft.com/mashery/v1/reseller/orders', {
        giftcard_sku: brand, // 'amazon', 'starbucks-usa', etc.
        price_in_cents: amount * 100,
        recipient_name: 'AI Agent Purchase',
        sender_name: 'AgentPay'
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.GYFT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: true,
        transactionId: response.data.gift_id,
        service: 'gyft',
        amount: amount,
        details: { 
          brand,
          giftCard: {
            number: response.data.card_number,
            pin: response.data.security_code,
            barcode: response.data.barcode
          },
          redemptionUrl: response.data.redemption_url
        }
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        service: 'gyft',
        amount: 0,
        error: `Gyft purchase failed: ${error.response?.data?.error || error.message}`
      };
    }
  }

  // Wrapper function to try different services
  static async makePurchase(params: any): Promise<GiftCardResult> {
    const { brand, amount } = params;
    
    // Try Tango Card first (most reliable)
    if (process.env.TANGO_PLATFORM_KEY) {
      console.log('Attempting Tango Card purchase...');
      return this.buyGiftCard(brand, amount);
    }
    
    // Fallback to Gyft
    if (process.env.GYFT_API_KEY) {
      console.log('Attempting Gyft purchase...');
      return this.buyGyftCard(brand, amount);
    }
    
    return {
      success: false,
      transactionId: '',
      service: 'gift-card',
      amount: 0,
      error: 'No gift card API keys configured. Please add TANGO_PLATFORM_KEY or GYFT_API_KEY to .env'
    };
  }
}

export default RealGiftCardService; 