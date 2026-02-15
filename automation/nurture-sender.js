#!/usr/bin/env node
/**
 * Nurture Sender — reads nurture queue from Worker KV, generates personalized
 * follow-up emails via Claude Haiku, and queues them for Telegram approval.
 *
 * Schedule: days 2, 4, 6, 8, 10, 12, 14 after start_date
 * 7 email angles: competitor, after-hours, cost of waiting, social proof,
 *                 value drop, direct ask, breakup
 *
 * Usage: node nurture-sender.js
 * Env: ANTHROPIC_API_KEY, WORKER_URL (optional, defaults to production)
 */

const https = require('https');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WORKER_URL = process.env.WORKER_URL || 'https://instantly-webhook-proxy.fardeen-729.workers.dev';

const SEND_DAYS = [2, 4, 6, 8, 10, 12, 14];

/**
 * Generate two upcoming weekday date options like "Tuesday at 2pm" and "Thursday at 11am"
 */
function getDateOptions() {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const times = ['10am', '11am', '2pm', '3pm'];
  const now = new Date();
  const options = [];

  // Find next two weekdays that are 2+ days out
  for (let offset = 2; options.length < 2 && offset < 10; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      const time = times[options.length % times.length];
      options.push(`${days[dow]} at ${time}`);
    }
  }
  return options;
}

// System prompt - establishes personality
const SYSTEM_PROMPT = `You are Fardeen. You run Mortar Metrics, a legal marketing agency. You sent this person a personalized breakdown of their market. They showed interest but haven't booked a meeting yet. These are follow-ups on the same email thread.

THE POINT OF EVERY EMAIL: Make them feel like they're losing money every day they don't work with you. Use THEIR specific numbers, THEIR competitor's name, THEIR city. This isn't generic. You already did the research on their market.

ROI MINDSET: Every firm you work with pays you and makes way more back. That's the deal. A firm pays you, their phone rings, people walk in, they sign clients, they make money. Paint that picture with their specific numbers.

HOW TO WRITE:
- Use their name, their city, their competitor, their dollar numbers. Be specific to THEM.
- Talk about money. How much they're losing, how much they could make, what other firms made.
- Use normal words. "People Google you", "your phone rings", "they hire you", "money comes in."
- Never say: leverage, optimize, capture, convert, visibility, intake, pipeline, engagement, retainers, consultations, compelling, robust, utilize, facilitate, comprehensive, streamline, innovative, strategy, solution, approach.
- Say instead: "clients" not "retainers", "meetings" not "consultations", "showing up on Google" not "visibility", "every 30 days" not "month", "breakdown" not "report".

FORMAT:
- 40-60 words. Short.
- 3-5 sentences. Each on its own line. Blank line between every line.
- Never use em dash. Period or comma only.
- NO sign off. Just end.
- End emails 1-6 with 2 meeting dates like "Does {date1} or {date2} work?"

Start: "Hi {first_name}," on its own line. Then body. That's it.`;

const EMAIL_ANGLES = [
  {
    name: 'competitor_insight',
    buildPrompt: (lead, dates) => {
      const comp = lead.top_competitor || 'your top competitor';
      const reviews = lead.competitor_reviews || '';
      const city = lead.city || 'your area';
      const practice = lead.practice_label || 'legal';
      const range = lead.total_range || '';
      const firm = lead.firm_name || 'your firm';
      return `Email 1. Use THEIR data from the breakdown.

THEIR NUMBERS: ${comp}${reviews ? ` (${reviews} reviews)` : ''} in ${city}. ${range ? `${range} every 30 days going to other firms instead of ${firm}.` : `People searching for ${practice} lawyers in ${city} are finding ${comp} instead of ${firm}.`}

We did this for a similar ${practice} firm. They went from invisible to their phone ringing every day. 12 new clients in 30 days.

Use their specific competitor name, city, and dollar range. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'after_hours_leak',
    buildPrompt: (lead, dates) => {
      const city = lead.city || 'your area';
      const practice = lead.practice_label || 'legal';
      const firm = lead.firm_name || 'your firm';
      return `Email 2. Reference their breakdown.

THEIR SITUATION: Someone in ${city} needs a ${practice} lawyer at 7pm. They call ${firm}, nobody answers. They call the next firm and hire them instead. This is happening every week.

We set it up so a ${practice} firm like theirs never misses a single call. 8 new clients in 30 days just from the ones they used to miss.

Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'cost_of_waiting',
    buildPrompt: (lead, dates) => {
      const comp = lead.top_competitor || 'their competitors';
      const range = lead.total_range || '';
      const city = lead.city || 'their area';
      const practice = lead.practice_label || 'legal';
      const firm = lead.firm_name || 'your firm';
      return `Email 3. Make the cost of doing nothing obvious.

THEIR NUMBERS: ${range ? `${range} every 30 days is going to ${comp} instead of ${firm}.` : `Every 30 days, ${comp} in ${city} is signing the people who should be hiring ${firm}.`} That's not a guess, it's in their breakdown.

We did this for a similar firm. $109K in new clients in their first 30 days. Same kind of market as ${city}.

Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'social_proof',
    buildPrompt: (lead, dates) => {
      const practice = lead.practice_label || 'legal';
      const city = lead.city || 'their market';
      const comp = lead.top_competitor || 'their competitor';
      const reviews = lead.competitor_reviews || '';
      const firm = lead.firm_name || 'your firm';
      return `Email 4. Use their competitor data.

THEIR SITUATION: People Google "${practice} lawyer ${city}" and see ${comp}${reviews ? ` with ${reviews} reviews` : ''}. Then they see ${firm}. They pick whoever looks more legit.

We made a ${practice} firm the most reviewed in their area. People started picking them over everyone else. $92K in new clients in 30 days.

Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'value_drop',
    buildPrompt: (lead, dates) => {
      const gap = lead.biggest_gap || 'showing up when people search';
      const range = lead.total_range || '';
      const firm = lead.firm_name || 'your firm';
      const practice = lead.practice_label || 'legal';
      return `Email 5. Zero in on their biggest gap from the breakdown.

THEIR BIGGEST GAP: ${gap}. ${range ? `That one thing alone is worth most of the ${range} in their breakdown.` : `That one thing is costing ${firm} the most money right now.`}

We fixed this same thing for another ${practice} firm. Phone went from quiet to ringing every day. Two weeks.

Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'direct_ask',
    buildPrompt: (lead, dates) => {
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal';
      const city = lead.city || 'their area';
      const firm = lead.firm_name || 'your firm';
      return `Email 6. Straight ask. Sum up everything.

WE HANDLE IT ALL: We make ${firm} show up when people in ${city} search. We put them on social media. We make sure every call gets answered. We get them more reviews than ${lead.top_competitor || 'their competitors'}. They just show up to meetings and sign clients.

${range ? `Their breakdown shows ${range} every 30 days. That's what's on the table for ${firm}.` : ''}

A ${practice} firm we do this for just shows up to meetings now. Calendar full every week.

If it makes sense, great. If not, no hard feelings. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'breakup',
    buildPrompt: (lead) => {
      const city = lead.city || 'your market';
      const practice = lead.practice_label || 'your practice area';
      const firm = lead.firm_name || 'your firm';
      const range = lead.total_range || '';
      return `Email 7. Last one. NO meeting dates.

We only work with one ${practice} firm in ${city}. Can't have two of our firms going after the same people. ${range ? `${range} every 30 days is sitting there for ${firm}.` : ''} That spot is open but I'm done following up.

Their breakdown is at ${lead.report_url} whenever they want to look.

Short. No sign off.`;
    }
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
      max_tokens: 250,
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

/**
 * Post-process: strip em dashes, ensure line spacing.
 */
function cleanEmail(text) {
  let cleaned = text;
  // Kill em dashes (all variants)
  cleaned = cleaned.replace(/\u2014/g, '.'); // —
  cleaned = cleaned.replace(/\u2013/g, ','); // –
  cleaned = cleaned.replace(/ - /g, '. ');   // spaced hyphens used as dashes
  // Ensure blank lines between sentences (if Haiku didn't)
  // Split into lines, remove empty dupes, rejoin with double newlines
  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines.join('\n\n');
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
  const dates = getDateOptions();

  for (const lead of active) {
    const days = daysSince(lead.start_date);
    const emailsSent = lead.emails_sent || 0;

    // Find the next send day
    const nextSendDay = SEND_DAYS[emailsSent];
    if (!nextSendDay) {
      console.log(`✅ ${lead.email}: All 7 emails sent, marking complete`);
      lead.status = 'completed';
      await workerAPI('/nurture-check', { action: 'set', email: lead.email, data: lead });
      continue;
    }

    if (days < nextSendDay) {
      console.log(`⏳ ${lead.email}: Day ${days}, next send on day ${nextSendDay} (${emailsSent}/7 sent)`);
      continue;
    }

    const angle = EMAIL_ANGLES[emailsSent];
    console.log(`📧 ${lead.email}: Day ${days}, sending email #${emailsSent + 1} (${angle.name})`);

    const firstName = lead.contact_name?.split(' ')[0] || 'there';

    try {
      const prompt = angle.buildPrompt(lead, dates);
      let emailBody = await callHaiku(
        SYSTEM_PROMPT.replace('{first_name}', firstName),
        prompt + `\n\nREMINDER: 40-60 words. 3-5 sentences. Use THEIR competitor name, THEIR city, THEIR dollar numbers from above. Make the ROI obvious, they pay us and make way more back. Simple words. Each sentence on its own line with blank line between. Start with "Hi ${firstName}," then body. NO sign off.`
      );

      // Post-process: kill em dashes, enforce spacing
      emailBody = cleanEmail(emailBody);

      // Queue via Worker (no subject line needed, these are thread replies)
      await workerAPI('/queue-email', {
        type: 'nurture',
        to: lead.email,
        subject: '',
        html: emailBody.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>'),
        text: emailBody,
        lead_email: lead.email,
        firm_name: lead.firm_name,
        contact_name: lead.contact_name,
        context: `Nurture ${emailsSent + 1}/7 (${angle.name}) - Day ${days}`
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
