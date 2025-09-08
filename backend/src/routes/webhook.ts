import { Router } from 'express';
import { handleIncomingSMS, handleStatusUpdate } from '../controllers/twilioController';

const router = Router();

// Twilio webhook endpoints
router.post('/twilio/incoming', handleIncomingSMS);
router.post('/twilio/status', handleStatusUpdate);

// Health check for webhook
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'webhook',
    timestamp: new Date().toISOString() 
  });
});

export default router;