// Subscription endpoint for Vercel serverless function
import stripeService from '../src/services/stripeService.js';
import userService from '../src/services/userService.js';
import twilioService from '../src/services/twilioService.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    return res.json({
      success: true,
      clientSecret: paymentResult.clientSecret,
      customerId,
      message: 'Subscription created successfully. Activation instructions sent via SMS.'
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}