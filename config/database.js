// Database configuration switcher
// Uses in-memory database for development, PostgreSQL for production

const isDevelopment = process.env.NODE_ENV !== 'production';

// Choose database based on environment
const database = isDevelopment 
    ? require('../database')           // In-memory database for development
    : require('../database-production'); // PostgreSQL database for production

// Export unified interface
module.exports = database; 