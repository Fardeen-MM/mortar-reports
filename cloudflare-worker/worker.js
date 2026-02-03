/**
 * Cloudflare Worker: Instantly Webhook to GitHub Proxy
 * 
 * Receives webhooks from Instantly, transforms them to GitHub's format, 
 * and forwards to GitHub Actions
 * 
 * DEDUPLICATION: Uses in-memory cache to prevent duplicate webhooks within 5 minutes
 */

const GITHUB_REPO = 'Fardeen-MM/mortar-reports';
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache for deduplication (persists across requests in same worker instance)
const recentWebhooks = new Map();

// Clean up old entries periodically
function cleanupOldEntries() {
  const now = Date.now();
  for (const [key, timestamp] of recentWebhooks.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      recentWebhooks.delete(key);
    }
  }
}

export default {
  async fetch(request, env) {
    const GITHUB_TOKEN = env.GITHUB_TOKEN; // Set in Cloudflare Worker environment
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Parse Instantly webhook payload
      const instantlyPayload = await request.json();
      
      console.log('Received webhook from Instantly:', instantlyPayload);

      // Generate deduplication key from lead_email + email_id
      const dedupKey = `${instantlyPayload.lead_email || 'unknown'}_${instantlyPayload.email_id || 'no-id'}`;
      const now = Date.now();
      
      // Check if we've seen this webhook recently
      if (recentWebhooks.has(dedupKey)) {
        const lastSeen = recentWebhooks.get(dedupKey);
        const timeSinceLastSeen = now - lastSeen;
        
        if (timeSinceLastSeen < DEDUP_WINDOW_MS) {
          console.log(`⚠️  DUPLICATE webhook detected: ${dedupKey} (seen ${Math.round(timeSinceLastSeen / 1000)}s ago)`);
          return new Response(JSON.stringify({ 
            success: true, 
            message: 'Duplicate webhook ignored (already processed recently)',
            dedupKey,
            timeSinceLastSeen: Math.round(timeSinceLastSeen / 1000)
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Record this webhook
      recentWebhooks.set(dedupKey, now);
      
      // Clean up old entries (async, don't wait)
      cleanupOldEntries();
      
      console.log(`✅ New webhook: ${dedupKey}`);

      // Transform to GitHub's required format
      const githubPayload = {
        event_type: 'interested_lead', // GitHub expects this exact value
        client_payload: {
          email: instantlyPayload.lead_email || '',
          first_name: instantlyPayload.first_name || '',
          last_name: instantlyPayload.last_name || '',
          website: instantlyPayload.website || '',
          city: instantlyPayload.city || '',
          state: instantlyPayload.state || '',
          country: instantlyPayload.country || '',
          company: instantlyPayload.company || '',
          email_id: instantlyPayload.email_id || '',
          from_email: instantlyPayload.from_email || '',
          reply_text: instantlyPayload.reply_text || ''
        }
      };

      console.log('Transformed payload for GitHub:', githubPayload);

      // Forward to GitHub Actions
      const githubResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Cloudflare-Worker-Instantly-Proxy'
          },
          body: JSON.stringify(githubPayload)
        }
      );

      console.log('GitHub response status:', githubResponse.status);

      if (githubResponse.status === 204) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Webhook forwarded to GitHub Actions' 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        const errorText = await githubResponse.text();
        console.error('GitHub error:', errorText);
        
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'GitHub rejected webhook',
          details: errorText 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
