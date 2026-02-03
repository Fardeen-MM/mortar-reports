# Debug: Instantly Webhook Fields

## What I Just Did

1. **Updated Cloudflare Worker** to:
   - Log ALL fields Instantly sends (full JSON dump)
   - Forward ALL fields to GitHub (not just hardcoded ones)
   - Check for alternate field names (firstName vs first_name, etc.)

2. **Updated GitHub Actions Workflow** to:
   - Add debug step that dumps ENTIRE webhook payload
   - Log extracted values to see what's being read

## Next Steps

### Test with Next Lead

When the next lead comes in, check the GitHub Actions logs:

1. Go to: https://github.com/Fardeen-MM/mortar-reports/actions
2. Click the latest "Process Interested Lead" run
3. Look for the "Debug - Show ALL webhook data" step
4. You'll see JSON output showing EVERY field Instantly sent

### What to Look For

Check if Instantly is sending these fields (might have different names):

**Contact Info:**
- `first_name` / `firstName` / `FirstName`
- `last_name` / `lastName` / `LastName`
- `company` / `companyName` / `Company`

**Location:**
- `city` / `City`
- `state` / `State` / `region`
- `country` / `Country`

**Business:**
- `website` / `companyUrl` / `Website`
- `industry` / `Industry`
- `practice_area` / `practiceArea` / `PracticeArea`

**Custom Variables (check your CSV columns):**
- `custom1`, `custom2`, etc.
- `variable1`, `variable2`, etc.
- Any column names from your CSV upload

### Example Output

You should see something like:

```json
{
  "email": "test@paletzlaw.com",
  "first_name": "Sarah",
  "last_name": "Fontanilla",
  "company": "Paletz Law",
  "city": "Troy",
  "state": "Michigan",
  "website": "https://paletzlaw.com",
  "custom1": "Landlord Law",
  "custom2": "Property",
  ...
}
```

### If Fields Are Present

If we see the data IS being sent, I'll update the workflow to use it.

### If Fields Are Missing

If Instantly is NOT sending these fields, we have two options:

1. **Configure Instantly** to include them (add columns to your CSV)
2. **Extract from website** (make maximal-research-v2.js smarter)

---

## How to Check Cloudflare Worker Logs

To see what Instantly sends BEFORE it reaches GitHub:

```bash
cd ~/Desktop/mortar-reports/cloudflare-worker
npx wrangler tail --format pretty
```

Leave this running, then trigger a test lead. You'll see the raw payload from Instantly.

---

**Next lead will show us exactly what data is available.**
