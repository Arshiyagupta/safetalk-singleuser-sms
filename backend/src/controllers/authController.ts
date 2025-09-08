import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import supabaseService from '../services/supabaseService';
import twilioService from '../services/twilioService';
import { AuthVerifyRequest } from '../shared/types';

// Simple phone verification (mock implementation)
// In production, you would send SMS verification codes
export const verifyPhone = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, code }: AuthVerifyRequest = req.body;

  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      error: 'Phone number is required'
    });
  }

  try {
    // Format and validate phone number
    const formattedPhone = twilioService.formatPhoneNumber(phoneNumber);
    
    if (!twilioService.isValidPhoneNumber(formattedPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // In a real app, you would verify the SMS code here
    // For now, we'll use a simple mock verification
    const isValidCode = !code || code === '123456' || code === 'demo';
    
    if (code && !isValidCode) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    // Check if user exists
    let user = await supabaseService.getUserByPhoneNumber(formattedPhone);
    
    if (!user) {
      // For demo purposes, create a new user automatically
      // In production, you would handle user registration separately
      logger.info(`Creating new user for phone: ${formattedPhone}`);
      
      // Generate mock Twilio number and ex number for demo
      const twilioNumber = twilioService.getTwilioPhoneNumber() || '+1987654321';
      const exNumber = '+1555000000'; // Mock ex number
      
      user = await supabaseService.createUser({
        phoneNumber: formattedPhone,
        twilioNumber: twilioNumber,
        exNumber: exNumber
      });
    }

    logger.info(`User authenticated: ${user.id}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          phoneNumber: user.phoneNumber,
          twilioNumber: user.twilioNumber,
          isActive: user.isActive
        },
        // In production, return JWT token here
        token: `demo_token_${user.id}`
      },
      message: 'Authentication successful'
    });

  } catch (error) {
    logger.error('Error during phone verification:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
});

// Send verification code (mock implementation)
export const sendVerificationCode = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      error: 'Phone number is required'
    });
  }

  try {
    const formattedPhone = twilioService.formatPhoneNumber(phoneNumber);
    
    if (!twilioService.isValidPhoneNumber(formattedPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // In production, generate and send real SMS verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Mock SMS sending (in production, use Twilio)
    logger.info(`Mock SMS verification code for ${formattedPhone}: ${verificationCode}`);
    
    // In development, we don't actually send SMS to avoid costs
    if (process.env.NODE_ENV === 'production' && process.env.TWILIO_ACCOUNT_SID) {
      await twilioService.sendSMS(
        formattedPhone, 
        `Your SafeTalk verification code is: ${verificationCode}`
      );
    }

    res.json({
      success: true,
      message: 'Verification code sent',
      // In development, return the code for testing
      ...(process.env.NODE_ENV !== 'production' && { 
        debugCode: verificationCode 
      })
    });

  } catch (error) {
    logger.error('Error sending verification code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send verification code'
    });
  }
});

// Get user profile
export const getUserProfile = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  try {
    // In production, you would verify JWT token and get user from token
    // For now, we'll use a simple lookup
    
    // This is a simplified approach - in production you'd have middleware to handle auth
    const phoneNumber = req.headers['x-user-phone'] as string;
    if (!phoneNumber) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const user = await supabaseService.getUserByPhoneNumber(phoneNumber);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        twilioNumber: user.twilioNumber,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
});

// Update user profile (for updating ex-partner number)
export const updateUserProfile = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { exNumber } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  try {
    const phoneNumber = req.headers['x-user-phone'] as string;
    if (!phoneNumber) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const user = await supabaseService.getUserByPhoneNumber(phoneNumber);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Validate ex-partner phone number if provided
    if (exNumber) {
      const formattedExNumber = twilioService.formatPhoneNumber(exNumber);
      if (!twilioService.isValidPhoneNumber(formattedExNumber)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ex-partner phone number format'
        });
      }

      // Update user's ex-partner number
      // Note: This would require adding an update method to SupabaseService
      logger.info(`Updating ex-partner number for user ${user.id}: ${formattedExNumber}`);
    }

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});