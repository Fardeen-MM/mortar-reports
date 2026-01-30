#!/usr/bin/env node
/**
 * Get your Telegram Chat ID
 * Usage: node get-telegram-chat-id.js <bot_token>
 */

const https = require('https');

const botToken = process.argv[2];

if (!botToken) {
  console.log('Usage: node get-telegram-chat-id.js <bot_token>');
  console.log('\nSteps:');
  console.log('1. Create a bot with @BotFather');
  console.log('2. Copy the bot token');
  console.log('3. Send a message to your bot');
  console.log('4. Run this script with the token');
  process.exit(1);
}

https.get(`https://api.telegram.org/bot${botToken}/getUpdates`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const updates = JSON.parse(data);
      
      if (!updates.ok) {
        console.error('❌ Error:', updates.description);
        return;
      }
      
      if (updates.result.length === 0) {
        console.log('⚠️  No messages found!');
        console.log('\n📝 Steps:');
        console.log('1. Open Telegram');
        console.log('2. Find your bot');
        console.log('3. Send it a message (any message)');
        console.log('4. Run this script again');
        return;
      }
      
      const latestUpdate = updates.result[updates.result.length - 1];
      const chatId = latestUpdate.message?.chat?.id;
      
      if (chatId) {
        console.log('\n✅ Found your Chat ID!');
        console.log('\n📱 TELEGRAM_CHAT_ID:', chatId);
        console.log('\n📝 Add this to GitHub Secrets:');
        console.log('   Name: TELEGRAM_CHAT_ID');
        console.log('   Value:', chatId);
      } else {
        console.log('❌ Could not find chat ID in updates');
        console.log('\nRaw data:', JSON.stringify(updates, null, 2));
      }
      
    } catch (err) {
      console.error('❌ Parse error:', err.message);
    }
  });
}).on('error', (err) => {
  console.error('❌ Request error:', err.message);
});
