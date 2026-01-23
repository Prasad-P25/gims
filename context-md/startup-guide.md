# GIMS Application Startup Guide

## Quick Start (TL;DR)

```bash
# Terminal 1: Start Database & Redis
cd "/Users/yashnkm/Documents/Projects Techview/Gims Prasad versoin/gims"
docker-compose up -d

# Terminal 2: Start Backend
cd "/Users/yashnkm/Documents/Projects Techview/Gims Prasad versoin/gims/backend"
npm run dev

# Terminal 3: Start Frontend
cd "/Users/yashnkm/Documents/Projects Techview/Gims Prasad versoin/gims/frontend"
npm run dev

# Terminal 4: Start Cloudflare Tunnel (for WhatsApp webhooks)
cloudflared tunnel --url http://localhost:3001
```

---

## Detailed Steps

### Step 1: Start Docker Services

PostgreSQL and Redis run in Docker containers.

```bash
cd "/Users/yashnkm/Documents/Projects Techview/Gims Prasad versoin/gims"
docker-compose up -d
```

**Verify:**
```bash
docker ps
```

You should see:
- `gims_postgres` (port 5432)
- `gims_redis` (port 6379)

---

### Step 2: Start Backend

```bash
cd "/Users/yashnkm/Documents/Projects Techview/Gims Prasad versoin/gims/backend"
npm run dev
```

**Expected output:**
```
🚀 Server running on http://localhost:3001
✅ Database connected
✅ Redis connected
```

**Test:**
```bash
curl http://localhost:3001/api/health
```

---

### Step 3: Start Frontend

Open a **new terminal**:

```bash
cd "/Users/yashnkm/Documents/Projects Techview/Gims Prasad versoin/gims/frontend"
npm run dev
```

**Expected output:**
```
VITE v7.x.x ready in xxx ms
➜ Local: http://localhost:5173/
```

**Access:** Open `http://localhost:5173` in browser

---

### Step 4: Setup Telegram Bot (Recommended - Easier than WhatsApp)

Telegram is easier to set up than WhatsApp (no business verification needed).

**Create a Bot:**
1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow prompts to name your bot
4. Copy the **API Token** you receive

**Add to .env:**
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

**Start Cloudflare Tunnel:**
```bash
cloudflared tunnel --url http://localhost:3001
```

**Setup Webhook:**
Open this URL in browser (replace with your tunnel URL):
```
http://localhost:3001/api/webhook/telegram/setup?url=https://YOUR-CLOUDFLARE-URL
```

**Test the Bot:**
1. Open Telegram and search for your bot
2. Send `/start` to begin
3. Send a voice or text message to create a task

---

### Step 5: Setup WhatsApp (Optional - Requires Business Verification)

Only needed if testing WhatsApp integration:

```bash
cloudflared tunnel --url http://localhost:3001
```

**Copy the URL** (e.g., `https://random-words.trycloudflare.com`)

Then update Meta webhook:
1. Go to [Meta Developer Dashboard](https://developers.facebook.com/apps/)
2. Your App → WhatsApp → Configuration
3. Edit Webhook → Callback URL: `https://YOUR-CLOUDFLARE-URL/api/webhook/whatsapp`
4. Verify Token: `gims_webhook_verify_2024`

---

## Login Credentials

| Field | Value |
|-------|-------|
| Phone | `9999999999` |
| Password | `admin123` |

---

## Ports Summary

| Service | Port | URL |
|---------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Backend | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |

---

## Common Issues

### Backend won't start

**Error:** `Database connection failed`
**Fix:** Make sure Docker is running: `docker-compose up -d`

**Error:** `Redis connection failed`
**Fix:** Check Redis is running or using Redis Cloud (check `.env`)

### Frontend won't start

**Error:** `Module not found`
**Fix:** Run `npm install` in frontend folder

### WhatsApp webhook fails

**Fix:**
1. Make sure backend is running
2. Make sure Cloudflare tunnel is running
3. Update webhook URL in Meta dashboard with new tunnel URL

---

## Stop Everything

```bash
# Stop frontend/backend: Ctrl+C in their terminals

# Stop Docker containers
cd "/Users/yashnkm/Documents/Projects Techview/Gims Prasad versoin/gims"
docker-compose down
```

---

## Environment Files

Backend `.env` location:
```
/Users/yashnkm/Documents/Projects Techview/Gims Prasad versoin/gims/backend/.env
```

Key variables:
- `GEMINI_API_KEY` - Google AI API key
- `WHATSAPP_*` - WhatsApp Business API credentials
- `DB_*` - Database credentials

---

## Add Logo

Place your logo file at:
```
/Users/yashnkm/Documents/Projects Techview/Gims Prasad versoin/gims/frontend/public/logo.png
```

---

## Features Available

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard | ✅ Working | Stats, categories, recent tasks |
| Task Management | ✅ Working | Create, edit, delete tasks |
| Voice Input | ✅ Working | Speak in Marathi/Hindi/English |
| Reports | ✅ Working | PDF/Excel export |
| Telegram Bot | ✅ Working | Easy setup, no verification needed |
| WhatsApp Bot | ⏳ Pending verification | Need to verify phone number |

---

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot and see welcome message |
| `/help` | Show available commands |
| `/status` | Show task statistics |
| `/today` | Show today's tasks summary |
| `/menu` | Show category selection menu |

**Usage:**
- Send text messages in Marathi/Hindi/English to create tasks
- Send voice messages for hands-free task creation
- Bot auto-extracts category, priority, and due date

---

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, TanStack Query
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL
- **Cache/Queue:** Redis
- **AI:** Google Gemini 2.5 Flash
- **Messaging:** Telegram Bot API, WhatsApp Cloud API
