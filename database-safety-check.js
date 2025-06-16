#!/usr/bin/env node

const DatabaseBackupManager = require('./database-backup.js');
const fs = require('fs');

async function runSafetyCheck() {
    console.log('🛡️  DATABASE SAFETY CHECK');
    console.log('========================');
    
    const backupManager = new DatabaseBackupManager();
    
    try {
        // Step 1: Validate database integrity
        console.log('\n1️⃣ Checking database integrity...');
        const integrity = await backupManager.validateDatabaseIntegrity();
        
        if (integrity.valid) {
            console.log('✅ Database integrity: OK');
            console.log(`📊 Users: ${integrity.userCount}, API Keys: ${integrity.apiKeyCount}`);
        } else {
            console.log('❌ Database integrity: FAILED');
            console.log('Error:', integrity.error);
            return false;
        }
        
        // Step 2: Create safety backup
        console.log('\n2️⃣ Creating safety backup...');
        const backupPath = await backupManager.createBackup('safety-check');
        if (backupPath) {
            console.log('✅ Safety backup created successfully');
        }
        
        // Step 3: Export user data
        console.log('\n3️⃣ Exporting user data...');
        const userData = await backupManager.exportUserData();
        console.log(`✅ Exported ${userData.users_count} users and ${userData.api_keys_count} API keys`);
        
        // Step 4: List available backups
        console.log('\n4️⃣ Available backups:');
        const backups = backupManager.listBackups();
        if (backups.length === 0) {
            console.log('⚠️  No backups found');
        } else {
            backups.slice(0, 5).forEach((backup, index) => {
                const sizeKB = (backup.size / 1024).toFixed(1);
                const age = Math.round((Date.now() - backup.created) / (1000 * 60));
                console.log(`   ${index + 1}. ${backup.filename} (${sizeKB}KB, ${age}m ago)`);
            });
            if (backups.length > 5) {
                console.log(`   ... and ${backups.length - 5} more backups`);
            }
        }
        
        // Step 5: Safety recommendations
        console.log('\n5️⃣ Safety recommendations:');
        
        if (integrity.userCount > 0) {
            console.log('✅ USER DATA DETECTED - Use extra caution with schema changes');
            console.log('💡 Always create backup before: npx prisma migrate');
            console.log('❌ NEVER use: npx prisma db push --force-reset');
        }
        
        if (backups.length < 3) {
            console.log('⚠️  Consider creating more frequent backups');
        }
        
        const dbFile = 'prisma/dev.db';
        if (fs.existsSync(dbFile)) {
            const stats = fs.statSync(dbFile);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`📊 Database file size: ${sizeMB}MB`);
        }
        
        console.log('\n🎯 SAFETY STATUS: ALL CHECKS PASSED');
        console.log('✅ Database is protected and backed up');
        
        return true;
        
    } catch (error) {
        console.error('\n❌ SAFETY CHECK FAILED:', error.message);
        console.log('\n🚨 DO NOT PROCEED WITH DATABASE OPERATIONS');
        console.log('🔧 Fix the issues above before continuing');
        return false;
    }
}

// Emergency restore function
async function emergencyRestore() {
    console.log('🚨 EMERGENCY RESTORE PROCEDURE');
    console.log('=============================');
    
    const backupManager = new DatabaseBackupManager();
    const backups = backupManager.listBackups();
    
    if (backups.length === 0) {
        console.log('❌ No backups available for restore');
        return false;
    }
    
    console.log('Available backups:');
    backups.forEach((backup, index) => {
        const sizeKB = (backup.size / 1024).toFixed(1);
        const age = Math.round((Date.now() - backup.created) / (1000 * 60));
        console.log(`${index + 1}. ${backup.filename} (${sizeKB}KB, ${age}m ago)`);
    });
    
    // For CLI usage, restore the most recent backup
    const latestBackup = backups[0];
    console.log(`\n🔄 Restoring from: ${latestBackup.filename}`);
    
    try {
        await backupManager.restoreFromBackup(latestBackup.filename);
        console.log('✅ Emergency restore completed');
        
        // Verify restoration
        const integrity = await backupManager.validateDatabaseIntegrity();
        console.log(`📊 Restored database: ${integrity.userCount} users, ${integrity.apiKeyCount} API keys`);
        
        return true;
    } catch (error) {
        console.error('❌ Emergency restore failed:', error.message);
        return false;
    }
}

// CLI interface
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'check':
        case undefined:
            runSafetyCheck().then(success => {
                process.exit(success ? 0 : 1);
            });
            break;
            
        case 'emergency-restore':
            emergencyRestore().then(success => {
                process.exit(success ? 0 : 1);
            });
            break;
            
        case 'help':
            console.log('Database Safety Check Tool');
            console.log('==========================');
            console.log('');
            console.log('Commands:');
            console.log('  node database-safety-check.js check          - Run safety check (default)');
            console.log('  node database-safety-check.js emergency-restore - Restore from latest backup');
            console.log('  node database-safety-check.js help              - Show this help');
            console.log('');
            console.log('🛡️  Always run safety check before database operations!');
            break;
            
        default:
            console.log('Unknown command. Use "help" for available commands.');
            process.exit(1);
    }
}

module.exports = { runSafetyCheck, emergencyRestore }; 