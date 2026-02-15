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

BE DIRECT: Tell them exactly how you make firms money. People search for a lawyer, we make sure they find you. People scroll social media, we put your firm in front of them. People call after hours, we make sure someone answers. Spell it out. No fancy words. No clever phrasing. Just tell them what happens and how much money it means.

WORD CHOICE: Write like you're texting a friend. Use words a normal person would use. Never say: leverage, optimize, capture, convert, visibility, intake, high-intent, retainers, consultations, pipeline, engagement. Say instead: signed, hired, called, booked, showed up, picked up the phone, found you online, walked in.

YOUR PERSONALITY:
- You're direct. You tell people how it is.
- You've done this for other firms and you know what works. You just spell it out.
- Don't be clever. Don't try to sound smart. Just say what you mean in the simplest way possible.
- Talk about money, people calling, people hiring them, their calendar being full. That's what lawyers care about.
- Mention your team and what you did for other firms. Be specific about the results.

FORMAT (strict):
- 40-60 words. No more. If it feels long, it is long. Cut it.
- 3-5 sentences. Each one short and punchy.
- Each sentence on its own line. Blank line between every line. Never a paragraph.
- Never use the em dash character. Period or comma only.
- NO sign off. No name, no "Best", no "Cheers." Just end after the last sentence.
- Use simple, everyday words. Write like you talk. No jargon, no marketing words, no corporate speak.

CTA: Every email (except the last one) ends casually with 2 meeting dates. Like "Does {date1} or {date2} work?"

BANNED WORDS: generate, additional, month, obtain, secure, guaranteed, growth, leverage, optimize, capture, convert, visibility, intake, high-intent, pipeline, engagement, consultations, retainers, compelling, robust, utilize, facilitate, comprehensive, streamline, innovative.

SAY INSTEAD: "month" -> "every 30 days", "cases" -> "clients", "report" -> "breakdown", "retainers" -> "clients", "consultations" -> "meetings", "visibility" -> "showing up online".

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

Right now when someone in ${city} searches for a ${practice} lawyer, ${comp} shows up first${reviews ? ` (${reviews} Google reviews)` : ''}. Those people should be calling ${lead.firm_name || 'them'} instead.

We put a ${practice} firm in the same position in front of every person searching in their area. They signed 12 new clients in their first 30 days.

Spell out the money. Be blunt. Use small words. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'after_hours_leak',
    buildPrompt: (lead, dates) => {
      const city = lead.city || 'your area';
      const practice = lead.practice_label || 'legal';
      return `Email 2. Second in the chain.

Someone in ${city} needs a ${practice} lawyer at 7pm or on a Saturday. They call, nobody picks up, they call the next firm. That's money gone.

We set up a ${practice} firm so every single person who calls gets answered, day or night. They picked up 8 extra clients in their first 30 days just from that.

Their breakdown shows this is happening to them too. Small words, big value. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'cost_of_waiting',
    buildPrompt: (lead, dates) => {
      const comp = lead.top_competitor || 'their competitors';
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal services';
      return `Email 3. Third in the chain.

People in their area are scrolling social media right now. Someone just got in an accident, someone just got served, whatever fits ${practice}. We put their firm in front of those people before they even Google "${practice} lawyer ${lead.city || ''}".

A firm we did this for signed $109K worth of clients in 30 days. Most of those people never even searched Google, they just saw the firm and called.

${range ? `Their breakdown shows ${range} they're leaving on the table.` : ''} Plain words, no fluff. Meeting dates: ${dates[0]} or ${dates[1]}`;
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

When someone Googles "${practice} lawyer ${city}", they see ${comp}${reviews ? ` with ${reviews} reviews` : ''} and they see ${lead.firm_name || 'them'}. People pick the one that looks more legit. That's just how it works.

We helped a ${practice} firm go from barely any reviews to the most reviewed firm in their city. People started calling them instead because they looked like the obvious choice. $92K in 30 days.

No big words. Just spell out the money. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'value_drop',
    buildPrompt: (lead, dates) => {
      const gap = lead.biggest_gap || 'showing up online';
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal services';
      return `Email 5. Fifth in the chain.

Their biggest problem from the breakdown is ${gap}. ${range ? `That alone is worth ${range} every 30 days.` : 'That alone is costing them serious money.'}

We fixed this exact thing for another ${practice} firm. Their phone went from quiet to ringing every day within two weeks. Same situation, same kind of market.

Tell them the money. Make it obvious. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'direct_ask',
    buildPrompt: (lead, dates) => {
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal';
      return `Email 6. Sixth in the chain. Straight up ask.

We handle everything. The Google stuff, the social media, the calls, the reviews, all of it. A ${practice} firm we work with just shows up to meetings now. Their calendar is full every week and they don't think about where the next client is coming from.

${range ? `Their breakdown shows ${range} sitting there.` : ''} My team already put it together for their market. They just need to see it.

Be direct. No fluff. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'breakup',
    buildPrompt: (lead) => {
      const city = lead.city || 'your market';
      const practice = lead.practice_label || 'your practice area';
      return `Email 7. Last one. NO meeting dates.

We only work with one ${practice} firm in ${city}. Can't have two of our own firms going after the same people. That spot is open but I'm done following up about it.

Their breakdown is at ${lead.report_url} if they ever want to look at the numbers again.

Short and real. No sign off.`;
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
        prompt + `\n\nREMINDER: 40-60 words. 3-5 sentences. Use the simplest words possible. Tell them HOW we make them money. Each sentence on its own line with a blank line between. Start with "Hi ${firstName}," then body. NO sign off. Just end.`
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
