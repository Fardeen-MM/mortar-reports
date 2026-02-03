# Webhook Infrastructure

## Current Setup (Production)

**ONE webhook handler only:**

### Cloudflare Worker (Production)
- **Purpose:** Receives webhooks from Instantly, forwards to GitHub Actions
- **Location:** Deployed to Cloudflare (cloud)
- **URL:** `https://YOUR-WORKER.workers.dev`
- **Config:** Set in Instantly webhook settings

**Flow:**
```
Instantly → Cloudflare Worker → GitHub Actions → Report Generated
```

---

## DO NOT RUN LOCALLY

### ❌ Local Webhook Server (DISABLED)

The file `webhooks/instantly-webhook.js` is for **development/testing ONLY**.

**DO NOT run this in production:**
```bash
# DON'T DO THIS:
node webhooks/instantly-webhook.js
```

**Why:** Running this alongside the Cloudflare Worker will cause:
- Duplicate workflow runs
- Duplicate reports
- Wasted compute
- Double Telegram notifications

---

## What Happened (Feb 3, 2026)

During v12 development, the local webhook server was started for testing and **never shut down**.

**Result:**
- Cloudflare Worker forwarded webhook → GitHub Actions run #1
- Local webhook server forwarded webhook → GitHub Actions run #2
- **DUPLICATE REPORTS** for every lead

**Fix:** Killed the local process (PID 95760)

---

## How to Check

### Verify NO local webhook server is running:
```bash
ps aux | grep -i webhook | grep -v grep
```

**Should return:** Nothing (empty)

### Verify Cloudflare Worker is deployed:
```bash
cd cloudflare-worker
wrangler tail
```

**Should show:** Real-time logs when webhooks come in

---

## Testing Webhooks Locally

If you need to test webhook handling locally:

1. **Stop Cloudflare Worker** (temporarily remove webhook URL from Instantly)
2. **Run local server** for testing:
   ```bash
   node webhooks/instantly-webhook.js
   ```
3. **Use ngrok** to expose local port:
   ```bash
   ngrok http 3500
   ```
4. **Set Instantly webhook** to ngrok URL temporarily
5. **TEST** your changes
6. **SHUT DOWN** local server when done:
   ```bash
   # Find PID
   ps aux | grep instantly-webhook
   # Kill it
   kill <PID>
   ```
7. **Re-enable Cloudflare Worker** (set webhook URL back to production)

---

## Production Checklist

Before deploying:
- [ ] Local webhook server is **NOT** running
- [ ] Cloudflare Worker is deployed
- [ ] Instantly webhook URL points to Cloudflare Worker
- [ ] Test with one webhook to verify single run

---

## If Duplicates Happen Again

1. Check for duplicate processes:
   ```bash
   ps aux | grep -E "webhook|node.*instantly"
   ```

2. Check Instantly webhook settings:
   - Only ONE webhook URL should be configured
   - Should point to Cloudflare Worker URL

3. Check GitHub Actions runs:
   - If TWO runs at exact same timestamp → duplicate webhook source
   - If TWO runs seconds apart → Instantly retry (normal, Cloudflare dedup handles it)
