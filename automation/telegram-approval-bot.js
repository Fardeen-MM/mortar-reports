#!/usr/bin/env node
/**
 * Telegram Approval Bot
 * Sends report approval requests to Telegram with inline buttons
 * 
 * Usage: node telegram-approval-bot.js <approval-json-path>
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('❌ Missing required environment variables:');
  console.error('   - TELEGRAM_BOT_TOKEN');
  console.error('   - TELEGRAM_CHAT_ID');
  process.exit(1);
}

const approvalFile = process.argv[2];
if (!approvalFile) {
  console.error('Usage: node telegram-approval-bot.js <approval-json-path>');
  process.exit(1);
}

// Load approval data
const approvalData = JSON.parse(fs.readFileSync(approvalFile, 'utf8'));

// Create approval message
const message = `🟡 *REPORT READY FOR APPROVAL*

📊 *Firm:* ${approvalData.firm_name}
👤 *Contact:* ${approvalData.contact_name}
📧 *Email:* ${approvalData.lead_email}

🔗 *Review Report:*
${approvalData.report_url}

⏰ *Generated:* ${new Date(approvalData.created_at).toLocaleString()}

*Please review the report and choose an action below:*`;

// Inline keyboard with Approve/Reject buttons
const keyboard = {
  inline_keyboard: [
    [
      {
        text: '✅ Approve & Send',
        callback_data: JSON.stringify({
          action: 'approve',
          firm: approvalData.firm_name,
          email: approvalData.lead_email,
          contact: approvalData.contact_name,
          report_url: approvalData.report_url,
          email_id: approvalData.email_id || ''
        })
      },
      {
        text: '❌ Reject',
        callback_data: JSON.stringify({
          action: 'reject',
          firm: approvalData.firm_name,
          email: approvalData.lead_email
        })
      }
    ],
    [
      {
        text: '🔗 Open Report',
        url: approvalData.report_url
      }
    ]
  ]
};

// Send message to Telegram
function sendTelegramMessage(text, replyMarkup) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: CHAT_ID,
      text: text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
      disable_web_page_preview: false
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          resolve(response);
        } else {
          reject(new Error(`Telegram API error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Send approval request
(async () => {
  try {
    console.log(`📱 Sending approval request to Telegram...`);
    console.log(`   Firm: ${approvalData.firm_name}`);
    console.log(`   Contact: ${approvalData.contact_name}`);
    
    const response = await sendTelegramMessage(message, keyboard);
    
    console.log(`✅ Approval request sent!`);
    console.log(`   Message ID: ${response.result.message_id}`);
    
    // Save message ID for tracking
    approvalData.telegram_message_id = response.result.message_id;
    approvalData.status = 'awaiting_approval';
    fs.writeFileSync(approvalFile, JSON.stringify(approvalData, null, 2));
    
  } catch (err) {
    console.error('❌ Failed to send Telegram message:', err.message);
    process.exit(1);
  }
})();
