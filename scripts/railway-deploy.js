#!/usr/bin/env node

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

console.log('🚀 Starting Railway deployment for Aslan...');

// Change to project root
process.chdir(path.join(__dirname, '..'));

async function testDatabaseConnection() {
    console.log('🔍 Testing database connection first...');
    
    const prisma = new PrismaClient({
        log: ['error'],
    });
    
    try {
        await prisma.$connect();
        console.log('✅ Database connection successful!');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    } finally {
        await prisma.$disconnect();
    }
}

async function waitForDatabase(maxRetries = 5) {
    console.log('⏳ Waiting for database to be ready...');
    
    for (let i = 1; i <= maxRetries; i++) {
        console.log(`🔄 Connection attempt ${i}/${maxRetries}`);
        
        if (await testDatabaseConnection()) {
            return true;
        }
        
        if (i < maxRetries) {
            console.log('⏱️  Waiting 10 seconds before retry...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
    
    return false;
}

async function main() {
    try {
        // Check environment
        const isProduction = process.env.NODE_ENV === 'production';
        
        if (isProduction) {
            console.log('📦 Production environment detected');
            
            // Validate DATABASE_URL
            if (!process.env.DATABASE_URL) {
                console.error('❌ ERROR: DATABASE_URL environment variable not set');
                console.error('💡 Go to Railway → Your App Service → Variables → Add DATABASE_URL');
                process.exit(1);
            }
            
            if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
                console.error('❌ ERROR: DATABASE_URL must be a PostgreSQL connection string');
                console.error('Current URL format:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));
                process.exit(1);
            }
            
            // Wait for database to be ready
            if (!(await waitForDatabase())) {
                console.error('❌ ERROR: Could not connect to database after multiple attempts');
                console.error('💡 Check that:');
                console.error('   1. PostgreSQL service is running in Railway');
                console.error('   2. DATABASE_URL is correct (copy from PostgreSQL service variables)');
                console.error('   3. Both services are in the same Railway project');
                process.exit(1);
            }
            
            console.log('🔄 Generating Prisma client...');
            execSync('npx prisma generate', { stdio: 'inherit' });
            
            console.log('🔄 Running database migrations...');
            execSync('npx prisma migrate deploy', { stdio: 'inherit' });
            
            console.log('✅ Database setup complete');
        } else {
            console.log('🧪 Development environment detected - skipping PostgreSQL migrations');
            execSync('npx prisma generate', { stdio: 'inherit' });
        }
        
        console.log('🦁 Starting Aslan server...');
        execSync('npm start', { stdio: 'inherit' });
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

main().catch(console.error); 