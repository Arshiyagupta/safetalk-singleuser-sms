import { SMSResponseParseResult, ResponseOptions } from '../shared/types';
// Removed unused logger import
import twilioService from './twilioService';

export class SMSHelpers {
  
  // Parse user's SMS response to determine if they selected option 1, 2, 3, or typed custom response
  static parseUserResponse(responseText: string): SMSResponseParseResult {
    const trimmed = responseText.trim();
    
    // Check for option selection (1, 2, or 3)
    if (trimmed === '1' || trimmed === '2' || trimmed === '3') {
      return {
        isValidResponse: true,
        selectedOption: parseInt(trimmed),
      };
    }

    // Check for word-based responses (common alternatives)
    const lowerTrimmed = trimmed.toLowerCase();
    if (lowerTrimmed === 'one' || lowerTrimmed === 'first' || lowerTrimmed === 'option 1' || lowerTrimmed === 'option one') {
      return {
        isValidResponse: true,
        selectedOption: 1,
      };
    }

    if (lowerTrimmed === 'two' || lowerTrimmed === 'second' || lowerTrimmed === 'option 2' || lowerTrimmed === 'option two') {
      return {
        isValidResponse: true,
        selectedOption: 2,
      };
    }

    if (lowerTrimmed === 'three' || lowerTrimmed === 'third' || lowerTrimmed === 'option 3' || lowerTrimmed === 'option three') {
      return {
        isValidResponse: true,
        selectedOption: 3,
      };
    }

    // If not a number selection, treat as custom response
    if (trimmed.length > 0 && trimmed.length <= 500) {
      return {
        isValidResponse: true,
        customResponse: trimmed,
      };
    }

    // Invalid response
    return {
      isValidResponse: false,
      errorMessage: 'Response must be 1, 2, 3, or a custom message (max 500 characters)',
    };
  }

  // Extract response text from stored options based on user's selection
  static getSelectedResponseText(responseOptions: ResponseOptions, selectedOption: number): string | null {
    switch (selectedOption) {
      case 1:
        return responseOptions.option1;
      case 2:
        return responseOptions.option2;
      case 3:
        return responseOptions.option3;
      default:
        return null;
    }
  }

  // Check if a phone number looks like a setup message (contains another phone number)
  static parseSetupMessage(messageText: string): {
    isSetupMessage: boolean;
    exPartnerPhone?: string;
    userName?: string;
    exPartnerName?: string;
    error?: string;
  } {
    const trimmed = messageText.trim();
    
    // Look for phone number patterns
    const phoneRegex = /(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g;
    const phoneMatches = trimmed.match(phoneRegex);
    
    if (!phoneMatches || phoneMatches.length === 0) {
      return {
        isSetupMessage: false,
        error: 'No phone number found. Please provide your ex-partner\'s phone number in format: +1234567890'
      };
    }

    if (phoneMatches.length > 1) {
      return {
        isSetupMessage: false,
        error: 'Multiple phone numbers found. Please provide only one phone number.'
      };
    }

    const phoneNumber = phoneMatches[0];
    const formattedPhone = twilioService.formatPhoneNumber(phoneNumber);
    
    if (!twilioService.isValidPhoneNumber(formattedPhone)) {
      return {
        isSetupMessage: false,
        error: 'Invalid phone number format. Please use format: +1234567890'
      };
    }

    // Extract names if provided
    const { userName, exPartnerName } = this.extractNamesFromSetupMessage(trimmed, phoneNumber);

    return {
      isSetupMessage: true,
      exPartnerPhone: formattedPhone,
      userName: userName || undefined,
      exPartnerName: exPartnerName || undefined
    };
  }

  // Extract names from setup message (supports various formats)
  static extractNamesFromSetupMessage(messageText: string, phoneNumber: string): {
    userName?: string;
    exPartnerName?: string;
  } {
    // Remove the phone number from the message to get the text parts
    const textWithoutPhone = messageText.replace(phoneNumber, '').trim();
    
    // Handle various formats:
    // Format 1: "Sarah +1234567890 John" or "Sarah John +1234567890"
    // Format 2: "My name is Sarah, ex is John +1234567890" 
    // Format 3: "I'm Sarah, my ex John +1234567890"
    
    // Clean up common connector words and template labels
    const cleanText = textWithoutPhone
      .replace(/my name is|i'm|i am|my ex|ex is|ex:|ex-partner:|ex partner:|their name is/gi, ' ')
      .replace(/your name:|your co-parent's name:|your co-parent's number:|name:|co-parent name:|co-parent's name:|number:/gi, ' ')
      .replace(/[,;:\n\r]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // If no text left after cleaning, no names provided
    if (!cleanText) {
      return {};
    }
    
    // Split remaining words
    const words = cleanText.split(/\s+/).filter(word => 
      word.length > 1 && 
      !/^[+\d\s\-\(\)]+$/.test(word) && // Not phone number remnants
      !/^(and|is|the|my|ex|partner|name|your|co-parent|co|parent|number)$/i.test(word) // Not common connector words
    );
    
    // Extract names based on number of words
    let userName: string | undefined;
    let exPartnerName: string | undefined;
    
    if (words.length === 1) {
      // Only one name provided - assume it's the user's name
      userName = this.capitalizeFirstLetter(words[0]);
    } else if (words.length === 2) {
      // Two names - first is user, second is ex-partner
      userName = this.capitalizeFirstLetter(words[0]);
      exPartnerName = this.capitalizeFirstLetter(words[1]);
    } else if (words.length > 2) {
      // Multiple words - take first and last as names
      userName = this.capitalizeFirstLetter(words[0]);
      exPartnerName = this.capitalizeFirstLetter(words[words.length - 1]);
    }
    
    return { userName, exPartnerName };
  }

  // Helper method to capitalize first letter
  static capitalizeFirstLetter(name: string): string {
    if (!name) return name;
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  // Format message for SMS with proper line breaks and length limits
  static formatMessageForSMS(text: string, maxLength: number = 1600): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Truncate and add ellipsis
    return text.substring(0, maxLength - 3) + '...';
  }

  // Clean message text for processing (remove special characters, normalize whitespace)
  static cleanMessageText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters except basic punctuation
      .trim();
  }

  // Check if message contains only emojis or special characters (might need special handling)
  static isNonTextMessage(text: string): boolean {
    const cleanText = text.replace(/[\s\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '');
    return cleanText.length < 3;
  }

  // Generate help message for users
  static getHelpMessage(): string {
    return `SafeTalk Help:

How to use:
• Have your ex-partner text this number
• You'll receive filtered messages with 3 response options
• Reply with "1", "2", or "3" to select a response
• Or type your own custom response

Setup:
• Reply with your ex-partner's phone number: +1234567890

Commands:
• "help" - Show this message
• "status" - Show your account info
• "stop" - Pause SafeTalk service

Need more help? Visit safetalk.com/support`;
  }

  // Generate status message for users
  static getStatusMessage(
    userPhone: string, 
    exPartnerPhone: string, 
    totalMessages: number, 
    lastActivity: string | null
  ): string {
    const lastActivityText = lastActivity 
      ? new Date(lastActivity).toLocaleDateString()
      : 'No recent activity';

    return `SafeTalk Status:

Your number: ${userPhone}
Ex-partner: ${exPartnerPhone}
Total messages processed: ${totalMessages}
Last activity: ${lastActivityText}

Service is active and filtering messages.`;
  }

  // Check for special commands in user messages
  static parseSpecialCommands(messageText: string): {
    isCommand: boolean;
    command?: 'help' | 'status' | 'stop' | 'start';
  } {
    const trimmed = messageText.trim().toLowerCase();
    
    if (trimmed === 'help' || trimmed === '?') {
      return { isCommand: true, command: 'help' };
    }
    
    if (trimmed === 'status' || trimmed === 'info') {
      return { isCommand: true, command: 'status' };
    }
    
    if (trimmed === 'stop' || trimmed === 'pause' || trimmed === 'disable') {
      return { isCommand: true, command: 'stop' };
    }
    
    if (trimmed === 'start' || trimmed === 'resume' || trimmed === 'enable') {
      return { isCommand: true, command: 'start' };
    }
    
    return { isCommand: false };
  }

  // Validate message content before processing
  static validateMessageContent(text: string): {
    isValid: boolean;
    error?: string;
  } {
    if (!text || text.trim().length === 0) {
      return {
        isValid: false,
        error: 'Empty message'
      };
    }

    if (text.length > 1000) {
      return {
        isValid: false,
        error: 'Message too long (max 1000 characters)'
      };
    }

    if (this.isNonTextMessage(text)) {
      return {
        isValid: false,
        error: 'Message contains only emojis or special characters'
      };
    }

    return { isValid: true };
  }
}

export default SMSHelpers;