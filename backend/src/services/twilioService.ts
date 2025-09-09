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
    responseOptions: [string, string, string]
  ): Promise<string | null> {
    const smsText = this.formatFilteredMessageForSMS(originalMessage, filteredMessage, responseOptions);
    return this.sendSMS(userPhone, smsText);
  }

  async sendResponseToExPartner(
    exPartnerPhone: string, 
    response: string
  ): Promise<string | null> {
    return this.sendSMS(exPartnerPhone, response);
  }

  formatFilteredMessageForSMS(
    originalMessage: string, 
    filteredMessage: string, 
    responseOptions: [string, string, string]
  ): string {
    return `SafeTalk Message: ${filteredMessage}

Reply:
1. ${responseOptions[0]}
2. ${responseOptions[1]}
3. ${responseOptions[2]}

Or type your own response`;
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