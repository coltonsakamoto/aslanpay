#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Railway deployment for Aslan...');

// Change to project root
process.chdir(path.join(__dirname, '..'));

try {
    // Check environment
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
        console.log('📦 Production environment detected');
        
        // Validate DATABASE_URL
        if (!process.env.DATABASE_URL) {
            console.error('❌ ERROR: DATABASE_URL environment variable not set');
            process.exit(1);
        }
        
        if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
            console.error('❌ ERROR: DATABASE_URL must be a PostgreSQL connection string');
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