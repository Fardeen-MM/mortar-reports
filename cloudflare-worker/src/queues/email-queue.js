/**
 * Queued email infrastructure: store email in KV + Telegram approval buttons.
 */

import { sendTelegramMsg } from '../telegram/api.js';

export async function queueEmail(env, { type, to, subject, html, text, lead_email, firm_name, contact_name, context }) {
  const queueId = crypto.randomUUID();

  await env.WEBHOOK_KV.put(`queued_email:${queueId}`, JSON.stringify({
    type, to, subject, html, text, lead_email, firm_name, contact_name, context,
    queued_at: new Date().toISOString()
  }), { expirationTtl: 86400 });

  const typeHeaders = {
    'follow-up': '\ud83d\udc40 VIEW FOLLOW-UP',
    'auto-reply': '\ud83e\udd16 AUTO-REPLY',
    'nurture': '\ud83d\udcec NURTURE EMAIL',
    'ooo-welcome-back': '\u2708\ufe0f OOO WELCOME BACK'
  };
  const header = typeHeaders[type] || '\ud83d\udce7 QUEUED EMAIL';

  const preview = (text || '').slice(0, 2000).replace(/`/g, "'");
  const esc = s => (s || '').replace(/([_*`\[\]])/g, '');

  let contextBlock = '';
  if (context) {
    contextBlock = `\u2139\ufe0f *Context:* ${esc(context)}`;
  }

  const msg = `${header}

\ud83d\udcca *Firm:* ${esc(firm_name) || 'Unknown'}
\ud83d\udc64 *To:* ${esc(contact_name) || to}
\ud83d\udce7 *Email:* ${to}
\ud83d\udcdd *Subject:* ${esc(subject)}
${contextBlock}

*Our Reply:*
\`\`\`
${preview}
\`\`\``;

  const result = await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, msg, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '\u2705 Approve & Send', callback_data: `approve_queued:${queueId}` },
          { text: '\u270f\ufe0f Edit', callback_data: `edit_queued:${queueId}` },
          { text: '\u23ed\ufe0f Skip', callback_data: `skip_queued:${queueId}` }
        ]
      ]
    }
  });

  if (!result.ok) {
    console.error('Telegram send failed for queued email:', result.description || JSON.stringify(result));
  }

  return { ok: true, queue_id: queueId };
}
