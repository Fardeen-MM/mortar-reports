/**
 * Cloudflare Worker: Instantly Webhook + Telegram Approval Handler
 *
 * Handles two types of webhooks:
 * 1. Instantly webhooks → forwards to GitHub Actions
 * 2. Telegram callbacks → triggers email approval workflow
 *
 * Required secrets: GITHUB_TOKEN, TELEGRAM_BOT_TOKEN
 */

const GITHUB_REPO = 'Fardeen-MM/mortar-reports';
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache for deduplication
const recentWebhooks = new Map();

function cleanupOldEntries() {
  const now = Date.now();
  for (const [key, timestamp] of recentWebhooks.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      recentWebhooks.delete(key);
    }
  }
}

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

async function editMessage(botToken, chatId, messageId, newText) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      parse_mode: 'Markdown'
    })
  });
  return response.json();
}

async function triggerGitHubWorkflow(githubToken, approvalData) {
  const payload = {
    event_type: 'send_approved_email',
    client_payload: {
      firm_name: approvalData.firm_name,
      firm_folder: approvalData.firm_folder,
      lead_email: approvalData.lead_email,
      contact_name: approvalData.contact_name,
      report_url: approvalData.report_url,
      email_id: approvalData.email_id || '',
      from_email: approvalData.from_email || 'fardeen@mortarmetrics.com'
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
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/automation/pending-approvals/${firmFolder}.json`;
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
  const firmMatch = text.match(/📊 \*Firm:\* (.+)/);
  const contactMatch = text.match(/👤 \*Contact:\* (.+)/);
  const emailMatch = text.match(/📧 \*Email:\* (.+)/);
  const urlMatch = text.match(/🔗 \*Review Report:\*\n(.+)/);

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

  // If parsing failed, try to fetch from GitHub
  if (!approvalData && approvalId) {
    try {
      const firmName = atob(approvalId);
      const firmFolder = firmName
        .replace(/[^a-zA-Z0-9\s&]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 0)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
      approvalData = await fetchApprovalData(env.GITHUB_TOKEN, firmFolder);
    } catch (e) {
      console.log('Could not decode approvalId:', e.message);
    }
  }

  if (!approvalData) {
    await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Approval data not found', true);
    return { ok: true, error: 'Approval data not found' };
  }

  const chatId = callback_query.message.chat.id;
  const messageId = callback_query.message.message_id;

  if (action === 'approve') {
    try {
      await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Sending email...', false);
      await triggerGitHubWorkflow(env.GITHUB_TOKEN, approvalData);

      const successText = `✅ *APPROVED & SENT*

📊 *Firm:* ${approvalData.firm_name}
👤 *Contact:* ${approvalData.contact_name}
📧 *Email:* ${approvalData.lead_email}
🔗 *Report:* ${approvalData.report_url}

✉️ *Email send triggered via GitHub Actions!*`;

      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, successText);
      console.log('Approval processed successfully');
    } catch (err) {
      console.error('Failed to trigger email:', err.message);
      await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId,
        `❌ *ERROR*\n\nFailed to trigger email: ${err.message}`);
    }
  } else if (action === 'reject') {
    await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Rejected', false);
    const rejectedText = `❌ *REJECTED*

📊 *Firm:* ${approvalData.firm_name}
📧 *Email:* ${approvalData.lead_email}

*No email was sent.*`;
    await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, rejectedText);
  }

  return { ok: true };
}

// ============ INSTANTLY HANDLER ============

async function handleInstantlyWebhook(env, payload) {
  const dedupKey = `${payload.lead_email || 'unknown'}_${payload.email_id || 'no-id'}`;
  const now = Date.now();

  if (recentWebhooks.has(dedupKey)) {
    const lastSeen = recentWebhooks.get(dedupKey);
    if (now - lastSeen < DEDUP_WINDOW_MS) {
      console.log(`Duplicate webhook: ${dedupKey}`);
      return { success: true, message: 'Duplicate ignored' };
    }
  }

  recentWebhooks.set(dedupKey, now);
  cleanupOldEntries();

  // GitHub limits client_payload to 10 properties - only include essential fields
  const githubPayload = {
    event_type: 'interested_lead',
    client_payload: {
      email: payload.lead_email || payload.email || '',
      first_name: payload.first_name || payload.firstName || '',
      last_name: payload.last_name || payload.lastName || '',
      website: payload.website || payload.companyUrl || '',
      city: payload.city || payload.City || '',
      state: payload.state || payload.State || '',
      country: payload.country || payload.Country || '',
      company: payload.company || payload.companyName || '',
      email_id: payload.email_id || payload.emailId || '',
      from_email: payload.from_email || payload.fromEmail || ''
    }
  };

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

  if (response.status === 204) {
    return { success: true, message: 'Forwarded to GitHub Actions' };
  } else {
    const errorText = await response.text();
    throw new Error(`GitHub error: ${response.status} ${errorText}`);
  }
}

// ============ MAIN HANDLER ============

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const payload = await request.json();

      // Detect Telegram callback vs Instantly webhook
      if (payload.callback_query) {
        // Telegram callback
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
      } else {
        // Instantly webhook
        const result = await handleInstantlyWebhook(env, payload);
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
