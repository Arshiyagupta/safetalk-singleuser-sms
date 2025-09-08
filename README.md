# SafeTalk - Co-Parenting Communication Mediation App

SafeTalk is a single-user mobile app that uses AI to mediate communication between co-parents, filtering harmful language and providing constructive response options.

## Project Structure

```
SafeTalk_App/
├── backend/          # Node.js + Express + TypeScript API server
├── mobile/           # React Native cross-platform app
├── shared/           # Common TypeScript types
└── README.md
```

## Features

- **AI Message Filtering**: Removes harmful language, keeps facts
- **Smart Response Generation**: Provides 3 contextual response options
- **Twilio SMS Integration**: Seamless message routing
- **Real-time Updates**: Instant message delivery via Supabase
- **Cross-Platform**: Single codebase for iOS and Android

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Supabase
- **Mobile**: React Native, TypeScript
- **AI**: OpenAI GPT-4
- **SMS**: Twilio Programmable SMS
- **Hosting**: Fly.io (backend), Expo (mobile)

## Setup Instructions

### Prerequisites
- Node.js 18+
- React Native CLI or Expo CLI
- Accounts: Supabase, Twilio, OpenAI, Fly.io

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Add your API keys to .env
npm run dev
```

### Mobile Setup
```bash
cd mobile
npm install
npx react-native run-ios    # or run-android
```

### Deployment
```bash
# Backend to Fly.io
cd backend
flyctl deploy

# Mobile to app stores
cd mobile
npx eas build --platform all
```

## API Keys Required

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `TWILIO_ACCOUNT_SID` - Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Twilio Auth Token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `OPENAI_API_KEY` - OpenAI API key

## License

Private - All rights reserved