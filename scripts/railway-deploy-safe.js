#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Railway deployment for Aslan (Safe Mode)...');

// Change to project root
process.chdir(path.join(__dirname, '..'));

async function tryDatabaseSetup() {
    try {
        const isProduction = process.env.NODE_ENV === 'production';
        
        if (!isProduction) {
            console.log('🧪 Development environment - skipping database setup');
            execSync('npx prisma generate', { stdio: 'inherit' });
            return true;
        }
        
        console.log('📦 Production environment detected');
        
        // Always generate Prisma client first
        console.log('🔄 Generating Prisma client...');
        execSync('npx prisma generate', { stdio: 'inherit' });
        
        // Check if DATABASE_URL is set
        if (!process.env.DATABASE_URL) {
            console.warn('⚠️  DATABASE_URL not set - starting server anyway (database features will be disabled)');
            return false;
        }
        
        console.log('🔄 Attempting database migrations...');
        execSync('npx prisma migrate deploy', { stdio: 'inherit', timeout: 30000 });
        console.log('✅ Database setup complete');
        return true;
        
    } catch (error) {
        console.error('⚠️  Database setup failed, but continuing to start server:', error.message);
        console.error('💡 App will start with limited functionality');
        return false;
    }
}

async function startServer() {
    console.log('🦁 Starting Aslan server...');
    
    // Start the server with proper signal handling
    const server = spawn('node', ['server.js'], {
        stdio: 'inherit',
        env: { ...process.env }
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        console.log('📤 Received SIGTERM, shutting down gracefully');
        server.kill('SIGTERM');
    });
    
    process.on('SIGINT', () => {
        console.log('📤 Received SIGINT, shutting down gracefully');
        server.kill('SIGINT');
    });
    
    server.on('exit', (code) => {
        console.log(`🔚 Server exited with code ${code}`);
        process.exit(code);
    });
    
    server.on('error', (error) => {
        console.error('❌ Server error:', error);
        process.exit(1);
    });
}

async function main() {
    try {
        // Try database setup but don't fail if it doesn't work
        await tryDatabaseSetup();
        
        // Always start the server
        await startServer();
        
    } catch (error) {
        console.error('❌ Critical deployment failure:', error.message);
        process.exit(1);
    }
}

main().catch(console.error); 