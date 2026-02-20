#!/usr/bin/env node
/**
 * Send report link via LinkedIn DM using Prosp API
 * Parallel to send-email.js but for LinkedIn DMs.
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

(async () => {
  console.log(`Sending report DM via LinkedIn`);
  console.log(`  To: ${linkedinUrl}`);
  console.log(`  Sender: ${PROSP_SENDER}`);
  console.log(`  Report: ${reportUrl}`);

  const source = process.env.SOURCE || '';
  const dm = source === 'connection_accept'
    ? buildConnectionDM(contactName, firmName, reportUrl, practiceLabel)
    : buildDM(contactName, firmName, reportUrl, totalRange, totalCases, practiceLabel);
  console.log(`  DM: ${dm.body.slice(0, 100)}...`);

  const isDryRun = process.env.DRY_RUN === 'true';
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
})();
