/**
 * AI Email Generator — shared module for generating contextual email replies.
 * Used by both telegram-approval-bot.js (preview) and send-email.js (actual send).
 */

const https = require('https');

/**
 * Convert plain text to simple HTML: split paragraphs, linkify URLs.
 */
function plainTextToHtml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const linkified = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>'
  );
  return linkified
    .split(/\n\n+/)
    .map(p => `<div>${p.replace(/\n/g, '<br>')}</div>`)
    .join('<div><br /></div>');
}

/**
 * Generate a full AI reply that addresses what the lead actually said.
 * Classification-aware: different prompts for each category.
 * Returns { subject, body, html }.
 */
function generateFullReply(apiKey, replyText, classification, contactName, firmName, reportUrl, practiceLabel, totalRange, country) {
  const firstName = (contactName || '').split(' ')[0] || 'there';
  const now = new Date();
  const dayOfWeek = now.getDay();
  let meetDay1, meetDay2;
  if (dayOfWeek >= 5 || dayOfWeek === 0) {
    meetDay1 = 'Monday'; meetDay2 = 'Tuesday';
  } else {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    meetDay1 = 'tomorrow'; meetDay2 = days[(dayOfWeek + 2) % 7];
  }

  const cleanRange = (totalRange || '').replace(/Â£/g, '£').replace(/Â/g, '');

  let prompt = `You're Fardeen from Mortar Metrics. We help law firms find untapped revenue — data-driven market breakdowns showing how many cases their area supports vs what they're getting, then we run the marketing to close that gap.

A law firm lead replied to our outreach. Read their reply carefully and write a real, thoughtful email response. Your job is to get the report link in front of them no matter what they said.

LEAD: ${firstName} from ${firmName || 'their firm'}
THEIR REPLY: "${replyText}"
CLASSIFICATION: ${classification}
REPORT LINK (MUST include exactly as-is): ${reportUrl}`;

  if (practiceLabel) prompt += `\nPRACTICE: ${practiceLabel}`;
  if (cleanRange) prompt += `\nREVENUE GAP: ${cleanRange}/mo`;

  // Classification-specific guidelines
  let guidelines;
  if (classification === 'UNSUBSCRIBE' || classification === 'NOT_INTERESTED') {
    guidelines = `
This person said no or wants off the list. Respect that completely. But we already built this report for free, so drop the link anyway.

Guidelines:
- Acknowledge what they said genuinely. No pushback, no guilt, no "are you sure?"
- Mention you already built a full breakdown for their firm before hearing back. It's done, sitting there, free, no strings.
- Drop the report link casually. Frame it as "already built it, here it is in case you ever want a look."
- No meeting ask. No CTA. Just "if the numbers ever catch your eye, happy to chat."
- 2-4 sentences. Short, warm, human. You're a person who respects their time.
- If they said something aggressive ("stop spamming", "cease and desist"), be extra respectful and brief. Just "understood" + "we built this before your reply, here it is if useful" + done.`;
  } else if (classification === 'OOO') {
    guidelines = `
They're out of office. Keep it light.

Guidelines:
- Keep it casual and warm. "No rush at all" type energy.
- Mention you put together a breakdown for their firm, link it so it's ready when they're back.
- No meeting ask. Just "take a look when you're back, happy to walk through it."
- 2-3 sentences max.`;
  } else if (classification === 'QUESTION') {
    guidelines = `
They asked a question. Answer it, then pivot to the report.

Guidelines:
- Actually answer their question directly and specifically.
- Transition naturally to the report you built for them.
- Include the report link in the flow.
- End with a meeting ask: "15 minutes, I'll walk you through the numbers. Does ${meetDay1} or ${meetDay2} work?"
- 4-6 sentences.`;
  } else if (classification === 'OBJECTION') {
    guidelines = `
They pushed back but didn't fully say no. Reframe their concern, then pivot to the report.

Guidelines:
- Acknowledge their concern genuinely.
- Reframe it if possible (small market = less competition = easier wins, already have marketing = good, this shows what's being missed, etc.)
- Mention you already built the breakdown, link it naturally.
- End with a soft meeting ask: "15 minutes, I'll share my screen. Does ${meetDay1} or ${meetDay2} work?"
- 3-5 sentences. Confident but not pushy.`;
  } else {
    // INTERESTED or default
    guidelines = `
They're interested or replied positively. Match their energy and get them the report.

Guidelines:
- Acknowledge their reply warmly.
- Transition to the report you built.
- Include the report link naturally.
- End with a meeting ask: "15 minutes, I'll walk you through it. Does ${meetDay1} or ${meetDay2} work?"
- 3-5 sentences. Confident, direct.`;
  }

  prompt += `
${guidelines}

General rules:
- Start with "Hey ${firstName}," on its own line, then a blank line before the body.
- Be conversational and genuine. No marketing speak. No exclamation marks. No em dashes.
- Sound like a real person, not a template. Short sentences.
- The report link must appear exactly as provided.
- No sign-off or signature.`;

  if (country === 'CA') {
    prompt += `\nThe lead is Canadian and so are you. Work in something like "always great to work with fellow Canadians" but keep it natural, not forced.`;
  }

  return new Promise((resolve) => {
    const fallbackBody = `Hey ${firstName},\n\nAppreciate you getting back to me. We actually already put together a breakdown for your firm — here's the full report:\n${reportUrl}\n\n15 minutes and I'll walk you through it. Does ${meetDay1} or ${meetDay2} work?`;

    if (!apiKey) {
      console.log('⚠️  No API key - using fallback full reply');
      return resolve({
        subject: 'Your marketing analysis',
        body: fallbackBody,
        html: plainTextToHtml(fallbackBody)
      });
    }

    const payload = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload),
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content?.[0]?.text?.trim();
          if (text) {
            console.log(`🤖 AI full reply (${text.length} chars): "${text.substring(0, 100)}..."`);
            resolve({
              subject: 'Your marketing analysis',
              body: text,
              html: plainTextToHtml(text)
            });
          } else {
            console.warn('⚠️  Empty AI response, using fallback full reply');
            resolve({ subject: 'Your marketing analysis', body: fallbackBody, html: plainTextToHtml(fallbackBody) });
          }
        } catch (e) {
          console.warn(`⚠️  Failed to parse AI response: ${e.message}`);
          resolve({ subject: 'Your marketing analysis', body: fallbackBody, html: plainTextToHtml(fallbackBody) });
        }
      });
    });

    req.on('error', (error) => {
      console.warn(`⚠️  AI full reply request failed: ${error.message}`);
      resolve({ subject: 'Your marketing analysis', body: fallbackBody, html: plainTextToHtml(fallbackBody) });
    });

    req.setTimeout(15000, () => {
      console.warn('⚠️  AI full reply timed out, using fallback');
      req.destroy();
      resolve({ subject: 'Your marketing analysis', body: fallbackBody, html: plainTextToHtml(fallbackBody) });
    });

    req.write(payload);
    req.end();
  });
}

module.exports = { generateFullReply, plainTextToHtml };
