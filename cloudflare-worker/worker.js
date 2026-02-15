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
 *
 * Required secrets: GITHUB_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * Optional secrets: INSTANTLY_API_KEY, ANTHROPIC_API_KEY
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
  return response.json();
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
  return response.json();
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
      skip_email: skipEmail ? 'true' : ''
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
    } catch (err) {
      console.error('Failed to trigger workflow:', err.message);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `❌ *ERROR*\n\nFailed to trigger workflow: ${err.message}`);
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
        practiceLabel: approvalData.practice_label || ''
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
          skip_email: `custom:${approvalId}`
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
    'nurture': '📬 NURTURE EMAIL'
  };
  const header = typeHeaders[type] || '📧 QUEUED EMAIL';

  // Build preview — show full email (Telegram limit is 4096 chars)
  const preview = (text || '').slice(0, 2000).replace(/`/g, "'");

  // Escape markdown special chars in dynamic fields (but not our formatting)
  // Only strip chars that actually break Telegram Markdown v1: * _ ` [ ]
  const esc = s => (s || '').replace(/([_*`\[\]])/g, '');

  const msg = `${header}

📊 *Firm:* ${esc(firm_name) || 'Unknown'}
👤 *To:* ${esc(contact_name) || to}
📧 *Email:* ${to}
📝 *Subject:* ${esc(subject)}
${context ? `ℹ️ *Context:* ${esc(context)}` : ''}

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
      model: 'claude-3-5-haiku-20241022',
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
- INTERESTED: Wants to learn more, positive reply, "tell me more", "sounds good"
- QUESTION: Asks a specific question about services, pricing, process
- OBJECTION: Pushes back but hasn't said no — "we already have a marketing company", "not sure we need this"
- NOT_INTERESTED: Polite decline — "not interested", "no thanks"
- UNSUBSCRIBE: Wants off the list — "unsubscribe", "remove me", "stop emailing"
- OOO: Out of office auto-reply
- IRRELEVANT: Spam, wrong person, completely unrelated

Reply text:
"""
${stripped.slice(0, 500)}
"""

Respond with: {"category":"...","confidence":0.0-1.0,"summary":"one line summary"}`,
      150
    );

    const parsed = JSON.parse(result);
    if (parsed.category && ['INTERESTED','QUESTION','OBJECTION','NOT_INTERESTED','UNSUBSCRIBE','OOO','IRRELEVANT'].includes(parsed.category)) {
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

  const unsubPatterns = ['unsubscribe', 'remove me from', 'stop emailing', 'opt out', 'opt-out',
    'take me off', 'remove my email', 'stop contacting', 'remove from list',
    'remove from your list', 'cease and desist'];
  if (unsubPatterns.some(p => lower.includes(p))) {
    return { category: 'UNSUBSCRIBE', confidence: 0.9, summary: 'Unsubscribe request' };
  }

  const notIntPatterns = ['not interested', 'no thank', 'no, thank', 'please stop', 'leave me alone',
    'do not contact'];
  if (notIntPatterns.some(p => lower.includes(p))) {
    return { category: 'NOT_INTERESTED', confidence: 0.8, summary: 'Not interested' };
  }

  if (/out of (the )?office|auto[- ]?reply|on leave|on vacation|will return/i.test(lower)) {
    return { category: 'OOO', confidence: 0.9, summary: 'Out of office' };
  }

  if (text.includes('?')) {
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
async function generateAutoResponse(category, replyText, firmName, contactName, anthropicKey) {
  const systemPrompt = `You are Fardeen from Mortar Metrics, a legal marketing agency. You write short, conversational emails to law firm leads. No marketing speak. No exclamation marks. Sound like a real person.`;

  let userPrompt;
  if (category === 'QUESTION') {
    userPrompt = `A lead from ${firmName || 'a law firm'} (${contactName || 'the partner'}) replied to my cold email with a question:

"${replyText.slice(0, 500)}"

Write a short reply (3-5 sentences) that:
1. Answers their question directly
2. Mentions the personalized report I built for their firm
3. Suggests a quick call to walk through it

Keep it casual and helpful. No corporate speak.`;
  } else {
    userPrompt = `A lead from ${firmName || 'a law firm'} (${contactName || 'the partner'}) replied to my cold email with an objection:

"${replyText.slice(0, 500)}"

Write a short reply (3-5 sentences) that:
1. Acknowledges their concern genuinely
2. Reframes it as an opportunity (e.g., "that's actually why we built this")
3. Mentions the personalized report showing real competitor data
4. Low-pressure — just offering a look at the data

Keep it casual. No pressure. No marketing speak.`;
  }

  try {
    return await callHaiku(anthropicKey, systemPrompt, userPrompt, 400);
  } catch (e) {
    console.error('Auto-response generation failed:', e.message);
    return null;
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

No pitch, just context. Let me know if you want 15 minutes this week.

Fardeen
Mortar Metrics`;

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
  const { email, firm_name, contact_name, report_url, practice_label, country, firm_folder } = body;
  if (!firm_folder) return { ok: false, error: 'missing firm_folder' };

  const data = { email, firm_name, contact_name, report_url, practice_label, country, stored_at: new Date().toISOString() };
  await env.WEBHOOK_KV.put(`lead:${firm_folder}`, JSON.stringify(data), { expirationTtl: 2592000 }); // 30 days

  // Also index by email for nurture lookups
  if (email) {
    await env.WEBHOOK_KV.put(`lead_by_email:${email}`, JSON.stringify(data), { expirationTtl: 2592000 });
  }

  console.log(`Stored lead metadata for ${firm_folder} (${email})`);
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
      // List active nurture leads from KV
      const keys = await env.WEBHOOK_KV.list({ prefix: 'nurture:' });
      if (keys.keys.length === 0) {
        await sendTelegramReply(env, chatId, messageId, '📬 No active nurture sequences.');
        return { ok: true };
      }

      let statusLines = [];
      for (const key of keys.keys.slice(0, 20)) {
        const raw = await env.WEBHOOK_KV.get(key.name);
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (data.status !== 'active') continue;
        const email = key.name.replace('nurture:', '');
        statusLines.push(`• ${email} — ${data.emails_sent || 0}/7 sent (${data.firm_name || '?'})`);
      }

      const msg = statusLines.length > 0
        ? `📬 *Active Nurture Sequences*\n\n${statusLines.join('\n')}`
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
    } else {
      await sendTelegramReply(env, chatId, messageId,
        `📬 *Nurture Commands:*\n\n\`/nurture status\` — Show active sequences\n\`/nurture stop email@firm.com\` — Stop a sequence`);
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
        timestamp: new Date().toISOString()
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
  const meta = {
    reply_text: replyText ? replyText.slice(0, 500) : '',
    campaign_name: collectedExtra._campaign_name,
    phone: collectedExtra._phone,
    timestamp: collectedExtra._timestamp
  };
  merged.client_payload._meta = JSON.stringify(meta);

  // AI-powered reply classification
  const classification = await classifyReplyAI(replyText, env.ANTHROPIC_API_KEY);
  console.log(`Classification for ${email}: ${classification.category} (${classification.confidence})`);

  if (classification.category === 'UNSUBSCRIBE' || classification.category === 'NOT_INTERESTED') {
    console.log(`${classification.category} from ${email}, skipping dispatch`);
    await sendTelegramNotification(env, email, replyText, classification);
    return true;
  }

  if (classification.category === 'OOO') {
    console.log(`OOO from ${email}, notifying only`);
    await sendTelegramNotification(env, email, replyText, classification);
    // Store OOO flag for potential re-check later
    await env.WEBHOOK_KV.put(`ooo:${email}`, new Date().toISOString(), { expirationTtl: 604800 }); // 7 days
    return true;
  }

  if (classification.category === 'IRRELEVANT') {
    console.log(`IRRELEVANT from ${email}, logging only`);
    return true;
  }

  // QUESTION or OBJECTION: generate auto-reply + queue for approval + ALSO dispatch report
  if ((classification.category === 'QUESTION' || classification.category === 'OBJECTION') && env.ANTHROPIC_API_KEY) {
    const contactName = merged.client_payload.first_name || '';
    const company = merged.client_payload.company || '';

    const autoReply = await generateAutoResponse(
      classification.category, replyText, company, contactName, env.ANTHROPIC_API_KEY
    );

    if (autoReply && env.INSTANTLY_API_KEY) {
      await queueEmail(env, {
        type: 'auto-reply',
        to: email,
        subject: 'Re: Your marketing analysis',
        html: autoReply.replace(/\n/g, '<br>'),
        text: autoReply,
        lead_email: email,
        firm_name: company,
        contact_name: contactName,
        context: `${classification.category}: ${classification.summary}`
      });
    }

    // Send classification notification with auto-reply status
    await sendTelegramNotification(env, email, replyText, classification);
    if (autoReply) {
      await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID,
        `↳ Auto-response queued for approval (${classification.category})`);
    }
  }

  // INTERESTED, QUESTION, OBJECTION all dispatch to GitHub for report generation
  console.log('DISPATCHING MERGED PAYLOAD:', JSON.stringify(merged));
  await forwardToGitHub(env, merged);

  // Clean up slot keys
  for (const key of keys.keys) {
    await env.WEBHOOK_KV.delete(key.name);
  }

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
