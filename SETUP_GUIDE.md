# GIMS Task Registry - Server Setup Guide

Setup guide for deploying GIMS on a **Windows PC (server)** running 24/7.
Other users will access the application via phones, tablets, and computers on the same network.

---

## Prerequisites

Install the following on the Windows server PC:

### 1. Node.js (v18 or above)
- Download from: https://nodejs.org/en/download
- Choose **Windows Installer (.msi)** - LTS version
- During install, check "Automatically install necessary tools"
- Verify: Open Command Prompt and run:
  ```
  node --version
  npm --version
  ```

### 2. PostgreSQL 16
- Download from: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
- Choose **Windows x86-64**
- During install:
  - Set a password for `postgres` user (remember this!)
  - Keep default port: `5432`
  - Keep default locale
- Verify: Open Command Prompt and run:
  ```
  psql -U postgres --version
  ```

### 3. Git
- Download from: https://git-scm.com/download/win
- Install with default settings
- Verify:
  ```
  git --version
  ```

### 4. Redis (choose one option)

**Option A: Use Upstash (Recommended - No install needed)**
- Go to https://upstash.com and create a free Redis database
- Copy the Redis URL (starts with `redis://...`)

**Option B: Install Memurai (Redis for Windows)**
- Download from: https://www.memurai.com/get-memurai
- Install and it will run as a Windows service automatically
- Redis URL will be: `redis://localhost:6379`

---

## Step 1: Get the Code

Open Command Prompt as Administrator:

```cmd
cd C:\
git clone <your-git-repo-url> gims
cd gims
```

---

## Step 2: Create the Database

Open Command Prompt:

```cmd
psql -U postgres
```

Enter your postgres password, then run:

```sql
CREATE DATABASE gims_db;
\q
```

---

## Step 3: Run Database Migrations

Run these one by one (enter postgres password each time):

```cmd
psql -U postgres -d gims_db -f backend\migrations\001_initial_schema.sql
psql -U postgres -d gims_db -f backend\migrations\002_add_telegram_and_source.sql
psql -U postgres -d gims_db -f backend\migrations\003_attachments.sql
psql -U postgres -d gims_db -f backend\migrations\004_teams.sql
psql -U postgres -d gims_db -f backend\migrations\005_create_super_admin.sql
psql -U postgres -d gims_db -f backend\migrations\006_task_assignment.sql
psql -U postgres -d gims_db -f backend\migrations\007_notifications.sql
```

---

## Step 4: Seed Categories Data

```cmd
psql -U postgres -d gims_db -f backend\seeds\001_categories.sql
```

This inserts 11 task categories (in English and Marathi).

---

## Step 5: Configure Backend

Create the file `backend\.env`:

```env
# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database (update password)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/gims_db

# Redis (use Upstash URL or localhost)
REDIS_URL=redis://localhost:6379

# JWT (change these to random strings)
JWT_SECRET=your-random-secret-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d

# Google Gemini AI (for voice processing)
GEMINI_API_KEY=your_gemini_api_key

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Reminder Times
MORNING_REMINDER_TIME=09:00
EVENING_REMINDER_TIME=18:00
```

> **Important:** Replace `YOUR_PASSWORD` with your actual PostgreSQL password.

---

## Step 6: Configure Frontend

Create the file `frontend\.env`:

```env
VITE_API_URL=http://SERVER_IP:3000/api
```

> **Important:** Replace `SERVER_IP` with the actual IP of the server PC.
> To find the IP, open Command Prompt and run: `ipconfig`
> Look for **IPv4 Address** (e.g., `192.168.1.100`)
> Example: `VITE_API_URL=http://192.168.1.100:3000/api`

---

## Step 7: Install Dependencies & Build

```cmd
cd C:\gims\backend
npm install
npm run build

cd C:\gims\frontend
npm install
npm run build
```

---

## Step 8: Install PM2 (Process Manager)

PM2 keeps the application running 24/7 and auto-restarts on crash.

```cmd
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
```

---

## Step 9: Serve Frontend with a Static Server

```cmd
npm install -g serve
```

---

## Step 10: Start the Application

```cmd
:: Start Backend
cd C:\gims\backend
pm2 start dist/server.js --name gims-backend

:: Start Frontend (serves the built files)
cd C:\gims\frontend
pm2 start serve --name gims-frontend -- -s dist -l 5173 --no-clipboard

:: Save PM2 process list (so it survives reboot)
pm2 save
```

Verify both are running:
```cmd
pm2 status
```

You should see:
```
┌──────────────────┬────┬──────┬───────┐
│ Name             │ id │ mode │ status│
├──────────────────┼────┼──────┼───────┤
│ gims-backend     │ 0  │ fork │ online│
│ gims-frontend    │ 1  │ fork │ online│
└──────────────────┴────┴──────┴───────┘
```

---

## Step 11: Windows Firewall

Allow other devices to access the application:

1. Open **Windows Defender Firewall** → **Advanced Settings**
2. Click **Inbound Rules** → **New Rule**
3. Select **Port** → Next
4. Select **TCP**, enter: `3000, 5173` → Next
5. Select **Allow the connection** → Next
6. Check all profiles (Domain, Private, Public) → Next
7. Name: `GIMS Application` → Finish

---

## Step 12: Access the Application

### A) Same Network (Office WiFi/LAN)

| Who | URL |
|-----|-----|
| On the server PC | http://localhost:5173 |
| From phones/other devices | http://SERVER_IP:5173 |

> Replace `SERVER_IP` with the server's IP (e.g., `http://192.168.1.100:5173`)

### B) Different Network (Remote Access via Internet)

If users need to access from **outside the office** (home, field, different location), set up **Cloudflare Tunnel** (free):

#### One-time setup on the server:

1. **Create Cloudflare account** at https://dash.cloudflare.com/sign-up (free)

2. **Add your domain** (or get a free one)
   - If you have a domain (e.g., `gimsapp.com`), add it to Cloudflare
   - If you don't have one, you can buy one on Cloudflare for ~$10/year
   - Or use the free `trycloudflare.com` subdomain (temporary, changes on restart)

3. **Download cloudflared** on the server:
   - Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   - Choose **Windows 64-bit**

4. **Login to Cloudflare:**
   ```cmd
   cloudflared login
   ```
   This opens a browser - select your domain.

5. **Create a tunnel:**
   ```cmd
   cloudflared tunnel create gims
   ```

6. **Create config file** at `C:\Users\<username>\.cloudflared\config.yml`:
   ```yaml
   tunnel: gims
   credentials-file: C:\Users\<username>\.cloudflared\<tunnel-id>.json

   ingress:
     # Frontend
     - hostname: gims.yourdomain.com
       service: http://localhost:5173
     # Backend API
     - hostname: api.gims.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```

7. **Add DNS routes:**
   ```cmd
   cloudflared tunnel route dns gims gims.yourdomain.com
   cloudflared tunnel route dns gims api.gims.yourdomain.com
   ```

8. **Install as Windows service (runs on startup):**
   ```cmd
   cloudflared service install
   ```

9. **Update frontend env** to use the public API URL:
   ```env
   VITE_API_URL=https://api.gims.yourdomain.com/api
   ```
   Then rebuild frontend:
   ```cmd
   cd C:\gims\frontend
   npm run build
   pm2 restart gims-frontend
   ```

#### Access from anywhere:

| Who | URL |
|-----|-----|
| Frontend | https://gims.yourdomain.com |
| API | https://api.gims.yourdomain.com |

#### Quick test (no domain needed):

For a quick temporary public URL without buying a domain:
```cmd
cloudflared tunnel --url http://localhost:5173
```
This gives a URL like `https://random-words.trycloudflare.com` - but it changes every restart.

---

### Default Login
- **Phone:** `9999999999`
- **Password:** `admin123`
- **Role:** Super Admin

---

## Step 13: Telegram Bot Setup

Once the server has a **public URL** (from Cloudflare Tunnel):

1. Set the webhook:
   ```cmd
   curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" -H "Content-Type: application/json" -d "{\"url\": \"https://api.gims.yourdomain.com/api/webhook/telegram\"}"
   ```

2. Verify:
   ```cmd
   curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
   ```

---

## Common Commands

| Action | Command |
|--------|---------|
| Check app status | `pm2 status` |
| View backend logs | `pm2 logs gims-backend` |
| View frontend logs | `pm2 logs gims-frontend` |
| Restart backend | `pm2 restart gims-backend` |
| Restart frontend | `pm2 restart gims-frontend` |
| Restart everything | `pm2 restart all` |
| Stop everything | `pm2 stop all` |

---

## After Server Reboot

PM2 should auto-start the apps. If it doesn't:
```cmd
pm2 resurrect
```

---

## Updating the Application

When you push new code:

```cmd
cd C:\gims
git pull

:: Rebuild backend
cd backend
npm install
npm run build
pm2 restart gims-backend

:: Rebuild frontend
cd ..\frontend
npm install
npm run build
pm2 restart gims-frontend
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't connect from phone | Check firewall rules, ensure phone is on same WiFi |
| Backend won't start | Check `pm2 logs gims-backend` for errors |
| Database connection error | Verify DATABASE_URL password in `backend\.env` |
| Frontend shows blank page | Check `VITE_API_URL` has correct server IP |
| Redis connection error | Verify Redis is running: `redis-cli ping` should return PONG |
| Login not working | Verify seeds ran: `psql -U postgres -d gims_db -c "SELECT phone, role FROM users;"` |
| Port already in use | `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F` |

---

## Architecture

```
  SAME NETWORK (Office):
  ┌─────────────────┐         ┌──────────────────────────┐
  │ Phone / Laptop  │         │   Windows Server PC      │
  │                 ├────────►│                          │
  │ 192.168.x.x    │  WiFi   │  :5173  Frontend (serve) │
  │                 │   LAN   │  :3000  Backend (Node.js)│
  └─────────────────┘         │  :5432  PostgreSQL       │
                              │  :6379  Redis            │
                              └──────────────────────────┘

  DIFFERENT NETWORK (Remote):
  ┌─────────────────┐         ┌───────────────┐         ┌────────────────┐
  │ Phone / Laptop  │         │  Cloudflare   │         │ Windows Server │
  │ (anywhere)      ├────────►│  Tunnel       ├────────►│                │
  │                 │ Internet│               │  Secure │  Frontend      │
  │ gims.domain.com │  HTTPS  │  Free & Safe  │  Tunnel │  Backend       │
  └─────────────────┘         └───────────────┘         │  PostgreSQL    │
                                                        │  Redis         │
  ┌─────────────────┐                                   │                │
  │ Telegram Bot    ├──────────────────────────────────►│  Webhook       │
  └─────────────────┘         via public URL            └────────────────┘
```
