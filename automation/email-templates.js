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

  let body;

  if (totalRange && totalCases && practiceLabel) {
    // Personalized email with case count + revenue
    body = `Perfect \u2014 here's what we found for ${firm}.

We identified around ${totalCases} ${practiceLabel} cases every month that aren't reaching your firm right now. That's roughly ${totalRange}/month you're leaving on the table.

We broke down where they're going instead and what to do about it:
${reportUrl}

Are you free ${day1} or ${day2} for 15 minutes? We can walk you through exactly how we'd get you those cases.

{{accountSignature}}`;
  } else {
    // Fallback when no numbers available
    body = `Perfect \u2014 here's what we found for ${firm}.

We looked at who's showing up in your market and found cases that should be going to your firm but aren't. We broke down the numbers:
${reportUrl}

Are you free ${day1} or ${day2} for 15 minutes? We can walk you through exactly how we'd close those gaps.

{{accountSignature}}`;
  }

  return {
    subject: 'Your marketing analysis',
    body
  };
}

module.exports = { buildEmail };
