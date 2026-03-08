/**
 * Queued DM infrastructure: store LinkedIn DM in KV + Telegram approval buttons.
 */

import { sendTelegramMsg } from '../telegram/api.js';

export async function queueDM(env, { type, linkedin_url, sender, message, contact_name, firm_name, context }) {
  const queueId = crypto.randomUUID();

  await env.WEBHOOK_KV.put(`queued_dm:${queueId}`, JSON.stringify({
    type, linkedin_url, sender, message, contact_name, firm_name, context,
    queued_at: new Date().toISOString()
  }), { expirationTtl: 86400 });

  const typeHeaders = {
    'auto-reply': '\ud83e\udd16 LINKEDIN AUTO-REPLY',
    'nurture': '\ud83d\udcac NURTURE DM',
    'ooo-welcome-back': '\u2708\ufe0f OOO WELCOME BACK DM'
  };
  const header = typeHeaders[type] || '\ud83d\udcac LINKEDIN DM';

  const preview = (message || '').slice(0, 2000).replace(/`/g, "'");
  const esc = s => (s || '').replace(/([_*`\[\]])/g, '');

  const msg = `${header}

\ud83d\udcca *Firm:* ${esc(firm_name) || 'Unknown'}
\ud83d\udc64 *To:* ${esc(contact_name) || 'Lead'}
\ud83d\udd17 *LinkedIn:* ${esc(linkedin_url)}
${context ? `\u2139\ufe0f *Context:* ${esc(context)}` : ''}

\`\`\`
${preview}
\`\`\``;

  const result = await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, msg, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '\u2705 Approve & Send DM', callback_data: `approve_dm:${queueId}` },
          { text: '\u270f\ufe0f Edit', callback_data: `edit_dm:${queueId}` },
          { text: '\u23ed\ufe0f Skip', callback_data: `skip_dm:${queueId}` }
        ]
      ]
    }
  });

  if (!result.ok) {
    console.error('Telegram send failed for queued DM:', result.description || JSON.stringify(result));
  }

  return { ok: true, queue_id: queueId };
}
