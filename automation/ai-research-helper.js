#!/usr/bin/env node
/**
 * AI RESEARCH HELPER - Smart Extraction Using Claude
 * 
 * Instead of rigid regex patterns, use AI to intelligently extract data
 * from ANY page structure. AI can understand context and find information
 * even when it's not in expected formats.
 */

require('dotenv').config();
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
      model: 'claude-3-haiku-20240307',
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
            const errorMsg = result.error.message || JSON.stringify(result.error);
            reject(new Error(`Anthropic API error: ${errorMsg}`));
          } else {
            reject(new Error(`Unexpected AI response: ${data.substring(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse AI response: ${e.message} | Data: ${data.substring(0, 200)}`));
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
 * Find individual attorney profile URLs from a team page
 */
async function findAttorneyProfiles(html, baseUrl) {
  const prompt = `Analyze this law firm team/attorneys page and find ALL individual attorney profile links.

Look for:
- Links to individual attorney bio pages
- Attorney names that are clickable
- URLs like /attorneys/john-smith or /team/jane-doe
- Profile links in the navigation or body

Return ONLY valid JSON with an array of URLs:
{
  "profileUrls": [
    "https://www.firm.com/attorneys/john-smith",
    "https://www.firm.com/team/jane-doe"
  ]
}

If no profile links found, return: {"profileUrls": []}`;

  try {
    const response = await askAI(prompt, html, 1000);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (data.profileUrls && Array.isArray(data.profileUrls)) {
        // Convert relative URLs to absolute
        return data.profileUrls.map(url => {
          try {
            return new URL(url, baseUrl).href;
          } catch {
            return null;
          }
        }).filter(Boolean);
      }
    }
    return [];
  } catch (e) {
    console.log(`   ⚠️  AI profile discovery failed: ${e.message}`);
    return [];
  }
}

/**
 * Extract attorneys from ANY page using AI
 */
async function extractAttorneys(html, firmName) {
  // Try AI first if available
  if (ANTHROPIC_API_KEY) {
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
    } catch (e) {
      console.log(`   ⚠️  AI attorney extraction failed:`, e.message || e);
    }
  }
  
  // NO FALLBACK - AI only or fail
  console.log(`   ❌ AI extraction required but ANTHROPIC_API_KEY not set`);
  return [];
}

/**
 * Extract location from ANY page using AI
 */
async function extractLocation(html, firmName) {
  const prompt = `You are extracting location information from a law firm website.

**CRITICAL:** This law firm MUST have a physical location. Look EVERYWHERE on this page:
- Header (top right often has city/state)
- Footer (usually has full address)
- Contact section
- "Visit Us" or "Locations" sections
- Copyright text (often includes city)
- Phone numbers area codes (can hint at location)
- ANY text that mentions a city or state

For each location found, extract:
- Street address (if visible)
- City (REQUIRED - look harder!)
- State/Province (REQUIRED - 2-letter abbreviation if US)
- ZIP/Postal code
- Country (default to "US" if not specified but appears to be USA)
- Phone number

**If you see ANY city or state name ANYWHERE on the page, include it.**

Return ONLY valid JSON:
{
  "locations": [
    {
      "address": "123 Main St",
      "city": "Phoenix",
      "state": "AZ",
      "zip": "85001",
      "country": "US",
      "phone": "602-555-1234"
    }
  ]
}

If you genuinely cannot find ANY city or state after checking the entire page, return: {"locations": []}`;

  try {
    const response = await askAI(prompt, html, 1500);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      const locations = data.locations || [];
      
      // Validate each location has at minimum city OR state
      const validLocations = locations.filter(loc => loc.city || loc.state);
      
      if (validLocations.length === 0) {
        console.log(`   ⚠️  AI found ${locations.length} location(s) but none had city/state`);
      }
      
      return validLocations;
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

/**
 * AI FIRM ANALYSIS - High-level intelligence for outreach
 */
async function analyzeFirm(homeHtml, aboutHtml, firmName) {
  const combinedHtml = `${homeHtml}\n\n<!-- ABOUT PAGE -->\n${aboutHtml || ''}`;
  
  const prompt = `Analyze this law firm's website and extract comprehensive intelligence for personalized outreach.

**CRITICAL REQUIREMENTS:**
1. Extract EVERYTHING explicitly stated on the website
2. Look at headers, footers, about sections, contact info
3. Check schema.org markup, copyright text, address blocks
4. DO NOT invent information, but be thorough in finding what EXISTS

Extract:
1. **Primary Location**: Look EVERYWHERE for the main office city/state (header, footer, contact, copyright)
2. **Positioning**: What makes this firm unique? Their value proposition
3. **Key specialties**: Top 3-7 practice areas they emphasize
4. **Firm size**: "boutique (5-15)", "mid-size (15-50)", "large (50+)" based on attorney count or firm description
5. **Recent news**: Announcements, wins, hires, expansions (with dates)
6. **Credentials**: Awards, rankings, certifications (Super Lawyers, AV Rated, Best Lawyers, etc.)
7. **Growth signals**: Hiring, new offices, practice areas, major wins

Return ONLY valid JSON:
{
  "primaryLocation": {
    "city": "Phoenix",
    "state": "AZ"
  },
  "positioning": "Brief description from their About page or homepage",
  "keySpecialties": ["Practice 1", "Practice 2", "Practice 3"],
  "firmSize": {
    "estimate": "mid-size (15-50)",
    "attorneys": 25
  },
  "recentNews": ["News item 1", "News item 2"],
  "credentials": ["Super Lawyers", "AV Rated"],
  "growthSignals": ["Hired 3 new partners", "Opened Dallas office"]
}

If you cannot find primaryLocation, leave it as {"city": "", "state": ""}`;

  try {
    const response = await askAI(prompt, combinedHtml, 2000);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (e) {
    console.log(`   ⚠️  AI firm analysis failed:`, e.message);
    return null;
  }
}

/**
 * Quick attorney sample - get count + 2-3 names for personalization
 */
async function quickAttorneySample(teamHtml, sampleSize = 3) {
  const prompt = `Analyze this law firm team page.

Extract:
1. TOTAL number of attorneys listed
2. First ${sampleSize} attorney names and titles

Return ONLY valid JSON:
{
  "totalCount": 23,
  "sample": [
    {"name": "Mitchell N. Roth", "title": "Managing Partner"},
    {"name": "Joseph F. Jackson", "title": "Partner"},
    {"name": "Ashley Brooks", "title": "Associate"}
  ]
}`;

  try {
    const response = await askAI(prompt, teamHtml, 1000);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      // Add totalCount to each attorney for easy access
      if (data.sample && data.totalCount) {
        data.sample.forEach(a => a.totalCount = data.totalCount);
      }
      return data.sample || [];
    }
    return [];
  } catch (e) {
    console.log(`   ⚠️  AI attorney sample failed:`, e.message);
    return [];
  }
}

/**
 * COMPETITOR SEARCH - Returns empty array (no fabrication)
 *
 * IMPORTANT: This function previously generated fake competitor names using AI
 * or random surname pairs. That approach is dishonest - any lawyer who Googles
 * a competitor from the report and finds nothing loses all trust instantly.
 *
 * TO IMPLEMENT REAL COMPETITOR DATA:
 * Option 1: Google Maps Places API - search for "{practice area} lawyer near {city, state}"
 *           Returns real firms with real ratings and review counts. ~$0.03/request.
 * Option 2: SERP API (SerpAPI, Bright Data, etc.) - scrape actual Google results
 * Option 3: Manual curation - maintain a database of verified competitors by market
 *
 * Until one of these is implemented, this returns an empty array and the report
 * generator handles the "no competitor data" case gracefully.
 */
async function findCompetitors(firmName, city, state, practiceAreas) {
  console.log(`   🔍 Competitor search: ${city}, ${state} | ${practiceAreas.join(', ')}`);
  console.log(`   ℹ️  Real competitor lookup requires Google Maps API or SERP API`);
  console.log(`   ℹ️  Returning empty array - report will show market opportunity messaging`);

  // Return empty array - no fabricated data
  // The report generator will handle this gracefully with "limited competitor data" messaging
  return [];
}

/**
 * DEPRECATED - NO LONGER USED
 * Fallback function removed to prevent fake competitor names.
 * AI must return real firms or empty array.
 */
// function generateFallbackCompetitors() {
//   // This function is intentionally disabled
//   // We never use fake/placeholder competitor names
//   return [];
// }

/**
 * AI-powered location inference from firm name, website domain, or any context
 * Use as LAST RESORT when location extraction completely fails
 */
async function inferLocation(firmName, website, contextHtml = null) {
  if (!ANTHROPIC_API_KEY) {
    console.log(`   ❌ Cannot infer location - ANTHROPIC_API_KEY not set`);
    return null;
  }

  const prompt = `You are a location inference AI. Based on the law firm name, website domain, and any available context, infer the MOST LIKELY primary location of this law firm.

Firm Name: ${firmName}
Website: ${website}

Look for clues:
- City/state names IN the firm name (e.g., "Boston Legal" → Boston, MA)
- Common location patterns (e.g., "McLean" is in Virginia)
- Domain patterns (e.g., .la domains are often Louisiana)
- Regional terms (e.g., "Bay Area" → San Francisco, CA)
- State abbreviations in name

${contextHtml ? 'Additional context from website (if extraction failed, this might be partial):' : 'No additional context available.'}

Return ONLY valid JSON (no markdown, no explanations):
{
  "city": "Boston",
  "state": "MA",
  "confidence": 7,
  "reasoning": "Firm name contains 'Boston', common legal market"
}

If you CANNOT make a confident inference (confidence < 5), return:
{"city": null, "state": null, "confidence": 0, "reasoning": "Insufficient data"}`;

  try {
    const response = await askAI(
      prompt, 
      contextHtml ? contextHtml.substring(0, 50000) : '', 
      500
    );
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      
      if (data.city && data.state && data.confidence >= 5) {
        console.log(`   🧠 AI inferred location: ${data.city}, ${data.state} (confidence: ${data.confidence}/10)`);
        console.log(`      Reasoning: ${data.reasoning}`);
        return {
          city: data.city,
          state: data.state,
          country: 'US',
          inferredByAI: true,
          confidence: data.confidence,
          reasoning: data.reasoning
        };
      }
    }
    
    console.log(`   ⚠️  AI location inference returned low confidence or no result`);
    return null;
  } catch (e) {
    console.log(`   ⚠️  AI location inference failed: ${e.message}`);
    return null;
  }
}

module.exports = {
  analyzeFirm,
  quickAttorneySample,
  findAttorneyProfiles,
  extractAttorneys,
  extractLocation,
  inferLocation,
  extractCredentials,
  findTeamPage,
  analyzePage,
  findCompetitors
};
