# Speed-to-Lead Automation

**Goal:** When someone replies positively to a cold email, automatically research their firm and generate a custom report in under 5 minutes.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd /Users/fardeenchoudhury/clawd/speed-to-lead
npm install
```

This installs:
- `express` - Web server for webhooks
- `playwright` - Web scraping
- `axios` - HTTP requests

### 2. Test the Research Script

Try it on a real law firm website:

```bash
node research.js https://sobirovslawfirm.com
```

You should see:
- ✅ Firm name extracted
- 📍 Location found
- ⚖️ Practice areas detected
- 🏆 Credentials/awards found
- ⚡ Page speed measured

Results saved to `./reports/[firm-name]-research.json`

### 3. Configure Instantly Webhook

**In Instantly Dashboard:**

1. Go to **Settings → Integrations → Webhooks**
2. Click **Add Webhook**
3. Set **Event Type:** "Reply Received"
4. Set **URL:** `http://your-mac-ip:3456/webhook/reply`
   - Find your IP: Open Terminal → `ifconfig | grep "inet "` → use the 192.168.x.x address
   - Or use ngrok (see below)
5. Save

**Using ngrok (recommended for testing):**

```bash
# Install ngrok (one time)
brew install ngrok

# Start tunnel
ngrok http 3456
```

Copy the `https://xxxx.ngrok.io` URL and use that in Instantly webhook settings.

### 4. Start the Webhook Server

```bash
npm start
```

You should see:
```
🚀 Speed-to-Lead Webhook Server Running
📡 Listening on: http://localhost:3456
⏳ Waiting for positive replies...
```

---

## 📋 The Flow (What Happens Automatically)

1. **Positive reply comes in** → Instantly fires webhook
2. **Webhook server receives it** → Extracts lead info
3. **Research script runs** → Scrapes firm website, checks ads, finds competitors
4. **Research saved** → JSON file in `./leads/` folder
5. **Notification created** → Clawdbot gets pinged to generate report

---

## 🛠️ Manual Testing (Before Going Live)

### Test Research Only

```bash
node research.js https://example-lawfirm.com
```

### Simulate a Webhook (Test Full Pipeline)

```bash
curl -X POST http://localhost:3456/webhook/reply \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@smithlawfirm.com",
    "name": "John Smith",
    "company": "Smith Law Firm",
    "body": "Yes, I am interested in learning more about your services."
  }'
```

Check the terminal - you should see the full pipeline run.

---

## 📁 File Structure

```
speed-to-lead/
├── webhook-server.js       ← Receives webhooks from Instantly
├── research.js              ← Scrapes firm data
├── generate-report.js       ← Generates HTML report (via Clawdbot)
├── config.json              ← Your settings (API keys, etc.)
├── package.json             ← Dependencies
├── leads/                   ← Incoming leads + research data
│   ├── [timestamp]-[email].json
│   └── [timestamp]-[email]-research.json
├── reports/                 ← Generated HTML reports
│   └── [firm-name]-report.html
└── pending-reports.txt      ← Queue for Clawdbot to process
```

---

## 🎯 Next Steps (After Research Works)

### Phase 1: Generate Reports (Current)
- Research script working ✅
- Webhook server running ✅
- **→ Wire up report generation via Clawdbot**

### Phase 2: Send Emails
- Draft email with report attached
- Send to Fardeen for approval
- Once approved, send to lead via Instantly API

### Phase 3: Full Automation
- Auto-approve and send (optional)
- Track opens/clicks
- Follow-up sequences

---

## 🔧 Configuration

Edit `config.json`:

```json
{
  "instantly": {
    "apiKey": "YOUR_INSTANTLY_API_KEY",
    "webhookSecret": "YOUR_WEBHOOK_SECRET"
  },
  "mortar": {
    "senderName": "Yaseer Choudhury",
    "senderEmail": "yaseer@mortarmetrics.com",
    "website": "https://mortarmetrics.com/",
    "linkedin": "https://www.linkedin.com/in/yaseer-choudhury/"
  },
  "port": 3456
}
```

---

## 🐛 Troubleshooting

**Webhook not receiving requests?**
- Check firewall settings
- Verify ngrok is running
- Test with `curl` first

**Research script failing?**
- Check internet connection
- Verify Playwright is installed: `npx playwright install`
- Some sites block scrapers - that's normal

**Can't find firm website?**
- Currently auto-guesses from email domain
- Future: manually specify in Instantly custom fields

---

## 📊 Monitoring

**Check pending reports:**
```bash
cat pending-reports.txt
```

**Check recent leads:**
```bash
ls -lt leads/
```

**Test health:**
```bash
curl http://localhost:3456/health
```

---

## 🚨 Important Notes

1. **Human approval first** - Reports go to you before sending to leads
2. **Research takes 2-3 minutes** - Some sites are slow
3. **Some sites block scraping** - We'll handle failures gracefully
4. **Instantly webhook rate limits** - They may batch notifications

---

## 🎉 You're Ready!

Once the webhook server is running and Instantly is configured, you're live. Every positive reply will automatically trigger research and report generation.

**Questions?** Ask Clawdbot (me) anything.
