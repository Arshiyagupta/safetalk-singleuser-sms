// SMS webhook endpoint for Vercel serverless function
import twilioService from '../../src/services/twilioService.js';
import userService from '../../src/services/userService.js';
import aiService from '../../src/services/aiService.js';
import SMSHelpers from '../../src/services/smsHelpers.js';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-twilio-signature');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Received SMS webhook:', req.body);
    
    // Parse Twilio webhook payload
    const payload = twilioService.parseWebhookPayload(req.body);
    if (!payload) {
      console.error('Invalid webhook payload');
      return res.status(400).send('Invalid payload');
    }

    const { From, Body, MessageSid } = payload;
    
    // Validate webhook signature in production
    if (process.env.NODE_ENV === 'production') {
      const signature = req.headers['x-twilio-signature'];
      const url = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}${req.url}`;
      
      if (!twilioService.validateWebhookSignature(signature, url, req.body)) {
        console.error('Invalid webhook signature');
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
    console.error('Error processing SMS webhook:', error);
    return res.status(500).send('Internal Server Error');
  }
}

// Handle new user setup
async function handleNewUser(phoneNumber, messageBody) {
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
    console.error('Error handling new user:', error);
    await twilioService.sendErrorMessage(phoneNumber, 'Setup failed. Please try again.');
  }
}

// Handle response from user (replying to filtered message)
async function handleUserResponse(user, responseBody, _messageSid) {
  try {
    // Check for special commands first
    const { isCommand, command } = SMSHelpers.parseSpecialCommands(responseBody);
    
    if (isCommand) {
      await handleSpecialCommand(user, command);
      return;
    }

    // Parse user's response
    const parseResult = SMSHelpers.parseUserResponse(responseBody);
    
    if (!parseResult.isValidResponse) {
      await twilioService.sendInvalidResponseMessage(user.phoneNumber);
      return;
    }

    let finalResponse;
    
    if (parseResult.selectedOption) {
      // User selected option 1, 2, or 3
      const responseOptions = await getLastResponseOptions(user.id);
      const outgoingOptions = await getLastOutgoingMessageOptions(user.id);
      
      if (outgoingOptions) {
        finalResponse = SMSHelpers.getSelectedResponseText(outgoingOptions, parseResult.selectedOption) || '';
      } else if (responseOptions) {
        finalResponse = SMSHelpers.getSelectedResponseText(responseOptions, parseResult.selectedOption) || '';
      } else {
        await twilioService.sendErrorMessage(user.phoneNumber, 'No recent message to respond to');
        return;
      }
    } else if (parseResult.customResponse) {
      // User typed custom response - filter it through AI
      const filterResult = await filterCustomResponse(parseResult.customResponse);
      
      if (filterResult.response === '') {
        await twilioService.sendSMS(user.phoneNumber, 
          'That message contains inappropriate language. Please select option 1, 2, or 3 from the previous message.'
        );
        return;
      }
      
      finalResponse = filterResult.response;
    } else {
      await twilioService.sendInvalidResponseMessage(user.phoneNumber);
      return;
    }

    // Send response to ex-partner
    const messageSid = await twilioService.sendResponseToExPartner(user.exPartnerPhone, finalResponse);
    
    // Save the response to database
    await saveUserResponse(user.id, finalResponse, messageSid);
    
    console.log(`Response sent from ${user.phoneNumber} to ${user.exPartnerPhone}: ${finalResponse}`);
    
    // Send confirmation to user
    await twilioService.sendSMS(user.phoneNumber, 'Message sent successfully.');
    
  } catch (error) {
    console.error('Error handling user response:', error);
    await twilioService.sendErrorMessage(user.phoneNumber, 'Failed to send response. Please try again.');
  }
}

// Handle client initiating a new message to their ex
async function handleClientInitiatedMessage(user, messageBody, _messageSid) {
  try {
    // Check for special commands first
    const { isCommand, command } = SMSHelpers.parseSpecialCommands(messageBody);
    
    if (isCommand) {
      await handleSpecialCommand(user, command);
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
    
    console.log(`Outgoing message options sent to ${user.phoneNumber} for message to ${user.exPartnerPhone}`);
    
  } catch (error) {
    console.error('Error handling client initiated message:', error);
    await twilioService.sendErrorMessage(user.phoneNumber, 'Failed to process your message. Please try again.');
  }
}

// Handle message from ex-partner (needs filtering)
async function handleExPartnerMessage(user, _fromPhone, messageBody, messageSid) {
  try {
    // Validate message content
    const validation = SMSHelpers.validateMessageContent(messageBody);
    if (!validation.isValid) {
      console.warn(`Invalid message content from ${_fromPhone}: ${validation.error}`);
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
    
    console.log(`Filtered message sent to ${user.phoneNumber} from ${_fromPhone}`);
    
  } catch (error) {
    console.error('Error handling ex-partner message:', error);
    // Don't send error to ex-partner, just log it
  }
}

// Handle special commands (help, status, etc.)
async function handleSpecialCommand(user, command) {
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
        await twilioService.sendSMS(user.phoneNumber, 'SafeTalk service resumed.');
        break;
    }
  } catch (error) {
    console.error('Error handling special command:', error);
    await twilioService.sendErrorMessage(user.phoneNumber, 'Command failed. Please try again.');
  }
}

// Database helper functions (simplified for serverless)
async function saveIncomingMessage(userId, fromPhone, originalText, aiResult, twilioSid) {
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
    console.error('Error saving incoming message:', error);
  }
}

async function saveUserResponse(userId, responseText, twilioSid) {
  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        user_id: userId,
        from_number: twilioService.getTwilioPhoneNumber(),
        to_number: '',
        original_text: responseText,
        direction: 'outgoing',
        status: 'sent',
        twilio_message_id: twilioSid
      });
      
    if (error) throw error;
  } catch (error) {
    console.error('Error saving user response:', error);
  }
}

async function saveResponseOptions(userId, options) {
  try {
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
    console.error('Error saving response options:', error);
  }
}

async function getLastResponseOptions(userId) {
  try {
    // Simplified query for serverless
    const { data: recentMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', userId)
      .eq('direction', 'incoming')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentMessage) {
      const { data } = await supabase
        .from('response_options')
        .select('*')
        .eq('message_id', recentMessage.id)
        .single();
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error getting last response options:', error);
    return null;
  }
}

async function hasPendingResponseOptions(userId) {
  try {
    const incomingPending = await hasPendingIncomingOptions(userId);
    if (incomingPending) return true;
    const outgoingPending = await hasPendingOutgoingOptions(userId);
    return outgoingPending;
  } catch (error) {
    console.error('Error checking pending response options:', error);
    return false;
  }
}

async function hasPendingIncomingOptions(userId) {
  try {
    const { data: recentMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', userId)
      .eq('direction', 'incoming')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!recentMessage) return false;

    const { data: responseOptions } = await supabase
      .from('response_options')
      .select('selected_response, custom_response')
      .eq('message_id', recentMessage.id)
      .single();

    return responseOptions ? (!responseOptions.selected_response && !responseOptions.custom_response) : false;
  } catch (error) {
    return false;
  }
}

async function hasPendingOutgoingOptions(userId) {
  try {
    const { data: recentMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', userId)
      .eq('direction', 'outgoing_intent')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!recentMessage) return false;

    const { data: responseOptions } = await supabase
      .from('response_options')
      .select('selected_response, custom_response')
      .eq('message_id', recentMessage.id)
      .single();

    return responseOptions ? (!responseOptions.selected_response && !responseOptions.custom_response) : false;
  } catch (error) {
    return false;
  }
}

async function getLastOutgoingMessageOptions(userId) {
  try {
    const { data: recentMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', userId)
      .eq('direction', 'outgoing_intent')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentMessage) {
      const { data } = await supabase
        .from('response_options')
        .select('*')
        .eq('message_id', recentMessage.id)
        .single();
      return data;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function filterCustomResponse(customResponse) {
  try {
    const result = await aiService.filterUserResponse(customResponse);
    
    if (!result.isAppropriate) {
      return { response: '', wasFiltered: true };
    }
    
    return {
      response: result.filteredResponse,
      wasFiltered: result.filteredResponse !== customResponse.trim()
    };
  } catch (error) {
    console.error('Error filtering custom response:', error);
    const filtered = aiService.basicFilterUserResponse(customResponse);
    return {
      response: filtered,
      wasFiltered: filtered !== customResponse.trim()
    };
  }
}

async function saveOutgoingMessageIntent(userId, originalText, aiResult, twilioSid) {
  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        user_id: userId,
        from_number: '',
        to_number: '',  
        original_text: originalText,
        filtered_text: null,
        message_type: aiResult.messageType || 'informational',
        direction: 'outgoing_intent',
        status: 'pending',
        twilio_message_id: twilioSid
      });
      
    if (error) throw error;
  } catch (error) {
    console.error('Error saving outgoing message intent:', error);
  }
}

async function saveOutgoingMessageOptions(userId, options) {
  try {
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
    console.error('Error saving outgoing message options:', error);
  }
}

// Subscription validation functions
function isValidSubscription(user) {
  if (!user.subscriptionStatus) {
    console.log('No subscription status found, allowing access for development');
    return true;
  }
  
  if (user.subscriptionStatus !== 'active') {
    console.log(`User ${user.phoneNumber} has inactive subscription: ${user.subscriptionStatus}`);
    return false;
  }
  
  if (!user.hasActivatedService) {
    console.log(`User ${user.phoneNumber} has not activated service yet`);
    return false;
  }
  
  return true;
}

async function handleSubscriptionRequired(phoneNumber, messageBody) {
  try {
    const { isCommand, command } = SMSHelpers.parseSpecialCommands(messageBody);
    
    if (isCommand && command === 'help') {
      await twilioService.sendSMS(phoneNumber, SMSHelpers.getHelpMessage());
      return;
    }
    
    if (isCommand && command === 'start') {
      const { user } = await userService.findUserByPhoneNumber(phoneNumber);
      
      if (user && user.subscriptionStatus === 'active' && !user.hasActivatedService) {
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
    console.error('Error handling subscription required:', error);
  }
}

async function markServiceActivated(userId, phoneNumber) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ has_activated_service: true })
      .eq('id', userId);
      
    if (error) {
      console.error('Error marking service as activated:', error);
    } else {
      console.log(`Service activated for user ${phoneNumber}`);
    }
  } catch (error) {
    console.error('Error updating activation status:', error);
  }
}