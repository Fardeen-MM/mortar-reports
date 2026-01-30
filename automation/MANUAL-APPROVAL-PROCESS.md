# Manual Email Approval Process

## Overview

**ALL emails now require manual approval** before being sent to prospects. This ensures every report and email is perfect before going out.

---

## How It Works

### 1. Lead Comes In (Automatically)
When someone replies "interested" in Instantly:
1. ✅ Instantly webhook triggers GitHub Actions
2. ✅ **AI Firm Intelligence research** runs (100% AI-powered)
3. ✅ **AI personalized analysis** enhances the data
4. ✅ Report is **generated and deployed** to GitHub Pages
5. 🟡 **Workflow STOPS** - awaiting your approval
6. 🔔 **Slack notification** sent with review link

### 2. Review the Report (You)
Check Slack for notification:
```
🟡 AWAITING MANUAL APPROVAL

📊 Report Generated:
🏢 Firm: RothJackson
👤 Contact: Andrew Condlin
📧 Email: andrew@rothjackson.com
🔗 Report: https://reports.mortarmetrics.com/RothJackson/

⚠️  ACTION REQUIRED:
1. Review the report
2. Go to: https://github.com/Fardeen-MM/mortar-reports/actions/workflows/approve-and-send-email.yml
3. Click 'Run workflow'
4. Fill in the details and approve
```

**Review checklist:**
- ✅ Firm name correct?
- ✅ Research data accurate?
- ✅ Report looks professional?
- ✅ AI insights personalized?
- ✅ Ready to send?

### 3. Approve & Send (Manual)
If everything looks good:

1. Go to: https://github.com/Fardeen-MM/mortar-reports/actions/workflows/approve-and-send-email.yml

2. Click **"Run workflow"** button (top right)

3. Fill in the form:
   ```
   Firm Name: RothJackson
   Lead Email: andrew@rothjackson.com
   Report URL: https://reports.mortarmetrics.com/RothJackson/
   Email ID: [from Slack notification - for threading]
   Contact Name: Andrew Condlin
   ```

4. Click **"Run workflow"** (green button)

5. ✅ Email sent!
6. ✅ Slack confirmation received

---

## What's AI-Powered (100%)

### Research (law-firm-research.js)
- ✅ **Firm positioning** - AI analyzes their unique value prop
- ✅ **Key specialties** - AI identifies top practice areas from content
- ✅ **Firm size** - AI estimates boutique/mid-size/large
- ✅ **Recent news** - AI finds announcements, hires, wins
- ✅ **Growth signals** - AI spots expansion patterns
- ✅ **Credentials** - AI extracts awards, rankings
- ✅ **Locations** - AI identifies all office addresses
- ✅ **Sample attorneys** - AI pulls 2-3 names for personalization

**NO pattern matching. NO keyword searching. Pure AI.**

### AI Analysis (ai-analyzer.js)
- ✅ **Personalized hook** - AI writes firm-specific opening
- ✅ **Gap explanations** - AI contextualizes what gaps mean FOR THEM
- ✅ **Opportunity frame** - AI crafts compelling pitch
- ✅ **Market positioning** - AI analyzes competitive landscape

---

## Pending Approvals

All pending reports are stored in:
```
pending-approvals/{FirmName}.json
```

Each contains:
```json
{
  "firm_name": "RothJackson",
  "lead_email": "andrew@rothjackson.com",
  "contact_name": "Andrew Condlin",
  "report_url": "https://reports.mortarmetrics.com/RothJackson/",
  "email_id": "msg_abc123",
  "created_at": "2026-01-30T20:15:00Z",
  "status": "pending_approval"
}
```

---

## Why Manual Approval?

1. **Quality Control** - Every email represents your brand
2. **AI Verification** - Ensure AI extraction is accurate
3. **Personalization Check** - Verify insights are compelling
4. **Zero Mistakes** - Catch any issues before they go out
5. **Build Trust** - Only send when you're 100% confident

---

## Quick Links

- **Review Reports**: https://reports.mortarmetrics.com/
- **Approve & Send**: https://github.com/Fardeen-MM/mortar-reports/actions/workflows/approve-and-send-email.yml
- **View Workflow Runs**: https://github.com/Fardeen-MM/mortar-reports/actions
- **Pending Approvals**: https://github.com/Fardeen-MM/mortar-reports/tree/main/pending-approvals

---

## Future: Auto-Approve for Trusted Patterns

Once you've reviewed 50+ reports and trust the system:
- Add confidence thresholds (e.g., auto-send if confidence > 9/10)
- Whitelist certain firms/industries
- A/B test automated vs manual

**For now: 100% manual approval to ensure perfection.** 🎯
