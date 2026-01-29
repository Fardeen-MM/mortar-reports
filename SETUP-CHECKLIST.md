# Setup Checklist for Automation

## ✅ What's Already Done

1. ✅ GitHub Actions workflow created (`.github/workflows/process-interested-lead.yml`)
2. ✅ Research script copied to automation folder
3. ✅ Report generator copied to automation folder
4. ✅ Email sender script created (`automation/send-email.js`)
5. ✅ Package.json created with dependencies
6. ✅ Documentation created (README files)
7. ✅ Reports index page created

---

## 🔧 What You Need to Do

### Step 1: Add GitHub Secrets

Go to: https://github.com/Fardeen-MM/mortar-reports/settings/secrets/actions

Click **New repository secret** and add each of these:

| Secret Name | Value | Where to get it |
|-------------|-------|-----------------|
| `GH_PAT` | `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` | ✅ Already have it |
| `INSTANTLY_API_KEY` | `YjRmMDBjYTMtZjk2OS00NGI4LWIyODUtMDg0MTc5MGU5MjQ5Okd3emlGVWVvamdFaQ==` | ✅ Already have it |
| `ANTHROPIC_API_KEY` | Get from Anthropic Console | ⬇️ See below |
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/YOUR/WEBHOOK/URL` | ⬇️ See Step 2 below |

---

### Get Anthropic API Key (for AI Analysis)

1. Go to: https://console.anthropic.com/
2. Sign up or log in
3. Go to **API Keys** section
4. Click **Create Key**
5. Copy the API key (starts with `sk-ant-...`)
6. Add it as `ANTHROPIC_API_KEY` secret in GitHub

**Cost:** ~$1-2 per report (Claude Sonnet 4)
- First $5 is free (Anthropic gives credit)
- After that, pay as you go
- Budget: ~$100-200/month for 100 reports

---

### Step 2: Get Slack Webhook URL

1. Go to: https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. App Name: `Mortar Reports Bot`
4. Choose your Slack workspace
5. Click **Incoming Webhooks** (left sidebar)
6. Toggle **Activate Incoming Webhooks** to ON
7. Click **Add New Webhook to Workspace**
8. Select channel: `#leads` (or create a new channel like `#mortar-reports`)
9. Click **Allow**
10. Copy the Webhook URL (starts with `https://hooks.slack.com/services/...`)
11. Go back to GitHub secrets and add it as `SLACK_WEBHOOK_URL`

---

### Step 3: Configure Instantly Webhook

1. Log in to Instantly: https://app.instantly.ai/
2. Go to **Settings → Integrations → Webhooks**
3. Click **Create Webhook** or **Add Webhook**
4. Fill in:

**Webhook URL:**
```
https://api.github.com/repos/Fardeen-MM/mortar-reports/dispatches
```

**Event Types** (select these):
- ✅ `lead_interested`

**Headers** (add these):
```
Authorization: Bearer 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
Accept: application/vnd.github.v3+json
Content-Type: application/json
```

**Payload Mapping** (if Instantly asks):
```json
{
  "event_type": "interested_lead",
  "client_payload": {
    "lead_email": "{{lead.email}}",
    "first_name": "{{lead.first_name}}",
    "last_name": "{{lead.last_name}}",
    "website": "{{lead.website}}",
    "campaign_name": "{{campaign.name}}",
    "reply_text": "{{reply.text}}",
    "email_id": "{{email.id}}"
  }
}
```

**Important:** The `email_id` field is critical - it allows us to reply in the same email thread instead of starting a new conversation.

5. Click **Save** or **Create**

---

### Step 4: Push Code to GitHub

```bash
cd /Users/fardeenchoudhury/clawd
git add .
git commit -m "Add automated lead processing pipeline"
git push origin main
```

(Or if you haven't set up the remote yet):
```bash
git remote add origin https://github.com/Fardeen-MM/mortar-reports.git
git branch -M main
git push -u origin main
```

---

### Step 5: Test the Automation

**Option 1: Test via API**

```bash
curl -X POST \
  https://api.github.com/repos/Fardeen-MM/mortar-reports/dispatches \
  -H "Authorization: Bearer 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" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "interested_lead",
    "client_payload": {
      "lead_email": "test@example.com",
      "first_name": "Test",
      "last_name": "User",
      "website": "https://www.example.com",
      "campaign_name": "Test Campaign",
      "reply_text": "Interested!"
    }
  }'
```

**Option 2: Mark a lead as "Interested" in Instantly**

1. Go to any campaign in Instantly
2. Find a test lead
3. Mark them as "Interested"
4. Wait 2-5 minutes
5. Check:
   - GitHub Actions: https://github.com/Fardeen-MM/mortar-reports/actions
   - Slack for notification
   - Report URL: `https://reports.mortarmetrics.com/{slug}/`

---

## 📊 Monitoring

**GitHub Actions Logs:**
https://github.com/Fardeen-MM/mortar-reports/actions

**Check if workflow ran:**
- Green checkmark = Success ✅
- Red X = Failed ❌
- Yellow dot = Running ⏳

**Slack Channel:**
You'll get notifications for:
- ✅ Report generated successfully
- ❌ Errors/failures

---

## 🐛 Troubleshooting

### Workflow not triggering
- Check Instantly webhook is configured correctly
- Verify the webhook URL matches exactly
- Check Instantly webhook logs (if available)

### Research script fails
- Check if website URL is valid
- May timeout for slow sites (15 min max)
- Check GitHub Actions logs for error details

### Email not sending
- Verify `INSTANTLY_API_KEY` is correct
- Check Instantly API key has send permissions
- May need to configure sender email in Instantly settings

### Report not deploying
- Check `GH_PAT` has `repo` permissions
- Verify GitHub Pages is enabled on the repo
- DNS may take 5-10 min to propagate

---

## 📝 Next Steps After Setup

Once automation is working:

1. **Test with real leads** - Mark a few leads as interested and verify reports generate
2. **Customize email template** - Edit `automation/send-email.js` to adjust wording
3. **Add more fields** - Enhance research by adding custom fields to Instantly
4. **Monitor performance** - Watch GitHub Actions logs for failures
5. **Optimize** - Adjust timeout, add retry logic, improve error handling

---

## 💰 Cost Breakdown

- **GitHub Actions:** Free (2,000 min/month included)
- **GitHub Pages:** Free
- **Instantly API:** Already paying for Instantly
- **Slack:** Free tier is fine

**Total monthly cost: $0** ✅

---

## 🎯 Expected Performance

- **Research time:** 2-4 minutes per lead
- **Report generation:** 10-20 seconds
- **Email delivery:** 5-10 seconds
- **Total time:** ~3-5 minutes from interest to email sent

**Goal:** Under 5 minutes from "Interested" → Report in their inbox ⚡
