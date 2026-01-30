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
  
  const emailBody = `${opening}

I analyzed your website, your top competitors, and found some specific gaps that are costing you cases right now.

👉 Here's your personalized report:
${reportUrl}

What you'll see:
• Exact revenue gaps we found (with dollar amounts)
• What your top 3 competitors are doing in ${researchData.location?.city || 'your market'}
• Specific strategies to capture that revenue

Everything is tailored to ${firmName}—no generic advice.

The booking link is at the bottom if you want to discuss closing these gaps.

Best,
Fardeen
Mortar Metrics`;

  return {
    subject: 'Re: Your marketing analysis',
    body: emailBody
  };
}

function buildSimpleEmail(contactName, reportUrl) {
  const firstName = contactName.split(' ')[0];
  
  return {
    subject: 'Re: Your marketing analysis',
    body: `Perfect! I just finished putting together your analysis.

I analyzed your website, your competitors in your market, and found some specific gaps you can close.

👉 Here's your personalized report:
${reportUrl}

What you'll see:
• Exact revenue gaps we found (with dollar amounts)
• What your top 3 competitors are doing
• What we'd build for you to capture that revenue

Everything is specific to your firm and your market—no generic fluff.

The booking link is at the bottom of the report if you want to discuss any of this.

Best,
Fardeen
Mortar Metrics`
  };
}

module.exports = {
  buildPersonalizedEmail,
  buildSimpleEmail
};
