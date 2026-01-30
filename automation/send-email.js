#!/usr/bin/env node
/**
 * Send follow-up email via Instantly API
 * Usage: node send-email.js <recipient_email> <contact_name> <report_url> [reply_to_uuid] [firm_name]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { buildPersonalizedEmail, buildSimpleEmail } = require('./email-templates');

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const recipientEmail = process.argv[2];
const contactName = process.argv[3];
const reportUrl = process.argv[4];
const replyToUuid = process.argv[5]; // Email ID to reply to (keeps it in same thread)
const firmName = process.argv[6]; // Optional: firm name to find research file

if (!INSTANTLY_API_KEY) {
  console.error('❌ INSTANTLY_API_KEY environment variable not set');
  process.exit(1);
}

if (!recipientEmail || !contactName || !reportUrl) {
  console.error('Usage: node send-email.js <recipient_email> <contact_name> <report_url> [reply_to_uuid] [firm_name]');
  process.exit(1);
}

if (!replyToUuid) {
  console.warn('⚠️  No reply_to_uuid provided - email will be sent as new thread instead of reply');
}

// Try to load research data for personalization
let emailContent;
let researchData = null;

if (firmName) {
  // Try to find the research file
  const reportsDir = path.join(__dirname, 'reports');
  const possibleFiles = [
    `${firmName.toLowerCase().replace(/\s+/g, '-')}-intel-v5.json`,
    `${firmName.toLowerCase().replace(/\s+/g, '-')}-research.json`,
  ];
  
  for (const filename of possibleFiles) {
    const filepath = path.join(reportsDir, filename);
    if (fs.existsSync(filepath)) {
      try {
        researchData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        console.log(`✅ Loaded research data: ${filename}`);
        break;
      } catch (e) {
        console.warn(`⚠️  Could not parse ${filename}`);
      }
    }
  }
}

// Build email (personalized if we have data, simple if not)
if (researchData) {
  emailContent = buildPersonalizedEmail(researchData, contactName, reportUrl);
  console.log('📧 Using AI-personalized email template');
} else {
  emailContent = buildSimpleEmail(contactName, reportUrl);
  console.log('📧 Using standard email template');
}

const emailSubject = emailContent.subject;
const emailBody = emailContent.body;

// Instantly API payload (using their email send/reply endpoint)
const payload = JSON.stringify({
  email: recipientEmail,
  subject: emailSubject,
  body: emailBody,
  from_email: 'fardeen@mortarmetrics.com', // Your sending email
  reply_to_uuid: replyToUuid || undefined, // Reply in same thread if provided
});

console.log(`📧 Sending email to: ${recipientEmail}`);
console.log(`📊 Report URL: ${reportUrl}`);

// Decode the base64 API key
const apiKey = Buffer.from(INSTANTLY_API_KEY, 'base64').toString('utf-8');

const options = {
  hostname: 'api.instantly.ai',
  path: '/api/v2/email',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Email sent successfully via Instantly API');
      console.log('Response:', data);
    } else {
      console.error(`❌ Failed to send email. Status: ${res.statusCode}`);
      console.error('Response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error sending email:', error.message);
  process.exit(1);
});

req.write(payload);
req.end();
