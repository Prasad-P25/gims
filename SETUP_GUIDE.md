# GIMS Task Registry - Windows Server Setup Guide

Complete guide to set up GIMS on a **Windows PC** that will run 24/7 as a server.
Other users will access via phones, tablets, and computers.

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
:: Check your IP address
ipconfig

:: Look for "Ethernet adapter" → "IPv4 Address" (e.g., 192.168.1.100)
:: Write this down — you'll need it later

:: Check internet connectivity
ping google.com

:: Check if you can reach the gateway/router
ping 192.168.1.1
```

**Important:** Note down the **IPv4 Address** — this is your SERVER_IP.

### 1.3 Set Static IP (Important!)

A server must have a **fixed IP** so it doesn't change after reboot.

1. Open **Settings** → **Network & Internet** → **Ethernet** → **Edit** (next to IP assignment)
2. Change from **Automatic (DHCP)** to **Manual**
3. Turn on **IPv4** and enter:
   - **IP Address:** Your current IP (e.g., `192.168.1.100`)
   - **Subnet mask:** `255.255.255.0`
   - **Gateway:** `192.168.1.1` (your router IP)
   - **Preferred DNS:** `8.8.8.8`
   - **Alternate DNS:** `8.8.4.4`
4. Save

### 1.4 Power Settings (Prevent Sleep)

The PC must stay ON 24/7:

1. Open **Settings** → **System** → **Power & Sleep**
2. Set **Screen:** Turn off after `10 minutes` (saves monitor, PC stays on)
3. Set **Sleep:** `Never`
4. Click **Additional power settings** → **Change plan settings** → **Change advanced power settings**
   - **Hard disk** → Turn off after → `Never`
   - **Sleep** → Sleep after → `Never`
   - **Sleep** → Hibernate after → `Never`

### 1.5 Disable Windows Auto-Restart for Updates

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
PORT=3000
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

**For same-network access only:**
```env
VITE_API_URL=http://SERVER_IP:3000/api
```
Replace `SERVER_IP` with the static IP you noted (e.g., `http://192.168.1.100:3000/api`).

**For remote access (with domain):**
```env
VITE_API_URL=https://api.gims.yourdomain.com/api
```

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
pm2 start serve --name gims-frontend -- -s dist -l 5173 --no-clipboard

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

## PHASE 9: Windows Firewall

Allow other devices to connect:

### Option A: Command Line (faster)
```cmd
:: Open Command Prompt as Administrator
netsh advfirewall firewall add rule name="GIMS Backend" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="GIMS Frontend" dir=in action=allow protocol=TCP localport=5173
```

### Option B: GUI
1. Open **Windows Defender Firewall** → **Advanced Settings**
2. Click **Inbound Rules** → **New Rule**
3. Select **Port** → Next
4. Select **TCP**, enter: `3000, 5173` → Next
5. Select **Allow the connection** → Next
6. Check all profiles → Next
7. Name: `GIMS Application` → Finish

---

## PHASE 10: Test Locally

On the **server PC itself**:
```cmd
:: Test backend
curl http://localhost:3000/api/health

:: Test frontend
start http://localhost:5173
```

From a **phone/laptop on the same network**:
- Open browser → `http://SERVER_IP:5173`
- Login: Phone `9999999999`, Password `admin123`

If it doesn't connect from phone:
1. Check firewall rules were added
2. Make sure phone is on **same WiFi/network**
3. Try `ping SERVER_IP` from another PC
4. Check Windows Defender isn't blocking

---

## PHASE 11: Remote Access (Cloudflare Tunnel)

If users need access from **outside the office network** (home, field work, etc.):

### 11.1 Download cloudflared

Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
Choose **Windows 64-bit**.

### 11.2 Setup

```cmd
:: Login to Cloudflare
cloudflared login

:: Create tunnel
cloudflared tunnel create gims
```

### 11.3 Create Config

Create `C:\Users\<your-username>\.cloudflared\config.yml`:

```yaml
tunnel: gims
credentials-file: C:\Users\<your-username>\.cloudflared\<tunnel-id>.json

ingress:
  - hostname: gims.yourdomain.com
    service: http://localhost:5173
  - hostname: api.gims.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

### 11.4 Add DNS & Install as Service

```cmd
cloudflared tunnel route dns gims gims.yourdomain.com
cloudflared tunnel route dns gims api.gims.yourdomain.com
cloudflared service install
```

### 11.5 Update Frontend for Public URL

Edit `C:\gims\frontend\.env`:
```env
VITE_API_URL=https://api.gims.yourdomain.com/api
```

Rebuild:
```cmd
cd C:\gims\frontend
npm run build
pm2 restart gims-frontend
```

### 11.6 Access from Anywhere

| | URL |
|---|---|
| Frontend | https://gims.yourdomain.com |
| API | https://api.gims.yourdomain.com |

---

## PHASE 12: Telegram Bot Setup

### 12.1 Create Bot (if not done)

1. Open Telegram → Search for `@BotFather`
2. Send `/newbot`
3. Give it a name and username
4. Copy the **bot token** → put in `backend\.env` as `TELEGRAM_BOT_TOKEN`

### 12.2 Set Webhook

The server needs a **public URL** (from Cloudflare Tunnel):

```cmd
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" -H "Content-Type: application/json" -d "{\"url\": \"https://api.gims.yourdomain.com/api/webhook/telegram\"}"
```

Verify:
```cmd
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### 12.3 Link Users

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
| Can't connect from phone | Firewall rules? Same network? Correct IP? |
| Backend won't start | `pm2 logs gims-backend` for errors |
| Database error | Verify password in DATABASE_URL in `.env` |
| Frontend blank page | Check VITE_API_URL has correct IP/domain |
| Redis error | Is Memurai service running? `sc query memurai` |
| Login fails | Did seeds run? `psql -U postgres -d gims_db -c "SELECT phone, role FROM users;"` |
| Port in use | `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F` |
| Telegram bot not responding | Check webhook: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo` |
| PC went to sleep | Check power settings (Phase 1.4) |
| App not running after reboot | `pm2 resurrect` or `pm2 start` again |
| Slow performance | Check RAM usage in Task Manager, close unused programs |

---

## Quick Verification Checklist

After setup, run through this:

- [ ] `node --version` returns v18+
- [ ] `git --version` works
- [ ] `psql -U postgres -c "SELECT 1"` connects
- [ ] `sc query memurai` shows RUNNING (or Upstash URL works)
- [ ] `pm2 status` shows both apps **online**
- [ ] `http://localhost:5173` loads login page on server PC
- [ ] `http://SERVER_IP:5173` loads from another device on same network
- [ ] Login with `9999999999` / `admin123` works
- [ ] Telegram bot responds to `/start`
- [ ] Dashboard shows correct stats

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
                              │  :6379  Redis (Memurai)  │
                              └──────────────────────────┘

  REMOTE ACCESS (Internet):
  ┌─────────────────┐         ┌───────────────┐         ┌────────────────┐
  │ Phone / Laptop  │         │  Cloudflare   │         │ Windows Server │
  │ (anywhere)      ├────────►│  Tunnel       ├────────►│                │
  │                 │ HTTPS   │  (Free)       │  Secure │  Frontend      │
  │ gims.domain.com │         │               │  Tunnel │  Backend       │
  └─────────────────┘         └───────────────┘         │  PostgreSQL    │
                                                        │  Redis         │
  ┌─────────────────┐                                   │                │
  │ Telegram Bot    ├──────────────────────────────────►│  Webhook       │
  └─────────────────┘         via public URL            └────────────────┘
```
