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
}

export default new TwilioService();