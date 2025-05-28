# 🦁 Aslan

**Payment infrastructure for AI agents** - Like the great lion of Narnia, Aslan guides AI agents to accomplish their missions in the real world.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![Security Status](https://img.shields.io/badge/security-production--ready-green.svg)](https://aslanpay.xyz/api/security)

## 🌟 What is Aslan?

Just as Aslan guided the Pevensie children to become rulers of Narnia, **Aslan guides AI agents to become autonomous economic actors** in the real world. 

Our platform provides the payment infrastructure that allows AI agents to:
- 💳 **Process payments** securely
- 🛒 **Make purchases** autonomously  
- 💰 **Manage budgets** and spending limits
- 🔐 **Operate safely** with enterprise-grade security

## 🚀 Quick Start

### Development Setup
```bash
# Clone the repository
git clone https://github.com/coltonsakamoto/aslanpay.git
cd aslanpay

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to see Aslan in action!

### Production Deployment
```bash
# Run the automated setup
./scripts/setup-production.sh

# Configure your domain
# Edit .env with aslanpay.xyz settings

# Deploy to production
npm run db:migrate
pm2 start ecosystem.config.js
```

## 🔒 Production-Ready Security

Aslan includes enterprise-grade security features:

- ✅ **Environment validation** - Validates all security requirements on startup
- ✅ **HTTPS enforcement** - Automatic HTTP→HTTPS redirects in production  
- ✅ **Security headers** - Complete Content Security Policy, HSTS, XSS protection
- ✅ **CORS protection** - Domain whitelist enforcement
- ✅ **Rate limiting** - Multi-layer DDoS protection
- ✅ **Audit logging** - Complete audit trail of all operations

```bash
# Validate your security configuration
npm run security:validate

# Generate secure secrets
npm run security:generate-secrets
```

## 🏗️ Architecture

### Smart Database Switching
- **Development:** SQLite (no setup required)
- **Production:** PostgreSQL (enterprise-ready)

### API-First Design
```javascript
// Authorize a payment
POST /api/v1/authorize
{
  "amount": 2999,
  "description": "AI agent purchase",
  "agent_id": "agent_123"
}
```

### Real-time Monitoring
- Health checks: `https://aslanpay.xyz/api/health`
- Security status: `https://aslanpay.xyz/api/security`
- Comprehensive logging and audit trails

## 📖 Documentation

- **[Production Setup Guide](PRODUCTION-SETUP-GUIDE.md)** - Complete deployment guide
- **[Security Implementation](SECURITY-IMPLEMENTATION-COMPLETE.md)** - Security features overview
- **[API Documentation](docs/)** - Complete API reference

## 🦁 The Aslan Philosophy

*"Just as Aslan guided the Pevensie children to become rulers of Narnia, Aslan guides AI agents to become autonomous economic actors in the real world."*

We believe AI agents should be empowered to act independently while maintaining the highest standards of security and oversight.

## 🛠️ Built With

- **Node.js + Express** - High-performance backend
- **PostgreSQL + Prisma** - Production database with type safety
- **Stripe** - Secure payment processing
- **JWT + Sessions** - Robust authentication
- **Helmet.js** - Security headers and CSRF protection

## 🌐 Live Demo

Visit **[aslanpay.xyz](https://aslanpay.xyz)** to see Aslan in action.

## 📞 Support

- **Website:** [aslanpay.xyz](https://aslanpay.xyz)
- **Email:** support@aslanpay.xyz
- **Issues:** [GitHub Issues](https://github.com/coltonsakamoto/aslanpay/issues)

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

---

*Like the great lion of Narnia, Aslan empowers others to accomplish their missions.* 🦁✨ 