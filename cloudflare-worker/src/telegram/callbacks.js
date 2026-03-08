import { answerCallback, editMessage, sendTelegramMsg } from './api.js';
import { sendInstantlyReply } from '../channels/instantly.js';
import { sendProspDM } from '../channels/prosp.js';
import { triggerGitHubWorkflow, fetchApprovalData, GITHUB_REPO } from '../github.js';

export function parseMessageForApprovalData(message) {
  const text = message.text || '';
  // Telegram strips markdown * from text field — match without them
  const firmMatch = text.match(/📊 (?:\*)?Firm:(?:\*)? (.+)/);
  const contactMatch = text.match(/👤 (?:\*)?Contact:(?:\*)? (.+)/);
  const emailMatch = text.match(/📧 (?:\*)?Email:(?:\*)? (.+)/);
  const urlMatch = text.match(/🔗 (?:\*)?Review Report:(?:\*)?\n(.+)/);

  if (firmMatch && contactMatch && emailMatch && urlMatch) {
    const reportUrl = urlMatch[1].trim();
    const folderMatch = reportUrl.match(/pending-reports\/([^/]+)/);
    const firmFolder = folderMatch ? folderMatch[1] : firmMatch[1].trim();

    return {
      firm_name: firmMatch[1].trim(),
      firm_folder: firmFolder,
      contact_name: contactMatch[1].trim(),
      lead_email: emailMatch[1].trim(),
      report_url: reportUrl
    };
  }
  return null;
}

export async function handleTelegramCallback(env, update) {
  const { callback_query } = update;
  const callbackData = callback_query.data;
  const [action, approvalId] = callbackData.split(':');

  console.log('Telegram callback:', action, approvalId);

  const chatId = callback_query.message.chat.id;
  const messageId = callback_query.message.message_id;

  // Handle queued email callbacks first (they don't need approval data from GitHub)
  const queuedActions = ['approve_queued', 'edit_queued', 'skip_queued', 'send_queued_custom', 'cancel_queued_edit'];
  if (queuedActions.includes(action)) {
    if (action === 'approve_queued') {
      const queuedRaw = await env.WEBHOOK_KV.get(`queued_email:${approvalId}`);
      if (!queuedRaw) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Email expired', true);
        return { ok: true };
      }
      const queued = JSON.parse(queuedRaw);
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Sending...', false);

      try {
        if (!env.INSTANTLY_API_KEY) throw new Error('INSTANTLY_API_KEY not configured');
        await sendInstantlyReply(env.INSTANTLY_API_KEY, queued.to, queued.subject, queued.html, queued.text);
        await env.WEBHOOK_KV.delete(`queued_email:${approvalId}`);
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `✅ *SENT* (${queued.type || 'email'})\n\n📧 *To:* ${queued.to}\n📝 *Subject:* ${queued.subject}`);
      } catch (err) {
        console.error('Failed to send queued email:', err.message);
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `❌ *SEND FAILED*\n\n${err.message}\n\n📧 *To:* ${queued.to}`);
      }

    } else if (action === 'edit_queued') {
      const queuedRaw = await env.WEBHOOK_KV.get(`queued_email:${approvalId}`);
      if (!queuedRaw) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Email expired', true);
        return { ok: true };
      }
      const queued = JSON.parse(queuedRaw);
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Opening editor...', false);

      const editMsg = await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, chatId,
        `✏️ *Edit the email below*\nCopy this text, edit it, and reply with your version:\n\n\`\`\`\n${(queued.text || '').slice(0, 600)}\n\`\`\``,
        { reply_markup: { force_reply: true, selective: true } }
      );

      if (editMsg.ok && editMsg.result) {
        await env.WEBHOOK_KV.put(
          `edit_queued_reply:${editMsg.result.message_id}`,
          JSON.stringify({ queueId: approvalId, originalMessageId: messageId }),
          { expirationTtl: 1800 }
        );
      }

    } else if (action === 'skip_queued') {
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Skipped', false);
      const queuedRaw = await env.WEBHOOK_KV.get(`queued_email:${approvalId}`);
      const queued = queuedRaw ? JSON.parse(queuedRaw) : {};
      await env.WEBHOOK_KV.delete(`queued_email:${approvalId}`);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `⏭️ *SKIPPED*\n\nEmail to ${queued.to || 'lead'} was not sent.`);

    } else if (action === 'send_queued_custom') {
      const queuedRaw = await env.WEBHOOK_KV.get(`queued_email:${approvalId}`);
      const customText = await env.WEBHOOK_KV.get(`custom_queued:${approvalId}`);
      if (!queuedRaw || !customText) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Email expired', true);
        return { ok: true };
      }
      const queued = JSON.parse(queuedRaw);
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Sending custom...', false);

      try {
        if (!env.INSTANTLY_API_KEY) throw new Error('INSTANTLY_API_KEY not configured');
        const customHtml = customText.replace(/\n/g, '<br>');
        await sendInstantlyReply(env.INSTANTLY_API_KEY, queued.to, queued.subject, customHtml, customText);
        await env.WEBHOOK_KV.delete(`queued_email:${approvalId}`);
        await env.WEBHOOK_KV.delete(`custom_queued:${approvalId}`);
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `✅ *SENT (Custom)* (${queued.type || 'email'})\n\n📧 *To:* ${queued.to}`);
      } catch (err) {
        console.error('Failed to send custom queued email:', err.message);
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `❌ *SEND FAILED*\n\n${err.message}`);
      }

    } else if (action === 'cancel_queued_edit') {
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Cancelled', false);
      await env.WEBHOOK_KV.delete(`custom_queued:${approvalId}`);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        '❌ *Edit cancelled.* Use the original message to approve or edit again.');
    }

    return { ok: true };
  }

  // Handle queued DM callbacks (approve_dm, edit_dm, skip_dm)
  const dmActions = ['approve_dm', 'edit_dm', 'skip_dm', 'send_dm_custom', 'cancel_dm_edit'];
  if (dmActions.includes(action)) {
    if (action === 'approve_dm') {
      const dmRaw = await env.WEBHOOK_KV.get(`queued_dm:${approvalId}`);
      if (!dmRaw) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'DM expired', true);
        return { ok: true };
      }
      const dm = JSON.parse(dmRaw);
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Sending DM...', false);

      try {
        if (!env.PROSP_API_KEY) throw new Error('PROSP_API_KEY not configured');
        const sender = dm.sender || env.PROSP_SENDER;
        if (!sender) throw new Error('No Prosp sender configured');
        await sendProspDM(env.PROSP_API_KEY, dm.linkedin_url, sender, dm.message);
        await env.WEBHOOK_KV.delete(`queued_dm:${approvalId}`);
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `\u2705 *DM SENT* (${dm.type || 'dm'})\n\n\ud83d\udd17 *To:* ${dm.linkedin_url}\n\ud83d\udcca *Firm:* ${dm.firm_name || 'Unknown'}`);
      } catch (err) {
        console.error('Failed to send queued DM:', err.message);
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `\u274c *DM SEND FAILED*\n\n${err.message}\n\n\ud83d\udd17 *To:* ${dm.linkedin_url}`);
      }

    } else if (action === 'edit_dm') {
      const dmRaw = await env.WEBHOOK_KV.get(`queued_dm:${approvalId}`);
      if (!dmRaw) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'DM expired', true);
        return { ok: true };
      }
      const dm = JSON.parse(dmRaw);
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Opening editor...', false);

      const editMsg = await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, chatId,
        `\u270f\ufe0f *Edit the DM below*\nCopy this text, edit it, and reply with your version:\n\n\`\`\`\n${(dm.message || '').slice(0, 600).replace(/`/g, "'")}\n\`\`\``,
        { reply_markup: { force_reply: true, selective: true } }
      );

      if (editMsg.ok && editMsg.result) {
        await env.WEBHOOK_KV.put(
          `edit_dm_reply:${editMsg.result.message_id}`,
          JSON.stringify({ queueId: approvalId, originalMessageId: messageId }),
          { expirationTtl: 1800 }
        );
      }

    } else if (action === 'skip_dm') {
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Skipped', false);
      const dmRaw = await env.WEBHOOK_KV.get(`queued_dm:${approvalId}`);
      const dm = dmRaw ? JSON.parse(dmRaw) : {};
      await env.WEBHOOK_KV.delete(`queued_dm:${approvalId}`);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `\u23ed\ufe0f *SKIPPED*\n\nDM to ${dm.linkedin_url || 'lead'} was not sent.`);

    } else if (action === 'send_dm_custom') {
      const dmRaw = await env.WEBHOOK_KV.get(`queued_dm:${approvalId}`);
      const customText = await env.WEBHOOK_KV.get(`custom_dm:${approvalId}`);
      if (!dmRaw || !customText) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'DM expired', true);
        return { ok: true };
      }
      const dm = JSON.parse(dmRaw);
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Sending custom DM...', false);

      try {
        if (!env.PROSP_API_KEY) throw new Error('PROSP_API_KEY not configured');
        const sender = dm.sender || env.PROSP_SENDER;
        if (!sender) throw new Error('No Prosp sender configured');
        await sendProspDM(env.PROSP_API_KEY, dm.linkedin_url, sender, customText);
        await env.WEBHOOK_KV.delete(`queued_dm:${approvalId}`);
        await env.WEBHOOK_KV.delete(`custom_dm:${approvalId}`);
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `\u2705 *CUSTOM DM SENT* (${dm.type || 'dm'})\n\n\ud83d\udd17 *To:* ${dm.linkedin_url}`);
      } catch (err) {
        console.error('Failed to send custom DM:', err.message);
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `\u274c *DM SEND FAILED*\n\n${err.message}`);
      }

    } else if (action === 'cancel_dm_edit') {
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Cancelled', false);
      await env.WEBHOOK_KV.delete(`custom_dm:${approvalId}`);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        '\u274c *Edit cancelled.* Use the original message to approve or edit again.');
    }

    return { ok: true };
  }

  // Handle nurture DM reply callbacks (nrd_* actions — mirrors nr_* but sends via Prosp)
  const nurtureDmActions = ['nrd_send_stop', 'nrd_send_cont', 'nrd_edit', 'nrd_skip',
    'nrd_stop_only', 'nrd_resume', 'nrd_send_custom_stop', 'nrd_send_custom_cont', 'nrd_cancel_edit'];
  if (nurtureDmActions.includes(action)) {
    const nrRaw = await env.WEBHOOK_KV.get(`nurture_reply:${approvalId}`);

    if (action === 'nrd_send_stop' || action === 'nrd_send_cont') {
      if (!nrRaw) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Reply expired', true);
        return { ok: true };
      }
      const nr = JSON.parse(nrRaw);
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Sending DM...', false);

      try {
        if (!env.PROSP_API_KEY) throw new Error('PROSP_API_KEY not configured');
        if (!nr.autoReply) throw new Error('No auto-reply text available');
        const sender = nr.prosp_sender || env.PROSP_SENDER;
        if (!sender) throw new Error('No Prosp sender configured');
        await sendProspDM(env.PROSP_API_KEY, nr.linkedin_url, sender, nr.autoReply);

        // Update nurture status — use linkedin_url as key for Prosp leads
        const nurtureKey = nr.email || nr.linkedin_url;
        const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${nurtureKey}`);
        if (nurtureRaw) {
          const nurtureData = JSON.parse(nurtureRaw);
          if (action === 'nrd_send_stop') {
            nurtureData.status = 'completed';
            nurtureData.stopped_reason = 'replied_engaged';
          } else {
            nurtureData.status = 'active';
          }
          await env.WEBHOOK_KV.put(`nurture:${nurtureKey}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });
        }

        await env.WEBHOOK_KV.delete(`nurture_reply:${approvalId}`);
        const statusLabel = action === 'nrd_send_stop' ? 'STOPPED' : 'RESUMED';
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `\u2705 *DM REPLY SENT* \u2014 Nurture ${statusLabel}\n\n\ud83d\udd17 *To:* ${nr.linkedin_url}\n\ud83d\udcca *Firm:* ${nr.firmName}\n\ud83d\udcec ${nr.emailsSent}/7 sent`);
      } catch (err) {
        console.error('Failed to send nurture DM reply:', err.message);
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `\u274c *DM SEND FAILED*\n\n${err.message}\n\n\ud83d\udd17 *To:* ${nr.linkedin_url}`);
      }

    } else if (action === 'nrd_edit') {
      if (!nrRaw) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Reply expired', true);
        return { ok: true };
      }
      const nr = JSON.parse(nrRaw);
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Opening editor...', false);

      const preview = (nr.autoReply || 'Write your reply here...').slice(0, 600).replace(/`/g, "'");
      const editMsg = await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, chatId,
        `\u270f\ufe0f *Edit the DM reply below*\nCopy this text, edit it, and reply with your version:\n\n\`\`\`\n${preview}\n\`\`\``,
        { reply_markup: { force_reply: true, selective: true } }
      );

      if (editMsg.ok && editMsg.result) {
        await env.WEBHOOK_KV.put(
          `edit_nrd_reply:${editMsg.result.message_id}`,
          JSON.stringify({ queueId: approvalId }),
          { expirationTtl: 1800 }
        );
      }

    } else if (action === 'nrd_skip') {
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Skipped reply', false);
      const nr = nrRaw ? JSON.parse(nrRaw) : {};
      const nurtureKey = nr.email || nr.linkedin_url;

      if (nurtureKey) {
        const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${nurtureKey}`);
        if (nurtureRaw) {
          const nurtureData = JSON.parse(nurtureRaw);
          delete nurtureData.last_reply_text;
          delete nurtureData.last_reply_category;
          delete nurtureData.last_reply_at;
          await env.WEBHOOK_KV.put(`nurture:${nurtureKey}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });
        }
      }

      await env.WEBHOOK_KV.delete(`nurture_reply:${approvalId}`);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `\u23ed\ufe0f *DM REPLY SKIPPED* \u2014 Nurture still PAUSED\n\n\ud83d\udd17 ${nr.linkedin_url || 'lead'}\n\ud83d\udcca ${nr.firmName || ''}\n\ud83d\udcec ${nr.emailsSent || '?'}/7 sent`,
        {
          inline_keyboard: [
            [
              { text: '\ud83d\uded1 Stop Nurture', callback_data: `nrd_stop_only:${approvalId}` },
              { text: '\u25b6\ufe0f Resume Nurture', callback_data: `nrd_resume:${approvalId}` }
            ]
          ]
        }
      );

    } else if (action === 'nrd_stop_only') {
      const nr = nrRaw ? JSON.parse(nrRaw) : {};
      if (!nr.linkedin_url && callback_query.message?.text) {
        const m = callback_query.message.text.match(/\ud83d\udd17\s*(\S+)/);
        if (m) nr.linkedin_url = m[1];
      }
      const nurtureKey = nr.email || nr.linkedin_url;
      if (nurtureKey) {
        const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${nurtureKey}`);
        if (nurtureRaw) {
          const nurtureData = JSON.parse(nurtureRaw);
          nurtureData.status = 'completed';
          nurtureData.stopped_reason = 'manual_after_reply';
          await env.WEBHOOK_KV.put(`nurture:${nurtureKey}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });
        }
      }
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Nurture stopped', false);
      await env.WEBHOOK_KV.delete(`nurture_reply:${approvalId}`);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `\ud83d\uded1 *NURTURE STOPPED*\n\n\ud83d\udd17 ${nr.linkedin_url || 'lead'}\n\ud83d\udcca ${nr.firmName || ''}\nNo DM sent. Sequence terminated.`);

    } else if (action === 'nrd_resume') {
      const nr = nrRaw ? JSON.parse(nrRaw) : {};
      if (!nr.linkedin_url && callback_query.message?.text) {
        const m = callback_query.message.text.match(/\ud83d\udd17\s*(\S+)/);
        if (m) nr.linkedin_url = m[1];
      }
      const nurtureKey = nr.email || nr.linkedin_url;
      if (nurtureKey) {
        const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${nurtureKey}`);
        if (nurtureRaw) {
          const nurtureData = JSON.parse(nurtureRaw);
          nurtureData.status = 'active';
          await env.WEBHOOK_KV.put(`nurture:${nurtureKey}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });
        }
      }
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Nurture resumed', false);
      await env.WEBHOOK_KV.delete(`nurture_reply:${approvalId}`);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `\u25b6\ufe0f *NURTURE RESUMED*\n\n\ud83d\udd17 ${nr.linkedin_url || 'lead'}\n\ud83d\udcca ${nr.firmName || ''}\nNo DM sent. Next nurture DM will continue.`);

    } else if (action === 'nrd_send_custom_stop' || action === 'nrd_send_custom_cont') {
      const customText = await env.WEBHOOK_KV.get(`custom_nrd:${approvalId}`);
      if (!nrRaw || !customText) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Reply expired', true);
        return { ok: true };
      }
      const nr = JSON.parse(nrRaw);
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Sending custom DM...', false);

      try {
        if (!env.PROSP_API_KEY) throw new Error('PROSP_API_KEY not configured');
        const sender = nr.prosp_sender || env.PROSP_SENDER;
        if (!sender) throw new Error('No Prosp sender configured');
        await sendProspDM(env.PROSP_API_KEY, nr.linkedin_url, sender, customText);

        const nurtureKey = nr.email || nr.linkedin_url;
        const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${nurtureKey}`);
        if (nurtureRaw) {
          const nurtureData = JSON.parse(nurtureRaw);
          if (action === 'nrd_send_custom_stop') {
            nurtureData.status = 'completed';
            nurtureData.stopped_reason = 'replied_engaged';
          } else {
            nurtureData.status = 'active';
          }
          await env.WEBHOOK_KV.put(`nurture:${nurtureKey}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });
        }

        await env.WEBHOOK_KV.delete(`nurture_reply:${approvalId}`);
        await env.WEBHOOK_KV.delete(`custom_nrd:${approvalId}`);
        const statusLabel = action === 'nrd_send_custom_stop' ? 'STOPPED' : 'RESUMED';
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `\u2705 *CUSTOM DM REPLY SENT* \u2014 Nurture ${statusLabel}\n\n\ud83d\udd17 *To:* ${nr.linkedin_url}\n\ud83d\udcca *Firm:* ${nr.firmName}`);
      } catch (err) {
        console.error('Failed to send custom nurture DM reply:', err.message);
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `\u274c *DM SEND FAILED*\n\n${err.message}`);
      }

    } else if (action === 'nrd_cancel_edit') {
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Cancelled', false);
      await env.WEBHOOK_KV.delete(`custom_nrd:${approvalId}`);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        '\u274c *Edit cancelled.* Use the original message buttons to respond.');
    }

    return { ok: true };
  }

  // Handle nurture reply callbacks (nr_* actions)
  const nurtureActions = ['nr_send_stop', 'nr_send_continue', 'nr_edit', 'nr_skip',
    'nr_stop_only', 'nr_resume', 'nr_send_custom_stop', 'nr_send_custom_continue', 'nr_cancel_edit'];
  if (nurtureActions.includes(action)) {
    const nrRaw = await env.WEBHOOK_KV.get(`nurture_reply:${approvalId}`);

    if (action === 'nr_send_stop' || action === 'nr_send_continue') {
      if (!nrRaw) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Reply expired', true);
        return { ok: true };
      }
      const nr = JSON.parse(nrRaw);
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Sending...', false);

      try {
        if (!env.INSTANTLY_API_KEY) throw new Error('INSTANTLY_API_KEY not configured');
        if (!nr.autoReply) throw new Error('No auto-reply text available');
        const replyHtml = nr.autoReply.replace(/\n/g, '<br>');
        await sendInstantlyReply(env.INSTANTLY_API_KEY, nr.email, 'Re: Your marketing analysis', replyHtml, nr.autoReply);

        // Update nurture status
        const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${nr.email}`);
        if (nurtureRaw) {
          const nurtureData = JSON.parse(nurtureRaw);
          if (action === 'nr_send_stop') {
            nurtureData.status = 'completed';
            nurtureData.stopped_reason = 'replied_engaged';
          } else {
            nurtureData.status = 'active';
          }
          await env.WEBHOOK_KV.put(`nurture:${nr.email}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });
        }

        await env.WEBHOOK_KV.delete(`nurture_reply:${approvalId}`);
        const statusLabel = action === 'nr_send_stop' ? 'STOPPED' : 'RESUMED';
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `✅ *REPLY SENT* — Nurture ${statusLabel}\n\n📧 *To:* ${nr.email}\n📊 *Firm:* ${nr.firmName}\n📬 ${nr.emailsSent}/7 sent`);
      } catch (err) {
        console.error('Failed to send nurture reply:', err.message);
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `❌ *SEND FAILED*\n\n${err.message}\n\n📧 *To:* ${nr.email}`);
      }

    } else if (action === 'nr_edit') {
      if (!nrRaw) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Reply expired', true);
        return { ok: true };
      }
      const nr = JSON.parse(nrRaw);
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Opening editor...', false);

      const preview = (nr.autoReply || 'Write your reply here...').slice(0, 600).replace(/`/g, "'");
      const editMsg = await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, chatId,
        `✏️ *Edit the reply below*\nCopy this text, edit it, and reply with your version:\n\n\`\`\`\n${preview}\n\`\`\``,
        { reply_markup: { force_reply: true, selective: true } }
      );

      if (editMsg.ok && editMsg.result) {
        await env.WEBHOOK_KV.put(
          `edit_nr_reply:${editMsg.result.message_id}`,
          JSON.stringify({ queueId: approvalId }),
          { expirationTtl: 1800 }
        );
      }

    } else if (action === 'nr_skip') {
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Skipped reply', false);
      const nr = nrRaw ? JSON.parse(nrRaw) : {};

      // Clear reply context so future nurture emails don't reference the skipped reply
      if (nr.email) {
        const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${nr.email}`);
        if (nurtureRaw) {
          const nurtureData = JSON.parse(nurtureRaw);
          delete nurtureData.last_reply_text;
          delete nurtureData.last_reply_category;
          delete nurtureData.last_reply_at;
          await env.WEBHOOK_KV.put(`nurture:${nr.email}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });
        }
      }

      await env.WEBHOOK_KV.delete(`nurture_reply:${approvalId}`);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `⏭️ *REPLY SKIPPED* — Nurture still PAUSED\n\n📧 ${nr.email || 'lead'}\n📊 ${nr.firmName || ''}\n📬 ${nr.emailsSent || '?'}/7 sent`,
        {
          inline_keyboard: [
            [
              { text: '🛑 Stop Nurture', callback_data: `nr_stop_only:${approvalId}` },
              { text: '▶️ Resume Nurture', callback_data: `nr_resume:${approvalId}` }
            ]
          ]
        }
      );

    } else if (action === 'nr_stop_only') {
      const nr = nrRaw ? JSON.parse(nrRaw) : {};
      // Fallback: extract email from Telegram message text if KV expired
      if (!nr.email && callback_query.message?.text) {
        const m = callback_query.message.text.match(/📧\s*(\S+@\S+)/);
        if (m) nr.email = m[1];
      }
      if (nr.email) {
        const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${nr.email}`);
        if (nurtureRaw) {
          const nurtureData = JSON.parse(nurtureRaw);
          nurtureData.status = 'completed';
          nurtureData.stopped_reason = 'manual_after_reply';
          await env.WEBHOOK_KV.put(`nurture:${nr.email}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });
        }
      }
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Nurture stopped', false);
      await env.WEBHOOK_KV.delete(`nurture_reply:${approvalId}`);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `🛑 *NURTURE STOPPED*\n\n📧 ${nr.email || 'lead'}\n📊 ${nr.firmName || ''}\nNo reply sent. Sequence terminated.`);

    } else if (action === 'nr_resume') {
      const nr = nrRaw ? JSON.parse(nrRaw) : {};
      // Fallback: extract email from Telegram message text if KV expired
      if (!nr.email && callback_query.message?.text) {
        const m = callback_query.message.text.match(/📧\s*(\S+@\S+)/);
        if (m) nr.email = m[1];
      }
      if (nr.email) {
        const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${nr.email}`);
        if (nurtureRaw) {
          const nurtureData = JSON.parse(nurtureRaw);
          nurtureData.status = 'active';
          await env.WEBHOOK_KV.put(`nurture:${nr.email}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });
        }
      }
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Nurture resumed', false);
      await env.WEBHOOK_KV.delete(`nurture_reply:${approvalId}`);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `▶️ *NURTURE RESUMED*\n\n📧 ${nr.email || 'lead'}\n📊 ${nr.firmName || ''}\nNo reply sent. Next nurture email will continue.`);

    } else if (action === 'nr_send_custom_stop' || action === 'nr_send_custom_continue') {
      const customText = await env.WEBHOOK_KV.get(`custom_nr:${approvalId}`);
      if (!nrRaw || !customText) {
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Reply expired', true);
        return { ok: true };
      }
      const nr = JSON.parse(nrRaw);
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Sending custom...', false);

      try {
        if (!env.INSTANTLY_API_KEY) throw new Error('INSTANTLY_API_KEY not configured');
        const customHtml = customText.replace(/\n/g, '<br>');
        await sendInstantlyReply(env.INSTANTLY_API_KEY, nr.email, 'Re: Your marketing analysis', customHtml, customText);

        const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${nr.email}`);
        if (nurtureRaw) {
          const nurtureData = JSON.parse(nurtureRaw);
          if (action === 'nr_send_custom_stop') {
            nurtureData.status = 'completed';
            nurtureData.stopped_reason = 'replied_engaged';
          } else {
            nurtureData.status = 'active';
          }
          await env.WEBHOOK_KV.put(`nurture:${nr.email}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });
        }

        await env.WEBHOOK_KV.delete(`nurture_reply:${approvalId}`);
        await env.WEBHOOK_KV.delete(`custom_nr:${approvalId}`);
        const statusLabel = action === 'nr_send_custom_stop' ? 'STOPPED' : 'RESUMED';
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `✅ *CUSTOM REPLY SENT* — Nurture ${statusLabel}\n\n📧 *To:* ${nr.email}\n📊 *Firm:* ${nr.firmName}`);
      } catch (err) {
        console.error('Failed to send custom nurture reply:', err.message);
        await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
          `❌ *SEND FAILED*\n\n${err.message}`);
      }

    } else if (action === 'nr_cancel_edit') {
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Cancelled', false);
      await env.WEBHOOK_KV.delete(`custom_nr:${approvalId}`);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        '❌ *Edit cancelled.* Use the original message buttons to respond.');
    }

    return { ok: true };
  }

  // Parse approval data from message (for report email callbacks)
  let approvalData = parseMessageForApprovalData(callback_query.message);

  // Try to fetch full approval JSON from GitHub (has email personalization data)
  // approvalId is the firm_folder name directly (e.g. "LawOfficeOfFrankJCassisiPc")
  if (approvalId) {
    try {
      const fetchedData = await fetchApprovalData(env.GITHUB_TOKEN, approvalId);
      if (fetchedData) {
        if (approvalData) {
          // Merge: fetched JSON has email data fields that message parsing doesn't
          approvalData = { ...approvalData, ...fetchedData };
        } else {
          approvalData = fetchedData;
        }
      }
    } catch (e) {
      console.log('Could not fetch approval data:', e.message);
    }
  }

  if (!approvalData) {
    await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Approval data not found', true);
    return { ok: true, error: 'Approval data not found' };
  }

  if (action === 'approve' || action === 'approve_no_email') {
    const skipEmail = action === 'approve_no_email';
    try {
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id,
        skipEmail ? 'Deploying report...' : 'Sending email...', false);
      await triggerGitHubWorkflow(env.GITHUB_TOKEN, approvalData, skipEmail);

      // Show live URL (not pending) since approval moves the report
      const liveUrl = approvalData.report_url
        ? approvalData.report_url.replace('/pending-reports/', '/')
        : approvalData.report_url;

      const successText = skipEmail
        ? `✅ *APPROVED (No Email)*

📊 *Firm:* ${approvalData.firm_name}
👤 *Contact:* ${approvalData.contact_name}
🔗 *Live Report:* ${liveUrl}

📄 *Report deployed — no email sent.*`
        : `✅ *APPROVED & SENT*

📊 *Firm:* ${approvalData.firm_name}
👤 *Contact:* ${approvalData.contact_name}
📧 *Email:* ${approvalData.lead_email}
🔗 *Live Report:* ${liveUrl}

✉️ *Email send triggered via GitHub Actions!*`;

      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, successText);
      console.log(`Approval processed successfully (skipEmail=${skipEmail})`);

      // Cross-channel: add Instantly leads to Prosp campaign for LinkedIn connection request
      const liUrl = approvalData.linkedin_url || approvalData.linkedin || '';
      const channel = approvalData.channel || 'instantly';
      if (liUrl && env.PROSP_API_KEY && env.PROSP_CAMPAIGN_ID && channel !== 'prosp') {
        try {
          const firstName = (approvalData.contact_name || '').split(' ')[0] || '';
          const lastName = (approvalData.contact_name || '').split(' ').slice(1).join(' ') || '';
          await fetch('https://prosp.ai/api/v1/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: env.PROSP_API_KEY,
              campaign_id: env.PROSP_CAMPAIGN_ID,
              linkedin_url: liUrl,
              first_name: firstName,
              last_name: lastName,
              company_name: approvalData.firm_name,
              skip_duplicate: 'yes'
            })
          });
          console.log('Added to Prosp campaign for LinkedIn connection');
        } catch (e) {
          console.log('Prosp campaign add failed (non-fatal):', e.message);
        }
      }
    } catch (err) {
      console.error('Failed to trigger workflow:', err.message);
      // Escape markdown special chars in error message to prevent parse failure
      const safeErr = (err.message || 'Unknown error').replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&').slice(0, 200);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `❌ *ERROR*\n\nFailed to trigger workflow: ${safeErr}`);
    }
  } else if (action === 'reject') {
    await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Rejected', false);
    const rejectedText = `❌ *REJECTED*

📊 *Firm:* ${approvalData.firm_name}
📧 *Email:* ${approvalData.lead_email}

*No email was sent.*`;
    await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, rejectedText);

  } else if (action === 'edit_email') {
    await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Opening email editor...', false);

    // Extract email preview from the approval message
    // Telegram strips ``` from text and stores code blocks as "pre" entities
    const msgText = callback_query.message.text || '';
    const entities = callback_query.message.entities || [];
    const preEntities = entities.filter(e => e.type === 'pre');
    const lastPre = preEntities[preEntities.length - 1];
    const emailBody = lastPre
      ? msgText.substring(lastPre.offset, lastPre.offset + lastPre.length).trim()
      : '';

    if (!emailBody) {
      await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, chatId,
        '⚠️ Could not extract email preview. Try Approve & Send instead.');
      return { ok: true };
    }

    // Send the email body as a reply with force_reply so user can edit it
    const editMsg = await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, chatId,
      `✏️ *Edit the email below*\nCopy this text, edit it, and reply with your version:\n\n\`\`\`\n${emailBody}\n\`\`\``,
      { reply_markup: { force_reply: true, selective: true } }
    );

    if (editMsg.ok && editMsg.result) {
      // Store edit session in KV (reverse lookup: bot message ID → approval data)
      const sessionData = {
        approvalId,
        chatId,
        originalMessageId: messageId,
        firmName: approvalData.firm_name,
        firmFolder: approvalData.firm_folder,
        contactName: approvalData.contact_name,
        leadEmail: approvalData.lead_email,
        reportUrl: approvalData.report_url,
        country: approvalData.country || '',
        totalRange: approvalData.total_range || '',
        totalCases: approvalData.total_cases || '',
        practiceLabel: approvalData.practice_label || '',
        classification: approvalData.classification || 'INTERESTED',
        channel: approvalData.channel || 'instantly',
        linkedinUrl: approvalData.linkedin_url || approvalData.linkedin || '',
        prospSender: approvalData.prosp_sender || '',
        source: approvalData.source || '',
        connectionDm: approvalData.connection_dm || ''
      };
      await env.WEBHOOK_KV.put(
        `edit_reply:${editMsg.result.message_id}`,
        JSON.stringify(sessionData),
        { expirationTtl: 1800 } // 30 min
      );
    }

  } else if (action === 'send_custom') {
    await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Sending custom email...', false);

    // Read custom email body from KV
    const customBody = await env.WEBHOOK_KV.get(`custom_email:${approvalId}`);
    if (!customBody) {
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        '❌ Custom email expired. Please press Edit Email again.');
      return { ok: true };
    }

    // The confirmation message won't have parseable approval fields,
    // so load the session data we stored during the reply step
    const sessionRaw = await env.WEBHOOK_KV.get(`custom_session:${approvalId}`);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      approvalData = {
        firm_name: session.firmName,
        firm_folder: session.firmFolder,
        lead_email: session.leadEmail,
        contact_name: session.contactName,
        report_url: session.reportUrl,
        country: session.country || '',
        total_range: session.totalRange || '',
        total_cases: session.totalCases || '',
        practice_label: session.practiceLabel || '',
        classification: session.classification || 'INTERESTED',
        channel: session.channel || 'instantly',
        linkedin_url: session.linkedinUrl || '',
        prosp_sender: session.prospSender || '',
        source: session.source || '',
        connection_dm: session.connectionDm || '',
        ...approvalData // overlay any data fetched from GitHub
      };
    }

    try {
      // Dispatch workflow with skip_email = "custom:{approvalId}" so it fetches custom body
      const payload = {
        event_type: 'send_approved_email',
        client_payload: {
          firm_name: approvalData.firm_name,
          firm_folder: approvalData.firm_folder,
          lead_email: approvalData.lead_email,
          contact_name: approvalData.contact_name,
          report_url: approvalData.report_url,
          country: approvalData.country || '',
          total_range: approvalData.total_range || '',
          total_cases: approvalData.total_cases || '',
          practice_label: approvalData.practice_label || '',
          _extra: JSON.stringify({
            classification: approvalData.classification || 'INTERESTED',
            skip_email: `custom:${approvalId}`,
            ooo_return_date: approvalData.ooo_return_date || '',
            channel: approvalData.channel || 'instantly',
            linkedin_url: approvalData.linkedin_url || approvalData.linkedin || '',
            prosp_sender: approvalData.prosp_sender || '',
            source: approvalData.source || '',
            connection_dm: approvalData.connection_dm || ''
          })
        }
      };

      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'User-Agent': 'MortarMetrics-Telegram-Bot'
        },
        body: JSON.stringify(payload)
      });

      if (response.status !== 204) {
        const errText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${errText}`);
      }

      const liveUrl = approvalData.report_url
        ? approvalData.report_url.replace('/pending-reports/', '/')
        : approvalData.report_url;

      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `✅ *APPROVED (Custom Email)*

📊 *Firm:* ${approvalData.firm_name}
👤 *Contact:* ${approvalData.contact_name}
📧 *Email:* ${approvalData.lead_email}
🔗 *Live Report:* ${liveUrl}

✉️ *Custom email send triggered!*`);

    } catch (err) {
      console.error('Failed to trigger custom email workflow:', err.message);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `❌ *ERROR*\n\nFailed to trigger workflow: ${err.message}`);
    }

  } else if (action === 'cancel_edit') {
    await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Cancelled', false);
    // Clean up KV
    await env.WEBHOOK_KV.delete(`custom_email:${approvalId}`);
    await env.WEBHOOK_KV.delete(`custom_session:${approvalId}`);
    await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
      '❌ *Edit cancelled.* Use the original approval message to approve or edit again.');
  }

  return { ok: true };
}
