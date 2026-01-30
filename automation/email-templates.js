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
  let opening = `Perfect! I just finished analyzing ${firmName}.`;
  
  if (recentNews) {
    opening = `Perfect! I saw you just ${recentNews.toLowerCase()}—congrats on that. I finished analyzing ${firmName} and found some specific opportunities.`;
  } else if (growthSignal) {
    opening = `Perfect! I noticed you're ${growthSignal.toLowerCase()}. I finished analyzing ${firmName} and found some revenue gaps you can close while scaling.`;
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

I analyzed your website, your top competitors, and found some specific gaps that are costing you cases right now.

What I found:
• Exact revenue gaps (with dollar amounts)
• What your top 3 competitors are doing in ${researchData.location?.city || 'your market'}
• Specific strategies to capture that revenue

Everything is tailored to ${firmName}—no generic advice.

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
    body: `Perfect! I just finished putting together your analysis.

I analyzed your website, your competitors in your market, and found some specific gaps you can close.

What you'll see:
• Exact revenue gaps we found (with dollar amounts)
• What your top 3 competitors are doing
• What we'd build for you to capture that revenue

Everything is specific to your firm and your market—no generic fluff.

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
