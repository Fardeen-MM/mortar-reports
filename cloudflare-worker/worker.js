/**
 * Cloudflare Worker: Instantly Webhook + Telegram Approval Handler
 *
 * Handles three types of webhooks:
 * 1. Instantly webhooks → forwards to GitHub Actions
 * 2. Telegram callbacks → triggers email approval workflow
 * 3. Telegram /build commands → manually trigger report pipeline
 *
 * Required secrets: GITHUB_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
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

  // Parse approval data from message
  let approvalData = parseMessageForApprovalData(callback_query.message);

  // Try to fetch full approval JSON from GitHub (has email personalization data)
  if (approvalId) {
    try {
      const firmName = atob(approvalId);
      const firmFolder = firmName
        .replace(/[^a-zA-Z0-9\s&]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 0)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
      const fetchedData = await fetchApprovalData(env.GITHUB_TOKEN, firmFolder);
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

  const chatId = callback_query.message.chat.id;
  const messageId = callback_query.message.message_id;

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

    // Extract email preview from the approval message (between last ``` blocks)
    const msgText = callback_query.message.text || '';
    const codeBlocks = msgText.match(/```[\s\S]*?```/g) || [];
    const lastBlock = codeBlocks[codeBlocks.length - 1] || '';
    const emailBody = lastBlock.replace(/^```\n?/, '').replace(/\n?```$/, '').trim();

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

// ============ INSTANTLY HANDLER ============

// Instantly sends TWO webhooks per lead reply (campaign-level and workspace-level).
// One has lead data (website, company, city), the other has email data (email_id, from_email).
// Each webhook stores to a unique slot key (wh:<email>|<random>), then does KV.list()
// to find+merge all slots. If 2+ found, dispatch merged immediately. Otherwise:
//   1. A 20s waitUntil fallback tries to dispatch (best-effort)
//   2. A cron trigger runs every minute as a safety net for orphaned slots

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
  console.log('Payload keys:', Object.keys(payload).join(', '));
  console.log('Name fields:', JSON.stringify({ first_name: payload.first_name, firstName: payload.firstName, last_name: payload.last_name, lastName: payload.lastName, fullName: payload.fullName, full_name: payload.full_name, name: payload.name, 'Full Name': payload['Full Name'] }));
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

  // Guard: if first_name is just the email local part, Instantly has no real name - clear it
  // But don't clear if the name appears in company or domain (e.g., chad@chadgrahamlaw.com - "Chad" is real)
  let clearedByGuard = false;
  if (built.client_payload.first_name && built.client_payload.email) {
    const local = built.client_payload.email.split('@')[0].toLowerCase();
    if (built.client_payload.first_name.toLowerCase() === local) {
      const domain = built.client_payload.email.split('@')[1]?.toLowerCase() || '';
      const company = (built.client_payload.company || '').toLowerCase().replace(/\s+/g, '');
      const nameInContext = domain.includes(local) || company.includes(local);
      if (nameInContext) {
        console.log(`first_name "${built.client_payload.first_name}" matches email but found in company/domain - keeping`);
      } else {
        console.log(`first_name "${built.client_payload.first_name}" matches email local part - clearing`);
        built.client_payload.first_name = '';
        built.client_payload.last_name = '';
        clearedByGuard = true;
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

// Classify reply text: returns 'negative' for opt-outs, 'positive' otherwise.
// Strips quoted text before checking.
function classifyReply(replyText) {
  if (!replyText) return 'positive';
  // Strip quoted reply chains (lines starting with > or "On ... wrote:")
  const stripped = replyText
    .split('\n')
    .filter(line => !line.trim().startsWith('>') && !/^On .+ wrote:$/i.test(line.trim()))
    .join('\n')
    .trim();
  if (!stripped) return 'positive';
  const lower = stripped.toLowerCase();
  const negativePatterns = [
    'unsubscribe', 'remove me from', 'stop emailing', 'opt out', 'opt-out',
    'do not contact', 'take me off', 'remove my email', 'stop contacting',
    'not interested', 'no thank', 'no, thank', 'please stop', 'leave me alone',
    'remove from list', 'remove from your list', 'cease and desist'
  ];
  if (negativePatterns.some(p => lower.includes(p))) return 'negative';
  return 'positive';
}

// Send a Telegram notification (used for negative replies instead of dispatching)
async function sendTelegramNotification(env, email, replyText, classification) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.log('No Telegram credentials, skipping notification');
    return;
  }
  const msg = `🔴 *Auto-skipped lead*\n\n*Email:* ${email}\n*Classification:* ${classification}\n\n\`\`\`\n${(replyText || '').slice(0, 300)}\n\`\`\``;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' })
    });
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

  // Check if this is a reply to an edit_email prompt
  if (message.reply_to_message) {
    const replyToId = message.reply_to_message.message_id;
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

  // Classify reply — skip negative replies (unsubscribe, opt out, etc.)
  const replyClass = classifyReply(replyText);
  if (replyClass === 'negative') {
    console.log(`NEGATIVE REPLY from ${email}, skipping dispatch`);
    await sendTelegramNotification(env, email, replyText, replyClass);
    return true; // Return true so slots get cleaned up
  }

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

  console.log('RAW INSTANTLY PAYLOAD:', JSON.stringify(payload));
  console.log('BUILT GITHUB PAYLOAD:', JSON.stringify(githubPayload));
  console.log('EXTRA FIELDS:', JSON.stringify(extraFields));

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
  // Cron safety net: dispatch any orphaned webhook slots that the waitUntil fallback missed
  async scheduled(event, env, ctx) {
    try {
      const allKeys = await env.WEBHOOK_KV.list({ prefix: 'wh:' });
      if (allKeys.keys.length === 0) return;

      // Group slot keys by email
      const byEmail = {};
      for (const key of allKeys.keys) {
        const match = key.name.match(/^wh:([^|]+)\|/);
        if (match) {
          const email = match[1];
          if (!byEmail[email]) byEmail[email] = [];
          byEmail[email].push(key);
        }
      }

      for (const email of Object.keys(byEmail)) {
        const done = await env.WEBHOOK_KV.get(`done:${email}`);
        if (done) {
          // Already dispatched — clean up stale slots
          for (const key of byEmail[email]) {
            await env.WEBHOOK_KV.delete(key.name);
          }
          continue;
        }

        console.log(`Cron: dispatching orphaned slot(s) for ${email}`);
        await listMergeDispatch(env, email, 1);
      }
    } catch (e) {
      console.error('Cron sweep error:', e.message);
    }
  },

  async fetch(request, env, ctx) {
    // GET endpoints
    if (request.method === 'GET') {
      const url = new URL(request.url);

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
