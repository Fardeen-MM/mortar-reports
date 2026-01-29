# 🤖 AI-Powered Analysis Engine

## What It Does

Instead of generic template reports, the AI analyzer sends your firm research data to Claude API and gets back **strategic insights** tailored to each specific firm.

---

## The Difference

### **Without AI (Template-Based):**

> **Gap: Not running Google Ads**
> 
> You're not running Google Ads. Your competitors are. This costs you $8K/month.

**Generic. Data-driven. No strategy.**

---

### **With AI (Strategic Analysis):**

> **Gap: Not running Google Ads**
> 
> Your top competitors (Ellis Law with 510 reviews) have built massive review counts over years. You can't replicate that overnight.
> 
> But here's what you CAN do: **dominate paid search**. When someone searches "divorce lawyer Freehold NJ," you can appear ABOVE Ellis Law's organic listing—even with fewer reviews.
> 
> Your 5 office locations are actually an advantage. Most competitors only cover 1-2 towns. You can run location-specific ads across all 5 markets and own "divorce lawyer near me" searches across central NJ.
> 
> Conservative estimate: $8K/month in new cases just from paid search.

**Strategic. Tailored. Competitive insight.**

---

## What Claude Analyzes

The AI looks at:

1. **Unique Positioning**
   - What makes this firm different?
   - Hidden advantages they're not leveraging
   - Strategic differentiation opportunities

2. **Competitive Landscape**
   - Why are competitors winning?
   - How can this firm compete despite disadvantages?
   - White space opportunities in the market

3. **Market Dynamics**
   - Local market trends
   - Underserved segments
   - Emerging opportunities

4. **Strategic Recommendations**
   - Prioritized action items
   - Why they'd work for THIS specific firm
   - Expected impact and timeline

5. **Hidden Opportunities**
   - Non-obvious gaps competitors miss
   - Creative angles based on firm's situation
   - Quick wins they could implement

---

## Example Analysis

### **Input Data:**

```json
{
  "firmName": "Abogadas305",
  "locations": ["Doral, FL"],
  "practiceAreas": ["personal injury", "lesiones personales"],
  "attorneys": [
    {
      "name": "Victoria San Pedro Madani",
      "title": "Founding Partner",
      "experience": "Former insurance defense attorney"
    },
    {
      "name": "Ana Cristina Berenguer",
      "title": "Founding Partner",
      "experience": "Former insurance defense attorney"
    }
  ],
  "competitors": [
    {"name": "Ellis Law", "reviews": 510, "rating": 4.9}
  ],
  "gaps": {
    "metaAds": {"hasGap": true}
  }
}
```

### **AI Output:**

```json
{
  "executive_summary": "Abogadas305 has a massive untapped advantage: both founding partners are former insurance defense attorneys who switched sides. This is marketing GOLD in a Spanish-speaking market with high immigrant distrust of insurance companies.",
  
  "positioning": "Both founding partners worked FOR insurance companies before switching to plaintiff work. This insider knowledge is incredibly valuable but completely buried on their website. They know every trick insurance companies use to deny claims. In Miami's Spanish-speaking market, this 'reformed insider' positioning would resonate powerfully—especially with recent immigrants who distrust large institutions.",
  
  "competitive_analysis": "Ellis Law dominates with 510 reviews, but they're English-only. Abogadas305 is bilingual in a 70% Spanish-speaking market (Miami-Dade County). Most personal injury firms either serve English OR Spanish clients—few do both well. The gap: authentic Spanish-language marketing (not just translated content). Their competitors aren't creating Spanish video content, partnering with Spanish media, or running Univision/Telemundo ads.",
  
  "market_insights": "Miami has one of the largest Spanish-speaking populations in the US, but most legal marketing is English-first. Recent immigrants often don't know their legal rights after accidents. There's a massive education gap—and education content builds trust. WhatsApp is huge in Latin American communities but most lawyers don't use it for intake. Voice notes > text forms for this demographic.",
  
  "strategic_recommendations": [
    "Rebrand around 'Former insurance defense attorneys who switched sides' positioning. Create video testimonial explaining why they switched and what they learned about insurance company tactics.",
    "Launch Spanish-language Meta ads targeting Miami-Dade County, ages 25-55, Spanish-speaking. Focus on education (your rights after an accident) not hard-sell.",
    "Partner with Univision/Telemundo for sponsored segments on legal rights. These audiences trust TV more than digital ads.",
    "Add WhatsApp intake (voice message option). Many Spanish speakers prefer voice over forms. This could 2x conversion rates."
  ],
  
  "hidden_opportunities": [
    "Create 'Know Your Rights' video series in Spanish. Post on TikTok/Instagram. Personal injury + Spanish content has almost no competition.",
    "Partner with Spanish churches/community centers for free legal clinics. Builds trust + massive referral network in tight-knit communities.",
    "Hire a Spanish-speaking intake specialist for evening/weekend hours. Many potential clients work during business hours and can't call."
  ]
}
```

---

## How It Works

1. **Research script** scrapes website → generates raw data JSON
2. **AI analyzer** sends data to Claude API with strategic prompt
3. **Claude thinks** for ~20-30 seconds and returns analysis
4. **Analysis injected** into research JSON
5. **Report generator** uses AI insights instead of template copy
6. **Enhanced report** deployed with strategic recommendations

---

## Cost

**Claude API Pricing (Sonnet 4):**
- Input: $3 per million tokens
- Output: $15 per million tokens

**Per Report:**
- Input: ~5,000 tokens ($0.015)
- Output: ~2,000 tokens ($0.030)
- **Total: ~$0.05-0.10 per report** 🎉

Wait, that's way cheaper than I estimated!

**For 100 reports/month:**
- AI costs: ~$5-10/month
- Everything else: $0/month

**Actual total: ~$10/month** ✅

---

## Failure Handling

If Claude API fails (timeout, rate limit, etc.):
- Script continues without AI insights
- Report still generates (using template copy)
- No pipeline failure
- Slack notification mentions AI analysis failed

**The automation is resilient** - AI enhances reports but doesn't break the pipeline.

---

## Prompt Engineering

The AI prompt includes:
- Firm profile (name, locations, team, practice areas)
- Website performance metrics
- Top 5 competitors with review counts
- Current advertising status
- Identified gaps

Prompt specifically asks for:
- Strategic thinking (not generic advice)
- Tailored recommendations
- Competitive differentiation
- Hidden opportunities
- Action items with expected impact

---

## Example Reports

### **With AI:**
- Deep strategic insights
- Competitive positioning advice
- Market-specific recommendations
- Unique opportunities based on firm background

### **Without AI:**
- Still good (template-based)
- Data-driven gap analysis
- Generic recommendations
- Standard marketing advice

**AI makes reports 10x more compelling.**

---

## Testing Locally

```bash
# 1. Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# 2. Run research
node research-v3-DEEP.js https://example.com "Contact Name"

# 3. Run AI analysis
REPORT_FILE=$(ls reports/*.json | tail -1)
node ai-analyzer.js "$REPORT_FILE"

# 4. Generate report
node report-generator-v7.js "$REPORT_FILE" "Contact Name"

# 5. Inject AI insights
REPORT_HTML=$(ls reports/*-landing-page-v7.html | tail -1)
node inject-ai-insights.js "$REPORT_HTML" "$REPORT_FILE"

# 6. Open report
open "$REPORT_HTML"
```

---

## Monitoring

**Check AI analysis quality:**
1. Look at generated reports
2. Read the "Strategic Analysis" section
3. Verify insights are specific (not generic)
4. Check recommendations match firm's actual situation

**If insights seem generic:**
- Review the prompt in `ai-analyzer.js`
- Add more context to the prompt
- Increase max_tokens for longer analysis

---

## Future Enhancements

**Possible additions:**
- Analyze competitor websites (not just listings)
- Generate custom email copy based on AI insights
- Create personalized video script suggestions
- Industry-specific analysis (law, dental, etc.)
- Multilingual analysis detection and strategy

---

## Questions?

See main docs:
- `AUTOMATION-SUMMARY.md` - Quick overview
- `SETUP-CHECKLIST.md` - Setup instructions
- `README.md` - Developer docs
