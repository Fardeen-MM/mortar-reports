/**
 * Lead metadata storage in KV.
 */

import { normalizeLinkedInUrl } from '../channels/prosp.js';

export async function handleStoreLead(env, body) {
  const { email, firm_name, contact_name, report_url, practice_label, country, firm_folder, linkedin_url } = body;
  if (!firm_folder) return { ok: false, error: 'missing firm_folder' };

  const data = { email, firm_name, contact_name, report_url, practice_label, country, linkedin_url, stored_at: new Date().toISOString() };
  await env.WEBHOOK_KV.put(`lead:${firm_folder}`, JSON.stringify(data), { expirationTtl: 2592000 });

  if (email) {
    await env.WEBHOOK_KV.put(`lead_by_email:${email}`, JSON.stringify(data), { expirationTtl: 2592000 });
  }

  if (linkedin_url) {
    const normalizedLi = normalizeLinkedInUrl(linkedin_url);
    if (normalizedLi) {
      await env.WEBHOOK_KV.put(`lead_by_linkedin:${normalizedLi}`, JSON.stringify(data), { expirationTtl: 2592000 });
    }
  }

  console.log(`Stored lead metadata for ${firm_folder} (${email || linkedin_url || 'unknown'})`);
  return { ok: true };
}
