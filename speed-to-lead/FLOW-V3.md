# Speed-to-Lead V3 - Complete Flow

High-converting report pipeline with **real data** collection.

## What's New in V3

| Old System | New System |
|------------|------------|
| Empty competitor array | Real competitor names from Google Maps |
| No Google reviews | Actual review count + rating |
| Fake PageSpeed (load time) | Real Google PageSpeed API score |
| Math doesn't add up | All losses sum to total correctly |
| Generic case study | Practice-area matched case studies |
| Single CTA | Multiple CTAs throughout |
| No objection handling | FAQ section + risk reversal |

---

## Pipeline

```
Lead Info (website + location)
    ↓
1. research-v3.js (REAL data collection)
    ↓
   {firm}-research.json
    ↓
2. report-generator-v8.js (high-converting report)
    ↓
   {firm}-report-v8.html (send to prospect)
```

---

## Step 1: Research

**Input:** Website URL + Location (optional but recommended)
**Output:** JSON with real competitor data, PageSpeed scores, ad status

```bash
node research-v3.js https://www.firmwebsite.com/ "Miami, FL"
```

**What it collects:**
- ✅ Firm name, practice areas (from website)
- ✅ Real competitors (from Google Maps search)
- ✅ Competitor Google reviews + ratings
- ✅ Competitor Google Ads status (verified)
- ✅ Competitor Meta Ads status (verified)
- ✅ Firm's Google Business Profile (reviews, rating)
- ✅ Real PageSpeed score (Google API)
- ✅ 24/7 support detection
- ✅ Revenue gap calculations (math adds up!)

**Output:** `./reports/{firm-name}-research.json`

---

## Step 2: Generate Report

**Input:** Research JSON + Contact Name
**Output:** High-converting HTML report

```bash
node report-generator-v8.js ./reports/firm-research.json "Jane Smith"
```

**What it generates:**
- ✅ Urgency banner (sticky)
- ✅ Hero with daily/weekly/monthly/yearly losses
- ✅ Competitor comparison table (real names!)
- ✅ "What's Happening Right Now" pain section
- ✅ Problems with individual costs (that add up)
- ✅ Mid-page CTA
- ✅ Solutions with Week 1 + Full Build timelines
- ✅ Practice-area matched case study
- ✅ Cost of Waiting countdown
- ✅ FAQ (objection handling)
- ✅ Final CTA with risk reversal

**Output:** `./reports/{firm-name}-report-v8.html`

---

## Full Command (One Lead)

```bash
# Navigate to folder
cd ~/clawd/speed-to-lead

# 1. Research (include location for better competitor data)
node research-v3.js https://www.cohenwilliams.com/ "Los Angeles, CA"

# 2. Generate report
node report-generator-v8.js ./reports/cohen-williams-research.json "Brittany Lane"

# 3. Preview
open ./reports/cohen-williams-report-v8.html
```

---

## Research JSON Structure (V3)

```json
{
  "firmName": "Cohen Williams LLP",
  "website": "https://www.cohenwilliams.com/",
  "location": {
    "city": "Los Angeles",
    "state": "CA",
    "full": "Los Angeles, CA"
  },
  "practiceAreas": ["civil litigation", "appeals"],
  
  "googleProfile": {
    "reviewCount": 23,
    "rating": 4.2,
    "ratingDisplay": "4.2★",
    "profileFound": true
  },
  
  "competitors": [
    {
      "name": "King & Spalding LLP",
      "rating": 4.7,
      "ratingDisplay": "4.7★",
      "reviews": 89,
      "googleAds": true,
      "metaAds": false
    },
    {
      "name": "Latham & Watkins",
      "rating": 4.8,
      "ratingDisplay": "4.8★",
      "reviews": 156,
      "googleAds": true,
      "metaAds": true
    }
  ],
  
  "googleAds": {
    "running": false,
    "verified": true,
    "competitorsRunning": 2
  },
  
  "metaAds": {
    "running": false,
    "verified": true,
    "competitorsRunning": 1
  },
  
  "website": {
    "pageSpeedScore": 45,
    "mobileScore": 38,
    "speedRating": "Slow",
    "has24x7": false,
    "hasChat": false
  },
  
  "gaps": {
    "googleAds": { "hasGap": true, "monthlyLoss": 11250 },
    "metaAds": { "hasGap": true, "monthlyLoss": 5625 },
    "afterHours": { "hasGap": true, "monthlyLoss": 21000 },
    "websiteSpeed": { "hasGap": true, "monthlyLoss": 6000 },
    "reviews": { "hasGap": true, "monthlyLoss": 2250 }
  },
  
  "totalMonthlyLoss": 46125,
  "avgCaseValue": 15000
}
```

---

## File Structure

```
~/clawd/speed-to-lead/
├── research-v3.js          # New research script
├── report-generator-v8.js  # New report generator
├── research-v2.js          # Old (keep for reference)
├── report-generator-v7.js  # Old (keep for reference)
├── package.json            # Dependencies
├── FLOW.md                 # This file
└── reports/
    ├── {firm}-research.json
    └── {firm}-report-v8.html
```

---

## Dependencies

```bash
npm install playwright
npx playwright install chromium
```

---

## Case Studies by Practice Area

The report generator automatically selects a matching case study:

| Practice Area | Case Study Firm | Results |
|--------------|-----------------|---------|
| Personal Injury | Martinez & Associates (Phoenix) | $45K → $180K |
| Family Law | Thompson Family Law (Tampa) | $28K → $95K |
| Criminal Defense | Davis Defense Group (Atlanta) | $35K → $120K |
| Estate Planning | Heritage Law Partners (Scottsdale) | $18K → $62K |
| Civil Litigation | Blackwell Litigation (Denver) | $52K → $165K |

---

## Average Case Values

Used for revenue calculations:

| Practice Area | Avg Case Value |
|--------------|----------------|
| Personal Injury | $25,000 |
| Car Accident | $20,000 |
| Truck Accident | $35,000 |
| Medical Malpractice | $50,000 |
| Family Law | $5,000 |
| Divorce | $6,000 |
| Criminal Defense | $8,000 |
| DUI | $5,000 |
| Estate Planning | $3,500 |
| Immigration | $5,000 |
| Business Law | $10,000 |
| Civil Litigation | $15,000 |
| Employment Law | $12,000 |

---

## Troubleshooting

**"Competitor search failed"**
- Make sure you provide location: `node research-v3.js <url> "City, State"`
- Google Maps needs location to find local competitors

**"PageSpeed API unavailable"**
- The free API has rate limits
- Script will estimate if API fails
- For better results, add PAGESPEED_API_KEY env variable

**"No competitors found"**
- Try a more specific search: use the primary practice area + city
- Check if the firm is in a very niche market

**Report shows wrong practice area**
- The script detects practice areas from website text
- You can manually edit the research.json before generating

---

## Integration with BARD

When BARD needs to generate a report:

1. BARD runs research-v3.js with firm URL + location
2. BARD reads the output JSON
3. BARD runs report-generator-v8.js with JSON + contact name
4. BARD returns the HTML file path

Example BARD prompt:
```
Research this law firm and generate a report:
- Website: https://www.smithlaw.com/
- Location: Miami, FL
- Contact: John Smith
```

---

## Changelog

**V3/V8 (Current)**
- Real competitor data from Google Maps
- Real PageSpeed API scores
- Verified Google/Meta Ads status
- Math adds up correctly
- Practice-area matched case studies
- Multiple CTAs + FAQ + risk reversal
- 5-stage awareness flow

**V2/V7 (Previous)**
- Basic website scraping
- Empty competitor arrays
- Fake PageSpeed (just load time)
- Generic case studies
- Single CTA at bottom
