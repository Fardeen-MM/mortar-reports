# AI Quality Control System

## Overview

Every report generated goes through automated quality control validation before deployment. **Reports that fail QC are never deployed.**

## How It Works

### Workflow Integration

```
Lead Reply → Research → AI Analysis → Generate Report
                                         ↓
                                    🔍 QC Validation
                                         ↓
                          ┌──────────────┴──────────────┐
                          ↓                             ↓
                   ✅ QC PASSED                  ❌ QC FAILED
                          ↓                             ↓
                    Deploy Report              Block Deployment
                          ↓                             ↓
                Telegram Approval          Telegram Error Notification
```

### QC Script

**File:** `automation/ai-quality-control.js`

**What It Checks:**

#### PHASE 1: CRITICAL CHECKS (Auto-Fail)
- ❌ Firm name is "Unknown Firm" or missing
- ❌ Location (city/state) is missing
- ❌ Report contains placeholder text ({{variable}}, [TODO])
- ❌ Research confidence < 5/10
- ❌ Less than 3 competitors found
- ❌ No practice areas identified

**If ANY critical check fails:** Report is blocked immediately.

#### PHASE 2: QUALITY CHECKS (Warnings)
- ⚠️ Banned phrases ("We'd love to chat", "If this resonates", etc.)
- ⚠️ Weasel words (likely, probably, perhaps, might)
- ⚠️ Generic phrases (legal services, world-class, best-in-class)
- ⚠️ Weak competitor names (truncated or single-word)
- ⚠️ Inconsistent review data (0 reviews but has rating)

**If quality issues found:** Report still deploys but warnings are logged.

## QC Failure Flow

When QC fails, you get a Telegram notification:

```
🛑 QUALITY CONTROL FAILED

📊 Lead: Michael Vogel
📧 Email: mvogel@abv.com
🌐 Website: abv.com

❌ Issues Found:
❌ CRITICAL: Firm name is missing or generic
❌ CRITICAL: Research confidence too low (2/10)
❌ CRITICAL: Insufficient competitor data (1 found, need 3+)

⚠️ Report was NOT deployed
Research data saved for manual review.

View workflow: [GitHub Actions link]
```

## Output Files

**QC Result:** `automation/qc-result.json`

### Success Example:
```json
{
  "status": "PASSED",
  "firmName": "Roth Jackson",
  "location": "McLean, VA",
  "criticalIssues": 0,
  "qualityIssues": 2,
  "warnings": [
    "⚠️  Found banned phrase: \"We'd love to chat\"",
    "⚠️  Too many weasel words (7 found - should be < 5)"
  ],
  "recommendation": "Report can deploy but has minor quality issues"
}
```

### Failure Example:
```json
{
  "status": "FAILED",
  "phase": "CRITICAL_DATA",
  "issues": [
    "❌ CRITICAL: Firm name is missing or generic",
    "❌ CRITICAL: Location (city/state) is missing",
    "❌ CRITICAL: Research confidence too low (2/10)"
  ],
  "recommendation": "Report needs better research data. Do not deploy."
}
```

## Extending QC Checks

To add more validation checks:

1. Edit `automation/ai-quality-control.js`
2. Add check to appropriate phase:
   - **PHASE 1** = Auto-fail (critical)
   - **PHASE 2** = Warning (quality)
3. Push critical issues to `criticalIssues` array
4. Push warnings to `qualityIssues` array

### Example: Add Math Validation

```javascript
// PHASE 1: Mathematical validation
const gapTotal = research.gaps?.reduce((sum, gap) => sum + gap.monthlyCost, 0);
const heroTotal = research.estimatedMonthlyRevenueLoss;

if (Math.abs(gapTotal - heroTotal) > heroTotal * 0.05) {
  criticalIssues.push(`❌ CRITICAL: Gap sum (${gapTotal}) doesn't match hero total (${heroTotal})`);
}
```

## Testing QC Locally

```bash
cd automation

# Test with actual report files
node ai-quality-control.js \
  reports/roth-jackson-intel-v5.json \
  reports/roth-jackson-landing-page-v8.html
```

**Exit codes:**
- `0` = QC passed
- `1` = QC failed (critical issues)

## Next Improvements

### Priority 1: Mathematical Validation
- Verify gap formulas produce claimed results
- Check gap total matches hero total
- Validate case values are realistic for practice area

### Priority 2: Content Validation
- Check all required sections present
- Verify competitor table matches text claims
- Ensure flow diagrams exist for each gap

### Priority 3: Advanced AI Validation
- Use Claude to critique report quality
- Check for logical contradictions
- Validate tone and professionalism
- Score personalization level (0-10)

### Priority 4: Iterative Fixing
- Allow QC to suggest fixes (up to 5 attempts)
- Auto-regenerate failed sections
- Re-validate after each fix attempt

## The Core Principle

**A bad report is worse than no report.**

Every report represents Mortar Metrics to a potential client. If it's not professional, accurate, and personalized, it destroys trust.

QC ensures we never send garbage.
