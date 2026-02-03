# Deploy Cloudflare Worker (CRITICAL FIX)

## What Changed

**Fixed the root cause of duplicate report generation.**

The Cloudflare Worker now has **in-memory deduplication** that blocks duplicate webhooks from Instantly BEFORE they reach GitHub Actions.

---

## Deploy Instructions

### 1. Install Wrangler (if not already installed)

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Deploy the Worker

```bash
cd ~/Desktop/mortar-reports/cloudflare-worker
wrangler deploy
```

### 4. Verify Deployment

After deploying, test with:

```bash
curl -X POST https://YOUR-WORKER-URL.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "lead_email": "test@example.com",
    "email_id": "test123",
    "first_name": "Test"
  }'
```

Should return: `{"success":true,"message":"Webhook forwarded to GitHub Actions"}`

**Test duplicate:**
Run the same curl twice within 5 minutes. Second time should return:
```json
{
  "success": true,
  "message": "Duplicate webhook ignored (already processed recently)",
  "dedupKey": "test@example.com_test123",
  "timeSinceLastSeen": 2
}
```

---

## How It Works

1. **Instantly** sends webhook → **Cloudflare Worker**
2. Worker generates dedup key: `lead_email + email_id`
3. If seen within last 5 minutes → **BLOCK** (return 200, don't forward to GitHub)
4. If new → **FORWARD** to GitHub Actions

**Result:** Duplicate webhooks never reach GitHub. No wasted compute. No duplicate reports.

---

## View Logs

```bash
cd ~/Desktop/mortar-reports/cloudflare-worker
wrangler tail
```

Or in Cloudflare Dashboard:
Workers → your-worker-name → Logs (Real-time)

---

## What to Look For

After deploying, when a duplicate webhook comes in, you'll see in logs:

```
⚠️  DUPLICATE webhook detected: test@example.com_test123 (seen 45s ago)
```

And GitHub Actions will NOT trigger.

---

**This is the REAL fix. Deploy this to stop duplicates at the source.**
