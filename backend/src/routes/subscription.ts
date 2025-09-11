import { Router } from 'express';
import { logger } from '../utils/logger';
import stripeService from '../services/stripeService';
import userService from '../services/userService';
import twilioService from '../services/twilioService';

const router = Router();

// Create subscription
router.post('/subscribe', async (req, res) => {
  try {
    const { clientName, clientPhone, coparentName, coparentPhone } = req.body;

    // Validate input
    if (!clientName || !clientPhone || !coparentName || !coparentPhone) {
      return res.status(400).json({
        error: 'Missing required fields: clientName, clientPhone, coparentName, coparentPhone'
      });
    }

    // Format phone numbers
    const formattedClientPhone = twilioService.formatPhoneNumber(clientPhone);
    const formattedCoparentPhone = twilioService.formatPhoneNumber(coparentPhone);

    // Validate phone numbers
    if (!twilioService.isValidPhoneNumber(formattedClientPhone) || 
        !twilioService.isValidPhoneNumber(formattedCoparentPhone)) {
      return res.status(400).json({
        error: 'Invalid phone number format. Please use format: +1234567890'
      });
    }

    if (formattedClientPhone === formattedCoparentPhone) {
      return res.status(400).json({
        error: 'Client and co-parent phone numbers cannot be the same'
      });
    }

    logger.info(`Creating subscription for ${clientName} (${formattedClientPhone}) with co-parent ${coparentName} (${formattedCoparentPhone})`);

    // Create Stripe customer
    const customerId = await stripeService.createCustomer({
      name: clientName,
      phone: formattedClientPhone
    });

    if (!customerId) {
      return res.status(500).json({
        error: 'Failed to create customer account'
      });
    }

    // Create payment intent for $50
    const paymentResult = await stripeService.createPaymentIntent(5000, { // $50 in cents
      name: clientName,
      phone: formattedClientPhone
    });

    if (!paymentResult) {
      return res.status(500).json({
        error: 'Failed to create payment'
      });
    }

    // Store subscription info in database (pending activation)
    const user = await userService.createOrUpdateUser({
      userPhone: formattedClientPhone,
      exPartnerPhone: formattedCoparentPhone,
      twilioNumber: twilioService.getTwilioPhoneNumber(),
      userName: clientName,
      exPartnerName: coparentName
    });

    if (!user) {
      return res.status(500).json({
        error: 'Failed to create user account'
      });
    }

    // Send activation instructions via SMS
    const activationMessage = `Welcome to SafeTalk! To activate your service:

1. Save this number: ${twilioService.getTwilioPhoneNumber()}
2. Both you and ${coparentName} must text "START" to this number
3. Once both parties text START, your SafeTalk service will begin filtering messages

Your subscription is active. Questions? Reply HELP`;

    await twilioService.sendSMS(formattedClientPhone, activationMessage);

    // Send setup instructions to co-parent
    const coparentMessage = `${clientName} has set up SafeTalk co-parenting coordination for your family.

SafeTalk helps create respectful communication between co-parents through AI-filtered messaging.

To activate:
1. Save this number: ${twilioService.getTwilioPhoneNumber()}  
2. Text "START" to this number
3. Begin messaging through SafeTalk for filtered, professional communication

Questions? Reply HELP`;

    await twilioService.sendSMS(formattedCoparentPhone, coparentMessage);

    logger.info(`Subscription created successfully for user ${user.id}`);

    return res.json({
      success: true,
      clientSecret: paymentResult.clientSecret,
      customerId,
      message: 'Subscription created successfully. Activation instructions sent via SMS.'
    });

  } catch (error) {
    logger.error('Error creating subscription:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get subscription status
router.get('/status/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const formattedPhone = twilioService.formatPhoneNumber(phone);
    
    const result = await userService.findUserByPhoneNumber(formattedPhone);
    
    if (!result.user) {
      return res.status(404).json({
        error: 'No subscription found for this phone number'
      });
    }

    const stats = await userService.getUserStats(result.user.id);

    return res.json({
      success: true,
      subscription: {
        isActive: result.user.isActive,
        userName: result.user.userName,
        exPartnerName: result.user.exPartnerName,
        createdAt: result.user.createdAt,
        stats
      }
    });

  } catch (error) {
    logger.error('Error getting subscription status:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Stripe webhook handler
router.post('/stripe/webhook', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    const event = stripeService.constructWebhookEvent(req.body, signature);
    
    if (!event) {
      logger.warn('Stripe webhook event could not be constructed');
      return res.status(200).send('OK'); // Return OK for mock mode
    }

    logger.info(`Received Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        // Payment successful - subscription is now active
        logger.info(`Payment succeeded: ${event.data.object.id}`);
        break;

      case 'invoice.payment_succeeded':
        // Recurring payment successful
        logger.info(`Recurring payment succeeded: ${event.data.object.id}`);
        break;

      case 'customer.subscription.deleted':
        // Subscription cancelled
        logger.info(`Subscription cancelled: ${event.data.object.id}`);
        // TODO: Deactivate user in database
        break;

      default:
        logger.info(`Unhandled Stripe webhook event: ${event.type}`);
    }

    return res.status(200).send('OK');

  } catch (error) {
    logger.error('Error handling Stripe webhook:', error);
    return res.status(500).json({ error: 'Webhook handler error' });
  }
});

export default router;