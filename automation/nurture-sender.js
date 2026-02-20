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
Never start two emails the same way. Each email should feel like a completely different moment in time, not the same template with different words.

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
- End emails 1-6 with 2 meeting dates AND a money-related closer that ties back to the email. Examples:
  "Does {date1} or {date2} work? Would love to get you making money right away."
  "Does {date1} or {date2} work? Want to show you exactly where those clients would come from."
  "Does {date1} or {date2} work? Your phone could be ringing like theirs in two weeks."
  VARY the closer every time. Never use the same one twice. Make it specific to what the email was about.

Start: "Hi {first_name}," on its own line. Then body. That's it.`;

// DM system prompt — shorter, more casual for LinkedIn messages
const DM_SYSTEM_PROMPT = `You are Fardeen from Mortar Metrics. You sent this lawyer a personalized market breakdown via LinkedIn. These are follow-up DMs.

LinkedIn DMs are SHORT. 1-3 sentences max. 15-35 words. Casual, like texting a colleague. No formatting, no bullet points, no emojis. Just a quick message.

NEVER name any firm. Don't say "Hi {first_name}" — just start talking. End with a question or soft CTA.`;

const EMAIL_ANGLES = [
  {
    name: 'market_observation',
    type: 'observation',
    buildPrompt: (lead, dates) => {
      const city = lead.city || 'your area';
      const practice = lead.practice_label || 'legal';
      const range = lead.total_range || '';
      return `Email 1. TYPE: Market observation. You noticed something happening in their market right now.

VIBE: You were looking at ${city} and noticed something interesting. Share what you see happening in the ${practice} space there. People searching, firms showing up, money moving. Then tie it to their breakdown numbers.

${range ? `Their breakdown showed ${range} every 30 days up for grabs in ${city}.` : `There's a lot of movement in the ${practice} space in ${city} right now.`}

This is NOT a testimonial. Don't mention other firms you work with. Just share what you're seeing in their market and why it matters to them.

NEVER name any firm. Meeting dates + money closer: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'something_we_built',
    type: 'behind_the_scenes',
    buildPrompt: (lead, dates) => {
      const city = lead.city || 'your area';
      const practice = lead.practice_label || 'legal';
      return `Email 2. TYPE: Something you just built/turned on. Behind the scenes peek.

VIBE: You just turned on something cool. An AI voice assistant that answers calls 24/7, a system that books meetings automatically, something that makes firms show up on Google overnight. You're excited about it because it actually works. Share what it does in plain English.

Then connect: Firms in ${city} are losing people who call after hours. Those people just call the next firm. Their breakdown flagged this gap.

This is NOT a testimonial about results. It's about something cool you just built and why it matters for them specifically.

NEVER name any firm. Meeting dates + money closer: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'their_numbers',
    type: 'breakdown_deep_dive',
    buildPrompt: (lead, dates) => {
      const range = lead.total_range || '';
      const city = lead.city || 'their area';
      const practice = lead.practice_label || 'legal';
      const gap = lead.biggest_gap || 'showing up when people search';
      return `Email 3. TYPE: Deep dive into THEIR specific numbers. No other firms mentioned.

VIBE: You were looking at their breakdown again with your team. Something specific jumped out. Their biggest gap is ${gap}. ${range ? `That's where most of the ${range} is coming from.` : ''} Break down what that actually means in plain English. How many people are searching, where they're going instead, what that costs them every 30 days.

This is ONLY about their numbers. Don't mention any other firm or any results for other firms. Just their data, what it means, and why it should matter to them.

Make it feel like you genuinely care about their numbers and find them interesting. NEVER name any firm. Meeting dates + money closer: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'result_just_came_in',
    type: 'testimonial',
    buildPrompt: (lead, dates) => {
      const practice = lead.practice_label || 'legal';
      const city = lead.city || 'their market';
      const range = lead.total_range || '';
      return `Email 4. TYPE: A real result that just came in. This is the ONE testimonial email.

VIBE: You just got a text or a call from a ${practice} firm you work with in a similar market. Something exciting just happened. Maybe they just had their best week, maybe they booked 12 paid meetings, maybe their calendar is full for the next 3 weeks. Share it like you're genuinely hyped about it.

Then connect to them: Same kind of market as ${city}. ${range ? `Their breakdown shows ${range} sitting there.` : 'Same gaps.'} Same opportunity.

This is the ONLY email in the sequence that's a testimonial. Keep it real, keep it exciting. Vary the specific numbers from the opener ideas.

NEVER name any firm. Say "a firm in a similar market." Meeting dates + money closer: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'what_we_noticed',
    type: 'insight',
    buildPrompt: (lead, dates) => {
      const gap = lead.biggest_gap || 'showing up when people search';
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal';
      const city = lead.city || 'their area';
      return `Email 5. TYPE: Something interesting your team noticed. An insight, not a testimonial.

VIBE: Your team was working on something and stumbled on an interesting pattern. Maybe you noticed that ${practice} firms in markets like ${city} that fix ${gap} first see the fastest results. Maybe you noticed that most firms don't realize how much money they lose from one specific thing. Share a genuine insight about their industry or their market.

${range ? `Their breakdown shows ${range}, and most of that comes from ${gap}.` : `Their biggest gap is ${gap}.`}

This is NOT about another firm's results. It's about a pattern or insight you've noticed across the industry. Make it feel like you're sharing something genuinely useful.

NEVER name any firm. Meeting dates + money closer: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'the_full_picture',
    type: 'direct',
    buildPrompt: (lead, dates) => {
      const range = lead.total_range || '';
      const practice = lead.practice_label || 'legal';
      const city = lead.city || 'their area';
      return `Email 6. TYPE: Straight talk. Paint the full picture of what working together looks like.

VIBE: Be direct. Tell them exactly what happens when a firm works with you. Not in marketing speak, in real life terms. We make you show up when people in ${city} search. We put you on social media so people remember your name. Every call gets answered day or night. You get more reviews so people trust you. You just show up to meetings and sign clients. That's it.

${range ? `Their breakdown shows ${range} every 30 days sitting there.` : ''}

Don't reference other firms' results. Just paint the picture of what THEIR life looks like when this is running.

If it makes sense, great. If not, no hard feelings. NEVER name any firm. Meeting dates + money closer: ${dates[0]} or ${dates[1]}`;
    }
  },
  {
    name: 'breakup',
    type: 'breakup',
    buildPrompt: (lead) => {
      const city = lead.city || 'your market';
      const practice = lead.practice_label || 'your practice area';
      const range = lead.total_range || '';
      return `Email 7. Last one. NO meeting dates. NO money closer.

VIBE: Genuine close. You only take one ${practice} firm per market in ${city}. Can't have two of your firms going after the same people. ${range ? `${range} every 30 days is sitting there.` : ''} That spot is open but you're done following up.

Their breakdown is at ${lead.report_url || 'the link I sent over'} if they want to look.

Keep it short. Real. No BS. Make them feel the door closing gently.

NEVER name any firm. No sign off.`;
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
 * Basic QC: quick checks before AI scoring.
 * @param {string} text
 * @param {object} lead
 * @param {{ maxWords?: number, minWords?: number }} opts
 */
function quickQC(text, lead, opts = {}) {
  const issues = [];
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).length;

  const maxWords = opts.maxWords || 75;
  const minWords = opts.minWords || 20;
  if (words > maxWords) issues.push(`too long (${words} words, max ${maxWords})`);
  if (words < minWords) issues.push(`too short (${words} words)`);

  const jargon = ['leverage','optimize','capture','convert','visibility','intake',
    'high-intent','pipeline','engagement','retainers','consultations','compelling',
    'robust','utilize','facilitate','comprehensive','streamline','innovative',
    'strategy','solution','approach','playbook'];
  for (const word of jargon) {
    if (lower.includes(word)) issues.push(`jargon: "${word}"`);
  }

  if (lead.top_competitor) {
    const compName = lead.top_competitor.toLowerCase();
    if (lower.includes(compName)) issues.push(`named competitor "${lead.top_competitor}"`);
  }

  if (text.includes('\u2014') || text.includes('\u2013')) issues.push('em dash');

  const hasCity = lead.city && lower.includes(lead.city.toLowerCase());
  const hasFirm = lead.firm_name && lower.includes(lead.firm_name.toLowerCase());
  if (!hasCity && !hasFirm) issues.push('no personalization');

  return issues;
}

/**
 * AI QC: score the email on conversion quality. Returns { score, feedback }.
 */
async function aiQC(text, lead, angleType) {
  const prompt = `Score this follow-up email from 1-10. Be harsh. A 10 means a lawyer would read this and WANT to book a meeting.

EMAIL:
${text}

CONTEXT: This email is for a ${lead.practice_label || 'legal'} firm in ${lead.city || 'unknown city'}. Email type: ${angleType}.

Score on these criteria (1-10 each):
1. FEELS REAL: Does it feel like a real person wrote this, not AI? No BS, no corporate speak?
2. MAKES MONEY OBVIOUS: Does it make clear how much money they could make or are losing?
3. CREATES FOMO: Would a lawyer feel like they're missing out after reading this?
4. TRUST: Does the writer feel trustworthy and low-risk to work with?
5. WANT TO READ: Is it fun/interesting to read? Would they read to the end?
6. CTA POWER: Does the ending make them want to book a meeting?

Return ONLY this format:
SCORE: [average of all 6, rounded to nearest 0.5]
FEEDBACK: [one sentence on what to fix if under 8]`;

  try {
    const result = await callHaiku('You are a brutally honest email copywriting critic. Score emails harshly.', prompt);
    const scoreMatch = result.match(/SCORE:\s*([\d.]+)/);
    const feedbackMatch = result.match(/FEEDBACK:\s*(.+)/);
    return {
      score: scoreMatch ? parseFloat(scoreMatch[1]) : 5,
      feedback: feedbackMatch ? feedbackMatch[1].trim() : 'No specific feedback'
    };
  } catch (e) {
    console.log(`  ⚠️  AI QC failed: ${e.message}, skipping`);
    return { score: 7, feedback: 'AI QC unavailable' };
  }
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
    if (!resp.items) {
      console.error('Worker returned no items:', JSON.stringify(resp).slice(0, 200));
      process.exit(1);
    }
    items = resp.items;
  } catch (e) {
    console.error('Failed to fetch nurture queue:', e.message);
    process.exit(1);
  }

  const active = items.filter(i => i.status === 'active');
  const paused = items.filter(i => i.status === 'paused');
  console.log(`Found ${items.length} total entries, ${active.length} active, ${paused.length} paused\n`);

  if (paused.length > 0) {
    for (const p of paused) {
      console.log(`⏸️  ${p.email}: PAUSED (${p.pause_reason || 'unknown'}) — ${p.emails_sent || 0}/7 sent (${p.firm_name || '?'})`);
    }
    console.log('');

    // Auto-resume OOO-paused nurture leads whose return date has passed
    let oooResumed = 0;
    for (const p of paused) {
      if (p.pause_reason === 'ooo' && p.ooo_return_date) {
        if (new Date() >= new Date(p.ooo_return_date)) {
          console.log(`✈️ OOO return date passed for ${p.email} (${p.ooo_return_date}) — auto-resuming nurture`);
          p.status = 'active';
          delete p.ooo_return_date;
          delete p.paused_at;
          delete p.pause_reason;
          await workerAPI('/nurture-check', { action: 'set', email: p.email, data: p });
          active.push({ ...p, email: p.email });
          oooResumed++;
        }
      }
    }
    if (oooResumed > 0) {
      console.log(`  ✅ Auto-resumed ${oooResumed} OOO-paused lead(s)\n`);
    }
  }

  if (active.length === 0) {
    console.log('No leads due for nurture. Done.');
    process.exit(0);
  }

  let queued = 0;
  const dates = getDateOptions();

  for (const lead of active) {
    const days = daysSince(lead.start_date);
    const emailsSent = lead.emails_sent || 0;
    const channel = lead.channel || 'instantly';
    const isProsp = channel === 'prosp';
    const leadKey = lead.email; // This is either email or linkedin_url (set during nurture-check)

    // Find the next send day
    const nextSendDay = SEND_DAYS[emailsSent];
    if (!nextSendDay) {
      console.log(`\u2705 ${leadKey}: All 7 ${isProsp ? 'DMs' : 'emails'} sent, marking complete`);
      lead.status = 'completed';
      const completeResp = await workerAPI('/nurture-check', { action: 'set', email: leadKey, data: lead });
      if (completeResp.ok === false) console.error(`  \u26a0\ufe0f  Failed to mark complete: ${completeResp.error || 'unknown'}`);
      continue;
    }

    if (days < nextSendDay) {
      console.log(`\u23f3 ${leadKey}: Day ${days}, next send on day ${nextSendDay} (${emailsSent}/7 sent)${isProsp ? ' [DM]' : ''}`);
      continue;
    }

    const angle = EMAIL_ANGLES[emailsSent];
    console.log(`${isProsp ? '\ud83d\udcac' : '\ud83d\udce7'} ${leadKey}: Day ${days}, sending ${isProsp ? 'DM' : 'email'} #${emailsSent + 1} (${angle.name})`);

    const firstName = lead.contact_name?.split(' ')[0] || 'there';

    try {
      const basePrompt = angle.buildPrompt(lead, dates);

      let systemPrompt, reminder;
      if (isProsp) {
        systemPrompt = DM_SYSTEM_PROMPT.replace('{first_name}', firstName);
        reminder = `\n\nREMINDER: This is a LinkedIn DM. 15-35 words MAX. 1-3 sentences. Casual and short. Use their city or dollar numbers if relevant. End with a question or soft ask. Don't say "Hi" — just start talking. NEVER name any firm.`;
      } else {
        systemPrompt = SYSTEM_PROMPT.replace('{first_name}', firstName);
        reminder = `\n\nREMINDER: 40-70 words. 4-6 sentences. Use THEIR city and dollar numbers. End with meeting dates + a money closer that ties to the email topic. Each sentence on its own line with blank line between. Start with "Hi ${firstName}," then body. NO sign off. NEVER name any firm we work with.`;
      }

      // If this lead previously replied, inject context so the message acknowledges it
      if (lead.last_reply_text) {
        const daysAgo = lead.last_reply_at ? daysSince(lead.last_reply_at) : 'a few';
        reminder += `\n\nIMPORTANT CONTEXT: This lead replied ${daysAgo} days ago. Their reply was: "${lead.last_reply_text.slice(0, 300)}". You MUST naturally acknowledge that they replied. Something like "Glad you wrote back" or "Saw your note" or "Good to hear from you." Then continue with the ${isProsp ? 'DM' : 'email'} angle. Don't dwell on it, just a quick nod and move on.`;
        console.log(`  \ud83d\udcac Injecting reply context (replied ${daysAgo} days ago, category: ${lead.last_reply_category || '?'})`);
      }

      let emailBody = '';
      let bestScore = 0;
      let bestBody = '';
      const MAX_ATTEMPTS = 3;
      const qcOpts = isProsp ? { maxWords: 40, minWords: 10 } : {};

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let prompt = basePrompt + reminder;
        if (attempt > 1) {
          prompt += `\n\nPREVIOUS ATTEMPT SCORED ${bestScore}/10. FEEDBACK: ${lastFeedback}\nWrite a completely different version that fixes this. Don't repeat the same opening or structure.`;
        }

        emailBody = await callHaiku(systemPrompt, prompt);
        emailBody = cleanEmail(emailBody);

        // Quick QC (jargon, length, personalization)
        const quickIssues = quickQC(emailBody, lead, qcOpts);
        if (quickIssues.length > 0) {
          console.log(`  \u26a0\ufe0f  Attempt ${attempt} quick QC: ${quickIssues.join(', ')}`);
          if (attempt < MAX_ATTEMPTS) {
            var lastFeedback = `Fix these: ${quickIssues.join(', ')}`;
            continue;
          }
        }

        // AI QC scoring (skip for DMs — they're too short)
        if (isProsp) {
          bestScore = 8;
          bestBody = emailBody;
          console.log(`  \u2705 DM QC passed (short format, skipping AI scoring)`);
          break;
        }

        const qc = await aiQC(emailBody, lead, angle.type || angle.name);
        console.log(`  \ud83d\udcca Attempt ${attempt}: Score ${qc.score}/10 - ${qc.feedback}`);

        if (qc.score > bestScore) {
          bestScore = qc.score;
          bestBody = emailBody;
        }

        if (qc.score >= 8) {
          console.log(`  \u2705 QC passed (${qc.score}/10)`);
          break;
        }

        if (attempt < MAX_ATTEMPTS) {
          var lastFeedback = qc.feedback;
          console.log(`  \ud83d\udd04 Regenerating...`);
        } else {
          console.log(`  \u26a0\ufe0f  Best score: ${bestScore}/10 after ${MAX_ATTEMPTS} attempts, using best version`);
        }
      }

      emailBody = bestBody || emailBody;

      if (!emailBody || emailBody.trim().length < (isProsp ? 10 : 20)) {
        console.log(`  \u274c ${isProsp ? 'DM' : 'Email'} body too short or empty, skipping this lead`);
        continue;
      }

      // Queue via Worker — use /queue-dm for Prosp leads, /queue-email for Instantly
      if (isProsp) {
        await workerAPI('/queue-dm', {
          type: 'nurture',
          linkedin_url: lead.linkedin_url || leadKey,
          sender: lead.prosp_sender || '',
          message: emailBody,
          contact_name: lead.contact_name,
          firm_name: lead.firm_name,
          context: `Nurture DM ${emailsSent + 1}/7 (${angle.name}) - Day ${days}`
        });
      } else {
        await workerAPI('/queue-email', {
          type: 'nurture',
          to: leadKey,
          subject: '',
          html: emailBody.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>'),
          text: emailBody,
          lead_email: leadKey,
          firm_name: lead.firm_name,
          contact_name: lead.contact_name,
          context: `Nurture ${emailsSent + 1}/7 (${angle.name}) - Day ${days}`
        });
      }

      // Update nurture entry — clear reply context after first use
      lead.emails_sent = emailsSent + 1;
      lead.last_sent = new Date().toISOString();
      if (lead.last_reply_text) {
        console.log(`  \ud83e\uddf9 Clearing reply context (used in this ${isProsp ? 'DM' : 'email'})`);
        delete lead.last_reply_text;
        delete lead.last_reply_category;
        delete lead.last_reply_at;
      }
      const updateResp = await workerAPI('/nurture-check', { action: 'set', email: leadKey, data: lead });
      if (updateResp.ok === false) {
        console.error(`  \u26a0\ufe0f  Failed to update nurture data: ${updateResp.error || 'unknown'}`);
      }

      queued++;
      console.log(`  \u2705 Queued for Telegram approval`);

    } catch (e) {
      console.error(`  \u274c Failed for ${leadKey}: ${e.message}`);
    }
  }

  // ========== OOO PENDING: Welcome-back emails ==========
  console.log('\n✈️ Checking OOO pending entries...');
  let oooQueued = 0;
  try {
    const oooResp = await workerAPI('/ooo-check', { action: 'list' });
    const oooPending = (oooResp.items || []).filter(i => i.status === 'pending');

    if (oooPending.length === 0) {
      console.log('  No OOO pending entries.');
    }

    for (const ooo of oooPending) {
      const returnDate = new Date(ooo.return_date);
      const now = new Date();

      if (now < returnDate) {
        const daysLeft = Math.ceil((returnDate - now) / (1000 * 60 * 60 * 24));
        console.log(`  ⏳ ${ooo.email}: Returns ${ooo.return_date} (${daysLeft} day(s) away)`);
        continue;
      }

      console.log(`  ✈️ ${ooo.email}: Return date passed (${ooo.return_date}) — generating welcome-back email`);

      const firstName = (ooo.contact_name || '').split(' ')[0] || 'there';
      const firmName = ooo.firm_name || 'your firm';
      const reportUrl = ooo.report_url || '';
      const city = ooo.city || 'your area';
      const practice = ooo.practice_label || 'legal';
      const range = ooo.total_range || '';

      const welcomePrompt = `Write a warm, short welcome-back email for a lawyer who was out of office. We already sent them a soft reply while they were away, and we've prepared a personalized marketing report for their firm.

LEAD: ${firstName} from ${firmName}
CITY: ${city}
PRACTICE: ${practice}
${range ? `REPORT SHOWS: ${range} every 30 days in opportunity` : ''}
REPORT LINK: ${reportUrl}

Guidelines:
- Acknowledge they were away (quick, not creepy)
- Mention the personalized report we put together for their firm
- Include the report link naturally
- Soft ask for 15 minutes to walk through it
- Suggest 2 meeting dates
- 40-60 words, 4-6 sentences, each on its own line with blank line between
- Start with "Hi ${firstName}," on its own line
- No sign off. No em dashes. No marketing jargon.
- Sound warm and genuine, like a real person`;

      try {
        let emailBody = await callHaiku(SYSTEM_PROMPT.replace('{first_name}', firstName), welcomePrompt);
        emailBody = cleanEmail(emailBody);

        const quickIssues = quickQC(emailBody, { city, firm_name: firmName });
        if (quickIssues.length > 0) {
          console.log(`    ⚠️ Quick QC: ${quickIssues.join(', ')}`);
        }

        if (!emailBody || emailBody.trim().length < 20) {
          console.log(`    ❌ Email body too short, skipping`);
          continue;
        }

        await workerAPI('/queue-email', {
          type: 'ooo-welcome-back',
          to: ooo.email,
          subject: '',
          html: emailBody.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>'),
          text: emailBody,
          lead_email: ooo.email,
          firm_name: ooo.firm_name,
          contact_name: ooo.contact_name,
          context: `OOO welcome-back (returned ${ooo.return_date})`
        });

        // Mark as sent so we don't re-queue
        ooo.status = 'sent';
        ooo.sent_at = new Date().toISOString();
        await workerAPI('/ooo-check', { action: 'set', email: ooo.email, data: ooo });

        oooQueued++;
        console.log(`    ✅ Welcome-back email queued for Telegram approval`);
      } catch (e) {
        console.error(`    ❌ Failed for ${ooo.email}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error(`  ❌ OOO check failed: ${e.message}`);
  }

  console.log(`\n📬 Done. Queued ${queued} nurture + ${oooQueued} welcome-back email(s) for approval.`);
})();
