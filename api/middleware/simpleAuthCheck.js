const jwt = require('jsonwebtoken');
const database = require('../../config/database');
const { JWT_SECRET } = require('../../middleware/auth');

module.exports = async (req, res, next) => {
  console.log('🔍 API Key Auth - checking authentication');
  
  try {
    // Method 1: Check for session cookie (preferred for dashboard)
    const sessionToken = req.cookies?.agentpay_session;
    
    if (sessionToken) {
      console.log('🔍 Found session cookie, validating...');
      try {
        // Decode JWT
        const decoded = jwt.verify(sessionToken, JWT_SECRET);
        console.log('🔍 JWT decoded, sessionId:', decoded.sessionId);
        
        // Get session from database
        const session = await database.getSession(decoded.sessionId);
        if (session) {
          console.log('🔍 Session found, userId:', session.userId);
          
          // Get user data
          const user = await database.getUserById(session.userId);
          if (user) {
            console.log('✅ Cookie auth successful for:', user.email);
            req.user = user;
            req.userId = user.id;
            return next();
          }
        }
      } catch (err) {
        console.log('❌ Session cookie validation failed:', err.message);
      }
    }

    // Method 2: Check for Bearer token (for API clients/agents)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      console.log('🔍 Found Bearer token, validating...');
      const token = authHeader.slice(7).trim();
      
      if (token.length > 10) {
        // For now, create a mock user based on token for API clients
        // In production, you'd validate this against a token database
        const userId = 'api_user_' + Buffer.from(token.substring(0, 10)).toString('base64').substring(0, 8);
        
        req.user = {
          id: userId,
          email: `${userId}@api.agentpay.com`,
          name: 'API User',
          emailVerified: true
        };
        req.userId = userId;
        console.log('✅ Bearer token auth successful for:', userId);
        return next();
      }
    }

    // No valid authentication found
    console.log('❌ No valid authentication found');
    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
    
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
}; 