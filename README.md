# Mortar Metrics - Client Reports

Automated marketing analysis reports for law firms. When a lead replies "interested" to a cold email, the system researches their firm, generates a personalized report, and sends it — all in under 5 minutes.

**Live Site:** https://reports.mortarmetrics.com/

---

## How It Works

1. **Lead replies** to an Instantly cold email campaign
2. **Cloudflare Worker** receives the webhook, merges data, forwards to GitHub
3. **GitHub Actions** runs the pipeline:
   - Scrapes the firm's website with Playwright + Claude AI
   - Finds real competitors via Google Places API
   - Generates a personalized HTML report with gap analysis
   - Runs AI-powered QC (28 deterministic checks + skeptic review + conversion critic)
4. **Telegram approval** — report preview sent for review with approve/reject/edit buttons
5. **On approve** — report goes live, follow-up email sent via Instantly API

**Time:** Lead reply → report live → email sent in **~2 minutes**

---

## Architecture

```
Instantly Webhook
       ↓
Cloudflare Worker (merge + classify + forward)
       ↓
GitHub Actions (process-interested-lead.yml)
  ├── Research Engine (Playwright + Claude Sonnet)
  ├── Report Generator (HTML with gap analysis)
  ├── AI Report Perfector (QC + auto-fix)
  └── Telegram Approval Bot
       ↓
GitHub Actions (approve-and-send-email.yml)
  ├── Deploy report (pending → live)
  └── Send email (Instantly API v2)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `cloudflare-worker/worker.js` | Webhook receiver + Telegram callback handler |
| `.github/workflows/process-interested-lead.yml` | Main pipeline: research → report → QC → approval |
| `.github/workflows/approve-and-send-email.yml` | Deploy report + send email on approval |
| `automation/maximal-research-v2.js` | Website scraper + AI extraction |
| `automation/report-generator-v3.js` | HTML report generator |
| `automation/ai-report-perfector.js` | QC pipeline (28 checks + AI review) |
| `automation/ai-research-helper.js` | Google Places API + search terms |
| `automation/telegram-approval-bot.js` | Telegram approval with inline buttons |
| `automation/send-email.js` | Instantly API v2 email sender |
| `automation/email-templates.js` | Email subject/body builder |

---

## Report Structure

Each report analyzes three marketing gaps with revenue estimates:

- **Gap 1: Google Ads** — search volume x CTR x inquiry rate x case value
- **Gap 2: Meta Ads** — audience reach x conversion x case value
- **Gap 3: Voice AI** — missed calls x recovery rate x case value

Plus: real competitor comparison, build plan with timelines, and booking CTA.

---

## Repo Structure

```
mortar-reports/
├── .github/workflows/       # CI/CD pipelines
├── automation/               # Core scripts (research, report gen, QC, email)
├── cloudflare-worker/        # Webhook proxy + Telegram handler
├── speed-to-lead/            # Playwright research engine
├── pending-reports/          # Staging (pre-approval)
├── {FirmName}/               # Live reports (post-approval)
└── CLAUDE.md                 # Detailed system docs
```

---

## Tech Stack

- **Research:** Node.js + Playwright + Claude Sonnet
- **Competitors:** Google Places API
- **Reports:** Custom HTML (Fraunces + Outfit fonts, 820px container)
- **QC:** 28 deterministic checks + Claude Haiku (skeptic) + Claude Sonnet (conversion critic)
- **Hosting:** GitHub Pages
- **Email:** Instantly API v2
- **Approval:** Telegram Bot (inline keyboards)
- **Webhook:** Cloudflare Worker + KV
- **CI/CD:** GitHub Actions

---

## Secrets Required

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC` | Claude AI for research + QC |
| `GOOGLE_PLACES_API_KEY` | Competitor lookup via Places API |
| `GOOGLE_API_KEY` | LinkedIn lookup in QC |
| `INSTANTLY_API_KEY` | Email sending |
| `TELEGRAM_BOT_TOKEN` | Approval notifications |
| `TELEGRAM_CHAT_ID` | Telegram chat target |
| `GH_PAT` | Workflow commits |
