// Database configuration switcher
// Uses in-memory database for development, PostgreSQL for production

const isDevelopment = process.env.NODE_ENV !== 'production';

console.log('🔍 Database environment detection:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   isDevelopment: ${isDevelopment}`);
console.log(`   DATABASE_URL set: ${!!process.env.DATABASE_URL}`);

// Choose database based on environment
const database = isDevelopment 
    ? require('../database')           // In-memory database for development
    : require('../database-production'); // PostgreSQL database for production

console.log(`🔗 Using ${isDevelopment ? 'development' : 'production'} database`);

// Export unified interface
module.exports = database; 