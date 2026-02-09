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
    body = `Hey {{firstName}},

Really glad you replied \u2014 we just finished putting this together for ${firm}.

Short version: we found ~${totalCases} ${practiceLabel} cases per month in your area that aren't reaching you right now. That's around ${totalRange}/mo.

Here's the full breakdown \u2014 takes about 2 min to read:
${reportUrl}

Happy to walk you through it if helpful. ${day1} or ${day2} work for a quick call?

{{accountSignature}}`;
  } else {
    // Fallback when no numbers available
    body = `Hey {{firstName}},

Really glad you replied \u2014 we just finished putting this together for ${firm}.

We looked at your market and found cases that should be going to you but aren't. Broke down the numbers and where they're ending up instead.

Here's the full breakdown \u2014 takes about 2 min to read:
${reportUrl}

Happy to walk you through it if helpful. ${day1} or ${day2} work for a quick call?

{{accountSignature}}`;
  }

  return {
    subject: 'Your marketing analysis',
    body
  };
}

module.exports = { buildEmail };
