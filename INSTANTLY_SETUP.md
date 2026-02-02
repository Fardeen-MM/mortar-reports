# Instantly Speed-to-Lead System

## Overview

Automated system that receives reply webhooks from Instantly, researches the lead's firm, and generates personalized response drafts.

## Architecture

```
Instantly → Webhook → Research → Draft → Review → Send
```

### Flow
1. **Webhook receives reply** from Instantly
2. **Stores reply data** in `replies/` folder
3. **Triggers research** (async, non-blocking)
4. **Fetches firm website** via jina.ai
5. **Generates draft** using Claude 3 Haiku
6. **Saves draft** for review

## Setup

### 1. Install Dependencies

None! Uses only Node.js built-ins + `curl`.

Requires: Anthropic API key (Claude 3 Haiku - fast & cheap)

### 2. Set Environment Variables

```bash
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export INSTANTLY_WEBHOOK_PORT=3500  # Optional, defaults to 3500
```

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
source ~/.zshrc
```

### 3. Start the Webhook Server

```bash
node /Users/fardeenchoudhury/clawd/webhooks/instantly-webhook.js
```

Or run in background:

```bash
nohup node /Users/fardeenchoudhury/clawd/webhooks/instantly-webhook.js > /tmp/instantly-webhook.log 2>&1 &
```

### 4. Expose to Internet (ngrok)

```bash
ngrok http 3500
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 5. Configure Instantly Webhook

1. Go to Instantly → Settings → Webhooks
2. Add webhook URL: `https://abc123.ngrok.io/webhook`
3. Select event: **reply_received**
4. Save

## Usage

### Check Webhook Status

```bash
curl http://localhost:3500/health
```

### View Pending Replies

```bash
ls -lh /Users/fardeenchoudhury/clawd/replies/
```

### Read a Reply Draft

```bash
cat /Users/fardeenchoudhury/clawd/replies/<reply-id>.json | jq '.draft.draft'
```

### Monitor Logs (if running in background)

```bash
tail -f /tmp/instantly-webhook.log
```

## File Structure

```
clawd/
├── webhooks/
│   └── instantly-webhook.js    # Webhook server
├── scripts/
│   └── research-lead.js        # Research + draft generation
└── replies/
    └── <timestamp>-<email>.json  # Reply data + draft
```

## Reply Data Format

```json
{
  "replyId": "2026-01-30T...",
  "timestamp": "2026-01-30T15:23:45Z",
  "event_type": "reply_received",
  "email_id": "abc-123",
  "lead_email": "partner@lawfirm.com",
  "reply_text": "Interested, tell me more",
  "campaign_name": "Law Firms Q1",
  "email_account": "fardeen@mortarmetrics.com",
  "unibox_url": "https://app.instantly.ai/...",
  "status": "draft_ready",
  "research": {
    "domain": "lawfirm.com",
    "content": "...",
    "fetched_at": "..."
  },
  "draft": {
    "draft": "Hi [Name], thanks for your interest...",
    "model": "claude-3-haiku-20240307",
    "generated_at": "..."
  }
}
```

## Next Steps

- [ ] Build approval UI/CLI
- [ ] Add Instantly API send function
- [ ] Auto-send approved drafts
- [ ] Add Slack notifications for new replies

## Troubleshooting

**Webhook not receiving events?**
- Check ngrok is running: `curl https://your-ngrok-url/health`
- Check Instantly webhook config
- Check webhook logs: `tail -f /tmp/instantly-webhook.log`

**Research failing?**
- Check jina.ai is accessible: `curl -s https://r.jina.ai/https://google.com`
- Check domain extraction logic

**Draft generation failing?**
- Verify `ANTHROPIC_API_KEY` is set: `echo $ANTHROPIC_API_KEY`
- Check Anthropic API status: https://status.anthropic.com

**Threading not working?**
- Ensure `email_id` from webhook is being passed as `reply_to_uuid` when sending via Instantly API
