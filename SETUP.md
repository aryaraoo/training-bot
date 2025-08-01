# Setup Guide

## Fixing the "Error fetching conversations" Issue

The error occurs because the Supabase environment variables are not configured. Follow these steps to fix it:

### 1. Create Environment File

Create a `.env.local` file in the root directory with the following content:

```bash
# Google Generative AI API Key (for Gemini model)
# Get this from: https://makersuite.google.com/app/apikey
GOOGLE_GENERATIVE_AI_API_KEY=your_google_generative_ai_api_key_here

# Google Text-to-Speech API Key
# Get this from: https://console.cloud.google.com/
GOOGLE_TTS_API_KEY=your_google_tts_api_key_here

# Supabase Configuration (optional - for conversation history)
# Get this from your Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 2. Get API Keys

#### Google Generative AI API Key:
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key to `GOOGLE_GENERATIVE_AI_API_KEY`

#### Google Text-to-Speech API Key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Text-to-Speech API
3. Create credentials (API key)
4. Copy the key to `GOOGLE_TTS_API_KEY`

#### Supabase (Optional):
1. Go to your Supabase project dashboard
2. Go to Settings > API
3. Copy the URL to `NEXT_PUBLIC_SUPABASE_URL`
4. Copy the anon key to `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Restart Development Server

After adding the environment variables, restart your development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

## Fixing AI Reading Punctuation Marks

The AI will no longer read out punctuation marks like colons (:), asterisks (*), commas (,), etc. The text processing utility automatically removes these before sending to the text-to-speech service.

## Troubleshooting

### If you still see the conversation error:
1. Check that your `.env.local` file is in the root directory
2. Verify that the environment variables are correctly set
3. Restart your development server
4. Check the browser console for more specific error messages

### If the AI still reads punctuation:
1. The text processing should automatically handle this
2. Check that the latest code changes are deployed
3. Clear your browser cache and restart the development server 