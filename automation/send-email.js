#!/usr/bin/env node
/**
 * Send follow-up email via Instantly API
 * Usage: node send-email.js <recipient_email> <contact_name> <report_url>
 */

const https = require('https');

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const recipientEmail = process.argv[2];
const contactName = process.argv[3];
const reportUrl = process.argv[4];
const replyToUuid = process.argv[5]; // Email ID to reply to (keeps it in same thread)

if (!INSTANTLY_API_KEY) {
  console.error('❌ INSTANTLY_API_KEY environment variable not set');
  process.exit(1);
}

if (!recipientEmail || !contactName || !reportUrl) {
  console.error('Usage: node send-email.js <recipient_email> <contact_name> <report_url> [reply_to_uuid]');
  process.exit(1);
}

if (!replyToUuid) {
  console.warn('⚠️  No reply_to_uuid provided - email will be sent as new thread instead of reply');
}

// Extract first name
const firstName = contactName.split(' ')[0];

// Email template (as a reply in the thread)
const emailSubject = `Re: Your marketing analysis`; // Will continue the thread
const emailBody = `Perfect! I just finished putting together your analysis.

I analyzed your website, your competitors in your market, and found some specific gaps you can close.

👉 Here's your personalized report:
${reportUrl}

What you'll see:
• Exact revenue gaps we found (with dollar amounts)
• What your top 3 competitors are doing
• What we'd build for you to capture that revenue

Everything is specific to your firm and your market—no generic fluff.

The booking link is at the bottom of the report if you want to discuss any of this.

Best,
Fardeen`;

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
