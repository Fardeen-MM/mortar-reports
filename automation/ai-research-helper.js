#!/usr/bin/env node
/**
 * AI RESEARCH HELPER - Smart Extraction Using Claude
 * 
 * Instead of rigid regex patterns, use AI to intelligently extract data
 * from ANY page structure. AI can understand context and find information
 * even when it's not in expected formats.
 */

const https = require('https');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('⚠️  ANTHROPIC_API_KEY not set - AI extraction will be skipped');
  console.error('   Set it with: export ANTHROPIC_API_KEY=your-key-here');
}

/**
 * Ask AI to extract structured data from HTML
 */
async function askAI(prompt, html, maxTokens = 2000) {
  // Truncate HTML to first 150KB to avoid token limits
  const truncatedHtml = html.substring(0, 150000);
  
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `${prompt}\n\n<html>\n${truncatedHtml}\n</html>`
      }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestData)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.content && result.content[0] && result.content[0].text) {
            resolve(result.content[0].text);
          } else if (result.error) {
            reject(new Error(result.error.message || 'AI API error'));
          } else {
            reject(new Error('Unexpected AI response format'));
          }
        } catch (e) {
          reject(new Error(`Failed to parse AI response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('AI request timeout'));
    });

    req.write(requestData);
    req.end();
  });
}

/**
 * Extract attorneys from ANY page using AI
 */
async function extractAttorneys(html, firmName) {
  const prompt = `Analyze this law firm website page and extract ALL attorneys/lawyers.

For each attorney, extract:
- Full name
- Title/position (Partner, Associate, Of Counsel, etc.)
- Practice areas/specializations
- Education (law school, undergrad)
- Bar admissions
- Years of experience or year admitted to bar
- Any notable achievements or credentials

Return ONLY valid JSON (no markdown, no explanations):
{
  "attorneys": [
    {
      "name": "John Smith",
      "title": "Managing Partner",
      "specializations": ["TCPA Defense", "Class Action"],
      "education": ["Harvard Law School JD", "Yale BA"],
      "barAdmissions": ["Virginia", "DC"],
      "experience": "20+ years",
      "credentials": ["Super Lawyers", "AV Rated"]
    }
  ]
}

If no attorneys found, return: {"attorneys": []}`;

  try {
    const response = await askAI(prompt, html, 2000);
    
    // Try to extract JSON from response (might have extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return data.attorneys || [];
    }
    
    return [];
  } catch (e) {
    console.log(`   ⚠️  AI attorney extraction failed: ${e.message}`);
    return [];
  }
}

/**
 * Extract location from ANY page using AI
 */
async function extractLocation(html, firmName) {
  const prompt = `Analyze this law firm website page and extract ALL physical office locations.

For each location, extract:
- Street address
- City
- State/Province
- ZIP/Postal code
- Country
- Phone number (if present)

Return ONLY valid JSON:
{
  "locations": [
    {
      "address": "8200 Greensboro Dr Suite 820",
      "city": "McLean",
      "state": "VA",
      "zip": "22102",
      "country": "US",
      "phone": "703-555-1234"
    }
  ]
}

If no locations found, return: {"locations": []}`;

  try {
    const response = await askAI(prompt, html, 1500);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return data.locations || [];
    }
    return [];
  } catch (e) {
    console.log(`   ⚠️  AI location extraction failed: ${e.message}`);
    return [];
  }
}

/**
 * Extract awards and credentials from About page using AI
 */
async function extractCredentials(html, firmName) {
  const prompt = `Analyze this law firm About page and extract:

1. Awards & recognitions (Super Lawyers, Best Lawyers, etc.)
2. Firm credentials (AV Rated, BBB, certifications)
3. Notable achievements or milestones
4. Years in business / founding date
5. Team size (number of attorneys)

Return ONLY valid JSON:
{
  "awards": ["Super Lawyers 2023", "Best Lawyers in America"],
  "credentials": ["AV Rated by Martindale-Hubbell"],
  "achievements": ["Defended over $1B in TCPA claims"],
  "founded": 2005,
  "teamSize": 8
}`;

  try {
    const response = await askAI(prompt, html, 1500);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (e) {
    console.log(`   ⚠️  AI credentials extraction failed: ${e.message}`);
    return null;
  }
}

/**
 * Find team page URL using AI navigation analysis
 */
async function findTeamPage(html, baseUrl) {
  const prompt = `Analyze this website's HTML and find the URL for the team/attorneys page.

Look for navigation links, footer links, or any links that lead to:
- Team members / attorneys / lawyers
- About our team / Meet the team
- Our professionals / Our people

Return ONLY valid JSON:
{
  "teamPageUrl": "/about/our-team",
  "confidence": 9
}

Or if not found:
{
  "teamPageUrl": null,
  "confidence": 0
}`;

  try {
    const response = await askAI(prompt, html, 500);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (data.teamPageUrl && data.confidence >= 5) {
        // Make absolute URL
        const url = new URL(data.teamPageUrl, baseUrl);
        return url.href;
      }
    }
    return null;
  } catch (e) {
    console.log(`   ⚠️  AI team page discovery failed: ${e.message}`);
    return null;
  }
}

/**
 * Analyze page and determine what type of content it has
 */
async function analyzePage(html, url) {
  const prompt = `Analyze this webpage and identify what type of content it contains.

Check for:
- Attorney/lawyer profiles (names, bios, photos)
- Office locations/addresses
- Practice areas/services
- Awards/credentials
- Testimonials/reviews
- About the firm information

Return ONLY valid JSON:
{
  "hasAttorneys": true/false,
  "hasLocations": true/false,
  "hasPracticeAreas": true/false,
  "hasCredentials": true/false,
  "pageType": "team|about|contact|services|home|other",
  "confidence": 8
}`;

  try {
    const response = await askAI(prompt, html, 500);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { hasAttorneys: false, hasLocations: false, pageType: 'unknown', confidence: 0 };
  } catch (e) {
    console.log(`   ⚠️  AI page analysis failed: ${e.message}`);
    return { hasAttorneys: false, hasLocations: false, pageType: 'unknown', confidence: 0 };
  }
}

module.exports = {
  extractAttorneys,
  extractLocation,
  extractCredentials,
  findTeamPage,
  analyzePage
};
