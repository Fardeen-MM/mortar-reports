import { generateAutoResponse } from '../ai/auto-response.js';
import { sendInstantlyReply } from '../channels/instantly.js';
import { sendTelegramMsg } from '../telegram/api.js';

// ============ NURTURE REPLY HANDLER ============

/**
 * Handle a reply from a lead who is in the nurture sequence.
 * Pauses nurture, generates auto-reply, sends Telegram with action buttons.
 */
export async function handleNurtureReply(env, email, replyText, classification, nurtureData, leadData) {
  const cat = classification.category;
  const firmName = nurtureData.firm_name || leadData?.firm_name || '';
  const contactName = nurtureData.contact_name || leadData?.contact_name || '';
  const emailsSent = nurtureData.emails_sent || 0;

  // OOO → auto-send casual reply, keep paused with return date, no Telegram ping
  if (cat === 'OOO') {
    // Extract or default return date (5 days from now)
    let returnDate = classification.return_date || null;
    if (!returnDate) {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      returnDate = d.toISOString().split('T')[0];
    }

    nurtureData.status = 'paused';
    nurtureData.paused_at = new Date().toISOString();
    nurtureData.pause_reason = 'ooo';
    nurtureData.ooo_return_date = returnDate;
    await env.WEBHOOK_KV.put(`nurture:${email}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });

    if (env.ANTHROPIC_API_KEY && env.INSTANTLY_API_KEY) {
      const autoReply = await generateAutoResponse(cat, replyText, firmName, contactName, env.ANTHROPIC_API_KEY, {
        isNurtureLead: true,
        hasReport: true,
        emailsSent: emailsSent,
        city: nurtureData.city || '',
        practiceLabel: nurtureData.practice_label || ''
      });
      if (autoReply) {
        try {
          const replyHtml = autoReply.replace(/\n/g, '<br>');
          await sendInstantlyReply(env.INSTANTLY_API_KEY, email, 'Re: Your marketing analysis', replyHtml, autoReply);
          console.log(`OOO auto-reply sent to nurture lead ${email}`);
        } catch (e) {
          console.log(`OOO auto-reply send failed for nurture lead ${email}: ${e.message}`);
        }
      }
    }

    return;
  }

  // Everything else (including UNSUBSCRIBE): pause nurture + generate auto-reply + Telegram buttons
  nurtureData.status = 'paused';
  nurtureData.paused_at = new Date().toISOString();
  nurtureData.pause_reason = 'lead_replied';
  nurtureData.last_reply_text = (replyText || '').slice(0, 500);
  nurtureData.last_reply_category = cat;
  nurtureData.last_reply_at = new Date().toISOString();
  await env.WEBHOOK_KV.put(`nurture:${email}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });

  // Generate auto-reply with full pipeline context
  let autoReply = null;
  if (env.ANTHROPIC_API_KEY) {
    autoReply = await generateAutoResponse(cat, replyText, firmName, contactName, env.ANTHROPIC_API_KEY, {
      isNurtureLead: true,
      hasReport: true,
      emailsSent: emailsSent,
      city: nurtureData.city || '',
      practiceLabel: nurtureData.practice_label || '',
      reportUrl: nurtureData.report_url || ''
    });
  }

  const queueId = crypto.randomUUID();

  // Store auto-reply context for button handlers
  await env.WEBHOOK_KV.put(`nurture_reply:${queueId}`, JSON.stringify({
    email, firmName, contactName, replyText: (replyText || '').slice(0, 500),
    category: cat, autoReply, emailsSent
  }), { expirationTtl: 86400 });

  // Classification badge
  const badges = {
    INTERESTED: '🟢 INTERESTED',
    QUESTION: '❓ QUESTION',
    OBJECTION: '🟡 OBJECTION',
    NOT_INTERESTED: '🔴 NOT INTERESTED',
    UNSUBSCRIBE: '⛔ UNSUBSCRIBE',
    IRRELEVANT: '⚪ IRRELEVANT'
  };
  const badge = badges[cat] || cat;
  const confidence = Math.round((classification.confidence || 0) * 100);
  const esc = s => (s || '').replace(/([_*`\[\]])/g, '');

  let msg = `🔔 *NURTURE LEAD REPLIED*\n\n${badge} (${confidence}%)\n📊 *Firm:* ${esc(firmName)}\n📧 *Email:* ${email}\n📬 *Progress:* ${emailsSent}/7 sent, now PAUSED`;

  msg += `\n\n*Their reply:*\n\`\`\`\n${(replyText || '').slice(0, 400).replace(/`/g, "'")}\n\`\`\``;

  if (autoReply) {
    msg += `\n\n*Suggested response:*\n\`\`\`\n${autoReply.slice(0, 600).replace(/`/g, "'")}\n\`\`\``;
  }

  const buttons = [];
  if (autoReply) {
    buttons.push([
      { text: '✅ Send + Stop Nurture', callback_data: `nr_send_stop:${queueId}` },
      { text: '✅ Send + Continue', callback_data: `nr_send_continue:${queueId}` }
    ]);
  }
  buttons.push([
    { text: '✏️ Edit Reply', callback_data: `nr_edit:${queueId}` },
    { text: '⏭️ Skip Reply', callback_data: `nr_skip:${queueId}` }
  ]);

  try {
    await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, msg, {
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (tgErr) {
    console.error(`Failed to send nurture reply Telegram msg for ${email}:`, tgErr.message);
  }
}
