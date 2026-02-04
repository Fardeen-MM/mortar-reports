/**
 * Email Templates
 * Personalized based on AI research data
 */

function buildPersonalizedEmail(researchData, contactName, reportUrl) {
  const firstName = contactName.split(' ')[0];
  const firmName = researchData.firmName || 'your firm';
  
  // Extract key insights from AI research
  const firmSize = researchData.firmIntel?.firmSize?.estimate || 'mid-size';
  const keySpecialty = researchData.firmIntel?.keySpecialties?.[0] || 'legal services';
  const recentNews = researchData.firmIntel?.recentNews?.[0];
  const growthSignal = researchData.firmIntel?.growthSignals?.[0];
  
  // Build personalized opening
  let opening = `Perfect! Our team put together an analysis for ${firmName}.`;

  if (recentNews) {
    opening = `Perfect! We saw you recently ${recentNews.toLowerCase()} - congrats on that. Our team put together an analysis for ${firmName} and found some specific opportunities.`;
  } else if (growthSignal) {
    opening = `Perfect! We noticed you're ${growthSignal.toLowerCase()}. Our team put together an analysis for ${firmName} that highlights some revenue gaps you can close while scaling.`;
  }
  
  // Calculate next available weekday
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  let meetingDay1, meetingDay2;
  
  if (dayOfWeek === 5) { // Friday
    meetingDay1 = 'Monday';
    meetingDay2 = 'Tuesday';
  } else if (dayOfWeek === 6) { // Saturday
    meetingDay1 = 'Monday';
    meetingDay2 = 'Tuesday';
  } else if (dayOfWeek === 0) { // Sunday
    meetingDay1 = 'Monday';
    meetingDay2 = 'Tuesday';
  } else { // Monday-Thursday
    meetingDay1 = 'tomorrow';
    meetingDay2 = getDayName((dayOfWeek + 2) % 7);
  }
  
  const emailBody = `${opening}

We looked at who's showing up in your market and found some specific gaps that are costing you cases right now.

What you'll see:
- Revenue gaps with estimated dollar amounts
- Who's advertising in ${researchData.location?.city || 'your market'}
- A concrete plan to capture that revenue

Here's your report:
${reportUrl}

Are you available ${meetingDay1} or ${meetingDay2} for a quick 15-minute call to walk through the biggest opportunities?

{{accountSignature}}`;

  return {
    subject: 'Your marketing analysis', // Only used if starting new thread (not replying)
    body: emailBody
  };
}

// Helper function to get day name
function getDayName(dayNum) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum];
}

function buildSimpleEmail(contactName, reportUrl) {
  const firstName = contactName.split(' ')[0];
  
  // Calculate next available weekday
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  let meetingDay1, meetingDay2;
  
  if (dayOfWeek === 5) { // Friday
    meetingDay1 = 'Monday';
    meetingDay2 = 'Tuesday';
  } else if (dayOfWeek === 6) { // Saturday
    meetingDay1 = 'Monday';
    meetingDay2 = 'Tuesday';
  } else if (dayOfWeek === 0) { // Sunday
    meetingDay1 = 'Monday';
    meetingDay2 = 'Tuesday';
  } else { // Monday-Thursday
    meetingDay1 = 'tomorrow';
    meetingDay2 = getDayName((dayOfWeek + 2) % 7);
  }
  
  return {
    subject: 'Your marketing analysis', // Only used if starting new thread (not replying)
    body: `Perfect! Our team put together your analysis.

We looked at your website and who's showing up in your market, and found some specific gaps you can close.

What you'll see:
- Revenue gaps with estimated dollar amounts
- Who's advertising in your market
- A concrete plan to capture that revenue

Here's your report:
${reportUrl}

Are you available ${meetingDay1} or ${meetingDay2} for a quick 15-minute call to walk through the biggest opportunities?

{{accountSignature}}`
  };
}

module.exports = {
  buildPersonalizedEmail,
  buildSimpleEmail
};
