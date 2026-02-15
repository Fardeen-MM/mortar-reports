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
const SYSTEM_PROMPT = `You are Fardeen. You run Mortar Metrics. You already sent this lawyer a personalized breakdown of their market. These are follow-ups on the same email thread.

WHAT MAKES THESE EMAILS WORK:
Each email feels like you're sharing something that JUST happened. You just got off a call. You just turned something on for a firm. You just saw results come in. It's a real-time update from someone who's actively working with firms like theirs, and they're missing out.

NEVER name any firm you work with. Say "a firm in [their state]" or "a ${'{'}practice${'}'} firm in a similar market" or "a firm we just started working with." Keep it vague but specific enough to be believable.

EACH EMAIL IS DIFFERENT: Every email opens differently. Some ideas:
- Share a result that just came in ("just got a text from a firm we work with, 12 paid meetings booked this week alone")
- Something you just built or turned on ("turned on the AI voice thing for a new firm yesterday, already booked 3 paid consults")
- A quick thought that connects to their breakdown
- Something your team just noticed
Never start two emails the same way.

CONNECT THE CHAIN: These emails are on the same thread. Lightly reference the breakdown or previous emails. "Remember those numbers I sent over?" "Going back to your breakdown for a sec." But keep it natural, like you're continuing a conversation.

HOW TO WRITE:
- Normal everyday words. Talk like a person, not a marketer.
- Talk about money, phones ringing, calendars full, clients walking in.
- Use THEIR city and THEIR dollar range from the breakdown. Make it personal.
- Never say: leverage, optimize, capture, convert, visibility, intake, pipeline, engagement, retainers, consultations, compelling, robust, utilize, facilitate, comprehensive, streamline, innovative, strategy, solution, approach.

FORMAT:
- 40-70 words. Enough to tell a quick story, not enough to bore them.
- 4-6 sentences. Each on its own line. Blank line between every line.
- Never use em dash. Period or comma only.
- NO sign off. Just end.
- End emails 1-6 with 2 meeting dates like "Does {date1} or {date2} work?"

Start: "Hi {first_name}," on its own line. Then body. That's it.`;

const EMAIL_ANGLES = [
  {
    name: 'competitor_insight',
    buildPrompt: (lead, dates) => {
      const city = lead.city || 'your area';
      const practice = lead.practice_label || 'legal';
      const range = lead.total_range || '';
      return `Email 1. Open with something that just happened with another firm.

OPENER IDEA: "Just got off a call with a ${practice} firm in a similar market to ${city}. Reminded me of your breakdown."

Then connect: ${range ? `Your breakdown showed ${range} every 30 days going to other firms instead of you.` : `People in ${city} searching for a ${practice} lawyer are finding everyone else first.`}

That firm? Same situation. Their phone is already ringing. 12 new clients in 30 days.

NEVER name any firm. Say "a firm in a similar market" or "a ${practice} firm we work with." Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'after_hours_leak',
    buildPrompt: (lead, dates) => {
      const city = lead.city || 'your area';
      const practice = lead.practice_label || 'legal';
      return `Email 2. Open with something exciting you just built.

OPENER IDEA: "Turned on an AI voice assistant for a ${practice} firm yesterday. They already booked 3 paid consults from calls that would've gone to voicemail."

Then connect to THEM: Most firms in ${city} lose people who call after 6pm or on weekends. Those people just call the next firm. Their breakdown flagged this.

This firm we set it up for? 8 new clients in their first 30 days just from the calls they used to miss.

NEVER name any firm. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'cost_of_waiting',
    buildPrompt: (lead, dates) => {
      const range = lead.total_range || '';
      const city = lead.city || 'their area';
      const practice = lead.practice_label || 'legal';
      return `Email 3. Open by casually referencing their breakdown.

OPENER IDEA: "Was going through your numbers with my team this morning." or "Your breakdown came up in a meeting today."

Then the cost: ${range ? `Every 30 days, that's ${range} going to other firms in ${city} instead of them.` : `Every 30 days, people in ${city} who need a ${practice} lawyer are hiring someone else.`}

A firm we work with in a similar market went from the same position to $109K in new clients in 30 days.

NEVER name any firm. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'social_proof',
    buildPrompt: (lead, dates) => {
      const practice = lead.practice_label || 'legal';
      const city = lead.city || 'their market';
      return `Email 4. Open with a result that just came in.

OPENER IDEA: "Just got a text from a ${practice} firm we work with. 12 paid meetings booked this week alone." or "One of our firms just hit their best week."

Then connect: We made this firm the most reviewed ${practice} firm in their city. People started calling them first. $92K in new clients in 30 days.

Same thing is sitting there for them in ${city}. Their breakdown shows it.

NEVER name any firm. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'value_drop',
    buildPrompt: (lead, dates) => {
      const gap = lead.biggest_gap || 'showing up when people search';
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal';
      const city = lead.city || 'their area';
      return `Email 5. Open with something your team noticed.

OPENER IDEA: "My team flagged something in your breakdown I think you should know about." or "Something in your numbers keeps coming up."

Their biggest gap is ${gap}. ${range ? `That one thing is where most of the ${range} is sitting.` : 'That one thing is costing them the most.'}

A ${practice} firm we work with in a market like ${city} had the same gap. Fixed it, phone went from quiet to ringing every day. Two weeks.

NEVER name any firm. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'direct_ask',
    buildPrompt: (lead, dates) => {
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal';
      const city = lead.city || 'their area';
      return `Email 6. Straight ask.

OPENER IDEA: "I'll keep this short." or "Wanted to be straight with you."

Spell out what you do in plain English: We make them show up when people in ${city} search. We put them on social media so people remember them. Every call gets answered. More reviews so people trust them. They just show up to meetings and sign clients.

${range ? `Their breakdown shows ${range} every 30 days.` : ''}

A ${practice} firm we do this for literally just shows up to meetings now. Calendar full every week.

If it makes sense, great. If not, no hard feelings. NEVER name any firm. Meeting dates: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'breakup',
    buildPrompt: (lead) => {
      const city = lead.city || 'your market';
      const practice = lead.practice_label || 'your practice area';
      const range = lead.total_range || '';
      return `Email 7. Last one. NO meeting dates.

OPENER IDEA: "Last one from me on this." or "Won't keep filling up your inbox."

We only take one ${practice} firm per market in ${city}. Can't have two of our firms competing with each other. ${range ? `${range} every 30 days is sitting there.` : ''} That spot is open but I'm not going to keep following up about it.

Their breakdown is at ${lead.report_url} if they ever want to look.

NEVER name any firm. Short and genuine. No sign off.`;
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

/**
 * QC check: flag emails that won't convert.
 */
function qcEmail(text, lead) {
  const issues = [];
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).length;

  // Length check
  if (words > 80) issues.push(`too long (${words} words)`);
  if (words < 20) issues.push(`too short (${words} words)`);

  // Banned jargon
  const jargon = ['leverage','optimize','capture','convert','visibility','intake',
    'high-intent','pipeline','engagement','retainers','consultations','compelling',
    'robust','utilize','facilitate','comprehensive','streamline','innovative',
    'strategy','solution','approach','playbook'];
  for (const word of jargon) {
    if (lower.includes(word)) issues.push(`jargon: "${word}"`);
  }

  // Competitor name should not appear at all (we don't name firms)
  if (lead.top_competitor) {
    const compName = lead.top_competitor.toLowerCase();
    if (lower.includes(compName)) issues.push(`competitor name "${lead.top_competitor}" found (should not name any firms)`);
  }

  // Has money/ROI reference
  if (!text.includes('$') && !lower.includes('client') && !lower.includes('money')) {
    issues.push('no money/ROI reference');
  }

  // Has their city or firm name (personalization check)
  const hasCity = lead.city && lower.includes(lead.city.toLowerCase());
  const hasFirm = lead.firm_name && lower.includes(lead.firm_name.toLowerCase());
  if (!hasCity && !hasFirm) issues.push('missing personalization (no city or firm name)');

  // Em dashes snuck through
  if (text.includes('\u2014') || text.includes('\u2013')) issues.push('em dash found');

  return issues;
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

      // QC check: score the email
      const qcIssues = qcEmail(emailBody, lead);
      if (qcIssues.length > 0) {
        console.log(`  ⚠️  QC issues: ${qcIssues.join(', ')}`);
      } else {
        console.log(`  ✅ QC passed`);
      }

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
