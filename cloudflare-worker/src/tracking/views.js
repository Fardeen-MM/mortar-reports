/**
 * Report view tracking + follow-up triggers.
 */

import { sendTelegramMsg } from '../telegram/api.js';
import { queueEmail } from '../queues/email-queue.js';

export async function handleViewTrack(env, body) {
  const { email, firm, ts } = body;
  if (!firm) return { ok: false, error: 'missing firm' };

  const lastView = await env.WEBHOOK_KV.get(`view_last:${firm}`);
  if (lastView) {
    const elapsed = Date.now() - parseInt(lastView, 10);
    if (elapsed < 300000) {
      return { ok: true, message: 'rate limited' };
    }
  }

  await env.WEBHOOK_KV.put(`view_last:${firm}`, String(Date.now()), { expirationTtl: 600 });

  const countRaw = await env.WEBHOOK_KV.get(`views:${firm}`);
  const count = (parseInt(countRaw, 10) || 0) + 1;
  await env.WEBHOOK_KV.put(`views:${firm}`, String(count));

  console.log(`View tracked for ${firm}: view #${count}`);

  const leadRaw = await env.WEBHOOK_KV.get(`lead:${firm}`);
  const lead = leadRaw ? JSON.parse(leadRaw) : null;

  if (count === 1 && lead) {
    const followUpText = `Hi ${lead.contact_name || 'there'},

Just noticed you had a chance to look at the report we put together for ${lead.firm_name || 'your firm'}.

Happy to walk through any of the numbers \u2014 the competitor data and the gap estimates are the parts most firms find most useful.

No pitch, just context. Let me know if you want 15 minutes this week.`;

    await queueEmail(env, {
      type: 'follow-up',
      to: lead.email,
      subject: 'Re: Your marketing analysis',
      html: followUpText.replace(/\n/g, '<br>'),
      text: followUpText,
      lead_email: lead.email,
      firm_name: lead.firm_name,
      contact_name: lead.contact_name,
      context: `First report view detected`
    });
  } else if ((count === 3 || count === 5 || count === 10) && lead) {
    const emoji = count >= 10 ? '\ud83d\udd25\ud83d\udd25\ud83d\udd25' : count >= 5 ? '\ud83d\udd25\ud83d\udd25' : '\ud83d\udd25';
    const msg = `${emoji} *HOT LEAD ALERT*

\ud83d\udcca *Firm:* ${lead.firm_name || firm}
\ud83d\udc64 *Contact:* ${lead.contact_name || 'Unknown'}
\ud83d\udce7 *Email:* ${lead.email || 'Unknown'}
\ud83d\udc41\ufe0f *Report views:* ${count}

This lead keeps coming back to their report. Consider reaching out.`;

    await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, msg);
  }

  return { ok: true, views: count };
}
