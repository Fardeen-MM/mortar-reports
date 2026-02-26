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
function buildConnectionDM(contactName, firmName, reportUrl, totalRange, practiceLabel) {
  const firstName = (contactName || '').split(' ')[0] || 'there';
  const firm = firmName || 'your firm';

  let opener;
  if (totalRange && practiceLabel) {
    opener = `We helped a ${practiceLabel} firm find about ${totalRange}/mo in cases they were missing online. Ran yours and found a similar gap.`;
  } else {
    opener = `We help law firms find cases they're losing to competitors online. Ran an audit on yours and found a few gaps.`;
  }

  const body = `Hey ${firstName}, thanks for connecting.\n\n${opener}\n\nAlready built the whole breakdown for you:\n${reportUrl}\n\nWant me to walk you through the fixes?`;

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
  const totalRange = context.totalRange || '';
  const topCompetitor = context.topCompetitor || '';

  if (!apiKey) {
    return buildConnectionDM(contactName, firmName, reportUrl, totalRange, practiceLabel);
  }

  let details = '';
  if (city) details += `Based in ${city}. `;
  if (practiceLabel) details += `Practice area: ${practiceLabel}. `;
  if (totalRange) details += `Their report found about ${totalRange}/mo in cases they're missing. `;
  if (topCompetitor) details += `Top local competitor: ${topCompetitor}. `;

  // Pick a random US state that isn't the lead's state for the flex
  const flexStates = ['Ohio', 'Texas', 'Florida', 'Colorado', 'Arizona', 'Georgia', 'North Carolina', 'Virginia', 'Pennsylvania', 'Tennessee'];
  const leadState = city.split(',').pop()?.trim() || '';
  const available = flexStates.filter(s => s.toLowerCase() !== leadState.toLowerCase());
  const flexState = available[Math.floor(Math.random() * available.length)] || 'Ohio';

  // Scale the flex number to be believable relative to their actual gap
  let flexAmount = '$80k';
  if (totalRange) {
    const numMatch = totalRange.match(/[\$£]?([\d.]+)/);
    if (numMatch) {
      const base = parseFloat(numMatch[0].replace(/[\$£]/g, ''));
      // Flex should be 1.5x-2.5x their number, rounded to nearest 10k
      const flexNum = Math.round((base * (1.5 + Math.random())) / 10) * 10;
      const currency = totalRange.includes('£') ? '£' : '$';
      flexAmount = `${currency}${flexNum}k`;
    }
  }

  const prompt = `Write a short LinkedIn DM to ${firstName} at ${firm}. They just accepted our connection request. You are from Mortar Metrics, we help law firms get more cases.

Context: ${details}

Report link (MUST include exactly as-is): ${reportUrl}

Structure (follow this closely):

1. "Hey [name], thanks for connecting."
2. One sentence flex: we helped a [same practice area] firm in [${flexState}] find about [${flexAmount}/mo] in cases they were losing to other firms online. Keep it matter-of-fact, not braggy.
3. One sentence: ran the same audit on yours and found a similar gap.
4. "Already built the whole breakdown for you:" then the report link on its own line.
5. CTA: "Want me to walk you through the fixes?" or similar. One sentence, makes replying "yes" feel effortless.

Rules:
- 5 sentences max. The whole thing should take 10 seconds to read.
- No em dashes. No exclamation marks. No bullets or lists.
- No marketing jargon: no "ROI", "revenue", "digital presence", "visibility", "optimize", "strategy", "leverage", "pipeline", "funnel".
- Frame it like we already did the work for free and we're doing them a favour.
- Sound like a person, not a company. Casual but confident.
- The flex must feel natural, not forced. Just stating what happened.
- Say "cases" not "revenue". Lawyers think in cases.
- Just output the DM text, nothing else.`;

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
      return buildConnectionDM(contactName, firmName, reportUrl, totalRange, practiceLabel);
    }

    const data = await resp.json();
    const body = (data.content?.[0]?.text || '').trim();

    // Sanity check: must contain the report URL
    if (!body || !body.includes(reportUrl)) {
      console.warn('AI DM missing report URL, using template');
      return buildConnectionDM(contactName, firmName, reportUrl, totalRange, practiceLabel);
    }

    return { body };
  } catch (e) {
    console.warn('AI DM generation error:', e.message);
    return buildConnectionDM(contactName, firmName, reportUrl, totalRange, practiceLabel);
  }
}

module.exports = { buildDM, buildConnectionDM, generateConnectionDM };
