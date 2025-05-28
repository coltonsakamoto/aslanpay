import axios from 'axios';

export interface TwilioResult {
  success: boolean;
  transactionId: string;
  service: string;
  amount: number;
  details?: any;
  error?: string;
}

export class TwilioService {
  
  // Send a real SMS message via Twilio
  static async sendSMS(to: string, message: string): Promise<TwilioResult> {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      
      if (!accountSid || !authToken || !fromNumber) {
        return {
          success: false,
          transactionId: '',
          service: 'twilio-sms',
          amount: 0,
          error: 'Twilio credentials not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env'
        };
      }
      
      // Create basic auth header
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      
      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        new URLSearchParams({
          From: fromNumber,
          To: to,
          Body: message
        }),
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      const cost = 0.0075; // ~$0.0075 per SMS in US
      
      return {
        success: true,
        transactionId: response.data.sid,
        service: 'twilio-sms',
        amount: cost,
        details: {
          to: response.data.to,
          from: response.data.from,
          message: response.data.body,
          status: response.data.status,
          dateCreated: response.data.date_created,
          cost: `$${cost}`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        service: 'twilio-sms',
        amount: 0,
        error: `SMS failed: ${error.response?.data?.message || error.message}`
      };
    }
  }
  
  // Make a phone call (more expensive, ~$0.02)
  static async makeCall(to: string, message: string): Promise<TwilioResult> {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      
      if (!accountSid || !authToken || !fromNumber) {
        return {
          success: false,
          transactionId: '',
          service: 'twilio-call',
          amount: 0,
          error: 'Twilio credentials not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env'
        };
      }
      
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      
      // Create TwiML URL for the message
      const twimlUrl = `https://twimlets.com/message?Message=${encodeURIComponent(message)}`;
      
      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
        new URLSearchParams({
          From: fromNumber,
          To: to,
          Url: twimlUrl
        }),
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      const cost = 0.022; // ~$0.022 per minute in US
      
      return {
        success: true,
        transactionId: response.data.sid,
        service: 'twilio-call',
        amount: cost,
        details: {
          to: response.data.to,
          from: response.data.from,
          status: response.data.status,
          direction: response.data.direction,
          dateCreated: response.data.date_created,
          cost: `$${cost}`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        service: 'twilio-call',
        amount: 0,
        error: `Call failed: ${error.response?.data?.message || error.message}`
      };
    }
  }
  
  // Generic purchase handler
  static async makePurchase(params: any): Promise<TwilioResult> {
    const { action, to, message } = params;
    
    console.log(`AI Agent making Twilio ${action}:`, { to, message: message.substring(0, 50) + '...' });
    
    switch (action) {
      case 'sms':
        return this.sendSMS(to, message);
      case 'call':
        return this.makeCall(to, message);
      default:
        return {
          success: false,
          transactionId: '',
          service: 'twilio',
          amount: 0,
          error: `Unknown action: ${action}. Available: sms, call`
        };
    }
  }
}

export default TwilioService; 