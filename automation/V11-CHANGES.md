# V11 Critical Changes

## Quick Summary

**What changed from V10 → V11:**

1. **Hero dominates viewport** (90vh, bigger fonts, flex centering)
2. **Removed soft CTA** after hero
3. **Added 5 section intros** before major sections
4. **Tightened all content** (max 2 sentences/paragraph)
5. **Math validation** (formulas must calculate correctly ±15%)
6. **Competitor data fixes** (no all-identical data, format "—" not "0.0★")
7. **TLDR ≠ Insight** validation (prevent duplication)

## Key Functions Modified

### `generateHTML(data)` - Line ~469
- Updated hero CSS (+90vh, flex, bigger fonts)
- Removed soft CTA section
- Added section-intro CSS
- Added 5 section intro HTML blocks

### `calculateGaps(gaps, totalMonthly, caseValue, competitors)` - Line ~365
- Added math validation for each gap
- Ensured gaps sum to hero total (±$1K)
- Proportional adjustment if gaps don't sum correctly

### `generateCompetitors(competitors, city)` - Line ~753
- Check if all competitor data identical
- Format "0.0★" → "—"
- Add disclaimer if limited data

### `generateCompetitorInsight(competitors, tldr)` - NEW FUNCTION
- Ensures insight ≠ TLDR
- Expands with specific details if duplication detected

## Testing

Run with Burris data:
```bash
node automation/report-generator-v11.js automation/reports/burris--nisenbaum--curry---lacy-intel-v5.json
```

Compare output to V10.

## Validation

QC should catch:
- Hero not dominant
- Soft CTA present  
- Missing section intros
- Math errors (>15% off)
- Duplicate TLDR/insight
- All-identical competitor data
