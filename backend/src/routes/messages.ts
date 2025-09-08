import { Router } from 'express';
import { 
  getUserMessages, 
  getMessage, 
  sendResponse, 
  getResponseOptions,
  getConversationSummary 
} from '../controllers/messageController';
import { sendResponseSMS } from '../controllers/twilioController';

const router = Router();

// Get messages for a user
router.get('/user/:userId', getUserMessages);

// Get conversation summary for a user
router.get('/user/:userId/summary', getConversationSummary);

// Get a specific message with response options
router.get('/:messageId', getMessage);

// Get response options for a message
router.get('/:messageId/options', getResponseOptions);

// Send a response to ex-partner
router.post('/:messageId/respond', sendResponse);

// Alternative endpoint for sending SMS responses (legacy support)
router.post('/send-response', sendResponseSMS);

// Health check
router.get('/', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'messages',
    timestamp: new Date().toISOString() 
  });
});

export default router;