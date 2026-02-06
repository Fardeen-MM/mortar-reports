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

// Instantly sends TWO webhooks per lead reply (campaign-level and workspace-level).
// One has lead data (website, company, city), the other has email data (email_id, from_email).
// Each webhook stores to a unique slot key (wh:<email>|<random>), then does KV.list()
// to find+merge all slots. If 2+ found, dispatch merged immediately. Otherwise, a 15s
// fallback timer does the same list+merge in case the second webhook never arrives.

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
  return {
    event_type: 'interested_lead',
    client_payload: {
      email: dig(payload, 'lead_email', 'email', 'Email', 'email_address', 'emailAddress', 'to_email'),
      first_name: dig(payload, 'first_name', 'firstName', 'First Name', 'first', 'lead_first_name'),
      last_name: dig(payload, 'last_name', 'lastName', 'Last Name', 'last', 'lead_last_name'),
      website: dig(payload, 'website', 'companyUrl', 'company_url', 'Website', 'company_website',
        'lead_website', 'url', 'domain', 'companyDomain', 'company_domain'),
      city: dig(payload, 'city', 'City', 'lead_city', 'location_city'),
      state: dig(payload, 'state', 'State', 'lead_state', 'location_state', 'province', 'Province', 'region'),
      country: dig(payload, 'country', 'Country', 'lead_country', 'location_country', 'country_code'),
      company: dig(payload, 'company', 'companyName', 'company_name', 'Company', 'organization',
        'Organization', 'lead_company', 'lead_company_name'),
      email_id: dig(payload, 'email_id', 'emailId', 'message_id', 'messageId', 'id'),
      from_email: dig(payload, 'from_email', 'fromEmail', 'from', 'sender', 'from_email_account',
        'fromEmailAccount', 'from_address', 'reply_to_email'),
      // Pass through all raw top-level keys for debugging
      _raw_keys: Object.keys(payload).join(',')
    }
  };
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

// Merge two GitHub payloads — for each field, keep whichever is non-empty.
// This combines lead data (website, company, city) from one webhook
// with email threading data (email_id, from_email) from the other.
function mergePayloads(a, b) {
  const merged = { event_type: 'interested_lead', client_payload: {} };
  const allFields = new Set([...Object.keys(a.client_payload), ...Object.keys(b.client_payload)]);
  for (const field of allFields) {
    if (field === '_raw_keys') {
      // Combine raw keys from both
      const keysA = (a.client_payload._raw_keys || '').split(',').filter(Boolean);
      const keysB = (b.client_payload._raw_keys || '').split(',').filter(Boolean);
      merged.client_payload._raw_keys = [...new Set([...keysA, ...keysB])].join(',');
    } else {
      merged.client_payload[field] = a.client_payload[field] || b.client_payload[field] || '';
    }
  }
  return merged;
}

// Helper: list all webhook slots for an email, merge them, dispatch, and clean up.
// Returns true if dispatched, false if nothing to dispatch.
async function listMergeDispatch(env, email, minSlots) {
  const keys = await env.WEBHOOK_KV.list({ prefix: `wh:${email}|` });
  console.log(`listMergeDispatch(${email}): found ${keys.keys.length} slot(s) (need ${minSlots})`);

  if (keys.keys.length < minSlots) return false;

  // Read and merge all slots
  let merged = null;
  for (const key of keys.keys) {
    const p = await env.WEBHOOK_KV.get(key.name, { type: 'json' });
    if (p) {
      merged = merged ? mergePayloads(merged, p) : p;
    }
  }

  if (!merged) return false;

  // Set done flag BEFORE dispatching to prevent other timers from also dispatching
  await env.WEBHOOK_KV.put(`done:${email}`, 'true', { expirationTtl: 300 });

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

  console.log('RAW INSTANTLY PAYLOAD:', JSON.stringify(payload));
  console.log('BUILT GITHUB PAYLOAD:', JSON.stringify(githubPayload));

  // Already dispatched for this email? (from a previous webhook pair)
  const dispatched = await env.WEBHOOK_KV.get(`done:${email}`);
  if (dispatched) {
    console.log(`Already dispatched for ${email}, ignoring`);
    return { success: true, message: 'Already dispatched' };
  }

  // Store this webhook under a unique slot key (no overwrites between webhooks)
  const slot = crypto.randomUUID().slice(0, 8);
  await env.WEBHOOK_KV.put(`wh:${email}|${slot}`, JSON.stringify(githubPayload), { expirationTtl: 120 });
  console.log(`Stored webhook for ${email} in slot ${slot}`);

  // Try to merge immediately — if 2+ slots exist, the other webhook already stored
  const didDispatch = await listMergeDispatch(env, email, 2);
  if (didDispatch) {
    return { success: true, message: 'Merged and dispatched immediately' };
  }

  // Only one slot found — schedule fallback timer for when second webhook never comes
  ctx.waitUntil(
    new Promise(resolve => setTimeout(resolve, 15_000)).then(async () => {
      const alreadyDone = await env.WEBHOOK_KV.get(`done:${email}`);
      if (alreadyDone) {
        console.log(`Fallback timer: ${email} already dispatched`);
        return;
      }

      console.log(`Fallback timer: dispatching whatever we have for ${email}`);
      await listMergeDispatch(env, email, 1);
    })
  );

  return { success: true, message: 'Stored, waiting for second webhook' };
}

// ============ MAIN HANDLER ============

export default {
  async fetch(request, env, ctx) {
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
