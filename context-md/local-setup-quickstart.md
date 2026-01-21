# GIMS Local Setup - Quick Start

Get the GIMS Task Management System running locally in 10 minutes.

---

## Prerequisites

- Docker Desktop installed and running
- Node.js 18+ installed
- A Google account (for Gemini API)
- A Facebook account (for WhatsApp API)

---

## Step-by-Step Setup

### 1. Start Database & Redis (2 min)

```bash
cd "/Users/yashnkm/Documents/Projects Techview/Gims Prasad versoin/gims"

# Start PostgreSQL and Redis containers
docker-compose up -d

# Verify containers are running
docker ps
```

Expected output: `gims_postgres` and `gims_redis` containers running.

---

### 2. Create Environment File (1 min)

```bash
cd backend

# Copy example env file
cp .env.example .env
```

Edit `backend/.env` with minimum required values:

```bash
# Database (matches docker-compose)
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=gims_db

# JWT (generate your own secret)
JWT_SECRET=your_super_secret_key_here_make_it_long
JWT_REFRESH_SECRET=your_refresh_secret_here_make_it_long

# Gemini (get from https://aistudio.google.com/)
GEMINI_API_KEY=AIzaSy_your_key_here

# WhatsApp (get from Meta Developer Console)
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=gims_verify_token_2024
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
```

---

### 3. Setup Database Schema (1 min)

```bash
# Connect to PostgreSQL and run migrations
docker exec -i gims_postgres psql -U postgres -d gims_db < migrations/001_initial_schema.sql

# Seed categories data
docker exec -i gims_postgres psql -U postgres -d gims_db < seeds/001_categories.sql
```

---

### 4. Install & Start Backend (2 min)

```bash
cd backend

# Install dependencies
npm install

# Start development server
npm run dev
```

Backend runs at: `http://localhost:3000`

**Test it:**
```bash
curl http://localhost:3000/api/health
```

---

### 5. Install & Start Frontend (2 min)

Open a **new terminal**:

```bash
cd "/Users/yashnkm/Documents/Projects Techview/Gims Prasad versoin/gims/frontend"

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

### 6. Setup Ngrok for WhatsApp (2 min)

Open a **new terminal**:

```bash
# Install ngrok (if not installed)
brew install ngrok

# Authenticate (one-time)
ngrok config add-authtoken YOUR_NGROK_TOKEN

# Start tunnel
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

---

### 7. Configure Meta Webhook

1. Go to [Meta Developer Console](https://developers.facebook.com/apps/)
2. Select your app > WhatsApp > Configuration
3. Edit Webhook:
   - **Callback URL:** `https://YOUR_NGROK_URL/api/webhook/whatsapp`
   - **Verify Token:** `gims_verify_token_2024` (same as in .env)
4. Subscribe to `messages` field

---

## Quick Test

### Test 1: Dashboard Access

1. Open `http://localhost:5173` in browser
2. You should see the login page
3. (Create a test user via API or database)

### Test 2: API Health

```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Test 3: WhatsApp Message

1. Send a message from your WhatsApp to the test number
2. Check backend terminal for incoming webhook
3. Check if AI processes and responds

---

## Terminal Layout

You need **4 terminals** running:

```
┌─────────────────────────────────────────────────────────┐
│ Terminal 1: Docker                                      │
│ $ docker-compose up                                     │
├─────────────────────────────────────────────────────────┤
│ Terminal 2: Backend                                     │
│ $ cd backend && npm run dev                             │
├─────────────────────────────────────────────────────────┤
│ Terminal 3: Frontend                                    │
│ $ cd frontend && npm run dev                            │
├─────────────────────────────────────────────────────────┤
│ Terminal 4: Ngrok                                       │
│ $ ngrok http 3000                                       │
└─────────────────────────────────────────────────────────┘
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Port 5432 in use | Stop local PostgreSQL or change port in docker-compose |
| Backend won't start | Check .env file exists and has valid values |
| Database connection error | Ensure docker containers are running |
| Ngrok URL changed | Update webhook URL in Meta console |
| WhatsApp not receiving | Check ngrok is running, webhook verified |

---

## Stop Everything

```bash
# Stop backend/frontend: Ctrl+C in their terminals

# Stop Docker containers
docker-compose down

# Stop ngrok: Ctrl+C in ngrok terminal
```

---

## Next Steps

After basic setup works:
1. Create admin user in database
2. Test task creation via dashboard
3. Test WhatsApp message flow
4. Check AI categorization accuracy

See detailed guides:
- [WhatsApp + Ngrok Setup](./whatsapp-ngrok-setup-guide.md)
- [Gemini API Setup](./gemini-api-setup-guide.md)
