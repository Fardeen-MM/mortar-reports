#!/usr/bin/env node
/**
 * Nurture Sender — reads nurture queue from Worker KV, generates personalized
 * follow-up emails via Claude Haiku, and queues them for Telegram approval.
 *
 * Schedule: days 2, 4, 6, 8, 10, 12, 14 after start_date
 * 7 email angles: social proof, case study, ROI, competitor, FAQ, scarcity, final
 *
 * Usage: node nurture-sender.js
 * Env: ANTHROPIC_API_KEY, WORKER_URL (optional, defaults to production)
 */

const https = require('https');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WORKER_URL = process.env.WORKER_URL || 'https://instantly-webhook-proxy.fardeen-729.workers.dev';

const SEND_DAYS = [2, 4, 6, 8, 10, 12, 14];

const EMAIL_ANGLES = [
  {
    name: 'social_proof',
    prompt: `Write a short follow-up email (4-5 sentences) from Fardeen at Mortar Metrics to a law firm lead.
Mention that other firms in their practice area are seeing results from similar analysis.
Reference their personalized report. No specific numbers or names — keep it general but credible.
End with a soft CTA to review the report or book a call.`
  },
  {
    name: 'case_study',
    prompt: `Write a short follow-up email (4-5 sentences) from Fardeen at Mortar Metrics.
Share a brief story about how a firm (don't name them) went from invisible on Google to signing cases monthly.
Tie it back to the lead's own report. Soft CTA.`
  },
  {
    name: 'roi',
    prompt: `Write a short follow-up email (4-5 sentences) from Fardeen at Mortar Metrics.
Focus on ROI — frame the cost of NOT acting (cases going to competitors each month).
Reference their report's competitor data. Make it about money left on the table, not marketing spend.`
  },
  {
    name: 'competitor',
    prompt: `Write a short follow-up email (4-5 sentences) from Fardeen at Mortar Metrics.
Focus on what their competitors are doing right now — running ads, collecting reviews, showing up in maps.
The report has the real data. Create urgency without being pushy.`
  },
  {
    name: 'faq',
    prompt: `Write a short follow-up email (4-5 sentences) from Fardeen at Mortar Metrics.
Address a common concern: "We've tried marketing before and it didn't work."
Explain why this is different (real competitor data, specific to their market, measurable gaps).
Low pressure — just offering to walk through the numbers.`
  },
  {
    name: 'scarcity',
    prompt: `Write a short follow-up email (4-5 sentences) from Fardeen at Mortar Metrics.
Mention that you can only take on a limited number of firms per market (to avoid conflicts).
Their report is ready but the window to act on it narrows as competitors move.
Not fake urgency — genuine capacity constraint.`
  },
  {
    name: 'final',
    prompt: `Write a final follow-up email (3-4 sentences) from Fardeen at Mortar Metrics.
This is the last email. Keep it short and genuine. Say you won't follow up again.
Leave the door open — if they ever want to look at the data, the report is still available.
No guilt trip. Just professional closure.`
  }
];

async function workerAPI(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, WORKER_URL);
    const data = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${path}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function callHaiku(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const text = parsed.content?.[0]?.text?.trim();
          if (text) resolve(text);
          else reject(new Error('Empty Haiku response'));
        } catch (e) {
          reject(new Error(`Haiku parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Haiku timeout')); });
    req.write(data);
    req.end();
  });
}

function daysSince(dateStr) {
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - start) / (1000 * 60 * 60 * 24));
}

(async () => {
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY required');
    process.exit(1);
  }

  console.log('📬 Nurture Sender starting...\n');

  // Fetch all nurture entries from Worker KV
  let items;
  try {
    const resp = await workerAPI('/nurture-check', { action: 'list' });
    items = resp.items || [];
  } catch (e) {
    console.error('Failed to fetch nurture queue:', e.message);
    process.exit(1);
  }

  const active = items.filter(i => i.status === 'active');
  console.log(`Found ${items.length} total entries, ${active.length} active\n`);

  if (active.length === 0) {
    console.log('No leads due for nurture. Done.');
    process.exit(0);
  }

  let queued = 0;

  for (const lead of active) {
    const days = daysSince(lead.start_date);
    const emailsSent = lead.emails_sent || 0;

    // Find the next send day
    const nextSendDay = SEND_DAYS[emailsSent];
    if (!nextSendDay) {
      // All 7 emails sent — mark complete
      console.log(`✅ ${lead.email}: All 7 emails sent, marking complete`);
      lead.status = 'completed';
      await workerAPI('/nurture-check', { action: 'set', email: lead.email, data: lead });
      continue;
    }

    if (days < nextSendDay) {
      console.log(`⏳ ${lead.email}: Day ${days}, next send on day ${nextSendDay} (${emailsSent}/7 sent)`);
      continue;
    }

    // Due for next email
    console.log(`📧 ${lead.email}: Day ${days}, sending email #${emailsSent + 1} (${EMAIL_ANGLES[emailsSent].name})`);

    const angle = EMAIL_ANGLES[emailsSent];
    const practiceContext = lead.practice_label ? ` Their practice area is ${lead.practice_label}.` : '';
    const countryContext = lead.country && lead.country !== 'US' ? ` They are based in ${lead.country}.` : '';

    try {
      const emailBody = await callHaiku(
        'You write short, conversational follow-up emails for a legal marketing agency. No exclamation marks. No corporate speak. Sound like a real person.',
        `${angle.prompt}

Context:
- Lead name: ${lead.contact_name || 'Partner'}
- Firm: ${lead.firm_name || 'their firm'}${practiceContext}${countryContext}
- Their personalized report: ${lead.report_url || 'available on request'}
- This is email ${emailsSent + 1} of 7 in a follow-up sequence.
- Sign off as Fardeen, Mortar Metrics.

Write the email body only (no subject line, no "Subject:" prefix). Start with "Hi ${lead.contact_name?.split(' ')[0] || 'there'},".`
      );

      // Generate subject line
      const subjectLine = await callHaiku(
        'Generate a short email subject line (under 50 chars). No quotes in output.',
        `Write a subject line for this follow-up email to a law firm lead. Angle: ${angle.name}. Email #${emailsSent + 1} of 7. Firm: ${lead.firm_name || 'a law firm'}. Return ONLY the subject line text.`
      );

      // Queue via Worker
      await workerAPI('/queue-email', {
        type: 'nurture',
        to: lead.email,
        subject: subjectLine || `Following up — ${lead.firm_name || 'your firm'}`,
        html: emailBody.replace(/\n/g, '<br>'),
        text: emailBody,
        lead_email: lead.email,
        firm_name: lead.firm_name,
        contact_name: lead.contact_name,
        context: `Nurture ${emailsSent + 1}/7 (${angle.name}) — Day ${days}`
      });

      // Update nurture entry
      lead.emails_sent = emailsSent + 1;
      lead.last_sent = new Date().toISOString();
      await workerAPI('/nurture-check', { action: 'set', email: lead.email, data: lead });

      queued++;
      console.log(`  ✅ Queued for Telegram approval`);

    } catch (e) {
      console.error(`  ❌ Failed for ${lead.email}: ${e.message}`);
    }
  }

  console.log(`\n📬 Done. Queued ${queued} email(s) for approval.`);
})();
