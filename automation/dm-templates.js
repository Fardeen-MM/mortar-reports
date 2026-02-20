/**
 * DM Templates — LinkedIn DM equivalents of email-templates.js
 * Plain text only (no HTML). Short, casual, DM-style.
 */

function buildDM(contactName, firmName, reportUrl, totalRange, totalCases, practiceLabel) {
  const firstName = (contactName || '').split(' ')[0] || 'there';
  const firm = firmName || 'your firm';

  let body;
  if (totalRange && practiceLabel) {
    body = `Hey ${firstName} - we ran the numbers for ${firm} and found ${totalRange}/mo in ${practiceLabel} cases your market can support. Here's the full breakdown: ${reportUrl}`;
  } else {
    body = `Hey ${firstName} - we put together a quick market breakdown for ${firm}. Worth a look: ${reportUrl}`;
  }

  return { body };
}

// Hardcoded fallback — only used if AI generation fails
function buildConnectionDM(contactName, firmName, reportUrl, practiceLabel) {
  const firstName = (contactName || '').split(' ')[0] || 'there';
  const firm = firmName || 'your firm';

  const body = `Hey ${firstName} thanks for connecting! We were doing some research in your area for another firm we're working with and noticed a few gaps with ${firm}. My team put together a quick breakdown for you, thought it might be useful: ${reportUrl}\n\nAre you guys doing much online or mostly word of mouth?`;

  return { body };
}

/**
 * AI-generate a personalized connection DM using Claude Haiku.
 * Falls back to buildConnectionDM() template if AI fails.
 */
async function generateConnectionDM(apiKey, contactName, firmName, reportUrl, context) {
  const firstName = (contactName || '').split(' ')[0] || 'there';
  const firm = firmName || 'your firm';
  const city = context.city || '';
  const practiceLabel = context.practiceLabel || '';
  const topCompetitor = context.topCompetitor || '';
  const biggestGap = context.biggestGap || '';

  if (!apiKey) {
    return buildConnectionDM(contactName, firmName, reportUrl, practiceLabel);
  }

  let details = '';
  if (city) details += `They are based in ${city}. `;
  if (practiceLabel) details += `Main practice area: ${practiceLabel}. `;
  if (topCompetitor) details += `Top local competitor: ${topCompetitor}. `;
  if (biggestGap) details += `Biggest gap we found: ${biggestGap}. `;

  const prompt = `Write a short LinkedIn DM to ${firstName} at ${firm}. They just accepted our connection request.

Context: ${details}

Report link (MUST include exactly as-is): ${reportUrl}

Rules:
- Thank them for connecting
- Subtle flex: we were researching their area for another firm we're working with and spotted some gaps with theirs
- If you know specifics (practice area, city, gap) weave ONE in naturally, don't force all of them
- Link the report casually
- End with a short casual question about their marketing (word of mouth, online, etc)
- Sound like a real person texting, not a sales bot
- No em dashes, no exclamation marks after the first sentence, no "I'd love to" or "I'd be happy to"
- Under 50 words before the question
- Just the DM text, nothing else`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!resp.ok) {
      console.warn(`AI DM generation failed (${resp.status}), using template`);
      return buildConnectionDM(contactName, firmName, reportUrl, practiceLabel);
    }

    const data = await resp.json();
    const body = (data.content?.[0]?.text || '').trim();

    // Sanity check: must contain the report URL
    if (!body || !body.includes(reportUrl)) {
      console.warn('AI DM missing report URL, using template');
      return buildConnectionDM(contactName, firmName, reportUrl, practiceLabel);
    }

    return { body };
  } catch (e) {
    console.warn('AI DM generation error:', e.message);
    return buildConnectionDM(contactName, firmName, reportUrl, practiceLabel);
  }
}

module.exports = { buildDM, buildConnectionDM, generateConnectionDM };
