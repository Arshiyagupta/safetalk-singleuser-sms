# SafeTalk Deployment Guide

## Quick Setup Steps

### 1. Create Accounts (Required)

#### Supabase (Database)
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy your project URL and anon key
4. Run the SQL schema from `backend/database/schema.sql` in Supabase SQL editor

#### Twilio (SMS)
1. Go to [twilio.com](https://twilio.com)
2. Create account and buy a phone number (~$1)
3. Copy Account SID, Auth Token, and phone number

#### OpenAI (AI Processing)
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create API key
3. Add billing method (required for GPT-4)

### 2. Backend Deployment (Fly.io)

#### Update Environment Variables
Edit `backend/.env` with your API keys:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1your_number
OPENAI_API_KEY=your_openai_key
```

#### Deploy to Fly.io
```bash
cd backend

# Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
flyctl auth login

# Deploy (use existing app name from your setup)
flyctl deploy

# Add secrets to Fly.io
flyctl secrets set SUPABASE_URL="your_supabase_url"
flyctl secrets set SUPABASE_ANON_KEY="your_anon_key"
flyctl secrets set TWILIO_ACCOUNT_SID="your_sid"
flyctl secrets set TWILIO_AUTH_TOKEN="your_token"
flyctl secrets set TWILIO_PHONE_NUMBER="your_number"
flyctl secrets set OPENAI_API_KEY="your_openai_key"

# Check deployment
flyctl status
flyctl logs
```

#### Configure Twilio Webhook
1. Go to Twilio Console → Phone Numbers → Manage → Active numbers
2. Click your phone number
3. Set webhook URL to: `https://your-app-name.fly.dev/webhook/twilio/incoming`
4. Set HTTP method to POST
5. Save configuration

### 3. Mobile App Setup

#### Update API Endpoint
Edit `mobile/src/services/apiService.ts`:
```typescript
this.baseURL = __DEV__ 
  ? 'http://localhost:8080'  // Keep for development
  : 'https://your-app-name.fly.dev'; // Replace with your Fly.io URL
```

#### Install Dependencies
```bash
cd mobile
npm install

# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

## Testing the Complete Flow

### 1. Test Backend Health
```bash
curl https://your-app-name.fly.dev/health
```

### 2. Test SMS Reception
1. Have someone send SMS to your Twilio number
2. Check Fly.io logs: `flyctl logs`
3. Should see AI processing and message filtering

### 3. Test Mobile App
1. Open SafeTalk app
2. Enter your phone number (not the Twilio number)
3. Complete verification
4. Wait for messages from ex-partner
5. Select responses and send

## Architecture Overview

```
Ex-Partner → Twilio SMS → Fly.io Backend → AI Processing → Supabase Database
                                    ↓
Client Mobile App ← Real-time Updates ← Filtered Message + Response Options
                    ↓
Client Selects Response → Fly.io Backend → Twilio SMS → Ex-Partner
```

## Cost Estimate (Monthly)

- **Fly.io**: Free tier (3 VMs)
- **Supabase**: Free tier (500MB)
- **Twilio**: ~$1-2 (SMS usage)
- **OpenAI**: ~$5-10 (API calls)
- **Total**: ~$6-12/month

## Troubleshooting

### Backend Issues
```bash
# Check logs
flyctl logs

# Check app status
flyctl status

# Restart app
flyctl machine restart
```

### Webhook Not Working
1. Check Twilio webhook URL is correct
2. Verify Fly.io app is running
3. Test webhook endpoint manually:
```bash
curl -X POST https://your-app-name.fly.dev/webhook/twilio/incoming \
  -d "From=+1234567890&To=+1987654321&Body=Test message"
```

### Mobile App Issues
1. Check API base URL is correct
2. Verify backend is running
3. Check device logs in React Native debugger

### Database Issues
1. Verify Supabase SQL schema was applied
2. Check Row Level Security policies
3. Confirm environment variables are correct

## Next Steps (Optional Enhancements)

1. **Push Notifications**: Add Firebase for real-time message alerts
2. **Web Dashboard**: Create admin panel for monitoring conversations
3. **Advanced AI**: Add context awareness and learning capabilities
4. **Multi-language**: Support Spanish and other languages
5. **Voice Messages**: Add audio message filtering
6. **Calendar Integration**: Sync with co-parenting schedules

## Support

For issues:
1. Check Fly.io logs: `flyctl logs`
2. Test individual components (database, AI, SMS)
3. Verify all API keys are correctly set
4. Ensure webhook URL is properly configured

The app is now fully deployed and ready to mediate co-parenting communication!