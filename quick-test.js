const axios = require('axios');

async function quickTest() {
  const walletId = "fa5b6552-d8c7-405c-8429-b7ca26c69f46";
  
  console.log('💰 Adding USD balance to wallet for testing...');
  
  // Quick fix: Fund both balances
  try {
    const response = await axios.patch(`http://localhost:3000/v1/wallets/${walletId}/add-usd`, {
      amount: 100
    });
    console.log('✅ USD balance added:', response.data);
  } catch (error) {
    console.log('⚠️ USD endpoint not found, wallet has:', error.response?.data);
  }
}

quickTest(); 