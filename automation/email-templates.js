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
  // TEMPORARY: Correction email for Wenup (Toby) — revert after sending
  const liveReportUrl = 'https://reports.mortarmetrics.com/Wenup/';

  const textBody = `Hey Toby,

Apologies \u2014 a glitch in our competitor analysis system pulled the wrong data into your report earlier. Here's the corrected version:

There's about 4-8 family law cases per month in your area going to other firms right now \u2014 that's roughly \u00a320.5K-35.5K/mo. You're not far off from capturing those, it's just about closing the gap.

Here's the updated report:
${liveReportUrl}

Happy to walk you through it if helpful. Tomorrow or Wednesday work for a quick call?`;

  const htmlBody = `<div>Hey Toby,</div>
<div><br /></div>
<div>Apologies \u2014 a glitch in our competitor analysis system pulled the wrong data into your report earlier. Here's the corrected version:</div>
<div><br /></div>
<div>There's about 4-8 family law cases per month in your area going to other firms right now \u2014 that's roughly \u00a320.5K-35.5K/mo. You're not far off from capturing those, it's just about closing the gap.</div>
<div><br /></div>
<div>Here's the updated report:</div>
<div><a href="${liveReportUrl}">${liveReportUrl}</a></div>
<div><br /></div>
<div>Happy to walk you through it if helpful. Tomorrow or Wednesday work for a quick call?</div>`;

  return {
    subject: 'Your marketing analysis',
    body: textBody,
    html: htmlBody
  };
}

module.exports = { buildEmail };
