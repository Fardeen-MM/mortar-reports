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
      model: 'claude-3-5-haiku-20241022',
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
 * COMPETITOR SEARCH - Uses Google Places API for REAL competitor data
 *
 * Searches Google Maps for law firms matching the practice area and location.
 * Returns real firms with real ratings and review counts.
 */
async function findCompetitors(firmName, city, state, practiceAreas, country) {
  console.log(`   🔍 Finding real competitors via Google Places API...`);
  console.log(`   📍 Location: ${city}, ${state} (${country || 'US'})`);
  console.log(`   ⚖️  Practice: ${practiceAreas.slice(0, 3).join(', ')}`);

  const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyA2ZN122gLi2zNGI5dckM88BMyP8Ni4obc';

  // Map country code to region bias for Google Places API
  const region = (country || 'US').toLowerCase();

  // Country name for query text (belt-and-suspenders with region param)
  const COUNTRY_NAMES = { gb: 'United Kingdom', uk: 'United Kingdom', au: 'Australia', ca: 'Canada', nz: 'New Zealand' };
  const countryName = COUNTRY_NAMES[region] || '';

  // Build search query - use first practice area for specificity
  const practiceArea = practiceAreas[0] || 'lawyer';
  const location = state ? `${city}, ${state}` : city;

  // Disambiguation map for practice areas that Google confuses
  const disambiguationMap = {
    'estate': 'wills trusts probate',
    'estate planning': 'wills trusts',
    'real estate': 'property transaction closing',
    'family': 'divorce custody child support',
    'criminal': 'defense DUI felony'
  };
  const practiceAreaLower = practiceArea.toLowerCase();
  const modifier = disambiguationMap[practiceAreaLower] || '';
  let query = modifier
    ? `${practiceArea} ${modifier} lawyer ${location}`
    : `${practiceArea} lawyer ${location}`;

  // Append country name for non-US countries to disambiguate (e.g. Malmesbury UK vs South Africa)
  if (countryName) {
    query += ` ${countryName}`;
  }

  try {
    const results = await searchGooglePlaces(query, GOOGLE_PLACES_API_KEY, region);

    if (results.status !== 'OK' || !results.results || results.results.length === 0) {
      console.log(`   ⚠️  Google Places returned: ${results.status}`);
      if (results.error_message) {
        console.log(`   ⚠️  Error: ${results.error_message}`);
      }
      return [];
    }

    // Filter out the target firm and wrong-category results, then get top 3 competitors
    const competitors = results.results
      .filter(place => {
        // Exclude the target firm itself (normalize punctuation for reliable matching)
        const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
        const placeNorm = norm(place.name);
        const targetNorm = norm(firmName);
        if (placeNorm.includes(targetNorm) || targetNorm.includes(placeNorm)) {
          return false;
        }

        // Estate planning should NOT include real estate firms
        if (practiceAreaLower.includes('estate planning') || practiceAreaLower === 'estate') {
          if (placeName.includes('real estate') || placeName.includes('realty') ||
              placeName.includes('property law') || placeName.includes('property attorney')) {
            return false;
          }
        }

        // Real estate should NOT include estate planning/probate firms
        if (practiceAreaLower.includes('real estate')) {
          if (placeName.includes('probate') || placeName.includes('trust') ||
              placeName.includes('wills') || placeName.includes('estate planning')) {
            return false;
          }
        }

        return true;
      })
      .slice(0, 3)
      .map(place => ({
        name: place.name,
        city: city,
        state: state,
        rating: place.rating || 0,
        reviewCount: place.user_ratings_total || 0,
        reviews: place.user_ratings_total || 0,
        address: place.formatted_address || '',
        // We don't know their ad status from Places API - leave as unknown
        hasGoogleAds: null,
        hasMetaAds: null,
        hasVoiceAI: null,
        source: 'google_places'
      }));

    console.log(`   ✅ Found ${competitors.length} real competitors:`);
    competitors.forEach((comp, i) => {
      console.log(`      ${i + 1}. ${comp.name} (${comp.rating}★, ${comp.reviewCount} reviews)`);
    });

    return competitors;

  } catch (error) {
    console.log(`   ❌ Google Places API error: ${error.message}`);
    return [];
  }
}

/**
 * Fetch the firm's own Google Business data (reviews, rating)
 * Searches Google Places for the firm name + location to find their profile
 */
async function fetchFirmGoogleData(firmName, city, state, country) {
  if (!firmName || !city) {
    return { reviews: 0, rating: 0 };
  }

  console.log(`   🔍 Fetching Google Business data for "${firmName}"...`);

  const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyA2ZN122gLi2zNGI5dckM88BMyP8Ni4obc';
  const region = (country || 'US').toLowerCase();
  const location = state ? `${city}, ${state}` : city;
  const query = `${firmName} ${location}`;

  try {
    const results = await searchGooglePlaces(query, GOOGLE_PLACES_API_KEY, region);

    if (results.status !== 'OK' || !results.results || results.results.length === 0) {
      console.log(`   ⚠️  Could not find Google Business for "${firmName}"`);
      return { reviews: 0, rating: 0 };
    }

    // Find ALL matching locations for this firm and aggregate reviews
    // Normalize: strip punctuation so "Moffa, Sutton & Donnini PA" matches "Law Offices of Moffa, Sutton, & Donnini, P.A."
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const firmNorm = norm(firmName);
    const matches = results.results.filter(place => {
      const placeNorm = norm(place.name);
      return placeNorm.includes(firmNorm) || firmNorm.includes(placeNorm);
    });

    // Fall back to first result if no name match
    if (matches.length === 0) matches.push(results.results[0]);

    // Aggregate: sum reviews across locations, use highest rating
    let totalReviews = 0;
    let bestRating = 0;
    let bestName = matches[0].name;
    let bestAddress = matches[0].formatted_address || '';
    for (const m of matches) {
      const r = m.user_ratings_total || 0;
      totalReviews += r;
      if ((m.rating || 0) > bestRating) {
        bestRating = m.rating || 0;
        if (r > 0) { bestName = m.name; bestAddress = m.formatted_address || ''; }
      }
      console.log(`   📍 "${m.name}" - ${m.rating || 0}★, ${r} reviews`);
    }

    console.log(`   ✅ Total: ${bestRating}★, ${totalReviews} reviews across ${matches.length} location(s)`);

    return {
      reviews: totalReviews,
      rating: bestRating,
      name: bestName,
      address: bestAddress
    };

  } catch (error) {
    console.log(`   ⚠️  Error fetching firm data: ${error.message}`);
    return { reviews: 0, rating: 0 };
  }
}

/**
 * Search Google Places API
 */
function searchGooglePlaces(query, apiKey, region) {
  return new Promise((resolve, reject) => {
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    if (region) {
      url += `&region=${region}`;
    }

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse Places API response: ${e.message}`));
        }
      });
    }).on('error', (e) => {
      reject(new Error(`Places API request failed: ${e.message}`));
    });
  });
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

/**
 * Check if a competitor is running Google Ads
 * Uses Google Ads Transparency Center (best-effort, may not always work)
 */
async function checkGoogleAds(companyName) {
  // Google Ads Transparency Center doesn't have a public API
  // This is a placeholder that returns null (unknown)
  // In production, you'd need to either:
  // 1. Use a third-party service like SpyFu, SEMrush API
  // 2. Manually check during research phase
  // 3. Use Playwright to scrape (complex, rate-limited)
  return { detected: null, adCount: null };
}

/**
 * Check if a competitor is running Meta Ads
 * Uses Meta Ad Library API
 */
async function checkMetaAds(companyName) {
  // Meta Ad Library doesn't have a public API for programmatic access
  // Would need to use their official Ad Library API (requires approval)
  // or scrape with Playwright (against ToS)
  return { detected: null, activeCount: null };
}

/**
 * Enrich competitors with ad research data
 * Best-effort: returns null for unknown values rather than false
 */
async function enrichCompetitorWithAds(competitor) {
  // For now, return the competitor with null ad status
  // This preserves the "unknown" state vs "definitely no ads"
  return {
    ...competitor,
    googleAds: { detected: null, adCount: null },
    metaAds: { detected: null, activeCount: null }
  };
}

/**
 * Generate practice-area-specific search terms
 * Returns 5 terms tailored to the practice area and location
 */
function getSearchTerms(practiceArea, city, state, country) {
  country = (country || 'US').toUpperCase();
  const isUK = (country === 'GB' || country === 'UK');
  const location = isUK ? city : (city && state ? `${city} ${state}` : city || state || '');

  const terms = {
    'landlord': [
      'eviction lawyer near me',
      `landlord attorney ${location}`,
      `how to evict a tenant ${isUK ? '' : state}`,
      'landlord tenant lawyer',
      'property owner legal help'
    ],
    'personal injury': [
      'car accident lawyer near me',
      `personal injury attorney ${location}`,
      'injury lawyer free consultation',
      'how much is my case worth',
      'accident lawyer near me'
    ],
    'divorce': [
      'divorce lawyer near me',
      `divorce attorney ${location}`,
      'how much does divorce cost',
      'child custody lawyer',
      'family law attorney near me'
    ],
    'family': [
      'family lawyer near me',
      `family law attorney ${location}`,
      'child custody lawyer',
      'adoption attorney near me',
      'guardianship lawyer'
    ],
    'immigration': [
      'immigration lawyer near me',
      `immigration attorney ${location}`,
      'green card lawyer',
      'visa attorney near me',
      'citizenship lawyer'
    ],
    'criminal': [
      'criminal lawyer near me',
      `criminal defense attorney ${location}`,
      'dui lawyer near me',
      'drug charge attorney',
      'felony lawyer'
    ],
    'tax': [
      'tax attorney near me',
      `irs lawyer ${location}`,
      'tax debt relief attorney',
      'irs audit lawyer',
      'tax settlement attorney'
    ],
    'estate': [
      'estate planning attorney near me',
      `wills and trusts lawyer ${location}`,
      'probate attorney',
      'living trust lawyer',
      'estate lawyer near me'
    ],
    'employment': [
      'employment lawyer near me',
      `wrongful termination attorney ${location}`,
      'discrimination lawyer',
      'harassment attorney',
      'wage theft lawyer'
    ],
    'business': [
      'business attorney near me',
      `corporate lawyer ${location}`,
      `contract attorney ${location}`,
      'business formation lawyer',
      'commercial litigation attorney'
    ],
    'real estate': [
      'real estate lawyer near me',
      `property attorney ${location}`,
      'closing attorney',
      'title lawyer',
      'real estate transaction attorney'
    ],
    'default': [
      'lawyer near me',
      `attorney ${location}`,
      'legal help near me',
      'law firm near me',
      'free legal consultation'
    ]
  };

  const practiceKey = Object.keys(terms).find(key =>
    practiceArea.toLowerCase().includes(key)
  ) || 'default';

  let result = terms[practiceKey].map(term =>
    term.replace(/undefined/g, '').replace(/\s+/g, ' ').trim()
  );

  // UK localization: attorney→solicitor, lawyer→solicitor, IRS→HMRC, child custody→child arrangements
  if (isUK) {
    result = result.map(term =>
      term
        .replace(/\battorney\b/gi, 'solicitor')
        .replace(/\blawyer\b/gi, 'solicitor')
        .replace(/\bIRS\b/g, 'HMRC')
        .replace(/\birs\b/g, 'hmrc')
        .replace(/\bchild custody\b/gi, 'child arrangements')
        .replace(/\bgreen card\b/gi, 'visa')
    );
  }

  return result;
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
  findCompetitors,
  fetchFirmGoogleData,
  checkGoogleAds,
  checkMetaAds,
  enrichCompetitorWithAds,
  getSearchTerms
};
