export interface User {
  id: string;
  phoneNumber: string;
  exPartnerPhone: string;
  twilioNumber: string;
  createdAt: string;
  isActive: boolean;
  userName?: string;
  exPartnerName?: string;
  // Subscription fields
  stripeCustomerId?: string;
  subscriptionId?: string;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due';
  subscriptionStartedAt?: string;
  hasActivatedService?: boolean; // Both parties texted START
}

export interface Message {
  id: string;
  userId: string;
  fromNumber: string;
  toNumber: string;
  originalText: string;
  filteredText?: string;
  messageType: 'informational' | 'decision_making';
  direction: 'incoming' | 'outgoing';
  status: 'pending' | 'processing' | 'sent' | 'delivered' | 'failed';
  createdAt: string;
  twilioMessageId?: string;
}

export interface ResponseOptions {
  id: string;
  messageId: string;
  option1: string;
  option2: string;
  option3: string;
  selectedResponse?: string;
  customResponse?: string;
  createdAt: string;
}

export interface AIProcessingResult {
  filteredMessage: string;
  messageType: 'informational' | 'decision_making';
  responseOptions: [string, string, string];
  confidence: number;
  reasoning?: string;
  context?: string | null;
  messageOptions?: [string, string, string];
}

export interface TwilioWebhookPayload {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  MessageStatus?: string;
  AccountSid: string;
  NumMedia?: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface MessageCreateRequest {
  to: string;
  text: string;
}

export interface ResponseSelectRequest {
  messageId: string;
  selectedOption?: number;
  customResponse?: string;
}

// SMS-specific types
export interface SMSUserSetupRequest {
  userPhone: string;
  exPartnerPhone: string;
  twilioNumber: string;
  userName?: string;
  exPartnerName?: string;
}

export interface SMSResponseParseResult {
  isValidResponse: boolean;
  selectedOption?: number; // 1, 2, or 3
  customResponse?: string;
  errorMessage?: string;
}