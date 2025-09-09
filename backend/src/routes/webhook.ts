import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import twilioService from '../services/twilioService';
import userService from '../services/userService';
import aiService from '../services/aiService';
import SMSHelpers from '../services/smsHelpers';
import { createClient } from '@supabase/supabase-js';

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

    const { From, To, Body, MessageSid } = payload;
    
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
      // New user - send welcome message and setup instructions
      await handleNewUser(From, Body);
      return res.status(200).send('OK');
    }

    if (isUserPhone) {
      // Message from the user - this is a response to a filtered message
      await handleUserResponse(user, Body, MessageSid);
    } else {
      // Message from ex-partner - filter and send options to user
      await handleExPartnerMessage(user, From, Body, MessageSid);
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error processing SMS webhook:', error);
    res.status(500).send('Internal Server Error');
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

    // Check if message contains phone number for setup
    const { isSetupMessage, exPartnerPhone, error } = SMSHelpers.parseSetupMessage(messageBody);
    
    if (isSetupMessage && exPartnerPhone) {
      // Set up new user
      const result = await userService.setupNewUser(phoneNumber, exPartnerPhone);
      
      if (result.success) {
        logger.info(`New user setup completed: ${phoneNumber} <-> ${exPartnerPhone}`);
      } else {
        await twilioService.sendErrorMessage(phoneNumber, result.error || 'Setup failed');
      }
    } else {
      // Send welcome message
      await twilioService.sendWelcomeMessage(phoneNumber);
      
      if (error) {
        await twilioService.sendErrorMessage(phoneNumber, error);
      }
    }
  } catch (error) {
    logger.error('Error handling new user:', error);
    await twilioService.sendErrorMessage(phoneNumber, 'Setup failed. Please try again.');
  }
}

// Handle response from user (replying to filtered message)
async function handleUserResponse(user: any, responseBody: string, messageSid: string) {
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
      // User selected option 1, 2, or 3 - get the stored response
      const responseOptions = await getLastResponseOptions(user.id);
      if (!responseOptions) {
        await twilioService.sendErrorMessage(user.phoneNumber, 'No recent message to respond to');
        return;
      }
      
      finalResponse = SMSHelpers.getSelectedResponseText(responseOptions, parseResult.selectedOption) || '';
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

// Handle message from ex-partner (needs filtering)
async function handleExPartnerMessage(user: any, fromPhone: string, messageBody: string, messageSid: string) {
  try {
    // Validate message content
    const validation = SMSHelpers.validateMessageContent(messageBody);
    if (!validation.isValid) {
      logger.warn(`Invalid message content from ${fromPhone}: ${validation.error}`);
      return; // Don't forward invalid messages
    }

    // Process message through AI
    const aiResult = await aiService.processMessage(messageBody);
    
    // Save original message
    await saveIncomingMessage(user.id, fromPhone, messageBody, aiResult, messageSid);
    
    // Send filtered message with response options to user
    await twilioService.sendFilteredMessageToUser(
      user.phoneNumber,
      messageBody,
      aiResult.filteredMessage,
      aiResult.responseOptions,
      user.userName,
      user.exPartnerName
    );
    
    // Save response options for later use
    await saveResponseOptions(user.id, aiResult.responseOptions);
    
    logger.info(`Filtered message sent to ${user.phoneNumber} from ${fromPhone}`);
    
  } catch (error) {
    logger.error('Error handling ex-partner message:', error);
    // Don't send error to ex-partner, just log it
  }
}

// Handle special commands (help, status, etc.)
async function handleSpecialCommand(user: any, command: string) {
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

// Health check for webhook
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'sms-webhook',
    timestamp: new Date().toISOString() 
  });
});

export default router;