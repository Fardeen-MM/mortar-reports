/**
 * Instantly email channel: webhook handling, dedup/merge, send replies.
 */

import { sendTelegramMsg, sendTelegramNotification } from '../telegram/api.js';
import { classifyReplyAI, classifyReplyFallback } from '../ai/classify.js';
import { quickResearch, generateQuickReply } from '../ai/quick-reply.js';
import { queueEmail } from '../queues/email-queue.js';
import { handleNurtureReply } from '../nurture/reply-handler.js';

export async function sendInstantlyReply(apiKey, leadEmail, subject, html, text) {
  const lookupUrl = `https://api.instantly.ai/api/v2/emails?lead=${encodeURIComponent(leadEmail)}`;
  const lookupResp = await fetch(lookupUrl, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!lookupResp.ok) {
    const errText = await lookupResp.text();
    throw new Error(`Instantly email lookup failed: ${lookupResp.status} ${errText}`);
  }

  const lookupData = await lookupResp.json();
  const emails = lookupData.items || lookupData.data || (Array.isArray(lookupData) ? lookupData : []);

  if (!emails.length || !emails[0].id) {
    throw new Error(`No email thread found for ${leadEmail}`);
  }

  const replyToUuid = emails[0].id;
  const eaccount = emails[0].eaccount;

  const replyResp = await fetch('https://api.instantly.ai/api/v2/emails/reply', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      eaccount,
      reply_to_uuid: replyToUuid,
      subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      body: { html, text }
    })
  });

  if (!replyResp.ok) {
    const errText = await replyResp.text();
    throw new Error(`Instantly send failed: ${replyResp.status} ${errText}`);
  }

  return replyResp.json();
}

// Helper: dig into nested objects for field extraction
function dig(payload, ...keys) {
  for (const key of keys) {
    const val = payload[key];
    if (val && typeof val === 'string' && val.trim()) return val.trim();
  }
  const nested = payload.lead || payload.contact || payload.lead_data || payload.data || {};
  for (const key of keys) {
    const val = nested[key];
    if (val && typeof val === 'string' && val.trim()) return val.trim();
  }
  return '';
}

export function buildGithubPayload(payload) {
  const city = dig(payload, 'city', 'City', 'lead_city', 'location_city');
  const state = dig(payload, 'state', 'State', 'lead_state', 'location_state', 'province', 'Province', 'region');
  const location = city || state ? `${city}|${state}` : '';

  const built = {
    event_type: 'interested_lead',
    client_payload: {
      email: dig(payload, 'lead_email', 'email', 'Email', 'email_address', 'emailAddress', 'to_email'),
      first_name: dig(payload, 'first_name', 'firstName', 'First Name', 'first', 'lead_first_name'),
      last_name: dig(payload, 'last_name', 'lastName', 'Last Name', 'last', 'lead_last_name'),
      website: dig(payload, 'website', 'companyUrl', 'company_url', 'Website', 'company_website',
        'lead_website', 'url', 'domain', 'companyDomain', 'company_domain'),
      location: location,
      country: dig(payload, 'country', 'Country', 'lead_country', 'location_country', 'country_code'),
      company: dig(payload, 'company', 'companyName', 'company_name', 'Company', 'organization',
        'Organization', 'lead_company', 'lead_company_name'),
      job_title: dig(payload, 'jobTitle', 'job_title', 'title', 'Title', 'lead_title'),
      linkedin: dig(payload, 'linkedIn', 'linkedin', 'LinkedIn', 'linkedin_url', 'lead_linkedin'),
      _meta: ''
    }
  };

  let clearedByGuard = false;
  if (built.client_payload.first_name && built.client_payload.email) {
    const local = built.client_payload.email.split('@')[0].toLowerCase();
    if (built.client_payload.first_name.toLowerCase() === local) {
      const hasVowels = /[aeiou]/i.test(local);
      const isGeneric = /^(info|contact|admin|office|support|hello|team|legal|law|mail|enquiries|help)$/.test(local);
      const isTooShort = local.length <= 2;
      const isInitials = local.length <= 5 && !hasVowels;
      if (isGeneric || isTooShort || isInitials) {
        console.log(`first_name "${built.client_payload.first_name}" matches email local part and looks like garbage - clearing`);
        built.client_payload.first_name = '';
        built.client_payload.last_name = '';
        clearedByGuard = true;
      } else {
        console.log(`first_name "${built.client_payload.first_name}" matches email local part but looks like a real name - keeping`);
      }
    }
  }

  if (!built.client_payload.first_name) {
    const fullName = dig(payload, 'fullName', 'full_name', 'Full Name', 'name', 'lead_name', 'contact_name');
    if (fullName && fullName.trim().includes(' ')) {
      const parts = fullName.trim().split(/\s+/);
      built.client_payload.first_name = parts[0];
      built.client_payload.last_name = parts.slice(1).join(' ');
      console.log(`Recovered name from fullName field: "${fullName}" -> first="${built.client_payload.first_name}" last="${built.client_payload.last_name}"`);
    }
  }

  return built;
}

function mergePayloads(a, b) {
  const merged = { event_type: 'interested_lead', client_payload: {} };
  const allFields = new Set([...Object.keys(a.client_payload), ...Object.keys(b.client_payload)]);
  const preferLonger = new Set(['first_name', 'last_name', 'company', 'job_title', 'linkedin']);
  const skipFields = new Set(['_meta']);
  for (const field of allFields) {
    if (skipFields.has(field)) { merged.client_payload[field] = ''; continue; }
    const valA = a.client_payload[field] || '';
    const valB = b.client_payload[field] || '';
    if (preferLonger.has(field) && valA && valB) {
      merged.client_payload[field] = valA.length >= valB.length ? valA : valB;
    } else {
      merged.client_payload[field] = valA || valB || '';
    }
  }
  return merged;
}

async function listMergeDispatch(env, email, minSlots) {
  const keys = await env.WEBHOOK_KV.list({ prefix: `wh:${email}|` });
  console.log(`listMergeDispatch(${email}): found ${keys.keys.length} slot(s) (need ${minSlots})`);

  if (keys.keys.length < minSlots) return false;

  let merged = null;
  let collectedExtra = { _reply_text: '', _campaign_name: '', _phone: '', _timestamp: '' };

  for (const key of keys.keys) {
    const raw = await env.WEBHOOK_KV.get(key.name, { type: 'json' });
    if (!raw) continue;

    const extra = raw._extra || {};
    delete raw._extra;

    merged = merged ? mergePayloads(merged, raw) : raw;

    for (const k of Object.keys(collectedExtra)) {
      if (extra[k] && !collectedExtra[k]) collectedExtra[k] = extra[k];
    }
  }

  if (!merged) return false;

  await env.WEBHOOK_KV.put(`done:${email}`, 'true', { expirationTtl: 300 });

  const replyText = collectedExtra._reply_text;

  const classification = await classifyReplyAI(replyText, env.ANTHROPIC_API_KEY);
  console.log(`Classification for ${email}: ${classification.category} (${classification.confidence})`);

  const meta = {
    reply_text: replyText ? replyText.slice(0, 500) : '',
    campaign_name: collectedExtra._campaign_name,
    phone: collectedExtra._phone,
    timestamp: collectedExtra._timestamp,
    classification: classification.category
  };
  merged.client_payload._meta = JSON.stringify(meta);

  async function cleanupSlots() {
    for (const key of keys.keys) {
      await env.WEBHOOK_KV.delete(key.name);
    }
  }

  // Check if lead is in a nurture sequence
  const nurtureRaw = await env.WEBHOOK_KV.get(`nurture:${email}`);
  if (nurtureRaw) {
    const nurtureData = JSON.parse(nurtureRaw);
    if (nurtureData.status === 'active' || nurtureData.status === 'paused') {
      console.log(`Nurture lead replied: ${email} (status=${nurtureData.status}, ${nurtureData.emails_sent || 0}/7 sent)`);
      const leadRaw = await env.WEBHOOK_KV.get(`lead_by_email:${email}`);
      const leadData = leadRaw ? JSON.parse(leadRaw) : null;
      await handleNurtureReply(env, email, replyText, classification, nurtureData, leadData);
      await cleanupSlots();
      return true;
    }
  }

  // OOO: store return date, send Telegram notification, don't reply
  if (classification.category === 'OOO') {
    console.log(`OOO from ${email}, storing return date`);

    let returnDate = classification.return_date || null;
    if (!returnDate) {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      returnDate = d.toISOString().split('T')[0];
    }

    await env.WEBHOOK_KV.put(`ooo:${email}`, JSON.stringify({
      detected_at: new Date().toISOString(),
      return_date: returnDate
    }), { expirationTtl: 604800 });

    await sendTelegramNotification(env, email, replyText, classification);
    await cleanupSlots();
    return true;
  }

  // Quick-reply system: INTERESTED/QUESTION/OBJECTION get fast AI replies
  const quickReplyCategories = ['INTERESTED', 'QUESTION', 'OBJECTION'];
  if (quickReplyCategories.includes(classification.category) && env.ANTHROPIC_API_KEY) {
    const contactName = merged.client_payload.first_name || '';
    const company = merged.client_payload.company || '';
    const website = merged.client_payload.website || '';
    const jobTitle = merged.client_payload.job_title || '';
    const locationRaw = merged.client_payload.location || '';

    const research = await quickResearch(website, company, env.ANTHROPIC_API_KEY);
    const location = locationRaw || research.location || '';

    const autoReply = await generateQuickReply(
      classification.category, replyText, company, contactName,
      env.ANTHROPIC_API_KEY, { research, jobTitle, location }
    );

    if (autoReply && env.INSTANTLY_API_KEY) {
      // All quick replies go through Telegram approval. Nothing auto-sends.
      const replyPreview = replyText ? replyText.slice(0, 300).replace(/\n/g, ' ') : '';
      const contextLine = replyPreview
        ? `${classification.category}: "${replyPreview}"`
        : `${classification.category}: ${classification.summary}`;
      await queueEmail(env, {
        type: 'auto-reply',
        to: email,
        subject: 'Re: Your marketing analysis',
        html: autoReply.replace(/\n/g, '<br>'),
        text: autoReply,
        lead_email: email,
        firm_name: company,
        contact_name: contactName,
        context: contextLine
      });
    } else {
      console.log(`Quick reply failed for ${email} (${classification.category}), sending Telegram notification`);
      await sendTelegramNotification(env, email, replyText, classification);
    }
  } else {
    // NOT_INTERESTED/UNSUBSCRIBE/IRRELEVANT or no API key
    await sendTelegramNotification(env, email, replyText, classification);
  }

  await cleanupSlots();
  return true;
}

export async function handleInstantlyWebhook(env, payload, ctx) {
  const email = payload.lead_email || payload.email || 'unknown';
  const githubPayload = buildGithubPayload(payload);

  const extraFields = {
    _reply_text: dig(payload, 'reply_text', 'reply', 'message', 'body', 'text_body', 'email_body') || '',
    _campaign_name: dig(payload, 'campaign_name', 'campaignName', 'campaign', 'Campaign') || '',
    _phone: dig(payload, 'phone', 'Phone', 'phone_number', 'lead_phone') || '',
    _timestamp: payload.timestamp || payload.created_at || new Date().toISOString()
  };

  console.log(`Instantly webhook for ${email}: website=${githubPayload.client_payload.website || 'none'}, company=${githubPayload.client_payload.company || 'none'}`);

  const dispatched = await env.WEBHOOK_KV.get(`done:${email}`);
  if (dispatched) {
    console.log(`Already dispatched for ${email}, ignoring`);
    return { success: true, message: 'Already dispatched' };
  }

  const slotData = { ...githubPayload, _extra: extraFields };
  const slot = crypto.randomUUID().slice(0, 8);
  await env.WEBHOOK_KV.put(`wh:${email}|${slot}`, JSON.stringify(slotData), { expirationTtl: 120 });
  console.log(`Stored webhook for ${email} in slot ${slot}`);

  const didDispatch = await listMergeDispatch(env, email, 2);
  if (didDispatch) {
    return { success: true, message: 'Merged and dispatched immediately' };
  }

  ctx.waitUntil(
    new Promise(resolve => setTimeout(resolve, 20_000)).then(async () => {
      try {
        const alreadyDone = await env.WEBHOOK_KV.get(`done:${email}`);
        if (alreadyDone) {
          console.log(`Fallback timer: ${email} already dispatched`);
          return;
        }

        console.log(`Fallback timer: dispatching whatever we have for ${email}`);
        await listMergeDispatch(env, email, 1);
      } catch (e) {
        console.error(`Fallback timer error for ${email}:`, e.message);
      }
    })
  );

  return { success: true, message: 'Stored, waiting for second webhook' };
}

// Legacy sync classifier — kept as bridge
export function classifyReply(replyText) {
  const result = classifyReplyFallback(replyText || '');
  if (['NOT_INTERESTED', 'UNSUBSCRIBE'].includes(result.category)) return 'negative';
  return 'positive';
}
