/**
 * Email Templates
 * Personalized with case count + revenue from report generator
 * Returns both plain text (for Telegram preview) and HTML (for actual email)
 */

function getDayName(dayNum) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum];
}

function getMeetingDays() {
  const now = new Date();
  const dayOfWeek = now.getDay();

  if (dayOfWeek >= 5 || dayOfWeek === 0) {
    // Friday, Saturday, Sunday
    return { day1: 'Monday', day2: 'Tuesday' };
  }
  // Monday-Thursday
  return { day1: 'tomorrow', day2: getDayName((dayOfWeek + 2) % 7) };
}

// Fix UTF-8 encoding issues from GitHub Actions env vars (e.g. Â£ -> £)
function cleanEncoding(str) {
  if (!str) return '';
  return str.replace(/Â£/g, '£').replace(/Â/g, '');
}

function buildEmail(contactName, firmName, reportUrl, totalRange, totalCases, practiceLabel, opener) {
  const { day1, day2 } = getMeetingDays();
  const firm = firmName || 'your firm';
  const firstName = (contactName || '').split(' ')[0] || 'there';
  const cleanRange = cleanEncoding(totalRange);
  const openingLine = opener || 'Appreciate you getting back to me.';

  let textBody, htmlBody;

  if (cleanRange && totalCases && practiceLabel) {
    // Personalized email with case count + revenue
    textBody = `Hey ${firstName},

${openingLine} We dug into the ${practiceLabel} market around ${firm} and honestly there's a lot of money being left on the table.

Right now about ${totalCases} ${practiceLabel} cases per month in your area are going to other firms. That's roughly ${cleanRange}/mo you could be pulling in.

Here's the full breakdown:
${reportUrl}

Happy to walk you through it. 15 minutes and I'll show you exactly how we'd get you these cases. Does ${day1} or ${day2} work?`;

    htmlBody = `<div>Hey ${firstName},</div>
<div><br /></div>
<div>${openingLine} We dug into the ${practiceLabel} market around ${firm} and honestly there's a lot of money being left on the table.</div>
<div><br /></div>
<div>Right now about ${totalCases} ${practiceLabel} cases per month in your area are going to other firms. That's roughly ${cleanRange}/mo you could be pulling in.</div>
<div><br /></div>
<div>Here's the full breakdown:</div>
<div><a href="${reportUrl}">${reportUrl}</a></div>
<div><br /></div>
<div>Happy to walk you through it. 15 minutes and I'll show you exactly how we'd get you these cases. Does ${day1} or ${day2} work?</div>`;
  } else {
    // Fallback when no numbers available
    textBody = `Hey ${firstName},

${openingLine} We dug into the market around ${firm} and found some real gaps worth looking at.

Here's the full breakdown:
${reportUrl}

Happy to walk you through it. 15 minutes and I'll show you exactly how we'd get you these cases. Does ${day1} or ${day2} work?`;

    htmlBody = `<div>Hey ${firstName},</div>
<div><br /></div>
<div>${openingLine} We dug into the market around ${firm} and found some real gaps worth looking at.</div>
<div><br /></div>
<div>Here's the full breakdown:</div>
<div><a href="${reportUrl}">${reportUrl}</a></div>
<div><br /></div>
<div>Happy to walk you through it. 15 minutes and I'll show you exactly how we'd get you these cases. Does ${day1} or ${day2} work?</div>`;
  }

  return {
    subject: 'Your marketing analysis',
    body: textBody,
    html: htmlBody
  };
}

module.exports = { buildEmail };
