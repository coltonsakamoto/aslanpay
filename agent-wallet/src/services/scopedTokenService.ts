import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';

interface ScopedSpendClaims {
  iss: string;        // Issuer - always "agentpay.com"
  aud: string;        // Audience - specific merchant or "any"
  sub: string;        // Subject - agent ID
  iat: number;        // Issued at
  exp: number;        // Expires at
  jti: string;        // JWT ID - unique token identifier
  scope: {
    maxAmount: number;    // Maximum spend amount in cents
    category: string;     // Spending category
    merchant: string;     // Allowed merchant
    intent: string;       // Purchase intent
  };
  agentToken: string;     // Original agent token hash
  fingerprint: string;   // Request fingerprint for replay protection
}

export class ScopedTokenService {
  private static readonly ISSUER = 'agentpay.com';
  private static readonly JWT_SECRET = process.env.JWT_SECRET!;
  
  /**
   * Create a scoped spending token for specific authorization
   */
  static async createScopedToken(
    agentId: string,
    agentToken: string,
    merchant: string,
    maxAmount: number,
    category: string = 'general',
    intent: string,
    durationMinutes: number = 10
  ): Promise<{ token: string; jti: string }> {
    
    // Generate unique JWT ID
    const jti = `jti_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    // Create request fingerprint
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${agentToken}-${merchant}-${maxAmount}-${Date.now()}`)
      .digest('hex');
    
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + (durationMinutes * 60);
    
    const claims: ScopedSpendClaims = {
      iss: this.ISSUER,
      aud: merchant,
      sub: agentId,
      iat: now,
      exp: expiry,
      jti,
      scope: {
        maxAmount: Math.round(maxAmount * 100), // Convert to cents
        category,
        merchant,
        intent
      },
      agentToken: crypto.createHash('sha256').update(agentToken).digest('hex'),
      fingerprint
    };
    
    // Sign with algorithm specification
    const token = jwt.sign(claims, this.JWT_SECRET, {
      algorithm: 'HS256',
      header: {
        typ: 'JWT',
        alg: 'HS256',
        kid: 'agentpay-control-tower-v1'
      }
    });
    
    // Store JTI for revocation checking
    await prisma.payment.create({
      data: {
        walletId: 'scoped-token-log', // Special wallet for token tracking
        agentId,
        invoice: jti,
        amountSat: 0,
        amountUSD: 0,
        type: 'scoped_token',
        status: 'authorized',
        stripeId: token.substring(0, 50), // Store partial token for reference
        cardLast4: 'SCOPED'
      }
    });
    
    console.log(`🔐 SCOPED TOKEN: Created ${jti} for ${merchant} - $${maxAmount}`);
    
    return { token, jti };
  }
  
  /**
   * Validate and decode scoped spending token
   */
  static async validateScopedToken(token: string, requestMerchant?: string): Promise<{
    valid: boolean;
    claims?: ScopedSpendClaims;
    reason?: string;
  }> {
    try {
      // Decode and verify token
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: this.ISSUER,
        clockTolerance: 30 // 30 second clock tolerance
      }) as ScopedSpendClaims;
      
      // Validate issuer
      if (decoded.iss !== this.ISSUER) {
        return {
          valid: false,
          reason: 'Invalid issuer'
        };
      }
      
      // Check if token is revoked
      const revokedToken = await prisma.payment.findFirst({
        where: {
          invoice: decoded.jti,
          type: 'scoped_token',
          status: 'revoked'
        }
      });
      
      if (revokedToken) {
        return {
          valid: false,
          reason: 'Token revoked'
        };
      }
      
      // Validate audience (merchant)
      if (requestMerchant && decoded.aud !== 'any' && decoded.aud !== requestMerchant) {
        return {
          valid: false,
          reason: `Token audience mismatch: expected ${requestMerchant}, got ${decoded.aud}`
        };
      }
      
      // Check expiration (JWT library already validates, but double-check)
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        return {
          valid: false,
          reason: 'Token expired'
        };
      }
      
      console.log(`✅ SCOPED TOKEN VALID: ${decoded.jti} for ${decoded.aud}`);
      
      return {
        valid: true,
        claims: decoded
      };
      
    } catch (error: any) {
      console.error('Scoped token validation error:', error.message);
      
      if (error.name === 'TokenExpiredError') {
        return {
          valid: false,
          reason: 'Token expired'
        };
      }
      
      if (error.name === 'JsonWebTokenError') {
        return {
          valid: false,
          reason: 'Invalid token format'
        };
      }
      
      return {
        valid: false,
        reason: 'Token validation failed'
      };
    }
  }
  
  /**
   * Revoke a scoped token by JTI
   */
  static async revokeScopedToken(jti: string): Promise<boolean> {
    try {
      const updated = await prisma.payment.updateMany({
        where: {
          invoice: jti,
          type: 'scoped_token'
        },
        data: {
          status: 'revoked'
        }
      });
      
      console.log(`🚫 SCOPED TOKEN REVOKED: ${jti}`);
      return updated.count > 0;
      
    } catch (error) {
      console.error('Token revocation error:', error);
      return false;
    }
  }
  
  /**
   * Create merchant validation token (short-lived for merchant API)
   */
  static createMerchantToken(authorizationId: string, merchantId: string): string {
    const now = Math.floor(Date.now() / 1000);
    
    const claims = {
      iss: this.ISSUER,
      aud: merchantId,
      sub: 'merchant-validation',
      iat: now,
      exp: now + (5 * 60), // 5 minutes only
      jti: `merchant_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      authorizationId,
      merchantId,
      purpose: 'authorization-validation'
    };
    
    return jwt.sign(claims, this.JWT_SECRET, {
      algorithm: 'HS256'
    });
  }
  
  /**
   * Validate merchant token
   */
  static validateMerchantToken(token: string): {
    valid: boolean;
    authorizationId?: string;
    merchantId?: string;
    reason?: string;
  } {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: this.ISSUER
      }) as any;
      
      if (decoded.purpose !== 'authorization-validation') {
        return {
          valid: false,
          reason: 'Invalid token purpose'
        };
      }
      
      return {
        valid: true,
        authorizationId: decoded.authorizationId,
        merchantId: decoded.merchantId
      };
      
    } catch (error) {
      return {
        valid: false,
        reason: 'Invalid merchant token'
      };
    }
  }
  
  /**
   * Cleanup expired token records
   */
  static async cleanupExpiredTokens() {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
      
      const deleted = await prisma.payment.deleteMany({
        where: {
          type: 'scoped_token',
          createdAt: { lt: cutoff }
        }
      });
      
      console.log(`🧹 Cleaned up ${deleted.count} expired scoped tokens`);
    } catch (error) {
      console.error('Token cleanup error:', error);
    }
  }
}

// Cleanup expired tokens every hour
setInterval(() => {
  ScopedTokenService.cleanupExpiredTokens();
}, 60 * 60 * 1000); 