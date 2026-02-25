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
 * Generate a warm opener using Claude Haiku based on the lead's reply, country, and classification.
 * Classification-aware: different prompts for INTERESTED, QUESTION, OBJECTION/NOT_INTERESTED/UNSUBSCRIBE, IRRELEVANT.
 * Falls back to "Appreciate you getting back to me." on error or missing API key.
 */
function generateOpener(leadReply, leadCountry, label, classification) {
  const fallback = 'Appreciate you getting back to me.';
  if (!ANTHROPIC_API_KEY) {
    console.log('⚠️  No ANTHROPIC_API_KEY - using fallback opener');
    return Promise.resolve(fallback);
  }
  if (!leadReply && leadCountry !== 'CA' && classification === 'INTERESTED') return Promise.resolve(fallback);

  const replyText = leadReply || 'interested';
  const caseType = label || 'new cases';
  let prompt;
  let maxTokens = 60;

  console.log(`🏷️ Classification: ${classification}, generating opener`);

  if (classification === 'QUESTION') {
    console.log('❓ QUESTION classification, using answer-and-pivot prompt');
    prompt = `You're Fardeen, founder of a legal marketing agency called Mortar Metrics. A law firm lead replied to your cold email with: "${replyText}"

They asked a question. Write 1-2 short sentences (max 40 words) that:
1. Briefly answer their question (the report covers ${caseType} — new billable matters their competitors are signing that they're currently missing)
2. Pivot to the report you built for them

Examples of good question-answering openers:
- "Great question — the report breaks down new ${caseType} your competitors are signing that you're currently missing. Here's the full breakdown:"
- "Yes, these are new billable ${caseType}. The report shows exactly where they're coming from:"
- "Good question. The analysis covers real ${caseType} in your market — here's what we found:"

Sound like a real person, not a marketing email. No corporate speak. No exclamation marks. Return ONLY the 1-2 sentences.`;
    maxTokens = 120;
  } else if (classification === 'OBJECTION' || classification === 'NOT_INTERESTED' || classification === 'UNSUBSCRIBE') {
    console.log(`🟡 ${classification} classification, using objection-handle prompt`);
    prompt = `You're Fardeen, founder of a legal marketing agency called Mortar Metrics. A law firm lead replied negatively to your cold email. They said: "${replyText}"

Write 2-3 short sentences (max 50 words) that:
1. Acknowledge their response warmly and without pushback
2. Mention you already built a personalized breakdown for their firm (covering ${caseType} their competitors are getting)
3. Frame it as no-commitment — "already done, take a look when you have a minute"

Be confident but not pushy. Don't apologize. Don't grovel. Just be a pro who already did the work.

Examples of good objection-handling openers:
- "Totally understand. We actually already put together a breakdown for your firm before hearing back. Worth a quick look — shows the ${caseType} in your market:"
- "Fair enough. We'd already built this out for you though — no commitment, just a look at what's happening in your area:"
- "No worries at all. We put this together before your reply came in. Take a look if you're curious:"

Sound like a real person, not a marketing email. No corporate speak. No exclamation marks. Return ONLY the 2-3 sentences.`;
    maxTokens = 150;
  } else {
    // INTERESTED, IRRELEVANT, or unknown — warm thank-you
    prompt = `You're Fardeen, founder of a legal marketing agency. A law firm lead replied to your cold email with: "${replyText}"

Write ONE short sentence (max 15 words) that thanks them for replying. Just a quick genuine thank-you, nothing else.

Examples of good openers:
- "Appreciate you getting back to me."
- "Thanks for the reply, glad this caught your eye."
- "Good to hear from you."
- "Glad this resonated."`;
  }

  if (leadCountry === 'CA') {
    prompt += `\nThe lead is Canadian and so are you. Work in something like "always great to work with fellow Canadians" but keep it natural, not forced.`;
  }

  const isMultiSentence = classification === 'QUESTION' || classification === 'OBJECTION' || classification === 'NOT_INTERESTED' || classification === 'UNSUBSCRIBE';
  prompt += `\nSound like a real person texting a business contact, not a marketing email. No corporate speak. No exclamation marks. Return ONLY the sentence${isMultiSentence ? 's' : ''}.`;

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: maxTokens,
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

/**
 * Generate a full AI reply for QUESTION/OBJECTION leads that actually addresses what they said.
 * Returns { subject, body, html } — replaces both generateOpener() + buildEmail() for these cases.
 */
function generateFullReply(replyText, classification, contactName, firmName, reportUrl, practiceLabel, totalRange, country) {
  const firstName = (contactName || '').split(' ')[0] || 'there';
  const now = new Date();
  const dayOfWeek = now.getDay();
  let meetDay1, meetDay2;
  if (dayOfWeek >= 5 || dayOfWeek === 0) {
    meetDay1 = 'Monday'; meetDay2 = 'Tuesday';
  } else {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    meetDay1 = 'tomorrow'; meetDay2 = days[(dayOfWeek + 2) % 7];
  }

  const cleanRange = (totalRange || '').replace(/Â£/g, '£').replace(/Â/g, '');

  let prompt = `You're Fardeen from Mortar Metrics. We help law firms find untapped revenue — data-driven market breakdowns showing how many cases their area supports vs what they're getting, then we run the marketing to close that gap.

A law firm lead replied to our outreach. Read their reply and write a real, thoughtful email response.

LEAD: ${firstName} from ${firmName || 'their firm'}
THEIR REPLY: "${replyText}"
REPORT LINK: ${reportUrl}`;

  if (practiceLabel) prompt += `\nPRACTICE: ${practiceLabel}`;
  if (cleanRange) prompt += `\nREVENUE GAP: ${cleanRange}/mo`;

  prompt += `

Guidelines:
- Actually answer what they said. Address their specific points, questions, or concerns.
- Be conversational and genuine — no marketing speak, no exclamation marks.
- After addressing their reply, naturally transition to the report you built.
- Include the report link naturally in the flow (not as a separate section).
- End with a low-pressure meeting ask — "15 minutes, I'll walk you through the numbers. Does ${meetDay1} or ${meetDay2} work?"
- Start with "Hey ${firstName}," on its own line, then a blank line before the body.
- 4-8 sentences total. Sound like a real person, not a template.
- No sign-off or signature.`;

  if (country === 'CA') {
    prompt += `\nThe lead is Canadian and so are you. Work in something like "always great to work with fellow Canadians" but keep it natural, not forced.`;
  }

  return new Promise((resolve) => {
    const fallbackBody = `Hey ${firstName},\n\nAppreciate you getting back to me. We actually already put together a breakdown for your firm — here's the full report:\n${reportUrl}\n\n15 minutes and I'll walk you through it. Does ${meetDay1} or ${meetDay2} work?`;

    if (!ANTHROPIC_API_KEY) {
      console.log('⚠️  No ANTHROPIC_API_KEY - using fallback full reply');
      return resolve({
        subject: 'Your marketing analysis',
        body: fallbackBody,
        html: plainTextToHtml(fallbackBody)
      });
    }

    const payload = JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 400,
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
            console.log(`🤖 AI full reply (${text.length} chars): "${text.substring(0, 100)}..."`);
            resolve({
              subject: 'Your marketing analysis',
              body: text,
              html: plainTextToHtml(text)
            });
          } else {
            console.warn('⚠️  Empty AI response, using fallback full reply');
            resolve({ subject: 'Your marketing analysis', body: fallbackBody, html: plainTextToHtml(fallbackBody) });
          }
        } catch (e) {
          console.warn(`⚠️  Failed to parse AI response: ${e.message}`);
          resolve({ subject: 'Your marketing analysis', body: fallbackBody, html: plainTextToHtml(fallbackBody) });
        }
      });
    });

    req.on('error', (error) => {
      console.warn(`⚠️  AI full reply request failed: ${error.message}`);
      resolve({ subject: 'Your marketing analysis', body: fallbackBody, html: plainTextToHtml(fallbackBody) });
    });

    req.setTimeout(15000, () => {
      console.warn('⚠️  AI full reply timed out, using fallback');
      req.destroy();
      resolve({ subject: 'Your marketing analysis', body: fallbackBody, html: plainTextToHtml(fallbackBody) });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Convert plain text to simple HTML: split paragraphs, linkify URLs.
 */
function plainTextToHtml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Linkify URLs
  const linkified = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>'
  );
  // Split by double newlines into paragraphs, single newlines become <br>
  return linkified
    .split(/\n\n+/)
    .map(p => `<div>${p.replace(/\n/g, '<br>')}</div>`)
    .join('<div><br /></div>');
}

// --- Main ---
(async () => {
  const customBody = process.env.CUSTOM_EMAIL_BODY;
  const isCustom = !!customBody;

  console.log(`📧 Using ${isCustom ? 'CUSTOM' : totalRange ? 'personalized' : 'standard'} email template`);
  console.log(`📨 From: ${fromEmail}`);
  console.log(`📊 Report URL: ${reportUrl}`);
  if (country) console.log(`🌍 Country: ${country}`);

  const isDryRun = process.env.DRY_RUN === 'true';

  // In DRY_RUN mode, skip Instantly thread lookup (lead may not exist in Instantly)
  let latestEmail = null;
  if (!isDryRun) {
    latestEmail = await fetchLatestEmail(recipientEmail);
    if (!latestEmail) {
      console.error('❌ Could not find an email thread for this lead - cannot send');
      console.error('   The lead must have an existing email thread in Instantly');
      process.exit(1);
    }
  } else {
    console.log('🏜️  DRY RUN — skipping Instantly thread lookup');
  }

  let emailContent;

  if (isCustom) {
    // Custom email: skip AI opener and template, use user-provided text
    console.log(`📝 Custom email body (${customBody.length} chars)`);
    emailContent = {
      subject: 'Your marketing analysis',
      body: customBody,
      html: plainTextToHtml(customBody)
    };
  } else {
    const classification = process.env.REPLY_CLASSIFICATION || 'INTERESTED';
    const leadReplyText = process.env.LEAD_REPLY_TEXT || '';
    const leadReply = leadReplyText || (latestEmail ? latestEmail.leadReply : '');

    // For QUESTION/OBJECTION with a real reply: generate a full contextual AI response
    const isFullReply = (classification === 'QUESTION' || classification === 'OBJECTION') && leadReply;

    if (isFullReply) {
      console.log(`📝 ${classification} with reply text — generating full contextual AI reply`);
      emailContent = await generateFullReply(leadReply, classification, contactName, firmName, reportUrl, practiceLabel, totalRange, country);
    } else {
      // Standard flow: AI opener + template
      const opener = await generateOpener(leadReply, country, practiceLabel, classification);
      emailContent = buildEmail(contactName, firmName, reportUrl, totalRange, totalCases, practiceLabel, opener);
    }
  }

  // Run email QC checks (relaxed for custom/full-reply emails — only check for broken content)
  const isFullReplyEmail = !isCustom && (process.env.REPLY_CLASSIFICATION === 'QUESTION' || process.env.REPLY_CLASSIFICATION === 'OBJECTION') && (process.env.LEAD_REPLY_TEXT || (latestEmail && latestEmail.leadReply));
  const { validateEmail } = require('./email-qc');
  const qcContext = (isCustom || isFullReplyEmail)
    ? { contactName, firmName, reportUrl: reportUrl || 'https://reports.mortarmetrics.com/custom' }
    : { contactName, firmName, reportUrl, totalRange, totalCases, practiceLabel };
  const emailQC = validateEmail(emailContent, qcContext);

  // For custom/full-reply emails, only block on critical errors (empty body, encoding corruption)
  // Skip personalization-related warnings (AI generates the full body, no template placeholders)
  const blockingErrors = (isCustom || isFullReplyEmail)
    ? emailQC.errors.filter(e => !e.includes('Report URL'))
    : emailQC.errors;

  if (blockingErrors.length > 0) {
    console.error('❌ EMAIL QC ERRORS (blocking send):');
    blockingErrors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }
  if (emailQC.warnings.length > 0) {
    console.warn('⚠️  EMAIL QC WARNINGS:');
    emailQC.warnings.forEach(w => console.warn(`   - ${w}`));
  }
  if (blockingErrors.length === 0 && emailQC.warnings.length === 0) {
    console.log('✅ Email QC passed');
  }

  if (isDryRun) {
    console.log('🏜️  DRY RUN — email NOT sent');
    console.log(`   To: ${recipientEmail}`);
    console.log(`   Subject: Re: ${emailContent.subject || 'Your marketing analysis'}`);
    console.log(`   Body preview: ${(emailContent.body || '').slice(0, 200)}...`);
    console.log('✅ Dry run complete — would have sent successfully');
  } else {
    try {
      await sendEmail(latestEmail.id, latestEmail.eaccount, emailContent);
    } catch (err) {
      console.error('❌ Failed to send reply:', err.message);
      process.exit(1);
    }
  }
})();
