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
const { buildDM, buildConnectionDM, generateConnectionDM } = require('./dm-templates');

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

// Detect channel and source
const channel = approvalData.channel || 'instantly';
const isProsp = channel === 'prosp';
const source = approvalData.source || '';
const isConnectionAccept = source === 'connection_accept';

// Generate email/DM preview using the LIVE URL (what the lead will actually receive)
const liveReportUrl = approvalData.firm_folder
  ? `https://reports.mortarmetrics.com/${approvalData.firm_folder}/`
  : approvalData.report_url;

let emailPreview, dmPreview, emailQC;

if (isProsp) {
  // DM preview — connection_accept uses AI generation (handled in async block below)
  if (!isConnectionAccept) {
    dmPreview = buildDM(
      approvalData.contact_name,
      approvalData.firm_name,
      liveReportUrl,
      approvalData.total_range || '',
      approvalData.total_cases || '',
      approvalData.practice_label || ''
    );
  }
  emailQC = { errors: [], warnings: [] }; // DMs are too short to need QC
} else {
  // Email preview for Instantly leads
  emailPreview = buildEmail(
    approvalData.contact_name,
    approvalData.firm_name,
    liveReportUrl,
    approvalData.total_range || '',
    approvalData.total_cases || '',
    approvalData.practice_label || ''
  );

  // Run email QC checks
  const { validateEmail } = require('./email-qc');
  emailQC = validateEmail(emailPreview, {
    contactName: approvalData.contact_name,
    firmName: approvalData.firm_name,
    reportUrl: liveReportUrl,
    totalRange: approvalData.total_range || '',
    totalCases: approvalData.total_cases || '',
    practiceLabel: approvalData.practice_label || ''
  });
}

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
  qcStatus = `\n🔴 *QC:* Needs Review${scoreDisplay}`;
  if (approvalData.qc_biggest_issue) {
    qcStatus += `\n📌 *Issue:* ${escMd(approvalData.qc_biggest_issue)}`;
  }
  qcWarning = '\n\n⚠️ *WARNING: AI couldn\'t fully perfect this report - manual review needed*';
  headerEmoji = '🔴';
} else if (approvalData.qc_passed === 'unknown') {
  qcStatus = '\n❓ *QC:* Not run';
}

// Conversion Critic verdict
if (approvalData.conversion_verdict) {
  const cvEmoji = { 'SHIP_IT': '🚀', 'NEEDS_WORK': '📝', 'REBUILD': '🔴' }[approvalData.conversion_verdict] || '📊';
  aiVerdict += `\n${cvEmoji} *Conversion:* ${escMd(approvalData.conversion_verdict)}`;
  if (approvalData.conversion_note) {
    aiVerdict += `\n💡 *Tip:* ${escMd(approvalData.conversion_note)}`;
  }
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

// Build reply text section (highest-value addition — shows what the lead actually said)
let replySection = '';
if (approvalData.reply_text) {
  const replyTruncated = approvalData.reply_text.length > 500
    ? approvalData.reply_text.slice(0, 500) + '...'
    : approvalData.reply_text;
  // Classification badge
  const classificationBadges = {
    INTERESTED: '🟢 INTERESTED',
    QUESTION: '❓ QUESTION',
    OBJECTION: '🟡 OBJECTION',
    NOT_INTERESTED: '🔴 NOT INTERESTED',
    UNSUBSCRIBE: '⛔ UNSUBSCRIBE',
    OOO: '✈️ OUT OF OFFICE',
    IRRELEVANT: '⚪ IRRELEVANT'
  };
  const classBadge = approvalData.classification && approvalData.classification !== 'INTERESTED'
    ? `\n🏷️ *Classification:* ${classificationBadges[approvalData.classification] || approvalData.classification}`
    : '';
  replySection = `\n\n💬 *Lead's Reply:*\n\`\`\`\n${replyTruncated}\n\`\`\`${classBadge}`;
}

// Build campaign/phone line
let campaignPhoneLine = '';
if (approvalData.campaign_name) {
  campaignPhoneLine += `\n📋 *Campaign:* ${escMd(approvalData.campaign_name)}`;
}
if (approvalData.phone) {
  campaignPhoneLine += `\n📞 *Phone:* ${escMd(approvalData.phone)}`;
}

const isOOO = approvalData.classification === 'OOO';
const oooReturnDate = approvalData.ooo_return_date || '';

// Channel badge for Prosp leads
let channelBadge = '';
if (isProsp && approvalData.lead_email) {
  channelBadge = '\n\ud83d\udcac\ud83d\udd17 *DUAL CHANNEL: LinkedIn DM + Email*';
} else if (isProsp) {
  channelBadge = '\n\ud83d\udcac *LINKEDIN DM ONLY*';
}

let message;
if (isOOO) {
  // OOO-specific message — no email preview (welcome-back email generated later)
  message = `✈️ *OOO REPORT — DEPLOY NOW, EMAIL WHEN BACK*${qcWarning}

📊 *Firm:* ${escMd(displayName)}
👤 *Contact:* ${escMd(approvalData.contact_name)}
📧 *Email:* ${escMd(approvalData.lead_email)}${replySection}${campaignPhoneLine}
📅 *Return date:* ${oooReturnDate || 'unknown (defaulted to 5 days)'} (email will queue then)${qcStatus}${aiVerdict}${leadIntelSection}
${contextSection}
🔗 *Review Report:*
${escMd(approvalData.report_url)}

⏰ *Generated:* ${new Date(approvalData.created_at).toLocaleString()}

*Soft reply already auto-sent. Deploy report now — welcome-back email will be generated when they return.*`;
} else if (isProsp && isConnectionAccept) {
  // Connection accept — message built in async block after AI DM generation
  message = '';
} else if (isProsp) {
  // Prosp (LinkedIn DM) lead
  const identityLine = approvalData.lead_email
    ? `\ud83d\udcac *LinkedIn:* ${escMd(approvalData.linkedin_url || '')}\n\ud83d\udce7 *Email:* ${escMd(approvalData.lead_email)}`
    : `\ud83d\udcac *LinkedIn:* ${escMd(approvalData.linkedin_url || '')}`;

  message = `${headerEmoji} *REPORT READY FOR APPROVAL*${channelBadge}${qcWarning}

\ud83d\udcca *Firm:* ${escMd(displayName)}
\ud83d\udc64 *Contact:* ${escMd(approvalData.contact_name)}
${identityLine}${replySection}${campaignPhoneLine}${qcStatus}${aiVerdict}${leadIntelSection}
${contextSection}
\ud83d\udd17 *Review Report:*
${escMd(approvalData.report_url)}

\u23f0 *Generated:* ${new Date(approvalData.created_at).toLocaleString()}

\ud83d\udcac *DM PREVIEW:*
\`\`\`
${dmPreview.body}
\`\`\`

*Please review the report and DM, then choose an action below:*`;
} else {
  message = `${headerEmoji} *REPORT READY FOR APPROVAL*${qcWarning}

\ud83d\udcca *Firm:* ${escMd(displayName)}
\ud83d\udc64 *Contact:* ${escMd(approvalData.contact_name)}
\ud83d\udce7 *Email:* ${escMd(approvalData.lead_email)}${replySection}${campaignPhoneLine}${qcStatus}${aiVerdict}${leadIntelSection}
${contextSection}
\ud83d\udd17 *Review Report:*
${escMd(approvalData.report_url)}

\u23f0 *Generated:* ${new Date(approvalData.created_at).toLocaleString()}

\ud83d\udce7 *EMAIL PREVIEW:*
\`\`\`
${emailPreview.body}
\`\`\`
${emailQC.errors.length > 0 ? `\n\ud83d\udd34 *EMAIL QC ERRORS (will block send):*\n${emailQC.errors.map(e => `  - ${escMd(e)}`).join('\n')}\n` : ''}${emailQC.warnings.length > 0 ? `\n\ud83d\udfe1 *EMAIL QC WARNINGS:*\n${emailQC.warnings.map(w => `  - ${escMd(w)}`).join('\n')}\n` : ''}${emailQC.errors.length === 0 && emailQC.warnings.length === 0 ? '\u2705 Email QC passed' : ''}

*Please review the report and email, then choose an action below:*`;
}

// Build approval ID for callback buttons — use firm_folder directly (exact filename match)
const approvalId = approvalData.firm_folder;

// Inline keyboard with Approve/Reject buttons (using short callback_data)
// Manual builds only get Deploy + Reject (no email sending option)
// OOO leads get Deploy (Send When Back) + Reject
// Prosp leads get Approve & Send DM instead of Approve & Send
const isManualBuild = approvalData.campaign_name === 'manual_build';
let keyboard;
if (isOOO) {
  keyboard = {
    inline_keyboard: [
      [
        { text: '\u2705 Deploy (Send When Back)', callback_data: `approve_no_email:${approvalId}` },
        { text: '\u274c Reject', callback_data: `reject:${approvalId}` }
      ],
      [
        { text: '\ud83d\udd17 Open Report', url: approvalData.report_url }
      ]
    ]
  };
} else if (isManualBuild) {
  keyboard = {
    inline_keyboard: [
      [
        { text: '\u2705 Deploy Report', callback_data: `approve_no_email:${approvalId}` },
        { text: '\u274c Reject', callback_data: `reject:${approvalId}` }
      ],
      [
        { text: '\ud83d\udd17 Open Report', url: approvalData.report_url }
      ]
    ]
  };
} else if (isProsp) {
  keyboard = {
    inline_keyboard: [
      [
        { text: '\u2705 Approve & Send DM', callback_data: `approve:${approvalId}` },
        { text: '\u274c Reject', callback_data: `reject:${approvalId}` }
      ],
      [
        { text: '\ud83d\udcc4 Deploy Only', callback_data: `approve_no_email:${approvalId}` }
      ],
      [
        { text: '\ud83d\udd17 Open Report', url: approvalData.report_url }
      ]
    ]
  };
} else {
  keyboard = {
    inline_keyboard: [
      [
        { text: '\u2705 Approve & Send', callback_data: `approve:${approvalId}` },
        { text: '\u274c Reject', callback_data: `reject:${approvalId}` }
      ],
      [
        { text: '\u270f\ufe0f Edit Email', callback_data: `edit_email:${approvalId}` },
        { text: '\ud83d\udcc4 No Email', callback_data: `approve_no_email:${approvalId}` }
      ],
      [
        { text: '\ud83d\udd17 Open Report', url: approvalData.report_url }
      ]
    ]
  };
}

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
    // For connection_accept: AI-generate the DM before building message
    let finalMessage = message;
    if (isConnectionAccept && isProsp) {
      const apiKey = process.env.ANTHROPIC_API_KEY || '';
      console.log(`🤖 Generating AI connection DM...`);

      // Extract context from research data
      const dmContext = {
        city: researchData?.cityState?.split(',')[0] || researchData?.city || '',
        practiceLabel: approvalData.practice_label || '',
        topCompetitor: researchData?.competitors?.[0]?.name || '',
        biggestGap: ''
      };

      dmPreview = await generateConnectionDM(
        apiKey,
        approvalData.contact_name,
        approvalData.firm_name,
        liveReportUrl,
        dmContext
      );

      // Store generated DM in approval JSON so send-prosp-dm.js uses the exact same text
      approvalData.connection_dm = dmPreview.body;

      console.log(`✅ AI DM generated (${dmPreview.body.length} chars)`);

      // Build the prosp message now that dmPreview is ready
      const identityLine = approvalData.lead_email
        ? `\ud83d\udcac *LinkedIn:* ${escMd(approvalData.linkedin_url || '')}\n\ud83d\udce7 *Email:* ${escMd(approvalData.lead_email)}`
        : `\ud83d\udcac *LinkedIn:* ${escMd(approvalData.linkedin_url || '')}`;

      finalMessage = `\ud83e\udd1d *CONNECTION ACCEPTED — REPORT READY*${channelBadge}${qcWarning}

\ud83d\udcca *Firm:* ${escMd(displayName)}
\ud83d\udc64 *Contact:* ${escMd(approvalData.contact_name)}
${identityLine}${replySection}${campaignPhoneLine}${qcStatus}${aiVerdict}${leadIntelSection}
${contextSection}
\ud83d\udd17 *Review Report:*
${escMd(approvalData.report_url)}

\u23f0 *Generated:* ${new Date(approvalData.created_at).toLocaleString()}

\ud83d\udcac *DM PREVIEW:*
\`\`\`
${dmPreview.body}
\`\`\`

*Please review the report and DM, then choose an action below:*`;
    }

    console.log(`📱 Sending approval request to Telegram...`);
    console.log(`   Firm: ${approvalData.firm_name}`);
    console.log(`   Contact: ${approvalData.contact_name}`);

    const response = await sendTelegramMessage(finalMessage, keyboard);

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
