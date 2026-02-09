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
const { buildEmail } = require('./email-templates');

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

// Try to load research data for additional context
let researchData = null;
let website = null;
let linkedIn = null;

if (approvalData.firm_name) {
  const reportsDir = path.join(__dirname, 'reports');
  // Use firm_folder if available (already in correct format), otherwise generate slug
  const firmSlug = approvalData.firm_folder
    ? approvalData.firm_folder.toLowerCase()
    : approvalData.firm_name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const possibleFiles = [
    `${firmSlug}-intel-v5.json`,
    `${firmSlug}-research.json`,
  ];
  
  for (const filename of possibleFiles) {
    const filepath = path.join(reportsDir, filename);
    if (fs.existsSync(filepath)) {
      try {
        researchData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        website = researchData.website;
        linkedIn = researchData.firmIntel?.linkedIn || researchData.linkedIn;
        console.log(`✅ Loaded research data: ${filename}`);
        break;
      } catch (e) {
        console.warn(`⚠️  Could not parse ${filename}`);
      }
    }
  }
}

// Generate email preview using the LIVE URL (what the lead will actually receive)
const liveReportUrl = approvalData.firm_folder
  ? `https://reports.mortarmetrics.com/${approvalData.firm_folder}/`
  : approvalData.report_url;
const emailPreview = buildEmail(
  approvalData.contact_name,
  approvalData.firm_name,
  liveReportUrl,
  approvalData.total_range || '',
  approvalData.total_cases || '',
  approvalData.practice_label || ''
);

// Run email QC checks
const { validateEmail } = require('./email-qc');
const emailQC = validateEmail(emailPreview, {
  contactName: approvalData.contact_name,
  firmName: approvalData.firm_name,
  reportUrl: liveReportUrl,
  totalRange: approvalData.total_range || '',
  totalCases: approvalData.total_cases || '',
  practiceLabel: approvalData.practice_label || ''
});

// Escape underscores for Telegram Markdown (URLs contain _ which breaks italic parsing)
function escMd(str) { return (str || '').replace(/_/g, '\\_'); }

// Build approval message with website, LinkedIn, job title, and email preview
let contextSection = '';
if (website) {
  contextSection += `🌐 *Website:* ${escMd(website)}\n`;
}
const bestLinkedIn = approvalData.linkedin || linkedIn;
if (bestLinkedIn) {
  contextSection += `👔 *LinkedIn:* ${escMd(bestLinkedIn)}\n`;
}
if (approvalData.job_title) {
  contextSection += `💼 *Title:* ${escMd(approvalData.job_title)}\n`;
}

// Use firm_folder for display if available (prettier), fallback to firm_name
const displayName = approvalData.firm_folder || approvalData.firm_name;

// Build QC status indicator (including AI Perfector results)
let qcStatus = '';
let qcWarning = '';
let headerEmoji = '🟡';
let aiVerdict = '';

// Get score if available
const score = approvalData.qc_score || approvalData.score || null;
const scoreDisplay = score ? ` (${score}/10)` : '';

if (approvalData.qc_passed === 'true') {
  qcStatus = `\n✅ *QC:* Passed${scoreDisplay}`;
  headerEmoji = '🟢';
  // Add AI verdict if available
  if (approvalData.qc_would_book === 'true') {
    aiVerdict = '\n🤖 *AI Verdict:* Would book a meeting';
  } else if (approvalData.qc_would_book === 'false') {
    aiVerdict = '\n🤖 *AI Verdict:* Might not book';
    if (approvalData.qc_biggest_issue) {
      aiVerdict += `\n📌 *Note:* ${escMd(approvalData.qc_biggest_issue)}`;
    }
    qcWarning = '\n\n⚠️ *AI flagged potential issues - please review*';
    headerEmoji = '🟠';
  }
} else if (approvalData.qc_passed === 'false') {
  const issues = approvalData.qc_issues || '?';
  qcStatus = `\n🔴 *QC:* Needs Review${scoreDisplay}`;
  if (approvalData.qc_biggest_issue) {
    qcStatus += `\n📌 *Issue:* ${escMd(approvalData.qc_biggest_issue)}`;
  }
  qcWarning = '\n\n⚠️ *WARNING: AI couldn\'t fully perfect this report - manual review needed*';
  headerEmoji = '🔴';
} else if (approvalData.qc_passed === 'unknown') {
  qcStatus = '\n❓ *QC:* Not run';
}

// Build lead intelligence section
let leadIntelSection = '';
const leadIntel = approvalData.lead_intelligence;
if (leadIntel && (leadIntel.name || leadIntel.title)) {
  leadIntelSection = '\n\n👤 *LEAD INTELLIGENCE*';
  if (leadIntel.name) {
    leadIntelSection += `\n   Name: ${escMd(leadIntel.name)}`;
  }
  if (leadIntel.title) {
    leadIntelSection += `\n   Title: ${escMd(leadIntel.title)}`;
  }
  if (leadIntel.seniority && leadIntel.seniority !== 'unknown') {
    leadIntelSection += `\n   Seniority: ${escMd(leadIntel.seniority)}`;
  }
  if (leadIntel.is_decision_maker === true) {
    leadIntelSection += '\n   ✅ Decision-maker';
  } else if (leadIntel.is_decision_maker === false) {
    leadIntelSection += '\n   ⚠️ May not be decision-maker';
  }
  if (leadIntel.source) {
    leadIntelSection += `\n   Source: ${escMd(leadIntel.source)}`;
  }
}

const message = `${headerEmoji} *REPORT READY FOR APPROVAL*${qcWarning}

📊 *Firm:* ${escMd(displayName)}
👤 *Contact:* ${escMd(approvalData.contact_name)}
📧 *Email:* ${escMd(approvalData.lead_email)}${qcStatus}${aiVerdict}${leadIntelSection}
${contextSection}
🔗 *Review Report:*
${escMd(approvalData.report_url)}

⏰ *Generated:* ${new Date(approvalData.created_at).toLocaleString()}

📧 *EMAIL PREVIEW:*
\`\`\`
${emailPreview.body}
\`\`\`
${!emailQC.passed ? `\n⚠️ *EMAIL QC ISSUES:*\n${emailQC.warnings.map(w => `  - ${escMd(w)}`).join('\n')}\n` : '✅ Email QC passed'}

*Please review the report and email, then choose an action below:*`;

// Save approval data to file with shorter ID
const approvalId = Buffer.from(approvalData.firm_name).toString('base64').substring(0, 20);
const approvalDataFile = path.join(path.dirname(approvalFile), `approval-${approvalId}.json`);
fs.writeFileSync(approvalDataFile, JSON.stringify(approvalData, null, 2));

// Inline keyboard with Approve/Reject buttons (using short callback_data)
const keyboard = {
  inline_keyboard: [
    [
      {
        text: '✅ Approve & Send',
        callback_data: `approve:${approvalId}`
      },
      {
        text: '❌ Reject',
        callback_data: `reject:${approvalId}`
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
