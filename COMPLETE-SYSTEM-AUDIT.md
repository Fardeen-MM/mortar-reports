# ClawdBot / Mortar Reports — Complete System Audit

**Date:** February 3, 2026
**Scope:** Every file in the pipeline, end to end
**Method:** Line-by-line code review of all production files

---

## How to Read This

Issues are grouped by system area, not severity. Each issue has:

- **Severity:** 🔴 CRITICAL (breaks trust / blocks sales) · 🟡 HIGH (noticeable, degrades quality) · 🟢 MEDIUM (should fix, won't kill you)
- **File + Line:** Exact location
- **What happens:** The actual behavior
- **Fix:** What to do about it

---

## 1. COMPETITOR DATA (ai-research-helper.js)

### 1.1 🔴 Competitor names are AI-invented, not real
**File:** `ai-research-helper.js` lines 454–500
**What happens:** `findCompetitors()` asks Claude Haiku to "Generate exactly 3 REAL law firm names" — but Claude invents them. The prompt says "use actual law firm naming patterns" and "make them sound legitimate." They're fiction.
**Why it kills you:** Any lawyer who Googles a competitor name from your report sees the firm doesn't exist. You lose all credibility instantly. This is the single biggest risk in the system.
**Fix:** Replace `findCompetitors()` entirely. Options ranked by reliability:
1. **Google Maps API** — Search `"{practice area} lawyer" near {city, state}`, returns real firms with real ratings, real review counts, real addresses. Costs ~$0.03/request. This is the gold standard.
2. **Google search scraping** — Search `"best {practice area} lawyer in {city}"` and extract firm names from results. Free but fragile.
3. **Manual curated list** — For your top 10 target markets, manually research 5-10 real competitors per city/practice area. Store in a JSON lookup file. Most reliable but doesn't scale.
4. **Admit you don't have competitor data** — Better to say "We'll research your competitors during onboarding" than to show fake ones.

### 1.2 🔴 Competitor ratings are Math.random()
**File:** `ai-research-helper.js` line 490
**Code:** `rating: (4.5 + Math.random() * 0.4).toFixed(1)`
**What happens:** Every competitor gets a random rating between 4.5–4.9.
**Fix:** If using Google Maps API (fix 1.1), you get real ratings. If not, show `—` instead of a number. Never show a fabricated rating.

### 1.3 🔴 Competitor review counts are Math.random()
**File:** `ai-research-helper.js` line 491
**Code:** `reviewCount: Math.floor(20 + Math.random() * 130)`
**What happens:** Random number between 20–150.
**Fix:** Same as 1.2 — use real data or show `—`.

### 1.4 🔴 Competitor Google Ads status is a coin flip
**File:** `ai-research-helper.js` line 492
**Code:** `hasGoogleAds: Math.random() > 0.5`
**What happens:** 50/50 chance, no actual checking.
**After deep research:** `deepCompetitorResearch()` checks for `[data-text-ad]` on Google results, but since the firm names are fake, there's no knowledge panel to check. Usually returns false.
**Fix:** Google Ads Transparency Center (https://adstransparency.google.com) lets you search by advertiser name. Or use the Google search scrape — if ads appear when you search the practice area + city, note which firms are advertising.

### 1.5 🔴 Competitor Meta Ads status is a coin flip
**File:** `ai-research-helper.js` line 493
**Code:** `hasMetaAds: Math.random() > 0.6`
**After deep research:** `maximal-research-v2.js` line 386 hardcodes `hasMetaAds: false` with comment "Would need separate Meta Ads API." So if deep research succeeds, it's always false. If it fails, the random value survives.
**Fix:** Facebook Ad Library API (https://www.facebook.com/ads/library/) — search by advertiser name. Free. Or just remove the Meta Ads column from the competitor table until you can actually check.

### 1.6 🟡 Competitor Voice AI / 24/7 Intake is a coin flip
**File:** `ai-research-helper.js` line 494
**Code:** `hasVoiceAI: Math.random() > 0.8`
**What happens:** ~20% chance. `deepCompetitorResearch()` NEVER checks or overwrites this field. The random value always survives to the report.
**Fix:** Hard to detect automatically. Either remove this column or default to `—` (unknown).

### 1.7 🟡 Deprecated comment is ironic
**File:** `ai-research-helper.js` lines 555–560
```javascript
// DEPRECATED - NO LONGER USED
// We never use fake/placeholder competitor names
```
This comment sits directly below the function that generates fake competitor names. The old fallback was removed but replaced with a different function that also fabricates names.
**Fix:** Delete this comment. It's misleading.

### 1.8 🟢 Competitor generation uses cheapest AI model
**File:** `ai-research-helper.js` line 30 — uses `claude-3-haiku-20240307`
**But:** `extract-firm-info.js` and `maximal-research-v2.js` use Claude Sonnet 4.
**What happens:** The most critical AI call (naming competitors that appear in the report) uses the cheapest, oldest model, while website extraction (internal use only) uses the best model.
**Fix:** If you keep any AI-based competitor discovery, use at least Sonnet.

---

## 2. REPORT MATH (report-generator-v12-hybrid.js)

### 2.1 🔴 Gap calculations are rigged to hit predetermined targets
**File:** `report-generator-v12-hybrid.js` lines 500–560
**What happens:**
1. Takes hero total (usually $19K)
2. Splits into targets: 40% / 35% / 25%
3. Runs formula with hardcoded inputs
4. If formula result is >15% off target → **replaces result with target**
5. Forces gap3 = heroTotal - gap1 - gap2 (regardless of formula)
**Why it matters:** The report shows the formula AND the dollar amount, but the formula doesn't produce the claimed amount. Any lawyer with a calculator (or a partner who asks their associate to check) will see it doesn't add up.
**Fix:** Two options:
1. **Make the math real** — Use actual local search volume data (Google Keyword Planner API, ~$0 with an active Google Ads account) to get real monthly searches. Calculate from there. If the number is smaller, show the smaller number.
2. **Show ranges, not exact numbers** — "$5K–$10K/month" is honest. "$7,600/month" with a formula that produces $3,600 is not.

### 2.2 🔴 Gap 1 inputs are hardcoded for all firms
**File:** `report-generator-v12-hybrid.js` lines 509–512
```javascript
const gap1Searches = 600;   // Same for rural Montana and Manhattan
const gap1CTR = 0.03;       // Same for every practice area
const gap1Conv = 0.15;      // Same for every firm
const gap1Close = 0.30;     // Same always
```
**Fix:** At minimum, vary by market size. Use population data or Google Keyword Planner. A PI firm in NYC has 100x the search volume of a tax firm in Boise.

### 2.3 🔴 Gap 2 inputs are hardcoded
**File:** `report-generator-v12-hybrid.js` lines 525–528
**Code:** `const gap2Audience = 50000;` — same for Des Moines and Los Angeles.
**Fix:** Use city population as a rough proxy. Or use Meta's Audience Estimator API if available.

### 2.4 🟡 Gap 3 inputs are hardcoded
**File:** `report-generator-v12-hybrid.js` lines 536–540
**Code:** `const gap3Calls = 60;` — every firm "gets 60 monthly calls."
**Fix:** Vary by firm size. A 2-attorney firm doesn't get 60 calls/month. A 30-attorney firm gets more. The research engine extracts `firmSize` — use it.

### 2.5 🔴 Hero total defaults to $19,000 for most firms
**File:** `report-generator-v12-hybrid.js` line 281
**Code:** `const totalMonthly = estimatedMonthlyRevenueLoss || 19000;`
**Also:** `normalize-research-data.js` line 60: `estimatedMonthlyRevenueLoss: 19000`
**What happens:** The research engine rarely produces a revenue estimate. The normalizer hardcodes $19,000. Most reports show the same hero number.
**Fix:** Calculate from case values × estimated case volume. You already have `CASE_VALUES` per practice area and could estimate volume from market size. Even a rough `caseValue × 3` would be more honest than a flat $19K.

### 2.6 🟢 Formula strings always show "$" even for UK firms
**File:** `report-generator-v12-hybrid.js` lines 573–580
**What happens:** Formula text uses hardcoded `$`. The gap cost line correctly uses the `currency` variable, but the formula string doesn't.
**Fix:** Replace `$${caseValue.toLocaleString()}` in formula strings with `${currency}${caseValue.toLocaleString()}`.

---

## 3. REPORT CONTENT — FALSE CLAIMS

### 3.1 🔴 "We've built this 23 times" (appears 3 times)
**File:** `report-generator-v12-hybrid.js` lines 651, 1012, 1061
**Fix:** Replace with your actual client count, or remove the specific number. "We've built this for law firms across the country" is vague but not a lie.

### 3.2 🔴 "Phoenix tax attorney: 0 → 47 leads/month"
**File:** lines 786, 1075–1077
**Fix:** If this is a real case study, keep it. If it's fabricated, remove it. Replace with real results or remove the proof line entirely.

### 3.3 🔴 "Austin family law firm: 23 leads in first month from Meta"
**File:** line 830
**Fix:** Same — real or remove.

### 3.4 🔴 "Dallas litigation firm: close rate 18% → 31%"
**File:** lines 880, 1081–1083
**Fix:** Same — real or remove.

### 3.5 🟡 Proof grid shows wrong practice areas for every firm
**File:** `report-generator-v12-hybrid.js` line 1089
**Code:** `<p>Tax, family, PI, immigration—same system works</p>`
**What happens:** Every report says this, even for a landlord law firm or bankruptcy firm. The lawyer sees practice areas that aren't theirs.
**Fix:** Make this dynamic: `${practiceLabel}, and others—same system works`. Or list 2-3 practice areas that include the target firm's actual area.

### 3.6 🟡 "65% of high-intent legal searches click on ads"
**File:** lines 767, 780
**What happens:** This stat is presented as fact. Real Google Ads CTR for legal is 3–6%. The 65% claim likely conflates "65% of high-commercial-intent query clicks go to paid results" (a frequently cited but unverified stat) with "65% of people click on ads" (false).
**Fix:** Either cite a real source or soften the language: "Most high-intent legal searches show ads at the top — and the firms running them get the calls." No specific number needed.

### 3.7 🟡 "73% of people searching for lawyers do it outside business hours"
**File:** line 855
**What happens:** Used as a stat AND in the math formula (line 541). No source cited.
**Fix:** This stat is widely cited in legal marketing (Clio's Legal Trends Report has similar data). If you can verify it, cite the source. If not, soften to "the majority of" or "most."

### 3.8 🟢 "Your clients spend 2.5 hours/day on social media"
**File:** lines 811, 824
**What happens:** Global average is roughly correct but attributing it to "your clients" is a stretch.
**Fix:** Change to "The average American spends 2.5 hours/day on social media" — true and sourceable.

---

## 4. THE "YOU" COLUMN — ALWAYS WRONG

### 4.1 🔴 Competitor table "You" column is hardcoded negative
**File:** `report-generator-v12-hybrid.js` lines 971–992
**What happens:** The "You" column ALWAYS shows `—` for reviews/rating and `❌` for Google Ads, Meta Ads, and 24/7 Intake. Even if the firm HAS 200 Google reviews, IS running Google Ads, and DOES have after-hours service.
**Research data available but unused:**
- `research.googleBusiness.rating` (scraped in Phase 3)
- `research.googleBusiness.reviews` (scraped in Phase 3)
- `research.contact.afterHoursAvailable` (extracted in Phase 1.5)
- `research.marketing.hasLiveChat` (extracted in Phase 1.5)
**Fix:** Pass the firm's own data into the competitor table generator. Show their real rating and review count. Check if they're running ads (if research found evidence). If `afterHoursAvailable` is true, show ✓ for 24/7 Intake. This single fix makes the report dramatically more credible — the lawyer sees their own real data reflected back at them.

### 4.2 🟡 Gaps assume firm has nothing — never verified
**What happens:** Gap 1 assumes no Google Ads. Gap 2 assumes no social presence. Gap 3 assumes no after-hours answering. These are stated as facts about the specific firm.
**Data available but unused:**
- `extractedData.hasLiveChat`
- `extractedData.afterHoursAvailable`
- `extractedData.socialMediaPresence`
- `extractedData.hasBlog`
**Fix:** Check the research data before generating each gap. If the firm already has after-hours answering, don't tell them their calls go to voicemail. Either skip that gap or reframe it ("your after-hours system could be working harder").

---

## 5. PIPELINE / WORKFLOW ISSUES

### 5.1 🔴 Report deploys BEFORE approval
**File:** `process-interested-lead.yml` — "Deploy report to GitHub Pages" runs before "Send Telegram approval request"
**What happens:** The report is live at `reports.mortarmetrics.com/FirmName/` before you've even reviewed it. If you reject it in Telegram, the report is still live. There's no step to remove rejected reports.
**Fix:** Restructure the workflow:
1. Generate report → save to `automation/reports/` (not deployed)
2. Send Telegram approval with a preview link (could serve from a staging branch or temporary location)
3. On approve: deploy to GitHub Pages + send email
4. On reject: don't deploy, optionally delete

### 5.2 🟡 "Unknown Firm" reports get through
**Evidence:** `pending-approvals/UnknownFirm.json` and `Unknownfirm.json` both exist — same lead processed twice as "Unknown Firm."
**What happens:** The validation gate in `report-generator-v12-hybrid.js` catches `Unknown Firm` — but the workflow still creates the pending approval file, sends the Telegram message, and commits to git.
**Fix:** Add a validation step in the workflow BEFORE deployment. If the report generator throws `GENERATION_BLOCKED`, the workflow should exit cleanly without deploying, committing, or sending Telegram messages.

### 5.3 🟡 Firm name extraction produces garbage
**Evidence:** `LandlordAttorneysMichigan&OhioPropertyOwnerLegalDefensePaletzLawManufacturedHousingpaletzLaw` — this is the full SEO page title, not a firm name.
**What happens:** `extract-firm-info.js` asks Claude to distinguish between the SEO title and the actual business name, but it sometimes fails. The workflow uses whatever comes back, creating absurd folder names and report headers.
**Fix:** Add a firm name sanity check: if name is >60 characters, or contains multiple `/` characters, or looks like an SEO title, flag it for manual review or truncate to the domain-based name.

### 5.4 🟡 Duplicate pending approvals
**Evidence:** Both `UnknownFirm.json` and `Unknownfirm.json` exist for the same lead (mvogel@abv.com). Same data, same timestamp.
**What happens:** Cloudflare Worker deduplication uses a 5-minute window with in-memory cache. But Cloudflare Workers don't guarantee memory persistence — the cache resets when the worker cold-starts. So duplicates can get through.
**Fix:** Use Cloudflare KV or D1 for durable deduplication instead of in-memory Map. Or add dedup in the GitHub Actions workflow (check if a pending approval already exists for this email).

### 5.5 🟡 Research file lookup in send-email.js is fragile
**File:** `send-email.js` lines 42–55
**What happens:** Tries to find research file by constructing filename from firm name. But research files use a different slug format than the workflow. Pattern: looks for `{slug}-intel-v5.json` or `{slug}-research.json` but the actual file is `{slug}-maximal-research.json`.
**Fix:** Update the filename patterns to include `-maximal-research.json`, or pass the research file path as an argument.

### 5.6 🟢 No error alerting
**What happens:** If the pipeline fails (research timeout, generation blocked, deployment error), the only evidence is in GitHub Actions logs. No Telegram notification, no email, no Slack alert.
**Fix:** Add a failure notification step in the workflow that sends a Telegram message on error: "❌ Pipeline failed for {firm_name}: {error}."

### 5.7 🟢 Telegram approve button has no backend
**File:** `telegram-approval-bot.js` sends messages with inline buttons. `telegram-approve-via-github.js` has the code to trigger the email workflow.
**What happens:** The buttons appear in Telegram, but there's no webhook server listening for button callbacks. When you tap "Approve & Send," nothing happens unless you've set up a separate Telegram bot webhook handler.
**Fix:** Deploy a Telegram webhook handler (could be another Cloudflare Worker) that listens for callback queries and triggers the `approve-and-send-email` workflow.

---

## 6. EMAIL ISSUES

### 6.1 🟡 "I just finished analyzing" — report was generated automatically
**File:** `email-templates.js` lines 17, 100
**What happens:** Follow-up email says "Perfect! I just finished analyzing [firm]." This was generated by a machine in 3 minutes. The phrasing implies a human spent time on it.
**Fix:** Keep the phrasing if you want (it's marketing), but be aware that if a prospect asks "who did this analysis?" you need to have an answer. Consider: "Our team put together an analysis of [firm]" — still implies effort, technically true.

### 6.2 🟡 Email claims "your top 3 competitors" are analyzed
**File:** `email-templates.js` lines 51, 106
**What happens:** "What your top 3 competitors are doing in {city}" — but the competitors are fabricated.
**Fix:** This claim is only valid once you fix the competitor data (Section 1). Until then, remove or soften: "What firms in {city} are doing to capture clients."

### 6.3 🟡 "Everything is specific to your firm — no generic fluff"
**File:** `email-templates.js` line 109
**What happens:** Most of the report IS generic — same gaps, same proof, same solution, same math for all firms.
**Fix:** This claim becomes true only after you fix the personalization (Sections 2, 3, 4). Until then, it's a false promise.

### 6.4 🟢 Meeting day calculation doesn't account for holidays
**File:** `email-templates.js` lines 30–45
**What happens:** Calculates "tomorrow" or "Tuesday" but doesn't check if it's a holiday.
**Fix:** Low priority. Most people understand. But you could add a simple holiday check for US federal holidays.

---

## 7. RESEARCH ENGINE ISSUES (maximal-research-v2.js)

### 7.1 🟡 LinkedIn scraping almost certainly fails
**File:** `maximal-research-v2.js` lines 124–170
**What happens:** Tries to visit LinkedIn company pages in headless Chromium. LinkedIn blocks non-authenticated access. Code catches this gracefully but returns nothing useful.
**Fix:** Either use LinkedIn API (requires partnership), or accept that LinkedIn data won't be available and remove it from the pipeline to save time.

### 7.2 🟡 Google scraping from GitHub Actions IPs gets blocked
**What happens:** The research engine runs Playwright on GitHub Actions Ubuntu runners. Google blocks automated scraping from cloud data center IPs aggressively. Many Google searches (Business data, competitor lookups, news) likely return captcha pages or empty results.
**Fix:** Options:
1. Use a SERP API (SerpAPI, ScaleSerp, etc.) — ~$0.01/search, reliable
2. Use residential proxies — more complex, ~$1–5/GB
3. Move scraping to a local machine or a service with residential IPs

### 7.3 🟡 Phase 6 passes "legal services" as practice area to findCompetitors
**File:** `maximal-research-v2.js` line 652
**Code:** `await aiHelper.findCompetitors(effectiveFirmName, city, state, ['legal services'])`
**What happens:** By Phase 6, the system has already extracted specific practice areas (Phase 1.5). But it passes the generic `['legal services']` instead of the actual extracted practice areas.
**Fix:** Pass `research.practice.practiceAreas` or `research.practice.primaryFocus` instead of the hardcoded string.

### 7.4 🟡 Attorney name extraction from website text is fragile
**File:** `maximal-research-v2.js` lines 631–639
**Code:** Uses regex to match `[FirstName LastName], Partner|Associate|Attorney|Counsel`
**What happens:** This simple pattern misses most attorney names. The AI extraction in Phase 1.5 already gets attorney data much more reliably.
**Fix:** Use `research.team.keyAttorneys` (from the AI extraction) instead of the regex approach for attorney LinkedIn lookups.

### 7.5 🟢 Social media discovery re-navigates to homepage
**File:** `maximal-research-v2.js` lines 264–300
**What happens:** Phase 4 navigates to the firm's website to find social links. But Phase 1 already scraped the entire website. The social links are already in the scraped data.
**Fix:** Extract social links from the already-scraped pages instead of making another request.

---

## 8. DATA FLOW / NORMALIZER ISSUES

### 8.1 🟡 Normalizer creates "City Law Firm A/B/C" fallback competitors
**File:** `normalize-research-data.js` lines 53–56
**What happens:** If research returns <3 competitors, creates `"{City} Law Firm A"`, `"B"`, `"C"`. These WOULD be caught by the blocklist in the report generator... except the blocklist doesn't include these patterns.
**Fix:** Either add `Law Firm [A-Z]$/i` to the blocklist, or better yet, don't create fallback competitors — let the report handle 0 competitors gracefully.

### 8.2 🟡 Normalizer hardcodes all gaps as existing
**File:** `normalize-research-data.js` lines 30–40
**What happens:** If research doesn't have gap data, every gap is assumed to exist with hardcoded impact numbers. `googleAds: { hasGap: true }` even if the firm IS running Google Ads.
**Fix:** Use the extracted data to set gap status. If `research.marketing.hasLiveChat` is true, set `support24x7.hasGap = false`. If the research found evidence of ads, set `googleAds.hasGap = false`.

### 8.3 🟢 Normalizer is bypassed for new-format data
**File:** `normalize-research-data.js` lines 12–13
**Code:** `if (data.gaps) { return data; }` — if the research JSON already has a `gaps` field, it skips normalization entirely.
**What happens:** The maximal-research-v2.js output doesn't include a `gaps` field, so this code path isn't triggered. But if future changes add gaps to the research output, the normalizer would be silently bypassed.
**Fix:** Make the bypass condition more explicit. Check for the new data format specifically, not just the presence of a `gaps` field.

---

## 9. REPORT TEMPLATE / UX ISSUES

### 9.1 🟡 Firm name used in negative/attack-style titles
**File:** `report-generator-v12-hybrid.js` lines 762, 806, 851
- Gap 1: `"${firmName} is invisible when it matters"`
- Gap 2: `"Every ${firmName} visitor could be a client"`
- Gap 3: `"${firmName}'s after-hours calls go to voicemail"`
**What happens:** Reads like an attack on the firm, not an analysis. A senior partner seeing their firm name next to "is invisible" may react defensively.
**Fix:** Reframe as market-level problems, not firm-level failures:
- "Invisible searches in {city}" or "The searches you're missing"
- "Untapped visitor potential"
- "After-hours calls in {practiceArea}"

### 9.2 🟡 "Your area" fallback for missing location
**File:** `report-generator-v12-hybrid.js` line 364
**What happens:** If city/state is missing, hero reads "FOR TAX ATTORNEYS IN " (empty string) or uses "your area." Both look broken.
**Fix:** Make missing location a HARD block, not a warning. A report without location is useless for local marketing. Or at minimum, use the webhook-provided city/state as fallback (it's passed from Instantly).

### 9.3 🟡 Practice area defaults to "LAW"
**File:** `report-generator-v12-hybrid.js` line 469
**What happens:** If practice area can't be categorized, label becomes "LAW" and hero reads "FOR LAW ATTORNEYS IN PHOENIX" — awkward and generic.
**Fix:** Make unknown practice area a WARNING that triggers manual review. Or use "LEGAL" instead of "LAW."

### 9.4 🟢 Two-options timeline claims may be unrealistic
**File:** `report-generator-v12-hybrid.js` lines 1097–1125
**Claims:** "Google Ads live in 5 days. Voice AI live in 10 days. Meta Ads live in 2 weeks. Full infrastructure in 3 weeks."
**Fix:** If these are real timelines you deliver on, keep them. If not, make them accurate to what you actually deliver.

### 9.5 🟢 Solution stack is identical for every firm
**File:** `report-generator-v12-hybrid.js` lines 1005–1065
**What happens:** Every firm gets: Google Ads + Meta Ads + Voice AI + CRM + Dashboard. Even if they already have a CRM. Even if Meta Ads don't make sense for their practice area (e.g., highly specialized IP litigation).
**Fix:** Make the solution stack respond to the gaps. If the firm already has something, don't propose it. If a channel doesn't apply to their practice, skip it.

---

## 10. SECURITY / OPERATIONAL ISSUES

### 10.1 🟡 Cloudflare Worker dedup uses in-memory cache
**File:** `worker.js` lines 14–15
**What happens:** `const recentWebhooks = new Map();` — this resets when the worker cold-starts. Cloudflare Workers can cold-start after as little as 30 seconds of inactivity.
**Fix:** Use Cloudflare KV store for durable dedup:
```javascript
const existing = await env.DEDUP_KV.get(dedupKey);
if (existing) return new Response('Duplicate', { status: 200 });
await env.DEDUP_KV.put(dedupKey, 'true', { expirationTtl: 300 });
```

### 10.2 🟡 Cloudflare Worker has no authentication
**File:** `worker.js` — accepts any POST request.
**What happens:** Anyone who discovers the Worker URL can trigger report generation for any email/website.
**Fix:** Add a shared secret header check:
```javascript
if (request.headers.get('X-Webhook-Secret') !== env.WEBHOOK_SECRET) {
  return new Response('Unauthorized', { status: 401 });
}
```
Configure the same secret in Instantly's webhook settings.

### 10.3 🟢 GitHub PAT has broad permissions
**What happens:** The `GH_PAT` secret is used for both pushing reports AND triggering workflows. A single leaked token gives full repo access.
**Fix:** Use a fine-grained PAT with minimum required permissions (contents: write, actions: write for that single repo).

### 10.4 🟢 Instantly API key stored as base64
**File:** `send-email.js` line 100
**Code:** `const apiKey = Buffer.from(INSTANTLY_API_KEY, 'base64').toString('utf-8');`
**What happens:** The API key is base64-encoded in the secret. This is obfuscation, not security. Anyone with access to the secret can decode it.
**Fix:** Low priority — the secret is in GitHub Secrets which is already encrypted. But remove the base64 layer to reduce confusion.

---

## 11. RICH DATA THAT'S EXTRACTED BUT NEVER USED

The research engine extracts a massive amount of useful data that the report generator completely ignores. Fixing this is how you go from "generic template" to "genuinely personalized."

| Data Point | Extracted In | Used In Report? |
|---|---|---|
| Firm's Google rating | Phase 3 | ❌ No — "You" column hardcoded to `—` |
| Firm's Google review count | Phase 3 | ❌ No |
| After-hours availability | Phase 1.5 | ❌ No — Gap 3 assumes voicemail regardless |
| Live chat on website | Phase 1.5 | ❌ No |
| Social media presence | Phase 1.5 + Phase 4 | ❌ No — Gap 2 assumes no presence regardless |
| Blog activity | Phase 1.5 | ❌ No |
| Awards/credentials | Phase 1.5 | ❌ No |
| Firm personality/tone | Phase 1.5 | ❌ No |
| Free consultation offered | Phase 1.5 | ❌ No |
| Founded year | Phase 1.5 | ❌ No |
| Firm size | Phase 1.5 | ❌ No — could scale gap calculations |
| Office count | Phase 1.5 | ❌ No |
| Notable cases | Phase 1.5 | ❌ No |
| Client testimonials | Phase 1.5 | ❌ No |
| Unique selling points | Phase 1.5 | ❌ No |
| Growth indicators | Phase 1.5 | ❌ No |
| Niche specializations | Phase 1.5 | ❌ No |
| Website modernization level | Phase 1.5 | ❌ No |
| AI synthesis intelligence | Phase 7 | ❌ No — massive analysis wasted |

**The research engine is doing excellent work. The report generator is throwing it all away.**

---

## PRIORITIZED FIX ORDER

If I were fixing this system, here's the order I'd do it in:

### Week 1 — Stop the Bleeding (trust issues)
1. **Fix competitors** (1.1–1.5) — Use Google Maps API or remove competitor section entirely
2. **Fix "You" column** (4.1) — Use the firm's actual scraped Google Business data
3. **Verify or remove case studies** (3.1–3.4) — Real numbers or no numbers
4. **Fix proof grid practice areas** (3.5) — Make it match the target firm

### Week 2 — Fix the Math
5. **Honest gap calculations** (2.1–2.4) — Use ranges or real data. Stop rigging to targets.
6. **Dynamic hero total** (2.5) — Calculate from practice area + market size, not $19K default
7. **Use extracted data for gaps** (4.2) — Don't claim they have no ads if they do

### Week 3 — Pipeline Fixes
8. **Approval before deployment** (5.1) — Restructure workflow
9. **Add firm name sanity check** (5.3) — Block garbage names
10. **Fix Telegram approve button** (5.7) — Wire up the callback handler
11. **Add failure alerting** (5.6) — Know when the pipeline breaks

### Week 4 — Quality of Life
12. **Use extracted data in report** (Section 11) — Firm size, awards, founding year, etc.
13. **Dynamic solution stack** (9.5) — Don't propose things they already have
14. **Reframe gap titles** (9.1) — Market problems, not firm attacks
15. **Fix email claims** (6.1–6.3) — Make claims match reality
16. **Durable dedup** (10.1) — Cloudflare KV
17. **Worker authentication** (10.2) — Shared secret

---

## THE BOTTOM LINE

The system has strong bones. The pipeline architecture is solid — webhook to research to report to approval to email, all automated, all free/cheap infrastructure. The research engine genuinely extracts valuable intelligence.

The problems are all in the last mile: the report generator ignores most of the research data and fills the gaps with fabricated numbers, fake competitors, and hardcoded templates. The result looks personalized but isn't.

The fix isn't a rewrite. It's connecting the research engine's output to the report generator's input. The data is there. It's just not being used.
