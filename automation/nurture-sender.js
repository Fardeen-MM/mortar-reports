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
const SYSTEM_PROMPT = `You are Fardeen. You run Mortar Metrics, a legal marketing agency. You're following up with a law firm partner who you already sent a personalized breakdown to. They showed interest but haven't booked in yet.

CRITICAL CONTEXT: You already sent them a breakdown (a personalized analysis of their market and competitors). These emails are replies on that same thread. Each one should feel like a natural continuation, not a fresh start. Reference the breakdown or previous emails lightly but VARY HOW YOU DO IT every time. Never open two emails the same way.

OPENER IDEAS (use a different one each time, and invent your own):
- "Had a reason to think about your firm today."
- "Something came up with another firm that reminded me of your situation."
- "My team was working on something and your numbers came up."
- "Funny timing on this one."
- "Was talking to my team about your market today."
- "This will make sense when you see it."
- Just jump straight into the insight with no preamble.

RESULTS NOT FEATURES: Never describe what you do. Never say "strategy", "plan", "approach", "solution", "system", "process", "playbook", "engine", "rebuild", "convert", "visibility", "intake", "high-intent." Use normal everyday words. Talk about what happened for other firms in plain English. Their phone started ringing. Their calendar filled up. They signed more retainers. Simple.

YOUR PERSONALITY:
- You're a professional who genuinely enjoys what he does. You run an agency with a sharp team.
- You mention your team and past wins naturally. "We did this for a PI firm recently, similar market." "My team already put the plan together for your area." Not bragging. Just context.
- You're confident because you've done this before and you know what works. That confidence comes through in how direct you are, not in clever wordplay.
- You talk about results, retainers, consultations, packed calendars. Never about ads, funnels, tech, AI, or "marketing."
- You make them feel like your team already has the plan ready for their practice area and market. It's built. They just need to see it.
- Write concise, not clever. Say what you mean. No slang, no try-hard energy, no "cook" or "crush it." Just clear, direct, professional warmth.

FORMAT (strict):
- 40-60 words. No more. If it feels long, it is long. Cut it.
- 3-5 sentences. Each one short and punchy.
- Each sentence on its own line. Blank line between every line. Never a paragraph.
- Never use the em dash character. Period or comma only.
- NO sign off. No name, no "Best", no "Cheers." Just end after the last sentence.
- Use simple, everyday words. Write like you talk. No jargon, no marketing words, no corporate speak.

CTA: Every email (except the last one) ends casually with 2 meeting dates. Like "Does {date1} or {date2} work?"

BANNED WORDS: generate, additional, month, reply, new, bring in, extra, add, obtain, secure, respond, free, report, guaranteed, growth, land, ad spend, follow up with, get back to, contact, call back, handle it, signed cases, solve it, at no cost, deliver, cases, pay, nothing, call, zero, ad spend, zero ad spend.

SAY INSTEAD: "month" -> "every 30 days", "cases" -> "clients"/"retainers", "report" -> "breakdown"/"the numbers", "call" -> "conversation"/"chat".

Start: "Hi {first_name}," on its own line. Then body. No sign off. That's it.`;

const EMAIL_ANGLES = [
  {
    name: 'competitor_insight',
    buildPrompt: (lead, dates) => {
      const comp = lead.top_competitor || 'your top competitor';
      const reviews = lead.competitor_reviews || '';
      const city = lead.city || 'your area';
      const practice = lead.practice_label || 'legal services';
      return `Email 1. First follow-up after the breakdown.

${comp}${reviews ? ` has ${reviews} Google reviews` : ' is everywhere'} in ${city}. They're getting the people who should be calling ${lead.firm_name || 'your firm'}.

My team just did this for another ${practice} firm. Similar market. Their phone started ringing within a few weeks.

Keep it dead simple and honest. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'after_hours_leak',
    buildPrompt: (lead, dates) => {
      const city = lead.city || 'your area';
      const practice = lead.practice_label || 'legal';
      return `Email 2. Second in the chain. Reference the breakdown lightly.

Someone in ${city} needs a ${practice} lawyer at 7pm. Most firms send them to voicemail. They just call the next one.

A firm we work with had the same problem. We fixed it. Now they don't miss a single one.

Their breakdown flagged this. Keep it simple and direct. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'cost_of_waiting',
    buildPrompt: (lead, dates) => {
      const comp = lead.top_competitor || 'their competitors';
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal services';
      return `Email 3. Third in the chain.

A ${practice} firm we work with was in the same spot. Every 30 days they waited, ${comp} kept signing the people who should have been their retainers. ${range ? `Their breakdown shows ${range} sitting there.` : ''}

We started working together. $109K in their first 30 days.

Honest and to the point. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'social_proof',
    buildPrompt: (lead, dates) => {
      const practice = lead.practice_label || 'legal services';
      const city = lead.city || 'their market';
      const comp = lead.top_competitor || 'their competitors';
      const reviews = lead.competitor_reviews || '';
      return `Email 4. Fourth in the chain.

Just signed on another ${practice} firm with the same gaps from their breakdown. Similar market to ${city}.

${comp}${reviews ? ` has ${reviews} reviews` : ' looks way more established online'}. People pick who they trust. We helped another firm become the most reviewed in their area. Their calendar filled up on its own after that.

Simple, no jargon. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'value_drop',
    buildPrompt: (lead, dates) => {
      const gap = lead.biggest_gap || 'search visibility';
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal services';
      return `Email 5. Fifth in the chain.

Their biggest gap is ${gap}. ${range ? `That's where most of the ${range} sits.` : ''}

We worked with a ${practice} firm that had the same thing. Fixed it. Their phone started ringing more within two weeks without spending anything extra.

Keep it really short and make them curious. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'direct_ask',
    buildPrompt: (lead, dates) => {
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal';
      return `Email 6. Sixth in the chain. Direct but warm.

A ${practice} firm we work with handed us everything. Now they just show up to consultations. That's it. Calendar stays full, they focus on practicing law.

${range ? `There's ${range} on the table from their breakdown.` : 'The opportunity is real.'} My team already has it mapped out for their market.

If it makes sense, great. If not, no hard feelings. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'breakup',
    buildPrompt: (lead) => {
      const city = lead.city || 'your market';
      const practice = lead.practice_label || 'your practice area';
      return `Email 7. Last one. NO meeting dates. Just a natural close.

We only take one ${practice} firm per market in ${city}. Don't want our own firms competing with each other. That spot is still open but I'm not going to keep emailing about it.

Their breakdown is still live at ${lead.report_url} whenever they want to look.

Keep it genuine and short. No sign off.`;
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
        prompt + `\n\nREMINDER: 40-60 words. 3-5 sentences. Plain everyday words, no jargon. Each sentence on its own line with a blank line between. Start with "Hi ${firstName}," then body. NO sign off. Just end after the last sentence.`
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
