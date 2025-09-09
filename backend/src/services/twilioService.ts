import twilio from 'twilio';
import { logger } from '../utils/logger';

class TwilioService {
  private client: twilio.Twilio;
  private phoneNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (!accountSid || !authToken || !this.phoneNumber) {
      logger.warn('Twilio configuration missing. Service will use mock mode.');
      // Create a mock client for development
      this.client = {} as twilio.Twilio;
    } else {
      this.client = twilio(accountSid, authToken);
      logger.info('Twilio client initialized');
    }
  }

  async sendSMS(to: string, message: string): Promise<string | null> {
    try {
      // If in development mode without Twilio credentials, return mock message ID
      if (!process.env.TWILIO_ACCOUNT_SID) {
        logger.info(`MOCK SMS: To ${to}, Message: ${message}`);
        return `mock_message_${Date.now()}`;
      }

      const result = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: to
      });

      logger.info(`SMS sent successfully: ${result.sid}`);
      return result.sid;
    } catch (error) {
      logger.error('Error sending SMS:', error);
      throw error;
    }
  }

  async getMessageStatus(messageSid: string): Promise<string | null> {
    try {
      if (!process.env.TWILIO_ACCOUNT_SID) {
        logger.info(`MOCK: Getting status for message ${messageSid}`);
        return 'delivered'; // Mock status
      }

      const message = await this.client.messages(messageSid).fetch();
      return message.status;
    } catch (error) {
      logger.error('Error fetching message status:', error);
      return null;
    }
  }

  validateWebhookSignature(signature: string, url: string, params: any): boolean {
    try {
      if (!process.env.TWILIO_AUTH_TOKEN) {
        logger.warn('No Twilio auth token configured, skipping webhook validation');
        return true; // Skip validation in development
      }

      return twilio.validateRequest(
        process.env.TWILIO_AUTH_TOKEN,
        signature,
        url,
        params
      );
    } catch (error) {
      logger.error('Error validating webhook signature:', error);
      return false;
    }
  }

  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add +1 if it's a 10-digit US number
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    // Add + if it doesn't start with +
    if (!cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    
    return cleaned;
  }

  isValidPhoneNumber(phoneNumber: string): boolean {
    const cleaned = phoneNumber.replace(/\D/g, '');
    // US phone numbers are 10 digits, international can be 7-15 digits
    return cleaned.length >= 7 && cleaned.length <= 15;
  }

  getTwilioPhoneNumber(): string {
    return this.phoneNumber;
  }

  // Parse Twilio webhook payload
  parseWebhookPayload(body: any): {
    MessageSid: string;
    From: string;
    To: string;
    Body: string;
    MessageStatus?: string;
    AccountSid: string;
    NumMedia?: string;
  } | null {
    try {
      // Handle both URL-encoded and JSON payloads
      let payload: any;
      
      if (typeof body === 'string') {
        // Parse URL-encoded data
        const params = new URLSearchParams(body);
        payload = Object.fromEntries(params);
      } else {
        payload = body;
      }

      // Validate required fields
      if (!payload.MessageSid || !payload.From || !payload.To || !payload.Body) {
        logger.error('Invalid Twilio webhook payload: missing required fields');
        return null;
      }

      return {
        MessageSid: payload.MessageSid,
        From: this.formatPhoneNumber(payload.From),
        To: this.formatPhoneNumber(payload.To),
        Body: payload.Body,
        MessageStatus: payload.MessageStatus,
        AccountSid: payload.AccountSid,
        NumMedia: payload.NumMedia
      };
    } catch (error) {
      logger.error('Error parsing Twilio webhook payload:', error);
      return null;
    }
  }

  // SMS-specific helper methods
  async sendFilteredMessageToUser(
    userPhone: string, 
    originalMessage: string, 
    filteredMessage: string, 
    responseOptions: [string, string, string],
    userName?: string,
    exPartnerName?: string,
    context?: string | null
  ): Promise<string | null> {
    const smsText = this.formatFilteredMessageForSMS(
      originalMessage, 
      filteredMessage, 
      responseOptions, 
      userName, 
      exPartnerName,
      context
    );
    return this.sendSMS(userPhone, smsText);
  }

  async sendOutgoingMessageOptionsToClient(
    userPhone: string,
    originalMessage: string,
    messageOptions: [string, string, string],
    userName?: string,
    exPartnerName?: string
  ): Promise<string | null> {
    const smsText = this.formatOutgoingMessageOptionsForSMS(
      originalMessage,
      messageOptions,
      userName,
      exPartnerName
    );
    return this.sendSMS(userPhone, smsText);
  }

  async sendResponseToExPartner(
    exPartnerPhone: string, 
    response: string
  ): Promise<string | null> {
    return this.sendSMS(exPartnerPhone, response);
  }

  formatFilteredMessageForSMS(
    _originalMessage: string, 
    filteredMessage: string, 
    responseOptions: [string, string, string],
    userName?: string,
    exPartnerName?: string,
    context?: string | null
  ): string {
    // Create personalized greeting
    const greeting = userName ? `Hey ${userName}` : 'Hi';
    const sender = exPartnerName || 'your co-parent';
    
    // Create contextual message with WHY they're requesting this
    let contextualMessage: string;
    if (context) {
      const messageSummary = this.createMessageSummary(filteredMessage);
      contextualMessage = `${sender} ${messageSummary} because ${context}.`;
    } else {
      const messageSummary = this.createMessageSummary(filteredMessage);
      contextualMessage = `${sender} ${messageSummary}.`;
    }
    
    return `${greeting},

${contextualMessage}

Would you like to send any of these responses?

1. ${responseOptions[0]}
2. ${responseOptions[1]}
3. ${responseOptions[2]}

Reply with 1, 2, 3, or write your own response.`;
  }

  formatOutgoingMessageOptionsForSMS(
    _originalMessage: string,
    messageOptions: [string, string, string], 
    userName?: string,
    exPartnerName?: string
  ): string {
    // Create personalized greeting
    const greeting = userName ? `Hey ${userName}` : 'Hi';
    const recipient = exPartnerName || 'your co-parent';
    
    return `${greeting},

Here are 3 ways to send your message to ${recipient}:

1. ${messageOptions[0]}
2. ${messageOptions[1]}
3. ${messageOptions[2]}

Reply with 1, 2, 3, or write your own version.`;
  }

  private createMessageSummary(filteredMessage: string): string {
    // Convert filtered message into a conversational summary
    const message = filteredMessage.toLowerCase().trim();
    
    // Common patterns and their conversational equivalents
    if (message.includes('request') && message.includes('time')) {
      return 'is requesting a schedule change';
    } else if (message.includes('pickup') || message.includes('drop')) {
      return 'has a pickup/drop-off request';
    } else if (message.includes('school') || message.includes('activity')) {
      return 'sent information about school/activities';
    } else if (message.includes('health') || message.includes('medical')) {
      return 'shared health/medical information';
    } else if (message.includes('schedule') || message.includes('calendar')) {
      return 'wants to discuss scheduling';
    } else if (message.includes('need') || message.includes('want')) {
      return 'has a request';
    } else {
      return 'sent a message';
    }
  }

  async sendWelcomeMessage(userPhone: string): Promise<string | null> {
    const welcomeText = `Welcome to SafeTalk! 

To get started, reply with your ex-partner's phone number in this format: +1234567890

SafeTalk will filter all messages between you and help you communicate more effectively.`;
    
    return this.sendSMS(userPhone, welcomeText);
  }

  async sendSetupConfirmation(
    userPhone: string, 
    exPartnerPhone: string, 
    twilioNumber: string
  ): Promise<string | null> {
    const confirmationText = `SafeTalk Setup Complete! ✓

Your number: ${userPhone}
Ex-partner's number: ${exPartnerPhone}
SafeTalk service: ${twilioNumber}

Both of you should now text ${twilioNumber} to communicate through SafeTalk. All messages will be filtered for constructive co-parenting communication.`;
    
    return this.sendSMS(userPhone, confirmationText);
  }

  async sendErrorMessage(userPhone: string, errorMessage: string): Promise<string | null> {
    const errorText = `SafeTalk Error: ${errorMessage}

Please try again or contact support.`;
    
    return this.sendSMS(userPhone, errorText);
  }

  async sendInvalidResponseMessage(userPhone: string): Promise<string | null> {
    const errorText = `Invalid response. Please reply with:
- "1", "2", or "3" to select a response option
- Or type your own custom response

Your message will be sent after AI processing.`;
    
    return this.sendSMS(userPhone, errorText);
  }
}

export default new TwilioService();