#!/usr/bin/env node

/**
 * Lead Research Script
 * Researches a law firm and generates a response draft using Claude
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const WORKSPACE_DIR = '/Users/fardeenchoudhury/clawd';
const REPLIES_DIR = path.join(WORKSPACE_DIR, 'replies');

// Extract domain from email
function extractDomain(email) {
  return email.split('@')[1];
}

// Run a shell command and return output
function runCommand(command) {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command]);
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Command failed with code ${code}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

// Research the law firm website
async function researchFirm(domain) {
  console.log(`[RESEARCH] Fetching website: ${domain}`);
  
  try {
    // Use jina.ai to fetch and parse the website
    const url = `https://${domain}`;
    const jinaUrl = `https://r.jina.ai/${url}`;
    
    const result = await runCommand(`curl -s "${jinaUrl}"`);
    
    // Extract key sections (simple text extraction)
    const lines = result.split('\n');
    const content = lines.slice(0, 500).join('\n'); // First 500 lines
    
    return {
      domain,
      url,
      content: content.substring(0, 10000), // Limit to 10k chars
      fetched_at: new Date().toISOString()
    };
  } catch (err) {
    console.error(`[ERROR] Failed to fetch ${domain}:`, err.message);
    return {
      domain,
      url: `https://${domain}`,
      content: '',
      error: err.message,
      fetched_at: new Date().toISOString()
    };
  }
}

// Generate response draft using Anthropic Claude
async function generateDraft(replyData, research) {
  console.log(`[DRAFT] Generating response for ${replyData.lead_email}...`);
  
  const prompt = `You are responding to a lead who replied to a cold email about Mortar Metrics' services.

LEAD CONTEXT:
- Email: ${replyData.lead_email}
- Their reply: "${replyData.reply_text}"
- Campaign: ${replyData.campaign_name}

FIRM RESEARCH:
${research.content ? research.content : 'Website not available'}

TASK:
Write a professional, personalized response that:
1. Acknowledges their interest
2. References something specific from their firm's website (if available)
3. Suggests a brief call to discuss their needs
4. Keeps it concise (3-4 sentences max)

Respond in plain text, ready to send.`;

  try {
    // Use Anthropic API (assuming ANTHROPIC_API_KEY is set)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }

    const requestBody = JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      system: 'You are a helpful sales assistant for Mortar Metrics, a marketing agency specializing in cold email for law firms.'
    });

    const curlCommand = `curl -s https://api.anthropic.com/v1/messages \\
      -H "Content-Type: application/json" \\
      -H "x-api-key: ${apiKey}" \\
      -H "anthropic-version: 2023-06-01" \\
      -d '${requestBody.replace(/'/g, "'\\''")}'`;

    const result = await runCommand(curlCommand);
    const response = JSON.parse(result);
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    const draft = response.content[0].text.trim();
    
    return {
      draft,
      model: 'claude-3-haiku-20240307',
      generated_at: new Date().toISOString()
    };
  } catch (err) {
    console.error('[ERROR] Draft generation failed:', err.message);
    return {
      draft: '',
      error: err.message,
      generated_at: new Date().toISOString()
    };
  }
}

// Main workflow
async function main() {
  const replyId = process.argv[2];
  
  if (!replyId) {
    console.error('Usage: node research-lead.js <replyId>');
    process.exit(1);
  }

  const replyFile = path.join(REPLIES_DIR, `${replyId}.json`);
  
  try {
    console.log(`\n[START] Processing reply: ${replyId}`);
    
    // Load reply data
    const replyData = JSON.parse(await fs.readFile(replyFile, 'utf8'));
    
    // Extract domain
    const domain = extractDomain(replyData.lead_email);
    console.log(`[DOMAIN] ${domain}`);
    
    // Research firm
    const research = await researchFirm(domain);
    
    // Generate draft
    const draftResult = await generateDraft(replyData, research);
    
    // Update reply file with research and draft
    replyData.research = research;
    replyData.draft = draftResult;
    replyData.status = draftResult.draft ? 'draft_ready' : 'draft_failed';
    replyData.processed_at = new Date().toISOString();
    
    await fs.writeFile(replyFile, JSON.stringify(replyData, null, 2));
    
    console.log(`[COMPLETE] Draft ready for ${replyData.lead_email}`);
    console.log(`Draft:\n---\n${draftResult.draft}\n---\n`);
    
  } catch (err) {
    console.error('[ERROR]', err);
    process.exit(1);
  }
}

main();
