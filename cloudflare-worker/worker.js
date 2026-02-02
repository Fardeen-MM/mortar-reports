/**
 * Cloudflare Worker: Instantly Webhook to GitHub Proxy
 * 
 * Receives webhooks from Instantly, transforms them to GitHub's format, 
 * and forwards to GitHub Actions
 */

const GITHUB_REPO = 'Fardeen-MM/mortar-reports';

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
