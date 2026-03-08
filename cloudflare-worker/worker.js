/**
 * Cloudflare Worker: Request Router
 *
 * Handles:
 * 1. Instantly webhooks → AI classify + quick-reply
 * 2. Telegram callbacks → approval workflow
 * 3. Telegram /build commands → report pipeline
 * 4. POST /view → report view tracking
 * 5. POST /store-lead → lead metadata storage
 * 6. POST /queue-email → email approval queue
 * 7. POST /queue-dm → LinkedIn DM approval queue
 * 8. POST /prosp-webhook → LinkedIn DM webhook handling
 * 9. POST /nurture-check → nurture status CRUD
 * 10. POST /ooo-check → OOO pending CRUD
 * 11. POST /telegram-webhook → webhook diagnostics
 *
 * Required secrets: GITHUB_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * Optional secrets: INSTANTLY_API_KEY, ANTHROPIC_API_KEY, PROSP_API_KEY, PROSP_SENDER
 */

import { corsHeaders } from './src/cors.js';
import { sendTelegramMsg } from './src/telegram/api.js';
import { handleTelegramCallback } from './src/telegram/callbacks.js';
import { handleTelegramMessage } from './src/telegram/messages.js';
import { handleInstantlyWebhook } from './src/channels/instantly.js';
import { handleProspWebhook, handleConnectionAccepted } from './src/channels/prosp.js';
import { handleViewTrack } from './src/tracking/views.js';
import { handleStoreLead } from './src/tracking/leads.js';
import { queueEmail } from './src/queues/email-queue.js';
import { queueDM } from './src/queues/dm-queue.js';

// ============ HELPERS ============

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

// ============ KV CRUD ROUTES ============

async function handleNurtureCheck(env, body) {
  const { action, email, data } = body;

  if (action === 'get') {
    const raw = await env.WEBHOOK_KV.get(`nurture:${email}`);
    return { ok: true, data: raw ? JSON.parse(raw) : null };
  } else if (action === 'set') {
    await env.WEBHOOK_KV.put(`nurture:${email}`, JSON.stringify(data), { expirationTtl: 2592000 });
    return { ok: true };
  } else if (action === 'list') {
    const keys = await env.WEBHOOK_KV.list({ prefix: 'nurture:' });
    const items = [];
    for (const key of keys.keys) {
      const raw = await env.WEBHOOK_KV.get(key.name);
      if (raw) items.push({ email: key.name.replace('nurture:', ''), ...JSON.parse(raw) });
    }
    return { ok: true, items };
  }

  return { ok: false, error: 'unknown action' };
}

async function handleOooCheck(env, body) {
  const { action, email, data } = body;

  if (action === 'get') {
    const raw = await env.WEBHOOK_KV.get(`ooo_pending:${email}`);
    return { ok: true, data: raw ? JSON.parse(raw) : null };
  } else if (action === 'set') {
    await env.WEBHOOK_KV.put(`ooo_pending:${email}`, JSON.stringify(data), { expirationTtl: 2592000 });
    return { ok: true };
  } else if (action === 'delete') {
    await env.WEBHOOK_KV.delete(`ooo_pending:${email}`);
    return { ok: true };
  } else if (action === 'list') {
    const keys = await env.WEBHOOK_KV.list({ prefix: 'ooo_pending:' });
    const items = [];
    for (const key of keys.keys) {
      const raw = await env.WEBHOOK_KV.get(key.name);
      if (raw) items.push({ email: key.name.replace('ooo_pending:', ''), ...JSON.parse(raw) });
    }
    return { ok: true, items };
  }

  return { ok: false, error: 'unknown action' };
}

async function handleTelegramWebhookDiag(env, body) {
  const { action } = body;

  if (action === 'info') {
    const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    return await resp.json();
  } else if (action === 'set') {
    const webhookUrl = body.url || `https://instantly-webhook-proxy.fardeen-729.workers.dev/`;
    const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });
    return await resp.json();
  }

  return { usage: 'POST with {"action":"info"} or {"action":"set"}' };
}

// ============ PROSP WEBHOOK ROUTING ============

async function routeProspWebhook(env, body, ctx) {
  // Store raw payload for debugging (keep last 20, expire after 7 days)
  const rawKey = `raw_prosp:${Date.now()}`;
  ctx.waitUntil(env.WEBHOOK_KV.put(rawKey, JSON.stringify(body), { expirationTtl: 604800 }));

  // Normalize event type
  const rawEvent = (body.eventType || body.event_type || body.event || '').toString();
  const eventNorm = rawEvent.toLowerCase().replace(/[\s_-]+/g, '');

  const isMessageReply = ['linkedinmessagereplied', 'hasmsgreplied', 'messagereplied',
    'linkedin_message_replied', 'msg_replied', 'message_replied', 'reply'].some(s => eventNorm.includes(s));

  const isConnectionAccept = ['linkedinconnectionaccepted', 'connectionaccepted',
    'hasconnectionaccepted', 'connection_accepted', 'acceptinvite'].some(s => eventNorm.includes(s));

  if (isMessageReply) {
    return await handleProspWebhook(env, body, ctx);
  } else if (isConnectionAccept) {
    return await handleConnectionAccepted(env, body);
  }

  // Unknown event — alert via Telegram
  console.log(`Prosp webhook: unhandled eventType "${rawEvent}"`, JSON.stringify(body).slice(0, 500));
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const snippet = JSON.stringify(body, null, 2).slice(0, 800).replace(/([_*`\[\]])/g, '');
    ctx.waitUntil(sendTelegramMsg(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID,
      `\u26a0\ufe0f *Unknown Prosp Event*\n\nEvent type: \`${rawEvent || 'MISSING'}\`\n\n\`\`\`\n${snippet}\n\`\`\``));
  }
  return { ok: true, message: 'unknown event type logged' };
}

// ============ MAIN ROUTER ============

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin') || '';
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // GET endpoints
    if (request.method === 'GET') {
      if (url.pathname === '/debug') {
        const keys = await env.WEBHOOK_KV.list({ prefix: 'raw:' });
        const entries = [];
        for (const key of keys.keys.slice(-10)) {
          const val = await env.WEBHOOK_KV.get(key.name);
          entries.push({ key: key.name, payload: val });
        }
        return jsonResponse(entries);
      }

      if (url.pathname === '/prosp-debug') {
        const keys = await env.WEBHOOK_KV.list({ prefix: 'raw_prosp:' });
        const entries = [];
        for (const key of keys.keys.slice(-20)) {
          const val = await env.WEBHOOK_KV.get(key.name);
          try { entries.push({ key: key.name, payload: JSON.parse(val) }); }
          catch { entries.push({ key: key.name, payload: val }); }
        }
        return jsonResponse(entries);
      }

      const customMatch = url.pathname.match(/^\/custom-email\/(.+)$/);
      if (customMatch) {
        const approvalId = decodeURIComponent(customMatch[1]);
        const body = await env.WEBHOOK_KV.get(`custom_email:${approvalId}`);
        if (body) {
          return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
        return new Response('Not found', { status: 404 });
      }

      return new Response('OK', { status: 200 });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // POST routes with dedicated handlers
    const simpleRoutes = {
      '/view': async (body) => {
        const result = await handleViewTrack(env, body);
        const origin = request.headers.get('Origin') || '';
        return jsonResponse(result, 200, corsHeaders(origin));
      },
      '/store-lead': async (body) => jsonResponse(await handleStoreLead(env, body)),
      '/queue-email': async (body) => jsonResponse(await queueEmail(env, body)),
      '/queue-dm': async (body) => jsonResponse(await queueDM(env, body)),
      '/nurture-check': async (body) => jsonResponse(await handleNurtureCheck(env, body)),
      '/ooo-check': async (body) => jsonResponse(await handleOooCheck(env, body)),
    };

    if (simpleRoutes[url.pathname]) {
      try {
        const body = await request.json();
        return await simpleRoutes[url.pathname](body);
      } catch (e) {
        const extraHeaders = url.pathname === '/view'
          ? corsHeaders(request.headers.get('Origin') || '')
          : {};
        return jsonResponse({ ok: false, error: e.message }, 200, extraHeaders);
      }
    }

    if (url.pathname === '/prosp-webhook') {
      try {
        const body = await request.json();
        const result = await routeProspWebhook(env, body, ctx);
        return jsonResponse(result);
      } catch (e) {
        console.error('Prosp webhook error:', e);
        return jsonResponse({ ok: false, error: e.message });
      }
    }

    if (url.pathname === '/telegram-webhook') {
      try {
        const body = await request.json().catch(() => ({}));
        const result = await handleTelegramWebhookDiag(env, body);
        return jsonResponse(result);
      } catch (e) {
        return jsonResponse({ ok: false, error: e.message });
      }
    }

    // Default: Telegram updates + Instantly webhooks (root path)
    try {
      const payload = await request.json();

      // Store raw payload for debugging (expires in 10 min)
      const ts = Date.now();
      const email = payload.lead_email || payload.email || payload?.lead?.email || 'unknown';
      await env.WEBHOOK_KV.put(`raw:${email}:${ts}`, JSON.stringify(payload), { expirationTtl: 600 });

      // Telegram callback (approve/reject buttons)
      if (payload.callback_query) {
        if (!env.TELEGRAM_BOT_TOKEN) {
          return jsonResponse({ error: 'TELEGRAM_BOT_TOKEN not configured' }, 500);
        }
        return jsonResponse(await handleTelegramCallback(env, payload));
      }

      // Telegram message (e.g. /build command)
      if (payload.message?.text) {
        return jsonResponse(await handleTelegramMessage(env, payload));
      }

      // Instantly webhook
      return jsonResponse(await handleInstantlyWebhook(env, payload, ctx));

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ success: false, error: error.message });
    }
  }
};
