# Telegram Approval Setup

Approve/reject email sends directly from Telegram with one tap!

---

## Step 1: Create Telegram Bot

1. **Open Telegram** and search for [@BotFather](https://t.me/botfather)

2. **Start a chat** with BotFather

3. **Create bot:**
   ```
   /newbot
   ```

4. **Name your bot:**
   ```
   Mortar Metrics Approvals
   ```

5. **Choose username** (must end in "bot"):
   ```
   mortar_metrics_approval_bot
   ```

6. **Copy the token** (looks like):
   ```
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

7. **Save it** - you'll need this for `TELEGRAM_BOT_TOKEN`

---

## Step 2: Get Your Chat ID

### Option A: Use @userinfobot
1. Search for [@userinfobot](https://t.me/userinfobot) in Telegram
2. Start a chat
3. It will send you your Chat ID
4. Copy the number (like `123456789`)

### Option B: Manual method
1. Send a message to your new bot
2. Visit:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
3. Look for `"chat":{"id":123456789}`
4. Copy the ID number

---

## Step 3: Add Secrets to GitHub

Go to: https://github.com/Fardeen-MM/mortar-reports/settings/secrets/actions

**Add two secrets:**

1. **TELEGRAM_BOT_TOKEN**
   - Value: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

2. **TELEGRAM_CHAT_ID**
   - Value: `123456789`

---

## Step 4: Test Locally (Optional)

```bash
cd automation

# Set environment variables
export TELEGRAM_BOT_TOKEN="your_token_here"
export TELEGRAM_CHAT_ID="your_chat_id_here"

# Create a test approval file
cat > test-approval.json << EOF
{
  "firm_name": "Test Firm",
  "lead_email": "test@example.com",
  "contact_name": "John Doe",
  "report_url": "https://reports.mortarmetrics.com/TestFirm/",
  "email_id": "",
  "created_at": "2026-01-30T20:00:00Z",
  "status": "pending_approval"
}
EOF

# Send test approval request
node telegram-approval-bot.js test-approval.json
```

You should receive a message in Telegram with **Approve/Reject** buttons!

---

## Step 5: Set Up Webhook Handler (Production)

For button presses to trigger email sends, you need to run the webhook handler.

### Option A: Deploy to Railway/Render/Fly.io

1. Deploy `telegram-webhook-handler.js` to a hosting platform
2. Get your public URL (e.g., `https://your-app.railway.app`)
3. Set webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://your-app.railway.app/webhook"}'
   ```

### Option B: Use GitHub Actions (Simpler)

The `approve-and-send-email.yml` workflow can be triggered from the Telegram bot callback.

Update `telegram-webhook-handler.js` to trigger GitHub Actions via API instead of running locally.

---

## How It Works

### When a Lead Comes In:

1. **GitHub Actions runs** (research → report → deploy)
2. **Telegram message sent** to you with:
   ```
   🟡 REPORT READY FOR APPROVAL
   
   📊 Firm: Roth Jackson
   👤 Contact: Andrew Condlin
   📧 Email: andrew@rothjackson.com
   
   🔗 Review Report: [link]
   
   [✅ Approve & Send]  [❌ Reject]  [🔗 Open Report]
   ```

3. **You tap a button:**
   - ✅ **Approve** → Email sent immediately
   - ❌ **Reject** → No email sent

4. **Message updates** to show result:
   ```
   ✅ APPROVED & SENT
   
   ✉️ Email sent successfully!
   ```

---

## Test the Full Flow

1. **Resend a lead** from Instantly
2. **Wait 30-45 seconds** for processing
3. **Check Telegram** for approval request
4. **Tap Approve** ✅
5. **Email sent!** ✉️

---

## Troubleshooting

### "Can't send message to bot"
- Make sure you **started a chat** with your bot first
- Send `/start` to your bot

### "Invalid bot token"
- Check the token in GitHub Secrets
- Make sure there are no extra spaces

### "Chat not found"
- Verify your Chat ID is correct
- Use @userinfobot to double-check

### Buttons don't work
- Make sure webhook handler is running
- Check webhook status:
  ```bash
  curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
  ```

---

## Security Notes

- ✅ Only YOU can approve (your Chat ID)
- ✅ Bot token is secret (in GitHub Secrets)
- ✅ Webhook validates requests
- ✅ No one else can send emails

---

**Once set up, approvals are ONE TAP away!** 🚀📱
