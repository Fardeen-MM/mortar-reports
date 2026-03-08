/**
 * Prosp (LinkedIn DM) channel: webhook handling, DM sending.
 */

import { sendTelegramMsg, sendTelegramNotification } from '../telegram/api.js';
import { classifyReplyAI } from '../ai/classify.js';
import { generateAutoResponse } from '../ai/auto-response.js';
import { queueDM } from '../queues/dm-queue.js';
import { forwardToGitHub } from '../github.js';

export async function sendProspDM(apiKey, linkedinUrl, senderUrl, message) {
  const resp = await fetch('https://prosp.ai/api/v1/leads/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      linkedin_url: linkedinUrl,
      sender: senderUrl,
      message: message
    })
  });
  if (!resp.ok) throw new Error(`Prosp send failed: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

export function normalizeLinkedInUrl(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '')
    .replace(/\/$/, '').toLowerCase();
}

export async function handleProspWebhook(env, payload, ctx) {
  const eventData = payload.eventData || payload.data || payload;
  const profileInfo = eventData.profileInfo || eventData.profile_info || eventData.profile || eventData.lead_info || {};
  const linkedinUrl = eventData.lead || eventData.linkedin_url || eventData.linkedinUrl
    || eventData.profile_url || profileInfo.linkedin_url || profileInfo.linkedinUrl
    || payload.linkedin_url || payload.linkedinUrl || '';
  const content = eventData.content || eventData.message || eventData.reply || eventData.text || payload.message || '';
  const sender = eventData.sender || eventData.sender_url || payload.sender || '';
  const campaignName = eventData.campaignName || eventData.campaign_name || payload.campaignName || payload.campaign_name || '';

  const firstName = profileInfo.firstName || profileInfo.first_name || eventData.firstName || eventData.first_name || payload.first_name || '';
  const lastName = profileInfo.lastName || profileInfo.last_name || eventData.lastName || eventData.last_name || payload.last_name || '';
  const contactName = [firstName, lastName].filter(Boolean).join(' ');
  const company = profileInfo.company || profileInfo.company_name || eventData.company || eventData.company_name || payload.company || '';
  const email = profileInfo.email || eventData.email || payload.email || '';
  const normalizedLi = normalizeLinkedInUrl(linkedinUrl);

  console.log(`Prosp webhook: ${normalizedLi} (${contactName}, ${company})`);

  if (!normalizedLi) {
    return { ok: false, error: 'missing linkedin URL' };
  }

  const doneKey = `done_li:${normalizedLi}`;
  const alreadyDone = await env.WEBHOOK_KV.get(doneKey);
  if (alreadyDone) {
    console.log(`Already processed ${normalizedLi}, ignoring`);
    return { ok: true, message: 'already processed' };
  }
  await env.WEBHOOK_KV.put(doneKey, 'true', { expirationTtl: 300 });

  const classification = await classifyReplyAI(content, env.ANTHROPIC_API_KEY);
  console.log(`Prosp classification for ${normalizedLi}: ${classification.category} (${classification.confidence})`);

  await sendTelegramNotification(env, linkedinUrl, content, classification);

  // Check if lead is in nurture sequence
  const nurtureKey = email || normalizedLi;
  const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${nurtureKey}`);
  if (nurtureRaw) {
    const nurtureData = JSON.parse(nurtureRaw);
    if (nurtureData.status === 'active' || nurtureData.status === 'paused') {
      console.log(`Prosp nurture lead replied: ${nurtureKey} (status=${nurtureData.status})`);
      const cat = classification.category;
      const firmName = nurtureData.firm_name || company || 'Unknown';
      const nurtureFirstName = firstName || contactName.split(' ')[0] || '';
      const emailsSent = nurtureData.emails_sent || 0;

      if (cat === 'OOO') {
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
        await env.WEBHOOK_KV.put(`nurture:${nurtureKey}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });

        if (env.ANTHROPIC_API_KEY && env.PROSP_API_KEY) {
          const autoReply = await generateAutoResponse(cat, content, firmName, nurtureFirstName, env.ANTHROPIC_API_KEY, {
            isNurtureLead: true, hasReport: true, emailsSent
          });
          if (autoReply) {
            try {
              const senderUrl = sender || env.PROSP_SENDER;
              if (senderUrl) {
                await sendProspDM(env.PROSP_API_KEY, linkedinUrl, senderUrl, autoReply);
                console.log(`OOO auto-DM sent to nurture lead ${normalizedLi}`);
              }
            } catch (e) {
              console.log(`OOO auto-DM send failed: ${e.message}`);
            }
          }
        }
        return { ok: true, message: 'nurture OOO handled' };
      }

      // Non-OOO nurture reply
      nurtureData.status = 'paused';
      nurtureData.paused_at = new Date().toISOString();
      nurtureData.pause_reason = 'lead_replied';
      nurtureData.last_reply_text = (content || '').slice(0, 500);
      nurtureData.last_reply_category = cat;
      nurtureData.last_reply_at = new Date().toISOString();
      await env.WEBHOOK_KV.put(`nurture:${nurtureKey}`, JSON.stringify(nurtureData), { expirationTtl: 2592000 });

      let autoReply = null;
      if (env.ANTHROPIC_API_KEY) {
        autoReply = await generateAutoResponse(cat, content, firmName, nurtureFirstName, env.ANTHROPIC_API_KEY, {
          isNurtureLead: true, hasReport: true, emailsSent,
          city: nurtureData.city || '', practiceLabel: nurtureData.practice_label || '',
          reportUrl: nurtureData.report_url || ''
        });
      }

      const queueId = crypto.randomUUID();
      await env.WEBHOOK_KV.put(`nurture_reply:${queueId}`, JSON.stringify({
        email: email || '', linkedin_url: linkedinUrl, prosp_sender: sender,
        firmName, contactName: nurtureFirstName, replyText: (content || '').slice(0, 500),
        category: cat, autoReply, emailsSent, channel: 'prosp'
      }), { expirationTtl: 86400 });

      const badges = {
        INTERESTED: '\ud83d\udfe2 INTERESTED', QUESTION: '\u2753 QUESTION', OBJECTION: '\ud83d\udfe1 OBJECTION',
        NOT_INTERESTED: '\ud83d\udd34 NOT INTERESTED', UNSUBSCRIBE: '\u26d4 UNSUBSCRIBE', IRRELEVANT: '\u26aa IRRELEVANT'
      };
      const badge = badges[cat] || cat;
      const confidence = Math.round((classification.confidence || 0) * 100);
      const esc = s => (s || '').replace(/([_*`\[\]])/g, '');

      let msg = `\ud83d\udd14 *NURTURE LEAD REPLIED (LinkedIn)*\n\n${badge} (${confidence}%)\n\ud83d\udcca *Firm:* ${esc(firmName)}\n\ud83d\udd17 *LinkedIn:* ${esc(linkedinUrl)}\n\ud83d\udcec *Progress:* ${emailsSent}/7 sent, now PAUSED`;
      msg += `\n\n*Their reply:*\n\`\`\`\n${(content || '').slice(0, 400).replace(/`/g, "'")}\n\`\`\``;
      if (autoReply) {
        msg += `\n\n*Suggested DM response:*\n\`\`\`\n${autoReply.slice(0, 600).replace(/`/g, "'")}\n\`\`\``;
      }

      const buttons = [];
      if (autoReply) {
        buttons.push([
          { text: '\u2705 Send DM + Stop', callback_data: `nrd_send_stop:${queueId}` },
          { text: '\u2705 Send DM + Continue', callback_data: `nrd_send_cont:${queueId}` }
        ]);
      }
      buttons.push([
        { text: '\u270f\ufe0f Edit Reply', callback_data: `nrd_edit:${queueId}` },
        { text: '\u23ed\ufe0f Skip Reply', callback_data: `nrd_skip:${queueId}` }
      ]);

      try {
        await sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, msg, {
          reply_markup: { inline_keyboard: buttons }
        });
      } catch (tgErr) {
        console.error(`Failed to send nurture DM reply Telegram msg:`, tgErr.message);
      }

      return { ok: true, message: 'nurture reply handled via DM' };
    }
  }

  // OOO: auto-send casual DM + trigger report pipeline
  if (classification.category === 'OOO') {
    console.log(`OOO from ${normalizedLi}, auto-sending casual DM + triggering report`);

    let returnDate = classification.return_date || null;
    if (!returnDate) {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      returnDate = d.toISOString().split('T')[0];
    }

    await env.WEBHOOK_KV.put(`ooo:${normalizedLi}`, JSON.stringify({
      detected_at: new Date().toISOString(),
      return_date: returnDate
    }), { expirationTtl: 604800 });

    if (env.ANTHROPIC_API_KEY && env.PROSP_API_KEY) {
      const jobTitle = profileInfo.jobTitle || profileInfo.job_title || eventData.jobTitle || eventData.job_title || '';
      const autoReply = await generateAutoResponse('OOO', content, company, firstName, env.ANTHROPIC_API_KEY, {
        hasReport: false,
        jobTitle
      });
      if (autoReply) {
        try {
          const senderUrl = sender || env.PROSP_SENDER;
          if (senderUrl) {
            await sendProspDM(env.PROSP_API_KEY, linkedinUrl, senderUrl, autoReply);
            console.log(`OOO auto-DM sent to ${normalizedLi}`);
          }
        } catch (e) {
          console.log(`OOO auto-DM send failed: ${e.message}`);
        }
      }
    }
  }

  // QUESTION, OBJECTION, NOT_INTERESTED: generate auto-reply DM + queue for approval
  const replyCategories = ['QUESTION', 'OBJECTION', 'NOT_INTERESTED'];
  if (replyCategories.includes(classification.category) && env.ANTHROPIC_API_KEY) {
    const jobTitle = profileInfo.jobTitle || profileInfo.job_title || eventData.jobTitle || eventData.job_title || '';
    const autoReply = await generateAutoResponse(
      classification.category, content, company, firstName, env.ANTHROPIC_API_KEY, {
        hasReport: false,
        jobTitle,
        campaignName: campaignName || ''
      }
    );

    if (autoReply && env.PROSP_API_KEY) {
      await queueDM(env, {
        type: 'auto-reply',
        linkedin_url: linkedinUrl,
        sender: sender || env.PROSP_SENDER || '',
        message: autoReply,
        contact_name: contactName,
        firm_name: company,
        context: `${classification.category}: ${classification.summary}`
      });
    }
  }

  // Build GitHub payload for report pipeline
  const phone = profileInfo.phoneNumber || profileInfo.phone_number || profileInfo.phone || eventData.phone || '';
  const jobTitle = profileInfo.jobTitle || profileInfo.job_title || eventData.jobTitle || eventData.job_title || '';
  const website = profileInfo.websiteUrl || profileInfo.website_url || profileInfo.website
    || profileInfo.companyUrl || profileInfo.company_url || eventData.website || '';

  const meta = {
    reply_text: content ? content.slice(0, 500) : '',
    campaign_name: campaignName,
    phone,
    timestamp: new Date().toISOString(),
    classification: classification.category,
    channel: 'prosp',
    linkedin_url: linkedinUrl,
    prosp_sender: sender,
    ooo_return_date: classification.return_date || ''
  };

  const githubPayload = {
    event_type: 'interested_lead',
    client_payload: {
      email: email,
      first_name: firstName,
      last_name: lastName,
      website: website,
      location: '',
      country: '',
      company: company,
      job_title: jobTitle,
      linkedin: linkedinUrl,
      _meta: JSON.stringify(meta)
    }
  };

  console.log('DISPATCHING PROSP PAYLOAD:', JSON.stringify(githubPayload));
  await forwardToGitHub(env, githubPayload);

  return { ok: true, message: 'classified and dispatched' };
}

export async function handleConnectionAccepted(env, payload) {
  const eventData = payload.eventData || payload.data || payload;
  const profileInfo = eventData.profileInfo || eventData.profile_info || eventData.profile || eventData.lead_info || {};
  const linkedinUrl = eventData.lead || eventData.linkedin_url || eventData.linkedinUrl
    || eventData.profile_url || profileInfo.linkedin_url || profileInfo.linkedinUrl
    || payload.linkedin_url || payload.linkedinUrl || '';
  const sender = eventData.sender || eventData.sender_url || payload.sender || '';
  const campaignName = eventData.campaignName || eventData.campaign_name || payload.campaignName || payload.campaign_name || '';

  const firstName = profileInfo.firstName || profileInfo.first_name || eventData.firstName || eventData.first_name || payload.first_name || '';
  const lastName = profileInfo.lastName || profileInfo.last_name || eventData.lastName || eventData.last_name || payload.last_name || '';
  const contactName = [firstName, lastName].filter(Boolean).join(' ');
  const company = profileInfo.company || profileInfo.company_name || eventData.company || eventData.company_name || payload.company || '';
  const email = profileInfo.email || eventData.email || payload.email || '';
  const normalizedLi = normalizeLinkedInUrl(linkedinUrl);

  console.log(`Connection accepted: ${contactName} (${company}) - ${normalizedLi}`);

  if (!normalizedLi) {
    return { ok: false, error: 'missing linkedin URL' };
  }

  const doneKey = `done_conn:${normalizedLi}`;
  if (await env.WEBHOOK_KV.get(doneKey)) {
    console.log(`Already processed connection from ${normalizedLi}, ignoring`);
    return { ok: true, message: 'already processed connection' };
  }
  await env.WEBHOOK_KV.put(doneKey, 'true', { expirationTtl: 86400 });

  const phone = profileInfo.phoneNumber || profileInfo.phone_number || profileInfo.phone || eventData.phone || '';
  const jobTitle = profileInfo.jobTitle || profileInfo.job_title || eventData.jobTitle || eventData.job_title || '';
  const website = profileInfo.websiteUrl || profileInfo.website_url || profileInfo.website
    || profileInfo.companyUrl || profileInfo.company_url || eventData.website || '';

  const meta = {
    reply_text: '',
    campaign_name: campaignName,
    phone,
    timestamp: new Date().toISOString(),
    classification: 'INTERESTED',
    channel: 'prosp',
    source: 'connection_accept',
    linkedin_url: linkedinUrl,
    prosp_sender: sender,
    ooo_return_date: ''
  };

  const githubPayload = {
    event_type: 'interested_lead',
    client_payload: {
      email: email,
      first_name: firstName,
      last_name: lastName,
      website: website,
      location: '',
      country: '',
      company: company,
      job_title: jobTitle,
      linkedin: linkedinUrl,
      _meta: JSON.stringify(meta)
    }
  };

  console.log('DISPATCHING CONNECTION ACCEPT PAYLOAD:', JSON.stringify(githubPayload));
  await forwardToGitHub(env, githubPayload);

  return { ok: true, message: 'connection accepted, pipeline triggered' };
}
