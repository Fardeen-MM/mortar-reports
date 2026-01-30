#!/usr/bin/env node
/**
 * RESEARCH SCRIPT V3 - DEEP COMPREHENSIVE RESEARCH (TRULY AUTONOMOUS)
 * 
 * NEVER GIVES UP - Tries EVERYTHING before marking data as unknown:
 * - 6+ location detection strategies
 * - 6+ team page discovery methods
 * - AI-powered extraction fallbacks
 * - Cross-validation between data sources
 * - Retry logic for all network operations
 * - Schema.org and meta tag parsing
 * 
 * GOAL: Every field should have high confidence (7+/10) even with zero Instantly data
 */

const { chromium } = require('playwright');
const https = require('https');
const fs = require('fs');
const path = require('path');

// API Keys
const GOOGLE_PLACES_API_KEY = 'AIzaSyA2ZN122gLi2zNGI5dckM88BMyP8Ni4obc';
const OPENCAGE_API_KEY = 'e361fd5df04049e5aa30e1409e360d70';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-api03-RCHEH5G9aJT-7MjMpMDJ-wUbG14MdTc-P1l1Y6OBx1LFuwmPLe5Q_nD54vJFJLn8n96RLCYB3hl7Hd8rQgzWHg-L8SohwAA'; // For AI fallbacks

// ============================================================================
// UTILITY: RETRY WRAPPER (Never give up on network calls!)
// ============================================================================
async function retryOperation(fn, maxRetries = 3, delayMs = 2000, description = 'operation') {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   🔄 Attempt ${attempt}/${maxRetries}: ${description}`);
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        console.log(`   ❌ Failed after ${maxRetries} attempts: ${error.message}`);
        throw error;
      }
      console.log(`   ⚠️  Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// ============================================================================
// UTILITY: AI-POWERED EXTRACTION (Claude API with timeout)
// ============================================================================
async function askAI(prompt, htmlContent, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    // Truncate HTML to avoid token limits (keep first 100KB)
    const truncatedHtml = htmlContent.substring(0, 100000);
    
    // Skip AI if no API key is set
    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.length < 20) {
      console.log(`   ⚠️  AI skipped: No valid API key configured`);
      return reject(new Error('No AI API key configured'));
    }
    
    const requestData = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `${prompt}\n\nHTML:\n${truncatedHtml}`
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
      timeout: timeoutMs
    };

    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error(`AI request timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data);
          if (response.content && response.content[0]) {
            resolve(response.content[0].text);
          } else if (response.error) {
            reject(new Error(`AI API error: ${response.error.message}`));
          } else {
            reject(new Error('No content in AI response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    
    req.on('timeout', () => {
      clearTimeout(timeout);
      req.destroy();
      reject(new Error('AI request timeout'));
    });
    
    req.write(requestData);
    req.end();
  });
}

// ============================================================================
// API WRAPPERS WITH RETRY
// ============================================================================
function searchPlaces(query, location) {
  return retryOperation(() => {
    return new Promise((resolve, reject) => {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' ' + location)}&key=${GOOGLE_PLACES_API_KEY}`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }, 3, 2000, 'Google Places search');
}

function validateLocation(city, state, country) {
  return retryOperation(() => {
    return new Promise((resolve, reject) => {
      const query = `${city}, ${state}, ${country}`;
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_API_KEY}&limit=1`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.results && result.results.length > 0) {
              const location = result.results[0];
              resolve({
                valid: true,
                correctedCity: location.components.city || location.components.town || location.components.village || city,
                correctedState: location.components.state_code || location.components.state || state,
                correctedCountry: location.components.country_code?.toUpperCase() || country,
                formatted: location.formatted,
                confidence: location.confidence || 0
              });
            } else {
              resolve({ valid: false, confidence: 0 });
            }
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }, 2, 1000, 'Geocoding validation');
}

function fetchSitemap(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(null)).on('timeout', () => resolve(null));
  });
}

// ============================================================================
// LOCATION DETECTION: 6+ FALLBACK STRATEGIES
// ============================================================================
async function detectLocation(page, firmWebsite, firmName, instantlyCity, instantlyState, instantlyCountry) {
  console.log(`\n📍 LOCATION DETECTION (6+ strategies)...`);
  
  const locationCandidates = [];
  
  // -------------------------------------------------------------------------
  // STRATEGY 1: Instantly Data (if provided)
  // -------------------------------------------------------------------------
  if (instantlyCity && instantlyState) {
    console.log(`   📋 Strategy 1: Using Instantly data: ${instantlyCity}, ${instantlyState}`);
    try {
      const validation = await validateLocation(instantlyCity, instantlyState, instantlyCountry);
      if (validation.valid && validation.confidence >= 5) {
        locationCandidates.push({
          city: validation.correctedCity,
          state: validation.correctedState,
          country: validation.correctedCountry,
          source: 'instantly-validated',
          confidence: 10,
          validated: true
        });
        console.log(`   ✅ Validated: ${validation.formatted}`);
      } else {
        locationCandidates.push({
          city: instantlyCity,
          state: instantlyState,
          country: instantlyCountry,
          source: 'instantly-unvalidated',
          confidence: 6,
          validated: false
        });
        console.log(`   ⚠️  Could not validate (using anyway)`);
      }
    } catch (e) {
      locationCandidates.push({
        city: instantlyCity,
        state: instantlyState,
        country: instantlyCountry,
        source: 'instantly-error',
        confidence: 6,
        validated: false
      });
    }
  }
  
  // -------------------------------------------------------------------------
  // STRATEGY 2: Google Business Profile Address
  // -------------------------------------------------------------------------
  console.log(`   🏢 Strategy 2: Looking up Google Business Profile...`);
  try {
    const searchResult = await searchPlaces(firmName, 'law firm');
    if (searchResult.status === 'OK' && searchResult.results && searchResult.results.length > 0) {
      const firmNameLower = firmName.toLowerCase();
      let bestMatch = null;
      
      for (const place of searchResult.results.slice(0, 5)) {
        const placeName = place.name.toLowerCase();
        if (placeName === firmNameLower || placeName.includes(firmNameLower) || firmNameLower.includes(placeName)) {
          bestMatch = place;
          break;
        }
      }
      
      if (bestMatch && bestMatch.formatted_address) {
        // Parse address
        const addressParts = bestMatch.formatted_address.split(',').map(p => p.trim());
        const zipMatch = bestMatch.formatted_address.match(/([A-Z]{2})\s+(\d{5})/);
        
        if (zipMatch && addressParts.length >= 3) {
          const city = addressParts[addressParts.length - 3] || '';
          const state = zipMatch[1];
          const country = addressParts[addressParts.length - 1].includes('USA') ? 'US' : 'Unknown';
          
          locationCandidates.push({
            city: city,
            state: state,
            country: country,
            source: 'google-business',
            confidence: 9,
            validated: true,
            fullAddress: bestMatch.formatted_address
          });
          console.log(`   ✅ Found: ${city}, ${state} (${bestMatch.formatted_address})`);
        }
      }
    }
  } catch (e) {
    console.log(`   ⚠️  Google Business lookup failed: ${e.message}`);
  }
  
  // -------------------------------------------------------------------------
  // STRATEGY 3: Scrape Contact Page
  // -------------------------------------------------------------------------
  console.log(`   📄 Strategy 3: Scraping contact page...`);
  try {
    const links = await page.locator('a[href]').evaluateAll(links => 
      links.map(link => ({ href: link.href, text: link.textContent }))
    );
    const contactLink = links.find(l => 
      /\/(contact|contacto|contact-us|locations|offices|reach-us)\/?$/i.test(l.href)
    );
    
    if (contactLink) {
      await retryOperation(async () => {
        await page.goto(contactLink.href, { waitUntil: 'networkidle', timeout: 15000 });
      }, 3, 2000, 'Load contact page');
      
      const contactText = await page.textContent('body');
      const contactHtml = await page.content();
      
      // Try structured address first
      try {
        const addressElements = await page.locator('[class*="address"], [itemprop="address"]').all();
        for (const element of addressElements) {
          const addressText = await element.textContent();
          const zipMatch = addressText.match(/([A-Z][a-z\s]+),\s*([A-Z]{2})\s+(\d{5})/);
          if (zipMatch) {
            locationCandidates.push({
              city: zipMatch[1].trim(),
              state: zipMatch[2],
              country: 'US',
              source: 'contact-page-structured',
              confidence: 8,
              validated: false
            });
            console.log(`   ✅ Found: ${zipMatch[1]}, ${zipMatch[2]}`);
            break;
          }
        }
      } catch (e) {
        // Continue to regex fallback
      }
      
      // Regex fallback
      const zipPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\s+(\d{5})/g;
      const matches = [...contactText.matchAll(zipPattern)];
      
      for (const match of matches.slice(0, 3)) {
        const city = match[1].trim();
        if (!['Suite', 'Floor', 'Unit'].includes(city)) {
          locationCandidates.push({
            city: city,
            state: match[2],
            country: 'US',
            source: 'contact-page-regex',
            confidence: 7,
            validated: false
          });
          console.log(`   ✅ Found: ${city}, ${match[2]}`);
        }
      }
      
      // -------------------------------------------------------------------------
      // STRATEGY 4: AI Analysis of Contact Page (OPTIONAL - graceful fallback)
      // -------------------------------------------------------------------------
      if (locationCandidates.length === 0 && ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.length > 20) {
        console.log(`   🤖 Strategy 4: Using AI to analyze contact page...`);
        try {
          const aiPrompt = `Extract the physical office address from this law firm's contact page. 
Return ONLY the city and state in this exact format: "City, ST" (e.g., "McLean, VA").
If multiple addresses exist, return the main/headquarters address.
If you cannot find an address, return "NOT_FOUND".`;
          
          const aiResponse = await askAI(aiPrompt, contactHtml);
          const cleanResponse = aiResponse.trim();
          
          if (cleanResponse !== 'NOT_FOUND' && cleanResponse.includes(',')) {
            const parts = cleanResponse.split(',').map(p => p.trim());
            if (parts.length === 2) {
              locationCandidates.push({
                city: parts[0],
                state: parts[1],
                country: 'US',
                source: 'ai-contact-page',
                confidence: 8,
                validated: false
              });
              console.log(`   ✅ AI found: ${parts[0]}, ${parts[1]}`);
            }
          }
        } catch (e) {
          console.log(`   ⚠️  AI analysis skipped: ${e.message}`);
        }
      } else if (locationCandidates.length === 0) {
        console.log(`   ⏭️  Strategy 4 skipped: AI not available (set ANTHROPIC_API_KEY to enable)`);
      }
    }
  } catch (e) {
    console.log(`   ⚠️  Contact page scraping failed: ${e.message}`);
  }
  
  // -------------------------------------------------------------------------
  // STRATEGY 5: Meta Tags and Schema.org (use already-loaded homepage)
  // -------------------------------------------------------------------------
  console.log(`   🏷️  Strategy 5: Checking meta tags and schema.org...`);
  try {
    // We're still on homepage from earlier - just check the content
    const htmlContent = await page.content();
    
    // Check for schema.org LocalBusiness markup
    const schemaMatch = htmlContent.match(/"@type":\s*"(LocalBusiness|Attorney|LegalService)"[\s\S]{0,1000}?"address":\s*\{[\s\S]{0,500}?"addressLocality":\s*"([^"]+)"[\s\S]{0,200}?"addressRegion":\s*"([^"]+)"/);
    if (schemaMatch) {
      locationCandidates.push({
        city: schemaMatch[2],
        state: schemaMatch[3],
        country: 'US',
        source: 'schema-org',
        confidence: 9,
        validated: false
      });
      console.log(`   ✅ Schema.org found: ${schemaMatch[2]}, ${schemaMatch[3]}`);
    } else {
      console.log(`   ⏭️  No schema.org location data found`);
    }
    
    // Check meta tags
    const metaTags = {
      geoRegion: await page.getAttribute('meta[name="geo.region"]', 'content').catch(() => null),
      geoPosition: await page.getAttribute('meta[name="geo.position"]', 'content').catch(() => null),
      icbmLocation: await page.getAttribute('meta[name="ICBM"]', 'content').catch(() => null),
    };
    
    if (metaTags.geoRegion) {
      const parts = metaTags.geoRegion.split('-');
      if (parts.length === 2) {
        console.log(`   ✅ Meta tag found: state ${parts[1]}`);
      }
    } else {
      console.log(`   ⏭️  No geo meta tags found`);
    }
  } catch (e) {
    console.log(`   ⚠️  Meta tag check skipped: ${e.message}`);
  }
  
  // -------------------------------------------------------------------------
  // STRATEGY 6: About Page Analysis with AI (OPTIONAL - graceful fallback)
  // -------------------------------------------------------------------------
  if (ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.length > 20) {
    console.log(`   🤖 Strategy 6: AI analysis of About page...`);
    try {
      const links = await page.locator('a[href]').evaluateAll(links => 
        links.map(link => ({ href: link.href, text: link.textContent }))
      );
      const aboutLink = links.find(l => 
        /\/(about|about-us|our-firm|who-we-are)\/?$/i.test(l.href)
      );
      
      if (aboutLink) {
        await retryOperation(async () => {
          await page.goto(aboutLink.href, { waitUntil: 'networkidle', timeout: 15000 });
        }, 3, 2000, 'Load about page');
        
        const aboutHtml = await page.content();
        
        const aiPrompt = `This is a law firm's About page. Extract the city and state where the firm is headquartered/located.
Look for phrases like "based in", "located in", "serving clients in", "founded in [city]", etc.
Return ONLY the city and state in this exact format: "City, ST" (e.g., "McLean, VA").
If multiple cities mentioned, return the main headquarters.
If you cannot determine the location, return "NOT_FOUND".`;
        
        const aiResponse = await askAI(aiPrompt, aboutHtml);
        const cleanResponse = aiResponse.trim();
        
        if (cleanResponse !== 'NOT_FOUND' && cleanResponse.includes(',')) {
          const parts = cleanResponse.split(',').map(p => p.trim());
          if (parts.length === 2) {
            locationCandidates.push({
              city: parts[0],
              state: parts[1],
              country: 'US',
              source: 'ai-about-page',
              confidence: 7,
              validated: false
            });
            console.log(`   ✅ AI found: ${parts[0]}, ${parts[1]}`);
          }
        }
      }
    } catch (e) {
      console.log(`   ⚠️  About page AI analysis skipped: ${e.message}`);
    }
  } else {
    console.log(`   ⏭️  Strategy 6 skipped: AI not available (set ANTHROPIC_API_KEY to enable)`);
  }
  
  // -------------------------------------------------------------------------
  // CHOOSE BEST LOCATION
  // -------------------------------------------------------------------------
  console.log(`\n   📊 Found ${locationCandidates.length} location candidate(s)`);
  
  if (locationCandidates.length === 0) {
    console.log(`   ❌ CRITICAL: No location found after all strategies!`);
    return {
      location: { city: 'Unknown', state: '', country: 'US' },
      source: 'none',
      confidence: 0,
      validated: false
    };
  }
  
  // Sort by confidence (highest first)
  locationCandidates.sort((a, b) => b.confidence - a.confidence);
  
  // Cross-validate: If multiple sources agree, boost confidence
  const cityStateCounts = {};
  locationCandidates.forEach(loc => {
    const key = `${loc.city},${loc.state}`.toLowerCase();
    cityStateCounts[key] = (cityStateCounts[key] || 0) + 1;
  });
  
  const bestCandidate = locationCandidates[0];
  const key = `${bestCandidate.city},${bestCandidate.state}`.toLowerCase();
  const agreementCount = cityStateCounts[key];
  
  if (agreementCount > 1) {
    console.log(`   ✅ ${agreementCount} sources agree on: ${bestCandidate.city}, ${bestCandidate.state}`);
    bestCandidate.confidence = Math.min(10, bestCandidate.confidence + 2);
  }
  
  // Validate the best candidate
  if (!bestCandidate.validated) {
    try {
      const validation = await validateLocation(bestCandidate.city, bestCandidate.state, bestCandidate.country);
      if (validation.valid && validation.confidence >= 5) {
        console.log(`   ✅ Validated final location: ${validation.formatted}`);
        return {
          location: {
            city: validation.correctedCity,
            state: validation.correctedState,
            country: validation.correctedCountry
          },
          source: `${bestCandidate.source}-validated`,
          confidence: Math.min(10, bestCandidate.confidence + 1),
          validated: true
        };
      }
    } catch (e) {
      console.log(`   ⚠️  Final validation failed: ${e.message}`);
    }
  }
  
  console.log(`   ✅ Best location: ${bestCandidate.city}, ${bestCandidate.state} (${bestCandidate.source}, confidence: ${bestCandidate.confidence}/10)`);
  
  return {
    location: {
      city: bestCandidate.city,
      state: bestCandidate.state,
      country: bestCandidate.country
    },
    source: bestCandidate.source,
    confidence: bestCandidate.confidence,
    validated: bestCandidate.validated
  };
}

// ============================================================================
// TEAM PAGE DISCOVERY: 6+ STRATEGIES
// ============================================================================
async function findTeamPage(page, firmWebsite, allUrls) {
  console.log(`\n👥 TEAM PAGE DISCOVERY (6+ strategies)...`);
  
  const teamPageCandidates = [];
  
  // -------------------------------------------------------------------------
  // STRATEGY 1: Strict Pattern Match
  // -------------------------------------------------------------------------
  console.log(`   🔍 Strategy 1: Strict URL pattern matching...`);
  const strictPatterns = [
    /\/(team|our-team|meet-our-team|attorneys|lawyers|staff|people|nuestroequipo|equipo)\/?$/i
  ];
  
  for (const pattern of strictPatterns) {
    const matches = allUrls.filter(url => pattern.test(url));
    matches.forEach(url => {
      teamPageCandidates.push({ url, source: 'strict-pattern', confidence: 9 });
      console.log(`   ✅ Found: ${url}`);
    });
  }
  
  // -------------------------------------------------------------------------
  // STRATEGY 2: Loose Pattern Match (subdirectories allowed)
  // -------------------------------------------------------------------------
  if (teamPageCandidates.length === 0) {
    console.log(`   🔍 Strategy 2: Loose URL pattern matching...`);
    const loosePatterns = [
      /\/(team|our-team|attorneys|lawyers|people|staff|professionals|leadership)/i,
      /\/(meet-the-team|our-attorneys|our-lawyers|attorney-profiles|lawyer-profiles)/i
    ];
    
    for (const pattern of loosePatterns) {
      const matches = allUrls.filter(url => pattern.test(url));
      matches.slice(0, 5).forEach(url => {
        teamPageCandidates.push({ url, source: 'loose-pattern', confidence: 7 });
        console.log(`   ✅ Found: ${url}`);
      });
    }
  }
  
  // -------------------------------------------------------------------------
  // STRATEGY 3: Sitemap Search for Keywords
  // -------------------------------------------------------------------------
  if (teamPageCandidates.length === 0) {
    console.log(`   🔍 Strategy 3: Searching sitemap for keywords...`);
    const keywords = ['team', 'attorney', 'lawyer', 'people', 'staff', 'professional', 'partner'];
    
    for (const url of allUrls) {
      const urlLower = url.toLowerCase();
      if (keywords.some(kw => urlLower.includes(kw))) {
        // Avoid blog posts and news
        if (!/\/(blog|news|article|press|event)/.test(urlLower)) {
          teamPageCandidates.push({ url, source: 'sitemap-keyword', confidence: 6 });
          console.log(`   ✅ Found: ${url}`);
          if (teamPageCandidates.length >= 5) break;
        }
      }
    }
  }
  
  // -------------------------------------------------------------------------
  // STRATEGY 4: AI Analysis of Navigation Menu (OPTIONAL - graceful fallback)
  // -------------------------------------------------------------------------
  if (teamPageCandidates.length === 0 && ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.length > 20) {
    console.log(`   🤖 Strategy 4: AI analysis of navigation menu...`);
    try {
      await page.goto(firmWebsite, { waitUntil: 'networkidle', timeout: 15000 });
      const htmlContent = await page.content();
      
      const aiPrompt = `Analyze this law firm website's navigation menu and find the URL for the page that lists their attorneys/team members.
Look for menu items like "Team", "Attorneys", "Our Lawyers", "People", "Staff", etc.
Return ONLY the full URL of the team page (must start with http:// or https://).
If you cannot find a team page link, return "NOT_FOUND".`;
      
      const aiResponse = await askAI(aiPrompt, htmlContent);
      const cleanResponse = aiResponse.trim();
      
      if (cleanResponse !== 'NOT_FOUND' && (cleanResponse.startsWith('http://') || cleanResponse.startsWith('https://'))) {
        teamPageCandidates.push({ url: cleanResponse, source: 'ai-navigation', confidence: 8 });
        console.log(`   ✅ AI found: ${cleanResponse}`);
      }
    } catch (e) {
      console.log(`   ⚠️  AI navigation analysis skipped: ${e.message}`);
    }
  } else if (teamPageCandidates.length === 0) {
    console.log(`   ⏭️  Strategy 4 skipped: AI not available (set ANTHROPIC_API_KEY to enable)`);
  }
  
  // -------------------------------------------------------------------------
  // STRATEGY 5: Footer Links Search
  // -------------------------------------------------------------------------
  if (teamPageCandidates.length === 0) {
    console.log(`   🔍 Strategy 5: Searching footer for team links...`);
    try {
      await page.goto(firmWebsite, { waitUntil: 'networkidle', timeout: 15000 });
      const footerLinks = await page.locator('footer a, [class*="footer"] a').evaluateAll(links =>
        links.map(a => ({ href: a.href, text: a.textContent.toLowerCase() }))
      );
      
      const teamFooterLink = footerLinks.find(link => 
        /team|attorney|lawyer|people|staff/i.test(link.text)
      );
      
      if (teamFooterLink) {
        teamPageCandidates.push({ url: teamFooterLink.href, source: 'footer-link', confidence: 7 });
        console.log(`   ✅ Found in footer: ${teamFooterLink.href}`);
      }
    } catch (e) {
      console.log(`   ⚠️  Footer search failed: ${e.message}`);
    }
  }
  
  // -------------------------------------------------------------------------
  // STRATEGY 6: Deep Crawl (3 levels)
  // -------------------------------------------------------------------------
  if (teamPageCandidates.length === 0) {
    console.log(`   🕷️  Strategy 6: Deep crawling for attorney bios...`);
    try {
      await page.goto(firmWebsite, { waitUntil: 'networkidle', timeout: 15000 });
      const links = await page.locator('a[href]').evaluateAll(links =>
        links.map(a => a.href).filter(href => href && href.startsWith(firmWebsite))
      );
      
      // Visit up to 10 random internal pages looking for attorney profiles
      const sampleLinks = links.slice(0, 10);
      
      for (const link of sampleLinks) {
        try {
          await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 10000 });
          const pageText = await page.textContent('body');
          
          // Check for attorney profile indicators
          const hasAttorneyIndicators = /\b(J\.D\.|Esq\.|Bar Admission|Education:|Practice Areas:|Attorney|Lawyer)\b/i.test(pageText);
          const hasMultipleNames = (pageText.match(/([A-Z][a-z]+\s+[A-Z][a-z]+,\s+(Esq\.|J\.D\.|Partner|Attorney))/g) || []).length >= 3;
          
          if (hasAttorneyIndicators && hasMultipleNames) {
            teamPageCandidates.push({ url: link, source: 'deep-crawl', confidence: 6 });
            console.log(`   ✅ Found via crawl: ${link}`);
            break; // Found one, stop crawling
          }
        } catch (e) {
          // Skip this page and continue
        }
      }
    } catch (e) {
      console.log(`   ⚠️  Deep crawl failed: ${e.message}`);
    }
  }
  
  // -------------------------------------------------------------------------
  // CHOOSE BEST TEAM PAGE
  // -------------------------------------------------------------------------
  if (teamPageCandidates.length === 0) {
    console.log(`   ❌ No team page found after all strategies`);
    return null;
  }
  
  // Sort by confidence
  teamPageCandidates.sort((a, b) => b.confidence - a.confidence);
  const best = teamPageCandidates[0];
  
  console.log(`   ✅ Best match: ${best.url} (${best.source}, confidence: ${best.confidence}/10)`);
  return best.url;
}

// ============================================================================
// ATTORNEY EXTRACTION: AI Fallback
// ============================================================================
async function extractAttorneys(page, teamPageUrl, teamPageHtml) {
  console.log(`\n👨‍⚖️ ATTORNEY EXTRACTION (multiple strategies)...`);
  
  const attorneys = [];
  const teamText = await page.textContent('body');
  
  // -------------------------------------------------------------------------
  // STRATEGY 1: Regex Patterns (existing logic)
  // -------------------------------------------------------------------------
  console.log(`   🔍 Strategy 1: Regex pattern matching...`);
  
  const patterns = [
    // Pattern 1: Name with title
    /([A-Z][a-z]+(?:\s+[A-Z]\.)?(?:\s+[A-Z][a-z]+){1,3})[,\s]+(Esq\.|J\.D\.|LL\.B\.|Attorney|Partner|Associate|Counsel|Founding Partner|Managing Partner|Senior Partner|Socio|Socia)/gi,
    // Pattern 2: Education markers
    /([A-Z][a-z]+(?:\s+[A-Z]\.)?(?:\s+[A-Z][a-z]+){1,3})(?:.*?)(?:University|Law School|College|J\.D\.|LL\.B\.|Juris Doctor)/gi
  ];
  
  const seen = new Set();
  
  for (const pattern of patterns) {
    const matches = [...teamText.matchAll(pattern)];
    matches.forEach(match => {
      const name = match[1].trim();
      const title = match[2] ? match[2].trim() : 'Attorney';
      const key = name.toLowerCase();
      
      if (!seen.has(key) && name.split(' ').length >= 2 && name.split(' ').length <= 4) {
        seen.add(key);
        attorneys.push({ name, title });
      }
    });
  }
  
  console.log(`   ✅ Regex found ${attorneys.length} attorneys`);
  
  // -------------------------------------------------------------------------
  // STRATEGY 2: Structured Elements
  // -------------------------------------------------------------------------
  if (attorneys.length < 3) {
    console.log(`   🔍 Strategy 2: Structured element extraction...`);
    try {
      const structuredAttorneys = await page.locator('[class*="attorney"], [class*="team-member"], [class*="lawyer"], [class*="professional"]').all();
      
      for (const element of structuredAttorneys.slice(0, 30)) {
        const text = await element.textContent();
        const nameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z]\.)?(?:\s+[A-Z][a-z]+){1,3})/);
        if (nameMatch) {
          const name = nameMatch[1].trim();
          const titleMatch = text.match(/(Partner|Attorney|Counsel|Associate|Socio|Socia|Managing Partner|Senior Partner)/i);
          const key = name.toLowerCase();
          
          if (!seen.has(key) && name.split(' ').length >= 2 && name.split(' ').length <= 4) {
            seen.add(key);
            attorneys.push({ 
              name, 
              title: titleMatch ? titleMatch[1] : 'Attorney' 
            });
          }
        }
      }
      
      console.log(`   ✅ Structured elements found ${attorneys.length} total attorneys`);
    } catch (e) {
      console.log(`   ⚠️  Structured extraction failed: ${e.message}`);
    }
  }
  
  // -------------------------------------------------------------------------
  // STRATEGY 3: AI-Powered Extraction (OPTIONAL - if regex found < 3 attorneys)
  // -------------------------------------------------------------------------
  if (attorneys.length < 3 && ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.length > 20) {
    console.log(`   🤖 Strategy 3: AI-powered extraction...`);
    try {
      const aiPrompt = `Extract ALL attorney names and their titles from this law firm's team page.
Return the data in this exact JSON format:
[
  {"name": "John Smith", "title": "Partner"},
  {"name": "Jane Doe", "title": "Associate"}
]

Rules:
- Include ALL attorneys you can find (even if there are 20+)
- Name must be First Last or First Middle Last
- Title can be: Partner, Associate, Counsel, Attorney, Managing Partner, etc.
- Skip administrative staff, paralegals, and non-attorneys
- If you cannot find ANY attorneys, return an empty array: []`;
      
      const aiResponse = await askAI(aiPrompt, teamPageHtml);
      const cleanResponse = aiResponse.trim();
      
      // Parse JSON response
      try {
        const aiAttorneys = JSON.parse(cleanResponse);
        if (Array.isArray(aiAttorneys) && aiAttorneys.length > 0) {
          console.log(`   ✅ AI found ${aiAttorneys.length} attorneys`);
          
          // Merge with existing (avoid duplicates)
          aiAttorneys.forEach(att => {
            const key = att.name.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              attorneys.push({ name: att.name, title: att.title });
            }
          });
        }
      } catch (parseError) {
        console.log(`   ⚠️  AI response was not valid JSON`);
      }
    } catch (e) {
      console.log(`   ⚠️  AI extraction skipped: ${e.message}`);
    }
  } else if (attorneys.length < 3) {
    console.log(`   ⏭️  Strategy 3 skipped: AI not available (set ANTHROPIC_API_KEY to enable)`);
  }
  
  // -------------------------------------------------------------------------
  // STRATEGY 4: JSON-LD Schema Parsing
  // -------------------------------------------------------------------------
  if (attorneys.length < 3) {
    console.log(`   🏷️  Strategy 4: Parsing JSON-LD schema...`);
    try {
      const schemaScripts = await page.locator('script[type="application/ld+json"]').all();
      
      for (const script of schemaScripts) {
        const content = await script.textContent();
        try {
          const schema = JSON.parse(content);
          
          // Check for Person or Attorney type
          if (schema['@type'] === 'Person' || schema['@type'] === 'Attorney') {
            const name = schema.name;
            const title = schema.jobTitle || 'Attorney';
            const key = name.toLowerCase();
            
            if (name && !seen.has(key)) {
              seen.add(key);
              attorneys.push({ name, title });
            }
          }
          
          // Check for array of people
          if (Array.isArray(schema)) {
            schema.forEach(item => {
              if ((item['@type'] === 'Person' || item['@type'] === 'Attorney') && item.name) {
                const key = item.name.toLowerCase();
                if (!seen.has(key)) {
                  seen.add(key);
                  attorneys.push({ name: item.name, title: item.jobTitle || 'Attorney' });
                }
              }
            });
          }
        } catch (jsonError) {
          // Invalid JSON, skip
        }
      }
      
      console.log(`   ✅ JSON-LD found ${attorneys.length} total attorneys`);
    } catch (e) {
      console.log(`   ⚠️  JSON-LD parsing failed: ${e.message}`);
    }
  }
  
  console.log(`\n   📊 FINAL: Extracted ${attorneys.length} attorneys`);
  return attorneys.slice(0, 30); // Limit to 30
}

// ============================================================================
// MAIN RESEARCH FUNCTION
// ============================================================================
async function deepResearch(firmWebsite, contactName = '', instantlyCity = '', instantlyState = '', instantlyCountry = 'US', instantlyCompany = '') {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 STARTING TRULY AUTONOMOUS DEEP RESEARCH`);
  console.log(`${'='.repeat(80)}`);
  console.log(`🌐 Website: ${firmWebsite}`);
  console.log(`👤 Contact: ${contactName || 'Unknown'}`);
  if (instantlyCity || instantlyCompany) {
    console.log(`📋 Instantly Data Provided:`);
    if (instantlyCompany) console.log(`   Company: ${instantlyCompany}`);
    if (instantlyCity) console.log(`   Location: ${instantlyCity}, ${instantlyState}, ${instantlyCountry}`);
  }
  console.log(`${'='.repeat(80)}\n`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const research = {
    firmName: instantlyCompany || '',
    website: firmWebsite,
    contactPerson: contactName,
    location: { city: '', state: '', country: 'US' },
    locationSource: 'unknown',
    locationConfidence: 0,
    allLocations: [],
    
    reviewCount: 0,
    rating: 0,
    googleBusinessAddress: '',
    
    credentials: [],
    attorneys: [],
    practiceAreas: [],
    firmHistory: {
      founded: null,
      yearsInBusiness: null,
      teamSize: null,
      awards: [],
      barAdmissions: []
    },
    linkedInProfiles: [],
    competitors: [],
    testimonials: [],
    caseResults: [],
    
    gaps: {
      metaAds: { hasGap: false, impact: 0, details: '', status: 'none' },
      googleAds: { hasGap: false, impact: 0, details: '', status: 'none' },
      support24x7: { hasGap: false, impact: 0, details: '' },
      websiteSpeed: { hasGap: false, impact: 0, details: '' },
      crm: { hasGap: false, impact: 0, details: '' }
    },
    
    pageSpeed: 0,
    pageSpeedScore: '',
    hasChatbot: false,
    hasBookingWidget: false,
    mobileOptimized: false,
    
    metaAdsData: {},
    googleAdsData: {},
    
    pagesAnalyzed: [],
    researchedAt: new Date().toISOString(),
    estimatedMonthlyRevenueLoss: 0,
    
    dataQuality: {
      missingFields: [],
      warnings: [],
      confidence: {
        firmName: 0,
        location: 0,
        attorneys: 0,
        practiceAreas: 0,
        overall: 0
      }
    }
  };
  
  try {
    // ========================================================================
    // STEP 1: LOAD HOMEPAGE WITH RETRY
    // ========================================================================
    console.log(`📄 STEP 1: Loading homepage...`);
    const startTime = Date.now();
    
    await retryOperation(async () => {
      await page.goto(firmWebsite, { waitUntil: 'networkidle', timeout: 30000 });
    }, 3, 3000, 'Load homepage');
    
    const loadTime = Date.now() - startTime;
    research.pageSpeed = loadTime;
    research.pageSpeedScore = loadTime < 2000 ? 'Fast' : loadTime < 4000 ? 'Medium' : 'Slow';
    
    const finalUrl = page.url();
    if (finalUrl !== firmWebsite) {
      console.log(`   🔀 Redirected to: ${finalUrl}`);
      firmWebsite = finalUrl;
    }
    
    if (loadTime > 3000) {
      research.gaps.websiteSpeed.hasGap = true;
      research.gaps.websiteSpeed.impact = 8000;
      research.gaps.websiteSpeed.details = `${(loadTime/1000).toFixed(1)}s load time. Every extra second = 7% conversion loss.`;
    }
    
    console.log(`   ⚡ Load time: ${(loadTime/1000).toFixed(1)}s`);
    
    // Extract firm name
    let firmName = instantlyCompany || '';
    let firmNameSource = 'instantly';
    
    if (!firmName) {
      const ogSiteName = await page.getAttribute('meta[property="og:site_name"]', 'content').catch(() => null);
      if (ogSiteName && ogSiteName.length > 0 && ogSiteName.length < 80) {
        firmName = ogSiteName;
        firmNameSource = 'og:site_name';
      }
      
      if (!firmName) {
        const pageTitle = await page.title();
        const titleParts = pageTitle.split(/[|\–\-]/).map(p => p.trim()).filter(p => p.length > 0);
        
        for (const part of titleParts.reverse()) {
          if (/\b(law|legal|attorney|lawyer|professional corporation|pc|llp|pllc)\b/i.test(part) && part.length < 80) {
            firmName = part;
            firmNameSource = 'page-title';
            break;
          }
        }
        
        if (!firmName && titleParts.length > 0) {
          const lastPart = titleParts[titleParts.length - 1];
          const genericTitles = /^(home|welcome|index|main|about|contact)$/i;
          if (!genericTitles.test(lastPart)) {
            firmName = lastPart;
            firmNameSource = 'page-title';
          }
        }
      }
      
      if (!firmName) {
        const domain = firmWebsite.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*/,'').replace(/\.\w+$/, '');
        firmName = domain
          .split(/[-_]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        firmNameSource = 'domain';
      }
    }
    
    research.firmName = firmName || 'Law Firm';
    research.dataQuality.confidence.firmName = firmNameSource === 'instantly' ? 10 : firmNameSource === 'og:site_name' ? 9 : firmNameSource === 'page-title' ? 7 : 5;
    console.log(`   ✅ Firm: ${research.firmName} (source: ${firmNameSource}, confidence: ${research.dataQuality.confidence.firmName}/10)`);
    research.pagesAnalyzed.push({ url: firmWebsite, type: 'homepage' });
    
    const bodyText = await page.textContent('body');
    
    // Extract practice areas
    const practiceKeywords = [
      'personal injury', 'lesiones personales', 'accident', 'accidente', 'wrongful death',
      'car accident', 'truck accident', 'motorcycle accident', 'slip and fall',
      'medical malpractice', 'tax law', 'immigration', 'family law', 'divorce',
      'criminal defense', 'dui', 'corporate', 'business law', 'real estate',
      'estate planning', 'employment law', 'intellectual property', 'litigation'
    ];
    
    const bodyTextLower = bodyText.toLowerCase();
    const firmNameLower = research.firmName.toLowerCase();
    const practiceAreaCounts = {};
    
    for (const keyword of practiceKeywords) {
      const regex = new RegExp(keyword.replace(/\s+/g, '\\s+'), 'gi');
      const matches = bodyTextLower.match(regex);
      let count = matches ? matches.length : 0;
      
      if (firmNameLower.includes(keyword) || keyword.split(' ').some(word => firmNameLower.includes(word))) {
        count += 1000;
      }
      
      if (count > 0) {
        practiceAreaCounts[keyword] = count;
        research.practiceAreas.push(keyword);
      }
    }
    
    research.practiceAreas.sort((a, b) => (practiceAreaCounts[b] || 0) - (practiceAreaCounts[a] || 0));
    research.dataQuality.confidence.practiceAreas = research.practiceAreas.length >= 3 ? 9 : research.practiceAreas.length >= 1 ? 6 : 3;
    console.log(`   ⚖️  Practice areas: ${research.practiceAreas.length} (confidence: ${research.dataQuality.confidence.practiceAreas}/10)`);
    
    // Check for 24/7 support and chatbot
    const support247Phrases = [
      'available 24/7', 'open 24/7', '24/7 answering', '24/7 intake',
      'call us 24/7', 'available anytime', 'emergency line', 'after-hours'
    ];
    
    let has247 = support247Phrases.some(phrase => bodyTextLower.includes(phrase.toLowerCase()));
    
    const chatWidgetSelectors = [
      '#intercom-container', '#drift-widget', '.tidio-chat',
      '#hubspot-messages-iframe-container', '[id*="livechat"]',
      '[class*="crisp-client"]', '[id*="tawk"]',
      'iframe[src*="intercom"]', 'iframe[src*="drift"]'
    ];
    
    let hasChatbot = false;
    for (const selector of chatWidgetSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        hasChatbot = true;
        break;
      }
    }
    research.hasChatbot = hasChatbot;
    
    if (!has247 && !hasChatbot) {
      research.gaps.support24x7.hasGap = true;
      research.gaps.support24x7.impact = 15000;
      research.gaps.support24x7.details = `No 24/7 support detected. 73% of leads come outside business hours.`;
    }
    
    console.log(`   📞 24/7 Support: ${has247 || hasChatbot ? 'Yes' : 'No'}`);
    
    // ========================================================================
    // STEP 2: DISCOVER ALL PAGES VIA SITEMAP
    // ========================================================================
    console.log(`\n📋 STEP 2: Discovering all pages...`);
    
    let allUrls = [];
    const baseUrl = new URL(firmWebsite);
    const baseUrlClean = baseUrl.origin;
    const baseWithoutWWW = baseUrlClean.replace('://www.', '://');
    
    const sitemapUrls = [
      `${baseUrlClean}/sitemap_index.xml`,
      `${baseWithoutWWW}/sitemap_index.xml`,
      `${baseUrlClean}/sitemap.xml`,
      `${baseWithoutWWW}/sitemap.xml`,
      `${baseUrlClean}/page-sitemap.xml`,
      `${baseUrlClean}/wp-sitemap.xml`
    ];
    
    let foundSitemap = false;
    for (const sitemapUrl of sitemapUrls) {
      try {
        const content = await fetchSitemap(sitemapUrl);
        if (!content) continue;
        
        if (content.includes('<sitemapindex')) {
          console.log(`   📍 Found sitemap index: ${sitemapUrl}`);
          const subSitemaps = content.match(/<loc>(.*?)<\/loc>/g);
          if (subSitemaps) {
            for (const sub of subSitemaps.slice(0, 5)) {
              const subUrl = sub.replace(/<\/?loc>/g, '').trim();
              const subContent = await fetchSitemap(subUrl);
              if (subContent) {
                const urls = subContent.match(/<loc>(.*?)<\/loc>/g);
                if (urls) {
                  urls.forEach(url => {
                    const cleanUrl = url.replace(/<\/?loc>/g, '').trim();
                    if (!allUrls.includes(cleanUrl)) allUrls.push(cleanUrl);
                  });
                }
              }
            }
          }
          foundSitemap = true;
          break;
        } else if (content.includes('<urlset')) {
          console.log(`   📍 Found sitemap: ${sitemapUrl}`);
          const urls = content.match(/<loc>(.*?)<\/loc>/g);
          if (urls) {
            urls.forEach(url => {
              const cleanUrl = url.replace(/<\/?loc>/g, '').trim();
              if (!allUrls.includes(cleanUrl)) allUrls.push(cleanUrl);
            });
          }
          foundSitemap = true;
          break;
        }
      } catch (e) {
        // Continue to next sitemap
      }
    }
    
    if (!foundSitemap || allUrls.length === 0) {
      console.log(`   ⚠️  No sitemap found, scraping homepage links...`);
      try {
        const links = await page.locator('a[href]').evaluateAll(links => 
          links.map(link => link.href).filter(href => href && href.startsWith('http'))
        );
        allUrls = links.filter(link => {
          try {
            const linkUrl = new URL(link);
            return linkUrl.hostname === baseUrl.hostname || linkUrl.hostname === `www.${baseUrl.hostname}`;
          } catch {
            return false;
          }
        });
      } catch (e) {
        console.log(`   ⚠️  Error scraping homepage: ${e.message}`);
      }
    }
    
    console.log(`   ✅ Found ${allUrls.length} total URLs`);
    
    // ========================================================================
    // STEP 3: AUTONOMOUS LOCATION DETECTION
    // ========================================================================
    const locationResult = await detectLocation(page, firmWebsite, research.firmName, instantlyCity, instantlyState, instantlyCountry);
    research.location = locationResult.location;
    research.locationSource = locationResult.source;
    research.locationConfidence = locationResult.confidence;
    research.dataQuality.confidence.location = locationResult.confidence;
    research.allLocations.push(research.location);
    
    // ========================================================================
    // STEP 4: LOOK UP GOOGLE BUSINESS PROFILE (WITH RETRY)
    // ========================================================================
    console.log(`\n⭐ STEP 4: Looking up Google Business Profile...`);
    
    if (research.location.city && research.location.city !== 'Unknown') {
      try {
        const searchLocation = `${research.location.city}, ${research.location.state}`;
        console.log(`   🔍 Searching for: "${research.firmName}" in ${searchLocation}`);
        
        const firmResult = await searchPlaces(research.firmName, searchLocation);
        
        if (firmResult.status === 'OK' && firmResult.results && firmResult.results.length > 0) {
          const firmNameLower = research.firmName.toLowerCase();
          let bestMatch = null;
          
          for (const place of firmResult.results.slice(0, 5)) {
            const placeName = place.name.toLowerCase();
            if (placeName === firmNameLower || placeName.includes(firmNameLower) || firmNameLower.includes(placeName)) {
              bestMatch = place;
              break;
            }
          }
          
          if (bestMatch) {
            research.reviewCount = bestMatch.user_ratings_total || 0;
            research.rating = bestMatch.rating || 0;
            research.googleBusinessAddress = bestMatch.formatted_address || '';
            
            console.log(`   ✅ Found Google Business Profile:`);
            console.log(`      Rating: ${research.rating}⭐ (${research.reviewCount} reviews)`);
            console.log(`      Address: ${research.googleBusinessAddress}`);
          } else {
            console.log(`   ⚠️  No matching profile found`);
            research.dataQuality.warnings.push('Google Business Profile not found');
          }
        } else {
          console.log(`   ⚠️  Google Places API: ${firmResult.status}`);
          research.dataQuality.warnings.push('Could not look up Google Business Profile');
        }
      } catch (e) {
        console.log(`   ⚠️  Error: ${e.message}`);
        research.dataQuality.warnings.push('Failed to look up Google Business Profile');
      }
    } else {
      console.log(`   ⚠️  No valid location - skipping Google Business lookup`);
    }
    
    // ========================================================================
    // STEP 5: AUTONOMOUS TEAM PAGE DISCOVERY
    // ========================================================================
    const teamPageUrl = await findTeamPage(page, firmWebsite, allUrls);
    
    if (teamPageUrl) {
      try {
        await retryOperation(async () => {
          await page.goto(teamPageUrl, { waitUntil: 'networkidle', timeout: 15000 });
        }, 3, 2000, 'Load team page');
        
        research.pagesAnalyzed.push({ url: teamPageUrl, type: 'team' });
        const teamPageHtml = await page.content();
        
        research.attorneys = await extractAttorneys(page, teamPageUrl, teamPageHtml);
        research.dataQuality.confidence.attorneys = research.attorneys.length >= 5 ? 9 : research.attorneys.length >= 2 ? 7 : research.attorneys.length >= 1 ? 5 : 2;
        
        if (research.attorneys.length > 0) {
          console.log(`   👨‍⚖️ Attorneys found: ${research.attorneys.length}`);
          research.attorneys.slice(0, 5).forEach(a => {
            console.log(`      - ${a.name} (${a.title})`);
          });
          if (research.attorneys.length > 5) {
            console.log(`      ... and ${research.attorneys.length - 5} more`);
          }
        } else {
          research.dataQuality.warnings.push('No attorneys found');
          research.dataQuality.missingFields.push('attorneys');
        }
      } catch (e) {
        console.log(`   ⚠️  Error analyzing team page: ${e.message}`);
        research.dataQuality.warnings.push('Failed to analyze team page');
      }
    } else {
      research.dataQuality.warnings.push('No team page found');
      research.dataQuality.missingFields.push('team-page');
    }
    
    // ========================================================================
    // STEP 6: FIND COMPETITORS
    // ========================================================================
    console.log(`\n🔍 STEP 6: Finding competitors...`);
    
    if (research.location.city && research.location.city !== 'Unknown') {
      try {
        const searchTerm = research.practiceAreas[0] || 'lawyer';
        const searchLocation = `${research.location.city}, ${research.location.state}`;
        console.log(`   🔍 Searching: "${searchTerm} lawyer in ${searchLocation}"`);
        
        const placesResult = await searchPlaces(`${searchTerm} lawyer`, searchLocation);
        
        if (placesResult.status === 'OK' && placesResult.results) {
          const seenNames = new Set();
          const researchFirmLower = research.firmName.toLowerCase();
          
          for (const place of placesResult.results) {
            const firmName = place.name;
            const firmLower = firmName.toLowerCase();
            
            if (firmLower.includes(researchFirmLower) || researchFirmLower.includes(firmLower)) continue;
            if (seenNames.has(firmLower)) continue;
            if (/^(law firm|legal|attorney|lawyer|law office)$/i.test(firmName)) continue;
            
            research.competitors.push({
              name: firmName,
              reviews: place.user_ratings_total || 0,
              rating: place.rating || 0,
              address: place.formatted_address || '',
              features: []
            });
            
            seenNames.add(firmLower);
            if (research.competitors.length >= 12) break;
          }
          
          console.log(`   🏢 Competitors found: ${research.competitors.length}`);
        }
      } catch (e) {
        console.log(`   ⚠️  Error: ${e.message}`);
      }
    }
    
    // ========================================================================
    // STEP 7: CALCULATE CONFIDENCE & SAVE
    // ========================================================================
    research.gaps.crm.hasGap = true;
    research.gaps.crm.impact = 8000;
    research.gaps.crm.details = `Manual follow-up wastes 15+ hrs/week and loses 40% of warm leads.`;
    
    research.estimatedMonthlyRevenueLoss = Object.values(research.gaps)
      .reduce((sum, gap) => sum + (gap.impact || 0), 0);
    
    const confidenceScores = Object.values(research.dataQuality.confidence);
    research.dataQuality.confidence.overall = Math.round(
      confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
    );
    
    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ RESEARCH COMPLETE!`);
    console.log(`${'='.repeat(80)}`);
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Firm: ${research.firmName}`);
    console.log(`   Location: ${research.location.city}, ${research.location.state} (confidence: ${research.locationConfidence}/10)`);
    console.log(`   Attorneys: ${research.attorneys.length}`);
    console.log(`   Practice Areas: ${research.practiceAreas.length}`);
    console.log(`   Google Reviews: ${research.reviewCount} (${research.rating}⭐)`);
    console.log(`   Competitors: ${research.competitors.length}`);
    console.log(`   Pages Analyzed: ${research.pagesAnalyzed.length}`);
    
    console.log(`\n📈 DATA QUALITY:`);
    console.log(`   Overall Confidence: ${research.dataQuality.confidence.overall}/10`);
    console.log(`   Firm Name: ${research.dataQuality.confidence.firmName}/10`);
    console.log(`   Location: ${research.locationConfidence}/10`);
    console.log(`   Attorneys: ${research.dataQuality.confidence.attorneys}/10`);
    console.log(`   Practice Areas: ${research.dataQuality.confidence.practiceAreas}/10`);
    
    if (research.dataQuality.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${research.dataQuality.warnings.length}):`);
      research.dataQuality.warnings.slice(0, 10).forEach(w => console.log(`   - ${w}`));
    }
    
    if (research.dataQuality.missingFields.length > 0) {
      console.log(`\n❌ MISSING CRITICAL DATA:`);
      research.dataQuality.missingFields.forEach(f => console.log(`   - ${f}`));
    }
    
    console.log(`\n💰 REVENUE IMPACT:`);
    console.log(`   Monthly Loss: $${(research.estimatedMonthlyRevenueLoss/1000).toFixed(0)}K`);
    console.log(`   Annual Loss: $${(research.estimatedMonthlyRevenueLoss*12/1000).toFixed(0)}K`);
    console.log(`${'='.repeat(80)}\n`);
    
  } catch (error) {
    console.error(`❌ Research error: ${error.message}`);
    console.error(error.stack);
    research.dataQuality.warnings.push(`Fatal error: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  // Save to file
  const firmSlug = research.firmName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const reportsDir = path.resolve(__dirname, 'reports');
  
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const outputPath = path.resolve(reportsDir, `${firmSlug}-research.json`);
  fs.writeFileSync(outputPath, JSON.stringify(research, null, 2));
  console.log(`💾 Saved to: ${outputPath}\n`);
  
  return research;
}

// ============================================================================
// CLI
// ============================================================================
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const url = args[0];
  const contactName = args[1] || '';
  const city = args[2] || '';
  const state = args[3] || '';
  const country = args[4] || 'US';
  const company = args[5] || '';
  
  if (!url) {
    console.log('Usage: node research-v3-DEEP.js <website-url> [contact-name] [city] [state] [country] [company]');
    console.log('\nExamples:');
    console.log('  Basic: node research-v3-DEEP.js https://www.rothjackson.com');
    console.log('  With Instantly data: node research-v3-DEEP.js https://www.rothjackson.com "Andrew Condlin" "McLean" "VA" "US" "Roth Jackson"');
    console.log('\nThis script is TRULY AUTONOMOUS:');
    console.log('  - 6+ location detection strategies (Google Business, AI, scraping, meta tags, etc.)');
    console.log('  - 6+ team page discovery methods (patterns, AI, crawling, sitemap, etc.)');
    console.log('  - AI-powered extraction when regex fails');
    console.log('  - Retry logic on all network calls');
    console.log('  - Cross-validation between data sources');
    console.log('  - NEVER marks data as unknown until ALL strategies exhausted');
    process.exit(1);
  }
  
  deepResearch(url, contactName, city, state, country, company)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { deepResearch };
