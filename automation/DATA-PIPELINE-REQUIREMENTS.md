# DATA PIPELINE REQUIREMENTS
**Critical: AI needs RICH DATA for accurate, personalized reports**

## The Goal
Reports must be SPECIFIC and PERSONALIZED, not generic.

**Bad (generic):**
> "You're losing money to competitors"

**Good (specific):**
> "Steven Krieger has 308 Google reviews. You have 5. When someone searches 'litigation attorney McLean' at 9pm, Google sees those numbers and picks them."

---

## 1. RESEARCH SCRIPT MUST EXTRACT

### Critical Data (NEVER null):
- ✅ **Firm's OWN Google Business Profile**
  - Review count (exact number, not null)
  - Rating (5.0, 4.8, etc.)
  - Full address
  - Categories
  
- ✅ **Correct Location**
  - City (validated, not "Lean" when it's "McLean")
  - State
  - Source & confidence score

- ✅ **Attorneys** (names, titles, bios)
  - Parse team pages (multiple fallback strategies)
  - Extract credentials, bar admissions, education
  - Years of experience
  - Specializations

- ✅ **Multiple Pages Analyzed**
  - Homepage
  - About page  
  - Contact page
  - Team page
  - Services/Practice areas pages
  - Track what was analyzed (confidence scoring)

- ✅ **Competitor Intelligence**
  - Name, reviews, rating, address
  - Running Google Ads? (Y/N)
  - Running Meta Ads? (Y/N)
  - Practice areas
  - Team size (if available)

### Nice-to-Have Data:
- Awards & recognitions
- Case results / testimonials
- Firm history (founding date, years in business)
- LinkedIn profiles
- Blog/content presence
- Social media followers

---

## 2. AI ANALYZER MUST USE THIS DATA TO:

### Generate Painful, Specific Comparisons:
- "Steven Krieger has 308 reviews to your 5" (using ACTUAL numbers)
- "Your 3 attorneys vs Krieger's 15-person team"
- "You focus on TCPA defense but your website says 'general litigation'"

### Provide Market Context:
- "McLean has 12 litigation firms. Only 3 run Google Ads."
- "Your competitor added 12 reviews last month. You added 0."
- "Fox & Moghul is in the SAME building as you (8200 Greensboro) and outranks you"

### Teach Specific Insights:
- "As a TCPA specialist, your CPC should be $40-60 (vs $15 for general PI)"
- "In Fairfax County, avg case value is $4,200 (higher than national avg)"
- "Your practice area mix (70% TCPA, 30% general) is unusual - position it"

---

## 3. REPORT GENERATOR MUST:

### Use Specific Data in Every Section:
- **Hero:** Actual review counts, actual competitor names
- **Gaps:** Their specific practice areas, their actual location
- **"What We See":** Market-specific observations
- **Competitor Table:** Real data, not templates
- **Social Proof:** "A TCPA firm" → "A TCPA defense firm in Phoenix"

### Avoid Generic Language:
- ❌ "Your competitors" → ✅ "Steven Krieger and Fox & Moghul"
- ❌ "Many reviews" → ✅ "308 reviews"
- ❌ "Your area" → ✅ "McLean, VA" or "Fairfax County"
- ❌ "Legal services" → ✅ "TCPA defense litigation"

---

## 4. DATA QUALITY CHECKS

### Research Script Must Flag:
- Missing attorney data: "No team page found - tried 6 strategies"
- Low confidence: "Location confidence: 6/10 (unvalidated)"
- Data conflicts: "Instantly says 'Lean' but Google Business says 'McLean'"
- Empty fields: "No awards found on About page"

### AI Analyzer Must:
- Work around missing data gracefully
- Use high-confidence data for main insights
- Mention low-confidence data as "based on available info"
- Never fabricate data

### Report Generator Must:
- Only use verified data in hero comparisons
- Fall back to generic hero if specific data missing
- Include confidence indicators for key claims

---

## 5. THE COMPLETE PIPELINE

```
INSTANTLY WEBHOOK
  ↓ (city, state, company, website, contact)
  ↓
RESEARCH SCRIPT (research-v3-DEEP.js)
  ↓ (6+ fallback strategies for each data point)
  ↓ Extract: location, reviews, rating, attorneys, competitors, practice areas
  ↓ Validate: cross-reference sources, confidence scoring
  ↓ Output: roth-jackson-research.json (RICH DATA)
  ↓
AI ANALYZER (ai-analyzer.js)
  ↓ Input: research JSON with full context
  ↓ Generate: personalized insights, market analysis, specific comparisons
  ↓ Output: research JSON with AI insights injected
  ↓
REPORT GENERATOR (report-generator-v8.js)
  ↓ Input: research + AI insights
  ↓ Build: hero with painful comparison, gaps with teaching moments
  ↓ Output: Beautiful HTML report with SPECIFIC, ACCURATE content
  ↓
DEPLOY TO GITHUB PAGES
  ↓
EMAIL TO LEAD
```

---

## 6. SUCCESS CRITERIA

A successful report should:
1. ✅ Use the lead's ACTUAL firm name (not "Home" or "Unknown")
2. ✅ Use the lead's ACTUAL location (McLean, not Lean)
3. ✅ Compare to ACTUAL competitors by name
4. ✅ Use ACTUAL review counts (5 vs 308, not "0 vs many")
5. ✅ Reference their ACTUAL practice areas (TCPA, not "litigation")
6. ✅ Include their ACTUAL attorneys (if team page found)
7. ✅ Provide MARKET-SPECIFIC insights (McLean market dynamics)
8. ✅ Have confidence scores ≥7/10 for all key data points

**If you can't verify the data, don't use it.**
**If the data is low confidence, say so.**
**If extraction failed, try 6+ different strategies before giving up.**

---

## 7. CURRENT STATUS

### Working ✅:
- Firm name extraction (Roth Jackson)
- Location validation (McLean, VA)
- Google Business Profile lookup (5 reviews, 5.0★)
- Competitor discovery (12 found)
- Practice areas (16 found)
- Multiple pages analyzed (3+)

### Needs Work ⚠️:
- **Attorney extraction**: Team page patterns too strict → Add 6+ fallback strategies
- **Data richness**: More bios, credentials, specializations → Feed more to AI
- **AI insights**: Connect to real data → Make comparisons specific
- **Report specificity**: Generic templates → Use actual names/numbers

---

## REMEMBER THIS:
The AI analyzer is only as good as the data we give it.
Rich data = Smart insights = Personalized reports = Higher conversions.

**Never sacrifice accuracy for speed.**
**Never fabricate data when it's missing.**
**Always try multiple strategies before giving up.**
