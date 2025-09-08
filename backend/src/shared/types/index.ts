export interface User {
  id: string;
  phoneNumber: string;
  twilioNumber: string;
  exNumber: string;
  createdAt: string;
  isActive: boolean;
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

export interface AuthVerifyRequest {
  phoneNumber: string;
  code: string;
}

export interface ChatColors {
  outgoingMessage: string;
  incomingMessage: string;
  chatBackground: string;
  inputBackground: string;
  inputBorder: string;
  messageText: string;
  timestampText: string;
  sendButton: string;
}

export interface ConversationSummary {
  userId: string;
  totalMessages: number;
  lastMessageAt: string;
  unreadCount: number;
  recentMessages: Message[];
}