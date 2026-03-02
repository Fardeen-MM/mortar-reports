/**
 * Cloudflare Worker: Instantly Webhook + Telegram Approval Handler
 *
 * Handles:
 * 1. Instantly webhooks → forwards to GitHub Actions
 * 2. Telegram callbacks → triggers email approval workflow
 * 3. Telegram /build commands → manually trigger report pipeline
 * 4. POST /view → report view tracking + follow-up triggers
 * 5. POST /store-lead → store lead metadata for view-triggered emails
 * 6. POST /queue-email → queue any email for Telegram approval
 * 7. AI reply classification (QUESTION/OBJECTION auto-responses)
 * 8. POST /prosp-webhook → Prosp LinkedIn DM webhook handling
 * 9. LinkedIn DM sending via Prosp API + DM queue with Telegram approval
 *
 * Required secrets: GITHUB_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * Optional secrets: INSTANTLY_API_KEY, ANTHROPIC_API_KEY, PROSP_API_KEY, PROSP_SENDER, PROSP_CAMPAIGN_ID
 */

const GITHUB_REPO = 'Fardeen-MM/mortar-reports';

// ============ TELEGRAM HANDLERS ============

async function answerCallback(botToken, callbackQueryId, text, showAlert = false) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: showAlert
    })
  });
  const result = await response.json();
  if (!result.ok) {
    console.error('answerCallback failed:', result.description || JSON.stringify(result));
  }
  return result;
}

async function editMessage(botToken, chatId, messageId, newText, replyMarkup) {
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: newText,
    parse_mode: 'Markdown'
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!result.ok) {
    console.error('editMessage failed:', result.description || JSON.stringify(result));
  }
  return result;
}

async function sendTelegramMsg(botToken, chatId, text, options = {}) {
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  };
  if (options.reply_markup) body.reply_markup = options.reply_markup;
  if (options.reply_to_message_id) body.reply_to_message_id = options.reply_to_message_id;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}

async function triggerGitHubWorkflow(githubToken, approvalData, skipEmail = false) {
  // GitHub limits client_payload to 10 properties — pack extras into _extra JSON
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
        skip_email: skipEmail ? 'true' : '',
        ooo_return_date: approvalData.ooo_return_date || '',
        channel: approvalData.channel || 'instantly',
        linkedin_url: approvalData.linkedin_url || approvalData.linkedin || '',
        prosp_sender: approvalData.prosp_sender || '',
        source: approvalData.source || '',
        connection_dm: approvalData.connection_dm || '',
        reply_text: approvalData.reply_text || ''
      })
    }
  };

  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${githubToken}`,
      'User-Agent': 'MortarMetrics-Telegram-Bot'
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 204) {
    return { success: true };
  } else {
    const text = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${text}`);
  }
}

async function fetchApprovalData(githubToken, firmFolder) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/automation/pending-approvals/${encodeURIComponent(firmFolder + '.json')}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${githubToken}`,
      'User-Agent': 'MortarMetrics-Telegram-Bot'
    }
  });

  if (response.status === 200) {
    const data = await response.json();
    const content = atob(data.content);
    return JSON.parse(content);
  }
  return null;
}

function parseMessageForApprovalData(message) {
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

async function handleTelegramCallback(env, update) {
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

// ============ CORS HELPERS ============

const ALLOWED_ORIGIN = 'https://reports.mortarmetrics.com';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

// ============ INSTANTLY SEND HELPER ============

/**
 * Send a reply email via Instantly API v2 directly from the Worker.
 * Looks up the lead's latest email UUID, then sends a threaded reply.
 */
async function sendInstantlyReply(apiKey, leadEmail, subject, html, text) {
  // Step 1: Look up lead's latest email for threading
  const lookupUrl = `https://api.instantly.ai/api/v2/emails?lead=${encodeURIComponent(leadEmail)}`;
  const lookupResp = await fetch(lookupUrl, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!lookupResp.ok) {
    const errText = await lookupResp.text();
    throw new Error(`Instantly email lookup failed: ${lookupResp.status} ${errText}`);
  }

  const lookupData = await lookupResp.json();
  const emails = lookupData.items || lookupData.data || (Array.isArray(lookupData) ? lookupData : []);

  if (!emails.length || !emails[0].id) {
    throw new Error(`No email thread found for ${leadEmail}`);
  }

  const replyToUuid = emails[0].id;
  const eaccount = emails[0].eaccount;

  // Step 2: Send threaded reply
  const replyResp = await fetch('https://api.instantly.ai/api/v2/emails/reply', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      eaccount,
      reply_to_uuid: replyToUuid,
      subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      body: { html, text }
    })
  });

  if (!replyResp.ok) {
    const errText = await replyResp.text();
    throw new Error(`Instantly send failed: ${replyResp.status} ${errText}`);
  }

  return replyResp.json();
}

// ============ PROSP (LINKEDIN DM) HELPERS ============

/**
 * Send a LinkedIn DM via Prosp API.
 * Plain text only (no HTML).
 */
async function sendProspDM(apiKey, linkedinUrl, senderUrl, message) {
  const resp = await fetch('https://prosp.ai/api/v1/leads/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      linkedin_url: linkedinUrl,
      sender: senderUrl,
      message: message
    })
  });
  if (!resp.ok) throw new Error(`Prosp send failed: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

/**
 * Normalize LinkedIn URLs for consistent KV keys.
 * "https://www.linkedin.com/in/name/" -> "linkedin.com/in/name"
 */
function normalizeLinkedInUrl(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '')
    .replace(/\/$/, '').toLowerCase();
}

// ============ QUEUED EMAIL INFRASTRUCTURE ============

/**
 * Queue an email for Telegram approval.
 * Stores in KV and sends Telegram message with Approve/Edit/Skip buttons.
 */
async function queueEmail(env, { type, to, subject, html, text, lead_email, firm_name, contact_name, context }) {
  const queueId = crypto.randomUUID();

  // Store email data in KV with 24hr TTL
  await env.WEBHOOK_KV.put(`queued_email:${queueId}`, JSON.stringify({
    type, to, subject, html, text, lead_email, firm_name, contact_name, context,
    queued_at: new Date().toISOString()
  }), { expirationTtl: 86400 });

  // Type-specific headers
  const typeHeaders = {
    'follow-up': '👀 VIEW FOLLOW-UP',
    'auto-reply': '🤖 AUTO-REPLY',
    'nurture': '📬 NURTURE EMAIL',
    'ooo-welcome-back': '✈️ OOO WELCOME BACK'
  };
  const header = typeHeaders[type] || '📧 QUEUED EMAIL';

  // Build preview — show full email (Telegram limit is 4096 chars)
  const preview = (text || '').slice(0, 2000).replace(/`/g, "'");

  // Escape markdown special chars in dynamic fields (but not our formatting)
  // Only strip chars that actually break Telegram Markdown v1: * _ ` [ ]
  const esc = s => (s || '').replace(/([_*`\[\]])/g, '');

  // For auto-replies, split context into classification + lead's reply for better visibility
  let contextBlock = '';
  if (context) {
    contextBlock = `ℹ️ *Context:* ${esc(context)}`;
  }

  const msg = `${header}

📊 *Firm:* ${esc(firm_name) || 'Unknown'}
👤 *To:* ${esc(contact_name) || to}
📧 *Email:* ${to}
📝 *Subject:* ${esc(subject)}
${contextBlock}

*Our Reply:*
\`\`\`
${preview}
\`\`\``;

  const result = await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, msg, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Approve & Send', callback_data: `approve_queued:${queueId}` },
          { text: '✏️ Edit', callback_data: `edit_queued:${queueId}` },
          { text: '⏭️ Skip', callback_data: `skip_queued:${queueId}` }
        ]
      ]
    }
  });

  if (!result.ok) {
    console.error('Telegram send failed for queued email:', result.description || JSON.stringify(result));
  }

  return { ok: true, queue_id: queueId };
}

// ============ QUEUED DM INFRASTRUCTURE ============

/**
 * Queue a LinkedIn DM for Telegram approval.
 * Mirrors queueEmail() but for Prosp DMs.
 */
async function queueDM(env, { type, linkedin_url, sender, message, contact_name, firm_name, context }) {
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

// ============ AI HELPERS ============

/**
 * Call Claude Haiku for classification or generation.
 */
async function callHaiku(anthropicKey, systemPrompt, userPrompt, maxTokens = 300) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Haiku API error: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text?.trim() || '';
}

/**
 * Classify a reply using Claude Haiku. Falls back to pattern matching on failure.
 */
async function classifyReplyAI(text, anthropicKey) {
  if (!text || !text.trim()) {
    return { category: 'INTERESTED', confidence: 0.5, summary: 'Empty reply — treated as interested' };
  }

  // Strip quoted text first
  const stripped = text
    .split('\n')
    .filter(line => !line.trim().startsWith('>') && !/^On .+ wrote:$/i.test(line.trim()))
    .join('\n')
    .trim();

  if (!stripped) {
    return { category: 'INTERESTED', confidence: 0.5, summary: 'Only quoted text — treated as interested' };
  }

  if (!anthropicKey) {
    // Fallback to pattern matching
    return classifyReplyFallback(stripped);
  }

  try {
    const result = await callHaiku(
      anthropicKey,
      `You classify email replies to cold outreach from a legal marketing agency. Reply with ONLY a JSON object.`,
      `Classify this reply into exactly one category. Reply with JSON only, no other text.

Categories:
- INTERESTED: Genuinely wants to learn more, positive reply, "tell me more", "sounds good", "yes", "let's talk"
- QUESTION: Asks a specific question about services, pricing, process (NOT requests to stop/remove/unsubscribe that happen to contain a question mark)
- OBJECTION: Pushes back but hasn't firmly said no — "we already have a marketing company", "not sure we need this"
- NOT_INTERESTED: Any form of decline — "not interested", "no thanks", "no", "I'm retired", "no longer practicing", "left the firm", "wrong person", "I must pass", "pass", "we don't market", "we don't need this", "doesn't fit our model", "we rely on word of mouth", "we are swamped"
- UNSUBSCRIBE: Wants off the list — "unsubscribe", "remove me", "stop emailing", "stop", "STOP", "stop spamming", "cease and desist", "refrain from further emails", "remove from list", "please remove [name] from your list"
- OOO: Out of office auto-reply, mentions working days, on vacation, on leave, returning on a date
- IRRELEVANT: System/bounce messages, delivery failures ("was not delivered"), spam filter auto-replies ("I apologize for this automatic reply. To control spam..."), security alerts, "not a law firm", challenge-response systems

IMPORTANT rules:
- "Stop" by itself = UNSUBSCRIBE, not INTERESTED
- "Please refrain from further emails" = UNSUBSCRIBE, not INTERESTED
- "I am retired" = NOT_INTERESTED, not INTERESTED
- "STOP SPAMMING ME" = UNSUBSCRIBE, not INTERESTED
- "Please remove [someone] from your list" = UNSUBSCRIBE, not QUESTION
- Short angry messages like "stop", "no", "leave me alone" = UNSUBSCRIBE or NOT_INTERESTED
- Auto-reply spam filter messages = IRRELEVANT, not QUESTION
- Delivery failure notifications = IRRELEVANT, not INTERESTED
- Only classify as INTERESTED if the person is genuinely expressing interest in learning more

If OOO: also extract the return date if mentioned (e.g. "back on January 15", "returning Monday the 20th", "out until Feb 3"). Convert to YYYY-MM-DD format. If no return date is mentioned, set return_date to null.

Reply text:
"""
${stripped.slice(0, 500)}
"""

Respond with: {"category":"...","confidence":0.0-1.0,"summary":"one line summary","return_date":"YYYY-MM-DD or null"}`,
      200
    );

    if (!result || !result.trim()) {
      console.warn('Empty AI classification result, using fallback');
      return classifyReplyFallback(stripped);
    }
    const parsed = JSON.parse(result);
    if (parsed.category && ['INTERESTED','QUESTION','OBJECTION','NOT_INTERESTED','UNSUBSCRIBE','OOO','IRRELEVANT'].includes(parsed.category)) {
      // Sanity check: if AI says INTERESTED but fallback detects a negative signal, trust the fallback
      // This catches cases where AI misreads short "No." or "Stop" replies as interested
      if (parsed.category === 'INTERESTED') {
        const fallback = classifyReplyFallback(stripped);
        if (['NOT_INTERESTED', 'UNSUBSCRIBE', 'IRRELEVANT'].includes(fallback.category) && fallback.confidence >= 0.8) {
          console.warn(`AI said INTERESTED but fallback detected ${fallback.category} (${fallback.confidence}) — using fallback`);
          return fallback;
        }
      }
      return parsed;
    }
    return classifyReplyFallback(stripped);
  } catch (e) {
    console.error('AI classification failed, using fallback:', e.message);
    return classifyReplyFallback(stripped);
  }
}

/**
 * Pattern-matching fallback classifier (original logic expanded to 7 categories).
 */
function classifyReplyFallback(text) {
  const lower = text.toLowerCase();

  // Extract just the lead's own text (before any quoted/forwarded/signature content)
  const ownText = lower.split(/\n\s*>|\n\s*-{3,}|\n\s*_{3,}|\nfrom:|\non .+ wrote:|\nsincerely|\nregards|\nbest regards|\nsent from|\nget outlook|\n-- \n/i)[0].trim();

  // SYSTEM/BOUNCE emails — detect before anything else
  const systemPatterns = ['mail delivery failed', 'undeliverable', 'delivery status notification',
    'message not delivered', 'couldn\'t be delivered', 'returned to sender',
    'non-delivery report', 'mailbox unavailable', 'mailbox not found',
    'security alert', 'security issue', 'suspicious activity',
    'verify your account', 'confirm your identity', 'quarantine',
    'message quarantined', 'held for review', 'blocked by', 'spam filter',
    'action required:', 'has been blocked', 'message rejected',
    'was not delivered to', 'email message was not delivered',
    'this message triggered', 'correlated intelligence', 'security risks'];
  if (systemPatterns.some(p => lower.includes(p))) {
    return { category: 'IRRELEVANT', confidence: 0.95, summary: 'System/bounce/security message' };
  }

  // Auto-reply / spam filter challenges — NOT real human replies
  if (/i apologize for this automatic reply|to control spam|your message has been|challenge.?response|not on my approved/i.test(lower)) {
    return { category: 'IRRELEVANT', confidence: 0.9, summary: 'Auto-reply spam filter' };
  }

  // Not a law firm / wrong type of company
  if (/not a law firm|not a lawyer|not an attorney|we are not a/i.test(lower)) {
    return { category: 'IRRELEVANT', confidence: 0.9, summary: 'Not a law firm' };
  }

  const unsubPatterns = ['unsubscribe', 'remove me from', 'stop emailing', 'opt out', 'opt-out',
    'take me off', 'remove my email', 'stop contacting', 'remove from list',
    'remove from your list', 'cease and desist', 'refrain from',
    'further emails', 'future emails', 'please remove',
    'don\'t contact', 'don\'t email', 'do not email', 'stop spamming',
    'remove from your', 'remove from mailing', 'remove .+ from .+ list'];
  if (unsubPatterns.some(p => lower.includes(p))) {
    return { category: 'UNSUBSCRIBE', confidence: 0.9, summary: 'Unsubscribe request' };
  }

  // Short "stop" messages (1-2 words, just "stop" or "stop." or "stop!")
  if (/^\s*stop[\s.!]*$/i.test(ownText)) {
    return { category: 'UNSUBSCRIBE', confidence: 0.85, summary: 'Stop request' };
  }

  const notIntPatterns = ['not interested', 'no thank', 'no, thank', 'please stop', 'leave me alone',
    'do not contact', 'not for us', 'not for me', 'pass on this', 'we\'re good',
    'we are good', 'no need', 'not looking', 'not in the market',
    'i am retired', 'i\'m retired', 'i have retired', 'i\'ve retired',
    'no longer practic', 'no longer with', 'left the firm', 'no longer at',
    'wrong person', 'wrong email', 'doesn\'t work here',
    'i must pass', 'i\'ll pass', 'we don\'t market', 'we don\'t advertise',
    'we don\'t need', 'not for our firm', 'doesn\'t fit',
    'we rely on word of mouth', 'word of mouth', 'we are swamped',
    'don\'t need marketing', 'don\'t need your'];
  if (notIntPatterns.some(p => lower.includes(p))) {
    return { category: 'NOT_INTERESTED', confidence: 0.8, summary: 'Not interested' };
  }

  // Short "no" messages (1-2 words, just "no" or "no.")
  if (/^\s*no[\s.!]*$/i.test(ownText)) {
    return { category: 'NOT_INTERESTED', confidence: 0.8, summary: 'No' };
  }

  if (/out of (the )?office|auto[- ]?reply|on leave|on vacation|will return|i('m| am) away|normal working days|working days are/i.test(lower)) {
    return { category: 'OOO', confidence: 0.9, summary: 'Out of office', return_date: null };
  }

  // Only mark as QUESTION if the lead's own text (before signatures/quotes) has a question mark
  if (ownText.includes('?')) {
    return { category: 'QUESTION', confidence: 0.6, summary: 'Contains question' };
  }

  if (/already have|already work|not sure|not the right|maybe later|bad time/i.test(lower)) {
    return { category: 'OBJECTION', confidence: 0.6, summary: 'Possible objection' };
  }

  return { category: 'INTERESTED', confidence: 0.5, summary: 'Default positive classification' };
}

/**
 * Generate an auto-response for QUESTION or OBJECTION replies.
 */
async function generateAutoResponse(category, replyText, firmName, contactName, anthropicKey, pipelineContext) {
  const ctx = pipelineContext || {};
  const systemPrompt = `You are Fardeen from Mortar Metrics. We help law firms find untapped revenue in their local market — we build data-driven market breakdowns that show exactly how many cases their area supports vs what they're currently getting, then we run the marketing (Google Ads, Meta Ads, intake systems) to close that gap.

You're a confident, sharp salesman who genuinely cares about helping firms grow. You write short, conversational emails. No marketing speak. No exclamation marks. No em dashes. Sound like a real person texting a colleague. Never include a sign-off or signature at the end.${(category !== 'NOT_INTERESTED' && category !== 'UNSUBSCRIBE') ? ' Every reply should move toward booking a 15-minute call.' : ''}`;

  // Build situation context for the AI
  const lead = contactName || 'the partner';
  const firm = firmName || 'a law firm';
  const reply = replyText.slice(0, 500);

  let situation = '';
  if (ctx.isNurtureLead) {
    situation = `This is an ENGAGED lead who was originally interested. They received a personalized marketing report for their firm and ${ctx.emailsSent ? ctx.emailsSent + ' nurture emails' : 'follow-up emails'} from us. They are replying to one of those emails. This is NOT a cold rejection — they've been reading our emails.`;
  } else if (ctx.hasReport) {
    situation = `This lead was originally interested and already received a personalized marketing report. They are replying after seeing the report. This is NOT a cold rejection.`;
  } else {
    situation = `This lead replied to our outreach email where we mentioned we ran the numbers on their market and found a gap in cases they could be getting. We're building them a personalized market breakdown. They haven't seen it yet — it's being generated now.`;
  }

  // NOT_INTERESTED / UNSUBSCRIBE: respectful but still leave a compelling door open
  let guidelines;
  if (category === 'UNSUBSCRIBE') {
    guidelines = `Write a very short reply (1-2 sentences). This person wants off the list. Fully respect that.

Guidelines:
- Acknowledge briefly. "Understood" or "Got it, no worries."
- Mention we already put together a breakdown for their firm before hearing back. Drop a line like "it's sitting there if you ever want a look" but don't push it.
- No CTA. No meeting ask. Just warm and respectful.
- If they were aggressive, be extra brief and professional.`;
  } else if (category === 'NOT_INTERESTED') {
    guidelines = `Write a short reply (2-3 sentences). This person said no. Respect that — but leave a compelling door open.

Guidelines:
- Acknowledge their response genuinely. Keep it real, not corporate.
- Don't hard-sell or try to change their mind.
- Mention we're putting together a quick breakdown of their market anyway (free, no strings) and we'll send it over in case they ever want to take a look.
- End with something like "if the numbers catch your eye, happy to walk through them on a quick call" — soft, zero-pressure CTA.
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
- Genuinely acknowledge what they said first — show you actually read it
- Reference specific things about their market or practice area if you have the info
- Be confident in the results we deliver. We've helped firms in similar markets and similar positions
- If they raise concerns about their market size, costs, or competition — reframe it. Less competition = easier to dominate. Small market = lower ad costs = better ROI
- If they ask a question, answer it directly and specifically, then pivot: "happy to walk through the full breakdown — does tomorrow or Friday work for a quick 15?"
- If they're positive/interested, match their energy and make booking the obvious next step: "love it — let's jump on a quick call this week. Tomorrow or Thursday work?"
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

// ============ NURTURE REPLY HANDLER ============

/**
 * Handle a reply from a lead who is in the nurture sequence.
 * Pauses nurture, generates auto-reply, sends Telegram with action buttons.
 */
async function handleNurtureReply(env, email, replyText, classification, nurtureData, leadData) {
  const cat = classification.category;
  const firmName = nurtureData.firm_name || leadData?.firm_name || '';
  const contactName = nurtureData.contact_name || leadData?.contact_name || '';
  const emailsSent = nurtureData.emails_sent || 0;

  // OOO → auto-send casual reply, keep paused with return date, no Telegram ping
  if (cat === 'OOO') {
    // Extract or default return date (5 days from now)
    let returnDate = classification.return_date || null;
    if (!returnDate) {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      returnDate = d.toISOString().split('T')[0];
    }

    nurtureData.status = 'paused';
    nurtureData.paused_at = new Date().toISOString();
    nurtureData.pause_reason = 'ooo';
    nurtureData.ooo_return_date = returnDate;
    await env.WEBHOOK_KV.put(`nurture:${email}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });

    if (env.ANTHROPIC_API_KEY && env.INSTANTLY_API_KEY) {
      const autoReply = await generateAutoResponse(cat, replyText, firmName, contactName, env.ANTHROPIC_API_KEY, {
        isNurtureLead: true,
        hasReport: true,
        emailsSent: emailsSent,
        city: nurtureData.city || '',
        practiceLabel: nurtureData.practice_label || ''
      });
      if (autoReply) {
        try {
          const replyHtml = autoReply.replace(/\n/g, '<br>');
          await sendInstantlyReply(env.INSTANTLY_API_KEY, email, 'Re: Your marketing analysis', replyHtml, autoReply);
          console.log(`OOO auto-reply sent to nurture lead ${email}`);
        } catch (e) {
          console.log(`OOO auto-reply send failed for nurture lead ${email}: ${e.message}`);
        }
      }
    }

    return;
  }

  // Everything else (including UNSUBSCRIBE): pause nurture + generate auto-reply + Telegram buttons
  nurtureData.status = 'paused';
  nurtureData.paused_at = new Date().toISOString();
  nurtureData.pause_reason = 'lead_replied';
  nurtureData.last_reply_text = (replyText || '').slice(0, 500);
  nurtureData.last_reply_category = cat;
  nurtureData.last_reply_at = new Date().toISOString();
  await env.WEBHOOK_KV.put(`nurture:${email}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });

  // Generate auto-reply with full pipeline context
  let autoReply = null;
  if (env.ANTHROPIC_API_KEY) {
    autoReply = await generateAutoResponse(cat, replyText, firmName, contactName, env.ANTHROPIC_API_KEY, {
      isNurtureLead: true,
      hasReport: true,
      emailsSent: emailsSent,
      city: nurtureData.city || '',
      practiceLabel: nurtureData.practice_label || '',
      reportUrl: nurtureData.report_url || ''
    });
  }

  const queueId = crypto.randomUUID();

  // Store auto-reply context for button handlers
  await env.WEBHOOK_KV.put(`nurture_reply:${queueId}`, JSON.stringify({
    email, firmName, contactName, replyText: (replyText || '').slice(0, 500),
    category: cat, autoReply, emailsSent
  }), { expirationTtl: 86400 });

  // Classification badge
  const badges = {
    INTERESTED: '🟢 INTERESTED',
    QUESTION: '❓ QUESTION',
    OBJECTION: '🟡 OBJECTION',
    NOT_INTERESTED: '🔴 NOT INTERESTED',
    UNSUBSCRIBE: '⛔ UNSUBSCRIBE',
    IRRELEVANT: '⚪ IRRELEVANT'
  };
  const badge = badges[cat] || cat;
  const confidence = Math.round((classification.confidence || 0) * 100);
  const esc = s => (s || '').replace(/([_*`\[\]])/g, '');

  let msg = `🔔 *NURTURE LEAD REPLIED*\n\n${badge} (${confidence}%)\n📊 *Firm:* ${esc(firmName)}\n📧 *Email:* ${email}\n📬 *Progress:* ${emailsSent}/7 sent, now PAUSED`;

  msg += `\n\n*Their reply:*\n\`\`\`\n${(replyText || '').slice(0, 400).replace(/`/g, "'")}\n\`\`\``;

  if (autoReply) {
    msg += `\n\n*Suggested response:*\n\`\`\`\n${autoReply.slice(0, 600).replace(/`/g, "'")}\n\`\`\``;
  }

  const buttons = [];
  if (autoReply) {
    buttons.push([
      { text: '✅ Send + Stop Nurture', callback_data: `nr_send_stop:${queueId}` },
      { text: '✅ Send + Continue', callback_data: `nr_send_continue:${queueId}` }
    ]);
  }
  buttons.push([
    { text: '✏️ Edit Reply', callback_data: `nr_edit:${queueId}` },
    { text: '⏭️ Skip Reply', callback_data: `nr_skip:${queueId}` }
  ]);

  try {
    await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, msg, {
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (tgErr) {
    console.error(`Failed to send nurture reply Telegram msg for ${email}:`, tgErr.message);
  }
}

// ============ VIEW TRACKING ============

async function handleViewTrack(env, body) {
  const { email, firm, ts } = body;
  if (!firm) return { ok: false, error: 'missing firm' };

  // Rate limit: skip if last view < 5 minutes ago
  const lastView = await env.WEBHOOK_KV.get(`view_last:${firm}`);
  if (lastView) {
    const elapsed = Date.now() - parseInt(lastView, 10);
    if (elapsed < 300000) {
      return { ok: true, message: 'rate limited' };
    }
  }

  // Record timestamp
  await env.WEBHOOK_KV.put(`view_last:${firm}`, String(Date.now()), { expirationTtl: 600 });

  // Increment view counter
  const countRaw = await env.WEBHOOK_KV.get(`views:${firm}`);
  const count = (parseInt(countRaw, 10) || 0) + 1;
  await env.WEBHOOK_KV.put(`views:${firm}`, String(count));

  console.log(`View tracked for ${firm}: view #${count}`);

  // Look up lead metadata
  const leadRaw = await env.WEBHOOK_KV.get(`lead:${firm}`);
  const lead = leadRaw ? JSON.parse(leadRaw) : null;

  if (count === 1 && lead) {
    // First view: queue a follow-up email (value-add, not sales)
    const followUpText = `Hi ${lead.contact_name || 'there'},

Just noticed you had a chance to look at the report we put together for ${lead.firm_name || 'your firm'}.

Happy to walk through any of the numbers — the competitor data and the gap estimates are the parts most firms find most useful.

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
    // Hot lead alert — no email, just Telegram notification
    const emoji = count >= 10 ? '🔥🔥🔥' : count >= 5 ? '🔥🔥' : '🔥';
    const msg = `${emoji} *HOT LEAD ALERT*

📊 *Firm:* ${lead.firm_name || firm}
👤 *Contact:* ${lead.contact_name || 'Unknown'}
📧 *Email:* ${lead.email || 'Unknown'}
👁️ *Report views:* ${count}

This lead keeps coming back to their report. Consider reaching out.`;

    await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, msg);
  }

  return { ok: true, views: count };
}

// ============ STORE LEAD METADATA ============

async function handleStoreLead(env, body) {
  const { email, firm_name, contact_name, report_url, practice_label, country, firm_folder, linkedin_url } = body;
  if (!firm_folder) return { ok: false, error: 'missing firm_folder' };

  const data = { email, firm_name, contact_name, report_url, practice_label, country, linkedin_url, stored_at: new Date().toISOString() };
  await env.WEBHOOK_KV.put(`lead:${firm_folder}`, JSON.stringify(data), { expirationTtl: 2592000 }); // 30 days

  // Also index by email for nurture lookups
  if (email) {
    await env.WEBHOOK_KV.put(`lead_by_email:${email}`, JSON.stringify(data), { expirationTtl: 2592000 });
  }

  // Also index by LinkedIn URL for Prosp lookups
  if (linkedin_url) {
    const normalizedLi = normalizeLinkedInUrl(linkedin_url);
    if (normalizedLi) {
      await env.WEBHOOK_KV.put(`lead_by_linkedin:${normalizedLi}`, JSON.stringify(data), { expirationTtl: 2592000 });
    }
  }

  console.log(`Stored lead metadata for ${firm_folder} (${email || linkedin_url || 'unknown'})`);
  return { ok: true };
}

// ============ INSTANTLY HANDLER ============

// Instantly sends TWO webhooks per lead reply (campaign-level and workspace-level).
// One has lead data (website, company, city), the other has email data.
// Each webhook stores to a unique slot key (wh:<email>|<random>), then does KV.list()
// to find+merge all slots. If 2+ found, dispatch merged immediately.
// Otherwise a 20s waitUntil fallback dispatches whatever we have.

// Helper: dig into nested objects (payload.lead, payload.contact, etc.)
function dig(payload, ...keys) {
  for (const key of keys) {
    const val = payload[key];
    if (val && typeof val === 'string' && val.trim()) return val.trim();
  }
  // Check nested objects
  const nested = payload.lead || payload.contact || payload.lead_data || payload.data || {};
  for (const key of keys) {
    const val = nested[key];
    if (val && typeof val === 'string' && val.trim()) return val.trim();
  }
  return '';
}

function buildGithubPayload(payload) {
  // Combine city + state into single `location` field (pipe-separated) to free a payload slot for _meta
  const city = dig(payload, 'city', 'City', 'lead_city', 'location_city');
  const state = dig(payload, 'state', 'State', 'lead_state', 'location_state', 'province', 'Province', 'region');
  const location = city || state ? `${city}|${state}` : '';

  const built = {
    event_type: 'interested_lead',
    client_payload: {
      email: dig(payload, 'lead_email', 'email', 'Email', 'email_address', 'emailAddress', 'to_email'),
      first_name: dig(payload, 'first_name', 'firstName', 'First Name', 'first', 'lead_first_name'),
      last_name: dig(payload, 'last_name', 'lastName', 'Last Name', 'last', 'lead_last_name'),
      website: dig(payload, 'website', 'companyUrl', 'company_url', 'Website', 'company_website',
        'lead_website', 'url', 'domain', 'companyDomain', 'company_domain'),
      location: location,
      country: dig(payload, 'country', 'Country', 'lead_country', 'location_country', 'country_code'),
      company: dig(payload, 'company', 'companyName', 'company_name', 'Company', 'organization',
        'Organization', 'lead_company', 'lead_company_name'),
      job_title: dig(payload, 'jobTitle', 'job_title', 'title', 'Title', 'lead_title'),
      linkedin: dig(payload, 'linkedIn', 'linkedin', 'LinkedIn', 'linkedin_url', 'lead_linkedin'),
      _meta: '' // placeholder — populated during merge/dispatch
    }
  };

  // Guard: if first_name is just the email local part AND looks like garbage, clear it
  // Real names (kole, chad, emma) should be kept even if they match the email prefix
  let clearedByGuard = false;
  if (built.client_payload.first_name && built.client_payload.email) {
    const local = built.client_payload.email.split('@')[0].toLowerCase();
    if (built.client_payload.first_name.toLowerCase() === local) {
      const hasVowels = /[aeiou]/i.test(local);
      const isGeneric = /^(info|contact|admin|office|support|hello|team|legal|law|mail|enquiries|help)$/.test(local);
      const isTooShort = local.length <= 2;
      const isInitials = local.length <= 5 && !hasVowels;
      if (isGeneric || isTooShort || isInitials) {
        console.log(`first_name "${built.client_payload.first_name}" matches email local part and looks like garbage - clearing`);
        built.client_payload.first_name = '';
        built.client_payload.last_name = '';
        clearedByGuard = true;
      } else {
        console.log(`first_name "${built.client_payload.first_name}" matches email local part but looks like a real name - keeping`);
      }
    }
  }

  // Recovery: if first_name was cleared or missing, try fullName/name field from payload
  if (!built.client_payload.first_name) {
    const fullName = dig(payload, 'fullName', 'full_name', 'Full Name', 'name', 'lead_name', 'contact_name');
    if (fullName && fullName.trim().includes(' ')) {
      const parts = fullName.trim().split(/\s+/);
      built.client_payload.first_name = parts[0];
      built.client_payload.last_name = parts.slice(1).join(' ');
      console.log(`Recovered name from fullName field: "${fullName}" -> first="${built.client_payload.first_name}" last="${built.client_payload.last_name}"`);
    }
  }

  // No email-based name extraction here — the workflow QC has better name recovery
  // (team member matching, initials matching, etc.)

  return built;
}

async function forwardToGitHub(env, githubPayload) {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Cloudflare-Worker-Instantly-Proxy'
    },
    body: JSON.stringify(githubPayload)
  });

  if (response.status !== 204) {
    const errorText = await response.text();
    throw new Error(`GitHub error: ${response.status} ${errorText}`);
  }
}

// Merge two GitHub payloads - for each field, keep whichever is non-empty.
// For name fields, prefer the longer value (real name beats email-prefix garbage).
function mergePayloads(a, b) {
  const merged = { event_type: 'interested_lead', client_payload: {} };
  const allFields = new Set([...Object.keys(a.client_payload), ...Object.keys(b.client_payload)]);
  const preferLonger = new Set(['first_name', 'last_name', 'company', 'job_title', 'linkedin']);
  const skipFields = new Set(['_meta']); // _meta is built at dispatch time, not merged
  for (const field of allFields) {
    if (skipFields.has(field)) { merged.client_payload[field] = ''; continue; }
    const valA = a.client_payload[field] || '';
    const valB = b.client_payload[field] || '';
    if (preferLonger.has(field) && valA && valB) {
      merged.client_payload[field] = valA.length >= valB.length ? valA : valB;
    } else {
      merged.client_payload[field] = valA || valB || '';
    }
  }
  return merged;
}

// Legacy sync classifier — kept as bridge. AI classifier is used in listMergeDispatch.
function classifyReply(replyText) {
  const result = classifyReplyFallback(replyText || '');
  if (['NOT_INTERESTED', 'UNSUBSCRIBE'].includes(result.category)) return 'negative';
  return 'positive';
}

// Send a Telegram notification with classification badge
async function sendTelegramNotification(env, email, replyText, classification) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.log('No Telegram credentials, skipping notification');
    return;
  }

  // Classification badge mapping
  const badges = {
    INTERESTED: '🟢 INTERESTED',
    QUESTION: '❓ QUESTION',
    OBJECTION: '🟡 OBJECTION',
    NOT_INTERESTED: '🔴 NOT INTERESTED',
    UNSUBSCRIBE: '⛔ UNSUBSCRIBE',
    OOO: '✈️ OUT OF OFFICE',
    IRRELEVANT: '⚪ IRRELEVANT'
  };

  const cat = typeof classification === 'object' ? classification.category : classification;
  const badge = badges[cat] || `🔴 ${cat}`;
  const summary = typeof classification === 'object' ? classification.summary : '';
  const confidence = typeof classification === 'object' ? ` (${Math.round((classification.confidence || 0) * 100)}%)` : '';

  const msg = `${badge}${confidence}

*Email:* ${email}
${summary ? `*Summary:* ${summary}\n` : ''}
\`\`\`
${(replyText || '').slice(0, 400)}
\`\`\``;

  try {
    await sendTelegramMsg(botToken, chatId, msg);
  } catch (e) {
    console.error('Telegram notification failed:', e.message);
  }
}

// ============ TELEGRAM /build COMMAND ============

function parseBuildCommand(text) {
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

async function sendTelegramReply(env, chatId, replyToMessageId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        reply_to_message_id: replyToMessageId,
        parse_mode: 'Markdown'
      })
    });
  } catch (e) {
    console.error('Telegram reply failed:', e.message);
  }
}

async function handleTelegramMessage(env, payload) {
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

// Helper: list all webhook slots for an email, merge them, dispatch, and clean up.
// Returns true if dispatched, false if nothing to dispatch.
async function listMergeDispatch(env, email, minSlots) {
  const keys = await env.WEBHOOK_KV.list({ prefix: `wh:${email}|` });
  console.log(`listMergeDispatch(${email}): found ${keys.keys.length} slot(s) (need ${minSlots})`);

  if (keys.keys.length < minSlots) return false;

  // Read all slots — separate GitHub payload from extra fields
  let merged = null;
  let collectedExtra = { _reply_text: '', _campaign_name: '', _phone: '', _timestamp: '' };

  for (const key of keys.keys) {
    const raw = await env.WEBHOOK_KV.get(key.name, { type: 'json' });
    if (!raw) continue;

    // Extract _extra before merging (not a GitHub payload field)
    const extra = raw._extra || {};
    delete raw._extra;

    // Merge GitHub payload fields
    merged = merged ? mergePayloads(merged, raw) : raw;

    // Collect extra fields — prefer non-empty values
    for (const k of Object.keys(collectedExtra)) {
      if (extra[k] && !collectedExtra[k]) collectedExtra[k] = extra[k];
    }
  }

  if (!merged) return false;

  // Set done flag BEFORE dispatching to prevent other timers from also dispatching
  await env.WEBHOOK_KV.put(`done:${email}`, 'true', { expirationTtl: 300 });

  // Build _meta JSON with extra data (truncate reply to 500 chars)
  const replyText = collectedExtra._reply_text;

  // AI-powered reply classification
  const classification = await classifyReplyAI(replyText, env.ANTHROPIC_API_KEY);
  console.log(`Classification for ${email}: ${classification.category} (${classification.confidence})`);

  const meta = {
    reply_text: replyText ? replyText.slice(0, 500) : '',
    campaign_name: collectedExtra._campaign_name,
    phone: collectedExtra._phone,
    timestamp: collectedExtra._timestamp,
    classification: classification.category
  };
  merged.client_payload._meta = JSON.stringify(meta);

  // Helper: clean up webhook slot keys before returning
  async function cleanupSlots() {
    for (const key of keys.keys) {
      await env.WEBHOOK_KV.delete(key.name);
    }
  }

  // Check if lead is in a nurture sequence — if so, route to nurture reply handler
  const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${email}`);
  if (nurtureRaw) {
    const nurtureData = JSON.parse(nurtureRaw);
    if (nurtureData.status === 'active' || nurtureData.status === 'paused') {
      console.log(`Nurture lead replied: ${email} (status=${nurtureData.status}, ${nurtureData.emails_sent || 0}/7 sent)`);
      const leadRaw = await env.WEBHOOK_KV.get(`lead_by_email:${email}`);
      const leadData = leadRaw ? JSON.parse(leadRaw) : null;
      await handleNurtureReply(env, email, replyText, classification, nurtureData, leadData);
      // Don't dispatch to GitHub for report generation — they already have a report
      await cleanupSlots();
      return true;
    }
  }

  // OOO: auto-send a casual reply + trigger report pipeline (fall through to forwardToGitHub)
  if (classification.category === 'OOO') {
    console.log(`OOO from ${email}, auto-sending casual reply + triggering report`);

    // Extract or default return date (5 days from now if not specified)
    let returnDate = classification.return_date || null;
    if (!returnDate) {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      returnDate = d.toISOString().split('T')[0];
    }

    await env.WEBHOOK_KV.put(`ooo:${email}`, JSON.stringify({
      detected_at: new Date().toISOString(),
      return_date: returnDate
    }), { expirationTtl: 604800 }); // 7 days

    // Don't auto-send OOO reply for non-nurture leads — let the approval workflow handle it.
    // The report pipeline will still trigger (fall through below) with OOO flag,
    // and the approval workflow will hold the email until their return date.
    console.log(`OOO lead ${email} — skipping auto-reply, will use approval workflow`);

    // Add return date to _meta for the workflow
    meta.ooo_return_date = returnDate;
    merged.client_payload._meta = JSON.stringify(meta);

    // DON'T return — fall through to forwardToGitHub to trigger report pipeline
  }

  // QUESTION, OBJECTION, NOT_INTERESTED, or UNSUBSCRIBE: generate auto-reply + queue for approval + ALSO dispatch report
  const replyCategories = ['QUESTION', 'OBJECTION', 'NOT_INTERESTED', 'UNSUBSCRIBE'];
  if (replyCategories.includes(classification.category) && env.ANTHROPIC_API_KEY) {
    const contactName = merged.client_payload.first_name || '';
    const company = merged.client_payload.company || '';

    const autoReply = await generateAutoResponse(
      classification.category, replyText, company, contactName, env.ANTHROPIC_API_KEY, {
        hasReport: false,
        city: merged.client_payload.location || '',
        campaignName: collectedExtra._campaign_name || '',
        jobTitle: merged.client_payload.job_title || ''
      }
    );

    if (autoReply && env.INSTANTLY_API_KEY) {
      // Include the lead's actual reply in context so it's visible in Telegram
      const replyPreview = replyText ? replyText.slice(0, 300).replace(/\n/g, ' ') : '';
      const contextLine = replyPreview
        ? `${classification.category}: "${replyPreview}"`
        : `${classification.category}: ${classification.summary}`;
      await queueEmail(env, {
        type: 'auto-reply',
        to: email,
        subject: 'Re: Your marketing analysis',
        html: autoReply.replace(/\n/g, '<br>'),
        text: autoReply,
        lead_email: email,
        firm_name: company,
        contact_name: contactName,
        context: contextLine
      });
    }

    // queueEmail already sends its own Telegram approval message — no extra ping needed
  }

  // All non-OOO, non-nurture categories dispatch to GitHub for report generation
  console.log('DISPATCHING MERGED PAYLOAD:', JSON.stringify(merged));
  await forwardToGitHub(env, merged);

  // Clean up slot keys
  await cleanupSlots();

  return true;
}

async function handleInstantlyWebhook(env, payload, ctx) {
  const email = payload.lead_email || payload.email || 'unknown';
  const githubPayload = buildGithubPayload(payload);

  // Extract extra fields from raw payload (reply_text comes from workspace webhook)
  const extraFields = {
    _reply_text: dig(payload, 'reply_text', 'reply', 'message', 'body', 'text_body', 'email_body') || '',
    _campaign_name: dig(payload, 'campaign_name', 'campaignName', 'campaign', 'Campaign') || '',
    _phone: dig(payload, 'phone', 'Phone', 'phone_number', 'lead_phone') || '',
    _timestamp: payload.timestamp || payload.created_at || new Date().toISOString()
  };

  console.log(`Instantly webhook for ${email}: website=${githubPayload.client_payload.website || 'none'}, company=${githubPayload.client_payload.company || 'none'}`);

  // Already dispatched for this email? (from a previous webhook pair)
  const dispatched = await env.WEBHOOK_KV.get(`done:${email}`);
  if (dispatched) {
    console.log(`Already dispatched for ${email}, ignoring`);
    return { success: true, message: 'Already dispatched' };
  }

  // Store this webhook + extra fields under a unique slot key
  const slotData = { ...githubPayload, _extra: extraFields };
  const slot = crypto.randomUUID().slice(0, 8);
  await env.WEBHOOK_KV.put(`wh:${email}|${slot}`, JSON.stringify(slotData), { expirationTtl: 120 });
  console.log(`Stored webhook for ${email} in slot ${slot}`);

  // Try to merge immediately - if 2+ slots exist, the other webhook already stored
  const didDispatch = await listMergeDispatch(env, email, 2);
  if (didDispatch) {
    return { success: true, message: 'Merged and dispatched immediately' };
  }

  // Only one slot found - schedule fallback timer for when second webhook never comes
  // 20s (not 30s) to leave headroom for KV reads + GitHub API within waitUntil limit
  ctx.waitUntil(
    new Promise(resolve => setTimeout(resolve, 20_000)).then(async () => {
      try {
        const alreadyDone = await env.WEBHOOK_KV.get(`done:${email}`);
        if (alreadyDone) {
          console.log(`Fallback timer: ${email} already dispatched`);
          return;
        }

        console.log(`Fallback timer: dispatching whatever we have for ${email}`);
        await listMergeDispatch(env, email, 1);
      } catch (e) {
        console.error(`Fallback timer error for ${email}:`, e.message);
      }
    })
  );

  return { success: true, message: 'Stored, waiting for second webhook' };
}

// ============ PROSP WEBHOOK HANDLER ============

async function handleProspWebhook(env, payload, ctx) {
  const eventData = payload.eventData || payload.data || payload;
  const profileInfo = eventData.profileInfo || eventData.profile_info || eventData.profile || eventData.lead_info || {};
  // LinkedIn URL: try multiple field names
  const linkedinUrl = eventData.lead || eventData.linkedin_url || eventData.linkedinUrl
    || eventData.profile_url || profileInfo.linkedin_url || profileInfo.linkedinUrl
    || payload.linkedin_url || payload.linkedinUrl || '';
  const content = eventData.content || eventData.message || eventData.reply || eventData.text || payload.message || '';
  const sender = eventData.sender || eventData.sender_url || payload.sender || '';
  const campaignName = eventData.campaignName || eventData.campaign_name || payload.campaignName || payload.campaign_name || '';

  // Contact fields: try camelCase, snake_case, and flat payload
  const firstName = profileInfo.firstName || profileInfo.first_name || eventData.firstName || eventData.first_name || payload.first_name || '';
  const lastName = profileInfo.lastName || profileInfo.last_name || eventData.lastName || eventData.last_name || payload.last_name || '';
  const contactName = [firstName, lastName].filter(Boolean).join(' ');
  const company = profileInfo.company || profileInfo.company_name || eventData.company || eventData.company_name || payload.company || '';
  const email = profileInfo.email || eventData.email || payload.email || '';
  const normalizedLi = normalizeLinkedInUrl(linkedinUrl);

  console.log(`Prosp webhook: ${normalizedLi} (${contactName}, ${company})`);

  if (!normalizedLi) {
    return { ok: false, error: 'missing linkedin URL' };
  }

  // Dedup: skip if recently processed
  const doneKey = `done_li:${normalizedLi}`;
  const alreadyDone = await env.WEBHOOK_KV.get(doneKey);
  if (alreadyDone) {
    console.log(`Already processed ${normalizedLi}, ignoring`);
    return { ok: true, message: 'already processed' };
  }
  await env.WEBHOOK_KV.put(doneKey, 'true', { expirationTtl: 300 });

  // Classify reply
  const classification = await classifyReplyAI(content, env.ANTHROPIC_API_KEY);
  console.log(`Prosp classification for ${normalizedLi}: ${classification.category} (${classification.confidence})`);

  // Send Telegram notification
  await sendTelegramNotification(env, linkedinUrl, content, classification);

  // Check if lead is in nurture sequence (by email or linkedin URL)
  const nurtureKey = email || normalizedLi;
  const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${nurtureKey}`);
  if (nurtureRaw) {
    const nurtureData = JSON.parse(nurtureRaw);
    if (nurtureData.status === 'active' || nurtureData.status === 'paused') {
      console.log(`Prosp nurture lead replied: ${nurtureKey} (status=${nurtureData.status})`);
      const leadRaw = email ? await env.WEBHOOK_KV.get(`lead_by_email:${email}`) : null;
      const leadData = leadRaw ? JSON.parse(leadRaw) : null;

      // Reuse handleNurtureReply but route DMs via Prosp
      // For now, handle inline — pause nurture, generate auto-reply, Telegram with DM buttons
      const cat = classification.category;
      const firmName = nurtureData.firm_name || company || 'Unknown';
      const nurtureFirstName = firstName || contactName.split(' ')[0] || '';
      const emailsSent = nurtureData.emails_sent || 0;

      if (cat === 'OOO') {
        let returnDate = classification.return_date || null;
        if (!returnDate) {
          const d = new Date();
          d.setDate(d.getDate() + 5);
          returnDate = d.toISOString().split('T')[0];
        }
        nurtureData.status = 'paused';
        nurtureData.paused_at = new Date().toISOString();
        nurtureData.pause_reason = 'ooo';
        nurtureData.ooo_return_date = returnDate;
        await env.WEBHOOK_KV.put(`nurture:${nurtureKey}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });

        if (env.ANTHROPIC_API_KEY && env.PROSP_API_KEY) {
          const autoReply = await generateAutoResponse(cat, content, firmName, nurtureFirstName, env.ANTHROPIC_API_KEY, {
            isNurtureLead: true, hasReport: true, emailsSent
          });
          if (autoReply) {
            try {
              const senderUrl = sender || env.PROSP_SENDER;
              if (senderUrl) {
                await sendProspDM(env.PROSP_API_KEY, linkedinUrl, senderUrl, autoReply);
                console.log(`OOO auto-DM sent to nurture lead ${normalizedLi}`);
              }
            } catch (e) {
              console.log(`OOO auto-DM send failed: ${e.message}`);
            }
          }
        }
        return { ok: true, message: 'nurture OOO handled' };
      }

      // Non-OOO nurture reply — pause + generate auto-reply + Telegram with DM buttons
      nurtureData.status = 'paused';
      nurtureData.paused_at = new Date().toISOString();
      nurtureData.pause_reason = 'lead_replied';
      nurtureData.last_reply_text = (content || '').slice(0, 500);
      nurtureData.last_reply_category = cat;
      nurtureData.last_reply_at = new Date().toISOString();
      await env.WEBHOOK_KV.put(`nurture:${nurtureKey}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });

      let autoReply = null;
      if (env.ANTHROPIC_API_KEY) {
        autoReply = await generateAutoResponse(cat, content, firmName, nurtureFirstName, env.ANTHROPIC_API_KEY, {
          isNurtureLead: true, hasReport: true, emailsSent,
          city: nurtureData.city || '', practiceLabel: nurtureData.practice_label || '',
          reportUrl: nurtureData.report_url || ''
        });
      }

      const queueId = crypto.randomUUID();
      await env.WEBHOOK_KV.put(`nurture_reply:${queueId}`, JSON.stringify({
        email: email || '', linkedin_url: linkedinUrl, prosp_sender: sender,
        firmName, contactName: nurtureFirstName, replyText: (content || '').slice(0, 500),
        category: cat, autoReply, emailsSent, channel: 'prosp'
      }), { expirationTtl: 86400 });

      const badges = {
        INTERESTED: '\ud83d\udfe2 INTERESTED', QUESTION: '\u2753 QUESTION', OBJECTION: '\ud83d\udfe1 OBJECTION',
        NOT_INTERESTED: '\ud83d\udd34 NOT INTERESTED', UNSUBSCRIBE: '\u26d4 UNSUBSCRIBE', IRRELEVANT: '\u26aa IRRELEVANT'
      };
      const badge = badges[cat] || cat;
      const confidence = Math.round((classification.confidence || 0) * 100);
      const esc = s => (s || '').replace(/([_*`\[\]])/g, '');

      let msg = `\ud83d\udd14 *NURTURE LEAD REPLIED (LinkedIn)*\n\n${badge} (${confidence}%)\n\ud83d\udcca *Firm:* ${esc(firmName)}\n\ud83d\udd17 *LinkedIn:* ${esc(linkedinUrl)}\n\ud83d\udcec *Progress:* ${emailsSent}/7 sent, now PAUSED`;
      msg += `\n\n*Their reply:*\n\`\`\`\n${(content || '').slice(0, 400).replace(/`/g, "'")}\n\`\`\``;
      if (autoReply) {
        msg += `\n\n*Suggested DM response:*\n\`\`\`\n${autoReply.slice(0, 600).replace(/`/g, "'")}\n\`\`\``;
      }

      const buttons = [];
      if (autoReply) {
        buttons.push([
          { text: '\u2705 Send DM + Stop', callback_data: `nrd_send_stop:${queueId}` },
          { text: '\u2705 Send DM + Continue', callback_data: `nrd_send_cont:${queueId}` }
        ]);
      }
      buttons.push([
        { text: '\u270f\ufe0f Edit Reply', callback_data: `nrd_edit:${queueId}` },
        { text: '\u23ed\ufe0f Skip Reply', callback_data: `nrd_skip:${queueId}` }
      ]);

      try {
        await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, msg, {
          reply_markup: { inline_keyboard: buttons }
        });
      } catch (tgErr) {
        console.error(`Failed to send nurture DM reply Telegram msg:`, tgErr.message);
      }

      return { ok: true, message: 'nurture reply handled via DM' };
    }
  }

  // OOO: auto-send casual DM + trigger report pipeline
  if (classification.category === 'OOO') {
    console.log(`OOO from ${normalizedLi}, auto-sending casual DM + triggering report`);

    let returnDate = classification.return_date || null;
    if (!returnDate) {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      returnDate = d.toISOString().split('T')[0];
    }

    await env.WEBHOOK_KV.put(`ooo:${normalizedLi}`, JSON.stringify({
      detected_at: new Date().toISOString(),
      return_date: returnDate
    }), { expirationTtl: 604800 });

    if (env.ANTHROPIC_API_KEY && env.PROSP_API_KEY) {
      const jobTitle = profileInfo.jobTitle || profileInfo.job_title || eventData.jobTitle || eventData.job_title || '';
      const autoReply = await generateAutoResponse('OOO', content, company, firstName, env.ANTHROPIC_API_KEY, {
        hasReport: false,
        jobTitle
      });
      if (autoReply) {
        try {
          const senderUrl = sender || env.PROSP_SENDER;
          if (senderUrl) {
            await sendProspDM(env.PROSP_API_KEY, linkedinUrl, senderUrl, autoReply);
            console.log(`OOO auto-DM sent to ${normalizedLi}`);
          }
        } catch (e) {
          console.log(`OOO auto-DM send failed: ${e.message}`);
        }
      }
    }
    // Fall through to dispatch report pipeline
  }

  // QUESTION, OBJECTION, NOT_INTERESTED: generate auto-reply DM + queue for approval
  const replyCategories = ['QUESTION', 'OBJECTION', 'NOT_INTERESTED'];
  if (replyCategories.includes(classification.category) && env.ANTHROPIC_API_KEY) {
    const jobTitle = profileInfo.jobTitle || profileInfo.job_title || eventData.jobTitle || eventData.job_title || '';
    const autoReply = await generateAutoResponse(
      classification.category, content, company, firstName, env.ANTHROPIC_API_KEY, {
        hasReport: false,
        jobTitle,
        campaignName: campaignName || ''
      }
    );

    if (autoReply && env.PROSP_API_KEY) {
      await queueDM(env, {
        type: 'auto-reply',
        linkedin_url: linkedinUrl,
        sender: sender || env.PROSP_SENDER || '',
        message: autoReply,
        contact_name: contactName,
        firm_name: company,
        context: `${classification.category}: ${classification.summary}`
      });
    }
  }

  // Build GitHub payload for report pipeline
  const phone = profileInfo.phoneNumber || profileInfo.phone_number || profileInfo.phone || eventData.phone || '';
  const jobTitle = profileInfo.jobTitle || profileInfo.job_title || eventData.jobTitle || eventData.job_title || '';
  const website = profileInfo.websiteUrl || profileInfo.website_url || profileInfo.website
    || profileInfo.companyUrl || profileInfo.company_url || eventData.website || '';

  const meta = {
    reply_text: content ? content.slice(0, 500) : '',
    campaign_name: campaignName,
    phone,
    timestamp: new Date().toISOString(),
    classification: classification.category,
    channel: 'prosp',
    linkedin_url: linkedinUrl,
    prosp_sender: sender,
    ooo_return_date: classification.return_date || ''
  };

  const githubPayload = {
    event_type: 'interested_lead',
    client_payload: {
      email: email,
      first_name: firstName,
      last_name: lastName,
      website: website,
      location: '',
      country: '',
      company: company,
      job_title: jobTitle,
      linkedin: linkedinUrl,
      _meta: JSON.stringify(meta)
    }
  };

  console.log('DISPATCHING PROSP PAYLOAD:', JSON.stringify(githubPayload));
  await forwardToGitHub(env, githubPayload);

  return { ok: true, message: 'classified and dispatched' };
}

async function handleConnectionAccepted(env, payload) {
  const eventData = payload.eventData || payload.data || payload;
  const profileInfo = eventData.profileInfo || eventData.profile_info || eventData.profile || eventData.lead_info || {};
  const linkedinUrl = eventData.lead || eventData.linkedin_url || eventData.linkedinUrl
    || eventData.profile_url || profileInfo.linkedin_url || profileInfo.linkedinUrl
    || payload.linkedin_url || payload.linkedinUrl || '';
  const sender = eventData.sender || eventData.sender_url || payload.sender || '';
  const campaignName = eventData.campaignName || eventData.campaign_name || payload.campaignName || payload.campaign_name || '';

  const firstName = profileInfo.firstName || profileInfo.first_name || eventData.firstName || eventData.first_name || payload.first_name || '';
  const lastName = profileInfo.lastName || profileInfo.last_name || eventData.lastName || eventData.last_name || payload.last_name || '';
  const contactName = [firstName, lastName].filter(Boolean).join(' ');
  const company = profileInfo.company || profileInfo.company_name || eventData.company || eventData.company_name || payload.company || '';
  const email = profileInfo.email || eventData.email || payload.email || '';
  const normalizedLi = normalizeLinkedInUrl(linkedinUrl);

  console.log(`Connection accepted: ${contactName} (${company}) - ${normalizedLi}`);

  if (!normalizedLi) {
    return { ok: false, error: 'missing linkedin URL' };
  }

  // Dedup: don't re-process if already handled (24h window)
  const doneKey = `done_conn:${normalizedLi}`;
  if (await env.WEBHOOK_KV.get(doneKey)) {
    console.log(`Already processed connection from ${normalizedLi}, ignoring`);
    return { ok: true, message: 'already processed connection' };
  }
  await env.WEBHOOK_KV.put(doneKey, 'true', { expirationTtl: 86400 });

  // Build GitHub payload — same structure as handleProspWebhook
  const phone = profileInfo.phoneNumber || profileInfo.phone_number || profileInfo.phone || eventData.phone || '';
  const jobTitle = profileInfo.jobTitle || profileInfo.job_title || eventData.jobTitle || eventData.job_title || '';
  const website = profileInfo.websiteUrl || profileInfo.website_url || profileInfo.website
    || profileInfo.companyUrl || profileInfo.company_url || eventData.website || '';

  const meta = {
    reply_text: '',
    campaign_name: campaignName,
    phone,
    timestamp: new Date().toISOString(),
    classification: 'INTERESTED',
    channel: 'prosp',
    source: 'connection_accept',
    linkedin_url: linkedinUrl,
    prosp_sender: sender,
    ooo_return_date: ''
  };

  const githubPayload = {
    event_type: 'interested_lead',
    client_payload: {
      email: email,
      first_name: firstName,
      last_name: lastName,
      website: website,
      location: '',
      country: '',
      company: company,
      job_title: jobTitle,
      linkedin: linkedinUrl,
      _meta: JSON.stringify(meta)
    }
  };

  console.log('DISPATCHING CONNECTION ACCEPT PAYLOAD:', JSON.stringify(githubPayload));
  await forwardToGitHub(env, githubPayload);

  return { ok: true, message: 'connection accepted, pipeline triggered' };
}

// ============ MAIN HANDLER ============

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight for /view endpoint
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin') || '';
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    // GET endpoints
    if (request.method === 'GET') {

      // Debug endpoint: GET /debug - shows last raw Instantly payloads stored in KV
      if (url.pathname === '/debug') {
        const keys = await env.WEBHOOK_KV.list({ prefix: 'raw:' });
        const entries = [];
        for (const key of keys.keys.slice(-10)) {
          const val = await env.WEBHOOK_KV.get(key.name);
          entries.push({ key: key.name, payload: val });
        }
        return new Response(JSON.stringify(entries, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Prosp debug endpoint: GET /prosp-debug - shows last raw Prosp payloads
      if (url.pathname === '/prosp-debug') {
        const keys = await env.WEBHOOK_KV.list({ prefix: 'raw_prosp:' });
        const entries = [];
        for (const key of keys.keys.slice(-20)) {
          const val = await env.WEBHOOK_KV.get(key.name);
          try { entries.push({ key: key.name, payload: JSON.parse(val) }); }
          catch { entries.push({ key: key.name, payload: val }); }
        }
        return new Response(JSON.stringify(entries, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Custom email endpoint: GET /custom-email/{approvalId}
      const customMatch = url.pathname.match(/^\/custom-email\/(.+)$/);
      if (customMatch) {
        const approvalId = decodeURIComponent(customMatch[1]);
        const body = await env.WEBHOOK_KV.get(`custom_email:${approvalId}`);
        if (body) {
          return new Response(body, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        }
        return new Response('Not found', { status: 404 });
      }

      return new Response('OK', { status: 200 });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Route-specific POST endpoints (before JSON parse for non-webhook routes)
    if (url.pathname === '/view') {
      try {
        const body = await request.json();
        const result = await handleViewTrack(env, body);
        const origin = request.headers.get('Origin') || '';
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(request.headers.get('Origin') || '') }
        });
      }
    }

    if (url.pathname === '/store-lead') {
      try {
        const body = await request.json();
        const result = await handleStoreLead(env, body);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/queue-email') {
      try {
        const body = await request.json();
        const result = await queueEmail(env, body);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/queue-dm') {
      try {
        const body = await request.json();
        const result = await queueDM(env, body);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/prosp-webhook') {
      try {
        const body = await request.json();

        // Store raw payload for debugging (keep last 20, expire after 7 days)
        const rawKey = `raw_prosp:${Date.now()}`;
        ctx.waitUntil(env.WEBHOOK_KV.put(rawKey, JSON.stringify(body), { expirationTtl: 604800 }));

        // Normalize event type — Prosp docs list display names like "LinkedIn Message Replied"
        // but the actual API may send different formats (snake_case, camelCase, slug, etc.)
        const rawEvent = (body.eventType || body.event_type || body.event || '').toString();
        const eventNorm = rawEvent.toLowerCase().replace(/[\s_-]+/g, '');

        // Match: "LinkedIn Message Replied" / "has_msg_replied" / "linkedin_message_replied" / etc.
        const isMessageReply = ['linkedinmessagereplied', 'hasmsgreplied', 'messagereplied',
          'linkedin_message_replied', 'msg_replied', 'message_replied', 'reply'].some(s => eventNorm.includes(s));

        // Match: "LinkedIn Connection Accepted" / "connection_accepted" / "has_connection_accepted" / etc.
        const isConnectionAccept = ['linkedinconnectionaccepted', 'connectionaccepted',
          'hasconnectionaccepted', 'connection_accepted', 'acceptinvite'].some(s => eventNorm.includes(s));

        if (isMessageReply) {
          const result = await handleProspWebhook(env, body, ctx);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else if (isConnectionAccept) {
          const result = await handleConnectionAccepted(env, body);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Unknown event — alert via Telegram so we can discover the format
        console.log(`Prosp webhook: unhandled eventType "${rawEvent}"`, JSON.stringify(body).slice(0, 500));
        if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
          const snippet = JSON.stringify(body, null, 2).slice(0, 800).replace(/([_*`\[\]])/g, '');
          ctx.waitUntil(sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID,
            `\u26a0\ufe0f *Unknown Prosp Event*\n\nEvent type: \`${rawEvent || 'MISSING'}\`\n\n\`\`\`\n${snippet}\n\`\`\``));
        }
        return new Response(JSON.stringify({ ok: true, message: 'unknown event type logged' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        console.error('Prosp webhook error:', e);
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/nurture-check') {
      // Called by nurture-sender.js to check/update nurture status in KV
      try {
        const body = await request.json();
        const { action, email, data } = body;

        if (action === 'get') {
          const raw = await env.WEBHOOK_KV.get(`nurture:${email}`);
          return new Response(JSON.stringify({ ok: true, data: raw ? JSON.parse(raw) : null }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else if (action === 'set') {
          await env.WEBHOOK_KV.put(`nurture:${email}`, JSON.stringify(data), { expirationTtl: 2592000 });
          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else if (action === 'list') {
          const keys = await env.WEBHOOK_KV.list({ prefix: 'nurture:' });
          const items = [];
          for (const key of keys.keys) {
            const raw = await env.WEBHOOK_KV.get(key.name);
            if (raw) items.push({ email: key.name.replace('nurture:', ''), ...JSON.parse(raw) });
          }
          return new Response(JSON.stringify({ ok: true, items }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ ok: false, error: 'unknown action' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Telegram webhook diagnostics — check and set webhook URL
    if (url.pathname === '/telegram-webhook') {
      try {
        const body = await request.json().catch(() => ({}));
        const { action } = body;

        if (action === 'info') {
          // Get current webhook info
          const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
          const info = await resp.json();
          return new Response(JSON.stringify(info, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else if (action === 'set') {
          // Re-register webhook URL
          const webhookUrl = body.url || `https://instantly-webhook-proxy.fardeen-729.workers.dev/`;
          const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl })
          });
          const result = await resp.json();
          return new Response(JSON.stringify(result, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ usage: 'POST with {"action":"info"} or {"action":"set"}' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/ooo-check') {
      // Called by nurture-sender.js to check/update OOO pending entries in KV
      try {
        const body = await request.json();
        const { action, email, data } = body;

        if (action === 'get') {
          const raw = await env.WEBHOOK_KV.get(`ooo_pending:${email}`);
          return new Response(JSON.stringify({ ok: true, data: raw ? JSON.parse(raw) : null }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else if (action === 'set') {
          await env.WEBHOOK_KV.put(`ooo_pending:${email}`, JSON.stringify(data), { expirationTtl: 2592000 }); // 30 days
          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else if (action === 'delete') {
          await env.WEBHOOK_KV.delete(`ooo_pending:${email}`);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else if (action === 'list') {
          const keys = await env.WEBHOOK_KV.list({ prefix: 'ooo_pending:' });
          const items = [];
          for (const key of keys.keys) {
            const raw = await env.WEBHOOK_KV.get(key.name);
            if (raw) items.push({ email: key.name.replace('ooo_pending:', ''), ...JSON.parse(raw) });
          }
          return new Response(JSON.stringify({ ok: true, items }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ ok: false, error: 'unknown action' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    try {
      const payload = await request.json();

      // Store raw payload for debugging (expires in 10 min)
      const ts = Date.now();
      const email = payload.lead_email || payload.email || payload?.lead?.email || 'unknown';
      await env.WEBHOOK_KV.put(`raw:${email}:${ts}`, JSON.stringify(payload), { expirationTtl: 600 });

      // Detect: Telegram callback vs Telegram message vs Instantly webhook
      if (payload.callback_query) {
        // Telegram callback (approve/reject buttons)
        if (!env.TELEGRAM_BOT_TOKEN) {
          return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const result = await handleTelegramCallback(env, payload);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (payload.message?.text) {
        // Telegram message (e.g. /build command)
        const result = await handleTelegramMessage(env, payload);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // Instantly webhook
        const result = await handleInstantlyWebhook(env, payload, ctx);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 200, // Return 200 to prevent retries
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
