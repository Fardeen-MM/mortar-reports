# Current Context - February 5, 2026

## What We Did Today

### 1. Added Google Ads + Meta Ads Detection
- Created `automation/ads-detector.js` - detects ads via Google Ads Transparency Center and Meta Ad Library
- Integrated into `automation/maximal-research-v2.js` as Phase 7
- Updated `automation/report-generator-v3.js` to use ads data and customize copy based on whether firm is running ads

### 2. Comprehensive Pipeline Audit
Found and fixed multiple issues:

| Issue | Fix |
|-------|-----|
| QC confidence check always failing | Removed check for non-existent field |
| Practice area path mismatch | Added `practice.practiceAreas` to detection |
| QC failures not visible | Added red warning in Telegram when QC fails |
| Ads detector fails silently | Added `detectionSucceeded` flag |
| Firm size not used | Updated `getFirmSizeMultiplier()` to check multiple paths |
| 40 unused files | Deleted 27,226 lines of dead code |

### 3. Added Concurrency Control
Added to `.github/workflows/process-interested-lead.yml`:
```yaml
concurrency:
  group: lead-${{ github.event.client_payload.email }}-${{ github.event.client_payload.email_id }}
  cancel-in-progress: false
```

## Current Issues (UNRESOLVED)

### Issue 1: Instantly Sending Duplicate Webhooks
**Symptom:** wslegal lead triggers TWO webhooks, paletzlaw triggers ONE

**Root Cause:** Two webhook sources in Instantly:
1. Campaign-level webhook (has full lead data, campaign_id present)
2. Workspace-level webhook (minimal data, campaign_id: null)

**Payloads received:**

Payload 1 (full - from campaign):
```json
{
  "campaign_id": "3837a4f1-0314-4b0c-acc3-480bc1d7ad38",
  "campaign_name": "Lawyer Campaign (bard)",
  "firstName": "Shah",
  "lastName": "Ali",
  "companyName": "Waterstone Legal",
  "City": "London",
  "State": "England",
  "website": "",
  ...full data...
}
```

Payload 2 (minimal - from workspace):
```json
{
  "campaign_id": null,
  "lead_email": "s.ali@wslegal.co.uk",
  "reply_text": "...",
  ...minimal data only...
}
```

**Fix needed in Instantly:**
- Check Workspace Settings → Webhooks
- Check Campaign Settings → Webhooks
- Remove one of them (keep the campaign-level one for full data)

### Issue 2: Workflows Complete But Don't Create Reports
**Symptom:** GitHub Actions shows all steps ✅ but:
- "Send failure notification" runs
- "Store report in pending folder" skipped
- "Commit pending report" skipped

**Pattern in all recent runs:**
```
✅ Run Maximal Research Engine V2
✅ Extract firm info from research
✅ Validate firm name
✅ Generate V3 Report
⏭️ Run QC Validation (skipped)
✅ Send failure notification (RUNS - shouldn't!)
⏭️ Store report (skipped)
⏭️ Telegram (skipped)
⏭️ Commit (skipped)
```

**Root Cause:** "Generate V3 Report" step sets `blocked=true` even though it shows ✅

The step does:
```bash
RESEARCH_FILE=$(find reports -name "*-maximal-research.json" -type f | head -1)
if [ -z "$RESEARCH_FILE" ]; then
  echo "blocked=true" >> $GITHUB_OUTPUT
  exit 0  # Exits with success but blocked=true
fi
```

**Theory:** The research file exists when "Extract firm info" runs, but doesn't exist (or can't be found) when "Generate V3 Report" runs. Possibly:
- File naming/path issue
- Concurrent runs interfering
- File being deleted between steps

**Debug needed:** Check the actual workflow logs to see what `ls -la reports/` shows at each step.

## Files Modified Today

### New Files:
- `automation/ads-detector.js`

### Modified Files:
- `automation/maximal-research-v2.js` - Added ads detection Phase 7
- `automation/report-generator-v3.js` - Ads data usage, practice area fix, firm size fix
- `automation/ai-quality-control-basic.js` - Fixed broken checks
- `automation/telegram-approval-bot.js` - QC warning display
- `.github/workflows/process-interested-lead.yml` - Concurrency control

### Deleted Files (40 total):
- `automation/report-generator-v{7,8,9,10,11}.js`
- `automation/report-generator-v12-*.js`
- `automation/research-v3-*.js`
- All 28 JS files in `speed-to-lead/`

## Next Steps

1. **Fix Instantly duplicate webhook** - User needs to check Instantly settings
2. **Debug workflow blocked=true issue** - Need to see actual logs to understand why research file not found
3. **Test end-to-end** - Once both fixed, run a fresh lead through

## Recent GitHub Actions Runs

| Run ID | Time | Status | Notes |
|--------|------|--------|-------|
| 21717593556 | 15:31:35 | success | No report created (blocked) |
| 21717584015 | 15:31:19 | success | No report created (blocked) |
| 21717584010 | 15:31:19 | success | No report created (blocked) |
| 21717165755 | 15:19:55 | success | wslegal duplicate |
| 21717165746 | 15:19:55 | success | wslegal duplicate |
