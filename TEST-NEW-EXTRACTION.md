# Test New Intelligent Extraction

## What Changed

Completely rewrote the firm info extraction to use Claude aggressively.

**Before:**
- Pulled firm name from page `<title>` tag → Got SEO garbage like "Landlord Attorneys Michigan & Ohio / Property owner legal defense / Paletz Law/ Manufactured HousingPaletz Law"
- No city/state extraction
- No practice area detection
- No attorney names
- Generic everything

**After:**
- Claude analyzes ALL scraped pages (homepage, about, team, contact, practice areas)
- Extracts 40+ structured fields:
  - **Firm name** (actual business name, not SEO title)
  - **Full address** (city, state, zip)
  - **Practice areas** (specific, not generic)
  - **Founding partners** (names, titles, background)
  - **Key attorneys** (names, specializations, years experience)
  - **Founded year** & years in business
  - **Awards & recognitions**
  - **Client testimonials** (actual quotes)
  - **Notable cases**
  - **Firm personality** (formal, friendly, aggressive, etc.)
  - **Unique selling points**
  - **Tech stack** (website modernization, live chat, blog, etc.)
  - **Growth signals** (hiring, expanding, new offices)
  - **Community involvement**
  - **Mission statement & firm story**
  - **Other insights** (anything interesting Claude finds)

## Test It

**Trigger a new lead** (or manually run):

```bash
cd ~/Desktop/mortar-reports/automation
node maximal-research-v2.js \
  "https://paletzlaw.com" \
  "Sarah Fontanilla" \
  "Troy" \
  "MI" \
  "USA" \
  "Paletz Law"
```

## Expected Results

**Firm name:**
- ✅ Should be: "Paletz Law"
- ❌ NOT: "Landlord Attorneys Michigan & Ohio / Property owner legal defense..."

**Location:**
- ✅ Should extract: Troy, MI
- ✅ Should extract full address from website

**Practice areas:**
- ✅ Should extract: ["landlord law", "property law", "eviction defense", etc.]
- ❌ NOT: generic ["legal services"]

**Contact:**
- ✅ Should extract: "Sarah Fontanilla" (from email or team page)
- ❌ NOT: "Unknown"

**Plus 30+ other fields** that will make the report actually personalized.

---

## Next Steps

Once this works, I need to:
1. Update report template to USE all this rich data
2. Show founding partners in the report
3. Reference specific awards/testimonials
4. Mention years in business
5. Call out unique specializations
6. Use firm personality to adjust tone

**The report should feel like I personally researched them, not a generic template.**
