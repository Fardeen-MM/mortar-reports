/**
 * Quick reply system: fast website research + personalized AI replies.
 * Not hardcoded to law firms — AI figures out what the business does.
 */

import { callHaiku } from './classify.js';

export async function quickResearch(websiteUrl, company, anthropicKey) {
  const context = { practiceAreas: '', firmType: '', location: '', summary: '' };
  if (!websiteUrl) return context;

  let url = websiteUrl;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MortarBot/1.0)' },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow'
    });
    if (!resp.ok) return context;
    const html = await resp.text();

    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 4000);

    if (!text || text.length < 50) return context;

    const extraction = await callHaiku(anthropicKey,
      'Extract firm details from website text. Return a short JSON object only, no other text.',
      `Website text from ${company || 'a firm'}:\n\n${text}\n\nReturn JSON: {"practice_areas":"comma-separated list","firm_type":"law firm/agency/consultancy/etc","city":"city if found","one_liner":"one sentence what this firm does"}`,
      200
    );

    const jsonMatch = extraction.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      context.practiceAreas = parsed.practice_areas || '';
      context.firmType = parsed.firm_type || '';
      context.location = parsed.city || '';
      context.summary = parsed.one_liner || '';
    }
  } catch (e) {
    console.log(`Quick research failed for ${websiteUrl}: ${e.message}`);
  }
  return context;
}

export async function generateQuickReply(category, replyText, firmName, contactName, anthropicKey, opts = {}) {
  const { research = {}, jobTitle = '', location = '' } = opts;

  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  let meetDay;
  if (dayOfWeek >= 5 || dayOfWeek === 0) {
    meetDay = 'Monday';
  } else {
    meetDay = 'tomorrow';
  }

  const firstName = contactName || '';
  const firm = firmName || 'your firm';
  const reply = (replyText || '').slice(0, 500);

  let aboutBusiness = '';
  if (research.summary) aboutBusiness += `\nABOUT THEIR BUSINESS: ${research.summary}`;
  if (research.practiceAreas) aboutBusiness += `\nWHAT THEY DO: ${research.practiceAreas}`;
  if (location) aboutBusiness += `\nLOCATION: ${location}`;

  const systemPrompt = `You're Fardeen from Mortar Metrics. We're a marketing agency that helps businesses get more clients.

A lead replied to our cold email. Write a short reply that gets them on a call.

Here's what we actually do: we build and manage their entire marketing \u2014 ads, website, funnels, intake \u2014 so new clients are booking directly on their calendar. They don't do anything differently. We handle everything.

Rules:
- Start with "Hey ${firstName}," on its own line.
- If they asked a question, answer it directly in 1-2 sentences. Reference what their business actually does if you know it.
- If they said they're interested, match their energy. Don't over-explain.
- If they pushed back, acknowledge it genuinely, then pivot to the call.
- End with a specific call ask: "Easiest way is a quick chat. Are you free ${meetDay} for 15 minutes?"
- 3-4 sentences max. Sound like a real person texting a colleague.
- No exclamation marks. No marketing speak. No em dashes.
- No sign-off or signature (the email system adds that).`;

  const titleLine = jobTitle ? `, ${jobTitle}` : '';
  const userPrompt = `LEAD: ${firstName}${titleLine} from ${firm}
THEIR REPLY: "${reply}"
AI CLASSIFICATION: ${category}${aboutBusiness}`;

  try {
    return await callHaiku(anthropicKey, systemPrompt, userPrompt, 300);
  } catch (e) {
    console.error('Quick reply generation failed:', e.message);
    return null;
  }
}
