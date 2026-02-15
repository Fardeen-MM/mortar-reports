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

RESULTS NOT FEATURES: Never describe what you do directly. Never say "strategy", "plan", "approach", "solution", "system", "process", "playbook." Instead, tell a quick story about what happened for another firm. Let the feature sell itself through the result. "A PI firm we work with was losing 40% of their inquiries after 6pm. Two weeks later their calendar was packed." The reader should think "I want that" without you ever explaining the product.

STORYTELLING: Each email tells a tiny story. A firm you worked with. A problem they had. What happened next. Keep it casual, like you're telling a friend over coffee. The story always ties back to something in their breakdown.

YOUR PERSONALITY:
- You're a professional who genuinely enjoys what he does. You run an agency with a sharp team.
- You mention your team and past wins naturally. "We did this for a PI firm recently, similar market." "My team already put the plan together for your area." Not bragging. Just context.
- You're confident because you've done this before and you know what works. That confidence comes through in how direct you are, not in clever wordplay.
- You talk about results, retainers, consultations, packed calendars. Never about ads, funnels, tech, AI, or "marketing."
- You make them feel like your team already has the plan ready for their practice area and market. It's built. They just need to see it.
- Write concise, not clever. Say what you mean. No slang, no try-hard energy, no "cook" or "crush it." Just clear, direct, professional warmth.

FORMAT (strict):
- 50-70 words in the body (not counting "Hi name,"). Enough to tell a quick story, not enough to ramble.
- 4-6 sentences max.
- Each sentence on its own line. Blank line between every line. Never a paragraph.
- Never use the em dash character. Not the long one, not the medium one. Period or comma only.
- NO sign off. No "Fardeen", no "Best", no "Cheers." Just end after the last sentence.

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
      return `Email 1. First follow-up. SUBTLY SELLS: search visibility / showing up when people search for a lawyer.

Tell a quick story: ${comp}${reviews ? ` has ${reviews} Google reviews` : ' is showing up everywhere'} in ${city}. Every time someone in ${city} searches for a ${practice} lawyer, ${comp} is right there.

Your team worked with a ${practice} firm in a similar position. Within 30 days they were showing up for every high-intent search in their area. Calendar went from empty to packed.

Their breakdown shows the same opportunity. Tie it back naturally.

Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'after_hours_leak',
    buildPrompt: (lead, dates) => {
      const city = lead.city || 'your area';
      const practice = lead.practice_label || 'legal';
      return `Email 2. Second in the chain. SUBTLY SELLS: after-hours call capture (never miss an inquiry, even at 7pm).

Tell a quick story: A ${practice} firm your team works with was losing inquiries every evening and weekend. People would search, hit voicemail, and just dial the next firm. 60% gone.

Your team set something up for them. Two weeks later they were capturing every single one of those inquiries. Consultations they never even knew they were missing.

Their breakdown flagged this same gap. Reference it lightly.

Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'cost_of_waiting',
    buildPrompt: (lead, dates) => {
      const comp = lead.top_competitor || 'their competitors';
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal services';
      return `Email 3. Third in the chain. SUBTLY SELLS: social media / reaching people before they even search for a lawyer.

Tell a quick story: A ${practice} firm your team works with started reaching people in their area before they ever typed "${practice} lawyer" into Google. People who just had an accident, just got served papers, whatever fits ${practice}. By the time those people needed a lawyer, this firm was already the name they remembered.

$109K in retainers in their first 30 days. Meanwhile ${comp} is only catching people who are already searching. ${range ? `Their breakdown shows ${range} in opportunity.` : ''}

Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'social_proof',
    buildPrompt: (lead, dates) => {
      const practice = lead.practice_label || 'legal services';
      const city = lead.city || 'their market';
      const comp = lead.top_competitor || 'their competitors';
      const reviews = lead.competitor_reviews || '';
      return `Email 4. Fourth in the chain. SUBTLY SELLS: Google reviews / reputation building that makes people pick you over competitors.

Tell a quick story: A ${practice} firm your team works with had barely any Google reviews. ${comp}${reviews ? ` had ${reviews}` : ' had way more'}. People were choosing ${comp} just because they looked more established online.

Your team helped them build a review engine. Within 60 days they went from invisible to the most reviewed ${practice} firm in their area. Consultations doubled because people trusted them before even picking up the phone.

Their breakdown shows the same gap in ${city}. Reference it.

Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'value_drop',
    buildPrompt: (lead, dates) => {
      const gap = lead.biggest_gap || 'search visibility';
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal services';
      const city = lead.city || 'their area';
      return `Email 5. Fifth in the chain. SUBTLY SELLS: website conversion / turning visitors into actual consultations.

Tell a quick story: A ${practice} firm your team works with was getting plenty of website visitors but barely any of them were picking up the phone or filling out a form. Turns out their site was leaking potential retainers everywhere.

Your team rebuilt the way their site converts visitors. Same traffic, but now every visitor has a clear path to booking a consultation. Their intake doubled without spending a dollar more on visibility.

Their biggest gap is ${gap}. ${range ? `${range} in opportunity, and a lot of that comes down to converting the people already looking at them in ${city}.` : `That's the kind of thing that compounds fast in ${city}.`}

Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'direct_ask',
    buildPrompt: (lead, dates) => {
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal';
      const city = lead.city || 'their area';
      return `Email 6. Sixth in the chain. SUBTLY SELLS: full-service ("we handle everything so you just practice law").

Tell a quick story: A ${practice} firm your team works with handed everything off. The visibility, the inquiries, the follow-up, the reputation. All of it. The partner told you he forgot what it was like to worry about where the next retainer was coming from. His calendar just stays full now.

${range ? `Their breakdown shows ${range} in ${city}.` : `The opportunity in ${city} is real.`} Your team already has everything mapped out for their market. They'd just need to show up to the consultations.

Direct and warm. Not pushy. If it makes sense, great. If not, genuinely no hard feelings.

Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'breakup',
    buildPrompt: (lead) => {
      const city = lead.city || 'your market';
      const practice = lead.practice_label || 'your practice area';
      return `Email 7. Last one in the chain. NO meeting CTA. SUBTLY SELLS: exclusivity (one firm per market, no conflicts).

Tell a quick story about why you only work with one ${practice} firm per market in ${city}. You don't want two of your firms competing against each other. The spot for ${city} is still open but you're not going to keep circling back.

Their breakdown stays live at ${lead.report_url} whenever they want to revisit it.

Genuine and professional. Feels like the end of a real email chain between two people. Not a marketing sequence.

No sign off. Just end after the last sentence.`;
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
        prompt + `\n\nREMINDER: 50-70 words in the body. 4-6 sentences. Tell a quick story, let the result sell itself. Each sentence on its own line with a blank line between. Start with "Hi ${firstName}," then body. NO sign off, no signature. Just end after the last sentence.`
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
