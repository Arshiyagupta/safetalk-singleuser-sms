import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import twilioService from '../services/twilioService';
import supabaseService from '../services/supabaseService';
import aiService from '../services/aiService';

// Handle incoming SMS from ex-partner
export const handleIncomingSMS = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Parse the webhook payload
    const payload = twilioService.parseWebhookPayload(req.body);
    if (!payload) {
      logger.error('Invalid Twilio webhook payload');
      return res.status(400).send('Invalid payload');
    }

    logger.info('Received SMS from Twilio', {
      from: payload.From,
      to: payload.To,
      messageSid: payload.MessageSid
    });

    // Find the user associated with this Twilio number
    const user = await supabaseService.getUserByTwilioNumber(payload.To);
    if (!user) {
      logger.error(`No user found for Twilio number: ${payload.To}`);
      return res.status(404).send('User not found');
    }

    // Verify the message is from the registered ex-partner
    if (payload.From !== user.exNumber) {
      logger.warn(`Message from unregistered number: ${payload.From}, expected: ${user.exNumber}`);
      // Still process but log the discrepancy
    }

    // Store the original message
    const message = await supabaseService.createMessage({
      userId: user.id,
      fromNumber: payload.From,
      toNumber: payload.To,
      originalText: payload.Body,
      messageType: 'informational', // Will be updated by AI processing
      direction: 'incoming',
      status: 'processing',
      twilioMessageId: payload.MessageSid
    });

    // Process message with AI
    logger.info('Processing message with AI', { messageId: message.id });
    
    try {
      const aiResult = await aiService.processMessage(payload.Body);
      
      // Update message with filtered content and type
      await supabaseService.createMessage({
        userId: user.id,
        fromNumber: payload.From,
        toNumber: user.phoneNumber, // Send filtered message to client
        originalText: payload.Body,
        filteredText: aiResult.filteredMessage,
        messageType: aiResult.messageType,
        direction: 'incoming',
        status: 'sent',
        twilioMessageId: payload.MessageSid
      });

      // Store response options
      await supabaseService.createResponseOptions({
        messageId: message.id,
        option1: aiResult.responseOptions[0],
        option2: aiResult.responseOptions[1],
        option3: aiResult.responseOptions[2]
      });

      logger.info('Message processed successfully', {
        messageId: message.id,
        messageType: aiResult.messageType,
        confidence: aiResult.confidence
      });

      // In a real app, you would push notification to mobile app here
      // For now, the mobile app will poll for new messages
      
    } catch (aiError) {
      logger.error('AI processing failed, storing original message', aiError);
      
      // Fallback: store message without filtering
      await supabaseService.createMessage({
        userId: user.id,
        fromNumber: payload.From,
        toNumber: user.phoneNumber,
        originalText: payload.Body,
        filteredText: payload.Body, // Use original text as fallback
        messageType: 'informational',
        direction: 'incoming',
        status: 'sent'
      });

      // Create basic response options
      await supabaseService.createResponseOptions({
        messageId: message.id,
        option1: "Thank you for letting me know.",
        option2: "I understand.",
        option3: "I'll get back to you soon."
      });
    }

    // Respond to Twilio
    res.status(200).send('OK');

  } catch (error) {
    logger.error('Error processing incoming SMS:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle delivery status updates from Twilio
export const handleStatusUpdate = asyncHandler(async (req: Request, res: Response) => {
  try {
    const payload = twilioService.parseWebhookPayload(req.body);
    if (!payload || !payload.MessageStatus) {
      return res.status(400).send('Invalid status update payload');
    }

    logger.info('Received status update from Twilio', {
      messageSid: payload.MessageSid,
      status: payload.MessageStatus
    });

    // Update message status in database
    // Note: We need to find the message by twilioMessageId
    // This would require adding a query method to SupabaseService
    // For now, just log the status update

    res.status(200).send('OK');

  } catch (error) {
    logger.error('Error processing status update:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send SMS response from client to ex-partner
export const sendResponseSMS = asyncHandler(async (req: Request, res: Response) => {
  const { messageId, response } = req.body;

  if (!messageId || !response) {
    return res.status(400).json({
      success: false,
      error: 'Message ID and response are required'
    });
  }

  try {
    // Get the original message
    const message = await supabaseService.getMessage(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Get the user
    const user = await supabaseService.getUserByPhoneNumber(message.toNumber);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Send SMS via Twilio
    const twilioMessageId = await twilioService.sendSMS(user.exNumber, response);

    // Store the outgoing message
    const outgoingMessage = await supabaseService.createMessage({
      userId: user.id,
      fromNumber: user.twilioNumber,
      toNumber: user.exNumber,
      originalText: response,
      filteredText: response,
      messageType: 'informational',
      direction: 'outgoing',
      status: 'sent',
      twilioMessageId: twilioMessageId || undefined
    });

    // Update response selection
    await supabaseService.updateResponseSelection(messageId, response);

    logger.info('Response sent successfully', {
      messageId: outgoingMessage.id,
      twilioMessageId: twilioMessageId
    });

    res.json({
      success: true,
      data: {
        messageId: outgoingMessage.id,
        twilioMessageId: twilioMessageId
      },
      message: 'Response sent successfully'
    });

  } catch (error) {
    logger.error('Error sending response SMS:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send response'
    });
  }
});