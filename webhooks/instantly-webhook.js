#!/usr/bin/env node

/**
 * Instantly Webhook Handler
 * Receives reply_received events and triggers speed-to-lead workflow
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const PORT = process.env.INSTANTLY_WEBHOOK_PORT || 3500;
const WORKSPACE_DIR = '/Users/fardeenchoudhury/clawd';
const REPLIES_DIR = path.join(WORKSPACE_DIR, 'replies');

// Ensure replies directory exists
async function ensureRepliesDir() {
  try {
    await fs.mkdir(REPLIES_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating replies directory:', err);
  }
}

// Process incoming webhook
async function handleWebhook(payload) {
  const { event_type, email_id, lead_email, reply_text, reply_html, campaign_name, email_account, unibox_url } = payload;

  // Only process reply_received events
  if (event_type !== 'reply_received') {
    console.log(`[SKIP] Event type: ${event_type}`);
    return { status: 'skipped', reason: 'not a reply event' };
  }

  console.log(`\n[REPLY RECEIVED] from ${lead_email}`);
  console.log(`Campaign: ${campaign_name}`);
  console.log(`Email ID: ${email_id}`);
  console.log(`From Account: ${email_account}`);

  // Create timestamp for this reply
  const timestamp = new Date().toISOString();
  const replyId = `${timestamp.replace(/[:.]/g, '-')}-${lead_email.replace('@', '-at-')}`;
  const replyFile = path.join(REPLIES_DIR, `${replyId}.json`);

  // Store the reply data
  const replyData = {
    replyId,
    timestamp,
    event_type,
    email_id,
    lead_email,
    reply_text,
    reply_html,
    campaign_name,
    email_account,
    unibox_url,
    status: 'pending_research',
    full_webhook: payload
  };

  await fs.writeFile(replyFile, JSON.stringify(replyData, null, 2));
  console.log(`[STORED] Reply data: ${replyFile}`);

  // Trigger the research workflow asynchronously
  triggerResearch(replyData);

  return { status: 'received', replyId };
}

// Trigger research workflow (non-blocking)
function triggerResearch(replyData) {
  console.log(`[RESEARCH] Starting for ${replyData.lead_email}...`);
  
  // Spawn the research script with environment variables
  const researchScript = path.join(WORKSPACE_DIR, 'scripts', 'research-lead.js');
  const child = spawn('node', [researchScript, replyData.replyId], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env } // Pass all environment variables to child
  });
  
  child.unref();
  console.log(`[RESEARCH] Spawned process for ${replyData.replyId}`);
}

// HTTP server
const server = http.createServer(async (req, res) => {
  // Handle health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'instantly-webhook' }));
    return;
  }

  // Handle webhook POST
  if (req.url === '/webhook' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const result = await handleWebhook(payload);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[ERROR]', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
ensureRepliesDir().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 Instantly webhook listening on port ${PORT}`);
    console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
    console.log(`Health check: http://localhost:${PORT}/health\n`);
  });
});
