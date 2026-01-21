# Google Gemini API Setup Guide

This guide walks you through setting up Google Gemini AI API for the GIMS Task Management System.

---

## Table of Contents

1. [Create Google Cloud Account](#step-1-create-google-cloud-account)
2. [Get Gemini API Key](#step-2-get-gemini-api-key)
3. [Configure in GIMS](#step-3-configure-in-gims)
4. [Test the API](#step-4-test-the-api)
5. [Pricing & Limits](#pricing--limits)

---

## Step 1: Create Google Cloud Account

### Option A: Using Google AI Studio (Recommended for Development)

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Accept terms of service

### Option B: Using Google Cloud Console (For Production)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable billing (required for production usage)

---

## Step 2: Get Gemini API Key

### Using Google AI Studio (Easiest)

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click **"Get API Key"** in the left sidebar
3. Click **"Create API Key"**
4. Select a project (or create new)
5. Copy the generated API key

**Your API key will look like:**
```
AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Using Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services > Credentials**
3. Click **"+ CREATE CREDENTIALS"** > **"API Key"**
4. Copy the API key
5. (Optional) Restrict the API key to specific APIs

---

## Step 3: Configure in GIMS

### Update `.env` file

Open `backend/.env` and add:

```bash
# Google Gemini AI
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Verify Configuration

The GIMS backend uses the key in `src/services/gemini.service.ts`:
- Audio transcription (Marathi/Hindi/English)
- Task data extraction
- Category classification
- Response generation in user's language

---

## Step 4: Test the API

### Quick Test via Terminal

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{"text": "Say hello in Marathi"}]
    }]
  }'
```

### Expected Response

```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "नमस्कार (Namaskār)"
      }]
    }
  }]
}
```

### Test in GIMS Backend

Once backend is running, the Gemini service is used automatically when:
1. Voice messages arrive via WhatsApp (transcription)
2. Text messages need categorization
3. Response messages are generated

---

## Pricing & Limits

### Free Tier (Google AI Studio)

| Model | Free Requests/Minute | Free Requests/Day |
|-------|---------------------|-------------------|
| Gemini 1.5 Flash | 15 | 1,500 |
| Gemini 1.5 Pro | 2 | 50 |

### Paid Pricing (as of 2024)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Gemini 1.5 Flash | $0.075 | $0.30 |
| Gemini 1.5 Pro | $3.50 | $10.50 |

### Estimated Cost for GIMS

For 4 supervisors sending ~20 messages/day:
- ~80 messages/day
- ~2,400 messages/month
- **Estimated cost: INR 20-50/month** (well within free tier for development)

---

## Model Selection

GIMS uses **Gemini 1.5 Flash** by default:

```typescript
// In gemini.service.ts
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
```

**Why Flash?**
- Faster response times
- Lower cost
- Sufficient for task extraction and categorization
- Good multilingual support (Marathi/Hindi/English)

---

## Troubleshooting

### "API Key not valid" Error

**Solutions:**
1. Check for typos in the API key
2. Ensure no extra spaces or newlines
3. Regenerate key if compromised
4. Check if key is restricted to wrong APIs

### "Quota exceeded" Error

**Solutions:**
1. Wait for quota reset (resets daily)
2. Upgrade to paid tier
3. Implement rate limiting in your code
4. Use caching for repeated requests

### "Model not found" Error

**Solutions:**
1. Check model name spelling
2. Use `gemini-1.5-flash` (not `gemini-flash`)
3. Verify API is enabled for your project

### Audio Transcription Not Working

**Checklist:**
1. Audio file format supported (mp3, wav, ogg)
2. File size under 20MB
3. Audio duration under 1 hour
4. API key has required permissions

---

## Security Best Practices

1. **Never commit API keys to git**
   ```bash
   # .gitignore should have:
   .env
   ```

2. **Use environment variables**
   ```bash
   # Not this:
   const apiKey = "AIzaSy...";

   # Use this:
   const apiKey = process.env.GEMINI_API_KEY;
   ```

3. **Restrict API key** (in Google Cloud Console)
   - Restrict to Gemini API only
   - Add IP restrictions for production

4. **Monitor usage**
   - Check Google Cloud Console for unusual activity
   - Set up billing alerts

---

## Useful Links

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Supported Audio Formats](https://ai.google.dev/gemini-api/docs/audio)
