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

/**
 * Build the 6-message connection DM sequence.
 * Returns { messages: string[] } — each element is a separate LinkedIn DM.
 */
function buildConnectionDM(contactName, firmName, reportUrl, totalRange, practiceLabel) {
  const firstName = (contactName || '').split(' ')[0] || 'there';
  const firm = firmName || 'your firm';

  // Pick a random US state for the flex
  const flexStates = ['Ohio', 'Texas', 'Florida', 'Colorado', 'Arizona', 'Georgia', 'North Carolina', 'Virginia', 'Pennsylvania', 'Tennessee'];
  const flexState = flexStates[Math.floor(Math.random() * flexStates.length)] || 'Ohio';

  // Scale the flex number to be believable relative to their actual gap
  let flexAmount = '$80k';
  if (totalRange) {
    const numMatch = totalRange.match(/[\$£]?([\d.]+)/);
    if (numMatch) {
      const base = parseFloat(numMatch[0].replace(/[\$£]/g, ''));
      const flexNum = Math.round((base * (1.5 + Math.random())) / 10) * 10;
      const currency = totalRange.includes('£') ? '£' : '$';
      flexAmount = `${currency}${flexNum}k`;
    }
  }

  const messages = [
    `Hey ${firstName} appreciate the connect`,
    `I know you get these all the time so I'll be straight to the point. Are you more client-facing at ${firm}, or do you also oversee intake/follow-up on new inquiries?`,
    `The reason why I'm asking is because we helped a ${practiceLabel || 'legal'} firm in ${flexState} find about ${flexAmount}/mo in cases they were losing to other firms online`,
    `I had my team run the same audit on ${firm} and found a similar gap`,
    `We already built the whole report for you: ${reportUrl}`,
    `Want me to walk you through how to close the gap?`
  ];

  return { messages };
}

/**
 * Generate a personalized 6-message connection DM sequence.
 * No AI needed — uses the proven template with dynamic values.
 * Returns { messages: string[] }
 */
async function generateConnectionDM(apiKey, contactName, firmName, reportUrl, context) {
  const practiceLabel = context.practiceLabel || '';
  const totalRange = context.totalRange || '';
  return buildConnectionDM(contactName, firmName, reportUrl, totalRange, practiceLabel);
}

/**
 * Strip em/en dashes from any DM text to prevent encoding artifacts on LinkedIn.
 */
function cleanDM(text) {
  return text
    .replace(/\u2014/g, ', ')
    .replace(/\u2013/g, ', ')
    .replace(/ - /g, ', ');
}

module.exports = { buildDM, buildConnectionDM, generateConnectionDM, cleanDM };
