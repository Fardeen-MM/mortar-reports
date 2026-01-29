# Speed-to-Lead Flow

Complete pipeline from lead → research → HTML report

## Pipeline

```
Lead Info (name, website)
    ↓
1. research-v2.js (scrapes, analyzes, finds gaps)
    ↓
   research.json (structured data)
    ↓
2. report-generator-v7.js (generates HTML from data)
    ↓
   final-report.html (send to prospect)
```

## Step 1: Research

**Input:** Website URL
**Output:** JSON with gaps, competitors, opportunities

```bash
node research-v2.js https://www.cohen-williams.com/
```

**Produces:**
- `reports/cohen-williams-llp-research.json`

**What it does:**
- Scrapes website (practice areas, location, phone, etc.)
- Checks Google Ads Transparency
- Checks Meta Ads Library
- Checks for 24/7 support
- Detects CRM/automation gaps
- Calculates opportunity ($$$)

**File:** `research-v2.js` (32KB)

---

## Step 2: Generate Report

**Input:** Research JSON + Prospect Name
**Output:** HTML landing page

```bash
node report-generator-v7.js ./reports/cohen-williams-llp-research.json "Brittany L. Lane"
```

**Produces:**
- `reports/cohen-williams-llp-report-v7.html`

**What it does:**
- Reads research data
- Generates personalized hero section
- Creates gap cards
- Builds solution cards
- Adds case study
- Adds CTA with timeline

**File:** `report-generator-v7.js` (37KB)

---

## Full Command (One Lead)

```bash
# 1. Research
cd ~/clawd/speed-to-lead
node research-v2.js https://www.firmwebsite.com/

# 2. Generate report
node report-generator-v7.js ./reports/firm-name-research.json "Prospect Name"

# 3. Open result
open ./reports/firm-name-report-v7.html
```

---

## Files You Need

1. **research-v2.js** - Research engine
2. **report-generator-v7.js** - HTML generator
3. **package.json** - Dependencies

---

## Example Data Structure

**research.json** (what research-v2.js produces):

```json
{
  "firmName": "Cohen Williams LLP",
  "website": "https://www.cohen-williams.com/",
  "location": {
    "city": "Los Angeles",
    "state": "CA",
    "country": "US"
  },
  "practiceAreas": ["civil litigation", "appeals"],
  "credentials": ["Boutique law firm", "Civil litigation specialists"],
  "gaps": {
    "metaAds": {
      "hasGap": true,
      "impact": 12000,
      "details": "Not running Facebook/Instagram ads...",
      "status": "none"
    },
    "googleAds": {
      "hasGap": true,
      "impact": 8000,
      "details": "Market opportunity: No competitors advertising...",
      "status": "blue-ocean"
    },
    "support24x7": {
      "hasGap": true,
      "impact": 15000,
      "details": "No 24/7 support detected..."
    },
    "crm": {
      "hasGap": true,
      "impact": 8000,
      "details": "Manual follow-up wastes 15+ hrs/week..."
    }
  },
  "metaAdsData": {
    "hasAds": false,
    "hasActiveAds": false,
    "hasInactiveAds": false,
    "adCount": 0,
    "competitors": []
  },
  "googleAdsData": {
    "hasAds": false,
    "adCount": 0,
    "adExamples": []
  },
  "websiteAnalysis": {
    "pageSpeed": 1508,
    "pageSpeedScore": "Fast",
    "phoneNumber": "(213) 232-5165",
    "menuItems": ["About", "Attorneys", "Practice Areas"]
  },
  "estimatedMonthlyRevenueLoss": 43000
}
```

---

## Locations

All files in: `~/clawd/speed-to-lead/`

- `research-v2.js` - Research script
- `report-generator-v7.js` - Report generator
- `reports/` - Output folder
- `package.json` - Dependencies (playwright, etc.)
