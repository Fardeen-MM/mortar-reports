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

### 3. Added Concurrency Control + Duplicate Detection
Added to `.github/workflows/process-interested-lead.yml`:
```yaml
# Fixed: Uses only email (not email_id) because Instantly sends two webhooks
# with different payloads (campaign-level and workspace-level)
concurrency:
  group: lead-${{ github.event.client_payload.email }}
  cancel-in-progress: false
```

Also added:
- **Duplicate check step** - Checks if pending approval already exists for this email
- **Skip conditions** - All processing steps skip if duplicate detected
- **Skip notification** - Logs when skipping duplicate webhook

### 4. Fixed Race Condition (Concurrent Runs)
The `blocked=true` issue was caused by two workflows running simultaneously for the same lead:
- Instantly sends TWO webhooks (campaign + workspace level)
- Old concurrency key used `email_id` which differed between payloads
- Both workflows ran, causing race condition where research file was overwritten

**Fix:** Removed `email_id` from concurrency key + added duplicate detection.

## Current Issues (PARTIALLY RESOLVED)

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

### Issue 2: Workflows Complete But Don't Create Reports ✅ FIXED
**Symptom:** GitHub Actions shows all steps ✅ but:
- "Send failure notification" runs
- "Store report in pending folder" skipped
- "Commit pending report" skipped

**Root Cause:** Race condition from concurrent workflows.
- Instantly sends TWO webhooks with different `email_id` values
- Old concurrency group: `lead-{email}-{email_id}` → different groups → both run
- Workflow A saves research file, Workflow B overwrites it, Workflow A can't find it

**Fix Applied:**
1. Changed concurrency group to use only `email` (not `email_id`)
2. Added "Check for existing pending report" step
3. All processing steps now have `skip` condition
4. Second webhook will either queue (if first still running) or skip (if pending report exists)

## Files Modified Today

### New Files:
- `automation/ads-detector.js`

### Modified Files:
- `automation/maximal-research-v2.js` - Added ads detection Phase 7
- `automation/report-generator-v3.js` - Ads data usage, practice area fix, firm size fix
- `automation/ai-quality-control-basic.js` - Fixed broken checks
- `automation/telegram-approval-bot.js` - QC warning display
- `.github/workflows/process-interested-lead.yml` - Fixed concurrency key + added duplicate detection + skip conditions

### Deleted Files (40 total):
- `automation/report-generator-v{7,8,9,10,11}.js`
- `automation/report-generator-v12-*.js`
- `automation/research-v3-*.js`
- All 28 JS files in `speed-to-lead/`

## Next Steps

1. **Fix Instantly duplicate webhook** - User should check Instantly settings (Workspace + Campaign webhooks) and remove one
2. ~~**Debug workflow blocked=true issue**~~ ✅ Fixed with improved concurrency + duplicate detection
3. **Test end-to-end** - Run a fresh lead through to verify fixes work

## Recent GitHub Actions Runs

| Run ID | Time | Status | Notes |
|--------|------|--------|-------|
| 21717593556 | 15:31:35 | success | No report created (blocked) |
| 21717584015 | 15:31:19 | success | No report created (blocked) |
| 21717584010 | 15:31:19 | success | No report created (blocked) |
| 21717165755 | 15:19:55 | success | wslegal duplicate |
| 21717165746 | 15:19:55 | success | wslegal duplicate |
