# CLAUDE.md  -  Mortar Reports System Context

## What This Project Is

Mortar Reports is an automated marketing report system for Mortar Metrics, a legal marketing agency. The full pipeline:

1. **Instantly.ai** sends webhook on lead reply
2. **Cloudflare Worker** (`cloudflare-worker/worker.js`) merges duplicate webhooks, classifies replies with AI, routes to GitHub
3. **GitHub Actions** (`process-interested-lead.yml`) runs the pipeline: scrape → research → report → QC → Telegram approval
4. On approve (`approve-and-send-email.yml`): deploy report to GitHub Pages → send email via Instantly → store lead in Worker KV → add to nurture queue
5. **Nurture sequence** (`nurture-followup.yml`, every 6h): AI generates follow-up emails (7 angles over 14 days) → Telegram approval → send via Instantly
6. **Reply handling** (Worker): AI classifies replies into 7 categories → auto-generates contextual responses → pauses nurture on reply → Telegram controls

## The Owner

Fardeen  -  runs Mortar Metrics. Not a developer. Wants reports that sell outcomes to law firm partners. Principle: lawyers want to stop losing cases to competitors, not hear about marketing products.

## Design System

- Fonts: Fraunces (serif, headings) + Outfit (sans-serif, body)
- Container: 820px max-width
- Colors: cream background (#FDFCF9), indigo primary (#4f46e5), ink text (#0a0a0a)
- Reports must match mortarmetrics.com aesthetic

---

## Key Files

### Automation Scripts

| File | Purpose |
|------|---------|
| `automation/maximal-research-v2.js` | Scrapes firm website with Playwright + Claude Sonnet 4. Calls extract-firm-info, ai-research-helper, ads-detector. |
| `automation/extract-firm-info.js` | Claude AI extracts firm details (practice areas, team, locations) from scraped pages |
| `automation/ai-research-helper.js` | Google Places API for real competitors + search terms |
| `automation/ads-detector.js` | Detects Google Ads presence for firm and competitors |
| `automation/report-generator-v3.js` | Generates V3 HTML report with gap cards, competitor bars, math boxes |
| `automation/report-v3-css.js` | V3 CSS module (820px container, gap cards, horizontal bars) |
| `automation/ai-report-perfector.js` | 10-step QC: 28 deterministic checks + skeptic AI review + conversion critic. Auto-fixes issues. |
| `automation/telegram-approval-bot.js` | Builds Telegram approval message with inline buttons and email preview |
| `automation/send-email.js` | Sends email via Instantly API v2 (lookup thread → reply) |
| `automation/email-templates.js` | `buildEmail()` — personalized email subject/body with report data |
| `automation/email-qc.js` | `validateEmail()` — email content validation |
| `automation/nurture-sender.js` | Reads nurture queue from Worker KV, generates follow-up emails via Claude Haiku with QC loop, queues for Telegram approval |
| `automation/personalize.js` | CSV lead personalizer — generates personalized subject/opening lines via Claude Haiku (manual workflow) |

### Cloudflare Worker

| File | Purpose |
|------|---------|
| `cloudflare-worker/worker.js` | ~2000-line Worker handling: webhook dedup/merge, AI reply classification (7 categories), auto-response generation, Telegram callbacks, view tracking, email queue with Telegram approval, nurture reply handling, `/build` and `/nurture` commands |
| `cloudflare-worker/wrangler.toml` | Deployment config (KV namespace binding) |

### GitHub Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `process-interested-lead.yml` | `repository_dispatch` from Worker | Research → report → QC → staging → Telegram approval |
| `approve-and-send-email.yml` | `repository_dispatch` + `workflow_dispatch` | Deploy report → send email → store lead metadata → add to nurture queue |
| `nurture-followup.yml` | Cron every 6 hours | Run nurture-sender.js to generate + queue follow-up emails |
| `personalize-leads.yml` | Manual `workflow_dispatch` | Run personalize.js on a CSV of leads |

---

## Cloudflare Worker Details

The Worker does much more than proxy webhooks:

- **Webhook merge**: Instantly sends 2 webhooks per lead (campaign + workspace level). Worker merges them using KV slot keys with `KV.list()` + 20s `waitUntil` fallback.
- **AI reply classification**: Claude Haiku classifies into 7 categories: INTERESTED, QUESTION, OBJECTION, NOT_INTERESTED, UNSUBSCRIBE, OOO, IRRELEVANT. Fallback to pattern matching if API fails.
- **Auto-response generation**: Generates contextual replies for INTERESTED, QUESTION, OBJECTION, NOT_INTERESTED. Queued for Telegram approval (never auto-sent).
- **View tracking**: Reports fire `POST /view` on real engagement (scroll > 150px OR 8s activity). Worker tracks views per firm, queues follow-up on 1st view, alerts on 3rd/5th/10th.
- **Nurture reply handling**: When a nurture lead replies, auto-pauses sequence, generates reply, shows Telegram buttons (Send+Stop / Send+Continue / Edit / Skip).
- **Email queue**: `POST /queue-email` stores email in KV, sends Telegram with Approve/Edit/Skip buttons. Worker sends via Instantly directly on approve.
- **Telegram commands**: `/build email@firm.com [website] [name]`, `/nurture status`, `/nurture stop`, `/nurture resume`

### Worker Secrets (5)
`GITHUB_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `INSTANTLY_API_KEY`, `ANTHROPIC_API_KEY`

---

## Nurture System

7 follow-up emails over 14 days (days 2, 4, 6, 8, 10, 12, 14):

1. **Market observation** — what's happening in their city right now
2. **Something we built** — behind-the-scenes peek at a tool
3. **Their numbers** — deep dive into their specific breakdown data
4. **Result just came in** — one testimonial email (the only one)
5. **What we noticed** — industry insight or pattern
6. **The full picture** — straight talk, what working together looks like
7. **Breakup** — last email, professional closure, no CTA

**Flow**: Cron runs `nurture-sender.js` every 6h → reads Worker KV queue → generates email via Claude Haiku → QC scores it (quick checks + AI scoring, up to 3 attempts) → queues for Telegram approval → on approve, Worker sends via Instantly.

**Reply handling**: If a nurture lead replies, Worker auto-pauses sequence, classifies reply, generates response, shows Telegram buttons. Next nurture email (if continued) naturally references their reply.

**KV storage**: `nurture:{email}` stores lead data, progress (emails_sent, last_sent), status (active/paused/completed), and reply context.

---

## View Tracking

Reports embed a tracking snippet that detects real engagement (scroll > 150px OR 8+ seconds of mouse/touch activity). Fires one `POST /view` per browser session via `sendBeacon`.

- 1st view: queues a value-add follow-up email
- 3rd/5th/10th view: Telegram HOT LEAD alert
- Lead metadata stored in KV `lead:{firm_folder}` (via `/store-lead` endpoint, called by approve workflow)

---

## Report V3 Structure

```
HEADER → HERO (typing animation) → GAP 1 (Google Ads) → GAP 2 (Meta Ads)
→ GAP 3 (Voice AI) → TOTAL STRIP → COMPETITOR BARS → BUILD LIST → CTA → FOOTER
```

---

## Math Logic

### Gap 1 (Google Ads)
```
~searches x 3.5% CTR x 12% inquiry x 25% close x case value
```

### Gap 2 (Meta Ads)
```
~audience x 1.5% ad reach x 0.8% conversion x 25% close x case value
```

### Gap 3 (Voice AI)
```
~calls x 35% after-hours x 60% won't voicemail x 70% recoverable x case value
```

### Market Multipliers
- Major metros (NYC, LA, Chicago, Toronto): **1.8x**
- Mid-size cities: **1.2x**
- Small markets: **0.8x**

### Case Values by Practice Area
- Personal Injury: $8K-15K
- Medical Malpractice: $12K-20K
- Divorce/Family: $4K-6K
- Immigration: $3.5K-5K
- Landlord: $3K-5K
- Criminal: $4K-7K
- Tax: $3.5K-5.5K

---

## Testing

```bash
# Generate V3 report locally
cd /Users/fardeenchoudhury/mortar-reports/automation
node report-generator-v3.js test-fixtures/doss-law-research.json "Test User"
open reports/doss-law-report-v3.html

# Test research engine (requires ANTHROPIC_API_KEY)
node maximal-research-v2.js "https://www.example-law.com" "John Smith" "Chicago" "IL" "US" "Example Law Firm"

# Test nurture email generation
ANTHROPIC_API_KEY=sk-ant-... node nurture-sender.js

# Check nurture queue
curl -s -X POST "https://instantly-webhook-proxy.fardeen-729.workers.dev/nurture-check" \
  -H "Content-Type: application/json" -d '{"action":"list"}' | jq .

# Deploy worker
cd /Users/fardeenchoudhury/mortar-reports/cloudflare-worker && npx wrangler deploy

# Check recent GitHub Actions runs
gh run list --repo Fardeen-MM/mortar-reports --limit 5
```

---

## Secrets

### GitHub Secrets (8)
| Secret | Purpose |
|--------|---------|
| `ANTHROPIC` | Claude AI for research, report generation, QC, nurture emails |
| `GOOGLE_PLACES_API_KEY` | Real competitor data via Google Places |
| `GOOGLE_API_KEY` | Google search verification in QC |
| `INSTANTLY_API_KEY` | Email sending via Instantly API v2 |
| `TELEGRAM_BOT_TOKEN` | Telegram bot for approval flow |
| `TELEGRAM_CHAT_ID` | Telegram chat for notifications |
| `GH_PAT` | GitHub PAT for workflow commits |
| `WORKER_URL` | Cloudflare Worker URL for nurture-sender.js |

### Cloudflare Worker Secrets (5)
`GITHUB_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `INSTANTLY_API_KEY`, `ANTHROPIC_API_KEY`

---

## Folder Structure

```
mortar-reports/
├── automation/
│   ├── test-fixtures/        # Research JSONs for local testing
│   ├── pending-approvals/    # Approval JSONs (pending leads)
│   ├── approved-archive/     # Archived approved JSONs (for analytics)
│   ├── reports/              # Generated reports (local, gitignored)
│   ├── maximal-research-v2.js
│   ├── report-generator-v3.js
│   ├── ai-report-perfector.js
│   ├── nurture-sender.js
│   ├── personalize.js
│   └── ...
├── pending-reports/          # Reports awaiting approval
│   └── {FirmName}/index.html
├── {FirmName}/               # LIVE reports (82 deployed, GitHub Pages)
│   └── index.html
├── cloudflare-worker/
│   ├── worker.js
│   └── wrangler.toml
└── .github/workflows/
    ├── process-interested-lead.yml
    ├── approve-and-send-email.yml
    ├── nurture-followup.yml
    └── personalize-leads.yml
```

---

## Known Limitations

- **LinkedIn scraping fails** - blocked by LinkedIn, accept limitation
- **Cloudflare Worker dedup** - uses KV slot keys + in-memory Map, resets on cold start
- **Cloudflare Worker auth** - no authentication (relies on obscurity)
- **Google Places API** - may fail from certain IPs, returns empty array gracefully
- **Instantly API** - reply-only (no new-email endpoint), requires existing thread
- **All emails gated by Telegram** - nothing auto-sends, every email needs approval

---

## Working With Fardeen

- Not a developer - explain in plain English
- Wants reports that sell outcomes
- Gives brutal honest feedback - iterate on it
- Always test against real research JSON before pushing
- Test fixtures in `automation/test-fixtures/`
