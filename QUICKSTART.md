# Instantly Webhook - Quick Start

## 🚀 First Time Setup

### 1. Set your Anthropic API key
```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

To make it permanent, add to `~/.zshrc`:
```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
source ~/.zshrc
```

### 2. Start the webhook
```bash
./scripts/start-webhook.sh start
```

### 3. Expose to internet (ngrok)
```bash
ngrok http 3500
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 4. Configure Instantly
1. Go to **Instantly** → **Settings** → **Webhooks**
2. Add webhook: `https://abc123.ngrok.io/webhook`
3. Select event: **reply_received**
4. Save

---

## 📋 Daily Commands

### Check webhook status
```bash
./scripts/start-webhook.sh status
```

### View all replies
```bash
node scripts/view-replies.js
```

### View specific reply
```bash
node scripts/view-replies.js view <reply-id>
```

### View logs
```bash
./scripts/start-webhook.sh logs
```

### Stop webhook
```bash
./scripts/start-webhook.sh stop
```

---

## 🔄 Testing

### Send a test webhook
```bash
curl -X POST http://localhost:3500/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "reply_received",
    "email_id": "test-123",
    "lead_email": "test@lawfirm.com",
    "reply_text": "Interested in learning more",
    "campaign_name": "Test Campaign",
    "email_account": "you@mortarmetrics.com",
    "unibox_url": "https://app.instantly.ai/test"
  }'
```

After 5-10 seconds, check:
```bash
node scripts/view-replies.js
```

---

## 📂 Where Things Are

- **Webhook server**: `webhooks/instantly-webhook.js`
- **Research script**: `scripts/research-lead.js`
- **Reply data**: `replies/*.json`
- **Logs**: `/tmp/instantly-webhook.log`

---

## ⚡ Speed-to-Lead Goal

**Target**: Reply within **5 minutes** of lead response.

Current flow:
1. ✅ **Instant**: Webhook receives reply
2. ✅ **~5s**: Research firm website
3. ✅ **~2s**: Generate draft (Claude 3 Haiku)
4. ⏳ **Manual**: Review draft (you)
5. ⏳ **Manual**: Send via Instantly (next step to automate)

---

## 🐛 Troubleshooting

**Webhook not receiving?**
```bash
# Check health
curl http://localhost:3500/health

# Check ngrok
curl https://your-ngrok-url/health
```

**Research failing?**
```bash
# Test jina.ai
curl -s https://r.jina.ai/https://google.com | head -20

# Test Anthropic
echo $ANTHROPIC_API_KEY  # Should not be empty
```

**Need to reset?**
```bash
./scripts/start-webhook.sh restart
```
