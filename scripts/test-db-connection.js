#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
    console.log('🔍 Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set ✅' : 'Missing ❌');
    
    if (process.env.DATABASE_URL) {
        // Mask sensitive parts for logging
        const urlParts = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@');
        console.log('URL format:', urlParts);
    }
    
    const prisma = new PrismaClient({
        log: ['error', 'warn'],
    });
    
    try {
        console.log('🔄 Attempting database connection...');
        await prisma.$connect();
        console.log('✅ Database connection successful!');
        
        console.log('🔄 Testing simple query...');
        await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Query test successful!');
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('Error code:', error.code);
        
        if (error.message.includes('ENOTFOUND') || error.message.includes("Can't reach")) {
            console.error('🔧 This appears to be a network connectivity issue.');
            console.error('💡 Solutions:');
            console.error('   1. Verify PostgreSQL service is running in Railway');
            console.error('   2. Check DATABASE_URL is from Railway PostgreSQL service');
            console.error('   3. Ensure services are in the same Railway project');
        }
        
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

testDatabaseConnection().catch(console.error); 