# 🦁 AslanPay Stripe Integration Setup

Complete guide to set up Stripe payments for AslanPay's new pricing structure.

## 📋 Required Environment Variables

Add these to your `.env` file:

```bash
# Stripe Keys (get from Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_PUBLISHABLE_KEY=pk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Specific Price IDs (will create products dynamically if not set)
STRIPE_STARTER_PRICE_ID=price_starter_monthly
STRIPE_BUILDER_PRICE_ID=price_builder_monthly

# Base URL for webhook returns
BASE_URL=https://aslanpay.xyz
```

## 🛠️ Stripe Dashboard Setup

### 1. Create Stripe Account
1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete business verification
3. Get your API keys from the Dashboard

### 2. Create Products and Prices

#### Starter Plan - $29/month
```bash
# Create Starter Product
curl https://api.stripe.com/v1/products \
  -u sk_test_YOUR_SECRET_KEY: \
  -d name="AslanPay Starter Plan" \
  -d description="3,000 API authorizations per month"

# Create Starter Price  
curl https://api.stripe.com/v1/prices \
  -u sk_test_YOUR_SECRET_KEY: \
  -d unit_amount=2900 \
  -d currency=usd \
  -d recurring[interval]=month \
  -d product=prod_STARTER_PRODUCT_ID
```

#### Builder Plan - $129/month
```bash
# Create Builder Product
curl https://api.stripe.com/v1/products \
  -u sk_test_YOUR_SECRET_KEY: \
  -d name="AslanPay Builder Plan" \
  -d description="12,000 API authorizations per month"

# Create Builder Price
curl https://api.stripe.com/v1/prices \
  -u sk_test_YOUR_SECRET_KEY: \
  -d unit_amount=12900 \
  -d currency=usd \
  -d recurring[interval]=month \
  -d product=prod_BUILDER_PRODUCT_ID
```

### 3. Set Up Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://aslanpay.xyz/api/stripe/webhook`
3. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

## 🧪 Testing

### Test Cards
```bash
# Successful payment
4242 4242 4242 4242

# Declined payment  
4000 0000 0000 0002

# Requires authentication
4000 0025 0000 3155
```

### Test Checkout Flow
1. Go to `/pricing`
2. Click "Start Free Trial" on Starter or Builder
3. Use test card: `4242 4242 4242 4242`
4. Verify webhook receives events

## 💡 Integration Features

### ✅ What's Included

- **14-day free trial** for all paid plans
- **Automatic subscription management** 
- **Webhook handling** for subscription updates
- **User account linking** with Stripe customers
- **Graceful error handling** with user-friendly messages
- **Success/cancel flows** with proper redirects

### 🎯 Plan Details

| Plan | Price | Authorizations | Overage Rate | Features |
|------|-------|----------------|--------------|----------|
| **Sandbox** | FREE | 750/month | $0.05 each | Testing & development |
| **Starter** | $29/month | 3,000/month | $0.03 each | Individual developers |
| **Builder** | $129/month | 12,000/month | $0.02 each | Growing businesses |
| **Enterprise** | Custom | Volume-based | $0.005-0.01 | Large organizations |

### 🔄 Subscription Lifecycle

1. **Free Trial**: 14 days for paid plans
2. **Active**: User paying and using service
3. **Past Due**: Payment failed, retry attempts
4. **Canceled**: User canceled subscription
5. **Unpaid**: Final payment failure, service suspended

## 🚀 Deployment Checklist

### Development Environment
- [ ] Set `STRIPE_SECRET_KEY` (test key)
- [ ] Set `STRIPE_PUBLISHABLE_KEY` (test key)
- [ ] Test checkout flow with test cards
- [ ] Verify webhook events are received

### Production Environment
- [ ] Set `STRIPE_SECRET_KEY` (live key)
- [ ] Set `STRIPE_PUBLISHABLE_KEY` (live key)
- [ ] Set `STRIPE_WEBHOOK_SECRET` (live webhook)
- [ ] Update `BASE_URL` to production domain
- [ ] Test with real payment methods
- [ ] Monitor webhook delivery in Stripe Dashboard

## 📊 Analytics & Monitoring

### Stripe Dashboard Metrics
- Monthly Recurring Revenue (MRR)
- Churn rate
- Trial conversion rate
- Failed payment recovery

### AslanPay Metrics
- API usage per plan
- Overage billing
- Customer lifetime value
- Support ticket correlation with billing

## 🔧 Troubleshooting

### Common Issues

**Webhook Not Receiving Events**
- Verify webhook URL is publicly accessible
- Check webhook endpoint logs
- Confirm webhook secret matches

**Checkout Session Creation Fails**
- Verify Stripe secret key is correct
- Check plan configuration in server code
- Ensure user is authenticated

**Price IDs Don't Match**
- Update `STRIPE_STARTER_PRICE_ID` and `STRIPE_BUILDER_PRICE_ID`
- Or remove them to use dynamic product creation

### Debug Commands

```bash
# Test Stripe connection
node -e "console.log(require('stripe')(process.env.STRIPE_SECRET_KEY).balance.retrieve())"

# Check webhook endpoint
curl -X POST https://aslanpay.xyz/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Verify environment variables
npm run check-stripe
```

## 📞 Support

- **Stripe Issues**: [Stripe Support](https://support.stripe.com)
- **AslanPay Issues**: [support@aslanpay.xyz](mailto:support@aslanpay.xyz)
- **Documentation**: [aslanpay.xyz/docs](https://aslanpay.xyz/docs)

---

🦁 **Ready to accept payments!** Your AI agents can now monetize with confidence. 