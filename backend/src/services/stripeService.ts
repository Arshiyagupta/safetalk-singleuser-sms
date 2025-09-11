import Stripe from 'stripe';
import { logger } from '../utils/logger';

class StripeService {
  private stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!secretKey || secretKey.includes('PLACEHOLDER')) {
      logger.warn('Stripe secret key not configured. Service will use mock mode.');
      // Create a mock stripe instance for development
      this.stripe = {} as Stripe;
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-08-27.basil',
      });
      logger.info('Stripe service initialized');
    }
  }

  async createPaymentIntent(amount: number, customerInfo: {
    name: string;
    phone: string;
    email?: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
    try {
      // If using placeholder keys, return mock response
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('PLACEHOLDER')) {
        logger.info(`MOCK STRIPE: Creating payment intent for ${customerInfo.name} - $${amount/100}`);
        return {
          clientSecret: 'pi_mock_client_secret_12345',
          paymentIntentId: 'pi_mock_payment_intent_12345'
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        metadata: {
          customer_name: customerInfo.name,
          customer_phone: customerInfo.phone,
          service: 'SafeTalk Co-Parenting Service'
        }
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      logger.error('Error creating Stripe payment intent:', error);
      return null;
    }
  }

  async createCustomer(customerInfo: {
    name: string;
    phone: string;
    email?: string;
  }): Promise<string | null> {
    try {
      // If using placeholder keys, return mock response
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('PLACEHOLDER')) {
        logger.info(`MOCK STRIPE: Creating customer for ${customerInfo.name}`);
        return 'cus_mock_customer_12345';
      }

      const customer = await this.stripe.customers.create({
        name: customerInfo.name,
        phone: customerInfo.phone,
        email: customerInfo.email,
        metadata: {
          service: 'SafeTalk Co-Parenting Service'
        }
      });

      return customer.id;
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      return null;
    }
  }

  async createSubscription(customerId: string): Promise<string | null> {
    try {
      const priceId = process.env.STRIPE_PRICE_ID;
      
      // If using placeholder keys, return mock response
      if (!priceId || priceId.includes('PLACEHOLDER')) {
        logger.info(`MOCK STRIPE: Creating subscription for customer ${customerId}`);
        return 'sub_mock_subscription_12345';
      }

      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price: priceId,
        }],
        expand: ['latest_invoice.payment_intent'],
      });

      return subscription.id;
    } catch (error) {
      logger.error('Error creating Stripe subscription:', error);
      return null;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      // If using placeholder keys, return mock response
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('PLACEHOLDER')) {
        logger.info(`MOCK STRIPE: Cancelling subscription ${subscriptionId}`);
        return true;
      }

      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      return true;
    } catch (error) {
      logger.error('Error cancelling Stripe subscription:', error);
      return false;
    }
  }

  constructWebhookEvent(body: Buffer, signature: string): Stripe.Event | null {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret || webhookSecret.includes('PLACEHOLDER')) {
        logger.warn('Stripe webhook secret not configured, skipping verification');
        return null;
      }

      return this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      logger.error('Error constructing Stripe webhook event:', error);
      return null;
    }
  }

  getPublishableKey(): string {
    return process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_PLACEHOLDER_KEY';
  }
}

export default new StripeService();