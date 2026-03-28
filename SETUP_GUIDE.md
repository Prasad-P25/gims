# GIMS Task Registry - Windows Server Setup Guide

Complete guide to set up GIMS on a **Windows PC** that will run 24/7 as a server.
All users access via **Cloudflare Tunnel** — no static IP or port forwarding needed.

---

## PHASE 1: Check the Server PC

Before installing anything, verify the server PC is ready.

### 1.1 System Requirements
- **OS:** Windows 10/11 Pro (Home works too but Pro is better for server use)
- **RAM:** Minimum 4 GB (8 GB recommended)
- **Disk:** At least 10 GB free space
- **Network:** Connected via Ethernet cable (not WiFi — WiFi is unreliable for servers)

### 1.2 Network Checks

Open **Command Prompt** (Win + R → type `cmd` → Enter):

```cmd
:: Check internet connectivity
ping google.com

:: Check if you can reach the gateway/router
ping 192.168.1.1
```

Ensure the server has a stable internet connection — Cloudflare Tunnel requires outbound internet access.

### 1.3 Power Settings (Prevent Sleep)

The PC must stay ON 24/7:

1. Open **Settings** → **System** → **Power & Sleep**
2. Set **Screen:** Turn off after `10 minutes` (saves monitor, PC stays on)
3. Set **Sleep:** `Never`
4. Click **Additional power settings** → **Change plan settings** → **Change advanced power settings**
   - **Hard disk** → Turn off after → `Never`
   - **Sleep** → Sleep after → `Never`
   - **Sleep** → Hibernate after → `Never`

### 1.4 Disable Windows Auto-Restart for Updates

Windows updates can restart the PC and kill your server:

1. Open **Settings** → **Windows Update** → **Advanced options**
2. Turn on **Active hours** and set a wide range (e.g., 6 AM to 11 PM)
3. Under **Additional options**, turn off **Restart this device as soon as possible**

Or via Group Policy (Pro only):
```cmd
:: Open Group Policy Editor
gpedit.msc
```
Navigate to: Computer Configuration → Administrative Templates → Windows Components → Windows Update → **Configure Automatic Updates** → Set to "Download but do not auto-install"

---

## PHASE 2: Install Software

Install each one in order. Open **Command Prompt as Administrator** (right-click CMD → Run as Administrator).

### 2.1 Node.js (v18 or above)

1. Download from: https://nodejs.org/en/download — choose **Windows Installer (.msi)** LTS version
2. Run installer → Check **"Automatically install necessary tools"**
3. Verify:
   ```cmd
   node --version
   npm --version
   ```
   You should see version numbers (e.g., `v20.x.x`).

### 2.2 Git

1. Download from: https://git-scm.com/download/win
2. Install with default settings
3. Verify:
   ```cmd
   git --version
   ```

### 2.3 PostgreSQL 16

1. Download from: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
2. Choose **Windows x86-64** → Version 16
3. During installation:
   - **Set password** for `postgres` user → **WRITE THIS DOWN!**
   - Keep port: `5432`
   - Keep default locale
4. After install, add to PATH if not auto-added:
   ```cmd
   :: Check if psql works
   psql --version

   :: If "not recognized", add to PATH manually:
   setx PATH "%PATH%;C:\Program Files\PostgreSQL\16\bin" /M
   :: Close and reopen Command Prompt
   ```
5. Verify:
   ```cmd
   psql -U postgres -c "SELECT version();"
   :: Enter your password when prompted
   ```

### 2.4 Redis for Windows

Redis doesn't run natively on Windows. Use **Memurai** (free for development):

1. Download from: https://www.memurai.com/get-memurai
2. Install → it will run as a **Windows Service** automatically
3. Verify:
   ```cmd
   :: Check if Memurai service is running
   sc query memurai

   :: Or test with a connection (if memurai-cli is in PATH)
   memurai-cli ping
   :: Should return: PONG
   ```

**Alternative:** If Memurai doesn't work, use Upstash cloud Redis (free):
- Go to https://upstash.com → Create Redis database → Copy the URL

---

## PHASE 3: Get the Code

```cmd
:: Create project folder
cd C:\
git clone <your-git-repo-url> gims
cd C:\gims
```

If the repo is private, you'll need to authenticate with GitHub.

---

## PHASE 4: Database Setup

### 4.1 Create Database

```cmd
psql -U postgres
```
Enter password, then:
```sql
CREATE DATABASE gims_db;
\q
```

### 4.2 Run Migrations (in order)

```cmd
psql -U postgres -d gims_db -f C:\gims\backend\migrations\001_initial_schema.sql
psql -U postgres -d gims_db -f C:\gims\backend\migrations\002_add_telegram_and_source.sql
psql -U postgres -d gims_db -f C:\gims\backend\migrations\003_attachments.sql
psql -U postgres -d gims_db -f C:\gims\backend\migrations\004_teams.sql
psql -U postgres -d gims_db -f C:\gims\backend\migrations\005_create_super_admin.sql
psql -U postgres -d gims_db -f C:\gims\backend\migrations\006_task_assignment.sql
psql -U postgres -d gims_db -f C:\gims\backend\migrations\007_notifications.sql
```

### 4.3 Seed Categories

```cmd
psql -U postgres -d gims_db -f C:\gims\backend\seeds\001_categories.sql
```

### 4.4 Verify Database

```cmd
psql -U postgres -d gims_db -c "SELECT phone, name, role FROM users;"
```
You should see:
```
   phone    |  name  |    role
------------+--------+-------------
 9999999999 | Admin  | super_admin
```

---

## PHASE 5: Configure Environment

### 5.1 Backend `.env`

Create/edit `C:\gims\backend\.env`:

```env
# Server
NODE_ENV=production
PORT=4891
HOST=0.0.0.0

# Database (replace YOUR_PASSWORD with actual postgres password)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/gims_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT (generate random strings — can use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=PASTE_RANDOM_STRING_HERE_MIN_32_CHARS
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=PASTE_ANOTHER_RANDOM_STRING_HERE
JWT_REFRESH_EXPIRES_IN=30d

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
VOICE_MESSAGE_DIR=./uploads/voice

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

Generate JWT secrets easily:
```cmd
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run twice — use first for `JWT_SECRET`, second for `JWT_REFRESH_SECRET`.

### 5.2 Frontend `.env`

Create/edit `C:\gims\frontend\.env`:

```env
VITE_API_URL=https://api.gims.yourdomain.com/api
```

Replace `yourdomain.com` with your actual domain (configured in Phase 9 with Cloudflare).

---

## PHASE 6: Install Dependencies & Build

```cmd
:: Backend
cd C:\gims\backend
npm install
npm run build

:: Frontend
cd C:\gims\frontend
npm install
npm run build
```

If `npm run build` fails for the backend, check:
```cmd
:: Check TypeScript compiles
npx tsc --noEmit
```

---

## PHASE 7: Install PM2 (Keeps App Running 24/7)

```cmd
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
npm install -g serve
```

---

## PHASE 8: Start the Application

```cmd
:: Start Backend
cd C:\gims\backend
pm2 start dist/server.js --name gims-backend

:: Start Frontend
cd C:\gims\frontend
pm2 start serve --name gims-frontend -- -s dist -l 4173 --no-clipboard

:: Save so it survives reboot
pm2 save
```

Check status:
```cmd
pm2 status
```

Both should show **online**:
```
┌──────────────────┬────┬──────┬────────┐
│ Name             │ id │ mode │ status │
├──────────────────┼────┼──────┼────────┤
│ gims-backend     │ 0  │ fork │ online │
│ gims-frontend    │ 1  │ fork │ online │
└──────────────────┴────┴──────┴────────┘
```

---

## PHASE 9: Setup Cloudflare Tunnel

Cloudflare Tunnel creates a secure outbound connection from your server to Cloudflare's network. All users (office, home, field) access GIMS through your domain — no static IP, no port forwarding, no firewall rules needed.

### 9.1 Prerequisites

- A **Cloudflare account** (free): https://dash.cloudflare.com/sign-up
- A **domain name** added to Cloudflare (Cloudflare must manage DNS for the domain)

### 9.2 Download cloudflared

Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
Choose **Windows 64-bit**.

### 9.3 Login & Create Tunnel

```cmd
:: Login to Cloudflare (opens browser for authentication)
cloudflared login

:: Create tunnel
cloudflared tunnel create gims
```

After creation, note the **Tunnel ID** — you'll need it for the config file.

### 9.4 Create Config

Create `C:\Users\<your-username>\.cloudflared\config.yml`:

```yaml
tunnel: gims
credentials-file: C:\Users\<your-username>\.cloudflared\<tunnel-id>.json

ingress:
  - hostname: gims.yourdomain.com
    service: http://localhost:4173
  - hostname: api.gims.yourdomain.com
    service: http://localhost:4891
  - service: http_status:404
```

Replace `<your-username>` with your Windows username and `<tunnel-id>` with the ID from the previous step.

### 9.5 Add DNS Records & Install as Service

```cmd
:: Create DNS records pointing to the tunnel
cloudflared tunnel route dns gims gims.yourdomain.com
cloudflared tunnel route dns gims api.gims.yourdomain.com

:: Install as Windows Service (runs on startup automatically)
cloudflared service install
```

### 9.6 Verify Tunnel is Running

```cmd
:: Check the service is running
sc query cloudflared

:: Test from the server itself
curl https://gims.yourdomain.com
curl https://api.gims.yourdomain.com/api/health
```

### 9.7 Access URLs

| | URL |
|---|---|
| Frontend | https://gims.yourdomain.com |
| API | https://api.gims.yourdomain.com |

All users — whether in the office or remote — use these same URLs.

---

## PHASE 10: Test the Application

### 10.1 On the Server PC

```cmd
:: Test backend is running locally
curl http://localhost:4891/api/health

:: Test frontend is running locally
start http://localhost:4173

:: Test via Cloudflare Tunnel
curl https://api.gims.yourdomain.com/api/health
start https://gims.yourdomain.com
```

### 10.2 From Any Device (Phone / Laptop / Tablet)

- Open browser → `https://gims.yourdomain.com`
- Login: Phone `9999999999`, Password `admin123`

If it doesn't connect:
1. Check Cloudflare Tunnel is running: `sc query cloudflared`
2. Check PM2 apps are online: `pm2 status`
3. Verify DNS has propagated: `nslookup gims.yourdomain.com`
4. Check backend logs: `pm2 logs gims-backend`

---

## PHASE 11: Telegram Bot Setup

### 11.1 Create Bot (if not done)

1. Open Telegram → Search for `@BotFather`
2. Send `/newbot`
3. Give it a name and username
4. Copy the **bot token** → put in `backend\.env` as `TELEGRAM_BOT_TOKEN`

### 11.2 Set Webhook

The webhook uses your Cloudflare Tunnel public URL:

```cmd
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" -H "Content-Type: application/json" -d "{\"url\": \"https://api.gims.yourdomain.com/api/webhook/telegram\"}"
```

Verify:
```cmd
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### 11.3 Link Users

Each user links their Telegram by sending to the bot:
```
/link 9876543210
```
(their phone number registered in GIMS)

---

## Telegram Reminder Schedule

| Time (IST) | Who | What |
|---|---|---|
| 9:00 AM | Users with overdue tasks | Overdue alert — tasks pending from previous days |
| 10:00 AM | All linked users | Morning update — pending tasks, focus items |
| 6:00 PM | All linked users | Evening update — today's progress, pending highlights |
| 7:00 PM | Admins only | Daily report — full stats summary |

Super admin can test any reminder: send `/testreminder` to the bot.

---

## Default Login

| | |
|---|---|
| Phone | `9999999999` |
| Password | `admin123` |
| Role | Super Admin |

---

## Common Commands

| Action | Command |
|--------|---------|
| Check app status | `pm2 status` |
| View backend logs | `pm2 logs gims-backend` |
| View frontend logs | `pm2 logs gims-frontend` |
| Restart backend | `pm2 restart gims-backend` |
| Restart everything | `pm2 restart all` |
| Stop everything | `pm2 stop all` |
| Check tunnel status | `sc query cloudflared` |
| Restart tunnel | `sc stop cloudflared && sc start cloudflared` |
| After reboot if not auto-started | `pm2 resurrect` |

---

## Updating the Application

```cmd
cd C:\gims
git pull

cd backend
npm install
npm run build
pm2 restart gims-backend

cd ..\frontend
npm install
npm run build
pm2 restart gims-frontend
```

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| Can't access from any device | Is Cloudflare Tunnel running? `sc query cloudflared` |
| Tunnel running but site unreachable | DNS propagated? `nslookup gims.yourdomain.com` |
| Backend won't start | `pm2 logs gims-backend` for errors |
| Database error | Verify password in DATABASE_URL in `.env` |
| Frontend blank page | Check VITE_API_URL has correct Cloudflare domain |
| Redis error | Is Memurai service running? `sc query memurai` |
| Login fails | Did seeds run? `psql -U postgres -d gims_db -c "SELECT phone, role FROM users;"` |
| Port in use | `netstat -ano | findstr :4891` then `taskkill /PID <pid> /F` |
| Telegram bot not responding | Check webhook: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo` |
| PC went to sleep | Check power settings (Phase 1.3) |
| App not running after reboot | `pm2 resurrect` or `pm2 start` again |
| Tunnel not running after reboot | `sc start cloudflared` |
| Slow performance | Check RAM usage in Task Manager, close unused programs |

---

## Quick Verification Checklist

After setup, run through this:

- [ ] `node --version` returns v18+
- [ ] `git --version` works
- [ ] `psql -U postgres -c "SELECT 1"` connects
- [ ] `sc query memurai` shows RUNNING (or Upstash URL works)
- [ ] `pm2 status` shows both apps **online**
- [ ] `sc query cloudflared` shows RUNNING
- [ ] `http://localhost:4173` loads login page on server PC
- [ ] `https://gims.yourdomain.com` loads from any device
- [ ] Login with `9999999999` / `admin123` works
- [ ] Telegram bot responds to `/start`
- [ ] Dashboard shows correct stats

---

## Architecture

```
  ALL USERS (Office, Home, Field):
  ┌─────────────────┐         ┌───────────────┐         ┌────────────────────────┐
  │ Phone / Laptop  │         │  Cloudflare   │         │   Windows Server PC    │
  │ (anywhere)      ├────────►│  Tunnel       ├────────►│                        │
  │                 │ HTTPS   │  (Free)       │  Secure │  :4173  Frontend       │
  │ gims.domain.com │         │               │  Tunnel │  :4891  Backend        │
  └─────────────────┘         └───────────────┘         │  :5432  PostgreSQL     │
                                                        │  :6379  Redis (Memurai)│
  ┌─────────────────┐                                   │                        │
  │ Telegram Bot    ├──────────────────────────────────►│  Webhook               │
  └─────────────────┘         via public URL            └────────────────────────┘

  No static IP needed — Cloudflare Tunnel connects outbound from the server.
  No firewall rules needed — no inbound ports are exposed.
```
