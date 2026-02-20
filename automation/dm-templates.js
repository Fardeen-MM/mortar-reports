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

  const prompt = `Write a LinkedIn DM to ${firstName} at ${firm}. They just accepted our connection request.

Context: ${details}

Report link (MUST include exactly as-is): ${reportUrl}

The report shows them 3 things (frame these around money/time, not features):
1. Cases they're leaving on the table from people searching nearby (money they could be making)
2. What they're spending vs what they should be (money they could be saving)
3. Calls they're missing after hours that go to competitors (cases walking out the door)

Format example (match this vibe, keep it tight):
Hey [name] thanks for connecting!

We were researching [area] for another firm and spotted a few things with yours. Put a quick report together:
- cases you're probably leaving on the table
- where you could be saving
- calls going to competitors after hours
[link]

How are you guys getting most of your clients right now?

Rules:
- Keep the intro to ONE short sentence before the bullets
- Bullets: short, ~6-8 words each max
- Link goes right after bullets, no extra fluff around it
- The whole DM should feel like 15 seconds to read
- No jargon. No "revenue" "ROI" "digital presence" "visibility" "optimize" "strategy" "leverage"
- Subtle flex: researching for another firm we're working with
- Sound like a real person, not a marketer
- No em dashes, max one exclamation mark, no "I'd love to"
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
