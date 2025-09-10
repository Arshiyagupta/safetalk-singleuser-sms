import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { User, SMSUserSetupRequest } from '../shared/types';
import twilioService from './twilioService';

class UserService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key to bypass RLS
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase configuration missing');
      throw new Error('Supabase configuration required');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    logger.info('User service initialized with Supabase');
  }

  async findUserByPhoneNumber(phoneNumber: string): Promise<{
    user: User | null;
    isUserPhone: boolean;
  }> {
    try {
      const formattedPhone = twilioService.formatPhoneNumber(phoneNumber);
      
      // First check if it's the user's own phone number
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('phone_number', formattedPhone)
        .eq('is_active', true)
        .single();

      if (!userError && userData) {
        return {
          user: this.mapDatabaseToUser(userData),
          isUserPhone: true
        };
      }

      // Then check if it's an ex-partner's phone number
      const { data: exPartnerData, error: exPartnerError } = await this.supabase
        .from('users')
        .select('*')
        .eq('ex_partner_phone', formattedPhone)
        .eq('is_active', true)
        .single();

      if (!exPartnerError && exPartnerData) {
        return {
          user: this.mapDatabaseToUser(exPartnerData),
          isUserPhone: false
        };
      }

      return { user: null, isUserPhone: false };
    } catch (error) {
      logger.error('Error finding user by phone number:', error);
      return { user: null, isUserPhone: false };
    }
  }

  async createOrUpdateUser(request: SMSUserSetupRequest): Promise<User | null> {
    try {
      const { userPhone, exPartnerPhone, twilioNumber, userName, exPartnerName } = request;
      
      const formattedUserPhone = twilioService.formatPhoneNumber(userPhone);
      const formattedExPhone = twilioService.formatPhoneNumber(exPartnerPhone);
      const formattedTwilioNumber = twilioService.formatPhoneNumber(twilioNumber);

      // Check if user already exists
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('*')
        .eq('phone_number', formattedUserPhone)
        .single();

      let userData;
      
      if (existingUser) {
        // Update existing user
        const updateData: any = {
          ex_partner_phone: formattedExPhone,
          twilio_number: formattedTwilioNumber,
          is_active: true
        };
        
        // Only update names if provided
        if (userName) updateData.user_name = userName;
        if (exPartnerName) updateData.ex_partner_name = exPartnerName;
        
        const { data, error } = await this.supabase
          .from('users')
          .update(updateData)
          .eq('id', existingUser.id)
          .select()
          .single();

        if (error) throw error;
        userData = data;
        logger.info(`Updated existing user: ${formattedUserPhone}`);
      } else {
        // Create new user
        const insertData: any = {
          phone_number: formattedUserPhone,
          ex_partner_phone: formattedExPhone,
          twilio_number: formattedTwilioNumber,
          is_active: true
        };
        
        // Only include names if provided
        if (userName) insertData.user_name = userName;
        if (exPartnerName) insertData.ex_partner_name = exPartnerName;
        
        const { data, error } = await this.supabase
          .from('users')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;
        userData = data;
        logger.info(`Created new user: ${formattedUserPhone}`);
      }

      return this.mapDatabaseToUser(userData);
    } catch (error) {
      logger.error('Error creating/updating user:', error);
      return null;
    }
  }

  async deactivateUser(userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) throw error;
      
      logger.info(`Deactivated user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error deactivating user:', error);
      return false;
    }
  }

  async getUserStats(userId: string): Promise<{
    totalMessages: number;
    messagesThisWeek: number;
    lastActivity: string | null;
  } | null> {
    try {
      // Get total messages
      const { count: totalMessages } = await this.supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get messages from last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { count: messagesThisWeek } = await this.supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', weekAgo.toISOString());

      // Get last activity
      const { data: lastMessage } = await this.supabase
        .from('messages')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        totalMessages: totalMessages || 0,
        messagesThisWeek: messagesThisWeek || 0,
        lastActivity: lastMessage?.created_at || null
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      return null;
    }
  }

  async isValidPhonePair(userPhone: string, exPartnerPhone: string): Promise<boolean> {
    const formattedUserPhone = twilioService.formatPhoneNumber(userPhone);
    const formattedExPhone = twilioService.formatPhoneNumber(exPartnerPhone);

    // Check if phones are different
    if (formattedUserPhone === formattedExPhone) {
      return false;
    }

    // Check if phone numbers are valid
    if (!twilioService.isValidPhoneNumber(formattedUserPhone) || 
        !twilioService.isValidPhoneNumber(formattedExPhone)) {
      return false;
    }

    return true;
  }

  async setupNewUser(
    userPhone: string, 
    exPartnerPhone: string, 
    userName?: string,
    exPartnerName?: string
  ): Promise<{
    success: boolean;
    user?: User;
    error?: string;
  }> {
    try {
      // Validate phone numbers
      if (!this.isValidPhonePair(userPhone, exPartnerPhone)) {
        return {
          success: false,
          error: 'Invalid phone numbers. Please check the format and ensure they are different.'
        };
      }

      const twilioNumber = twilioService.getTwilioPhoneNumber();
      
      const user = await this.createOrUpdateUser({
        userPhone,
        exPartnerPhone,
        twilioNumber,
        userName,
        exPartnerName
      });

      if (!user) {
        return {
          success: false,
          error: 'Failed to create user account'
        };
      }

      // Send setup confirmation
      await twilioService.sendSetupConfirmation(userPhone, exPartnerPhone, twilioNumber, userName, exPartnerName);

      return {
        success: true,
        user
      };
    } catch (error) {
      logger.error('Error setting up new user:', error);
      return {
        success: false,
        error: 'Setup failed. Please try again.'
      };
    }
  }

  private mapDatabaseToUser(data: any): User {
    return {
      id: data.id,
      phoneNumber: data.phone_number,
      exPartnerPhone: data.ex_partner_phone,
      twilioNumber: data.twilio_number,
      createdAt: data.created_at,
      isActive: data.is_active,
      userName: data.user_name || undefined,
      exPartnerName: data.ex_partner_name || undefined
    };
  }
}

export default new UserService();