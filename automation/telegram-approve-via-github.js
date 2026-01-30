#!/usr/bin/env node
/**
 * Telegram Approval via GitHub Actions
 * No webhook server needed - uses GitHub Actions workflow dispatch
 */

const https = require('https');
const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'Fardeen-MM/mortar-reports';

// This will be called when user clicks approve in Telegram
async function triggerEmailSend(callbackData) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      event_type: 'send_approved_email',
      client_payload: {
        firm_name: callbackData.firm,
        lead_email: callbackData.email,
        contact_name: callbackData.contact,
        report_url: callbackData.report_url,
        email_id: callbackData.email_id || ''
      }
    });

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${GITHUB_REPO}/dispatches`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'MortarMetrics-Bot',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 204) {
          resolve({ success: true });
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { triggerEmailSend };
