/**
 * Billing Service - Stripe Integration for SaaS
 * 
 * Handles:
 * - Customer creation and management
 * - Metered billing (per-transaction fees)
 * - Automatic invoice generation
 * - Dispute management via Stripe Customer Portal
 * - Usage-based billing without manual invoices
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const database = require('../config/database');

class BillingService {
    constructor() {
        this.isConfigured = !!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('placeholder');
        
        if (!this.isConfigured) {
            console.warn('⚠️  Billing service not configured - using mock billing');
        } else {
            console.log('✅ Billing service configured with Stripe');
        }
    }

    /**
     * Create or retrieve Stripe customer for tenant
     */
    async getOrCreateCustomer(tenant, user) {
        if (!this.isConfigured) {
            return this.createMockCustomer(tenant, user);
        }

        try {
            // Check if customer already exists
            if (tenant.stripeCustomerId) {
                const customer = await stripe.customers.retrieve(tenant.stripeCustomerId);
                if (customer && !customer.deleted) {
                    return customer;
                }
            }

            // Create new Stripe customer
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name,
                description: `Aslan customer for ${tenant.name}`,
                metadata: {
                    tenantId: tenant.id,
                    userId: user.id,
                    plan: tenant.plan,
                    created: tenant.createdAt.toISOString()
                }
            });

            // Update tenant with Stripe customer ID
            tenant.stripeCustomerId = customer.id;
            await database.updateTenant(tenant.id, { stripeCustomerId: customer.id });

            console.log(`✅ Created Stripe customer: ${customer.id} for tenant: ${tenant.name}`);
            return customer;

        } catch (error) {
            console.error('❌ Failed to create Stripe customer:', error);
            throw new Error('Failed to set up billing for your account');
        }
    }

    /**
     * Create metered billing subscription for production customers
     */
    async createMeteredSubscription(tenant, user) {
        if (!this.isConfigured) {
            return this.createMockSubscription(tenant);
        }

        try {
            const customer = await this.getOrCreateCustomer(tenant, user);

            // Create usage-based price for transactions
            const price = await stripe.prices.create({
                currency: 'usd',
                unit_amount: 29, // $0.29 base fee
                recurring: {
                    interval: 'month',
                    usage_type: 'metered'
                },
                billing_scheme: 'per_unit',
                product_data: {
                    name: 'Aslan Transaction Fees',
                    description: 'Per-transaction overage pricing based on subscription plan'
                },
                metadata: {
                    tenantId: tenant.id,
                    feeStructure: 'overage-based',
                    plan: 'production'
                }
            });

            // Create subscription with metered billing
            const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [{
                    price: price.id
                }],
                billing_cycle_anchor: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // Bill monthly
                metadata: {
                    tenantId: tenant.id,
                    plan: 'production'
                }
            });

            // Update tenant with subscription info
            await database.updateTenant(tenant.id, {
                stripeSubscriptionId: subscription.id,
                stripePriceId: price.id,
                billingStatus: 'active'
            });

            console.log(`✅ Created metered subscription: ${subscription.id} for tenant: ${tenant.name}`);
            return subscription;

        } catch (error) {
            console.error('❌ Failed to create subscription:', error);
            throw new Error('Failed to set up production billing');
        }
    }

    /**
     * Record usage for metered billing (called on each transaction)
     */
    async recordUsage(tenant, transactionAmount, transactionId) {
        if (!this.isConfigured) {
            return this.recordMockUsage(tenant, transactionAmount, transactionId);
        }

        try {
            // Only record usage for production plans
            if (tenant.plan !== 'production' || !tenant.stripeSubscriptionId) {
                return null;
            }

            // Calculate overage fee based on plan
            // TODO: Get actual user plan
            // For now use Builder plan rate as default
            const overageFeePerTransaction = 2; // $0.02 in cents
            const totalFee = overageFeePerTransaction;

            // Report usage to Stripe for billing
            const usageRecord = await stripe.subscriptionItems.createUsageRecord(
                tenant.stripePriceId,
                {
                    quantity: totalFee, // Bill our total fee in cents
                    timestamp: Math.floor(Date.now() / 1000),
                    action: 'increment'
                }
            );

            console.log(`💰 Recorded usage: $${totalFee/100} fee for $${transactionAmount/100} transaction`);
            
            return {
                usageRecordId: usageRecord.id,
                feeAmount: totalFee,
                transactionAmount,
                transactionId
            };

        } catch (error) {
            console.error('❌ Failed to record usage:', error);
            // Don't throw - we don't want billing issues to block payments
            return null;
        }
    }

    /**
     * Create Stripe Customer Portal session for self-service billing
     */
    async createCustomerPortalSession(tenant, returnUrl) {
        if (!this.isConfigured) {
            return {
                url: `${process.env.BASE_URL || 'http://localhost:3000'}/billing-mock.html`
            };
        }

        try {
            if (!tenant.stripeCustomerId) {
                throw new Error('No billing account found for this organization');
            }

            const session = await stripe.billingPortal.sessions.create({
                customer: tenant.stripeCustomerId,
                return_url: returnUrl || `${process.env.BASE_URL}/dashboard.html`,
                locale: 'en',
                configuration: {
                    business_profile: {
                        headline: 'Aslan Payment Infrastructure Billing'
                    },
                    features: {
                        invoice_history: { enabled: true },
                        payment_method_update: { enabled: true },
                        subscription_cancel: { enabled: false }, // Prevent accidental cancellation
                        subscription_pause: { enabled: false },
                        subscription_update: { enabled: false }
                    }
                }
            });

            console.log(`🔗 Created billing portal session for tenant: ${tenant.name}`);
            return session;

        } catch (error) {
            console.error('❌ Failed to create billing portal session:', error);
            throw new Error('Unable to access billing portal. Please contact support.');
        }
    }

    /**
     * Handle Stripe webhooks for billing events
     */
    async handleWebhook(event) {
        console.log(`📨 Received Stripe webhook: ${event.type}`);

        try {
            switch (event.type) {
                case 'customer.subscription.created':
                    await this.handleSubscriptionCreated(event.data.object);
                    break;

                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object);
                    break;

                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object);
                    break;

                case 'invoice.payment_succeeded':
                    await this.handlePaymentSucceeded(event.data.object);
                    break;

                case 'invoice.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;

                case 'customer.dispute.created':
                    await this.handleDisputeCreated(event.data.object);
                    break;

                default:
                    console.log(`⚠️  Unhandled webhook event: ${event.type}`);
            }

            return { success: true, processed: event.type };

        } catch (error) {
            console.error(`❌ Webhook processing failed for ${event.type}:`, error);
            return { success: false, error: error.message };
        }
    }

    async handleSubscriptionCreated(subscription) {
        const tenantId = subscription.metadata.tenantId;
        if (tenantId) {
            await database.updateTenant(tenantId, {
                billingStatus: 'active',
                stripeSubscriptionId: subscription.id
            });
            console.log(`✅ Subscription activated for tenant: ${tenantId}`);
        }
    }

    async handleSubscriptionUpdated(subscription) {
        const tenantId = subscription.metadata.tenantId;
        if (tenantId) {
            await database.updateTenant(tenantId, {
                billingStatus: subscription.status
            });
            console.log(`📝 Subscription updated for tenant: ${tenantId} - Status: ${subscription.status}`);
        }
    }

    async handleSubscriptionDeleted(subscription) {
        const tenantId = subscription.metadata.tenantId;
        if (tenantId) {
            await database.updateTenant(tenantId, {
                billingStatus: 'cancelled',
                plan: 'sandbox' // Downgrade to sandbox
            });
            console.log(`❌ Subscription cancelled for tenant: ${tenantId}`);
        }
    }

    async handlePaymentSucceeded(invoice) {
        const customerId = invoice.customer;
        const tenant = await database.getTenantByStripeCustomerId(customerId);
        
        if (tenant) {
            console.log(`💰 Payment succeeded for tenant: ${tenant.name} - Amount: $${invoice.amount_paid/100}`);
            
            // Update payment status and reset any billing issues
            await database.updateTenant(tenant.id, {
                billingStatus: 'active',
                lastPaymentDate: new Date(),
                lastPaymentAmount: invoice.amount_paid
            });
        }
    }

    async handlePaymentFailed(invoice) {
        const customerId = invoice.customer;
        const tenant = await database.getTenantByStripeCustomerId(customerId);
        
        if (tenant) {
            console.log(`⚠️  Payment failed for tenant: ${tenant.name}`);
            
            // Update billing status but don't immediately suspend service
            // Stripe will retry automatically
            await database.updateTenant(tenant.id, {
                billingStatus: 'past_due',
                lastFailedPayment: new Date()
            });

            // TODO: Send notification email to customer
        }
    }

    async handleDisputeCreated(dispute) {
        console.log(`🚨 Dispute created: ${dispute.id} for amount: $${dispute.amount/100}`);
        
        // Disputes are automatically handled by Stripe's system
        // We just log and potentially notify our team
        
        // TODO: Send internal notification
        // TODO: Add dispute tracking to tenant record
    }

    /**
     * Get billing summary for tenant
     */
    async getBillingSummary(tenant) {
        if (!this.isConfigured) {
            return this.getMockBillingSummary(tenant);
        }

        try {
            if (!tenant.stripeCustomerId) {
                return {
                    status: 'no_billing',
                    plan: tenant.plan,
                    message: 'No billing account set up'
                };
            }

            const customer = await stripe.customers.retrieve(tenant.stripeCustomerId);
            
            let subscription = null;
            if (tenant.stripeSubscriptionId) {
                subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
            }

            return {
                status: subscription?.status || 'inactive',
                plan: tenant.plan,
                customerId: customer.id,
                subscriptionId: subscription?.id,
                currentPeriodStart: subscription?.current_period_start,
                currentPeriodEnd: subscription?.current_period_end,
                billingEmail: customer.email,
                paymentMethods: customer.default_source || customer.invoice_settings?.default_payment_method ? 'configured' : 'none'
            };

        } catch (error) {
            console.error('❌ Failed to get billing summary:', error);
            return {
                status: 'error',
                message: 'Unable to retrieve billing information'
            };
        }
    }

    // Mock implementations for development
    createMockCustomer(tenant, user) {
        return {
            id: `cus_mock_${tenant.id}`,
            email: user.email,
            name: user.name,
            mock: true
        };
    }

    createMockSubscription(tenant) {
        return {
            id: `sub_mock_${tenant.id}`,
            status: 'active',
            mock: true
        };
    }

    recordMockUsage(tenant, transactionAmount, transactionId) {
        const percentageFee = Math.round(transactionAmount * 0.029);
        const fixedFee = 30;
        const totalFee = percentageFee + fixedFee;
        
        console.log(`💰 [MOCK] Recorded usage: $${totalFee/100} fee for $${transactionAmount/100} transaction`);
        
        return {
            usageRecordId: `ur_mock_${Date.now()}`,
            feeAmount: totalFee,
            transactionAmount,
            transactionId,
            mock: true
        };
    }

    getMockBillingSummary(tenant) {
        return {
            status: 'active',
            plan: tenant.plan,
            customerId: `cus_mock_${tenant.id}`,
            subscriptionId: `sub_mock_${tenant.id}`,
            billingEmail: 'mock@example.com',
            paymentMethods: 'configured',
            mock: true,
            message: 'Mock billing - no actual charges'
        };
    }
}

module.exports = new BillingService(); 