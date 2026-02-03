# CLAUDE.md — Mortar Reports System Context

## What This Project Is

Mortar Reports is an automated marketing report system for Mortar Metrics, a legal marketing agency. When a law firm lead replies "interested" to a cold email, the system:

1. **Instantly.ai** sends webhook → **Cloudflare Worker** (`cloudflare-worker/worker.js`) forwards to GitHub
2. **GitHub Actions** (`process-interested-lead.yml`) triggers the pipeline
3. **Research engine** (`automation/maximal-research-v2.js` + `automation/extract-firm-info.js`) scrapes the firm's website with Playwright and extracts intelligence using Claude Sonnet 4
4. **AI research helper** (`automation/ai-research-helper.js`) generates competitor data
5. **Normalizer** (`automation/normalize-research-data.js`) reshapes data for the report generator
6. **Report generator** (`automation/report-generator-v12-hybrid.js`) produces a personalized HTML landing page
7. **CSS** lives in `automation/report-v9-css.js`
8. Report deploys to **GitHub Pages** at `reports.mortarmetrics.com/{FirmName}/`
9. **Telegram bot** (`automation/telegram-approval-bot.js`) sends approval request with inline buttons
10. On approve: **email workflow** (`approve-and-send-email.yml`) sends the report link via Instantly API

## The Owner

Fardeen — runs Mortar Metrics. Not a developer. Wants reports that sell outcomes to law firm partners, not technical marketing jargon. The principle: lawyers don't care about products, they want to stop losing cases to competitors and fix what's broken.

## Design System

- Fonts: Fraunces (serif, headings) + Outfit (sans-serif, body)
- Glass morphism effects, dark backgrounds, modern typography
- Reports must match mortarmetrics.com aesthetic
- Hero section should dominate viewport

---

## CRITICAL: Full System Audit

A complete line-by-line audit has been performed on every file. Below are ALL issues found, organized by priority.

### 🔴 WEEK 1 FIXES — Trust Issues (Do These First)

#### 1. Competitor Names Are Fabricated
**Files:** `automation/ai-research-helper.js` lines 454-550
- `findCompetitors()` asks Claude Haiku to "Generate exactly 3 REAL law firm names" — they're AI-invented
- Fallback generates random surname pairs (Anderson, Brown, Carter, Davis, etc.)
- `deepCompetitorResearch()` then Googles these fake names and gets nothing
- Competitor ratings are `Math.random()` (line 490): `(4.5 + Math.random() * 0.4).toFixed(1)`
- Competitor review counts are `Math.random()` (line 491): `Math.floor(20 + Math.random() * 130)`
- Google Ads status is coin flip (line 492): `Math.random() > 0.5`
- Meta Ads status is coin flip (line 493): `Math.random() > 0.6`
- Voice AI status is coin flip (line 494): `Math.random() > 0.8` — NEVER overwritten by research
**FIX:** Replace `findCompetitors()` with Google Maps API search for `"{practice area} lawyer near {city, state}"`. Returns real firms with real ratings, real review counts. Costs ~$0.03/request. If Google Maps API isn't feasible, use a SERP API to scrape actual Google results. As a last resort, remove the competitor section entirely rather than show fake names — any lawyer who Googles a competitor from the report and finds nothing loses all trust instantly.

#### 2. "You" Column Is Always Negative
**File:** `automation/report-generator-v12-hybrid.js` lines 971-992
- ALWAYS shows: Reviews `—`, Rating `—`, Google Ads `❌`, Meta Ads `❌`, 24/7 Intake `❌`
- Even if the firm HAS reviews, IS running ads, DOES have after-hours service
- Research engine DOES scrape this data (Phase 3: Google Business, Phase 1.5: afterHoursAvailable, hasLiveChat) but the report generator NEVER uses it
**FIX:** Pass the firm's real Google Business data into the competitor table. Show their actual rating and review count. Check extracted data for `afterHoursAvailable`, `hasLiveChat`, etc. Show ✓ where the firm actually has capability.

#### 3. Case Studies May Be Fabricated — Verify or Remove
**File:** `automation/report-generator-v12-hybrid.js`
- "Phoenix tax attorney: 0 → 47 leads/month" (lines 786, 1075-1077) — hardcoded in every report
- "Austin family law firm: 23 leads in first month from Meta" (line 830) — hardcoded in every report
- "Dallas litigation firm: close rate 18% → 31%" (lines 880, 1081-1083) — hardcoded in every report
- "We've built this 23 times" (lines 651, 1012, 1061) — appears 3 times
**FIX:** If these are real case studies, keep them. If fabricated, remove them or replace with honest language like "We've built this system for law firms across the country." Ask Fardeen to verify.

#### 4. Proof Grid Shows Wrong Practice Areas
**File:** `automation/report-generator-v12-hybrid.js` line 1089
- `<p>Tax, family, PI, immigration—same system works</p>` appears for EVERY firm
- A landlord law firm or bankruptcy firm sees practice areas that aren't theirs
**FIX:** Make dynamic — include the target firm's actual practice area in the list.

### 🔴 WEEK 2 FIXES — Math Honesty

#### 5. Gap Calculations Are Rigged
**File:** `automation/report-generator-v12-hybrid.js` lines 500-560
- Takes hero total (default $19K), splits 40%/35%/25% as targets
- Calculates from formula with hardcoded inputs
- If formula result is >15% off target → REPLACES with target
- Forces gap3 = heroTotal - gap1 - gap2
- Report shows formula AND dollar amount, but formula doesn't produce that amount
**FIX:** Either use real inputs (search volume from Google Keyword Planner API, population-based audience sizes) OR show ranges instead of exact numbers. Remove the rigging — if the math gives $3.6K, show $3.6K, not $7.6K.

#### 6. All Gap Inputs Are Identical for Every Firm
- Gap 1: 600 searches, 3% CTR, 15% conversion, 30% close — same for rural Montana and Manhattan
- Gap 2: 50,000 audience — same for Des Moines and NYC
- Gap 3: 60 calls/month — same for solo practitioner and 50-attorney firm
**FIX:** At minimum, vary by market size and firm size. The research engine extracts `firmSize` and `officeCount` — use them.

#### 7. Hero Total Defaults to $19,000
**Files:** `automation/report-generator-v12-hybrid.js` line 281, `automation/normalize-research-data.js` line 60
- `const totalMonthly = estimatedMonthlyRevenueLoss || 19000`
- Research rarely produces revenue estimate, so most reports show $19K
**FIX:** Calculate from case values × estimated case volume based on market size.

#### 8. Gaps Assume Firm Has Nothing
- Gap 1 assumes no Google Ads. Gap 2 assumes no social presence. Gap 3 assumes no after-hours.
- Research extracts `hasLiveChat`, `afterHoursAvailable`, `socialMediaPresence` — all ignored
**FIX:** Check research data before generating each gap. If firm already has after-hours answering, don't claim calls go to voicemail. Skip that gap or reframe it.

### 🟡 WEEK 3 FIXES — Pipeline Issues

#### 9. Report Deploys BEFORE Approval
**File:** `.github/workflows/process-interested-lead.yml`
- "Deploy report to GitHub Pages" runs before "Send Telegram approval request"
- Rejected reports are still live. No cleanup step exists.
**FIX:** Generate report → save locally → send Telegram approval → on approve: deploy + email. On reject: don't deploy.

#### 10. "Unknown Firm" Reports Get Through
- Evidence: `pending-approvals/UnknownFirm.json` exists — validation catches it but workflow still deploys
**FIX:** If report generator returns GENERATION_BLOCKED, workflow should exit without deploying/committing/sending Telegram.

#### 11. Firm Name Extraction Produces Garbage
- Evidence: `LandlordAttorneysMichigan&OhioPropertyOwnerLegalDefensePaletzLawManufacturedHousingpaletzLaw`
**FIX:** Add sanity check — if name >60 chars or contains `/`, flag for review or truncate.

#### 12. Telegram Approve Button Has No Backend
- Buttons appear but no webhook handler listens for callbacks
**FIX:** Deploy a Telegram webhook handler (Cloudflare Worker) that triggers the `approve-and-send-email` workflow.

#### 13. No Failure Alerting
- If pipeline fails, only evidence is in GitHub Actions logs
**FIX:** Add failure notification step that sends Telegram message on error.

### 🟢 WEEK 4 FIXES — Quality

#### 14. Research Data That's Extracted But Never Used
The research engine extracts all of this but the report generator ignores it:
- Firm's Google rating/reviews (Phase 3)
- After-hours availability (Phase 1.5)
- Live chat, social media presence, blog activity
- Awards, credentials, firm personality
- Founded year, firm size, office count
- Notable cases, client testimonials, USPs, growth indicators
- The entire AI synthesis from Phase 7
**FIX:** Wire this data into the report. Use firm size to scale calculations. Show awards/credentials in authority section. Use AI synthesis for personalized insights.

#### 15. Statistics May Be Unsourced
- "65% of high-intent legal searches click on ads" — real CTR is 3-6%. Likely conflates different stats.
- "73% of people searching for lawyers do it outside business hours" — used in math formula AND as displayed stat
- "Your clients spend 2.5 hours/day on social media" — global average, not specific to law firm clients
**FIX:** Verify and cite sources, or soften language ("most" instead of exact percentages).

#### 16. Firm Name Used in Attack-Style Titles
- "${firmName} is invisible when it matters"
- "${firmName}'s after-hours calls go to voicemail"
**FIX:** Reframe as market problems: "Invisible searches in {city}", "After-hours calls in {practiceArea}"

#### 17. Formula Strings Show "$" Even for UK Firms
**File:** `automation/report-generator-v12-hybrid.js` lines 573-580
**FIX:** Use the `currency` variable in formula strings.

#### 18. Email Claims Don't Match Reality
- "I analyzed your top competitors" — competitors are fabricated
- "Everything is specific to your firm—no generic fluff" — mostly generic
**FIX:** Fix these claims AFTER fixing the underlying issues (competitors, personalization).

---

## Other Known Issues

- LinkedIn scraping fails (blocked by LinkedIn) — accept or remove
- Google scraping from GitHub Actions IPs gets blocked — consider SERP API
- `findCompetitors()` passes generic "legal services" instead of extracted practice areas (maximal-research-v2.js line 652)
- `normalize-research-data.js` creates "City Law Firm A/B/C" fallback competitors that bypass blocklist
- Cloudflare Worker dedup uses in-memory Map (resets on cold start) — use KV store
- Cloudflare Worker has no authentication — add shared secret header
- `send-email.js` looks for wrong research file pattern (misses `-maximal-research.json`)
- Competitor generation uses cheapest AI model (Haiku) while website extraction uses best (Sonnet 4) — priorities backwards

## Key Principle

The research engine is genuinely good. It extracts valuable intelligence. The report generator throws most of it away and fills gaps with hardcoded templates, fabricated data, and rigged math. The fix is connecting the research output to the report input. The data is there — it's just not being used.

## Working With Fardeen

- He's not a developer — explain what you're doing in plain English
- He wants reports that sell outcomes: "stop losing cases to competitors"
- He gives brutal honest feedback — iterate based on it
- Always test changes against a real research JSON before pushing
- The research JSONs are in `automation/reports/` — use one as a test fixture
