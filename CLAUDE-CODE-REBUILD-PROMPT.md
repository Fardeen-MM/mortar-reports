# FULL REBUILD INSTRUCTIONS FOR CLAUDE CODE

You already fixed the competitor data, "You" column, and some math issues. Good. But the report template itself still doesn't work. We've spent hours redesigning it from scratch. Below is everything you need to implement — the new report structure, new copy, new research to scrape, and the reference HTML to match.

There is a file called `paletz-report-v3.html` in the repo root. That is the production-ready reference template. OPEN IT AND READ IT. Every design decision, every piece of copy, every section order in that file is intentional. Your job is to make the report generator produce HTML that matches that file's structure, flow, and tone — dynamically, for any firm.

---

## THE REPORT WAS BAD. HERE'S WHY.

The old report had these problems:
1. Hero was generic — "They find your competitors. Not you." could be any agency's landing page
2. Competitor section came first but didn't mean anything — just review numbers with no context
3. Every section followed the same skeleton: section intro → label → TLDR box → gap box → flow diagram → math line → pull quote. By gap #2 it felt like a template being filled in.
4. TLDR boxes killed momentum — summarizing content the reader hasn't read yet
5. Flow diagrams were patronizing — explaining how Google works to a professional
6. Section pull quotes were filler — "But Google is only half the picture" is a transition sentence pretending to be a design element
7. Solution stack was a feature list for YOUR product, not benefits for them
8. Two-options guilt trip box was manipulative in an obvious way
9. Proof grid proved nothing — capabilities, not proof
10. Too much UI chrome — 80% containers, 20% content
11. The CTA "See where you're losing →" that scrolled to the next section was pointless

## THE NEW REPORT STRUCTURE

Here's the exact flow. This order is non-negotiable:

### 1. HERO
- Small label: `[PRACTICE AREA] · [CITY, STATE]`
- Setup line: "Every month, people in [city] search for"
- Google search bar mockup with typing animation cycling through 5 practice-area-specific search terms (e.g. for landlord law: "eviction lawyer near me", "landlord attorney [city] [state]", "how to evict a tenant [state]", "landlord tenant lawyer", "property owner legal help")
- Headline: `They find other firms. Not yours.`
- Sub: `We analyzed the [practice area] market in [city] — who's showing up, who's advertising, and where the gaps are. Below is where you're losing cases, and exactly how to get them back.`
- Scroll hint: "2 minute read ↓"
- NO CTA button in the hero. The only CTA on the entire page is the booking widget at the bottom.

### 2. "Where you're losing cases right now"
Comes IMMEDIATELY after hero. This is what the hero promised — deliver on it.

Intro paragraph: "We looked at how people find and contact [practice area] attorneys in [city]. Three specific gaps came up — places where potential clients are looking for help and ending up with someone else. These are patterns we see consistently across legal markets where firms haven't built out their marketing infrastructure."

Then three gap cards:

#### GAP CARD 1 — Google Ads
- Badge: blue pill that says "Google Ads"
- Headline: `~[X] people searched for a [practice area] attorney last month. The firms running ads got those clicks.`
- Body: Explain that paid ads show first, then Map Pack (ranked by reviews), then organic. Without ads and with few reviews, they're not in any of those spots. "This is the highest-intent channel in legal marketing — these people are actively looking for exactly what you do, right now. In our experience, search ads consistently deliver the fastest results for law firms because the intent is already there."
- Math box: Show the formula with RANGES not exact numbers. Format: `~[X] monthly searches × 3.5% CTR × 12% inquiry rate × 25% close rate × $[Y]–[Z] avg case value`. End with: "These conversion rates are based on benchmarks we've seen across legal markets — your actual numbers will vary based on your intake process and close rate."
- Cost estimate as a RANGE: "Estimated opportunity: ~$X,XXX–X,XXX/mo"

#### GAP CARD 2 — Meta Ads
- Badge: blue pill that says "Meta Ads · Facebook + Instagram"
- Headline: `Not every [client type] with a legal problem Googles it. Many are scrolling Facebook right now.`
- Body: Put the reader in the client's shoes. E.g. for landlord law: "Think about it from a landlord's perspective. They have a tenant who stopped paying rent. They're stressed. They're not Googling yet — they're venting in landlord groups, scrolling at night, reading posts from other property owners." Then: a targeted ad reaches them before they search. "The best-performing firms we've seen use both channels because they capture completely different people at different stages."
- Math box with ranges, same format as gap 1
- Cost estimate as a range

#### GAP CARD 3 — Voice AI / 24/7 Intake
- Badge: green pill that says "Voice AI · 24/7 Intake"
- Headline: `When a [client type] calls at 7pm about a [emergency scenario] — what happens?`
- Body: Tell the story — client has emergency, calls three attorneys, two go to voicemail, one picks up. "Which firm gets that case?" Then: "Once you're running ads and driving calls, this becomes the difference between paying for leads and actually converting them. The 60% voicemail drop-off is well-documented in legal intake studies — it's the most common leak in the funnel we see."
- Before/after comparison (two columns):
  - Without 24/7 intake: "Voicemail → caller feels ignored → tries next firm → you follow up next morning but they've already booked elsewhere"
  - With AI intake: "Answered in seconds → AI qualifies the lead → books consultation → your team is alerted → you wake up with a new client on the calendar"
- Math box with ranges

### 3. TOTAL STRIP
Black bar with white text:
- Left: "Combined estimated monthly opportunity"
- Right: "$X,XXX–XX,XXX" (sum of the three gap ranges)

Below it, one paragraph: "That's the range — not a guarantee. It depends on your case values, close rate, and how well the system is optimized. The point isn't the exact number. It's that real people in [city] are searching for the exact service you provide, and right now they're finding other firms instead of you."

### 4. "And those other firms? Here's who's showing up — and what it takes to compete"
This section comes AFTER the gaps and total, not before. The reader already knows what's at stake ($X,XXX/mo). Now show them who's capturing it.

Intro: "We pulled the firms showing up for [practice area] searches in [city]. Google uses reviews as a major trust signal — more reviews and higher ratings push firms into the Map Pack at the top of results, where most clicks happen. Here's where you stand."

Show HORIZONTAL BAR CHART (not a table) for review comparison:
- Each competitor: name, review count, star rating, bar width proportional to review count
- The firm: name in red, their review count in red, tiny red bar
- The visual gap IS the point — Goldman's bar stretches full width, firm's bar is a sliver

Then show a COMPETITOR DETAILS section if we have ads data (see research section below):
- For each competitor, show: reviews, rating, Google Ads status (Running/Not detected), Meta Ads status (Active campaigns/Not detected)
- Show the firm's own data in the same format
- This replaces the old table — use cards or a clean grid, not a boring table

Takeaway paragraph: "This doesn't mean they're better attorneys. In every market we've analyzed, the firms that dominate search results aren't always the best lawyers — they're the ones that invested in infrastructure. Reviews are just the visible part. The real gap is what's happening underneath: ads, intake, and follow-up systems that capture clients before they ever scroll past the first result."

### 5. "Here's how we'd close these gaps"
Intro: "It's not one thing — it's a system. Each piece feeds the next. Ads drive calls, intake captures them, CRM tracks them, reporting shows you what's working. We handle the build and management. You focus on practicing law."

Numbered list (NOT a feature list — benefit-first copy):
1. **Google Ads targeting [practice area] searches in your area** — "You show up at the top when someone searches for exactly what you do. Every click tracked, every call recorded, every dollar accounted for." Badge: "Typically live in 1–2 weeks"
2. **Meta Ads reaching [client type] before they search** — "Targeted campaigns on Facebook and Instagram — putting your firm in front of [client type] who need help but haven't started looking." Badge: "Typically live in 2–3 weeks"
3. **AI-powered intake that answers every call, 24/7** — "No more voicemail. Every call answered, qualified, and booked — even at 2am. Your team gets notified instantly." Badge: "Typically live in 1–2 weeks"
4. **CRM + reporting so you know what's working** — "Every lead tracked from first click to signed retainer. You see exactly which dollars are producing cases." Badge: "Set up alongside launch"

### 6. CTA — "Want to walk through these numbers together?"
Sub: "15 minutes. We'll go through what's realistic for your firm specifically and you can decide if it's worth pursuing."
Booking widget iframe. That's it. No guilt trips. No "two options" box.

### 7. Footer
"Mortar Metrics · Legal Growth Agency · Toronto, ON"

---

## THINGS THAT ARE GONE — DO NOT INCLUDE

- ❌ TLDR boxes
- ❌ Section labels ("GAP #1", "GAP #2", "THE SOLUTION", etc.)
- ❌ Section pull quotes ("But Google is only half the picture...")
- ❌ Flow diagrams (the step → arrow → step → arrow things)
- ❌ Proof grid (24/7 lead capture / <5 min response / 100% attribution)
- ❌ Two-options box (keep doing what you're doing vs let us build)
- ❌ Any CTA button in the hero
- ❌ Fake case studies (Phoenix tax attorney, Austin family law, Dallas litigation)
- ❌ "We've built this 23 times"
- ❌ Solution stack with emoji icons and feature jargon (geo-targeting, dayparting, negative keywords)
- ❌ Any hardcoded practice areas in the proof grid ("Tax, family, PI, immigration")

---

## DESIGN SYSTEM

Match the reference HTML exactly. Key details:

- Fonts: Fraunces (serif, headings) + Outfit (sans-serif, body)
- Background: `#FDFCF9` (cream)
- Text: `#4a4a4a` (slate), headings `#0a0a0a` (ink)
- Primary: `#4f46e5` (indigo)
- Danger: `#dc2626` (red — for firm's own data and cost estimates)
- Success: `#059669` (green — for "after" in before/after)
- Cards: white, 1px border `#e8e8e8`, border-radius 16px, subtle shadow
- Badges: small pills with channel-specific colors (Google blue, Meta blue, Intake green)
- Dividers: gradient fade `linear-gradient(to right, transparent, #e8e8e8, transparent)`
- Total strip: `#0a0a0a` background, white text, Fraunces for the number
- Spacing is TIGHT — less whitespace than typical. Sections should flow into each other, not float in empty space. Use `margin: 48px 0` for dividers, not `80px`.
- Mobile responsive: single column under 768px, before/after stacks vertically

---

## PART 2: RESEARCH ENGINE IMPROVEMENTS

### NEW: Competitor Ad Research

Now that competitor names are REAL (from Google Maps API), we can look them up in public databases. Add two new research phases:

#### Google Ads Transparency Center
URL: `https://adstransparency.google.com`
For each competitor name:
- Search their name/domain
- Determine: Are they running Google Ads? (yes/no)
- If possible: How many ads? What do they look like?
- This is public data, no auth needed

#### Meta Ad Library
URL: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=[COMPETITOR NAME]`
For each competitor name:
- Search their name
- Determine: Do they have active Meta ad campaigns? (yes/no)
- If possible: How many active ads?
- This is public data, required by law to be accessible

Add these results to the research JSON under each competitor:
```json
{
  "name": "Goldman & Associates",
  "reviews": 7077,
  "rating": 4.9,
  "googleAds": { "detected": true, "adCount": 12 },
  "metaAds": { "detected": true, "activeCount": 3 }
}
```

If scraping these sites is unreliable from GitHub Actions IPs, use a SERP API or similar service. The key is: REAL data, not coin flips.

### FIX: Use the firm's own scraped data

The research engine already extracts:
- `googleBusiness.rating` and `googleBusiness.reviews`
- `contact.afterHoursAvailable`
- `marketing.hasLiveChat`
- `socialMediaPresence`
- `firmSize`, `officeCount`, `foundedYear`
- `practiceAreas` (extracted, not generic)
- `awards`, `credentials`, `clientTestimonials`
- The full AI synthesis from Phase 7

ALL of this must flow into the report generator. Specifically:
- **"You" column data**: Use real `googleBusiness.rating`, `googleBusiness.reviews`. Check `afterHoursAvailable` before claiming Gap 3. Check social media presence before claiming Gap 2.
- **Gap validation**: If the firm IS running Google Ads (check their own site for conversion tracking, or check Google Ads Transparency), don't claim Gap 1. Skip that gap or reframe it as "optimization opportunity."
- **Search volume**: Use `practiceAreas` + `city` to look up approximate search volumes. Don't hardcode 320 for every firm.
- **Case value**: Vary by practice area. Landlord law: $3,000–5,000. Personal injury: $50,000–500,000. Family law: $5,000–15,000. This dramatically changes the gap estimates.
- **Audience size**: Use city/metro population to estimate social media audience. Troy MI (80K) gets a different number than NYC.
- **Call volume**: Scale by firm size. Solo practitioner ≠ 50-attorney firm.

### FIX: Search terms for typing animation

Generate 5 practice-area-specific search terms dynamically. Examples:
- Landlord law: "eviction lawyer near me", "landlord attorney [city] [state]", "how to evict a tenant [state]", "landlord tenant lawyer", "property owner legal help"
- Personal injury: "car accident lawyer near me", "personal injury attorney [city]", "slip and fall lawyer", "injury lawyer free consultation", "accident attorney near me"
- Family law: "divorce lawyer [city]", "child custody attorney near me", "family law attorney [state]", "best divorce lawyer near me", "custody lawyer free consultation"

Use Claude to generate these based on the practice area. Store in research JSON.

### FIX: Gap math must be honest

Current: Hardcoded inputs, rigged to hit targets, formula doesn't produce claimed number.
New rules:
1. Inputs must vary by market size, firm size, and practice area
2. Show RANGES not exact numbers ($1,500–3,000, not $1,847)
3. The formula shown to the reader MUST actually produce the claimed range when calculated
4. Include case value explicitly in the formula — currently hidden
5. End each math box with a caveat: "These conversion rates are based on benchmarks we've seen across legal markets — your actual numbers will vary based on your intake process and close rate."
6. The total strip shows the SUM of the three gap ranges
7. NO RIGGING — if the math gives $800, show $800. Don't replace it with $3,000.

### FIX: Firm name extraction

Current: Produces garbage like `LandlordAttorneysMichigan&OhioPropertyOwnerLegalDefensePaletzLawManufacturedHousingpaletzLaw`
Fix: Add sanity check — if name >60 chars, contains `&` more than once, or has no spaces, flag for review. Use the AI-extracted firm name from Phase 1 as primary, fall back to meta title only if AI extraction fails.

---

## PART 3: PIPELINE FIXES

### Approval before deployment
Current: Report deploys to GitHub Pages BEFORE Telegram approval. Rejected reports stay live.
Fix in `process-interested-lead.yml`:
1. Generate report → save to repo but DON'T deploy
2. Send Telegram approval with preview
3. On approve (separate workflow): deploy to GitHub Pages + send email
4. On reject: delete the generated files

### Validation gate
If report generator returns GENERATION_BLOCKED or firm name is "Unknown Firm" or firm name is >60 chars:
- Do NOT commit
- Do NOT deploy  
- Do NOT send Telegram
- Log the failure
- Send a Telegram notification that says "⚠️ Report blocked for [reason]"

### Failure alerting
If ANY step in the pipeline fails, send a Telegram message:
"❌ Pipeline failed for [firm name/URL]: [error message]"
Currently failures are only visible in GitHub Actions logs.

---

## PART 4: SUBTLE FLEXES (COPY GUIDELINES)

The report needs to feel like it was written by people who've done this before — without making specific unverifiable claims. Here are the approved flex phrases. Sprinkle them naturally, don't force them:

- "These are patterns we see consistently across legal markets"
- "In our experience, search ads consistently deliver the fastest results for law firms"
- "The best-performing firms we've seen use both channels"
- "The 60% voicemail drop-off is well-documented in legal intake studies — it's the most common leak in the funnel we see"
- "In every market we've analyzed, the firms that dominate search results aren't always the best lawyers"
- "These conversion rates are based on benchmarks we've seen across legal markets"
- "Well-run campaigns for legal services consistently outperform these baselines"

DO NOT use:
- ❌ "We've built this 23 times"
- ❌ "Phoenix tax attorney: 0 → 47 leads/month"
- ❌ Any specific case study with a city + practice area + specific number (unless Fardeen confirms it's real)
- ❌ "65% of high-intent legal searches click on ads" (real CTR is 3-6%)
- ❌ "73% of people searching for lawyers do it outside business hours" (unsourced)
- ❌ "Your clients spend 2.5 hours/day on social media" (generic global stat)

---

## PART 5: EMAIL TEMPLATE FIXES

In `email-templates.js`, fix these claims to match reality:

- ❌ "I just finished analyzing" → ✅ "Our team put together an analysis"
- ❌ "I analyzed your top 3 competitors" → ✅ "We looked at who's showing up in your market" (only say competitors if we have REAL competitor data)
- ❌ "Everything is specific to your firm — no generic fluff" → ✅ Remove this line until the reports are actually specific
- Fix meeting day calculation to skip weekends properly

---

## PART 6: OTHER FIXES FROM THE AUDIT

- `normalize-research-data.js`: Stop creating "City Law Firm A/B/C" fallback competitors. If we don't have real competitors, don't show a competitor section.
- `ai-research-helper.js`: Use the SAME model quality for competitor research as for website extraction. Currently competitors use the cheapest model (Haiku) while extraction uses Sonnet 4 — priorities are backwards.
- Cloudflare Worker (`worker.js`): Replace in-memory Map dedup with Cloudflare KV store. Add shared secret header check for authentication.
- `send-email.js`: Fix research file lookup pattern to match `-maximal-research.json` suffix.
- Currency: Use the `currency` variable in formula strings. Don't hardcode "$" — UK firms exist.
- Location fallback: If city/state are missing, don't show "Your area" — either extract from the URL/domain or block generation.

---

## HOW TO IMPLEMENT THIS

1. Read `paletz-report-v3.html` in the repo root. That's your template reference.
2. Find a real research JSON in `automation/reports/` and use it as a test fixture throughout.
3. Work through the changes in this order:
   a. Report template restructure (Part 1) — make the generator produce HTML matching v3
   b. Research improvements (Part 2) — add competitor ad lookups, fix data flow
   c. Math fixes (Part 2) — honest ranges, variable inputs
   d. Pipeline fixes (Part 3) — approval before deploy, validation, alerting
   e. Email fixes (Part 5)
   f. Everything else (Part 6)
4. After each section, generate a test report from a real research JSON and verify the output looks right.
5. Commit after each working section with a clear message.
6. Don't ask questions you can answer yourself — just fix it and show results.

---

## THE PRINCIPLE

The research engine is genuinely good. It extracts valuable intelligence. The report generator was throwing it all away and filling gaps with hardcoded templates, fabricated data, and rigged math. The fix is connecting research output to report input. The data is there — use it.

Reports must sell outcomes, not features. Lawyers don't care about geo-targeting and dayparting. They want to stop losing cases to firms that aren't better than them. Every sentence in the report should pass the test: "Would a busy lawyer keep reading after this line?"
