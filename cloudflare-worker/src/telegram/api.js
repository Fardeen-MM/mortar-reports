/**
 * Telegram Bot API wrappers.
 */

export async function answerCallback(botToken, callbackQueryId, text, showAlert = false) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: showAlert
    })
  });
  const result = await response.json();
  if (!result.ok) {
    console.error('answerCallback failed:', result.description || JSON.stringify(result));
  }
  return result;
}

export async function editMessage(botToken, chatId, messageId, newText, replyMarkup) {
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: newText,
    parse_mode: 'Markdown'
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!result.ok) {
    console.error('editMessage failed:', result.description || JSON.stringify(result));
  }
  return result;
}

export async function sendTelegramMsg(botToken, chatId, text, options = {}) {
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  };
  if (options.reply_markup) body.reply_markup = options.reply_markup;
  if (options.reply_to_message_id) body.reply_to_message_id = options.reply_to_message_id;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}

export async function sendTelegramReply(env, chatId, replyToMessageId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        reply_to_message_id: replyToMessageId,
        parse_mode: 'Markdown'
      })
    });
  } catch (e) {
    console.error('Telegram reply failed:', e.message);
  }
}

export async function sendTelegramNotification(env, email, replyText, classification) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.log('No Telegram credentials, skipping notification');
    return;
  }

  const badges = {
    INTERESTED: '\ud83d\udfe2 INTERESTED',
    QUESTION: '\u2753 QUESTION',
    OBJECTION: '\ud83d\udfe1 OBJECTION',
    NOT_INTERESTED: '\ud83d\udd34 NOT INTERESTED',
    UNSUBSCRIBE: '\u26d4 UNSUBSCRIBE',
    OOO: '\u2708\ufe0f OUT OF OFFICE',
    IRRELEVANT: '\u26aa IRRELEVANT'
  };

  const cat = typeof classification === 'object' ? classification.category : classification;
  const badge = badges[cat] || `\ud83d\udd34 ${cat}`;
  const summary = typeof classification === 'object' ? classification.summary : '';
  const confidence = typeof classification === 'object' ? ` (${Math.round((classification.confidence || 0) * 100)}%)` : '';

  const msg = `${badge}${confidence}

*Email:* ${email}
${summary ? `*Summary:* ${summary}\n` : ''}
\`\`\`
${(replyText || '').slice(0, 400)}
\`\`\``;

  try {
    await sendTelegramMsg(botToken, chatId, msg);
  } catch (e) {
    console.error('Telegram notification failed:', e.message);
  }
}
