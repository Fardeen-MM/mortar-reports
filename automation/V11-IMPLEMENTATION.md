# Report Generator V11 - Critical Fixes Implementation

## 7 Critical Fixes to Implement

### FIX 1: Hero Must Dominate ✅
**Changes:**
- CSS: `min-height: 90vh` (was no min-height)
- CSS: padding `80px 0 120px` (was `60px 0 80px`)
- Increase all font sizes ~10-15%
- Add `display: flex; flex-direction: column; justify-content: center;`
- Mobile: `min-height: auto`

### FIX 2: Remove Duplicate CTA ✅
**Changes:**
- Delete soft CTA section that appears after hero
- Keep ONLY the final CTA at bottom

### FIX 3: Add Section Intros ✅
**New sections to add:**
- Before Gaps: "Where you're losing $X/month"
- Before Competitors: "Your competitive landscape"
- Before Solution: "What it takes to fix this"
- Before Proof: "We've done this before"
- Before Two Options: "What happens next"

**CSS:**
```css
.section-intro {
  text-align: center;
  max-width: 600px;
  margin: 100px auto 40px;
}
.section-intro h2 {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 2rem;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 16px;
}
.section-intro p {
  font-size: 1.125rem;
  line-height: 1.7;
  color: var(--slate);
  margin: 0;
}
```

### FIX 4: Tighten Content ✅
**Rules:**
- Max 2 sentences per paragraph in gap boxes
- TLDR: 2 lines max
- Flow diagrams: 4 steps max
- Proof lines: 1 sentence
- Cut filler words aggressively

### FIX 5: Fix Math Validation ✅
**New validation:**
```javascript
function validateGapMath(formula, claimedAmount) {
  // Parse formula and calculate
  const calculated = evaluateFormula(formula);
  const tolerance = 0.15; // 15%
  const diff = Math.abs(calculated - claimedAmount) / claimedAmount;
  
  if (diff > tolerance) {
    throw new Error(`Gap math mismatch: formula gives $${calculated}, claimed $${claimedAmount}`);
  }
}

// Ensure gaps sum to hero total (±$1K)
const gapSum = gap1 + gap2 + gap3;
if (Math.abs(gapSum - heroTotal) > 1000) {
  // Adjust gaps proportionally
}
```

### FIX 6: Competitor Data Validation ✅
**Rules:**
```javascript
// Check if all competitors have identical data
if (competitorsAllIdentical(competitors)) {
  // Replace with "—" or "No reviews"
  // Add disclaimer: "Limited public data available"
}

// Format fixes:
// "0.0★" → "—"
// "0" reviews → "—"
```

### FIX 7: Prevent Duplicate TLDR/Insight ✅
**Validation:**
```javascript
function generateCompetitorInsight(competitors, tldr) {
  const insight = analyzeCompetitors(competitors);
  
  // Ensure insight is different from TLDR
  if (insight.toLowerCase().includes(tldr.toLowerCase().substring(0, 30))) {
    // Generate expanded version with specifics
    insight = expandWithDetails(competitors);
  }
  
  return insight;
}
```

## Implementation Order

1. ✅ Update CSS (hero, section-intro)
2. ✅ Remove soft CTA from template
3. ✅ Add section intro HTML before each major section
4. ✅ Tighten all content strings (TLDRs, gap descriptions, proofs)
5. ✅ Add math validation to calculateGaps()
6. ✅ Add competitor data validation
7. ✅ Prevent TLDR/insight duplication

## Testing Checklist

```
[ ] Hero takes 90vh on desktop
[ ] NO soft CTA after hero
[ ] 5 section intros present (Gaps, Competitors, Solution, Proof, Next)
[ ] Gap math validates (±15%)
[ ] Gaps sum to hero total (±$1K)
[ ] Competitor data not all identical OR has disclaimer
[ ] TLDR ≠ Insight for competitors
[ ] Mobile: hero min-height: auto
[ ] All content tightened (max 2 sentences/paragraph)
```

## Files to Update

- `automation/report-generator-v11.js` (new version)
- `.github/workflows/process-interested-lead.yml` (update to use V11)
- `automation/iterative-qc.js` (add new validations)

## Rollout

1. Create V11
2. Test with Burris data
3. Compare V10 vs V11 output
4. Update workflow to use V11
5. Document changes
