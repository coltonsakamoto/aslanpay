const db = require('./database-production.js');

(async function() {
  try {
    console.log('🔄 Creating test user and API key for demo...');
    
    // Check if test user already exists
    const existingUser = await db.getUserByEmail('demo@aslanpay.xyz');
    
    let user;
    if (existingUser) {
      console.log('✅ Test user already exists');
      user = existingUser;
    } else {
      // Create test user
      user = await db.createUser({
        email: 'demo@aslanpay.xyz',
        password: 'demo123',
        name: 'Demo User',
        emailVerified: true
      });
      console.log('✅ Created test user:', user.id);
    }
    
    // Get API keys
    const keys = await db.getApiKeysByUserId(user.id);
    if (keys.length > 0) {
      console.log('🔑 Demo API key:', keys[0].key);
      console.log('\n📋 Use this API key in your demo:');
      console.log(`Authorization: Bearer ${keys[0].key}`);
    } else {
      console.log('❌ No API keys found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
})(); 