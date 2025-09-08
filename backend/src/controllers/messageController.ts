import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import supabaseService from '../services/supabaseService';
import twilioService from '../services/twilioService';
import { ResponseSelectRequest, APIResponse } from '../shared/types';

// Get messages for a user
export const getUserMessages = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { limit } = req.query;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  try {
    const messages = await supabaseService.getMessagesByUser(
      userId, 
      limit ? parseInt(limit as string) : undefined
    );

    res.json({
      success: true,
      data: messages,
      message: `Retrieved ${messages.length} messages`
    });

  } catch (error) {
    logger.error('Error fetching user messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// Get a specific message with response options
export const getMessage = asyncHandler(async (req: Request, res: Response) => {
  const { messageId } = req.params;

  if (!messageId) {
    return res.status(400).json({
      success: false,
      error: 'Message ID is required'
    });
  }

  try {
    const message = await supabaseService.getMessage(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    const responseOptions = await supabaseService.getResponseOptions(messageId);

    res.json({
      success: true,
      data: {
        message,
        responseOptions
      }
    });

  } catch (error) {
    logger.error('Error fetching message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch message'
    });
  }
});

// Send a response to an ex-partner
export const sendResponse = asyncHandler(async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const { selectedOption, customResponse }: ResponseSelectRequest = req.body;

  if (!messageId) {
    return res.status(400).json({
      success: false,
      error: 'Message ID is required'
    });
  }

  if (!selectedOption && !customResponse) {
    return res.status(400).json({
      success: false,
      error: 'Either selectedOption (1, 2, or 3) or customResponse is required'
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

    // Get response options
    const responseOptions = await supabaseService.getResponseOptions(messageId);
    if (!responseOptions) {
      return res.status(404).json({
        success: false,
        error: 'Response options not found'
      });
    }

    // Determine the response text
    let responseText = customResponse;
    if (!responseText && selectedOption) {
      switch (selectedOption) {
        case 1:
          responseText = responseOptions.option1;
          break;
        case 2:
          responseText = responseOptions.option2;
          break;
        case 3:
          responseText = responseOptions.option3;
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Selected option must be 1, 2, or 3'
          });
      }
    }

    if (!responseText) {
      return res.status(400).json({
        success: false,
        error: 'Could not determine response text'
      });
    }

    // Get the user to find ex-partner's number
    const user = await supabaseService.getUserByPhoneNumber(message.toNumber);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Send SMS via Twilio
    const twilioMessageId = await twilioService.sendSMS(user.exNumber, responseText);

    // Store the outgoing message
    const outgoingMessage = await supabaseService.createMessage({
      userId: user.id,
      fromNumber: user.twilioNumber,
      toNumber: user.exNumber,
      originalText: responseText,
      filteredText: responseText, // Response is already filtered/approved
      messageType: message.messageType, // Match the original message type
      direction: 'outgoing',
      status: 'sent',
      twilioMessageId: twilioMessageId || undefined
    });

    // Update the response selection
    await supabaseService.updateResponseSelection(messageId, responseText);

    logger.info('Response sent successfully', {
      originalMessageId: messageId,
      responseMessageId: outgoingMessage.id,
      twilioMessageId: twilioMessageId,
      selectedOption,
      customResponse: !!customResponse
    });

    const apiResponse: APIResponse = {
      success: true,
      data: {
        messageId: outgoingMessage.id,
        twilioMessageId: twilioMessageId,
        responseText: responseText,
        status: 'sent'
      },
      message: 'Response sent successfully'
    };

    res.json(apiResponse);

  } catch (error) {
    logger.error('Error sending response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send response'
    });
  }
});

// Get response options for a message
export const getResponseOptions = asyncHandler(async (req: Request, res: Response) => {
  const { messageId } = req.params;

  if (!messageId) {
    return res.status(400).json({
      success: false,
      error: 'Message ID is required'
    });
  }

  try {
    const responseOptions = await supabaseService.getResponseOptions(messageId);
    
    if (!responseOptions) {
      return res.status(404).json({
        success: false,
        error: 'Response options not found'
      });
    }

    res.json({
      success: true,
      data: responseOptions
    });

  } catch (error) {
    logger.error('Error fetching response options:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch response options'
    });
  }
});

// Get conversation summary for a user
export const getConversationSummary = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  try {
    // Get recent messages
    const messages = await supabaseService.getMessagesByUser(userId, 10);
    
    // Count unread messages (messages with status 'sent' and direction 'incoming')
    const unreadCount = messages.filter(msg => 
      msg.direction === 'incoming' && msg.status === 'sent'
    ).length;

    const summary = {
      userId,
      totalMessages: messages.length,
      lastMessageAt: messages.length > 0 ? messages[0].createdAt : null,
      unreadCount,
      recentMessages: messages.slice(0, 5) // Return only 5 most recent
    };

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error('Error fetching conversation summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation summary'
    });
  }
});