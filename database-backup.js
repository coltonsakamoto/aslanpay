#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class DatabaseBackupManager {
    constructor() {
        this.backupDir = path.join(__dirname, 'database-backups');
        this.ensureBackupDirectory();
    }

    ensureBackupDirectory() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            console.log('📁 Created backup directory:', this.backupDir);
        }
    }

    /**
     * Create a timestamped backup of the current database
     */
    async createBackup(reason = 'manual') {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFilename = `backup-${timestamp}-${reason}.db`;
            const backupPath = path.join(this.backupDir, backupFilename);
            const sourceDb = 'prisma/dev.db';

            if (!fs.existsSync(sourceDb)) {
                console.log('⚠️  No database file to backup');
                return null;
            }

            // Copy the database file
            fs.copyFileSync(sourceDb, backupPath);
            
            // Also export as SQL for human readability
            const sqlBackupPath = backupPath.replace('.db', '.sql');
            try {
                await execAsync(`sqlite3 "${sourceDb}" .dump > "${sqlBackupPath}"`);
                console.log('💾 SQL backup created:', sqlBackupPath);
            } catch (sqlError) {
                console.warn('⚠️  SQL export failed, but binary backup succeeded');
            }

            console.log(`✅ Database backup created: ${backupFilename}`);
            console.log(`📍 Location: ${backupPath}`);
            
            // Keep only last 10 backups to save space
            await this.cleanupOldBackups();
            
            return backupPath;
        } catch (error) {
            console.error('❌ Backup creation failed:', error.message);
            throw error;
        }
    }

    /**
     * List all available backups
     */
    listBackups() {
        const backups = fs.readdirSync(this.backupDir)
            .filter(file => file.endsWith('.db'))
            .map(file => {
                const stats = fs.statSync(path.join(this.backupDir, file));
                return {
                    filename: file,
                    path: path.join(this.backupDir, file),
                    size: stats.size,
                    created: stats.mtime
                };
            })
            .sort((a, b) => b.created - a.created);

        return backups;
    }

    /**
     * Restore from a backup
     */
    async restoreFromBackup(backupFilename) {
        try {
            const backupPath = path.join(this.backupDir, backupFilename);
            const targetDb = 'prisma/dev.db';

            if (!fs.existsSync(backupPath)) {
                throw new Error(`Backup file not found: ${backupFilename}`);
            }

            // Create a backup of current state before restore
            await this.createBackup('pre-restore');

            // Copy backup to current database location
            fs.copyFileSync(backupPath, targetDb);
            
            console.log(`✅ Database restored from: ${backupFilename}`);
            return true;
        } catch (error) {
            console.error('❌ Restore failed:', error.message);
            throw error;
        }
    }

    /**
     * Export user data for migration safety
     */
    async exportUserData() {
        try {
            const sourceDb = 'prisma/dev.db';
            if (!fs.existsSync(sourceDb)) {
                return { users: [], apiKeys: [] };
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const exportPath = path.join(this.backupDir, `user-export-${timestamp}.json`);

            // Export users and API keys as JSON
            const { stdout: usersData } = await execAsync(`sqlite3 "${sourceDb}" "SELECT * FROM users;" | head -100`);
            const { stdout: apiKeysData } = await execAsync(`sqlite3 "${sourceDb}" "SELECT * FROM api_keys;" | head -500`);

            const exportData = {
                timestamp: new Date().toISOString(),
                exported_at: timestamp,
                users_count: usersData.split('\n').filter(line => line.trim()).length,
                api_keys_count: apiKeysData.split('\n').filter(line => line.trim()).length,
                users_raw: usersData,
                api_keys_raw: apiKeysData
            };

            fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
            console.log(`💾 User data exported: ${exportPath}`);
            return exportData;
        } catch (error) {
            console.error('❌ User data export failed:', error.message);
            return { users: [], apiKeys: [], error: error.message };
        }
    }

    /**
     * Validate database integrity before operations
     */
    async validateDatabaseIntegrity() {
        try {
            const sourceDb = 'prisma/dev.db';
            if (!fs.existsSync(sourceDb)) {
                return { valid: true, reason: 'No database file exists' };
            }

            // Check if database is corrupt
            const { stdout } = await execAsync(`sqlite3 "${sourceDb}" "PRAGMA integrity_check;"`);
            const isValid = stdout.trim() === 'ok';
            
            // Count critical data
            const { stdout: userCount } = await execAsync(`sqlite3 "${sourceDb}" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0"`);
            const { stdout: keyCount } = await execAsync(`sqlite3 "${sourceDb}" "SELECT COUNT(*) FROM api_keys;" 2>/dev/null || echo "0"`);

            return {
                valid: isValid,
                userCount: parseInt(userCount.trim()) || 0,
                apiKeyCount: parseInt(keyCount.trim()) || 0,
                integrity: stdout.trim()
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Safe database migration with backup
     */
    async safeMigration(migrationFunction, migrationName = 'unknown') {
        console.log(`🔄 Starting safe migration: ${migrationName}`);
        
        try {
            // Step 1: Validate current database
            const integrity = await this.validateDatabaseIntegrity();
            console.log('🔍 Pre-migration state:', integrity);

            // Step 2: Create backup before migration
            const backupPath = await this.createBackup(`pre-${migrationName}`);
            
            // Step 3: Export user data for extra safety
            const userData = await this.exportUserData();
            console.log(`💾 Exported ${userData.users_count} users, ${userData.api_keys_count} API keys`);

            // Step 4: Run the migration
            console.log('🚀 Executing migration...');
            await migrationFunction();

            // Step 5: Validate post-migration
            const postIntegrity = await this.validateDatabaseIntegrity();
            console.log('✅ Post-migration state:', postIntegrity);

            // Step 6: Check for data loss
            if (integrity.userCount > 0 && postIntegrity.userCount === 0) {
                console.error('🚨 CRITICAL: USER DATA LOSS DETECTED!');
                console.log('🔄 Attempting automatic rollback...');
                await this.restoreFromBackup(path.basename(backupPath));
                throw new Error('Migration rolled back due to user data loss');
            }

            console.log(`✅ Safe migration completed: ${migrationName}`);
            return true;
        } catch (error) {
            console.error(`❌ Migration failed: ${migrationName}`, error.message);
            throw error;
        }
    }

    /**
     * Clean up old backups (keep last 10)
     */
    async cleanupOldBackups() {
        try {
            const backups = this.listBackups();
            if (backups.length > 10) {
                const toDelete = backups.slice(10);
                for (const backup of toDelete) {
                    fs.unlinkSync(backup.path);
                    // Also delete corresponding SQL file if exists
                    const sqlFile = backup.path.replace('.db', '.sql');
                    if (fs.existsSync(sqlFile)) {
                        fs.unlinkSync(sqlFile);
                    }
                }
                console.log(`🧹 Cleaned up ${toDelete.length} old backups`);
            }
        } catch (error) {
            console.warn('⚠️  Backup cleanup failed:', error.message);
        }
    }
}

module.exports = DatabaseBackupManager;

// CLI usage
if (require.main === module) {
    const manager = new DatabaseBackupManager();
    
    const command = process.argv[2];
    switch (command) {
        case 'backup':
            manager.createBackup('manual-cli').catch(console.error);
            break;
        case 'list':
            console.log('Available backups:');
            manager.listBackups().forEach(backup => {
                console.log(`  ${backup.filename} (${(backup.size/1024).toFixed(1)}KB, ${backup.created})`);
            });
            break;
        case 'export':
            manager.exportUserData().catch(console.error);
            break;
        case 'validate':
            manager.validateDatabaseIntegrity().then(result => {
                console.log('Database integrity:', result);
            }).catch(console.error);
            break;
        default:
            console.log('Usage: node database-backup.js [backup|list|export|validate]');
    }
} 