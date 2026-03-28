# Migrate Redis from Upstash to Local — Production Windows PC

## Context

Production backend runs on a Windows PC with PM2, using Upstash (cloud Redis) via `REDIS_URL=rediss://...`. This costs money monthly. Redis is **only** used for Bull job queues — no persistent data, no cache, no sessions. Migrating to local Redis has near-zero risk and eliminates the cost.

---

## Step 1: Install Redis on Production Windows PC

Redis has no official Windows build. Two options:

### Option A — Memurai (Recommended)

1. Download Memurai from https://www.memurai.com/get-memurai (free Developer Edition)
2. Run the installer — installs as a **Windows Service** (auto-starts on boot)
3. Default: port `6379`, no password, no config needed
4. Verify:
   ```cmd
   memurai-cli ping
   ```
   Should return `PONG`

### Option B — WSL (if already using WSL)

1. Open WSL terminal:
   ```bash
   sudo apt update && sudo apt install redis-server
   sudo service redis-server start
   ```
2. Verify:
   ```bash
   redis-cli ping
   ```
   Should return `PONG`
3. **Note:** WSL Redis won't auto-start on Windows boot — you'll need a startup script

---

## Step 2: Update Production `.env`

Edit `backend/.env` on the production PC:

```env
# REMOVE (or comment out) this line:
# REDIS_URL=rediss://default:xxxxx@your-instance.upstash.io:6379

# ADD these lines:
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

**Why this works:** `config/redis.ts` checks for `REDIS_URL` first. If absent, it falls back to `REDIS_HOST`/`REDIS_PORT`. No code changes needed.

---

## Step 3: Restart the Backend

```bash
pm2 restart all
```

The app will automatically:
- Connect to local Redis instead of Upstash
- Recreate all 4 scheduled notification cron jobs
- Process new WhatsApp/Telegram messages normally

---

## Step 4: Verify

1. **Check logs:**
   ```bash
   pm2 logs
   ```
   Look for `"Redis connected"` and `"Redis ready"`

2. **Test messaging:** Send a test message via WhatsApp or Telegram — confirm it processes and you get a response

3. **Check notifications:** Wait for the next scheduled notification time to confirm cron jobs are running

---

## Step 5: Delete Upstash Instance

Once confirmed working (give it a full day), go to the **Upstash dashboard** and delete the Redis instance to stop billing.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss | **None** | All real data is in PostgreSQL. Redis only holds transient job queues |
| Downtime | **~1 minute** | Only during PM2 restart |
| Lost messages | **1-2 messages max** | Only if WhatsApp/Telegram messages are mid-processing during switch. Do it early morning |

---

## Summary

- **What changes:** Only `backend/.env` (production)
- **Code changes:** None
- **Cost after migration:** $0/month for Redis
- **Best time to do it:** Early morning (low traffic)
- **Rollback:** Re-add the `REDIS_URL` line and `pm2 restart all`
