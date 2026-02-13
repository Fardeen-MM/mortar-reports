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
    // Personalized email with case study proof
    textBody = `Hey ${firstName},

${openingLine} We ran the numbers and there's ${cleanRange}/mo in ${practiceLabel} cases you're not getting right now.

Mandall Law was in a similar spot — we plugged in and they signed $92K in new cases their first month.

Here's your full breakdown:
${reportUrl}

15 minutes and I'll walk you through it. Does ${day1} or ${day2} work?`;

    htmlBody = `<div>Hey ${firstName},</div>
<div><br /></div>
<div>${openingLine} We ran the numbers and there's ${cleanRange}/mo in ${practiceLabel} cases you're not getting right now.</div>
<div><br /></div>
<div>Mandall Law was in a similar spot — we plugged in and they signed $92K in new cases their first month.</div>
<div><br /></div>
<div>Here's your full breakdown:</div>
<div><a href="${reportUrl}">${reportUrl}</a></div>
<div><br /></div>
<div>15 minutes and I'll walk you through it. Does ${day1} or ${day2} work?</div>`;
  } else {
    // Fallback with case study proof
    textBody = `Hey ${firstName},

${openingLine} We ran the numbers and found some serious gaps — other firms in your area are getting cases that should be yours.

Mandall Law was in a similar spot — we plugged in and they signed $92K in new cases their first month.

Here's your full breakdown:
${reportUrl}

15 minutes and I'll walk you through it. Does ${day1} or ${day2} work?`;

    htmlBody = `<div>Hey ${firstName},</div>
<div><br /></div>
<div>${openingLine} We ran the numbers and found some serious gaps — other firms in your area are getting cases that should be yours.</div>
<div><br /></div>
<div>Mandall Law was in a similar spot — we plugged in and they signed $92K in new cases their first month.</div>
<div><br /></div>
<div>Here's your full breakdown:</div>
<div><a href="${reportUrl}">${reportUrl}</a></div>
<div><br /></div>
<div>15 minutes and I'll walk you through it. Does ${day1} or ${day2} work?</div>`;
  }

  return {
    subject: 'Your marketing analysis',
    body: textBody,
    html: htmlBody
  };
}

module.exports = { buildEmail };
