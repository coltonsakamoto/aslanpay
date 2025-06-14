#!/usr/bin/env node

/**
 * 🔧 AslanPay Database Diagnostics
 * 
 * This script diagnoses and fixes common database issues:
 * 1. Checks database files and paths
 * 2. Validates Prisma client connection
 * 3. Tests database schema
 * 4. Creates test users and API keys
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

class DatabaseDiagnostics {
    constructor() {
        // Set default DATABASE_URL if not provided
        if (!process.env.DATABASE_URL) {
            process.env.DATABASE_URL = "file:./prisma/dev.db";
            console.log('🔧 Setting default DATABASE_URL to: file:./prisma/dev.db');
        }
    }

    async runDiagnostics() {
        console.log('🔍 AslanPay Database Diagnostics');
        console.log('=' .repeat(50));
        
        try {
            await this.checkFileSystem();
            await this.testPrismaConnection();
            await this.validateSchema();
            await this.testDatabaseOperations();
            
            console.log('\n✅ Database diagnostics completed successfully!');
            console.log('🎉 Your database is ready for authentication service.');
            
        } catch (error) {
            console.error('\n❌ Diagnostics failed:', error.message);
            console.error('🔧 Error details:', error);
            
            await this.suggestFixes(error);
            process.exit(1);
        }
    }

    async checkFileSystem() {
        console.log('\n1️⃣ Checking File System...');
        
        // Check for database files
        const dbPaths = [
            './dev.db',
            './prisma/dev.db',
            'dev.db'
        ];
        
        console.log('📂 Looking for database files:');
        for (const dbPath of dbPaths) {
            const exists = fs.existsSync(dbPath);
            console.log(`   ${exists ? '✅' : '❌'} ${dbPath}: ${exists ? 'Found' : 'Not found'}`);
            
            if (exists) {
                const stats = fs.statSync(dbPath);
                console.log(`      Size: ${Math.round(stats.size / 1024)}KB, Modified: ${stats.mtime.toISOString()}`);
            }
        }
        
        // Check schema file
        const schemaPath = './prisma/schema.prisma';
        const schemaExists = fs.existsSync(schemaPath);
        console.log(`\n📋 Schema file: ${schemaExists ? '✅ Found' : '❌ Missing'}`);
        
        if (schemaExists) {
            const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
            const models = schemaContent.match(/model \w+/g) || [];
            console.log(`   Models defined: ${models.join(', ')}`);
        }
        
        // Check package.json for dependencies
        const packagePath = './package.json';
        if (fs.existsSync(packagePath)) {
            const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
            const hasPrisma = packageContent.dependencies?.['@prisma/client'] || packageContent.devDependencies?.prisma;
            console.log(`\n📦 Prisma dependencies: ${hasPrisma ? '✅ Installed' : '❌ Missing'}`);
        }
    }

    async testPrismaConnection() {
        console.log('\n2️⃣ Testing Prisma Connection...');
        
        console.log('🔗 DATABASE_URL:', process.env.DATABASE_URL);
        
        try {
            // Try to import and test the database module
            const database = require('./database-production.js');
            
            console.log('   ✅ Database module loaded successfully');
            
            // Test health check
            const health = await database.healthCheck();
            console.log('   ✅ Database health check passed');
            console.log('   📊 Health status:', health);
            
        } catch (error) {
            console.error('   ❌ Prisma connection failed:', error.message);
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    async validateSchema() {
        console.log('\n3️⃣ Validating Database Schema...');
        
        try {
            const database = require('./database-production.js');
            
            // Test basic queries to validate schema
            console.log('   🔍 Testing User table...');
            // This will fail if schema is not migrated
            await database.prisma.user.findMany({ take: 1 });
            console.log('   ✅ User table accessible');
            
            console.log('   🔍 Testing ApiKey table...');
            await database.prisma.apiKey.findMany({ take: 1 });
            console.log('   ✅ ApiKey table accessible');
            
            console.log('   🔍 Testing Session table...');
            await database.prisma.session.findMany({ take: 1 });
            console.log('   ✅ Session table accessible');
            
        } catch (error) {
            if (error.message.includes('no such table') || error.code === 'P2021') {
                throw new Error('Database schema not migrated. Run: npx prisma migrate dev');
            }
            throw new Error(`Schema validation failed: ${error.message}`);
        }
    }

    async testDatabaseOperations() {
        console.log('\n4️⃣ Testing Database Operations...');
        
        try {
            const database = require('./database-production.js');
            
            // Test user creation
            console.log('   👤 Testing user creation...');
            const testEmail = `test-${Date.now()}@aslanpay.xyz`;
            
            try {
                const user = await database.createUser({
                    email: testEmail,
                    password: 'TestPassword123!',
                    name: 'Test User',
                    provider: 'email'
                });
                console.log('   ✅ User creation successful:', user.email);
                
                // Test API key creation
                console.log('   🔑 Testing API key creation...');
                const apiKeys = await database.getApiKeysByUserId(user.id);
                
                if (apiKeys.length > 0) {
                    console.log('   ✅ API key creation successful:', apiKeys[0].key.substring(0, 20) + '...');
                    
                    // Test API key validation
                    console.log('   🔍 Testing API key validation...');
                    const keyValidation = await database.validateApiKey(apiKeys[0].key);
                    
                    if (keyValidation) {
                        console.log('   ✅ API key validation successful');
                    } else {
                        throw new Error('API key validation returned null');
                    }
                } else {
                    throw new Error('No API keys found for user');
                }
                
                // Clean up test user
                console.log('   🧹 Cleaning up test data...');
                await database.prisma.apiKey.deleteMany({ where: { userId: user.id } });
                await database.prisma.user.delete({ where: { id: user.id } });
                console.log('   ✅ Test data cleaned up');
                
            } catch (userError) {
                if (userError.message.includes('User already exists')) {
                    console.log('   ⚠️  User already exists (this is normal)');
                } else {
                    throw userError;
                }
            }
            
        } catch (error) {
            throw new Error(`Database operations test failed: ${error.message}`);
        }
    }

    async suggestFixes(error) {
        console.log('\n🔧 SUGGESTED FIXES:');
        
        if (error.message.includes('no such table') || error.message.includes('migrate')) {
            console.log('1. Run database migrations:');
            console.log('   npm run db:migrate  # or');
            console.log('   npx prisma migrate dev');
            console.log('   npx prisma generate');
        }
        
        if (error.message.includes('DATABASE_URL')) {
            console.log('2. Set DATABASE_URL environment variable:');
            console.log('   export DATABASE_URL="file:./prisma/dev.db"');
        }
        
        if (error.message.includes('Prisma')) {
            console.log('3. Install Prisma dependencies:');
            console.log('   npm install @prisma/client prisma');
        }
        
        if (error.message.includes('ENOENT') || error.message.includes('file')) {
            console.log('4. Create database file:');
            console.log('   touch prisma/dev.db');
            console.log('   npx prisma migrate dev');
        }
        
        console.log('\n5. After fixes, test with:');
        console.log('   node diagnose-database.js');
        console.log('   node test-auth-service.js');
    }
}

// Run diagnostics if called directly
if (require.main === module) {
    const diagnostics = new DatabaseDiagnostics();
    diagnostics.runDiagnostics().catch(error => {
        console.error('❌ Diagnostics execution failed:', error.message);
        process.exit(1);
    });
}

module.exports = DatabaseDiagnostics; 