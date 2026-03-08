/**
 * Auto-response generation for nurture/report pipeline replies.
 */

import { callHaiku } from './classify.js';

export async function generateAutoResponse(category, replyText, firmName, contactName, anthropicKey, pipelineContext) {
  const ctx = pipelineContext || {};
  const systemPrompt = `You are Fardeen from Mortar Metrics. We help law firms find untapped revenue in their local market \u2014 we build data-driven market breakdowns that show exactly how many cases their area supports vs what they're currently getting, then we run the marketing (Google Ads, Meta Ads, intake systems) to close that gap.

You're a confident, sharp salesman who genuinely cares about helping firms grow. You write short, conversational emails. No marketing speak. No exclamation marks. No em dashes. Sound like a real person texting a colleague. Never include a sign-off or signature at the end.${(category !== 'NOT_INTERESTED' && category !== 'UNSUBSCRIBE') ? ' Every reply should move toward booking a 15-minute call.' : ''}`;

  const lead = contactName || 'the partner';
  const firm = firmName || 'a law firm';
  const reply = replyText.slice(0, 500);

  let situation = '';
  if (ctx.isNurtureLead) {
    situation = `This is an ENGAGED lead who was originally interested. They received a personalized marketing report for their firm and ${ctx.emailsSent ? ctx.emailsSent + ' nurture emails' : 'follow-up emails'} from us. They are replying to one of those emails. This is NOT a cold rejection \u2014 they've been reading our emails.`;
  } else if (ctx.hasReport) {
    situation = `This lead was originally interested and already received a personalized marketing report. They are replying after seeing the report. This is NOT a cold rejection.`;
  } else {
    situation = `This lead replied to our outreach email where we mentioned we ran the numbers on their market and found a gap in cases they could be getting. We're building them a personalized market breakdown. They haven't seen it yet \u2014 it's being generated now.`;
  }

  let guidelines;
  if (category === 'UNSUBSCRIBE') {
    guidelines = `Write a very short reply (1-2 sentences). This person wants off the list. Fully respect that.

Guidelines:
- Acknowledge briefly. "Understood" or "Got it, no worries."
- Mention we already put together a breakdown for their firm before hearing back. Drop a line like "it's sitting there if you ever want a look" but don't push it.
- No CTA. No meeting ask. Just warm and respectful.
- If they were aggressive, be extra brief and professional.`;
  } else if (category === 'NOT_INTERESTED') {
    guidelines = `Write a short reply (2-3 sentences). This person said no. Respect that \u2014 but leave a compelling door open.

Guidelines:
- Acknowledge their response genuinely. Keep it real, not corporate.
- Don't hard-sell or try to change their mind.
- Mention we're putting together a quick breakdown of their market anyway (free, no strings) and we'll send it over in case they ever want to take a look.
- End with something like "if the numbers catch your eye, happy to walk through them on a quick call" \u2014 soft, zero-pressure CTA.
- Sound warm, direct, human. 2-3 sentences max.`;
  } else if (category === 'OOO') {
    guidelines = `Write a short, casual reply (1-2 sentences). They're out of office.

Guidelines:
- Keep it light and friendly. Something like "No rush at all" or "enjoy the time off."
- Mention we'll have something ready for them when they're back.
- No meeting ask. No pitch. Just warm and human.`;
  } else {
    guidelines = `Write a short reply (2-5 sentences). Read their message carefully and respond like a sharp, confident salesman. Your goal is to get them on a 15-minute call to walk through their numbers.

Guidelines:
- Genuinely acknowledge what they said first \u2014 show you actually read it
- Reference specific things about their market or practice area if you have the info
- Be confident in the results we deliver. We've helped firms in similar markets and similar positions
- If they raise concerns about their market size, costs, or competition \u2014 reframe it. Less competition = easier to dominate. Small market = lower ad costs = better ROI
- If they ask a question, answer it directly and specifically, then pivot: "happy to walk through the full breakdown \u2014 does tomorrow or Friday work for a quick 15?"
- If they're positive/interested, match their energy and make booking the obvious next step: "love it \u2014 let's jump on a quick call this week. Tomorrow or Thursday work?"
- Always end with a specific meeting ask. Suggest 2 days. Make it easy and low-commitment ("15 minutes, I'll share my screen and walk you through it")
- Sound warm, direct, and human. Short sentences. No fluff.`;
  }

  const userPrompt = `SITUATION: ${situation}

LEAD: ${lead} from ${firm}
${ctx.city ? `MARKET: ${ctx.city}` : ''}${ctx.practiceLabel ? `\nPRACTICE: ${ctx.practiceLabel}` : ''}${ctx.reportUrl ? `\nREPORT: ${ctx.reportUrl}` : ''}${ctx.campaignName ? `\nCAMPAIGN: ${ctx.campaignName}` : ''}${ctx.jobTitle ? `\nTITLE: ${ctx.jobTitle}` : ''}
AI CLASSIFICATION: ${category}

THEIR REPLY:
"${reply}"

${guidelines}`;

  try {
    return await callHaiku(anthropicKey, systemPrompt, userPrompt, 400);
  } catch (e) {
    console.error('Auto-response generation failed:', e.message);
    return null;
  }
}
