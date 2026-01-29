# Report Template V2 - BARD Instructions

## Overview

This report takes leads through 5 awareness stages:
1. **Unaware** → "You have a problem"
2. **Problem Aware** → "Here's what it's costing you"
3. **Solution Aware** → "Here's how to fix it"
4. **Product Aware** → "We're the best at fixing it"
5. **Most Aware** → "Here's the deal, let's go"

## Research Checklist (MUST COMPLETE BEFORE GENERATING)

### 1. Basic Info
```
{{FIRM_NAME}} - Full firm name
{{CONTACT_NAME}} - Lead's name (from Apollo)
{{LOCATION}} - City, State
{{PRACTICE_AREA}} - Main practice area
{{DATE}} - Today's date
{{BOOKING_LINK}} - Calendly/booking link
{{EMAIL}} - Your contact email
```

### 2. Competitor Research (REQUIRED)

**Find 3 competitors:**
- Search Google: "{{PRACTICE_AREA}} attorney {{LOCATION}}"
- Check Google Ads Transparency: ads.google.com/adsca
- Check Meta Ad Library: facebook.com/ads/library

For each competitor, gather:
```
{{COMPETITOR_1_NAME}} - Firm name
{{COMPETITOR_1_GOOGLE}} - "Running" or "Not Running"
{{COMPETITOR_1_GOOGLE_STATUS}} - "yes" or "no" (for CSS)
{{COMPETITOR_1_META}} - "Running" or "Not Running"
{{COMPETITOR_1_META_STATUS}} - "yes" or "no" (for CSS)
{{COMPETITOR_1_REVIEWS}} - Google review count
{{COMPETITOR_1_RATING}} - Google rating (e.g., "4.8★")

(Repeat for COMPETITOR_2 and COMPETITOR_3)
```

### 3. Firm Research (REQUIRED)

**Google Business Profile:**
```
{{FIRM_REVIEWS}} - Their Google review count
{{FIRM_RATING}} - Their Google rating
```

**Website Speed (Use PageSpeed Insights):**
```
{{WEBSITE_SPEED}} - Score like "45/100" or "Poor"
{{LOAD_TIME}} - Seconds to load (e.g., "4.2")
{{MOBILE_SCORE}} - Mobile score (e.g., "38")
```

**Ad Status:**
```
{{YOUR_GOOGLE}} - "Not Running" (check Google Ads Transparency)
{{YOUR_GOOGLE_STATUS}} - "no" (for CSS)
{{YOUR_META}} - "Not Running" (check Meta Ad Library)
{{YOUR_META_STATUS}} - "no" (for CSS)
```

**Call Test (if possible):**
```
{{CALL_TEST_DATE}} - Date you called
```

### 4. Revenue Calculations

**Start with average case value by practice area:**

| Practice Area | Avg Case Value |
|---------------|----------------|
| Personal Injury | $15,000 - $50,000 |
| Family Law | $4,000 - $8,000 |
| Criminal Defense | $5,000 - $15,000 |
| Estate Planning | $2,500 - $5,000 |
| Immigration | $4,000 - $8,000 |
| Business Law | $5,000 - $20,000 |
| Civil Litigation | $8,000 - $25,000 |

**Calculate losses:**
```
{{AVG_CASE_VALUE}} - Use table above

{{GOOGLE_ADS_LOSS}} - Estimate 3-5 leads/month × case value × 30%
{{META_ADS_LOSS}} - Estimate 2-3 leads/month × case value × 30%
{{AFTERHOURS_LOSS}} - Estimate 4-6 leads/month × case value × 40%
{{SPEED_LOSS}} - Estimate 2-3 leads/month × case value × 20%

{{MONTHLY_LOSS}} - Sum of all losses (MUST ADD UP EXACTLY)
{{YEARLY_LOSS}} - Monthly × 12
{{WEEKLY_LOSS}} - Monthly ÷ 4
{{DAILY_LOSS}} - Monthly ÷ 30
```

**Calculate gains (should equal losses):**
```
{{GOOGLE_ADS_GAIN}} - Same as GOOGLE_ADS_LOSS
{{META_ADS_GAIN}} - Same as META_ADS_LOSS
{{INTAKE_GAIN}} - Same as AFTERHOURS_LOSS
{{SPEED_GAIN}} - Same as SPEED_LOSS
```

### 5. Supporting Data
```
{{COMPETITOR_COUNT}} - Number of competitors analyzed (e.g., "15")
{{WEEKLY_LEADS_LOST}} - Estimate searches in market/week (e.g., "47")
{{COMPETITOR_MONTHLY_SPEND}} - Estimate competitor ad spend (e.g., "$8-15K")
{{META_COMPETITOR_COUNT}} - How many running Meta ads (e.g., "3")
```

### 6. Case Study (Match Practice Area)

**Use a relevant case study:**

For Personal Injury:
```
{{CASE_STUDY_FIRM}} - "Martinez & Associates"
{{CASE_STUDY_PRACTICE}} - "Personal Injury"
{{CASE_STUDY_LOCATION}} - "Phoenix, AZ"
{{CASE_STUDY_SIZE}} - "6 Attorneys"
{{CASE_BEFORE}} - "45K"
{{CASE_BEFORE_CASES}} - "8"
{{CASE_AFTER}} - "180K"
{{CASE_AFTER_CASES}} - "32"
{{CASE_STUDY_QUOTE}} - "We went from hoping for cases to turning them away. Best investment we ever made."
{{CASE_STUDY_ATTRIBUTION}} - "Managing Partner, Martinez & Associates"
```

For Family Law:
```
{{CASE_STUDY_FIRM}} - "Thompson Family Law"
{{CASE_STUDY_PRACTICE}} - "Family Law"
{{CASE_STUDY_LOCATION}} - "Tampa, FL"
{{CASE_STUDY_SIZE}} - "4 Attorneys"
{{CASE_BEFORE}} - "28K"
{{CASE_BEFORE_CASES}} - "12"
{{CASE_AFTER}} - "95K"
{{CASE_AFTER_CASES}} - "38"
{{CASE_STUDY_QUOTE}} - "Month 1 ROI paid for the entire year. We're now the dominant firm in our market."
{{CASE_STUDY_ATTRIBUTION}} - "Founding Partner, Thompson Family Law"
```

For Criminal Defense:
```
{{CASE_STUDY_FIRM}} - "Davis Defense Group"
{{CASE_STUDY_PRACTICE}} - "Criminal Defense"
{{CASE_STUDY_LOCATION}} - "Atlanta, GA"
{{CASE_STUDY_SIZE}} - "3 Attorneys"
{{CASE_BEFORE}} - "35K"
{{CASE_BEFORE_CASES}} - "7"
{{CASE_AFTER}} - "120K"
{{CASE_AFTER_CASES}} - "24"
{{CASE_STUDY_QUOTE}} - "Our phone used to ring 3 times a week. Now it doesn't stop. Problem is keeping up."
{{CASE_STUDY_ATTRIBUTION}} - "Owner, Davis Defense Group"
```

---

## Research Process (Step by Step)

### Step 1: Google Search (2 min)
1. Search: "{{PRACTICE_AREA}} attorney {{LOCATION}}"
2. Note top 3 organic results = your competitors
3. Note which have "Ad" labels = running Google Ads

### Step 2: Google Ads Transparency (2 min)
1. Go to: ads.google.com/adsca
2. Search each competitor name
3. Record: Running / Not Running

### Step 3: Meta Ad Library (2 min)
1. Go to: facebook.com/ads/library
2. Search each competitor name
3. Record: Running / Not Running + screenshot if possible

### Step 4: Google Business Profiles (2 min)
1. Search firm name + "reviews"
2. Record: Review count + rating for each

### Step 5: PageSpeed Test (1 min)
1. Go to: pagespeed.web.dev
2. Enter firm's website URL
3. Record: Performance score, mobile score, load time

### Step 6: Calculate Revenue (2 min)
1. Use case value from table
2. Apply formulas above
3. DOUBLE CHECK: All losses must add up to total

### Step 7: Generate Report (1 min)
1. Copy template
2. Find/replace all {{PLACEHOLDERS}}
3. Save as: `{firm-name}-report.html`

---

## Quality Checklist

Before sending, verify:

- [ ] All competitor names are REAL firms in their market
- [ ] Google/Meta ad status is ACCURATE (verifiable)
- [ ] Review counts/ratings are CURRENT
- [ ] PageSpeed score is REAL
- [ ] Math ADDS UP (individual losses = total)
- [ ] Case study matches practice area
- [ ] No {{PLACEHOLDER}} text remaining
- [ ] Booking link works

---

## Example: Completed Research

**Firm:** Cohen Williams LLP
**Location:** Los Angeles, CA
**Practice Area:** Civil Litigation
**Contact:** Brittany Lane

**Competitors Found:**
1. King & Spalding - Google: Running, Meta: Not Running, 89 reviews, 4.7★
2. Latham & Watkins - Google: Running, Meta: Running, 156 reviews, 4.8★
3. Gibson Dunn - Google: Running, Meta: Not Running, 67 reviews, 4.6★

**Firm Data:**
- Reviews: 23
- Rating: 4.2★
- PageSpeed: 45/100
- Load Time: 4.8 seconds
- Mobile: 38/100
- Google Ads: Not Running
- Meta Ads: Not Running

**Revenue Calc (Civil Litigation avg case: $12,000):**
- Google Ads Loss: 4 leads × $12K × 30% = $14,400
- Meta Ads Loss: 3 leads × $12K × 30% = $10,800
- After-Hours Loss: 5 leads × $12K × 40% = $24,000
- Speed Loss: 2 leads × $12K × 25% = $6,000
- **TOTAL: $55,200/month** ($662,400/year)

---

## File Naming

Save as: `{firm-name-lowercase}-report.html`

Examples:
- `cohen-williams-llp-report.html`
- `martinez-associates-report.html`
- `smith-law-group-report.html`
