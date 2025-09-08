import { Router } from 'express';
import { 
  verifyPhone, 
  sendVerificationCode, 
  getUserProfile,
  updateUserProfile 
} from '../controllers/authController';

const router = Router();

// Send verification code to phone number
router.post('/send-code', sendVerificationCode);

// Verify phone number with code
router.post('/verify', verifyPhone);

// Get user profile
router.get('/profile/:userId', getUserProfile);

// Update user profile
router.put('/profile/:userId', updateUserProfile);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'auth',
    timestamp: new Date().toISOString() 
  });
});

export default router;