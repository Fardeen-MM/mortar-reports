# CLAUDE.md — Mortar Reports System Context

## What This Project Is

Mortar Reports is an automated marketing report system for Mortar Metrics, a legal marketing agency. When a law firm lead replies "interested" to a cold email, the system:

1. **Instantly.ai** sends webhook → **Cloudflare Worker** (`cloudflare-worker/worker.js`) forwards to GitHub
2. **GitHub Actions** (`process-interested-lead.yml`) triggers the pipeline
3. **Research engine** (`automation/maximal-research-v2.js` + `automation/extract-firm-info.js`) scrapes the firm's website with Playwright and extracts intelligence using Claude Sonnet 4
4. **AI research helper** (`automation/ai-research-helper.js`) fetches real competitor data via Google Places API
5. **Normalizer** (`automation/normalize-research-data.js`) reshapes data for the report generator
6. **Report generator** (`automation/report-generator-v12-hybrid.js`) produces a personalized HTML landing page
7. **CSS** lives in `automation/report-v9-css.js`
8. Report saves to `pending-reports/{FirmName}/` (NOT live until approved)
9. **Telegram bot** (`automation/telegram-approval-bot.js`) sends approval request with inline buttons
10. On approve: **email workflow** (`approve-and-send-email.yml`) moves report to live folder + sends email via Instantly API

## The Owner

Fardeen — runs Mortar Metrics. Not a developer. Wants reports that sell outcomes to law firm partners, not technical marketing jargon. The principle: lawyers don't care about products, they want to stop losing cases to competitors and fix what's broken.

## Design System

- Fonts: Fraunces (serif, headings) + Outfit (sans-serif, body)
- Glass morphism effects, dark backgrounds, modern typography
- Reports must match mortarmetrics.com aesthetic
- Hero section should dominate viewport

---

## System Audit Status (2026-02-03)

All critical issues from the original audit have been fixed.

### ✅ FIXED — Competitor Data
- **Was:** `findCompetitors()` generated fake names via AI, random ratings/reviews with `Math.random()`
- **Now:** Uses Google Places API to fetch real firms with real ratings and review counts
- **Test:** Doss Law (Toronto) returns Russell Alexander (4.9★, 1604 reviews), GOLDSTEIN (4.8★, 127 reviews), Divorce Go (4.9★, 484 reviews)

### ✅ FIXED — "You" Column
- **Was:** Always showed ❌ for everything even if firm had the capability
- **Now:** Shows firm's actual scraped data (afterHoursAvailable, hasLiveChat, hasGoogleAds, hasMetaAds)

### ✅ FIXED — Case Studies
- **Was:** Hardcoded "Phoenix tax attorney: 0 → 47 leads/month", "Austin family law", "Dallas litigation", "23 times"
- **Now:** Removed fabricated claims, proof grid shows system benefits (24/7, <5 min response, attribution)

### ✅ FIXED — Gap Math
- **Was:** Rigged to hit arbitrary targets, forced gaps to sum to hero total, identical inputs for all firms
- **Now:** Honest calculations, inputs vary by market size (major metro 1.8x, small market 0.8x) and firm size

### ✅ FIXED — Hero Total
- **Was:** Defaulted to $19K hardcoded
- **Now:** Calculated FROM the gap calculations (not reverse-engineered)

### ✅ FIXED — Gap Assumptions
- **Was:** Always claimed firm has no Google Ads, no Meta Ads, no after-hours
- **Now:** Checks research data first; if firm has capability, shows optimization opportunity instead

### ✅ FIXED — Pipeline Order
- **Was:** Report deployed to live folder BEFORE approval
- **Now:** Report saves to `pending-reports/` folder, only moves to live on explicit approval

### ✅ FIXED — Validation
- **Was:** "Unknown Firm" and garbage names got through
- **Now:** Rejects Unknown Firm, names >60 chars; sends Telegram failure alert

### ✅ FIXED — Statistics
- **Was:** Unsourced claims like "65%", "73%", "2.5 hours"
- **Now:** Removed or softened

### ✅ FIXED — Attack-Style Titles
- **Was:** "${firmName} is invisible when it matters"
- **Now:** Market-focused: "Search visibility opportunity", "After-hours intake opportunity"

---

## Remaining Known Issues

- LinkedIn scraping fails (blocked by LinkedIn) — accept limitation
- Google scraping from GitHub Actions IPs sometimes blocked — Places API is more reliable
- Cloudflare Worker dedup uses in-memory Map (resets on cold start) — consider KV store
- Cloudflare Worker has no authentication — add shared secret header
- Telegram approve button callback needs webhook handler deployed

## Testing

```bash
# Generate report for any research JSON
node automation/report-generator-v12-hybrid.js reports/doss-law-research.json "Test User"

# Open the generated HTML
open automation/reports/doss-law-landing-page-v12-hybrid.html

# List available research files
ls reports/*-research.json
```

## Key Files

| File | Purpose |
|------|---------|
| `automation/report-generator-v12-hybrid.js` | Main report generator |
| `automation/ai-research-helper.js` | Google Places API for competitors |
| `automation/normalize-research-data.js` | Data normalization |
| `automation/maximal-research-v2.js` | Website scraping + AI extraction |
| `.github/workflows/process-interested-lead.yml` | Main pipeline |
| `.github/workflows/approve-and-send-email.yml` | Approval + deployment |

## Working With Fardeen

- He's not a developer — explain what you're doing in plain English
- He wants reports that sell outcomes: "stop losing cases to competitors"
- He gives brutal honest feedback — iterate based on it
- Always test changes against a real research JSON before pushing
- The research JSONs are in `reports/` — use one as a test fixture
