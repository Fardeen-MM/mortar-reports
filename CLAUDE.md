# CLAUDE.md  -  Mortar Reports System Context

## What This Project Is

Mortar Reports is an automated marketing report system for Mortar Metrics, a legal marketing agency. When a law firm lead replies "interested" to a cold email, the system:

1. **Instantly.ai** sends webhook → **Cloudflare Worker** (`cloudflare-worker/worker.js`) forwards to GitHub
2. **GitHub Actions** (`process-interested-lead.yml`) triggers the pipeline
3. **Research engine** (`automation/maximal-research-v2.js`) scrapes firm's website with Playwright + Claude Sonnet 4
4. **Report generator** (`automation/report-generator-v3.js`) fetches real competitors via Google Places API and produces HTML
5. Report saves to `pending-reports/{FirmName}/` (NOT live until approved)
6. **Telegram bot** sends approval request with inline buttons
7. On approve: **email workflow** moves report to live folder + sends email via Instantly API

## The Owner

Fardeen  -  runs Mortar Metrics. Not a developer. Wants reports that sell outcomes to law firm partners. Principle: lawyers want to stop losing cases to competitors, not hear about marketing products.

## Design System

- Fonts: Fraunces (serif, headings) + Outfit (sans-serif, body)
- Container: 820px max-width
- Colors: cream background (#FDFCF9), indigo primary (#4f46e5), ink text (#0a0a0a)
- Reports must match mortarmetrics.com aesthetic

---

## System Status: ✅ PRODUCTION READY

Last verified: 2026-02-04

All components working:
- Cloudflare Worker receiving webhooks ✅
- Research engine scraping + AI extraction ✅
- V3 Report generator with real competitors ✅
- Telegram approval flow ✅
- Email sending via Instantly ✅

---

## Report V3 Structure

```
┌────────────────────────────────────────┐
│ HEADER: Mortar Metrics · Prepared for  │
├────────────────────────────────────────┤
│ HERO: Typing animation search bar      │
│ "They find other firms. Not yours."    │
│ 2 minute read ↓                        │
├────────────────────────────────────────┤
│ GAP 1: Google Ads (badge, math box)    │
│ GAP 2: Meta Ads (badge, math box)      │
│ GAP 3: Voice AI (before/after)         │
├────────────────────────────────────────┤
│ TOTAL STRIP: Black bar with range      │
├────────────────────────────────────────┤
│ COMPETITOR BARS: Horizontal review chart│
├────────────────────────────────────────┤
│ BUILD LIST: Numbered 1-4 with timelines│
├────────────────────────────────────────┤
│ CTA: Booking widget                    │
│ FOOTER                                 │
└────────────────────────────────────────┘
```

**V3 Removed:** TLDR boxes, section labels ("GAP #1"), flow diagrams, proof grid, two-options guilt trip, fake case studies, exact numbers

**V3 Added:** Gap cards with badges, horizontal bar chart, total strip, numbered build list, math boxes with RANGES and CAVEATS, practice-area-specific client labels

---

## Key Files

| File | Purpose |
|------|---------|
| `cloudflare-worker/worker.js` | Receives Instantly webhook + Telegram callbacks, forwards to GitHub |
| `.github/workflows/process-interested-lead.yml` | Main pipeline: research → report → staging → Telegram |
| `.github/workflows/approve-and-send-email.yml` | On approval: deploy → email |
| `automation/maximal-research-v2.js` | Scrapes firm website with Playwright + Claude Sonnet 4 |
| `automation/extract-firm-info.js` | Claude AI extracts firm details from scraped pages |
| `automation/report-generator-v3.js` | Generates V3 HTML report from research data |
| `automation/report-v3-css.js` | V3 styling (820px container, gap cards, horizontal bars) |
| `automation/ai-research-helper.js` | Google Places API for real competitors + search terms |
| `automation/telegram-approval-bot.js` | Sends Telegram approval request with buttons |
| `automation/send-email.js` | Sends email via Instantly API |
| `automation/email-templates.js` | Email subject/body templates |

---

## Math Logic

### Gap 1 (Google Ads)
```
~searches × 3.5% CTR × 12% inquiry × 25% close × case value
```

### Gap 2 (Meta Ads)
```
~audience × 1.5% ad reach × 0.8% conversion × 25% close × case value
```

### Gap 3 (Voice AI)
```
~calls × 35% after-hours × 60% won't voicemail × 70% recoverable × case value
```

### Market Multipliers
- Major metros (NYC, LA, Chicago, Toronto): **1.8x**
- Mid-size cities: **1.2x**
- Small markets: **0.8x**

### Case Values by Practice Area
- Personal Injury: $8K-15K
- Medical Malpractice: $12K-20K
- Divorce/Family: $4K-6K
- Immigration: $3.5K-5K
- Landlord: $3K-5K
- Criminal: $4K-7K
- Tax: $3.5K-5.5K

---

## Testing

```bash
# Generate V3 report locally
cd /Users/fardeenchoudhury/mortar-reports/automation
node report-generator-v3.js ../speed-to-lead/reports/doss-law-research.json "Test User"

# Open generated HTML
open reports/doss-law-report-v3.html

# Test research engine (requires ANTHROPIC_API_KEY)
node maximal-research-v2.js "https://www.example-law.com" "John Smith" "Chicago" "IL" "US" "Example Law Firm"
```

---

## API Keys

| Key | Location | Purpose |
|-----|----------|---------|
| Google Places API | Hardcoded in `ai-research-helper.js` | Real competitor data |
| Anthropic | GitHub secret `ANTHROPIC` | Claude AI for research |
| Telegram Bot | GitHub secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Approval notifications |
| Instantly | GitHub secret `INSTANTLY_API_KEY` | Email sending |
| GitHub PAT | GitHub secret `GH_PAT` | Workflow commits |

---

## Folder Structure

```
mortar-reports/
├── automation/
│   ├── reports/           # Generated reports (local testing)
│   ├── pending-approvals/ # Approval JSON files
│   ├── maximal-research-v2.js
│   ├── report-generator-v3.js
│   └── ...
├── pending-reports/       # Reports awaiting approval (staging)
│   └── {FirmName}/
│       └── index.html
├── {FirmName}/            # LIVE reports (after approval)
│   └── index.html
├── cloudflare-worker/
│   └── worker.js
├── .github/workflows/
│   ├── process-interested-lead.yml
│   └── approve-and-send-email.yml
└── speed-to-lead/reports/ # Historical research JSONs
```

---

## Known Limitations

- **LinkedIn scraping fails**  -  blocked by LinkedIn, accept limitation
- **Cloudflare Worker dedup**  -  uses in-memory Map, resets on cold start
- **Cloudflare Worker auth**  -  no authentication (relies on obscurity)
- **Google Places API**  -  may fail from certain IPs, returns empty array gracefully

---

## Working With Fardeen

- Not a developer  -  explain in plain English
- Wants reports that sell outcomes
- Gives brutal honest feedback  -  iterate on it
- Always test against real research JSON before pushing
- Research JSONs are in `speed-to-lead/reports/`

---

## Previous Fix Log (2026-02-03/04)

All issues from previous sessions have been resolved:

1. ✅ Competitor data  -  now uses Google Places API (real firms)
2. ✅ "You" column  -  shows firm's actual capabilities
3. ✅ Case studies  -  removed all fabricated claims
4. ✅ Gap math  -  honest calculations with ranges, no rigging
5. ✅ Hero total  -  calculated from gaps, no $19K default
6. ✅ Gap assumptions  -  checks firm's actual capabilities
7. ✅ Pipeline order  -  pending folder until approved
8. ✅ Validation  -  rejects "Unknown Firm" and garbage names
9. ✅ Statistics  -  removed unsourced percentage claims
10. ✅ Attack-style titles  -  reframed as opportunities
11. ✅ Normalizer fallbacks  -  no fake competitors

---

## Fix Log (2026-02-05): AI Report Perfector Verbose Labels

**Problem:** AI Report Perfector failing with score 3/10. Root cause was `clientLabel` being set to verbose phrases like "individual going through a divorce" instead of concise labels like "spouse" or "divorcing client". This created awkward sentences appearing 4+ times in reports.

**Why perfector couldn't fix it:**
- 3 iterations wasn't enough for complex phrasing issues
- Whole-HTML replacement is fragile for 800+ line files
- The source (report generator) was creating bad content

**Solution implemented (two-part fix):**

### Part 1: `report-generator-v3.js` (lines 154-162)
Added clientLabel length validation after AI content generation:
```javascript
if (clientLabel && clientLabel.split(' ').length > 3) {
  console.log(`⚠️  Client label too verbose: "${clientLabel}", using fallback`);
  const fallback = CLIENT_LABELS[practiceArea] || CLIENT_LABELS['default'];
  clientLabel = fallback.singular;
  clientLabelPlural = fallback.plural;
  articleForClient = getArticle(clientLabel);
}
```

### Part 2: `ai-report-perfector.js`
1. **Increased MAX_ITERATIONS** from 3 to 5 (line 21)
2. **Added `preFixCommonIssues()` function** (lines 504-569)  -  direct string replacement for known verbose phrases before AI QC runs
3. **Integrated pre-pass** into perfection loop (lines 846-849)

**Verbose phrases now auto-fixed:**
- "individual going through a divorce" → "divorcing client"
- "person going through divorce" → "divorcing client"
- "family member dealing with estate" → "someone planning their estate"
- "individual facing immigration issues" → "immigration client"
- "individual injured in an accident" → "accident victim"
- + many more patterns

**Result:** Reports now generate with concise client labels. Perfector has safety net for any that slip through.
