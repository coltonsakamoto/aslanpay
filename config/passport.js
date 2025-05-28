const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const database = require('./database');

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = database.getUserById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Google OAuth Strategy (only if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const name = profile.displayName;
            
            // Check if user exists
            let user = database.getUserByEmail(email);
            
            if (user) {
                // User exists, update OAuth info if needed
                if (user.provider !== 'google') {
                    user = await database.updateUser(user.id, {
                        provider: 'google',
                        googleId: profile.id
                    });
                }
            } else {
                // Create new user
                user = await database.createUser({
                    email,
                    name,
                    provider: 'google',
                    googleId: profile.id
                });
            }
            
            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    }));
    console.log('✅ Google OAuth strategy configured');
} else {
    console.log('⚠️  Google OAuth disabled - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

// GitHub OAuth Strategy (only if credentials are provided)
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: "/api/auth/github/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            const name = profile.displayName || profile.username;
            
            if (!email) {
                return done(new Error('No email found in GitHub profile'), null);
            }
            
            // Check if user exists
            let user = database.getUserByEmail(email);
            
            if (user) {
                // User exists, update OAuth info if needed
                if (user.provider !== 'github') {
                    user = await database.updateUser(user.id, {
                        provider: 'github',
                        githubId: profile.id
                    });
                }
            } else {
                // Create new user
                user = await database.createUser({
                    email,
                    name,
                    provider: 'github',
                    githubId: profile.id
                });
            }
            
            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    }));
    console.log('✅ GitHub OAuth strategy configured');
} else {
    console.log('⚠️  GitHub OAuth disabled - missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET');
}

module.exports = passport; 