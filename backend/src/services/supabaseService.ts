import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { User, Message, ResponseOptions } from '../shared/types';

class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    logger.info('Supabase client initialized');
  }

  // User operations
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'isActive'>): Promise<User> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .insert({
          phone_number: userData.phoneNumber,
          twilio_number: userData.twilioNumber,
          ex_number: userData.exPartnerPhone,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      
      return this.mapUserFromDB(data);
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows returned
        throw error;
      }

      return this.mapUserFromDB(data);
    } catch (error) {
      logger.error('Error fetching user:', error);
      throw error;
    }
  }

  async getUserByTwilioNumber(twilioNumber: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('twilio_number', twilioNumber)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapUserFromDB(data);
    } catch (error) {
      logger.error('Error fetching user by Twilio number:', error);
      throw error;
    }
  }

  // Message operations
  async createMessage(messageData: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .insert({
          user_id: messageData.userId,
          from_number: messageData.fromNumber,
          to_number: messageData.toNumber,
          original_text: messageData.originalText,
          filtered_text: messageData.filteredText,
          message_type: messageData.messageType,
          direction: messageData.direction,
          status: messageData.status,
          twilio_message_id: messageData.twilioMessageId
        })
        .select()
        .single();

      if (error) throw error;
      
      return this.mapMessageFromDB(data);
    } catch (error) {
      logger.error('Error creating message:', error);
      throw error;
    }
  }

  async updateMessageStatus(messageId: string, status: Message['status'], twilioMessageId?: string): Promise<void> {
    try {
      const updateData: any = { status };
      if (twilioMessageId) updateData.twilio_message_id = twilioMessageId;

      const { error } = await this.supabase
        .from('messages')
        .update(updateData)
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      logger.error('Error updating message status:', error);
      throw error;
    }
  }

  async getMessagesByUser(userId: string, limit = 50): Promise<Message[]> {
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      return data.map(this.mapMessageFromDB);
    } catch (error) {
      logger.error('Error fetching messages:', error);
      throw error;
    }
  }

  async getMessage(messageId: string): Promise<Message | null> {
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapMessageFromDB(data);
    } catch (error) {
      logger.error('Error fetching message:', error);
      throw error;
    }
  }

  // Response options operations
  async createResponseOptions(optionsData: Omit<ResponseOptions, 'id' | 'createdAt'>): Promise<ResponseOptions> {
    try {
      const { data, error } = await this.supabase
        .from('response_options')
        .insert({
          message_id: optionsData.messageId,
          option_1: optionsData.option1,
          option_2: optionsData.option2,
          option_3: optionsData.option3,
          selected_response: optionsData.selectedResponse,
          custom_response: optionsData.customResponse
        })
        .select()
        .single();

      if (error) throw error;
      
      return this.mapResponseOptionsFromDB(data);
    } catch (error) {
      logger.error('Error creating response options:', error);
      throw error;
    }
  }

  async updateResponseSelection(messageId: string, selectedResponse: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('response_options')
        .update({ selected_response: selectedResponse })
        .eq('message_id', messageId);

      if (error) throw error;
    } catch (error) {
      logger.error('Error updating response selection:', error);
      throw error;
    }
  }

  async getResponseOptions(messageId: string): Promise<ResponseOptions | null> {
    try {
      const { data, error } = await this.supabase
        .from('response_options')
        .select('*')
        .eq('message_id', messageId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapResponseOptionsFromDB(data);
    } catch (error) {
      logger.error('Error fetching response options:', error);
      throw error;
    }
  }

  // Helper methods to map database fields to TypeScript interfaces
  private mapUserFromDB(data: any): User {
    return {
      id: data.id,
      phoneNumber: data.phone_number,
      twilioNumber: data.twilio_number,
      exPartnerPhone: data.ex_number,
      createdAt: data.created_at,
      isActive: data.is_active
    };
  }

  private mapMessageFromDB(data: any): Message {
    return {
      id: data.id,
      userId: data.user_id,
      fromNumber: data.from_number,
      toNumber: data.to_number,
      originalText: data.original_text,
      filteredText: data.filtered_text,
      messageType: data.message_type,
      direction: data.direction,
      status: data.status,
      createdAt: data.created_at,
      twilioMessageId: data.twilio_message_id
    };
  }

  private mapResponseOptionsFromDB(data: any): ResponseOptions {
    return {
      id: data.id,
      messageId: data.message_id,
      option1: data.option_1,
      option2: data.option_2,
      option3: data.option_3,
      selectedResponse: data.selected_response,
      customResponse: data.custom_response,
      createdAt: data.created_at
    };
  }
}

export default new SupabaseService();