# 🚀 Browser Automation Setup for AgentPay

## 📋 **Installation Steps**

### **1. Install Browser Automation Dependencies**

```bash
cd agent-wallet
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth puppeteer-extra-plugin-recaptcha
npm install --save-dev @types/puppeteer
```

### **2. Update Database Schema**

Ensure your `prisma/schema.prisma` has these fields (looks like it already does):

```prisma
model Wallet {
  id          String   @id @default(uuid())
  balanceSat  Int      @default(0)
  balanceUSD  Int      @default(0)    // USD in cents ✅
  // ... other fields
}

model Payment {
  id            String   @id @default(uuid())
  walletId      String
  agentId       String?
  amountSat     Int      @default(0)
  amountUSD     Int      @default(0)  // USD amount ✅
  type          String   // Service type ✅
  status        String
  // ... other fields
}
```

### **3. Regenerate Prisma Client**

```bash
npx prisma generate
npx prisma db push
```

### **4. Environment Variables**

Add to your `.env` file:

```bash
# Browser Automation
CAPTCHA_API_KEY=your_2captcha_api_key_here
PROXY_USERNAME=your_proxy_username
PROXY_PASSWORD=your_proxy_password
PROXY_ENDPOINT=residential-proxy.example.com:8080

# Account Credentials (for logged-in purchases)
AMAZON_EMAIL=your_test_amazon_account@email.com
AMAZON_PASSWORD=your_test_amazon_password
BOOKING_EMAIL=your_test_booking_account@email.com
BOOKING_PASSWORD=your_test_booking_password
```

### **5. Activate Browser Automation**

Uncomment the import in `src/index.ts`:

```typescript
// Change this:
// import BrowserAutomationService from './services/browserAutomationService';

// To this:
import BrowserAutomationService from './services/browserAutomationService';
```

And uncomment the browser automation code in the purchase endpoint.

## 🧪 **Testing Browser Automation**

### **Flight Booking Test**

```bash
curl -X POST http://localhost:3000/v1/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "agentToken": "your_agent_token_here",
    "service": "flight",
    "params": {
      "from": "SFO",
      "to": "LAX", 
      "departDate": "2024-03-15",
      "passengers": 1,
      "maxPrice": 300
    }
  }'
```

### **Hotel Booking Test**

```bash
curl -X POST http://localhost:3000/v1/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "agentToken": "your_agent_token_here",
    "service": "hotel",
    "params": {
      "location": "New York",
      "checkIn": "2024-03-15",
      "checkOut": "2024-03-17",
      "rooms": 1,
      "guests": 2,
      "maxPrice": 200
    }
  }'
```

### **Shopping Test**

```bash
curl -X POST http://localhost:3000/v1/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "agentToken": "your_agent_token_here", 
    "service": "shopping",
    "params": {
      "query": "noise canceling headphones",
      "maxPrice": 250,
      "minRating": 4.0
    }
  }'
```

## 🤖 **OpenAI Integration Example**

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define function schema for browser automation
const browserFunctions = [
  {
    name: "book_flight",
    description: "Book flights using browser automation",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Departure airport code" },
        to: { type: "string", description: "Arrival airport code" },
        departDate: { type: "string", description: "Departure date YYYY-MM-DD" },
        returnDate: { type: "string", description: "Return date YYYY-MM-DD (optional)" },
        passengers: { type: "integer", description: "Number of passengers" },
        maxPrice: { type: "number", description: "Maximum price in USD" }
      },
      required: ["from", "to", "departDate", "passengers", "maxPrice"]
    }
  },
  {
    name: "book_hotel",
    description: "Book hotels using browser automation",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "Hotel location/city" },
        checkIn: { type: "string", description: "Check-in date YYYY-MM-DD" },
        checkOut: { type: "string", description: "Check-out date YYYY-MM-DD" },
        rooms: { type: "integer", description: "Number of rooms" },
        guests: { type: "integer", description: "Number of guests" },
        maxPrice: { type: "number", description: "Maximum price per night in USD" }
      },
      required: ["location", "checkIn", "checkOut", "rooms", "guests", "maxPrice"]
    }
  },
  {
    name: "purchase_product",
    description: "Purchase products using browser automation",
    parameters: {
      type: "object", 
      properties: {
        query: { type: "string", description: "Product search query" },
        maxPrice: { type: "number", description: "Maximum price in USD" },
        category: { type: "string", description: "Product category (optional)" },
        minRating: { type: "number", description: "Minimum rating (optional)" }
      },
      required: ["query", "maxPrice"]
    }
  }
];

// Use in conversation
async function chatWithBrowserAutomation() {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "user",
        content: "Book me a flight from San Francisco to New York for March 15th, max $400"
      }
    ],
    functions: browserFunctions,
    function_call: "auto"
  });

  if (response.choices[0].message.function_call) {
    const functionCall = response.choices[0].message.function_call;
    const args = JSON.parse(functionCall.arguments);
    
    // Map to AgentPay service calls
    const serviceMap = {
      'book_flight': 'flight',
      'book_hotel': 'hotel', 
      'purchase_product': 'shopping'
    };
    
    const service = serviceMap[functionCall.name];
    
    // Make purchase via AgentPay
    const result = await fetch('http://localhost:3000/v1/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentToken: 'your_agent_token',
        service: service,
        params: args
      })
    });
    
    console.log('Purchase result:', await result.json());
  }
}
```

## 🔧 **Production Considerations**

### **1. Proxy Setup**

```typescript
// config/proxies.ts
export const PROXY_POOLS = {
  residential: [
    'http://user:pass@residential1.proxy.com:8080',
    'http://user:pass@residential2.proxy.com:8080'
  ],
  datacenter: [
    'http://user:pass@datacenter1.proxy.com:8080', 
    'http://user:pass@datacenter2.proxy.com:8080'
  ]
};
```

### **2. Anti-Detection Measures**

```typescript
// Enhanced stealth configuration
const STEALTH_CONFIG = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  viewport: { width: 1366, height: 768 },
  timezone: 'America/New_York',
  locale: 'en-US',
  webRTC: false,
  canvas: 'noise',
  webGL: 'noise'
};
```

### **3. CAPTCHA Solving**

```typescript
// 2captcha integration for CAPTCHAs
const CAPTCHA_CONFIG = {
  provider: '2captcha',
  apiKey: process.env.CAPTCHA_API_KEY,
  timeout: 120000,
  pollingInterval: 5000
};
```

### **4. Session Management**

```typescript
// Persistent sessions for logged-in accounts
const SESSION_STORE = {
  amazon: '/tmp/amazon-session',
  booking: '/tmp/booking-session',
  expedia: '/tmp/expedia-session'
};
```

## 📊 **Monitoring & Logging**

```typescript
// Enhanced logging for browser automation
const browserLogger = {
  logPageLoad: (url: string, loadTime: number) => {
    console.log(`📄 Loaded ${url} in ${loadTime}ms`);
  },
  
  logAction: (action: string, selector: string) => {
    console.log(`🖱️  ${action} on ${selector}`);
  },
  
  logPurchase: (site: string, amount: number, success: boolean) => {
    console.log(`💰 ${site} purchase: $${amount} - ${success ? '✅' : '❌'}`);
  },

  logError: (error: Error, screenshot?: string) => {
    console.error(`🚨 Browser error: ${error.message}`);
    if (screenshot) console.log(`📸 Screenshot: ${screenshot}`);
  }
};
```

## 🎯 **Success Metrics**

Track these KPIs for browser automation:

- **Success Rate**: >90% completion rate
- **Speed**: <2 minutes per transaction
- **Detection Rate**: <5% bot detection
- **Cost per Transaction**: <$0.50 in infrastructure

## 🚀 **Next Steps**

1. **Install dependencies**: `npm install` the browser automation packages
2. **Test basic automation**: Start with a simple Google search
3. **Implement one site fully**: Pick Amazon or Google Flights
4. **Add error handling**: Screenshots, retries, fallbacks
5. **Scale to more sites**: Add Booking.com, Expedia, etc.

## 💡 **Pro Tips**

- **Start simple**: Get one site working perfectly before expanding
- **Use headless: false** during development for debugging
- **Implement retry logic** for flaky selectors
- **Rotate user agents** and viewports regularly
- **Monitor for CAPTCHA trends** and adapt accordingly

---

**This transforms AgentPay from a useful API service into the universal commerce layer for AI agents! 🌍** 