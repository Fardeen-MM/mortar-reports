# Law Firm Research Script

## Production Script: `law-firm-research.js`

**AI-powered firm intelligence for speed-to-lead outreach.**

### What It Does

Extracts high-level firm intelligence in ~30 seconds:

✅ **Firm positioning** - What makes them unique  
✅ **Key specialties** - Top practice areas (AI-identified)  
✅ **Firm size** - Boutique/mid-size/large + exact attorney count  
✅ **Recent news** - Announcements, hires, wins, expansions  
✅ **Growth signals** - New offices, practice areas, hiring trends  
✅ **Credentials** - Awards, rankings, certifications  
✅ **Sample attorneys** - 2-3 names for personalization  

### Usage

```bash
./law-firm-research.js <url> [contactName] [city] [state] [country] [company]
```

**Example:**
```bash
./law-firm-research.js https://www.rothjackson.com "Andrew Condlin" "McLean" "VA" "US" "Roth Jackson"
```

### Output

Saves to `reports/{firm-slug}-intel-v5.json`:

```json
{
  "firmName": "Roth Jackson",
  "location": {"city": "McLean", "state": "VA"},
  
  "firmIntel": {
    "positioning": "BigLaw-trained attorneys, small firm approach...",
    "keySpecialties": ["TCPA Defense", "Class Action", "Immigration"],
    "firmSize": {"estimate": "mid-size (15-50)", "attorneys": 23},
    "recentNews": ["Strategic alliance with CommLaw Group", "Hired 3 immigration attorneys"],
    "credentials": ["AV Rated", "Best Lawyers 2024"],
    "growthSignals": ["Expanding telecom practice", "New Richmond office"]
  },
  
  "sampleAttorneys": [
    {"name": "Mitchell N. Roth", "title": "Managing Partner"},
    {"name": "Joseph F. Jackson", "title": "Partner"}
  ]
}
```

### API Key Required

Set `ANTHROPIC_API_KEY` in `automation/.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Currently using **claude-3-haiku-20240307** (free tier).

### Speed & Cost

- **Time:** ~30-45 seconds per firm
- **Tokens:** ~50K input (homepage + about + team)
- **Cost:** ~$0.01 per research (Haiku pricing)

### Use Cases

Perfect for:
- ✅ Cold email personalization
- ✅ Speed-to-lead response (< 5 min)
- ✅ Automated lead enrichment
- ✅ Instant meeting prep

### Integration

See `DATA-PIPELINE-REQUIREMENTS.md` for webhook → research → draft workflow.

---

**Version:** v5 (Firm Intelligence)  
**Last Updated:** 2026-01-30
