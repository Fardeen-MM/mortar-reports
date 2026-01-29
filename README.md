# Mortar Metrics - Client Reports

This repository hosts personalized marketing analysis reports for Mortar Metrics clients.

**Live Site:** https://reports.mortarmetrics.com/

---

## How It Works

1. **Interested lead** replies to our Instantly campaign
2. **Automation kicks in:**
   - Research their website
   - Analyze competitors
   - Generate personalized report
3. **Report deployed** to `https://reports.mortarmetrics.com/{firm-name}/`
4. **Follow-up email** sent automatically with report link
5. **Slack notification** sent to our team

**Time:** Lead → Report generated → Email sent in **under 5 minutes**

---

## Report Examples

- [Weinberger Law Group](https://reports.mortarmetrics.com/weinbergerlawgroup/)
- [WR Immigration](https://reports.mortarmetrics.com/wrimmigration/)

---

## For Developers

See [automation/README.md](automation/README.md) for setup instructions.

---

## Tech Stack

- **Research:** Node.js + Playwright
- **Report Generation:** Custom HTML templates
- **Hosting:** GitHub Pages
- **Email:** Instantly API
- **Notifications:** Slack
- **Automation:** GitHub Actions (fully serverless)

**Cost:** $0/month ✅
