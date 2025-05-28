// Test Prisma Type Generation
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPrismaTypes() {
  console.log('🧪 Testing Prisma TypeScript types...\n');
  
  try {
    // Test Wallet types
    console.log('✅ Testing Wallet model...');
    const wallet = await prisma.wallet.create({
      data: {
        balanceSat: 1000,
        balanceUSD: 10000  // This should work if types are correct
      }
    });
    console.log('  ✓ balanceUSD field exists');
    console.log('  ✓ Wallet creation successful');
    
    // Test Wallet with creditCards relation
    console.log('\n✅ Testing Wallet with creditCards...');
    const walletWithCards = await prisma.wallet.findUnique({
      where: { id: wallet.id },
      include: { 
        creditCards: true  // This should work if types are correct
      }
    });
    console.log('  ✓ creditCards relation exists');
    
    // Test Payment types
    console.log('\n✅ Testing Payment model...');
    const payment = await prisma.payment.create({
      data: {
        walletId: wallet.id,
        amountSat: 100,
        amountUSD: 1000,  // This should work if types are correct
        type: 'platform_fee',  // This should work if types are correct
        status: 'completed',
        invoice: 'test_invoice'
      }
    });
    console.log('  ✓ amountUSD field exists');
    console.log('  ✓ type field exists');
    console.log('  ✓ Payment creation successful');
    
    // Test CreditCard model
    console.log('\n✅ Testing CreditCard model...');
    const creditCard = await prisma.creditCard.create({
      data: {
        walletId: wallet.id,
        last4: '1234',
        brand: 'visa',
        stripeId: 'pm_test_123'  // This should work if types are correct
      }
    });
    console.log('  ✓ CreditCard model exists');
    console.log('  ✓ stripeId field exists');
    
    console.log('\n🎉 ALL PRISMA TYPES WORKING CORRECTLY!');
    
    // Cleanup
    await prisma.payment.delete({ where: { id: payment.id } });
    await prisma.creditCard.delete({ where: { id: creditCard.id } });
    await prisma.wallet.delete({ where: { id: wallet.id } });
    
    console.log('✅ Test cleanup completed');
    
  } catch (error) {
    console.error('❌ Type test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testPrismaTypes(); 