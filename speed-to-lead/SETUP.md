# Setup Instructions

## ⚠️ Fix npm First (One-Time)

Your npm cache has permission issues. Fix it once:

```bash
sudo chown -R $(whoami) ~/.npm
```

Enter your Mac password when prompted.

---

## 📦 Install Dependencies

```bash
cd /Users/fardeenchoudhury/clawd/speed-to-lead
npm install
```

This installs:
- express (web server)
- playwright (web scraping)
- axios (HTTP requests)

After install, run:
```bash
npx playwright install chromium
```

---

## ✅ Test It Works

### Test 1: Research a Law Firm

```bash
node research.js https://sobirovslawfirm.com
```

Should print:
- ✅ Firm Name
- 📍 Location
- ⚖️ Practice Areas
- 🏆 Credentials
- ⚡ Page Speed

And save `reports/sobirovs-law-firm-research.json`

### Test 2: Start Webhook Server

```bash
npm start
```

Should show:
```
🚀 Speed-to-Lead Webhook Server Running
📡 Listening on: http://localhost:3456
```

Leave it running.

### Test 3: Simulate a Webhook

Open a NEW terminal window:

```bash
curl -X POST http://localhost:3456/webhook/reply \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@smithlawfirm.com",
    "name": "John Smith", 
    "company": "Smith Law Firm",
    "body": "Yes interested"
  }'
```

Check the first terminal - you should see the research running!

---

## 🔗 Connect Instantly (After Testing Works)

### Option A: Use ngrok (Easiest)

```bash
# Install ngrok
brew install ngrok

# Start tunnel (in a new terminal)
ngrok http 3456
```

Copy the `https://xxxx.ngrok-free.app` URL.

In Instantly:
1. Settings → Webhooks
2. Add Webhook
3. Event: "Reply Received"
4. URL: `https://xxxx.ngrok-free.app/webhook/reply`
5. Save

### Option B: Expose Your Mac Directly

1. Find your local IP: `ifconfig | grep inet`
2. Look for `192.168.x.x`
3. In Instantly, use: `http://192.168.x.x:3456/webhook/reply`
4. May need to allow in firewall

---

## 🎯 You're Done!

Once the server is running and Instantly is connected, every positive reply will trigger automatic research.

**Next:** Ask Clawdbot to generate reports from the research data.
