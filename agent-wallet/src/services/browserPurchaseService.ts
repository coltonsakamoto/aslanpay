import { chromium, Browser, Page } from 'playwright';

export interface BrowserPurchaseRequest {
  agentToken: string;
  website: string;
  purchaseType: 'flight' | 'hotel' | 'ecommerce' | 'restaurant';
  params: any;
  maxAmount: number;
}

export interface BrowserPurchaseResult {
  success: boolean;
  transactionId: string;
  amount: number;
  details: any;
  screenshots?: string[];
  error?: string;
}

export class BrowserPurchaseService {
  
  // Book a flight on any airline website
  static async bookFlight(params: {
    website: string, // 'united.com', 'delta.com', etc.
    origin: string,
    destination: string, 
    date: string,
    passengers: number,
    maxPrice: number
  }): Promise<BrowserPurchaseResult> {
    
    let browser: Browser | null = null;
    let page: Page | null = null;
    
    try {
      console.log(`🤖 AI Agent opening browser to book flight on ${params.website}...`);
      
      // Launch browser
      browser = await chromium.launch({ headless: false }); // headless: false to see it work!
      page = await browser.newPage();
      
      // Navigate to airline website
      await page.goto(`https://${params.website}`);
      
      // AI-powered form filling (this is where it gets interesting!)
      await this.fillFlightSearchForm(page, params);
      
      // Search for flights
      await page.click('[data-testid="search-button"], .search-btn, button:has-text("Search")');
      await page.waitForLoadState('networkidle');
      
      // Find cheapest flight under budget
      const flights = await this.findAvailableFlights(page, params.maxPrice);
      
      if (flights.length === 0) {
        return {
          success: false,
          transactionId: '',
          amount: 0,
          details: {},
          error: `No flights found under $${params.maxPrice}`
        };
      }
      
      // Select the best flight
      const selectedFlight = flights[0];
      await page.click(`[data-flight-id="${selectedFlight.id}"]`);
      
      // Fill passenger details (from wallet profile)
      await this.fillPassengerDetails(page);
      
      // Use saved payment method from AgentPay wallet
      await this.completePayment(page, selectedFlight.price);
      
      // Capture confirmation
      const confirmationNumber = await page.textContent('.confirmation-number, .booking-ref');
      
      return {
        success: true,
        transactionId: confirmationNumber || `flight_${Date.now()}`,
        amount: selectedFlight.price,
        details: {
          airline: params.website,
          origin: params.origin,
          destination: params.destination,
          date: params.date,
          flightNumber: selectedFlight.flightNumber,
          confirmationNumber
        }
      };
      
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        amount: 0,
        details: {},
        error: `Flight booking failed: ${error.message}`
      };
    } finally {
      if (browser) await browser.close();
    }
  }
  
  // Shop on any e-commerce website
  static async shopOnWebsite(params: {
    website: string, // 'amazon.com', 'bestbuy.com', etc.
    searchQuery: string,
    maxPrice: number,
    quantity: number
  }): Promise<BrowserPurchaseResult> {
    
    let browser: Browser | null = null;
    
    try {
      console.log(`🛒 AI Agent shopping for "${params.searchQuery}" on ${params.website}...`);
      
      browser = await chromium.launch({ headless: false });
      const page = await browser.newPage();
      
      // Navigate and search
      await page.goto(`https://${params.website}`);
      await page.fill('[name="search"], [placeholder*="Search"]', params.searchQuery);
      await page.press('[name="search"]', 'Enter');
      
      // Find products under budget
      const products = await this.findProducts(page, params.maxPrice);
      
      if (products.length === 0) {
        return {
          success: false,
          transactionId: '',
          amount: 0,
          details: {},
          error: `No products found under $${params.maxPrice}`
        };
      }
      
      // Add to cart and checkout
      const selectedProduct = products[0];
      await page.click(`[data-product-id="${selectedProduct.id}"] .add-to-cart`);
      await page.click('.cart-button, [href*="cart"]');
      
      // Complete purchase with AgentPay wallet payment method
      await this.completeEcommercePurchase(page, selectedProduct);
      
      return {
        success: true,
        transactionId: `ecom_${Date.now()}`,
        amount: selectedProduct.price,
        details: {
          website: params.website,
          product: selectedProduct.name,
          price: selectedProduct.price,
          quantity: params.quantity
        }
      };
      
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        amount: 0,
        details: {},
        error: `Shopping failed: ${error.message}`
      };
    } finally {
      if (browser) await browser.close();
    }
  }
  
  // Helper methods (simplified for concept)
  static async fillFlightSearchForm(page: Page, params: any) {
    // AI-powered form detection and filling
    await page.fill('[name="origin"], [placeholder*="From"]', params.origin);
    await page.fill('[name="destination"], [placeholder*="To"]', params.destination);
    await page.fill('[name="date"], [type="date"]', params.date);
  }
  
  static async findAvailableFlights(page: Page, maxPrice: number) {
    // AI-powered flight result parsing
    return [
      { id: 'flight1', price: 299, flightNumber: 'UA123' },
      { id: 'flight2', price: 349, flightNumber: 'UA456' }
    ].filter(f => f.price <= maxPrice);
  }
  
  static async findProducts(page: Page, maxPrice: number) {
    // AI-powered product parsing
    return [
      { id: 'prod1', name: 'Laptop', price: 899 },
      { id: 'prod2', name: 'Phone', price: 699 }
    ].filter(p => p.price <= maxPrice);
  }
  
  static async fillPassengerDetails(page: Page) {
    // Use profile data from AgentPay wallet
    await page.fill('[name="firstName"]', 'AI');
    await page.fill('[name="lastName"]', 'Agent');
    await page.fill('[name="email"]', 'agent@agentpay.com');
  }
  
  static async completePayment(page: Page, amount: number) {
    // Use saved payment method from AgentPay wallet
    await page.fill('[name="cardNumber"]', '4111111111111111'); // Test card
    await page.fill('[name="expiry"]', '12/26');
    await page.fill('[name="cvv"]', '123');
    await page.click('.pay-button, [type="submit"]');
  }
  
  static async completeEcommercePurchase(page: Page, product: any) {
    // Complete checkout flow
    await page.click('.checkout-button');
    await this.completePayment(page, product.price);
  }
}

export default BrowserPurchaseService; 