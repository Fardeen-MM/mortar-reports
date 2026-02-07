#!/usr/bin/env node
/**
 * Send follow-up email via Instantly API
 * Automatically threads replies by looking up the lead's most recent email UUID.
 * Usage: node send-email.js <email> <contact_name> <report_url> <email_id> <firm_name> <from_email> [total_range] [total_cases] [practice_label]
 */

const https = require('https');
const { buildEmail } = require('./email-templates');

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const recipientEmail = process.argv[2];
const contactName = process.argv[3];
const reportUrl = process.argv[4];
// argv[5] was email_id from webhook — always empty, kept for positional compat
const firmName = process.argv[6];
const fromEmail = process.argv[7] || process.env.FROM_EMAIL || 'fardeen@mortarmetrics.com';
const totalRange = process.argv[8] || '';
const totalCases = process.argv[9] || '';
const practiceLabel = process.argv[10] || '';

if (!INSTANTLY_API_KEY) {
  console.error('❌ INSTANTLY_API_KEY environment variable not set');
  process.exit(1);
}

if (!recipientEmail || !contactName || !reportUrl) {
  console.error('Usage: node send-email.js <email> <contact_name> <report_url> [email_id] [firm_name] [from_email] [total_range] [total_cases] [practice_label]');
  process.exit(1);
}

// Decode the base64 API key
const apiKey = Buffer.from(INSTANTLY_API_KEY, 'base64').toString('utf-8');

/**
 * Look up the most recent email UUID for a lead via Instantly's List Emails API.
 * Returns the UUID string, or null if not found / on error.
 */
function fetchLatestEmailId(leadEmail) {
  return new Promise((resolve) => {
    const params = new URLSearchParams({ lead_email: leadEmail });
    const options = {
      hostname: 'api.instantly.ai',
      path: `/api/v2/emails?${params.toString()}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.warn(`⚠️  Email lookup returned status ${res.statusCode}: ${data}`);
            return resolve(null);
          }
          const parsed = JSON.parse(data);
          // API returns { data: [...] } or just [...] — handle both
          const emails = Array.isArray(parsed) ? parsed : (parsed.data || []);
          if (emails.length > 0 && emails[0].id) {
            console.log(`🔍 Found ${emails.length} email(s) for ${leadEmail}, using latest: ${emails[0].id}`);
            return resolve(emails[0].id);
          }
          console.warn(`⚠️  No emails found for ${leadEmail} — will start new thread`);
          resolve(null);
        } catch (e) {
          console.warn(`⚠️  Failed to parse email lookup response: ${e.message}`);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      console.warn(`⚠️  Email lookup request failed: ${error.message}`);
      resolve(null);
    });

    req.end();
  });
}

/**
 * Send email via Instantly — either as a reply (threaded) or new thread.
 */
function sendEmail(replyToUuid, emailContent) {
  return new Promise((resolve, reject) => {
    const emailBody = emailContent.body;
    let path, payloadData;

    if (replyToUuid) {
      // Reply endpoint — threads under the existing conversation
      path = '/api/v2/emails/reply';
      payloadData = {
        eaccount: fromEmail,
        reply_to_uuid: replyToUuid,
        subject: `Re: ${emailContent.subject || 'Your marketing analysis'}`,
        body: { text: emailBody },
      };
      console.log(`📧 Replying in thread to: ${recipientEmail}`);
      console.log(`🔗 Thread UUID: ${replyToUuid}`);
    } else {
      // New thread — current behavior
      path = '/api/v2/email';
      payloadData = {
        email: recipientEmail,
        body: emailBody,
        from_email: fromEmail,
        subject: emailContent.subject || 'Your marketing analysis',
      };
      console.log(`📧 Starting new thread to: ${recipientEmail}`);
    }

    const payload = JSON.stringify(payloadData);

    const options = {
      hostname: 'api.instantly.ai',
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('✅ Email sent successfully via Instantly API');
          console.log('Response:', data);
          resolve(data);
        } else {
          console.error(`❌ Failed to send email. Status: ${res.statusCode}`);
          console.error('Response:', data);
          reject(new Error(`Send failed with status ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error sending email:', error.message);
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

// --- Main ---
(async () => {
  // Build email with personalization data
  const emailContent = buildEmail(contactName, firmName, reportUrl, totalRange, totalCases, practiceLabel);
  console.log(`📧 Using ${totalRange ? 'personalized' : 'standard'} email template`);
  console.log(`📨 From: ${fromEmail}`);
  console.log(`📊 Report URL: ${reportUrl}`);

  // Look up the latest email UUID for this lead to thread the reply
  const replyToUuid = await fetchLatestEmailId(recipientEmail);

  try {
    await sendEmail(replyToUuid, emailContent);
  } catch (err) {
    // If reply failed, try once more as a new thread
    if (replyToUuid) {
      console.warn('⚠️  Reply failed — retrying as new thread...');
      try {
        await sendEmail(null, emailContent);
      } catch (retryErr) {
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
})();
