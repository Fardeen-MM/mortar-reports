#!/usr/bin/env node

/**
 * View and manage reply drafts
 */

const fs = require('fs').promises;
const path = require('path');

const REPLIES_DIR = '/Users/fardeenchoudhury/clawd/replies';

async function listReplies() {
  try {
    const files = await fs.readdir(REPLIES_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.log('No replies found.');
      return;
    }

    console.log(`\n📬 ${jsonFiles.length} Replies:\n`);
    
    for (const file of jsonFiles.sort().reverse()) {
      const filePath = path.join(REPLIES_DIR, file);
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      
      const status = data.status === 'draft_ready' ? '✅' : 
                     data.status === 'draft_failed' ? '❌' : '⏳';
      
      console.log(`${status} ${data.lead_email}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Campaign: ${data.campaign_name}`);
      console.log(`   Received: ${new Date(data.timestamp).toLocaleString()}`);
      
      if (data.draft && data.draft.draft) {
        console.log(`   Draft: ${data.draft.draft.substring(0, 80)}...`);
      }
      
      console.log(`   File: ${file}\n`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function viewReply(replyId) {
  try {
    const filePath = path.join(REPLIES_DIR, `${replyId}.json`);
    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
    
    console.log('\n' + '='.repeat(60));
    console.log(`Reply from: ${data.lead_email}`);
    console.log(`Campaign: ${data.campaign_name}`);
    console.log(`Status: ${data.status}`);
    console.log('='.repeat(60));
    
    console.log('\n📧 THEIR REPLY:');
    console.log(data.reply_text);
    
    if (data.research) {
      console.log('\n🔍 RESEARCH:');
      console.log(`Domain: ${data.research.domain}`);
      console.log(`Fetched: ${new Date(data.research.fetched_at).toLocaleString()}`);
      if (data.research.error) {
        console.log(`Error: ${data.research.error}`);
      }
    }
    
    if (data.draft && data.draft.draft) {
      console.log('\n✍️  DRAFT RESPONSE:');
      console.log('---');
      console.log(data.draft.draft);
      console.log('---');
      console.log(`Generated: ${new Date(data.draft.generated_at).toLocaleString()}`);
    }
    
    console.log('\n📎 METADATA:');
    console.log(`Email ID (for threading): ${data.email_id}`);
    console.log(`From Account: ${data.email_account}`);
    console.log(`Unibox: ${data.unibox_url}`);
    console.log();
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

// Main
const command = process.argv[2];

if (command === 'view' && process.argv[3]) {
  viewReply(process.argv[3]);
} else if (!command || command === 'list') {
  listReplies();
} else {
  console.log('Usage:');
  console.log('  node view-replies.js              # List all replies');
  console.log('  node view-replies.js view <id>    # View specific reply');
}
