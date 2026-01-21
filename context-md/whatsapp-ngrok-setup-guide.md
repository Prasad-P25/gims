# WhatsApp Business API + Ngrok Setup Guide

This guide walks you through setting up Meta WhatsApp Business API and ngrok for local development of the GIMS Task Management System.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part 1: Meta Developer Account Setup](#part-1-meta-developer-account-setup)
3. [Part 2: WhatsApp Business API Configuration](#part-2-whatsapp-business-api-configuration)
4. [Part 3: Ngrok Setup for Local Webhooks](#part-3-ngrok-setup-for-local-webhooks)
5. [Part 4: Connect Webhook to Meta](#part-4-connect-webhook-to-meta)
6. [Part 5: Testing the Integration](#part-5-testing-the-integration)
7. [Part 6: Update .env File](#part-6-update-env-file)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:
- [ ] A Facebook account
- [ ] A phone number that can receive SMS (for WhatsApp Business verification)
- [ ] Node.js installed locally
- [ ] The GIMS backend running locally on port 3000

---

## Part 1: Meta Developer Account Setup

### Step 1.1: Create Meta Developer Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **"Get Started"** (top right)
3. Log in with your Facebook account
4. Accept the Meta Platform Terms
5. Verify your account (email/phone verification)

### Step 1.2: Create a New App

1. Go to [My Apps](https://developers.facebook.com/apps/)
2. Click **"Create App"**
3. Select **"Other"** for use case, click Next
4. Select **"Business"** as app type, click Next
5. Fill in details:
   - **App Name:** `GIMS Task Registry`
   - **App Contact Email:** your email
   - **Business Account:** Create new or select existing
6. Click **"Create App"**

### Step 1.3: Add WhatsApp Product

1. On your app dashboard, scroll to **"Add products to your app"**
2. Find **"WhatsApp"** and click **"Set up"**
3. You'll be redirected to WhatsApp Getting Started page

---

## Part 2: WhatsApp Business API Configuration

### Step 2.1: Get Test Phone Number (Free Tier)

Meta provides a **free test phone number** for development:

1. In your app, go to **WhatsApp > API Setup**
2. You'll see a section called **"Send and receive messages"**
3. Note down:
   - **Phone number ID:** (e.g., `1234567890123456`)
   - **WhatsApp Business Account ID:** (e.g., `9876543210987654`)

### Step 2.2: Generate Access Token

1. On the same **API Setup** page
2. Find **"Temporary access token"** section
3. Click **"Generate"** to create a temporary token
4. Copy this token (valid for 24 hours)

**For Production (Permanent Token):**
1. Go to **Business Settings** > **System Users**
2. Create a System User with Admin role
3. Generate a permanent token with `whatsapp_business_messaging` permission

### Step 2.3: Add Test Phone Numbers

For testing, you need to add phone numbers that can receive messages:

1. In **WhatsApp > API Setup**
2. Scroll to **"To"** field dropdown
3. Click **"Manage phone number list"**
4. Click **"Add phone number"**
5. Enter your phone number (with country code, e.g., +91XXXXXXXXXX)
6. You'll receive a verification code via WhatsApp
7. Enter the code to verify

**Note:** Free tier allows up to 5 test phone numbers.

### Step 2.4: Create Verify Token

Create your own verify token (any random string):

```
Example: gims_webhook_verify_token_2024
```

You'll use this when configuring the webhook. Save it somewhere.

---

## Part 3: Ngrok Setup for Local Webhooks

Ngrok creates a public URL that tunnels to your local server, allowing Meta to send webhooks to your development machine.

### Step 3.1: Create Ngrok Account

1. Go to [ngrok.com](https://ngrok.com/)
2. Click **"Sign up"** (free tier is sufficient)
3. Verify your email

### Step 3.2: Install Ngrok

**macOS (using Homebrew):**
```bash
brew install ngrok
```

**Or download directly:**
```bash
# Download from https://ngrok.com/download
# Unzip and move to a directory in your PATH
```

### Step 3.3: Authenticate Ngrok

1. Go to [ngrok Dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
2. Copy your **Authtoken**
3. Run in terminal:

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### Step 3.4: Start Ngrok Tunnel

Start your GIMS backend first (on port 3000), then:

```bash
ngrok http 3000
```

You'll see output like:

```
Session Status                online
Account                       your-email@example.com
Version                       3.x.x
Region                        India (in)
Forwarding                    https://abc123xyz.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123xyz.ngrok-free.app`)

**Important:**
- Keep this terminal running while testing
- The URL changes every time you restart ngrok (unless you have a paid plan)
- You'll need to update Meta webhook URL when ngrok restarts

---

## Part 4: Connect Webhook to Meta

### Step 4.1: Configure Webhook in Meta

1. Go to your app in [Meta Developer Dashboard](https://developers.facebook.com/apps/)
2. Navigate to **WhatsApp > Configuration**
3. Find **"Webhook"** section
4. Click **"Edit"**

5. Enter these values:
   - **Callback URL:** `https://YOUR-NGROK-URL/api/webhook/whatsapp`
     - Example: `https://abc123xyz.ngrok-free.app/api/webhook/whatsapp`
   - **Verify Token:** The token you created in Step 2.4
     - Example: `gims_webhook_verify_token_2024`

6. Click **"Verify and Save"**

### Step 4.2: Subscribe to Webhook Fields

After verification succeeds:

1. In the **"Webhook fields"** section
2. Click **"Manage"**
3. Subscribe to these fields:
   - [x] `messages` - To receive incoming messages
   - [x] `message_template_status_update` - For template status (optional)

4. Click **"Done"**

### Step 4.3: Verify Webhook is Working

Check your backend terminal. When Meta verifies the webhook, you should see a GET request to `/api/webhook/whatsapp` with the challenge parameter.

---

## Part 5: Testing the Integration

### Step 5.1: Send a Test Message

1. Open WhatsApp on your phone (the number you verified in Step 2.3)
2. Add the Meta test number to your contacts
3. Send a message: `Hello GIMS`

### Step 5.2: Check Backend Logs

In your backend terminal, you should see:
- Incoming webhook POST request
- Message content logged
- Processing started

### Step 5.3: Verify Response

If everything is configured correctly:
- The message is processed by Gemini AI
- A confirmation message is sent back to your WhatsApp

---

## Part 6: Update .env File

Update your `backend/.env` file with all the credentials:

```bash
# WhatsApp Business API (Meta Cloud API)
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_from_step_2.1
WHATSAPP_ACCESS_TOKEN=your_access_token_from_step_2.2
WHATSAPP_VERIFY_TOKEN=your_verify_token_from_step_2.4
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_from_step_2.1
```

### Example with placeholders filled:

```bash
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=1234567890123456
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_VERIFY_TOKEN=gims_webhook_verify_token_2024
WHATSAPP_BUSINESS_ACCOUNT_ID=9876543210987654
```

---

## Troubleshooting

### Webhook Verification Fails

**Error:** "The callback URL or verify token couldn't be validated"

**Solutions:**
1. Ensure your backend is running (`npm run dev`)
2. Ensure ngrok is running and URL is correct
3. Check that verify token matches exactly in both places
4. Check backend logs for errors

### Messages Not Being Received

**Checklist:**
1. Is ngrok running? Check the terminal
2. Is the backend running? Check for errors
3. Did you subscribe to `messages` webhook field?
4. Is your phone number in the test numbers list?
5. Check if webhook URL was updated after ngrok restart

### "Access Token Expired" Error

**Solution:**
- Temporary tokens expire in 24 hours
- Generate a new token from API Setup page
- Update `.env` file
- Restart backend

### Ngrok URL Changed

**Solution:**
1. Copy new ngrok URL
2. Go to Meta > WhatsApp > Configuration
3. Edit webhook
4. Update Callback URL with new ngrok URL
5. Verify and Save

### Rate Limits

**Free Tier Limits:**
- 1,000 free conversations per month
- 5 test phone numbers
- Messages can only be sent to verified numbers

---

## Quick Reference Commands

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Start backend (Terminal 1)
cd backend
npm run dev

# Start ngrok tunnel (Terminal 2)
ngrok http 3000

# Start frontend (Terminal 3)
cd frontend
npm run dev
```

---

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│   WhatsApp      │────▶│   Meta Cloud     │────▶│   Ngrok Tunnel  │
│   (Supervisor)  │     │   API            │     │   (Public URL)  │
│                 │◀────│                  │◀────│                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                               ┌─────────────────┐
                                               │                 │
                                               │  Local Backend  │
                                               │  (Port 3000)    │
                                               │                 │
                                               └────────┬────────┘
                                                        │
                                          ┌─────────────┴─────────────┐
                                          ▼                           ▼
                                   ┌─────────────┐             ┌─────────────┐
                                   │ PostgreSQL  │             │   Gemini    │
                                   │   (5432)    │             │     AI      │
                                   └─────────────┘             └─────────────┘
```

---

## Next Steps After Setup

1. Test sending voice messages in Marathi/Hindi
2. Verify AI categorization is working
3. Check dashboard updates in real-time
4. Test the clarification flow (incomplete task info)

---

## Useful Links

- [Meta WhatsApp Business Platform Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Ngrok Documentation](https://ngrok.com/docs)
- [WhatsApp Message Templates](https://developers.facebook.com/docs/whatsapp/message-templates)
- [WhatsApp Webhook Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
