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
// argv[5] was email_id from webhook - always empty, kept for positional compat
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

// Use the API key as-is (Instantly v2 expects the raw key as Bearer token)
const apiKey = INSTANTLY_API_KEY;

/**
 * Look up the most recent email for a lead via Instantly's List Emails API.
 * Returns { id, eaccount } or null if not found / on error.
 */
function fetchLatestEmail(leadEmail) {
  return new Promise((resolve) => {
    const params = new URLSearchParams({ lead: leadEmail });
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
          // API v2 returns { items: [...] }
          const emails = parsed.items || parsed.data || (Array.isArray(parsed) ? parsed : []);
          if (emails.length > 0 && emails[0].id) {
            console.log(`🔍 Found ${emails.length} email(s) for ${leadEmail}, using latest: ${emails[0].id}`);
            console.log(`📨 Thread eaccount: ${emails[0].eaccount}`);
            return resolve({ id: emails[0].id, eaccount: emails[0].eaccount });
          }
          console.warn(`⚠️  No emails found for ${leadEmail} - cannot thread reply`);
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
 * Send reply email via Instantly v2.
 */
function sendEmail(replyToUuid, eaccount, emailContent) {
  return new Promise((resolve, reject) => {
    const path = '/api/v2/emails/reply';
    const payloadData = {
      eaccount: eaccount,
      reply_to_uuid: replyToUuid,
      subject: `Re: ${emailContent.subject || 'Your marketing analysis'}`,
      body: { html: emailContent.html, text: emailContent.body },
    };
    console.log(`📧 Replying in thread to: ${recipientEmail}`);
    console.log(`🔗 Thread UUID: ${replyToUuid}`);
    console.log(`📨 Sending from: ${eaccount}`);

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

  // Run email QC checks (warnings only, does not block send)
  const { validateEmail } = require('./email-qc');
  const emailQC = validateEmail(emailContent, { contactName, firmName, reportUrl, totalRange, totalCases, practiceLabel });
  if (!emailQC.passed) {
    console.warn('⚠️  EMAIL QC WARNINGS:');
    emailQC.warnings.forEach(w => console.warn(`   - ${w}`));
  } else {
    console.log('✅ Email QC passed');
  }

  console.log(`📧 Using ${totalRange ? 'personalized' : 'standard'} email template`);
  console.log(`📨 From: ${fromEmail}`);
  console.log(`📊 Report URL: ${reportUrl}`);

  // Look up the latest email for this lead to get UUID + eaccount for threading
  const latestEmail = await fetchLatestEmail(recipientEmail);

  if (!latestEmail) {
    console.error('❌ Could not find an email thread for this lead - cannot send');
    console.error('   The lead must have an existing email thread in Instantly');
    process.exit(1);
  }

  try {
    await sendEmail(latestEmail.id, latestEmail.eaccount, emailContent);
  } catch (err) {
    console.error('❌ Failed to send reply:', err.message);
    process.exit(1);
  }
})();
