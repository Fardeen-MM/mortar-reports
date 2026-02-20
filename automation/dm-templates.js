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

function buildConnectionDM(contactName, firmName, reportUrl, practiceLabel) {
  const firstName = (contactName || '').split(' ')[0] || 'there';
  const firm = firmName || 'your firm';

  let body;
  if (practiceLabel) {
    body = `Hey ${firstName} - thanks for connecting. Me and my team actually put together a quick breakdown of the ${practiceLabel} market in your area for ${firm}. Thought you might find it interesting: ${reportUrl}\n\nAre you guys doing any digital marketing right now or mostly word of mouth?`;
  } else {
    body = `Hey ${firstName} - thanks for connecting. Me and my team put together a quick market breakdown for ${firm} — thought you might find it interesting: ${reportUrl}\n\nAre you guys doing any digital marketing right now or mostly word of mouth?`;
  }

  return { body };
}

module.exports = { buildDM, buildConnectionDM };
