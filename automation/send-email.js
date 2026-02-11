#!/usr/bin/env node
/**
 * Send follow-up email via Instantly API
 * Automatically threads replies by looking up the lead's most recent email UUID.
 * Usage: node send-email.js <email> <contact_name> <report_url> <email_id> <firm_name> <from_email> [total_range] [total_cases] [practice_label] [country]
 */

const https = require('https');
const { buildEmail } = require('./email-templates');

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const recipientEmail = process.argv[2];
const contactName = process.argv[3];
const reportUrl = process.argv[4];
// argv[5] was email_id from webhook - always empty, kept for positional compat
const firmName = process.argv[6];
const fromEmail = process.argv[7] || process.env.FROM_EMAIL || 'fardeen@mortarmetrics.com';
const totalRange = process.argv[8] || '';
const totalCases = process.argv[9] || '';
const practiceLabel = process.argv[10] || '';
const country = process.argv[11] || '';

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

            // Find the lead's reply (email FROM the lead, not from us)
            let leadReply = '';
            for (const em of emails) {
              const fromAddr = (em.from_address_email || em.from_address || em.from || '').toLowerCase();
              if (fromAddr === leadEmail.toLowerCase()) {
                leadReply = em.content_preview || em.body_preview || em.snippet || '';
                console.log(`💬 Lead reply found: "${leadReply.substring(0, 80)}${leadReply.length > 80 ? '...' : ''}"`);
                break;
              }
            }

            return resolve({ id: emails[0].id, eaccount: emails[0].eaccount, leadReply });
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

/**
 * Generate a warm opener using Claude Haiku based on the lead's reply and country.
 * Falls back to "Glad you replied." on error or missing API key.
 */
function generateOpener(leadReply, leadCountry) {
  const fallback = 'Appreciate you getting back to me.';
  if (!ANTHROPIC_API_KEY) {
    console.log('⚠️  No ANTHROPIC_API_KEY - using fallback opener');
    return Promise.resolve(fallback);
  }
  if (!leadReply && leadCountry !== 'CA') return Promise.resolve(fallback);

  let prompt = `You're Fardeen, founder of a legal marketing agency. A law firm lead replied to your cold email with: "${leadReply || 'interested'}"

Write ONE short sentence (max 15 words) that thanks them for replying. Just a quick genuine thank-you, nothing else.

Examples of good openers:
- "Appreciate you getting back to me."
- "Thanks for the reply, glad this caught your eye."
- "Good to hear from you."
- "Glad this resonated."`;

  if (leadCountry === 'CA') {
    prompt += `\nThe lead is Canadian and so are you. Work in something like "always great to work with fellow Canadians" but keep it natural, not forced.`;
  }

  prompt += `\nSound like a real person texting a business contact, not a marketing email. No corporate speak. No exclamation marks. Return ONLY the sentence.`;

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 60,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload),
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content?.[0]?.text?.trim();
          if (text) {
            console.log(`🤖 AI opener: "${text}"`);
            resolve(text);
          } else {
            console.warn('⚠️  Empty AI response, using fallback opener');
            resolve(fallback);
          }
        } catch (e) {
          console.warn(`⚠️  Failed to parse AI response: ${e.message}`);
          resolve(fallback);
        }
      });
    });

    req.on('error', (error) => {
      console.warn(`⚠️  AI opener request failed: ${error.message}`);
      resolve(fallback);
    });

    req.setTimeout(10000, () => {
      console.warn('⚠️  AI opener timed out, using fallback');
      req.destroy();
      resolve(fallback);
    });

    req.write(payload);
    req.end();
  });
}

// --- Main ---
(async () => {
  console.log(`📧 Using ${totalRange ? 'personalized' : 'standard'} email template`);
  console.log(`📨 From: ${fromEmail}`);
  console.log(`📊 Report URL: ${reportUrl}`);
  if (country) console.log(`🌍 Country: ${country}`);

  // Look up the latest email for this lead to get UUID + eaccount for threading
  const latestEmail = await fetchLatestEmail(recipientEmail);

  if (!latestEmail) {
    console.error('❌ Could not find an email thread for this lead - cannot send');
    console.error('   The lead must have an existing email thread in Instantly');
    process.exit(1);
  }

  // Generate AI opener from the lead's reply
  const opener = await generateOpener(latestEmail.leadReply, country);

  // Build email with personalization data + AI opener
  const emailContent = buildEmail(contactName, firmName, reportUrl, totalRange, totalCases, practiceLabel, opener);

  // Run email QC checks
  const { validateEmail } = require('./email-qc');
  const emailQC = validateEmail(emailContent, { contactName, firmName, reportUrl, totalRange, totalCases, practiceLabel });
  if (emailQC.errors.length > 0) {
    console.error('❌ EMAIL QC ERRORS (blocking send):');
    emailQC.errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }
  if (emailQC.warnings.length > 0) {
    console.warn('⚠️  EMAIL QC WARNINGS:');
    emailQC.warnings.forEach(w => console.warn(`   - ${w}`));
  }
  if (emailQC.errors.length === 0 && emailQC.warnings.length === 0) {
    console.log('✅ Email QC passed');
  }

  try {
    await sendEmail(latestEmail.id, latestEmail.eaccount, emailContent);
  } catch (err) {
    console.error('❌ Failed to send reply:', err.message);
    process.exit(1);
  }
})();
