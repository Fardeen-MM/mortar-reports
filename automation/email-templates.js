/**
 * Email Templates
 * Personalized with case count + revenue from report generator
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

function buildEmail(contactName, firmName, reportUrl, totalRange, totalCases, practiceLabel) {
  const { day1, day2 } = getMeetingDays();
  const firm = firmName || 'your firm';
  const firstName = (contactName || '').split(' ')[0] || 'there';

  // Fix UTF-8 encoding issues from GitHub Actions env vars (e.g. Â£ → £)
  const cleanRange = totalRange ? totalRange.replace(/Â£/g, '£').replace(/Â/g, '') : '';

  let body;

  if (cleanRange && totalCases && practiceLabel) {
    // Personalized email with case count + revenue
    body = `Hey ${firstName},

Glad you replied \u2014 our team saw a ton of potential when we looked at ${firm}.

There's about ${totalCases} ${practiceLabel} cases per month in your area going to other firms right now \u2014 that's roughly ${cleanRange}/mo. You're not far off from capturing those, it's just about closing the gap.

Here's the full report:
${reportUrl}

Happy to walk you through it if helpful. ${day1} or ${day2} work for a quick call?`;
  } else {
    // Fallback when no numbers available
    body = `Hey ${firstName},

Glad you replied \u2014 our team saw a ton of potential when we looked at ${firm}.

There are cases in your area going to other firms right now that should be going to you \u2014 and you're not far off from getting them.

Here's the full report:
${reportUrl}

Happy to walk you through it if helpful. ${day1} or ${day2} work for a quick call?`;
  }

  return {
    subject: 'Your marketing analysis',
    body
  };
}

module.exports = { buildEmail };
