# SafeTalk SMS Service

A co-parenting communication service that filters messages through AI and provides response options via SMS.

## How It Works

1. **Ex-partner texts SafeTalk number** → AI filters message → **Clean message sent to you**
2. **You reply with "1", "2", "3"** → **Response sent to ex-partner**

No app downloads required - works with any phone via SMS.

## Setup

### 1. Database Setup (Supabase)

1. Create a new Supabase project
2. Run the SQL in `database-schema.sql` to create tables
3. Get your project URL and service key

### 2. Twilio Setup (SMS)

1. Create Twilio account
2. Buy a phone number
3. Configure webhook: `https://yourapp.com/webhook/sms`
4. Get Account SID and Auth Token

### 3. OpenAI Setup (AI)

1. Get OpenAI API key
2. Ensure GPT-4 access (or use GPT-3.5)

### 4. Environment Configuration

1. Copy `.env.example` to `.env`
2. Fill in your credentials:

```bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1555XXXXXXX

# OpenAI  
OPENAI_API_KEY=sk-xxxxx

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=xxxxx
```

### 5. Deploy & Run

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production
npm run build
npm start
```

## Usage

### For Users:

1. **Setup**: Text the SafeTalk number with your ex-partner's phone number: `+1234567890`
2. **Receive filtered messages**: When ex-partner texts, you get clean version with 3 response options
3. **Reply**: Text "1", "2", "3" to select response, or type custom message
4. **Commands**: Text "help", "status", "stop" for special functions

### Example Flow:

**Ex-partner sends:** "You're always late picking up the kids! This is unacceptable!"

**You receive:** 
```
SafeTalk Message: Request for on-time pickup for children.

Reply:
1. I'll make sure to be on time going forward.  
2. I apologize for the delays. Let me know the preferred pickup time.
3. I understand your concern. Can we discuss a consistent schedule?

Or type your own response
```

**You reply:** `2`

**Ex-partner receives:** "I apologize for the delays. Let me know the preferred pickup time."

## Features

- ✅ AI message filtering (removes hostility, keeps facts)
- ✅ 3 response options generated for each message  
- ✅ Custom response option
- ✅ Works on any phone (iPhone, Android, flip phones)
- ✅ No app downloads required
- ✅ Simple setup via SMS
- ✅ Help and status commands
- ✅ Message history stored in database

## Architecture

```
Ex-partner SMS → Twilio → Your Backend → AI Processing → SMS to You
You SMS Reply → Twilio → Your Backend → Response to Ex-partner
```

## Deployment Options

### Render.com (Recommended - Free)
1. Connect GitHub repo to Render
2. Create new Web Service  
3. Set environment variables in dashboard
4. Deploy automatically
5. Set up UptimeRobot for keep-alive (prevents sleeping)

### Railway (Alternative - $5 free credits)
1. Connect GitHub repo to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically

### Heroku
1. Create Heroku app
2. Set config vars in dashboard
3. Deploy via Git

## Costs

- **Twilio**: ~$0.0075 per SMS (both directions)
- **OpenAI**: ~$0.03 per GPT-4 message 
- **Supabase**: Free tier (10GB storage, 500MB database)
- **Hosting**: Render.com free tier, Railway $5 free credits

**Example**: 100 messages/month = ~$3-5 total

## Support Commands

Text these to your SafeTalk number:

- `help` - Show usage instructions
- `status` - Show account info and message count  
- `stop` - Pause SafeTalk service
- `start` - Resume SafeTalk service

## Security

- Webhook signature validation in production
- Phone number validation
- Message length limits
- SQL injection protection
- Rate limiting (optional)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm test
```

## Troubleshooting

### Messages not being received?
- Check Twilio webhook URL is correct
- Verify phone numbers are formatted correctly (+1XXXXXXXXXX)
- Check server logs for errors

### AI not working?
- Verify OpenAI API key is valid
- Check API usage limits
- Review server logs for AI processing errors

### Database issues?
- Confirm Supabase credentials are correct
- Check database schema was created properly
- Verify service key has proper permissions

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

Private License - SafeTalk Team