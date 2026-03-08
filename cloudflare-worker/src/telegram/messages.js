import { sendTelegramMsg, sendTelegramReply } from './api.js';
import { forwardToGitHub } from '../github.js';

// ============ TELEGRAM /build COMMAND ============

export function parseBuildCommand(text) {
  // Remove /build prefix and split remaining tokens
  const tokens = text.replace(/^\/build\s*/, '').trim().split(/\s+/).filter(Boolean);
  let email = '';
  let website = '';
  const nameParts = [];

  for (const token of tokens) {
    if (token.includes('@')) {
      email = token;
    } else if (/^https?:\/\//i.test(token)) {
      website = token;
    } else if (/^[a-z0-9-]+\.[a-z]{2,}$/i.test(token)) {
      // Bare domain like smithlaw.com
      website = `https://${token}`;
    } else {
      nameParts.push(token);
    }
  }

  return {
    email,
    website,
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || ''
  };
}

export async function handleTelegramMessage(env, payload) {
  const message = payload.message;
  const chatId = String(message.chat.id);
  const messageId = message.message_id;
  const text = (message.text || '').trim();

  // Security: only allow messages from the authorized chat
  if (chatId !== String(env.TELEGRAM_CHAT_ID)) {
    console.log(`Ignoring message from unauthorized chat ${chatId}`);
    return { ok: true };
  }

  // Check if this is a reply to a queued email edit prompt
  if (message.reply_to_message) {
    const replyToId = message.reply_to_message.message_id;

    // Check for queued email edit first
    const queuedEditRaw = await env.WEBHOOK_KV.get(`edit_queued_reply:${replyToId}`);
    if (queuedEditRaw) {
      const { queueId, originalMessageId } = JSON.parse(queuedEditRaw);
      const customText = text.trim();

      if (!customText) {
        await sendTelegramReply(env, chatId, messageId, '⚠️ Empty reply. Please try again.');
        return { ok: true };
      }

      // Store custom text
      await env.WEBHOOK_KV.put(`custom_queued:${queueId}`, customText, { expirationTtl: 3600 });
      await env.WEBHOOK_KV.delete(`edit_queued_reply:${replyToId}`);

      const preview = customText.length > 300 ? customText.slice(0, 300) + '...' : customText;
      const queuedRaw = await env.WEBHOOK_KV.get(`queued_email:${queueId}`);
      const queued = queuedRaw ? JSON.parse(queuedRaw) : {};

      await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, chatId,
        `📧 *Custom email preview:*\n\n\`\`\`\n${preview}\n\`\`\`\n\nSend this to *${queued.to || 'lead'}*?`,
        {
          reply_to_message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Send Now', callback_data: `send_queued_custom:${queueId}` },
                { text: '❌ Cancel', callback_data: `cancel_queued_edit:${queueId}` }
              ]
            ]
          }
        }
      );

      return { ok: true };
    }

    // Check for queued DM edit prompt
    const dmEditRaw = await env.WEBHOOK_KV.get(`edit_dm_reply:${replyToId}`);
    if (dmEditRaw) {
      const { queueId, originalMessageId } = JSON.parse(dmEditRaw);
      const customText = text.trim();

      if (!customText) {
        await sendTelegramReply(env, chatId, messageId, '\u26a0\ufe0f Empty reply. Please try again.');
        return { ok: true };
      }

      await env.WEBHOOK_KV.put(`custom_dm:${queueId}`, customText, { expirationTtl: 3600 });
      await env.WEBHOOK_KV.delete(`edit_dm_reply:${replyToId}`);

      const preview = customText.length > 300 ? customText.slice(0, 300) + '...' : customText;
      const dmRaw = await env.WEBHOOK_KV.get(`queued_dm:${queueId}`);
      const dm = dmRaw ? JSON.parse(dmRaw) : {};

      await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, chatId,
        `\ud83d\udcac *Custom DM preview:*\n\n\`\`\`\n${preview}\n\`\`\`\n\nSend this DM to *${dm.linkedin_url || 'lead'}*?`,
        {
          reply_to_message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '\u2705 Send Now', callback_data: `send_dm_custom:${queueId}` },
                { text: '\u274c Cancel', callback_data: `cancel_dm_edit:${queueId}` }
              ]
            ]
          }
        }
      );

      return { ok: true };
    }

    // Check for nurture DM reply edit prompt
    const nrdEditRaw = await env.WEBHOOK_KV.get(`edit_nrd_reply:${replyToId}`);
    if (nrdEditRaw) {
      const { queueId } = JSON.parse(nrdEditRaw);
      const customText = text.trim();

      if (!customText) {
        await sendTelegramReply(env, chatId, messageId, '\u26a0\ufe0f Empty reply. Please try again.');
        return { ok: true };
      }

      await env.WEBHOOK_KV.put(`custom_nrd:${queueId}`, customText, { expirationTtl: 3600 });
      await env.WEBHOOK_KV.delete(`edit_nrd_reply:${replyToId}`);

      const nrRaw = await env.WEBHOOK_KV.get(`nurture_reply:${queueId}`);
      const nr = nrRaw ? JSON.parse(nrRaw) : {};
      const preview = customText.length > 300 ? customText.slice(0, 300) + '...' : customText;

      await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, chatId,
        `\ud83d\udcac *Custom nurture DM reply preview:*\n\n\`\`\`\n${preview}\n\`\`\`\n\nSend this DM to *${nr.linkedin_url || 'lead'}*?`,
        {
          reply_to_message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '\u2705 Send + Stop', callback_data: `nrd_send_custom_stop:${queueId}` },
                { text: '\u2705 Send + Continue', callback_data: `nrd_send_custom_cont:${queueId}` }
              ],
              [
                { text: '\u274c Cancel', callback_data: `nrd_cancel_edit:${queueId}` }
              ]
            ]
          }
        }
      );

      return { ok: true };
    }

    // Check for nurture reply edit prompt
    const nrEditRaw = await env.WEBHOOK_KV.get(`edit_nr_reply:${replyToId}`);
    if (nrEditRaw) {
      const { queueId } = JSON.parse(nrEditRaw);
      const customText = text.trim();

      if (!customText) {
        await sendTelegramReply(env, chatId, messageId, '⚠️ Empty reply. Please try again.');
        return { ok: true };
      }

      await env.WEBHOOK_KV.put(`custom_nr:${queueId}`, customText, { expirationTtl: 3600 });
      await env.WEBHOOK_KV.delete(`edit_nr_reply:${replyToId}`);

      const nrRaw = await env.WEBHOOK_KV.get(`nurture_reply:${queueId}`);
      const nr = nrRaw ? JSON.parse(nrRaw) : {};
      const preview = customText.length > 300 ? customText.slice(0, 300) + '...' : customText;

      await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, chatId,
        `📧 *Custom nurture reply preview:*\n\n\`\`\`\n${preview}\n\`\`\`\n\nSend this to *${nr.email || 'lead'}*?`,
        {
          reply_to_message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Send + Stop', callback_data: `nr_send_custom_stop:${queueId}` },
                { text: '✅ Send + Continue', callback_data: `nr_send_custom_continue:${queueId}` }
              ],
              [
                { text: '❌ Cancel', callback_data: `nr_cancel_edit:${queueId}` }
              ]
            ]
          }
        }
      );

      return { ok: true };
    }

    // Check for report email edit prompt
    const sessionRaw = await env.WEBHOOK_KV.get(`edit_reply:${replyToId}`);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      const customText = text.trim();

      if (!customText) {
        await sendTelegramReply(env, chatId, messageId, '⚠️ Empty reply. Please try again with your edited email text.');
        return { ok: true };
      }

      // Store the custom email body + approval data in KV
      await env.WEBHOOK_KV.put(
        `custom_email:${session.approvalId}`,
        customText,
        { expirationTtl: 3600 } // 1 hour
      );
      await env.WEBHOOK_KV.put(
        `custom_session:${session.approvalId}`,
        JSON.stringify(session),
        { expirationTtl: 3600 }
      );

      // Clean up the edit_reply key
      await env.WEBHOOK_KV.delete(`edit_reply:${replyToId}`);

      // Show confirmation with Send Now / Cancel buttons
      const preview = customText.length > 300
        ? customText.slice(0, 300) + '...'
        : customText;

      await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, chatId,
        `📧 *Custom email preview:*\n\n\`\`\`\n${preview}\n\`\`\`\n\nSend this to *${session.leadEmail}*?`,
        {
          reply_to_message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Send Now', callback_data: `send_custom:${session.approvalId}` },
                { text: '❌ Cancel', callback_data: `cancel_edit:${session.approvalId}` }
              ]
            ]
          }
        }
      );

      return { ok: true };
    }
  }

  // Handle /nurture commands
  if (text.startsWith('/nurture')) {
    const parts = text.split(/\s+/);
    const subCommand = parts[1] || 'status';

    if (subCommand === 'status') {
      // List active + paused nurture leads from KV
      const keys = await env.WEBHOOK_KV.list({ prefix: 'nurture:' });
      if (keys.keys.length === 0) {
        await sendTelegramReply(env, chatId, messageId, '📬 No nurture sequences.');
        return { ok: true };
      }

      let statusLines = [];
      for (const key of keys.keys.slice(0, 20)) {
        const raw = await env.WEBHOOK_KV.get(key.name);
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (data.status !== 'active' && data.status !== 'paused') continue;
        const nurEmail = key.name.replace('nurture:', '');
        const badge = data.status === 'paused' ? '⏸️' : '▶️';
        const reason = data.pause_reason ? ` (${data.pause_reason})` : '';
        statusLines.push(`${badge} ${nurEmail} — ${data.emails_sent || 0}/7 sent (${data.firm_name || '?'})${data.status === 'paused' ? reason : ''}`);
      }

      const msg = statusLines.length > 0
        ? `📬 *Nurture Sequences*\n\n${statusLines.join('\n')}`
        : '📬 No active nurture sequences.';
      await sendTelegramReply(env, chatId, messageId, msg);
    } else if (subCommand === 'stop' && parts[2]) {
      const targetEmail = parts[2];
      const nurture = await env.WEBHOOK_KV.get(`nurture:${targetEmail}`);
      if (nurture) {
        const data = JSON.parse(nurture);
        data.status = 'completed';
        await env.WEBHOOK_KV.put(`nurture:${targetEmail}`, JSON.stringify(data), { expirationTtl: 2592000 });
        await sendTelegramReply(env, chatId, messageId, `✅ Stopped nurture for ${targetEmail}`);
      } else {
        await sendTelegramReply(env, chatId, messageId, `⚠️ No nurture sequence found for ${targetEmail}`);
      }
    } else if (subCommand === 'resume' && parts[2]) {
      const targetEmail = parts[2];
      const nurture = await env.WEBHOOK_KV.get(`nurture:${targetEmail}`);
      if (nurture) {
        const data = JSON.parse(nurture);
        if (data.status === 'paused') {
          data.status = 'active';
          delete data.paused_at;
          delete data.pause_reason;
          delete data.last_reply_text;
          delete data.last_reply_category;
          delete data.last_reply_at;
          await env.WEBHOOK_KV.put(`nurture:${targetEmail}`, JSON.stringify(data), { expirationTtl: 2592000 });
          await sendTelegramReply(env, chatId, messageId, `▶️ Resumed nurture for ${targetEmail} (${data.emails_sent || 0}/7 sent)`);
        } else if (data.status === 'active') {
          await sendTelegramReply(env, chatId, messageId, `ℹ️ Nurture for ${targetEmail} is already active`);
        } else {
          await sendTelegramReply(env, chatId, messageId, `⚠️ Nurture for ${targetEmail} is ${data.status}, cannot resume`);
        }
      } else {
        await sendTelegramReply(env, chatId, messageId, `⚠️ No nurture sequence found for ${targetEmail}`);
      }
    } else {
      await sendTelegramReply(env, chatId, messageId,
        `📬 *Nurture Commands:*\n\n\`/nurture status\` — Show active/paused sequences\n\`/nurture stop email@firm.com\` — Stop a sequence\n\`/nurture resume email@firm.com\` — Resume a paused sequence`);
    }

    return { ok: true };
  }

  // Handle /build-li command — build report from LinkedIn URL
  if (text.startsWith('/build-li')) {
    const tokens = text.replace(/^\/build-li\s*/, '').trim().split(/\s+/).filter(Boolean);
    let linkedinUrl = '';
    let website = '';
    const nameParts = [];

    for (const token of tokens) {
      if (token.includes('linkedin.com/in/')) {
        linkedinUrl = token.startsWith('http') ? token : `https://${token}`;
      } else if (/^https?:\/\//i.test(token)) {
        website = token;
      } else if (/^[a-z0-9-]+\.[a-z]{2,}$/i.test(token)) {
        website = `https://${token}`;
      } else {
        nameParts.push(token);
      }
    }

    if (!linkedinUrl) {
      await sendTelegramReply(env, chatId, messageId,
        `\u26a0\ufe0f *Usage:*\n\n\`/build-li linkedin.com/in/name [website] [First Last]\`\n\nLinkedIn URL is required.`
      );
      return { ok: true };
    }

    const githubPayload = {
      event_type: 'interested_lead',
      client_payload: {
        email: '',
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        website: website,
        location: '',
        country: '',
        company: '',
        job_title: '',
        linkedin: linkedinUrl,
        _meta: JSON.stringify({
          reply_text: '',
          campaign_name: 'manual_build',
          phone: '',
          timestamp: new Date().toISOString(),
          classification: 'INTERESTED',
          channel: 'prosp',
          linkedin_url: linkedinUrl,
          prosp_sender: env.PROSP_SENDER || ''
        })
      }
    };

    try {
      await forwardToGitHub(env, githubPayload);

      const details = [
        `\ud83d\udd17 *LinkedIn:* ${linkedinUrl}`,
        website ? `\ud83c\udf10 *Website:* ${website}` : null,
        nameParts.length > 0 ? `\ud83d\udc64 *Name:* ${nameParts.join(' ')}` : null
      ].filter(Boolean).join('\n');

      await sendTelegramReply(env, chatId, messageId,
        `\u2705 *LinkedIn build triggered!*\n\n${details}\n\nYou'll get an approval request in ~5 minutes.`
      );
    } catch (err) {
      console.error('Build-li dispatch failed:', err.message);
      await sendTelegramReply(env, chatId, messageId,
        `\u274c *Build failed:* ${err.message}`
      );
    }

    return { ok: true };
  }

  // Only handle /build commands — ignore everything else
  if (!text.startsWith('/build')) {
    return { ok: true };
  }

  const parsed = parseBuildCommand(text);

  // Validate: email is required
  if (!parsed.email) {
    await sendTelegramReply(env, chatId, messageId,
      `⚠️ *Usage:*\n\n\`/build email@firm.com [website] [First Last]\`\n\nEmail is required. Website and name are optional (inferred if missing).`
    );
    return { ok: true };
  }

  // Build GitHub payload matching the Instantly pipeline format
  const githubPayload = {
    event_type: 'interested_lead',
    client_payload: {
      email: parsed.email,
      first_name: parsed.firstName,
      last_name: parsed.lastName,
      website: parsed.website,
      location: '',
      country: '',
      company: '',
      job_title: '',
      linkedin: '',
      _meta: JSON.stringify({
        reply_text: '',
        campaign_name: 'manual_build',
        phone: '',
        timestamp: new Date().toISOString(),
        classification: 'INTERESTED'
      })
    }
  };

  try {
    await forwardToGitHub(env, githubPayload);

    const details = [
      `📧 *Email:* ${parsed.email}`,
      parsed.website ? `🌐 *Website:* ${parsed.website}` : null,
      parsed.firstName ? `👤 *Name:* ${parsed.firstName}${parsed.lastName ? ' ' + parsed.lastName : ''}` : null
    ].filter(Boolean).join('\n');

    await sendTelegramReply(env, chatId, messageId,
      `✅ *Build triggered!*\n\n${details}\n\nYou'll get an approval request in ~5 minutes.`
    );
  } catch (err) {
    console.error('Build dispatch failed:', err.message);
    await sendTelegramReply(env, chatId, messageId,
      `❌ *Build failed:* ${err.message}`
    );
  }

  return { ok: true };
}
