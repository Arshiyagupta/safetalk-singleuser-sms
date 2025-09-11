import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import twilioService from '../services/twilioService';
import userService from '../services/userService';
import aiService from '../services/aiService';
import SMSHelpers from '../services/smsHelpers';
import { createClient } from '@supabase/supabase-js';
import { User } from '../shared/types';

const router = Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Main SMS webhook - handles all incoming SMS messages
router.post('/sms', async (req: Request, res: Response) => {
  try {
    logger.info('Received SMS webhook:', req.body);
    
    // Parse Twilio webhook payload
    const payload = twilioService.parseWebhookPayload(req.body);
    if (!payload) {
      logger.error('Invalid webhook payload');
      return res.status(400).send('Invalid payload');
    }

    const { From, Body, MessageSid } = payload;
    
    // Validate webhook signature in production
    if (process.env.NODE_ENV === 'production') {
      const signature = req.headers['x-twilio-signature'] as string;
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      
      if (!twilioService.validateWebhookSignature(signature, url, req.body)) {
        logger.error('Invalid webhook signature');
        return res.status(401).send('Unauthorized');
      }
    }

    // Find user associated with this phone number
    const { user, isUserPhone } = await userService.findUserByPhoneNumber(From);
    
    if (!user) {
      // New user - check if they need subscription or send welcome
      await handleNewUser(From, Body);
      return res.status(200).send('OK');
    }

    // Check subscription status before processing any messages
    if (!isValidSubscription(user)) {
      await handleSubscriptionRequired(From, Body);
      return res.status(200).send('OK');
    }

    if (isUserPhone) {
      // Message from the user - determine if responding or initiating
      const hasPendingOptions = await hasPendingResponseOptions(user.id);
      
      if (hasPendingOptions) {
        // User is responding to a previous filtered message
        await handleUserResponse(user, Body, MessageSid);
      } else {
        // User is initiating a new message to their ex
        await handleClientInitiatedMessage(user, Body, MessageSid);
      }
    } else {
      // Message from ex-partner - filter and send options to user
      await handleExPartnerMessage(user, From, Body, MessageSid);
    }

    return res.status(200).send('OK');
  } catch (error) {
    logger.error('Error processing SMS webhook:', error);
    return res.status(500).send('Internal Server Error');
  }
});

// Handle new user setup
async function handleNewUser(phoneNumber: string, messageBody: string) {
  try {
    // Check for special commands
    const { isCommand, command } = SMSHelpers.parseSpecialCommands(messageBody);
    
    if (isCommand && command === 'help') {
      await twilioService.sendSMS(phoneNumber, SMSHelpers.getHelpMessage());
      return;
    }

    // New users must subscribe first - redirect to website
    const welcomeMessage = `👋 Welcome to SafeTalk!

SafeTalk provides professional co-parenting coordination through AI-filtered SMS messaging.

To get started:
1. Subscribe at: https://safetalk-coparents.vercel.com
2. Both co-parents text "START" to activate service
3. Begin communicating through SafeTalk for better co-parenting

💰 Only $50/month for unlimited professional messaging support

Questions? Reply HELP`;

    await twilioService.sendSMS(phoneNumber, welcomeMessage);

    // Legacy setup check for existing flow compatibility
    const { isSetupMessage, exPartnerPhone, userName, exPartnerName, error } = SMSHelpers.parseSetupMessage(messageBody);
    
    if (isSetupMessage && exPartnerPhone) {
      const legacyMessage = `Setup detected, but SafeTalk now requires subscription first.

Please visit https://safetalk-coparents.vercel.com to subscribe and set up your service properly.

Your information:
• Your name: ${userName || 'Not provided'}
• Co-parent: ${exPartnerName || 'Not provided'} (${exPartnerPhone})

After subscribing, both parties text "START" to activate.`;

      await twilioService.sendSMS(phoneNumber, legacyMessage);
      return;
    }
    
    if (error) {
      await twilioService.sendErrorMessage(phoneNumber, error);
    }
  } catch (error) {
    logger.error('Error handling new user:', error);
    await twilioService.sendErrorMessage(phoneNumber, 'Setup failed. Please try again.');
  }
}

// Handle response from user (replying to filtered message)
async function handleUserResponse(user: User, responseBody: string, _messageSid: string) {
  try {
    // Check for special commands first
    const { isCommand, command } = SMSHelpers.parseSpecialCommands(responseBody);
    
    if (isCommand) {
      await handleSpecialCommand(user, command!);
      return;
    }

    // Parse user's response
    const parseResult = SMSHelpers.parseUserResponse(responseBody);
    
    if (!parseResult.isValidResponse) {
      await twilioService.sendInvalidResponseMessage(user.phoneNumber);
      return;
    }

    let finalResponse: string;
    
    if (parseResult.selectedOption) {
      // User selected option 1, 2, or 3 - determine if it's incoming response or outgoing message
      const responseOptions = await getLastResponseOptions(user.id);
      const outgoingOptions = await getLastOutgoingMessageOptions(user.id);
      
      if (outgoingOptions) {
        // User is selecting from outgoing message options (client initiating message to ex)
        finalResponse = SMSHelpers.getSelectedResponseText(outgoingOptions, parseResult.selectedOption) || '';
      } else if (responseOptions) {
        // User is responding to ex's filtered message (incoming response)
        finalResponse = SMSHelpers.getSelectedResponseText(responseOptions, parseResult.selectedOption) || '';
      } else {
        await twilioService.sendErrorMessage(user.phoneNumber, 'No recent message to respond to');
        return;
      }
    } else if (parseResult.customResponse) {
      // User typed custom response - filter it through AI for appropriateness
      const filterResult = await filterCustomResponse(parseResult.customResponse);
      
      if (filterResult.response === '') {
        // Message was too hostile - ask user to select from pre-generated options
        await twilioService.sendSMS(user.phoneNumber, 
          'That message contains inappropriate language. Please select option 1, 2, or 3 from the previous message.'
        );
        return;
      }
      
      finalResponse = filterResult.response;
      
      // Optionally notify user if their message was filtered
      if (filterResult.wasFiltered) {
        logger.info(`Custom response was filtered for user ${user.phoneNumber}`);
      }
    } else {
      await twilioService.sendInvalidResponseMessage(user.phoneNumber);
      return;
    }

    // Send response to ex-partner
    const messageSid = await twilioService.sendResponseToExPartner(user.exPartnerPhone, finalResponse);
    
    // Save the response to database
    await saveUserResponse(user.id, finalResponse, messageSid);
    
    logger.info(`Response sent from ${user.phoneNumber} to ${user.exPartnerPhone}: ${finalResponse}`);
    
    // Optionally send confirmation to user
    await twilioService.sendSMS(user.phoneNumber, 'Message sent successfully.');
    
  } catch (error) {
    logger.error('Error handling user response:', error);
    await twilioService.sendErrorMessage(user.phoneNumber, 'Failed to send response. Please try again.');
  }
}

// Handle client initiating a new message to their ex
async function handleClientInitiatedMessage(user: User, messageBody: string, _messageSid: string) {
  try {
    // Check for special commands first
    const { isCommand, command } = SMSHelpers.parseSpecialCommands(messageBody);
    
    if (isCommand) {
      await handleSpecialCommand(user, command!);
      return;
    }

    // Validate message content
    const validation = SMSHelpers.validateMessageContent(messageBody);
    if (!validation.isValid) {
      await twilioService.sendErrorMessage(user.phoneNumber, `Invalid message: ${validation.error}`);
      return;
    }

    // Process client's message through AI to generate 3 professional options
    const aiResult = await aiService.generateOutgoingMessageOptions(messageBody);
    
    // Save the outgoing message intent
    await saveOutgoingMessageIntent(user.id, messageBody, aiResult, _messageSid);
    
    // Send 3 professional options to client
    await twilioService.sendOutgoingMessageOptionsToClient(
      user.phoneNumber,
      messageBody,
      aiResult.messageOptions,
      user.userName,
      user.exPartnerName
    );
    
    // Save the outgoing options for later selection
    await saveOutgoingMessageOptions(user.id, aiResult.messageOptions);
    
    logger.info(`Outgoing message options sent to ${user.phoneNumber} for message to ${user.exPartnerPhone}`);
    
  } catch (error) {
    logger.error('Error handling client initiated message:', error);
    await twilioService.sendErrorMessage(user.phoneNumber, 'Failed to process your message. Please try again.');
  }
}

// Handle message from ex-partner (needs filtering)
async function handleExPartnerMessage(user: User, _fromPhone: string, messageBody: string, messageSid: string) {
  try {
    // Validate message content
    const validation = SMSHelpers.validateMessageContent(messageBody);
    if (!validation.isValid) {
      logger.warn(`Invalid message content from ${_fromPhone}: ${validation.error}`);
      return; // Don't forward invalid messages
    }

    // Process message through AI
    const aiResult = await aiService.processMessage(messageBody);
    
    // Save original message
    await saveIncomingMessage(user.id, _fromPhone, messageBody, aiResult, messageSid);
    
    // Send filtered message with response options to user
    await twilioService.sendFilteredMessageToUser(
      user.phoneNumber,
      messageBody,
      aiResult.filteredMessage,
      aiResult.responseOptions,
      user.userName,
      user.exPartnerName,
      aiResult.context
    );
    
    // Save response options for later use
    await saveResponseOptions(user.id, aiResult.responseOptions);
    
    logger.info(`Filtered message sent to ${user.phoneNumber} from ${_fromPhone}`);
    
  } catch (error) {
    logger.error('Error handling ex-partner message:', error);
    // Don't send error to ex-partner, just log it
  }
}

// Handle special commands (help, status, etc.)
async function handleSpecialCommand(user: User, command: string) {
  try {
    switch (command) {
      case 'help':
        await twilioService.sendSMS(user.phoneNumber, SMSHelpers.getHelpMessage());
        break;
        
      case 'status':
        const stats = await userService.getUserStats(user.id);
        const statusMessage = SMSHelpers.getStatusMessage(
          user.phoneNumber,
          user.exPartnerPhone,
          stats?.totalMessages || 0,
          stats?.lastActivity || null
        );
        await twilioService.sendSMS(user.phoneNumber, statusMessage);
        break;
        
      case 'stop':
        await userService.deactivateUser(user.id);
        await twilioService.sendSMS(user.phoneNumber, 'SafeTalk service paused. Text "start" to resume.');
        break;
        
      case 'start':
        // Reactivate user (we'd need to add this method)
        await twilioService.sendSMS(user.phoneNumber, 'SafeTalk service resumed.');
        break;
    }
  } catch (error) {
    logger.error('Error handling special command:', error);
    await twilioService.sendErrorMessage(user.phoneNumber, 'Command failed. Please try again.');
  }
}

// Database helper functions
async function saveIncomingMessage(userId: string, fromPhone: string, originalText: string, aiResult: any, twilioSid: string) {
  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        user_id: userId,
        from_number: fromPhone,
        to_number: twilioService.getTwilioPhoneNumber(),
        original_text: originalText,
        filtered_text: aiResult.filteredMessage,
        message_type: aiResult.messageType,
        direction: 'incoming',
        status: 'sent',
        twilio_message_id: twilioSid
      });
      
    if (error) throw error;
  } catch (error) {
    logger.error('Error saving incoming message:', error);
  }
}

async function saveUserResponse(userId: string, responseText: string, twilioSid: string | null) {
  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        user_id: userId,
        from_number: twilioService.getTwilioPhoneNumber(),
        to_number: '', // Will be filled from user data
        original_text: responseText,
        direction: 'outgoing',
        status: 'sent',
        twilio_message_id: twilioSid
      });
      
    if (error) throw error;
  } catch (error) {
    logger.error('Error saving user response:', error);
  }
}

async function saveResponseOptions(userId: string, options: [string, string, string]) {
  try {
    // Get the most recent incoming message for this user
    const { data: lastMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', userId)
      .eq('direction', 'incoming')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastMessage) {
      const { error } = await supabase
        .from('response_options')
        .insert({
          message_id: lastMessage.id,
          option1: options[0],
          option2: options[1],
          option3: options[2]
        });
        
      if (error) throw error;
    }
  } catch (error) {
    logger.error('Error saving response options:', error);
  }
}

async function getLastResponseOptions(userId: string) {
  try {
    const { data } = await supabase
      .from('response_options')
      .select('*')
      .eq('message_id', supabase
        .from('messages')
        .select('id')
        .eq('user_id', userId)
        .eq('direction', 'incoming')
        .order('created_at', { ascending: false })
        .limit(1)
      )
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    return data;
  } catch (error) {
    logger.error('Error getting last response options:', error);
    return null;
  }
}

async function hasPendingResponseOptions(userId: string): Promise<boolean> {
  try {
    // Check for pending incoming response options
    const incomingPending = await hasPendingIncomingOptions(userId);
    if (incomingPending) return true;

    // Check for pending outgoing message options
    const outgoingPending = await hasPendingOutgoingOptions(userId);
    return outgoingPending;
  } catch (error) {
    logger.error('Error checking pending response options:', error);
    return false;
  }
}

async function hasPendingIncomingOptions(userId: string): Promise<boolean> {
  try {
    // Check if there's a recent incoming message with response options that haven't been used
    const { data: recentMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', userId)
      .eq('direction', 'incoming')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!recentMessage) {
      return false;
    }

    // Check if there are unused response options for this message
    const { data: responseOptions } = await supabase
      .from('response_options')
      .select('selected_response, custom_response')
      .eq('message_id', recentMessage.id)
      .single();

    // User has pending options if there are response options that haven't been used yet
    return responseOptions ? (!responseOptions.selected_response && !responseOptions.custom_response) : false;
  } catch (error) {
    logger.error('Error checking pending incoming options:', error);
    return false;
  }
}

async function hasPendingOutgoingOptions(userId: string): Promise<boolean> {
  try {
    // Check if there's a recent outgoing intent message with options that haven't been used
    const { data: recentMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', userId)
      .eq('direction', 'outgoing_intent')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!recentMessage) {
      return false;
    }

    // Check if there are unused outgoing options for this message
    const { data: responseOptions } = await supabase
      .from('response_options')
      .select('selected_response, custom_response')
      .eq('message_id', recentMessage.id)
      .single();

    return responseOptions ? (!responseOptions.selected_response && !responseOptions.custom_response) : false;
  } catch (error) {
    logger.error('Error checking pending outgoing options:', error);
    return false;
  }
}

async function getLastOutgoingMessageOptions(userId: string) {
  try {
    const { data } = await supabase
      .from('response_options')
      .select('*')
      .eq('message_id', supabase
        .from('messages')
        .select('id')
        .eq('user_id', userId)
        .eq('direction', 'outgoing_intent')
        .order('created_at', { ascending: false })
        .limit(1)
      )
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    return data;
  } catch (error) {
    logger.error('Error getting last outgoing message options:', error);
    return null;
  }
}

async function filterCustomResponse(customResponse: string): Promise<{response: string, wasFiltered: boolean}> {
  try {
    // Filter custom responses to ensure they're professional and appropriate
    const result = await aiService.filterUserResponse(customResponse);
    
    if (!result.isAppropriate) {
      // Message was too hostile - return empty to force user to select pre-generated option
      return {
        response: '',
        wasFiltered: true
      };
    }
    
    return {
      response: result.filteredResponse,
      wasFiltered: result.filteredResponse !== customResponse.trim()
    };
  } catch (error) {
    logger.error('Error filtering custom response:', error);
    // Fallback to basic filtering
    const filtered = aiService.basicFilterUserResponse(customResponse);
    return {
      response: filtered,
      wasFiltered: filtered !== customResponse.trim()
    };
  }
}

// Database helper functions for outgoing messages
async function saveOutgoingMessageIntent(userId: string, originalText: string, aiResult: any, twilioSid: string) {
  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        user_id: userId,
        from_number: '', // Will be filled with user's number
        to_number: '', // Will be filled with ex's number  
        original_text: originalText,
        filtered_text: null, // Not filtered yet, user will choose option
        message_type: aiResult.messageType || 'informational',
        direction: 'outgoing_intent', // New direction type for initiated messages
        status: 'pending',
        twilio_message_id: twilioSid
      });
      
    if (error) throw error;
  } catch (error) {
    logger.error('Error saving outgoing message intent:', error);
  }
}

async function saveOutgoingMessageOptions(userId: string, options: [string, string, string]) {
  try {
    // Get the most recent outgoing intent message for this user
    const { data: lastMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', userId)
      .eq('direction', 'outgoing_intent')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastMessage) {
      const { error } = await supabase
        .from('response_options')
        .insert({
          message_id: lastMessage.id,
          option1: options[0],
          option2: options[1],
          option3: options[2]
        });
        
      if (error) throw error;
    }
  } catch (error) {
    logger.error('Error saving outgoing message options:', error);
  }
}

// Subscription validation functions
function isValidSubscription(user: User): boolean {
  // For development/testing - if no subscription fields, allow access
  if (!user.subscriptionStatus) {
    logger.info('No subscription status found, allowing access for development');
    return true;
  }
  
  // Check if subscription is active
  if (user.subscriptionStatus !== 'active') {
    logger.info(`User ${user.phoneNumber} has inactive subscription: ${user.subscriptionStatus}`);
    return false;
  }
  
  // Check if service has been activated (both parties texted START)
  if (!user.hasActivatedService) {
    logger.info(`User ${user.phoneNumber} has not activated service yet`);
    return false;
  }
  
  return true;
}

async function handleSubscriptionRequired(phoneNumber: string, messageBody: string) {
  try {
    // Check for special commands first
    const { isCommand, command } = SMSHelpers.parseSpecialCommands(messageBody);
    
    if (isCommand && command === 'help') {
      await twilioService.sendSMS(phoneNumber, SMSHelpers.getHelpMessage());
      return;
    }
    
    if (isCommand && command === 'start') {
      // User trying to activate - check if they have a subscription
      const { user } = await userService.findUserByPhoneNumber(phoneNumber);
      
      if (user && user.subscriptionStatus === 'active' && !user.hasActivatedService) {
        // Mark as activated and continue
        await markServiceActivated(user.id, phoneNumber);
        
        const activationMessage = `✅ SafeTalk activated for ${phoneNumber}!

Your co-parenting communication service is now active. All messages will be filtered through AI to promote respectful dialogue.

• Messages from your co-parent will be filtered and you'll get response options
• Your messages will be reviewed before sending
• Professional mediation available 24/7

Start communicating through this SafeTalk number for better co-parenting! 👨‍👩‍👧‍👦`;

        await twilioService.sendSMS(phoneNumber, activationMessage);
        return;
      }
    }
    
    // Send subscription required message
    const subscriptionMessage = `🔒 SafeTalk Subscription Required

To use SafeTalk's professional co-parenting coordination service, please visit:

https://safetalk-coparents.vercel.com

• Monthly subscription: $50
• Unlimited AI-filtered messaging  
• 24/7 conflict resolution support
• Professional response suggestions

After subscribing, both co-parents must text "START" to activate the service.

Questions? Reply HELP`;

    await twilioService.sendSMS(phoneNumber, subscriptionMessage);
    
  } catch (error) {
    logger.error('Error handling subscription required:', error);
  }
}

async function markServiceActivated(userId: string, phoneNumber: string) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ has_activated_service: true })
      .eq('id', userId);
      
    if (error) {
      logger.error('Error marking service as activated:', error);
    } else {
      logger.info(`Service activated for user ${phoneNumber}`);
    }
  } catch (error) {
    logger.error('Error updating activation status:', error);
  }
}

// Health check for webhook
router.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'sms-webhook',
    timestamp: new Date().toISOString() 
  });
});

export default router;