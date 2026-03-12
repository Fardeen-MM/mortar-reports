#!/usr/bin/env node
/**
 * Send report link via LinkedIn DM using Prosp API
 * Supports both single-body DMs and multi-message sequences.
 *
 * Usage: node send-prosp-dm.js <linkedin_url> <contact_name> <report_url> <firm_name> [total_range] [total_cases] [practice_label]
 */

const https = require('https');
const { buildDM, buildConnectionDM } = require('./dm-templates');

const PROSP_API_KEY = process.env.PROSP_API_KEY;
const PROSP_SENDER = process.env.PROSP_SENDER;
const linkedinUrl = process.argv[2];
const contactName = process.argv[3];
const reportUrl = process.argv[4];
const firmName = process.argv[5];
const totalRange = process.argv[6] || '';
const totalCases = process.argv[7] || '';
const practiceLabel = process.argv[8] || '';

if (!PROSP_API_KEY) {
  console.error('PROSP_API_KEY environment variable not set');
  process.exit(1);
}

if (!PROSP_SENDER) {
  console.error('PROSP_SENDER environment variable not set');
  process.exit(1);
}

if (!linkedinUrl || !contactName || !reportUrl) {
  console.error('Usage: node send-prosp-dm.js <linkedin_url> <contact_name> <report_url> <firm_name> [total_range] [total_cases] [practice_label]');
  process.exit(1);
}

function sendProspMessage(linkedinUrl, sender, message) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      api_key: PROSP_API_KEY,
      linkedin_url: linkedinUrl,
      sender: sender,
      message: message
    });

    const options = {
      hostname: 'prosp.ai',
      path: '/api/v1/leads/send-message',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('DM sent successfully via Prosp API');
          resolve(data);
        } else {
          console.error(`Prosp send failed. Status: ${res.statusCode}`);
          console.error('Response:', data);
          reject(new Error(`Send failed with status ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error sending DM:', error.message);
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log(`Sending report DM via LinkedIn`);
  console.log(`  To: ${linkedinUrl}`);
  console.log(`  Sender: ${PROSP_SENDER}`);
  console.log(`  Report: ${reportUrl}`);

  // Check for pre-generated multi-message sequence (JSON array)
  const connectionDmRaw = process.env.CONNECTION_DM || '';
  const source = process.env.SOURCE || '';
  let dm;

  if (connectionDmRaw) {
    try {
      const parsed = JSON.parse(connectionDmRaw);
      if (Array.isArray(parsed)) {
        dm = { messages: parsed };
        console.log(`  Using pre-generated ${parsed.length}-message sequence`);
      } else {
        dm = { body: connectionDmRaw };
        console.log(`  Using pre-generated single DM`);
      }
    } catch {
      dm = { body: connectionDmRaw };
      console.log(`  Using pre-generated single DM`);
    }
  } else if (source === 'connection_accept') {
    dm = buildConnectionDM(contactName, firmName, reportUrl, totalRange, practiceLabel);
    console.log(`  Using template ${dm.messages ? dm.messages.length + '-message sequence' : 'single DM'}`);
  } else {
    dm = buildDM(contactName, firmName, reportUrl, totalRange, totalCases, practiceLabel);
  }

  const isDryRun = process.env.DRY_RUN === 'true';

  // Multi-message sequence
  if (dm.messages) {
    console.log(`  Sending ${dm.messages.length} messages with delays...`);
    for (let i = 0; i < dm.messages.length; i++) {
      const msg = dm.messages[i];
      console.log(`  [${i + 1}/${dm.messages.length}] ${msg.slice(0, 80)}...`);

      if (isDryRun) {
        console.log(`  DRY RUN - message ${i + 1} NOT sent`);
        continue;
      }

      try {
        await sendProspMessage(linkedinUrl, PROSP_SENDER, msg);
      } catch (err) {
        console.error(`Failed to send message ${i + 1}:`, err.message);
        process.exit(1);
      }

      // Wait 3-6 seconds between messages to look natural
      if (i < dm.messages.length - 1) {
        const delay = 3000 + Math.floor(Math.random() * 3000);
        console.log(`  Waiting ${(delay / 1000).toFixed(1)}s before next message...`);
        await sleep(delay);
      }
    }
    console.log(`  All ${dm.messages.length} messages sent!`);
  } else {
    // Single message
    console.log(`  DM: ${dm.body.slice(0, 100)}...`);

    if (isDryRun) {
      console.log('DRY RUN - DM NOT sent');
      console.log(`  Body: ${dm.body}`);
      return;
    }

    try {
      await sendProspMessage(linkedinUrl, PROSP_SENDER, dm.body);
    } catch (err) {
      console.error('Failed to send DM:', err.message);
      process.exit(1);
    }
  }
})();
