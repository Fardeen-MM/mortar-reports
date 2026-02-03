# MAXIMAL RESEARCH ENGINE V2 + AI-POWERED REPORTS

## What This Does

**Scrapes EVERYTHING about a law firm:**
- ✅ Every page on their website
- ✅ LinkedIn (firm + individual attorneys)
- ✅ Google My Business (ratings, reviews, hours)
- ✅ Social media (Twitter, Facebook, Instagram, YouTube)
- ✅ Recent news mentions
- ✅ Competitor deep dive (ratings, reviews, ads)
- ✅ AI synthesis of all data

**Then generates peak-quality reports:**
- ✅ 100% AI-generated content (no templates)
- ✅ Ultra-personalized to each firm
- ✅ Uses real data throughout
- ✅ Specific competitor comparisons
- ✅ Calculated revenue loss based on actual gaps

## Speed-to-Lead

**Research:** 3-5 minutes  
**Report Generation:** 1-2 minutes  
**Total:** ~5 minutes from lead to personalized report

---

## How to Use

### Step 1: Run Maximal Research

```bash
cd automation

node maximal-research-v2.js \
  "https://www.firmwebsite.com" \
  "John Smith" \
  "Boston" \
  "MA" \
  "US" \
  "Smith & Associates"
```

**Output:** `reports/smith---associates-maximal-research.json`

This file contains:
- 50+ scraped website pages
- LinkedIn profiles
- Google Business data
- Social media links
- Recent news
- Competitor analysis
- AI-synthesized intelligence

### Step 2: Generate AI-Powered Report

```bash
node report-generator-v12-ai-powered.js \
  reports/smith---associates-maximal-research.json \
  "John Smith"
```

**Output:** `reports/smith---associates-landing-page-v12-ai.html`

---

## What Makes This Better

### Old System (V11):
- ❌ Template-based content
- ❌ Generic placeholders
- ❌ Limited website scraping (3-5 pages)
- ❌ Basic competitor data
- ❌ No LinkedIn, social, or news

### New System (V12):
- ✅ AI generates every section
- ✅ Uses real firm names, numbers, dates
- ✅ Scrapes entire website (50+ pages)
- ✅ Deep competitor intelligence
- ✅ LinkedIn + social + news integration
- ✅ Personalization hooks from AI synthesis

---

## Research Data Structure

```json
{
  "firmName": "Smith & Associates",
  "website": "https://www.smithlaw.com",
  "contactPerson": "John Smith",
  "location": { "city": "Boston", "state": "MA", "country": "US" },
  
  "websitePages": [
    {
      "url": "https://www.smithlaw.com",
      "title": "Home - Smith & Associates",
      "html": "...",
      "text": "..."
    },
    // ... 50+ more pages
  ],
  
  "linkedIn": {
    "url": "https://linkedin.com/company/smith-law",
    "html": "...",
    "text": "..."
  },
  
  "attorneyLinkedIns": [
    {
      "name": "John Smith",
      "url": "https://linkedin.com/in/johnsmith",
      "title": "Managing Partner"
    }
  ],
  
  "googleBusiness": {
    "rating": 4.8,
    "reviews": 127,
    "address": "123 Main St, Boston, MA",
    "phone": "(617) 555-1234",
    "hours": "Mon-Fri 9am-5pm"
  },
  
  "socialMedia": {
    "twitter": "https://twitter.com/smithlaw",
    "facebook": "https://facebook.com/smithlaw",
    "instagram": null,
    "youtube": null
  },
  
  "news": [
    {
      "title": "Smith & Associates Expands to Cambridge",
      "source": "Boston Business Journal",
      "snippet": "..."
    }
  ],
  
  "competitors": [
    {
      "name": "Jones Law Group",
      "city": "Boston",
      "state": "MA",
      "rating": 4.9,
      "reviewCount": 203,
      "website": "https://joneslawgroup.com",
      "hasGoogleAds": true,
      "hasMetaAds": false
    }
  ],
  
  "intelligence": {
    "firmPositioning": "Boutique litigation firm focused on complex commercial disputes",
    "uniqueAngle": "Former BigLaw partners offering BigLaw quality at boutique prices",
    "keyDecisionMakers": [
      {
        "name": "John Smith",
        "title": "Managing Partner",
        "background": "20 years at Ropes & Gray, Harvard Law '98"
      }
    ],
    "practiceAreas": ["Commercial Litigation", "Business Disputes", "Employment Law"],
    "mainFocus": ["Commercial Litigation"],
    "nicheSpecializations": ["Shareholder disputes", "Partnership dissolution"],
    "growthSignals": ["Opened Cambridge office 2024", "Hired 3 new associates"],
    "painPoints": [
      "Zero Google Ads presence while competitors dominate",
      "Limited social media activity",
      "Website is dated (circa 2018)",
      "No after-hours intake"
    ],
    "competitiveAdvantages": ["High Google rating", "Strong credentials"],
    "competitiveWeaknesses": ["Lower review count", "No advertising"],
    "personalizationHooks": [
      "Recent Cambridge expansion",
      "Harvard Law pedigree",
      "Former BigLaw background"
    ],
    "techSophistication": "medium",
    "marketingMaturity": "low",
    "firmSize": "15-20 attorneys",
    "estimatedRevenue": "$5-10M",
    "idealPitchAngle": "Help them capture the Cambridge market with targeted ads + intake system"
  }
}
```

---

## AI-Generated Report Sections

### 1. Hero Section
AI analyzes research and writes:
- Firm name + location
- Exact competitor comparison with real numbers
- Calculated monthly revenue loss
- Painful but accurate hook

**Example:**
> "Smith & Associates has a 4.8⭐ rating (127 reviews) but is invisible when it matters. Jones Law Group (4.9⭐, 203 reviews) is capturing every high-intent search with Google Ads. You're losing $22K/month to firms that aren't better—just louder."

### 2. Personalized Opener
AI uses:
- Recent news (Cambridge expansion)
- Decision maker background (Harvard Law, Ropes & Gray)
- Unique positioning (BigLaw quality, boutique prices)
- Growth signals

**Example:**
> "John, congratulations on the Cambridge office—smart move given the commercial litigation market there. With your BigLaw background and 4.8⭐ rating, you should be dominating. But we found three gaps that are costing you $22K/month..."

### 3. Gap Analysis
AI generates 3 specific gaps based on:
- Their actual website/social presence
- Competitor ad activity
- Review count differences
- Missing infrastructure

Each gap includes:
- Real competitor names and data
- Calculated cost
- 4-step flow diagram
- Relevant proof/stat

### 4. Competitor Analysis
AI writes comparison using:
- Exact ratings and review counts
- Who's running ads
- Website quality differences
- Market opportunity

**Example:**
> "Your top 3 competitors in Boston: Jones Law Group (4.9⭐, 203 reviews, running Google Ads), Smith Legal (4.7⭐, 156 reviews, no ads), Brown & Associates (4.6⭐, 89 reviews, running Google + Meta ads). You have the credentials, but they have the visibility."

### 5. Solution Roadmap
AI creates phased plan based on:
- Their tech sophistication
- Marketing maturity
- Specific gaps identified
- Firm size and resources

---

## Integration with GitHub Actions

Update `.github/workflows/process-interested-lead.yml`:

```yaml
- name: Run maximal research
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC }}
  run: |
    node maximal-research-v2.js \
      "${{ steps.parse.outputs.website }}" \
      "${{ steps.parse.outputs.contact_name }}" \
      "${{ steps.parse.outputs.city }}" \
      "${{ steps.parse.outputs.state }}" \
      "${{ steps.parse.outputs.country }}" \
      "${{ steps.parse.outputs.company }}"
  working-directory: ./automation

- name: Generate AI-powered report
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC }}
  run: |
    RESEARCH_FILE=$(find reports -name "*-maximal-research.json" -type f | head -1)
    node report-generator-v12-ai-powered.js "$RESEARCH_FILE" "${{ steps.parse.outputs.contact_name }}"
  working-directory: ./automation
```

---

## Testing Locally

```bash
# Test with Maselan & Jones
cd automation

# Step 1: Maximal Research
node maximal-research-v2.js \
  "https://www.maselanjones.com" \
  "James Maselan" \
  "Boston" \
  "MA" \
  "US" \
  "Maselan & Jones"

# Wait 3-5 minutes...

# Step 2: Generate Report
node report-generator-v12-ai-powered.js \
  reports/maselan---jones-maximal-research.json \
  "James Maselan"

# Open report
open reports/maselan---jones-landing-page-v12-ai.html
```

---

## Cost Estimate

**Per Report:**
- Maximal Research: ~$0.50-1.00 (multiple AI calls)
- Report Generation: ~$0.30-0.50 (5 AI sections)
- **Total:** ~$0.80-1.50 per complete report

**At scale (100 leads/month):**
- Cost: $80-150/month
- Revenue potential: $100K+ MRR if 10% convert

---

## Next Steps

1. Test with 5-10 real leads
2. Compare V12 reports to V11 (quality check)
3. Measure conversion rate improvement
4. Deploy to production workflow
5. Monitor API costs and quality

---

## Troubleshooting

**"LinkedIn blocked"**
- Normal - LinkedIn requires login
- AI still uses company profile URL for context

**"Too many pages scraped"**
- Adjust `maxPages` in `scrapeEntireWebsite()` (default: 50)

**"AI synthesis failed"**
- Check ANTHROPIC_API_KEY is set
- Verify research data has enough content
- May need to increase context length

**"Report generation slow"**
- Normal - AI generates 5 sections
- Each section takes 10-30 seconds
- Total: 1-2 minutes

---

## Quality Checklist

Before deploying, verify:
- ✅ Firm name appears 5+ times
- ✅ Real competitor names used
- ✅ Actual ratings/reviews cited
- ✅ Specific news/events mentioned
- ✅ Decision maker name/background included
- ✅ Dollar amounts are reasonable
- ✅ No template placeholders left
- ✅ All links work
- ✅ Mobile responsive
