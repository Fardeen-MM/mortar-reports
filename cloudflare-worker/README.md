# Cloudflare Worker: Instantly → GitHub Proxy

This worker receives webhooks from Instantly and transforms them to GitHub's required format.

## What It Does

1. **Receives** webhook from Instantly (any format)
2. **Transforms** to GitHub's required format:
   - Changes `"lead_interested"` to `"interested_lead"`
   - Wraps data in `"client_payload"`
3. **Forwards** to GitHub Actions to trigger workflow

## Setup Environment Variable

Before deploying, set the GitHub token in Cloudflare Dashboard:

1. Go to Workers → instantly-webhook-proxy → Settings → Variables
2. Add environment variable:
   - Name: `GITHUB_TOKEN`
   - Value: Your GitHub Personal Access Token (repo:write scope)
   - Type: Secret

Or via CLI:
```bash
wrangler secret put GITHUB_TOKEN
# Paste your token when prompted
```

## Deploy

```bash
cd cloudflare-worker
npx wrangler deploy
```

This will:
- Deploy the worker to Cloudflare
- Give you a URL like: `https://instantly-webhook-proxy.YOUR-SUBDOMAIN.workers.dev`

## Configure Instantly

Once deployed, set Instantly webhook URL to:

```
https://instantly-webhook-proxy.YOUR-SUBDOMAIN.workers.dev
```

**Method:** POST  
**Event:** reply_received or lead_interested  

No special headers or payload format needed - the worker handles it.

## Test

```bash
curl -X POST https://instantly-webhook-proxy.YOUR-SUBDOMAIN.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "lead_email": "test@example.com",
    "first_name": "Test",
    "last_name": "User",
    "website": "https://example.com"
  }'
```

Should return: `{"success":true,"message":"Webhook forwarded to GitHub Actions"}`

## View Logs

```bash
npx wrangler tail
```

Or in Cloudflare dashboard: Workers → instantly-webhook-proxy → Logs
