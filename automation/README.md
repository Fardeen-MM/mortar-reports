# Mortar Metrics - Automated Lead Processing

## Overview

This automation processes interested leads from Instantly and generates personalized marketing reports.

**Flow:**
1. Lead replies with interest in Instantly
2. Instantly webhook triggers GitHub Actions
3. GitHub Actions runs research + generates report
4. Report deployed to `https://reports.mortarmetrics.com/{firm-slug}/`
5. Follow-up email sent via Instantly API with report link
6. Slack notification sent

---

## Setup Instructions

### 1. Configure GitHub Secrets

Go to your repo **Settings → Secrets and variables → Actions** and add:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `GH_PAT` | `ghp_WqWQ...` | GitHub Personal Access Token (already added) |
| `INSTANTLY_API_KEY` | `YjRmMDBj...` | Instantly API Key (base64 encoded) |
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/...` | Slack webhook for notifications |

**To add secrets:**
1. Go to: https://github.com/Fardeen-MM/mortar-reports/settings/secrets/actions
2. Click **New repository secret**
3. Add each secret above

---

### 2. Get Slack Webhook URL

1. Go to: https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. Name: `Mortar Reports Bot`
4. Choose your workspace
5. Click **Incoming Webhooks** → Enable
6. Click **Add New Webhook to Workspace**
7. Choose channel (e.g., `#leads` or `#notifications`)
8. Copy the webhook URL (starts with `https://hooks.slack.com/services/...`)
9. Add it as `SLACK_WEBHOOK_URL` secret in GitHub

---

### 3. Configure Instantly Webhook

1. Go to Instantly → **Settings → Integrations → Webhooks**
2. Click **Add Webhook**
3. **Webhook URL:** 
   ```
   https://api.github.com/repos/Fardeen-MM/mortar-reports/dispatches
   ```
4. **Events to trigger:**
   - Select: `lead_interested` ✅
5. **Headers:**
   ```
   Authorization: Bearer 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
   Accept: application/vnd.github.v3+json
   Content-Type: application/json
   ```
6. **Click Save**

---

### 4. Test the Workflow

**Option 1: Manual Test via GitHub Actions**

1. Go to: https://github.com/Fardeen-MM/mortar-reports/actions
2. Click **Process Interested Lead** workflow
3. Click **Run workflow** dropdown
4. You'll need to trigger via API (see below)

**Option 2: Trigger via API**

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
      "first_name": "John",
      "last_name": "Doe",
      "website": "https://www.example.com",
      "campaign_name": "Test Campaign",
      "reply_text": "Interested!"
    }
  }'
```

---

## Webhook Payload Format

Instantly will send webhooks in this format when a lead is marked as interested:

```json
{
  "event_type": "lead_interested",
  "timestamp": "2026-01-29T21:00:00Z",
  "lead_email": "david@wlg.com",
  "campaign_name": "Law Firm Outreach Q1",
  "reply_text": "Interested, send me more info",
  "reply_subject": "Re: Grow your practice",
  "email_id": "abc123xyz",
  "first_name": "David",
  "last_name": "Salvaggio",
  "website": "https://www.wlg.com"
}
```

**Important Fields:**
- `email_id` - **CRITICAL** - Used to reply in the same email thread (not start a new one)
- `website` - Lead's company website for research
- `first_name`, `last_name` - For personalization

**Email Threading:**
The follow-up email will be sent as a **REPLY** in the same thread:
```
Thread: Your cold email → They reply "interested" → You reply "Here's the report"
```
This keeps the conversation natural and improves engagement.

---

## Report URL Structure

Reports are deployed to:
```
https://reports.mortarmetrics.com/{firm-slug}/
```

Example:
- Input: `https://www.weinbergerlawgroup.com`
- Slug: `weinbergerlawgroup`
- Report URL: `https://reports.mortarmetrics.com/weinbergerlawgroup/`

---

## Files

- `research-v3-DEEP.js` - Deep website research script
- `report-generator-v7.js` - Report HTML generator
- `send-email.js` - Instantly API email sender
- `package.json` - Node.js dependencies
- `reports/` - Temporary storage for generated reports

---

## Troubleshooting

### Workflow not triggering
1. Check Instantly webhook configuration
2. Verify webhook URL is correct
3. Check GitHub Actions logs: https://github.com/Fardeen-MM/mortar-reports/actions

### Research failing
1. Check if website URL is valid
2. Verify Playwright is installed
3. Check timeout settings (15 min max)

### Email not sending
1. Verify `INSTANTLY_API_KEY` secret is set
2. Check Instantly API logs
3. Verify sender email is configured in Instantly

### Slack notification not working
1. Verify `SLACK_WEBHOOK_URL` secret is set
2. Test webhook URL manually:
   ```bash
   curl -X POST $SLACK_WEBHOOK_URL \
     -H 'Content-Type: application/json' \
     -d '{"text":"Test notification"}'
   ```

---

## Monitoring

**GitHub Actions Logs:**
https://github.com/Fardeen-MM/mortar-reports/actions

**Slack Notifications:**
Check your configured Slack channel for real-time updates

**Reports:**
Browse all reports: https://reports.mortarmetrics.com/

---

## Cost

- **GitHub Actions:** Free (2,000 minutes/month)
- **GitHub Pages:** Free
- **Instantly API:** Included in your plan
- **Slack:** Free

**Total: $0/month** ✅
