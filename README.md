# SafeTalk - Co-Parenting Communication Mediation App

SafeTalk is a single-user mobile app that uses AI to mediate communication between co-parents, filtering harmful language and providing constructive response options.

## Project Structure

```
SafeTalk_App/
├── backend/          # Node.js SMS webhook service
├── shared/           # Common TypeScript types  
└── README.md
```

## Features

- **SMS-Only Service**: No app downloads required, works on any phone
- **AI Message Filtering**: Removes harmful language, keeps facts
- **Smart Response Generation**: Provides 3 contextual response options
- **Twilio SMS Integration**: Seamless bidirectional SMS routing
- **Universal Compatibility**: Works on iPhone, Android, and flip phones
- **Simple Setup**: Text-based onboarding and commands

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Supabase
- **AI**: OpenAI GPT-4
- **SMS**: Twilio Programmable SMS
- **Hosting**: Render.com (free tier recommended)

## Setup Instructions

### Prerequisites
- Node.js 18+
- Accounts: Supabase, Twilio, OpenAI, Render.com

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Add your API keys to .env
npm run dev
```

### Deployment to Render.com (Free)
1. Connect your GitHub repo to Render.com
2. Create a new Web Service
3. Set environment variables in Render dashboard
4. Deploy automatically
5. Set up UptimeRobot for keep-alive monitoring

See `SMS_README.md` for detailed SMS-only setup instructions.

## API Keys Required

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `TWILIO_ACCOUNT_SID` - Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Twilio Auth Token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `OPENAI_API_KEY` - OpenAI API key

## License

Private - All rights reserved