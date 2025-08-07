# Next.js chatbot webpage

*Automatically synced with your [v0.dev](https://v0.dev) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/sumiths-projects-be9ca28e/v0-next-js-chatbot-webpage)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/m74FD1X4OFy)

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Setup Instructions

To fix the 500 Internal Server Error, you need to set up the required API keys:

1. Create a `.env.local` file in the root directory
2. Add the following environment variables:

```bash
# Google Generative AI API Key (for Gemini model)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_generative_ai_api_key_here

# Google Text-to-Speech API Key
GOOGLE_TTS_API_KEY=your_google_tts_api_key_here

# Supabase Configuration (if using)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### Getting API Keys:

1. **Google Generative AI API Key**: 
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key to `GOOGLE_GENERATIVE_AI_API_KEY`

2. **Google Text-to-Speech API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable the Text-to-Speech API
   - Create credentials (API key)
   - Copy the key to `GOOGLE_TTS_API_KEY`

3. Restart your development server after adding the environment variables

## Deployment

Your project is live at:
(https://training-bot-gray.vercel.app/)

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/m74FD1X4OFy](https://v0.dev/chat/projects/m74FD1X4OFy)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository
