import axios from 'axios';

export interface PurchaseRequest {
  agentToken: string;
  service: string;
  amount: number; // USD
  details: any;
}

export interface PurchaseResult {
  success: boolean;
  transactionId: string;
  service: string;
  amount: number;
  details?: any;
  error?: string;
}

export class PurchaseService {
  
  // Buy a domain name via Namecheap API
  static async buyDomain(domain: string, years: number = 1): Promise<PurchaseResult> {
    try {
      // Namecheap API integration
      const response = await axios.post('https://api.namecheap.com/xml.response', {
        ApiUser: process.env.NAMECHEAP_API_USER,
        ApiKey: process.env.NAMECHEAP_API_KEY,
        Command: 'namecheap.domains.create',
        DomainName: domain,
        Years: years
      });
      
      return {
        success: true,
        transactionId: response.data.transactionId,
        service: 'namecheap',
        amount: response.data.amount,
        details: { domain, years }
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        service: 'namecheap',
        amount: 0,
        error: error.message
      };
    }
  }

  // Buy AWS credits
  static async buyAWSCredits(amount: number): Promise<PurchaseResult> {
    try {
      // AWS Marketplace API integration (simplified)
      const response = await axios.post('https://aws-marketplace-api.amazonaws.com/credits', {
        amount: amount,
        currency: 'USD'
      }, {
        headers: {
          'Authorization': `AWS4-HMAC-SHA256 ${process.env.AWS_ACCESS_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: true,
        transactionId: response.data.creditId,
        service: 'aws',
        amount: amount,
        details: { credits: amount }
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        service: 'aws',
        amount: 0,
        error: error.message
      };
    }
  }

  // Buy a gift card via CardCash API
  static async buyGiftCard(brand: string, amount: number): Promise<PurchaseResult> {
    try {
      const response = await axios.post('https://api.cardcash.com/v1/gift-cards/purchase', {
        brand: brand, // 'amazon', 'starbucks', 'target', etc.
        amount: amount,
        currency: 'USD',
        format: 'digital'
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.CARDCASH_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: true,
        transactionId: response.data.orderId,
        service: 'gift-card',
        amount: amount,
        details: { 
          brand, 
          cardNumber: response.data.cardNumber,
          pin: response.data.pin 
        }
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        service: 'gift-card',
        amount: 0,
        error: error.message
      };
    }
  }

  // Book a flight via Amadeus API
  static async bookFlight(origin: string, destination: string, date: string): Promise<PurchaseResult> {
    try {
      // First, search for flights
      const searchResponse = await axios.get('https://api.amadeus.com/v2/shopping/flight-offers', {
        params: {
          originLocationCode: origin,
          destinationLocationCode: destination,
          departureDate: date,
          adults: 1
        },
        headers: {
          'Authorization': `Bearer ${process.env.AMADEUS_ACCESS_TOKEN}`
        }
      });

      const cheapestFlight = searchResponse.data.data[0];
      
      // Book the flight
      const bookingResponse = await axios.post('https://api.amadeus.com/v1/booking/flight-orders', {
        data: {
          type: 'flight-order',
          flightOffers: [cheapestFlight],
          travelers: [{
            id: '1',
            dateOfBirth: '1990-01-01',
            name: {
              firstName: 'AI',
              lastName: 'Agent'
            }
          }]
        }
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.AMADEUS_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: true,
        transactionId: bookingResponse.data.data.id,
        service: 'amadeus-flight',
        amount: parseFloat(cheapestFlight.price.total),
        details: {
          origin,
          destination,
          date,
          flightNumber: cheapestFlight.itineraries[0].segments[0].number,
          confirmationCode: bookingResponse.data.data.associatedRecords[0].reference
        }
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        service: 'amadeus-flight',
        amount: 0,
        error: error.message
      };
    }
  }

  // Order food via DoorDash API
  static async orderFood(restaurantId: string, items: any[], deliveryAddress: string): Promise<PurchaseResult> {
    try {
      const response = await axios.post('https://api.doordash.com/v1/orders', {
        external_delivery_id: `agent-${Date.now()}`,
        pickup_address: restaurantId,
        delivery_address: deliveryAddress,
        items: items,
        tip_amount: 500 // $5 tip in cents
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.DOORDASH_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: true,
        transactionId: response.data.external_delivery_id,
        service: 'doordash',
        amount: response.data.fee / 100, // Convert cents to dollars
        details: {
          restaurant: restaurantId,
          items: items.length,
          deliveryAddress,
          estimatedDelivery: response.data.pickup_time
        }
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        service: 'doordash',
        amount: 0,
        error: error.message
      };
    }
  }

  // Generic API purchase handler
  static async makePurchase(service: string, params: any): Promise<PurchaseResult> {
    switch (service) {
      case 'domain':
        return this.buyDomain(params.domain, params.years);
      case 'aws-credits':
        return this.buyAWSCredits(params.amount);
      case 'gift-card':
        return this.buyGiftCard(params.brand, params.amount);
      case 'flight':
        return this.bookFlight(params.origin, params.destination, params.date);
      case 'food':
        return this.orderFood(params.restaurantId, params.items, params.address);
      default:
        return {
          success: false,
          transactionId: '',
          service,
          amount: 0,
          error: 'Unknown service'
        };
    }
  }
}

export default PurchaseService; 