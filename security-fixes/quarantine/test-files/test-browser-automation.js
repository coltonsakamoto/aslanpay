// 🚀 AgentPay Browser Automation Demo
// Run: node test-browser-automation.js

const axios = require('axios');

const AGENTPAY_API = 'http://localhost:3000';

async function testBrowserAutomation() {
  console.log('🤖 Testing AgentPay Browser Automation...\n');

  // First, create a wallet and agent
  console.log('1️⃣ Creating wallet...');
  const walletResponse = await axios.post(`${AGENTPAY_API}/v1/wallets`);
  const walletId = walletResponse.data.walletId;
  console.log(`✅ Wallet created: ${walletId}\n`);

  // Fund the wallet
  console.log('2️⃣ Funding wallet with $1000...');
  await axios.post(`${AGENTPAY_API}/v1/wallets/${walletId}/fund`, {
    usd: 1000
  });
  console.log('✅ Wallet funded\n');

  // Create agent
  console.log('3️⃣ Creating AI agent...');
  const agentResponse = await axios.post(`${AGENTPAY_API}/v1/agents`, {
    walletId: walletId,
    dailyUsdLimit: 500
  });
  const agentToken = agentResponse.data.agentToken;
  console.log(`✅ Agent created with token\n`);

  // Test browser automation services
  const tests = [
    {
      name: '✈️ Flight Booking',
      service: 'flight',
      params: {
        from: 'SFO',
        to: 'NYC',
        departDate: '2024-04-15',
        passengers: 1,
        maxPrice: 400
      }
    },
    {
      name: '🏨 Hotel Booking', 
      service: 'hotel',
      params: {
        location: 'Las Vegas',
        checkIn: '2024-04-15',
        checkOut: '2024-04-17',
        rooms: 1,
        guests: 2,
        maxPrice: 150
      }
    },
    {
      name: '🛒 Product Shopping',
      service: 'shopping',
      params: {
        query: 'wireless noise-canceling headphones',
        maxPrice: 200,
        minRating: 4.0
      }
    },
    {
      name: '🍽️ Restaurant Reservation',
      service: 'restaurant',
      params: {
        location: 'San Francisco',
        cuisine: 'Italian',
        date: '2024-04-15',
        time: '7:00 PM',
        party: 4,
        maxPrice: 100
      }
    },
    {
      name: '🎫 Event Tickets',
      service: 'tickets',
      params: {
        event: 'Warriors vs Lakers',
        location: 'Chase Center',
        date: '2024-04-20',
        quantity: 2,
        maxPrice: 300
      }
    }
  ];

  for (const test of tests) {
    console.log(`4️⃣ Testing ${test.name}...`);
    
    try {
      const purchaseResponse = await axios.post(`${AGENTPAY_API}/v1/purchase`, {
        agentToken: agentToken,
        service: test.service,
        params: test.params
      });

      const result = purchaseResponse.data;
      
      console.log(`✅ ${test.name} Result:`);
      console.log(`   💰 Amount: $${result.amount}`);
      console.log(`   🆔 Transaction: ${result.transactionId}`);
      console.log(`   📍 Service: ${result.service}`);
      console.log(`   🎯 Details:`, result.details);
      console.log(`   💳 Remaining Balance: $${result.remainingBalance}\n`);
      
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error.response?.data || error.message);
      console.log('');
    }
  }

  // Show current capabilities
  console.log('🌍 **BROWSER AUTOMATION CAPABILITIES:**\n');
  
  console.log('✈️  **FLIGHTS:**');
  console.log('   • Google Flights - Search, compare, book');
  console.log('   • Kayak - Multi-airline comparison');
  console.log('   • Expedia - Package deals');
  console.log('   • Individual airline sites (United, Delta, etc.)\n');
  
  console.log('🏨 **HOTELS:**');
  console.log('   • Booking.com - Global hotel inventory');
  console.log('   • Hotels.com - Loyalty program integration');
  console.log('   • Expedia - Package deals');
  console.log('   • Airbnb - Alternative accommodations\n');
  
  console.log('🛒 **SHOPPING:**');
  console.log('   • Amazon - Vast product selection');
  console.log('   • Best Buy - Electronics and tech');
  console.log('   • Target - General merchandise');
  console.log('   • Walmart - Groceries and essentials\n');
  
  console.log('🍽️  **DINING:**');
  console.log('   • OpenTable - Restaurant reservations');
  console.log('   • Resy - High-end dining');
  console.log('   • Yelp - Local discovery and booking');
  console.log('   • DoorDash/Uber Eats - Food delivery\n');
  
  console.log('🎫 **ENTERTAINMENT:**');
  console.log('   • Ticketmaster - Concerts, sports, theater');
  console.log('   • StubHub - Secondary ticket market');
  console.log('   • SeatGeek - Event discovery');
  console.log('   • Local venue websites\n');

  console.log('🚀 **THE VISION:**');
  console.log('   "Hey ChatGPT, book me a weekend trip to NYC under $1000"');
  console.log('   → AI books flights, hotel, restaurant reservations, Broadway show');
  console.log('   → All autonomous, all paid for, all confirmed');
  console.log('   → AgentPay handles everything seamlessly\n');
  
  console.log('💰 **MARKET IMPACT:**');
  console.log('   Current API services: $0.01 - $50 transactions');
  console.log('   Browser automation: $50 - $5,000+ transactions'); 
  console.log('   100x larger transaction sizes = 100x more revenue\n');
  
  console.log('🏆 **COMPETITIVE ADVANTAGE:**');
  console.log('   • First universal AI commerce platform');
  console.log('   • Works with ANY website (millions vs dozens)');
  console.log('   • Extremely difficult for competitors to replicate');
  console.log('   • Network effects: more sites = more valuable\n');
  
  console.log('✨ **THIS IS THE FUTURE OF COMMERCE** ✨');
}

// OpenAI Integration Example
async function demonstrateOpenAIIntegration() {
  console.log('\n🤖 **OpenAI + AgentPay Integration Example:**\n');
  
  const examplePrompts = [
    "Book me a flight to Tokyo for next month under $800",
    "Find and order the best rated wireless headphones under $150", 
    "Reserve a table for 4 at a nice Italian restaurant in SF tomorrow",
    "Get me 2 tickets to the next Warriors game under $200 each",
    "Book a hotel in Paris for 3 nights next week under $200/night"
  ];
  
  console.log('🗣️  **User prompts that AgentPay can now handle:**\n');
  
  examplePrompts.forEach((prompt, i) => {
    console.log(`${i + 1}. "${prompt}"`);
    console.log(`   → AI understands intent`);
    console.log(`   → Routes to browser automation`);
    console.log(`   → Completes purchase autonomously`);
    console.log(`   → Returns confirmation details\n`);
  });
  
  console.log('📊 **Function Calling Schema:**');
  console.log(`
{
  "name": "agentpay_purchase",
  "description": "Make autonomous purchases via browser automation",
  "parameters": {
    "type": "object",
    "properties": {
      "service": {
        "type": "string",
        "enum": ["flight", "hotel", "shopping", "restaurant", "tickets"]
      },
      "params": {
        "type": "object",
        "description": "Service-specific parameters"
      }
    },
    "required": ["service", "params"]
  }
}
  `);
}

// Run the demo
if (require.main === module) {
  testBrowserAutomation()
    .then(() => demonstrateOpenAIIntegration())
    .catch(console.error);
}

module.exports = { testBrowserAutomation, demonstrateOpenAIIntegration }; 