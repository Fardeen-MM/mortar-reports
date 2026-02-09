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

// Fix UTF-8 encoding issues from GitHub Actions env vars (e.g. Â£ → £)
function cleanEncoding(str) {
  if (!str) return '';
  return str.replace(/Â£/g, '£').replace(/Â/g, '');
}

function buildEmail(contactName, firmName, reportUrl, totalRange, totalCases, practiceLabel) {
  const { day1, day2 } = getMeetingDays();
  const firm = firmName || 'your firm';
  const firstName = (contactName || '').split(' ')[0] || 'there';
  const cleanRange = cleanEncoding(totalRange);

  let textBody, htmlBody;

  if (cleanRange && totalCases && practiceLabel) {
    // Personalized email with case count + revenue
    textBody = `Hey ${firstName},

Glad you replied \u2014 our team saw a ton of potential when we looked at ${firm}.

There's about ${totalCases} ${practiceLabel} cases per month in your area going to other firms right now \u2014 that's roughly ${cleanRange}/mo. You're not far off from capturing those, it's just about closing the gap.

Here's the full report:
${reportUrl}

Happy to walk you through it if helpful. ${day1} or ${day2} work for a quick call?`;

    htmlBody = `<div>Hey ${firstName},</div>
<div><br /></div>
<div>Glad you replied \u2014 our team saw a ton of potential when we looked at ${firm}.</div>
<div><br /></div>
<div>There's about ${totalCases} ${practiceLabel} cases per month in your area going to other firms right now \u2014 that's roughly ${cleanRange}/mo. You're not far off from capturing those, it's just about closing the gap.</div>
<div><br /></div>
<div>Here's the full report:</div>
<div><a href="${reportUrl}">${reportUrl}</a></div>
<div><br /></div>
<div>Happy to walk you through it if helpful. ${day1} or ${day2} work for a quick call?</div>`;
  } else {
    // Fallback when no numbers available
    textBody = `Hey ${firstName},

Glad you replied \u2014 our team saw a ton of potential when we looked at ${firm}.

There are cases in your area going to other firms right now that should be going to you \u2014 and you're not far off from getting them.

Here's the full report:
${reportUrl}

Happy to walk you through it if helpful. ${day1} or ${day2} work for a quick call?`;

    htmlBody = `<div>Hey ${firstName},</div>
<div><br /></div>
<div>Glad you replied \u2014 our team saw a ton of potential when we looked at ${firm}.</div>
<div><br /></div>
<div>There are cases in your area going to other firms right now that should be going to you \u2014 and you're not far off from getting them.</div>
<div><br /></div>
<div>Here's the full report:</div>
<div><a href="${reportUrl}">${reportUrl}</a></div>
<div><br /></div>
<div>Happy to walk you through it if helpful. ${day1} or ${day2} work for a quick call?</div>`;
  }

  return {
    subject: 'Your marketing analysis',
    body: textBody,
    html: htmlBody
  };
}

module.exports = { buildEmail };
