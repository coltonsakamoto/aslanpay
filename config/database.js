// Database configuration switcher
// Uses in-memory database for development, PostgreSQL for production

const isDevelopment = process.env.NODE_ENV !== 'production';
const hasPostgreSQLUrl = process.env.DATABASE_URL && (
    process.env.DATABASE_URL.startsWith('postgresql://') || 
    process.env.DATABASE_URL.startsWith('postgres://')
);

console.log('🔍 Database environment detection:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   isDevelopment: ${isDevelopment}`);
console.log(`   DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
console.log(`   hasPostgreSQLUrl: ${hasPostgreSQLUrl}`);

// Force PostgreSQL if we have a PostgreSQL URL (Railway fix)
const usePostgreSQL = !isDevelopment || hasPostgreSQLUrl;

// Choose database based on environment and URL presence
const database = usePostgreSQL
    ? require('../database-production') // PostgreSQL database
    : require('../database');           // In-memory database

console.log(`🔗 Using ${usePostgreSQL ? 'PostgreSQL' : 'in-memory'} database`);

// Export unified interface
module.exports = database; 