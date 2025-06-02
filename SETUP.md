# Autonomy Payment Setup Guide

## Prerequisites

1. **Stripe Account**: Sign up at [stripe.com](https://stripe.com) and get your API keys
2. **Node.js**: Version 16 or higher

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory with:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 3. Update Stripe Publishable Key

In `public/checkout.html`, replace `pk_test_YOUR_STRIPE_PUBLISHABLE_KEY` with your actual Stripe publishable key:

```javascript
const stripe = Stripe('pk_test_your_actual_publishable_key');
```

### 4. Create Stripe Products

Start the server and create your Stripe products:

```bash
npm start
```

Then in another terminal:

```bash
curl -X POST http://localhost:3000/api/setup-products
```

This will create the Builder and Team plan products in your Stripe dashboard and return the price IDs.

### 5. Update Price IDs

Update the price IDs in `public/checkout.html` with the ones returned from the setup-products call:

```javascript
const PLANS = {
    // ...
    builder: {
        // ...
        priceId: 'price_actual_builder_id_from_stripe', // Replace this
    },
    team: {
        // ...
        priceId: 'price_actual_team_id_from_stripe', // Replace this
    }
};
```

### 6. Set Up Webhooks (Optional)

1. In your Stripe Dashboard, go to Developers > Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhook`
3. Select events: `subscription.*`, `invoice.*`
4. Copy the webhook secret to your `.env` file

## Testing

### Test Cards

Use Stripe's test card numbers:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Use any future expiration date, any 3-digit CVC, and any postal code.

### Test Flow

1. Visit `http://localhost:3000/pricing.html`
2. Click on a plan button
3. Fill out the checkout form with test data
4. Use a test card number
5. Complete the payment

**💡 Note:** You can also try the live demo at [aslanpay.xyz](https://aslanpay.xyz) to see how it works before setting up locally!

## Production Deployment

1. Replace test API keys with live keys
2. Update webhook endpoint to your production domain
3. Set `NODE_ENV=production`
4. Deploy to your hosting platform (Vercel, Heroku, etc.)

## Features

- ✅ Stripe integration for payments
- ✅ 14-day free trials for paid plans
- ✅ Subscription management
- ✅ Webhook handling
- ✅ Customer creation
- ✅ Error handling
- ✅ Loading states
- ✅ Success/failure feedback

## Next Steps

1. Add user authentication
2. Create customer dashboard
3. Add usage tracking
4. Implement overage billing
5. Add team management features 