# CLAUDE.md — Mortar Reports System Context

## What This Project Is

Mortar Reports is an automated marketing report system for Mortar Metrics, a legal marketing agency. When a law firm lead replies "interested" to a cold email, the system:

1. **Instantly.ai** sends webhook → **Cloudflare Worker** (`cloudflare-worker/worker.js`) forwards to GitHub
2. **GitHub Actions** (`process-interested-lead.yml`) triggers the pipeline
3. **Research engine** (`automation/maximal-research-v2.js`) scrapes firm's website with Playwright + Claude Sonnet 4
4. **Report generator** (`automation/report-generator-v12-hybrid.js`) fetches real competitors via Google Places API and produces HTML
5. Report saves to `pending-reports/{FirmName}/` (NOT live until approved)
6. **Telegram bot** sends approval request
7. On approve: **email workflow** moves report to live folder + sends email via Instantly API

## The Owner

Fardeen — runs Mortar Metrics. Not a developer. Wants reports that sell outcomes to law firm partners. Principle: lawyers want to stop losing cases to competitors, not hear about marketing products.

## Design System

- Fonts: Fraunces (serif, headings) + Outfit (sans-serif, body)
- Glass morphism effects, dark backgrounds
- Reports must match mortarmetrics.com aesthetic

---

## Complete Fix Log (2026-02-03/04 Session)

### 1. Competitor Data — FIXED
**Problem:** `findCompetitors()` in `automation/ai-research-helper.js` generated fake names via AI prompt or random surname pairs. Ratings/reviews were `Math.random()`.

**Solution:** Replaced with Google Places API integration.
- Searches `"{practice area} lawyer {city, state}"`
- Returns real firms with real ratings and review counts
- API key hardcoded: `AIzaSyA2ZN122gLi2zNGI5dckM88BMyP8Ni4obc`
- If API fails, returns empty array (report shows "market opportunity" messaging)

**Test result:**
```
Doss Law (Toronto, family law) →
- Russell Alexander Collaborative Family Lawyers (4.9★, 1604 reviews)
- GOLDSTEIN Divorce & Family Law Group (4.8★, 127 reviews)
- Divorce Go (4.9★, 484 reviews)
```

### 2. "You" Column — FIXED
**Problem:** Competitor table always showed ❌ for firm even if they had reviews/ads/24x7.

**Solution:** `generateCompetitors()` now accepts `firmData` parameter and displays:
- `firmData.googleReviews` / `firmData.googleRating`
- `firmData.hasGoogleAds` / `firmData.hasMetaAds`
- `firmData.afterHoursAvailable` / `firmData.hasLiveChat`

Shows ✓ where firm has capability, ❌ where they don't, — for unknown.

### 3. Case Studies — FIXED
**Problem:** Hardcoded fabricated claims:
- "Phoenix tax attorney: 0 → 47 leads/month"
- "Austin family law firm: 23 leads in first month"
- "Dallas litigation firm: close rate 18% → 31%"
- "We've built this 23 times"

**Solution:** Removed all fabricated claims. Proof grid now shows system benefits:
- 24/7 lead capture
- <5 min response time
- 100% attribution

### 4. Gap Math — FIXED
**Problem:** Math was rigged:
- Took hero total (default $19K), split 40%/35%/25%
- If formula result >15% off target → replaced with target
- Forced gap3 = heroTotal - gap1 - gap2

**Solution:** `calculateGaps()` rewritten:
- Hero total calculated FROM gaps (not reverse)
- Inputs vary by market size (major metro 1.8x, mid-size 1.2x, small 0.8x)
- Inputs vary by firm size (uses `firmSize`, `officeCount` from research)
- No rigging — if math gives $3.6K, shows $3.6K

Market multipliers in `getMarketMultiplier()`:
- Major metros (NYC, LA, Chicago, Toronto, etc.): 1.8x
- Mid-size cities: 1.2x
- Small markets: 0.8x

### 5. Hero Total — FIXED
**Problem:** `const totalMonthly = estimatedMonthlyRevenueLoss || 19000` hardcoded.

**Solution:** Hero total = sum of gap calculations. No default fallback.

### 6. Gap Assumptions — FIXED
**Problem:** Gaps assumed firm has nothing (no ads, no after-hours, etc.)

**Solution:** Each gap function checks firm's actual capabilities:
- `generateGap1()` checks `firmData.hasGoogleAds` — if true, shows "optimization opportunity"
- `generateGap2()` checks `firmData.hasMetaAds` — if true, shows "optimization opportunity"
- `generateGap3()` checks `firmData.afterHoursAvailable` / `firmData.hasLiveChat` — if true, shows optimization

### 7. Pipeline Order — FIXED
**Problem:** Report deployed to live folder BEFORE approval.

**Solution:**
- Reports save to `pending-reports/{FirmName}/` (new folder)
- `approve-and-send-email.yml` now moves from `pending-reports/` to live folder on approval
- Only committed to repo after approval

### 8. Validation — FIXED
**Problem:** "Unknown Firm" and garbage names got through.

**Solution:** Added validation step in workflow:
- Rejects if firm name is empty, "Unknown Firm", or "Unknown"
- Rejects if firm name >60 characters
- Sends Telegram failure notification with reason

### 9. Statistics — FIXED
**Problem:** Unsourced claims: "65% of high-intent clicks", "73% outside business hours", "2.5 hours/day on social"

**Solution:** Removed all specific percentage claims. Language softened.

### 10. Attack-Style Titles — FIXED
**Problem:** "${firmName} is invisible when it matters", "${firmName}'s after-hours calls go to voicemail"

**Solution:** Reframed as market opportunities:
- "Search visibility opportunity"
- "Social media opportunity"
- "After-hours intake opportunity"

### 11. Normalizer Fallbacks — FIXED
**Problem:** `normalize-research-data.js` created fake "City Law Firm A/B/C" competitors.

**Solution:** Returns empty array if no real competitors. No fake fallbacks.

---

## Current Issue (In Progress)

**GitHub Actions workflow completes but reports not deploying**

Symptoms:
- Workflow shows ✅ success
- "Send failure notification" step runs
- "Store report in pending folder" step skipped
- No new files committed

Debug logging added (commit 842d21f) to show:
- Contents of reports directory
- Which research file was found
- Full report generator output
- Exit code

**Next lead from Instantly will reveal the issue.**

Possible causes:
1. Research file not found (wrong path pattern)
2. Google Places API failing from GitHub Actions IPs
3. Report generator throwing unhandled error

---

## Key Files Modified

| File | Changes |
|------|---------|
| `automation/ai-research-helper.js` | Replaced fake competitor generation with Google Places API |
| `automation/report-generator-v12-hybrid.js` | Async, fetches competitors if missing, uses firm data, honest math |
| `automation/normalize-research-data.js` | Removed fake fallback competitors, removed $19K default |
| `.github/workflows/process-interested-lead.yml` | Added validation, failure alerts, pending-reports folder, debug logging |
| `.github/workflows/approve-and-send-email.yml` | Moves report from pending to live on approval |

---

## Testing

```bash
# Generate report locally (works)
node automation/report-generator-v12-hybrid.js reports/doss-law-research.json "Test User"

# Open generated HTML
open automation/reports/doss-law-landing-page-v12-hybrid.html

# List research files
ls reports/*-research.json
```

---

## API Keys

- **Google Places API:** Hardcoded in `ai-research-helper.js` as `AIzaSyA2ZN122gLi2zNGI5dckM88BMyP8Ni4obc`
- **Anthropic:** In GitHub secrets as `ANTHROPIC`
- **Telegram:** In GitHub secrets as `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- **Instantly:** In GitHub secrets as `INSTANTLY_API_KEY`

---

## Remaining Known Issues

- LinkedIn scraping fails (blocked) — accept limitation
- Telegram approve button callback needs webhook handler
- Cloudflare Worker dedup uses in-memory Map (resets on cold start)
- Cloudflare Worker has no authentication

---

## Working With Fardeen

- Not a developer — explain in plain English
- Wants reports that sell outcomes
- Gives brutal honest feedback — iterate on it
- Always test against real research JSON before pushing
- Research JSONs are in `reports/`
