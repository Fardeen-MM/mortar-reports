# Iterative QC System

## How It Works

Instead of deploying bad reports, the system now **iterates until the report is good** (up to 5 attempts).

### Flow

```
Generate Report → QC Check
                     ↓
                 ✅ PASS → Deploy
                     ↓
                 ❌ FAIL → Analyze Issues
                     ↓
                 Generate Fixes (Claude)
                     ↓
                 Regenerate Report
                     ↓
                 QC Check Again
                     ↓
              (repeat up to 5x)
                     ↓
          Deploy best version
```

### What Happens Each Iteration

**Iteration 1:**
1. Generate initial report from research data
2. Run QC validation
3. If fails: Analyze what's wrong

**Iteration 2-5:**
1. Claude analyzes QC issues + research data
2. Identifies what data is missing/incorrect
3. Extracts correct data from research JSON
4. Report generator runs again with corrections
5. QC validates again

### Example

**Iteration 1 QC Fails:**
```
❌ CRITICAL: Firm name is "Unknown Firm"
❌ CRITICAL: Location is missing
⚠️  Found banned phrase: "We'd love to chat"
```

**Claude Analysis:**
```json
{
  "fixes": [
    {
      "issue": "Firm name is Unknown",
      "fix": "Use firmName from research.json",
      "data": "Burris, Nisenbaum, Curry & Lacy"
    },
    {
      "issue": "Location missing",
      "fix": "Use location.city and location.state",
      "data": "Oakland, CA"
    },
    {
      "issue": "Banned phrase",
      "fix": "Remove soft language, use direct statements"
    }
  ]
}
```

**Iteration 2 Regenerates With:**
- Correct firm name
- Correct location
- Better language

**Iteration 2 QC:**
- ✅ Firm name: "Burris, Nisenbaum, Curry & Lacy"
- ✅ Location: "Oakland, CA"
- ✅ No banned phrases

**Result:** QC PASSES after 2 iterations → Deploy

### When It Stops

**Stops on SUCCESS:**
- QC passes all checks
- Report is high quality
- Deploys immediately

**Stops on MAX ITERATIONS (5):**
- Tried 5 times, still has issues
- Deploys best version with warnings
- Better than deploying iteration 1 garbage

**Stops on UNFIXABLE:**
- Research data is fundamentally broken
- No firm name in research JSON
- No competitors found
- Can't generate valid report

### What Gets Fixed

**Data Issues:**
- Missing firm name → Extract from research
- Missing location → Extract from research
- Missing competitors → Use what's available
- Generic company name → Use actual firmName

**Content Issues:**
- Banned phrases → Rewrite without them
- Weasel words → Make statements definitive
- Generic language → Add specificity
- Template smell → Personalize

**Logic Issues:**
- Contradictions → Fix with correct data
- Math errors → Recalculate
- Inconsistencies → Align with research

### Cost

**Claude API calls per report:**
- Iteration 1: 1 call (AI analysis of research)
- Iteration 2+: 1 call per iteration (fix analysis)

**Typical:**
- Good research: 1-2 iterations (~$0.10)
- Mediocre research: 3-4 iterations (~$0.20)
- Bad research: 5 iterations (~$0.25)

**Worth it:** Way cheaper than losing a client because you sent garbage.

### Monitoring

**GitHub Actions logs show:**
```
🔄 ITERATION 1 of 5
📊 Running QC validation...
❌ QC found issues
🔧 Analyzing issues and generating fixes...
✅ Fixes generated
🔄 Regenerating report with fixes...

🔄 ITERATION 2 of 5
📊 Running QC validation...
✅ QC PASSED!

✅ QC PASSED after 2 iteration(s)
```

**Telegram notification includes:**
- QC status (✅ or ⚠️)
- Number of iterations required
- Final quality score

### Files

```
automation/ai-quality-control.js - QC validator
automation/fix-report-issues.js - Fix analyzer (uses Claude)
automation/report-generator-v8.js - Report generator (runs multiple times)
.github/workflows/process-interested-lead.yml - Orchestrates the loop
```

### The Philosophy

**Old way:**
- Generate once
- Deploy whatever comes out
- Hope it's good

**New way:**
- Generate
- Check quality
- Fix what's broken
- Repeat until good
- Deploy when ready

**Result:** Every report that reaches Telegram has been validated and refined.
