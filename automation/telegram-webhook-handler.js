#!/usr/bin/env node
/**
 * Telegram Webhook Handler
 * Listens for approval/rejection button presses and triggers email send
 * 
 * Run this as a server: node telegram-webhook-handler.js
 * Or deploy to a serverless function
 */

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3001;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

// Answer callback query
function answerCallback(callbackQueryId, text, showAlert = false) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: showAlert
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/answerCallbackQuery`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Edit message to show approval status
function editMessage(chatId, messageId, newText) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      parse_mode: 'Markdown'
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/editMessageText`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Trigger GitHub Actions workflow
function triggerGitHubWorkflow(callbackData) {
  return new Promise((resolve, reject) => {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_REPO = 'Fardeen-MM/mortar-reports';
    
    const payload = JSON.stringify({
      event_type: 'send_approved_email',
      client_payload: {
        firm_name: callbackData.firm,
        lead_email: callbackData.email,
        contact_name: callbackData.contact,
        report_url: callbackData.report_url,
        email_id: callbackData.email_id || ''
      }
    });

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${GITHUB_REPO}/dispatches`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'MortarMetrics-Bot',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 204) {
          resolve({ success: true });
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Handle approval
async function handleApproval(callbackData, callbackQueryId, chatId, messageId) {
  console.log('✅ Approval received:', callbackData.firm);
  
  try {
    // Answer the callback first
    await answerCallback(callbackQueryId, '✅ Sending email...', false);
    
    // Trigger GitHub Actions workflow
    await triggerGitHubWorkflow(callbackData);
    
    // Update message to show success
    const successText = `✅ *APPROVED & SENT*

📊 *Firm:* ${callbackData.firm}
👤 *Contact:* ${callbackData.contact}
📧 *Email:* ${callbackData.email}
🔗 *Report:* ${callbackData.report_url}

✉️ *Email send triggered via GitHub Actions!*`;

    await editMessage(chatId, messageId, successText);
    
    console.log('✅ Email send triggered');
    
  } catch (err) {
    console.error('❌ Failed to trigger email:', err.message);
    
    await editMessage(chatId, messageId, `❌ *ERROR*

Failed to trigger email to ${callbackData.email}

Error: ${err.message}`);
  }
}

// Handle rejection
async function handleRejection(callbackData, callbackQueryId, chatId, messageId) {
  console.log('❌ Rejection received:', callbackData.firm);
  
  await answerCallback(callbackQueryId, '❌ Rejected', false);
  
  const rejectedText = `❌ *REJECTED*

📊 *Firm:* ${callbackData.firm}
📧 *Email:* ${callbackData.email}

*No email was sent.*`;

  await editMessage(chatId, messageId, rejectedText);
}

// HTTP server to receive webhooks
const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    
    req.on('data', chunk => body += chunk);
    
    req.on('end', async () => {
      try {
        const update = JSON.parse(body);
        
        // Handle callback query (button press)
        if (update.callback_query) {
          const { callback_query } = update;
          const callbackData = JSON.parse(callback_query.data);
          
          console.log('📱 Callback received:', callbackData.action, 'for', callbackData.firm);
          
          if (callbackData.action === 'approve') {
            await handleApproval(
              callbackData,
              callback_query.id,
              callback_query.message.chat.id,
              callback_query.message.message_id
            );
          } else if (callbackData.action === 'reject') {
            await handleRejection(
              callbackData,
              callback_query.id,
              callback_query.message.chat.id,
              callback_query.message.message_id
            );
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        
      } catch (err) {
        console.error('❌ Webhook error:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🤖 Telegram webhook handler running on port ${PORT}`);
  console.log(`   Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`\n📝 Set Telegram webhook with:`);
  console.log(`   curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"url":"YOUR_PUBLIC_URL/webhook"}'`);
});
