/**
 * Cloudflare Worker: Telegram Webhook Handler
 *
 * Handles Telegram callback queries (button presses) for report approvals
 * and triggers GitHub Actions to send emails
 *
 * Environment variables required:
 * - TELEGRAM_BOT_TOKEN
 * - GITHUB_TOKEN
 */

const GITHUB_REPO = 'Fardeen-MM/mortar-reports';

// Answer callback query to acknowledge button press
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

// Edit message to show approval/rejection status
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

// Trigger GitHub Actions workflow
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

// Fetch approval data from GitHub repository
async function fetchApprovalData(githubToken, firmFolder) {
  // Try to fetch the approval JSON from the repo
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
    // Content is base64 encoded
    const content = atob(data.content);
    return JSON.parse(content);
  }

  return null;
}

// Parse the original message to extract approval data
function parseMessageForApprovalData(message) {
  const text = message.text || '';

  // Extract data from the message format
  const firmMatch = text.match(/📊 \*Firm:\* (.+)/);
  const contactMatch = text.match(/👤 \*Contact:\* (.+)/);
  const emailMatch = text.match(/📧 \*Email:\* (.+)/);
  const urlMatch = text.match(/🔗 \*Review Report:\*\n(.+)/);

  if (firmMatch && contactMatch && emailMatch && urlMatch) {
    const reportUrl = urlMatch[1].trim();
    // Extract firm_folder from URL: https://reports.mortarmetrics.com/pending-reports/FirmName/
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

// Handle approval
async function handleApproval(env, approvalData, callbackQueryId, chatId, messageId) {
  console.log('Approval received:', approvalData.firm_name);

  try {
    // Answer the callback first
    await answerCallback(env.TELEGRAM_BOT_TOKEN, callbackQueryId, 'Sending email...', false);

    // Trigger GitHub Actions workflow
    await triggerGitHubWorkflow(env.GITHUB_TOKEN, approvalData);

    // Update message to show success
    const successText = `✅ *APPROVED & SENT*

📊 *Firm:* ${approvalData.firm_name}
👤 *Contact:* ${approvalData.contact_name}
📧 *Email:* ${approvalData.lead_email}
🔗 *Report:* ${approvalData.report_url}

✉️ *Email send triggered via GitHub Actions!*`;

    await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, successText);

    console.log('Email send triggered successfully');
    return { success: true };

  } catch (err) {
    console.error('Failed to trigger email:', err.message);

    await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, `❌ *ERROR*

Failed to trigger email to ${approvalData.lead_email}

Error: ${err.message}`);

    return { success: false, error: err.message };
  }
}

// Handle rejection
async function handleRejection(env, approvalData, callbackQueryId, chatId, messageId) {
  console.log('Rejection received:', approvalData.firm_name);

  await answerCallback(env.TELEGRAM_BOT_TOKEN, callbackQueryId, 'Rejected', false);

  const rejectedText = `❌ *REJECTED*

📊 *Firm:* ${approvalData.firm_name}
📧 *Email:* ${approvalData.lead_email}

*No email was sent.*`;

  await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, rejectedText);

  return { success: true };
}

export default {
  async fetch(request, env) {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Check for required environment variables
    if (!env.TELEGRAM_BOT_TOKEN || !env.GITHUB_TOKEN) {
      console.error('Missing required environment variables');
      return new Response(JSON.stringify({
        error: 'Server misconfigured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const update = await request.json();

      console.log('Received Telegram update:', JSON.stringify(update, null, 2));

      // Handle callback query (button press)
      if (update.callback_query) {
        const { callback_query } = update;
        const callbackData = callback_query.data;
        const callbackParts = callbackData.split(':');
        const action = callbackParts[0];
        const approvalId = callbackParts[1];

        console.log('Callback action:', action, 'approvalId:', approvalId);

        // First try to parse approval data from the message itself
        let approvalData = parseMessageForApprovalData(callback_query.message);

        // If parsing failed, try to decode the approvalId to get firm name
        if (!approvalData && approvalId) {
          try {
            // approvalId is base64-encoded firm name (first 20 chars)
            const firmName = atob(approvalId);
            console.log('Decoded firm name from approvalId:', firmName);

            // Try to fetch from GitHub
            // Generate firm folder name (PascalCase)
            const firmFolder = firmName
              .replace(/[^a-zA-Z0-9\s&]/g, '')
              .split(/\s+/)
              .filter(w => w.length > 0)
              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join('');

            approvalData = await fetchApprovalData(env.GITHUB_TOKEN, firmFolder);

            if (approvalData) {
              console.log('Fetched approval data from GitHub:', approvalData.firm_name);
            }
          } catch (e) {
            console.log('Could not decode approvalId or fetch from GitHub:', e.message);
          }
        }

        if (!approvalData) {
          await answerCallback(
            env.TELEGRAM_BOT_TOKEN,
            callback_query.id,
            'Could not find approval data. Please try again.',
            true
          );
          return new Response(JSON.stringify({ ok: true, error: 'Approval data not found' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const chatId = callback_query.message.chat.id;
        const messageId = callback_query.message.message_id;

        if (action === 'approve') {
          await handleApproval(env, approvalData, callback_query.id, chatId, messageId);
        } else if (action === 'reject') {
          await handleRejection(env, approvalData, callback_query.id, chatId, messageId);
        } else {
          await answerCallback(env.TELEGRAM_BOT_TOKEN, callback_query.id, 'Unknown action', true);
        }
      }

      // Always return 200 OK to Telegram
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Worker error:', error);

      return new Response(JSON.stringify({
        ok: false,
        error: error.message
      }), {
        status: 200, // Still return 200 to prevent Telegram from retrying
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
