# Iterative QC System

**Status:** ✅ ACTIVE  
**Goal:** No bad reports ever get deployed. Every report must pass 157+ validation checks.

## How It Works

```
Generate Report (v8)
  ↓
Run QC Validation (157 checks)
  ↓
├─ PASS → Deploy ✅
└─ FAIL → Fix & Retry (max 5 iterations)
     ↓
     AI Analysis (Claude identifies root causes)
     ↓
     Apply Fixes (modify research data)
     ↓
     Regenerate Report
     ↓
     Re-run QC Validation
     └─ Loop until PASS or max iterations
```

## Components

### 1. `ai-quality-control.js`
**157+ validation checks** across 9 phases:

1. **DATA_EXISTENCE** - All critical fields present
2. **DATA_SANITY** - No placeholder/truncated values
3. **MATH** - Dollar amounts add up correctly
4. **LOGIC** - Content matches data (no contradictions)
5. **STRUCTURE** - All required sections present
6. **CONTENT** - Sufficient specificity and density
7. **LANGUAGE** - No banned phrases, minimal weasel words
8. **VISUAL** - Proper formatting and responsiveness
9. **FINAL** - Human check heuristics

**Exit codes:**
- `0` = All checks passed
- `1` = Failures found (writes `qc-result.json`)

### 2. `iterative-qc.js`
**Master orchestrator** - handles iteration loop:

1. Run QC validation
2. If failed:
   - Analyze issues with Claude AI
   - Apply fixes to research data
   - Create improvement notes
   - Regenerate report
   - Retry (max 5 times)
3. If passed: Exit with success
4. If max iterations: Exit with failure

**Environment:**
- `ANTHROPIC_API_KEY` required

**Exit codes:**
- `0` = Report perfect after N iterations
- `1` = Could not fix after 5 iterations

### 3. `apply-qc-fixes.js`
**Data improvement engine** - uses AI to fix research data:

- Takes QC failures and AI guidance
- Generates improved research JSON
- Rewrites research file with fixes
- Shows what changed

**Key improvements:**
- Fixes generic/placeholder values
- Adds missing critical fields
- Improves specificity
- Ensures mathematical consistency

### 4. `report-generator-v8.js` (enhanced)
Now reads `improvement-notes.txt` if present:

- Logs improvement guidance
- Uses improved research data
- Applies specific fixes noted by AI

## GitHub Actions Workflow

The workflow now uses iterative QC:

```yaml
- name: Quality Control & Iterative Fixing (AI-Powered)
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC }}
  run: |
    node iterative-qc.js research.json report.html "Contact Name"
```

**Behavior:**
- ✅ QC passes → Deploy immediately
- ❌ QC fails → Fix & retry up to 5 times
- ⚠️  Still fails after 5 → Deploy with warnings (manual review)

## Validation Phases Detail

### Phase 1: Data Existence Gate
Critical blockers that prevent report generation:
- Firm name not "Unknown" or generic
- City and state present
- Practice areas identified
- At least 3 competitors
- Review data present

### Phase 2: Data Sanity
Quality checks on data:
- No placeholder brackets `[]`
- City not truncated (e.g., "Lean" → should be "McLean")
- Competitor names not single words
- Review counts realistic (0-10,000)
- Ratings in range (0-5)

### Phase 3: Mathematical Validation
Dollar amounts must be accurate:
- No suspiciously round numbers ($10K, $20K, $50K)
- Gap amounts sum to hero total (±5% tolerance)

### Phase 4: Logical Consistency
Content must match data:
- If mentions reviews → review data must exist
- If mentions competitors → competitor data must exist
- No contradictions between sections

### Phase 5: Structural Validation
Required sections:
- Hero section
- Gap #1, #2, #3
- Flow diagrams (12+ arrows)
- Competitor table
- Social proof

### Phase 6: Content Quality
Specificity requirements:
- Firm name appears 2+ times
- City appears 4+ times
- 10+ bold text elements
- 4+ pull quotes

### Phase 7: Language Quality
Banned phrases:
- "We'd love to chat"
- "If this resonates"
- "No pitch, just..."
- "Most agencies would charge..."
- Corporate jargon (leverage, synergy, circle back)

Weasel words (max 5):
- likely, probably, perhaps, possibly, might, seems, appears

### Phase 8: Visual & Formatting
- CSS styles present
- Font-family declared
- Mobile responsive (viewport/max-width)

### Phase 9: Final Human Check
- Word count: 800-5,000 words
- No unrealistic guarantees (100%, 10x)
- Passes "Partner Test" (would you send this?)

## AI Analysis Prompts

When QC fails, Claude analyzes:

**Input:**
- Research data (full JSON)
- Report HTML (first 3000 chars)
- QC failures (all issues listed)

**Output:**
1. **ROOT CAUSES** - What's fundamentally wrong?
2. **SPECIFIC FIXES** - Concrete improvements needed
3. **PRIORITY** - Which issues are most critical?
4. **REGENERATION GUIDANCE** - What to focus on

## Success Criteria

A report can deploy when:
- ✅ All 157+ checks pass
- ✅ Firm name is specific and accurate
- ✅ Location is complete and validated
- ✅ At least 3 competitors with data
- ✅ Math is accurate (all dollar amounts add up)
- ✅ Content is specific (uses actual names, numbers, data)
- ✅ No banned phrases or placeholder text
- ✅ Logical consistency throughout
- ✅ Proper structure and formatting

## Iteration Examples

### Iteration 1 → 2
**Issue:** Firm name was "Unknown Firm"  
**Fix:** AI extracts from domain → "Burris, Nisenbaum, Curry & Lacy"  
**Result:** Pass ✅

### Iteration 1 → 3
**Issue:** Math didn't add up (gaps sum $45K but hero said $60K)  
**Fix:** AI recalculates based on research data → Updated gaps  
**Result:** Pass ✅

### Iteration 1 → 5 → Manual Review
**Issue:** No competitor data, generic content, placeholder text  
**Fix attempts:** 
- Iter 2: AI tries to extract competitors (partial success)
- Iter 3: AI improves specificity (still generic)
- Iter 4: AI rewrites sections (still issues)
- Iter 5: AI final attempt (not enough data)  
**Result:** Deploy with warnings ⚠️ (manual review required)

## Cost

**Per report with iterations:**
- QC validation: Free (rule-based)
- AI analysis (Claude Sonnet 4): ~$0.10-0.20 per iteration
- Data fixing (Claude): ~$0.05-0.10 per iteration
- **Average:** $0.30-0.50 per report (assuming 2-3 iterations)
- **Max (5 iterations):** ~$1.25 per report

**This cost is worth it** to prevent bad reports from being sent.

## Monitoring

After deployment:
1. Check `qc-result.json` for pass/fail status
2. Check `iterative-qc-result.json` for iteration count
3. If failed: Review `improvement-notes.txt` for what was attempted
4. Telegram notification includes QC status

## Future Improvements

1. **Learning system** - Track which issues repeat, improve detection
2. **A/B testing** - Generate multiple versions, pick best
3. **Human feedback loop** - Learn from manual edits
4. **Confidence scoring** - Deploy only if confidence ≥90%
5. **Semantic validation** - Check if claims are supported by data

## Manual Override

If you need to bypass QC (emergency only):

```bash
# In workflow, add:
env:
  SKIP_QC: "true"

# Or locally:
SKIP_QC=true node iterative-qc.js research.json report.html
```

**⚠️  Use sparingly!** Bad reports hurt conversions and reputation.
