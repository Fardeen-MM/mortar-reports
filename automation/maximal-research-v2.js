#!/usr/bin/env node
/**
 * MAXIMAL RESEARCH ENGINE V2
 * 
 * Philosophy: SCRAPE EVERYTHING. Use AI to extract EVERYTHING.
 * - Every page on their website
 * - LinkedIn profiles (firm + attorneys)
 * - Google My Business
 * - Social media (Twitter, Facebook, Instagram)
 * - Reviews (Google, Yelp, Avvo, Martindale)
 * - Recent news mentions
 * - Court records / case history
 * - Bar association data
 * - Tech stack analysis
 * - Competitor deep dive
 * 
 * Speed-to-lead: 3-5 minutes for complete intelligence
 */

require('dotenv').config();
const { chromium } = require('playwright');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ============================================================================
// AI HELPER - Direct Claude calls
// ============================================================================

async function askClaude(prompt, context, maxTokens = 4000) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    temperature: 0,
    messages: [{
      role: 'user',
      content: `${prompt}\n\n<context>\n${context.substring(0, 150000)}\n</context>`
    }]
  });
  
  return response.content[0].text;
}

// ============================================================================
// PHASE 1: WEBSITE DEEP SCRAPE
// ============================================================================

async function scrapeEntireWebsite(page, baseUrl) {
  console.log('\n🌐 PHASE 1: WEBSITE DEEP SCRAPE');
  console.log('   Discovering all pages...\n');

  // Ensure URL has protocol (bare domains like "midwestag.law" crash new URL())
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    baseUrl = 'https://' + baseUrl;
    console.log(`   ℹ️  Added protocol: ${baseUrl}`);
  }

  const scrapedPages = [];
  const visitedUrls = new Set();
  const urlsToVisit = [baseUrl];
  const maxPages = 50; // Limit to prevent infinite loops

  const baseDomain = new URL(baseUrl).hostname;
  
  while (urlsToVisit.length > 0 && scrapedPages.length < maxPages) {
    const currentUrl = urlsToVisit.shift();
    
    if (visitedUrls.has(currentUrl)) continue;
    visitedUrls.add(currentUrl);
    
    try {
      console.log(`   📄 Scraping: ${currentUrl}`);
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      const html = await page.content();
      const text = await page.evaluate(() => document.body.innerText);
      
      scrapedPages.push({
        url: currentUrl,
        html: html.substring(0, 50000), // First 50KB
        text: text.substring(0, 20000), // First 20KB of text
        title: await page.title()
      });
      
      // Extract all internal links
      const links = await page.evaluate((domain) => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href => {
            try {
              const url = new URL(href);
              return url.hostname === domain && 
                     !href.includes('#') && 
                     !href.match(/\.(pdf|jpg|png|gif|zip)$/i);
            } catch {
              return false;
            }
          });
      }, baseDomain);
      
      // Add new links to queue
      links.forEach(link => {
        if (!visitedUrls.has(link) && !urlsToVisit.includes(link)) {
          urlsToVisit.push(link);
        }
      });
      
    } catch (error) {
      console.log(`   ⚠️  Failed to scrape ${currentUrl}: ${error.message}`);
    }
  }
  
  console.log(`\n   ✅ Scraped ${scrapedPages.length} pages from website\n`);
  return scrapedPages;
}

// ============================================================================
// PHASE 2: LINKEDIN INTELLIGENCE
// ============================================================================

async function scrapeFirmLinkedIn(page, firmName) {
  console.log('\n💼 PHASE 2: LINKEDIN INTELLIGENCE');
  console.log('   Searching for firm LinkedIn...\n');
  
  try {
    const searchQuery = `${firmName} law firm site:linkedin.com/company`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Extract LinkedIn company URL from search results
    const linkedInUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="linkedin.com/company"]'));
      return links.length > 0 ? links[0].href : null;
    });
    
    if (!linkedInUrl) {
      console.log('   ⚠️  No LinkedIn company page found\n');
      return null;
    }
    
    console.log(`   ✅ Found: ${linkedInUrl}`);
    
    // Try to access LinkedIn page (may be blocked)
    try {
      await page.goto(linkedInUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const html = await page.content();
      const text = await page.evaluate(() => document.body.innerText);
      
      console.log('   ✅ Scraped LinkedIn company page\n');
      
      return {
        url: linkedInUrl,
        html: html.substring(0, 50000),
        text: text.substring(0, 20000)
      };
    } catch (error) {
      console.log('   ⚠️  LinkedIn page blocked (login required)\n');
      return { url: linkedInUrl, blocked: true };
    }
    
  } catch (error) {
    console.log(`   ⚠️  LinkedIn search failed: ${error.message}\n`);
    return null;
  }
}

async function scrapeAttorneyLinkedIns(page, firmName, attorneyNames) {
  console.log('\n👥 ATTORNEY LINKEDIN PROFILES');
  console.log('   Searching for individual attorneys...\n');
  
  const profiles = [];
  
  for (const attorney of attorneyNames.slice(0, 5)) { // Top 5 attorneys
    try {
      const searchQuery = `${attorney.name} ${firmName} site:linkedin.com/in`;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      
      const linkedInUrl = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));
        return links.length > 0 ? links[0].href : null;
      });
      
      if (linkedInUrl) {
        console.log(`   ✅ ${attorney.name}: ${linkedInUrl}`);
        profiles.push({
          name: attorney.name,
          url: linkedInUrl,
          title: attorney.title
        });
      }
      
    } catch (error) {
      console.log(`   ⚠️  ${attorney.name}: Search failed`);
    }
  }
  
  console.log(`\n   ✅ Found ${profiles.length} attorney LinkedIn profiles\n`);
  return profiles;
}

// ============================================================================
// PHASE 3: GOOGLE MY BUSINESS & REVIEWS
// ============================================================================

async function scrapeGoogleBusiness(page, firmName, city, state, country) {
  console.log('\n⭐ PHASE 3: GOOGLE MY BUSINESS & REVIEWS');
  console.log('   Searching Google...\n');

  let businessData = { rating: 0, reviews: 0 };

  try {
    const searchQuery = `${firmName} ${city} ${state}`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000); // Let knowledge panel load

    businessData = await page.evaluate(() => {
      // Try to extract from knowledge panel
      const ratingEl = document.querySelector('[aria-label*="stars"]') ||
                       document.querySelector('span[role="img"][aria-label*="Star"]');
      const spans = Array.from(document.querySelectorAll('span'));
      const reviewEl = spans.find(s => /\d+\s*(Google\s*)?reviews?/i.test(s.innerText));

      const rating = ratingEl ? parseFloat(ratingEl.getAttribute('aria-label') || '0') : 0;
      const reviews = reviewEl ? parseInt(reviewEl.innerText.replace(/\D/g, '') || '0') : 0;

      // Extract address
      const addressEl = document.querySelector('[data-attrid="kc:/location/location:address"]');
      const address = addressEl ? addressEl.innerText : null;

      // Extract phone
      const phoneEl = document.querySelector('[data-attrid="kc:/collection/knowledge_panels/has_phone:phone"]');
      const phone = phoneEl ? phoneEl.innerText : null;

      // Extract hours
      const hoursEl = document.querySelector('[data-attrid="kc:/location/location:hours"]');
      const hours = hoursEl ? hoursEl.innerText : null;

      return { rating, reviews, address, phone, hours };
    });

    console.log(`   DOM scrape: ${businessData.rating}⭐ (${businessData.reviews} reviews)`);

  } catch (error) {
    console.log(`   ⚠️  Google Business DOM scrape failed: ${error.message}`);
  }

  // Fallback: if DOM scrape got 0 reviews, try Google Places API (more reliable)
  if (!businessData.reviews || businessData.reviews === 0) {
    console.log('   DOM scrape returned 0 reviews, trying Places API fallback...');
    try {
      const { fetchFirmGoogleData } = require('./ai-research-helper');
      const placesData = await fetchFirmGoogleData(firmName, city, state, country);
      if (placesData.reviews > 0) {
        businessData.rating = placesData.rating;
        businessData.reviews = placesData.reviews;
        if (placesData.address && !businessData.address) businessData.address = placesData.address;
        console.log(`   ✅ Places API: ${placesData.rating}⭐ (${placesData.reviews} reviews)`);
      } else {
        console.log('   Places API also returned 0 reviews');
      }
    } catch (apiErr) {
      console.log(`   ⚠️  Places API fallback failed: ${apiErr.message}`);
    }
  }

  console.log(`   ✅ Rating: ${businessData.rating}⭐ (${businessData.reviews} reviews)`);
  if (businessData.address) console.log(`   ✅ Address: ${businessData.address}`);
  if (businessData.phone) console.log(`   ✅ Phone: ${businessData.phone}`);
  console.log('');

  return businessData;
}

// ============================================================================
// PHASE 4: SOCIAL MEDIA DISCOVERY
// ============================================================================

async function scrapeSocialMedia(page, firmName, website) {
  console.log('\n📱 PHASE 4: SOCIAL MEDIA DISCOVERY');
  console.log('   Finding social profiles...\n');
  
  const social = {
    twitter: null,
    facebook: null,
    instagram: null,
    youtube: null
  };
  
  try {
    // Extract from website footer/header
    await page.goto(website, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    const socialLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links.map(a => a.href).filter(href => 
        href.includes('twitter.com') ||
        href.includes('facebook.com') ||
        href.includes('instagram.com') ||
        href.includes('youtube.com') ||
        href.includes('linkedin.com')
      );
    });
    
    socialLinks.forEach(url => {
      if (url.includes('twitter.com')) social.twitter = url;
      if (url.includes('facebook.com')) social.facebook = url;
      if (url.includes('instagram.com')) social.instagram = url;
      if (url.includes('youtube.com')) social.youtube = url;
    });
    
  } catch (error) {
    console.log(`   ⚠️  Social media discovery failed: ${error.message}`);
  }
  
  // Count found profiles
  const foundCount = Object.values(social).filter(v => v !== null).length;
  console.log(`   ✅ Found ${foundCount} social media profiles\n`);
  
  return social;
}

// ============================================================================
// PHASE 5: NEWS & PRESS MENTIONS
// ============================================================================

async function scrapeRecentNews(page, firmName) {
  console.log('\n📰 PHASE 5: NEWS & PRESS MENTIONS');
  console.log('   Searching recent news...\n');
  
  try {
    const searchQuery = `"${firmName}" (law OR legal OR attorney OR lawyer)`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=nws`;
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    const newsItems = await page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll('div[data-hveid]')).slice(0, 5);
      return articles.map(article => {
        const title = article.querySelector('a')?.innerText || '';
        const source = article.querySelector('cite')?.innerText || '';
        const snippet = article.querySelector('div[role="heading"]')?.innerText || '';
        return { title, source, snippet };
      }).filter(item => item.title);
    });
    
    console.log(`   ✅ Found ${newsItems.length} recent news mentions\n`);
    return newsItems;
    
  } catch (error) {
    console.log(`   ⚠️  News search failed: ${error.message}\n`);
    return [];
  }
}

// ============================================================================
// PHASE 6: COMPETITOR DEEP DIVE
// ============================================================================

async function deepCompetitorResearch(page, competitors, city, state) {
  console.log('\n🎯 PHASE 6: COMPETITOR DEEP DIVE');
  console.log('   Analyzing each competitor in detail...\n');
  
  const detailedCompetitors = [];
  
  for (const comp of competitors.slice(0, 3)) {
    console.log(`   🔍 Researching: ${comp.name}`);
    
    try {
      // Google search for competitor
      const searchQuery = `${comp.name} ${city} ${state}`;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);
      
      // Extract Google Business data
      const compData = await page.evaluate(() => {
        const ratingEl = document.querySelector('[aria-label*="stars"]');
        const spans = Array.from(document.querySelectorAll('span'));
        const reviewEl = spans.find(s => /\d+\s*reviews?/i.test(s.innerText));
        const websiteEl = document.querySelector('a[href*="http"]:not([href*="google"])');

        return {
          rating: ratingEl ? parseFloat(ratingEl.getAttribute('aria-label') || '0') : 0,
          reviews: reviewEl ? parseInt(reviewEl.innerText.replace(/\D/g, '') || '0') : 0,
          website: websiteEl ? websiteEl.href : null
        };
      });

      // Preserve Places API data if DOM scrape returned 0 reviews
      const finalRating = compData.rating || comp.rating || 0;
      const finalReviews = compData.reviews || comp.reviewCount || comp.reviews || 0;

      detailedCompetitors.push({
        ...comp,
        rating: finalRating,
        reviewCount: finalReviews,
        reviews: finalReviews,
        website: compData.website || comp.website,
        hasGoogleAds: false,
        hasMetaAds: false
      });

      console.log(`      ✅ ${finalRating}⭐ (${finalReviews} reviews)`);
      
    } catch (error) {
      console.log(`      ⚠️  Research failed: ${error.message}`);
      detailedCompetitors.push(comp);
    }
  }
  
  console.log('');
  return detailedCompetitors;
}

// ============================================================================
// PHASE 7: AI SYNTHESIS - EXTRACT EVERYTHING
// ============================================================================

async function synthesizeWithAI(allData) {
  console.log('\n🧠 PHASE 7: AI SYNTHESIS');
  console.log('   Analyzing all collected data with Claude...\n');
  
  // Prepare context
  const context = JSON.stringify({
    websitePages: allData.websitePages.length,
    websiteSample: allData.websitePages.slice(0, 3).map(p => ({ url: p.url, title: p.title, text: p.text.substring(0, 500) })),
    linkedIn: allData.linkedIn,
    attorneys: allData.attorneyLinkedIns,
    googleBusiness: allData.googleBusiness,
    socialMedia: allData.socialMedia,
    news: allData.news,
    competitors: allData.competitors
  }, null, 2);
  
  const prompt = `You are a law firm intelligence analyst. Extract EVERYTHING useful from this data about this law firm.

COMPREHENSIVE ANALYSIS REQUIRED:

1. **FIRM POSITIONING**
   - What's their unique angle?
   - What do they specialize in?
   - How do they position themselves vs competitors?
   - What's their brand voice/tone?

2. **KEY DECISION MAKERS**
   - Who are the partners/decision makers?
   - What are their backgrounds?
   - Any notable credentials or achievements?

3. **PRACTICE AREAS**
   - List ALL practice areas (be exhaustive)
   - Which ones seem to be their main focus?
   - Any niche specializations?

4. **GROWTH SIGNALS**
   - Recent expansions, hires, office openings?
   - New practice areas launched?
   - Awards, rankings, recognition?
   - Increased marketing activity?

5. **PAIN POINTS** (Critical - read between the lines)
   - What are they NOT doing that competitors are?
   - What weaknesses can you infer?
   - What opportunities are they missing?
   - What problems would marketing solve for them?

6. **COMPETITIVE POSITION**
   - How do they compare to competitors on reviews/ratings?
   - Are competitors running ads? Are they?
   - What's their market position?

7. **PERSONALIZATION HOOKS**
   - Specific recent news/wins to reference
   - Unique firm characteristics
   - Partner names and titles for personalization
   - Any notable cases or clients mentioned?

8. **TECH SOPHISTICATION**
   - Modern website or outdated?
   - Active on social media?
   - Using any marketing automation?
   - Mobile-friendly?

Return ONLY valid JSON:
{
  "firmPositioning": "...",
  "uniqueAngle": "...",
  "keyDecisionMakers": [{"name": "...", "title": "...", "background": "..."}],
  "practiceAreas": ["...", "..."],
  "mainFocus": ["...", "..."],
  "nicheSpecializations": ["...", "..."],
  "growthSignals": ["...", "..."],
  "painPoints": ["...", "..."],
  "competitiveAdvantages": ["...", "..."],
  "competitiveWeaknesses": ["...", "..."],
  "personalizationHooks": ["...", "..."],
  "techSophistication": "low/medium/high",
  "marketingMaturity": "low/medium/high",
  "firmSize": "...",
  "estimatedRevenue": "...",
  "idealPitchAngle": "..."
}`;

  const response = await askClaude(prompt, context, 4000);
  
  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const synthesis = JSON.parse(jsonMatch[0]);
    console.log('   ✅ AI synthesis complete\n');
    return synthesis;
  }
  
  console.log('   ⚠️  AI synthesis failed to return valid JSON\n');
  return null;
}

// ============================================================================
// MAIN RESEARCH ORCHESTRATOR
// ============================================================================

async function maximalResearch(firmWebsite, contactName, city, state, country, company) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 MAXIMAL RESEARCH ENGINE V2');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n🎯 Target: ${company || firmWebsite}`);
  console.log(`👤 Contact: ${contactName}`);
  console.log(`📍 Location: ${city}, ${state}, ${country}\n`);
  
  const startTime = Date.now();
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();
  
  const research = {
    firmName: company || '',
    website: firmWebsite,
    contactPerson: contactName,
    location: { city, state, country },
    
    // Raw scraped data
    websitePages: [],
    linkedIn: null,
    attorneyLinkedIns: [],
    googleBusiness: {},
    socialMedia: {},
    news: [],
    competitors: [],

    // Ads data (Google + Meta)
    adsData: {
      googleAds: { running: false, adCount: 0 },
      metaAds: { hasActiveAds: false, activeCount: 0, hasInactiveAds: false, inactiveCount: 0 },
      summary: { runningGoogleAds: false, runningMetaAds: false, anyAdsRunning: false }
    },

    // AI-synthesized intelligence
    intelligence: null,
    
    // Timestamps
    researchedAt: new Date().toISOString(),
    researchDuration: 0
  };
  
  try {
    // Phase 1: Scrape entire website
    research.websitePages = await scrapeEntireWebsite(page, firmWebsite);
    
    // Phase 1.5: INTELLIGENT EXTRACTION - Let Claude extract EVERYTHING
    const { extractEverything } = require('./extract-firm-info');
    const extractedData = await extractEverything(research.websitePages, firmWebsite, anthropic);
    
    // Merge extracted data into research
    // WEBHOOK DATA TAKES PRIORITY for core fields - the lead database is more reliable
    // than AI extraction from website scraping. AI extraction supplements with details.
    let bestFirmName;
    if (company && company.trim()) {
      // Webhook provided a company name - always use it
      bestFirmName = company.trim();
      if (extractedData.firmName && extractedData.firmName !== bestFirmName) {
        console.log(`ℹ️  Using webhook company name "${bestFirmName}" (AI extracted: "${extractedData.firmName}")`);
      }
    } else {
      // No webhook company name - fall back to AI extraction
      bestFirmName = extractedData.firmName || '';
      if (bestFirmName) {
        // Still check for domain slug garbling
        const extractedLower = bestFirmName.toLowerCase().replace(/\s+/g, '');
        const domainSlug = new URL(firmWebsite).hostname.replace(/^www\./, '').split('.')[0].toLowerCase();
        if ((extractedLower.includes(domainSlug) && !bestFirmName.includes(' ')) || extractedLower === domainSlug + 'law') {
          console.log(`⚠️  Extracted firm name "${bestFirmName}" looks like domain slug, no webhook fallback available`);
        }
      }
    }
    research.firmName = bestFirmName;
    // Update local city/state so ALL subsequent phases use the best available data.
    // Without this, competitor search and Google Business use empty webhook values.
    city = city || extractedData.city || '';
    state = state || extractedData.state || '';
    if (extractedData.city && !city) {
      console.log(`📍 Extracted city from website: ${extractedData.city}`);
    }
    research.location = {
      city,
      state,
      country: country,
      fullAddress: extractedData.fullAddress,
      otherLocations: extractedData.otherLocations || []
    };
    research.contact = {
      phone: extractedData.phone,
      email: extractedData.email,
      hoursOfOperation: extractedData.hoursOfOperation,
      afterHoursAvailable: extractedData.afterHoursAvailable,
      freeConsultation: extractedData.freeConsultation
    };
    research.firmDetails = {
      foundedYear: extractedData.foundedYear,
      firmSize: extractedData.firmSize,
      officeCount: extractedData.officeCount,
      yearsInBusiness: extractedData.yearsInBusiness
    };
    research.team = {
      foundingPartners: extractedData.foundingPartners || [],
      keyAttorneys: extractedData.keyAttorneys || [],
      leadership: extractedData.leadership
    };
    research.practice = {
      practiceAreas: extractedData.practiceAreas || [],
      practiceAreaCategory: extractedData.practiceAreaCategory || null,
      primaryFocus: extractedData.primaryFocus,
      nicheSpecializations: extractedData.nicheSpecializations || [],
      targetMarket: extractedData.targetMarket,
      serviceArea: extractedData.serviceArea
    };
    // Also store at top level for easy access in report generator
    research.practiceAreaCategory = extractedData.practiceAreaCategory || null;
    research.credibility = {
      awards: extractedData.awards || [],
      barAssociations: extractedData.barAssociations || [],
      notableCases: extractedData.notableCases || [],
      clientTestimonials: extractedData.clientTestimonials || []
    };
    research.marketing = {
      websiteModernization: extractedData.websiteModernization,
      hasLiveChat: extractedData.hasLiveChat,
      hasBlog: extractedData.hasBlog,
      blogLastPosted: extractedData.blogLastPosted,
      socialMediaPresence: extractedData.socialMediaPresence || {},
      videoContent: extractedData.videoContent,
      languagesOffered: extractedData.languagesOffered || []
    };
    research.positioning = {
      uniqueSellingPoints: extractedData.uniqueSellingPoints || [],
      guarantees: extractedData.guarantees,
      pricing: extractedData.pricing,
      firmPersonality: extractedData.firmPersonality,
      missionStatement: extractedData.missionStatement,
      firmStory: extractedData.firmStory
    };
    research.insights = {
      growthIndicators: extractedData.growthIndicators || [],
      recentNews: extractedData.recentNews,
      communityInvolvement: extractedData.communityInvolvement,
      otherInsights: extractedData.otherInsights || []
    };
    
    const effectiveFirmName = research.firmName;
    console.log(`\n✨ Intelligent extraction complete for: ${effectiveFirmName}\n`);
    
    // Phase 2: LinkedIn (firm + attorneys)
    research.linkedIn = await scrapeFirmLinkedIn(page, effectiveFirmName);
    
    // Extract attorney names from website first
    const attorneyNames = research.websitePages
      .flatMap(p => {
        // Simple extraction - can be improved with AI
        const matches = p.text.match(/([A-Z][a-z]+ [A-Z][a-z]+),? (Partner|Associate|Attorney|Counsel)/gi);
        return matches || [];
      })
      .slice(0, 5)
      .map(m => {
        const parts = m.split(',');
        return { name: parts[0].trim(), title: parts[1]?.trim() || 'Attorney' };
      });
    
    research.attorneyLinkedIns = await scrapeAttorneyLinkedIns(page, effectiveFirmName, attorneyNames);
    
    // Phase 3: Google My Business
    research.googleBusiness = await scrapeGoogleBusiness(page, effectiveFirmName, city, state, country);
    
    // Phase 4: Social media
    research.socialMedia = await scrapeSocialMedia(page, effectiveFirmName, firmWebsite);
    
    // Phase 5: Recent news
    research.news = await scrapeRecentNews(page, effectiveFirmName);
    
    // Phase 6: Competitor research (needs competitors first)
    // Use extracted practice areas for accurate competitor search
    const aiHelper = require('./ai-research-helper');
    const practiceAreasForSearch = research.practice?.practiceAreas?.length > 0
      ? research.practice.practiceAreas
      : (extractedData.practiceAreas?.length > 0 ? extractedData.practiceAreas : ['lawyer']);
    console.log(`   🔍 Searching competitors for: ${practiceAreasForSearch[0]}`);
    const basicCompetitors = await aiHelper.findCompetitors(effectiveFirmName, city, state, practiceAreasForSearch, country);
    research.competitors = await deepCompetitorResearch(page, basicCompetitors, city, state);

    // Phase 6.5: Competitor Ads Detection via website tracking scripts
    console.log('\n📢 PHASE 6.5: COMPETITOR ADS DETECTION');
    try {
      const { detectGoogleAds } = require('./ads-detector');
      const adChecks = research.competitors.map(async (comp) => {
        // Pass the full website URL (detectGoogleAds handles both URLs and domains)
        const result = await detectGoogleAds(browser, comp.name, comp.website || '');
        comp.hasGoogleAds = result.running && result.adCount > 0;
        if (comp.hasGoogleAds) {
          console.log(`   📢 ${comp.name}: Running Google Ads`);
        } else {
          console.log(`   ❌ ${comp.name}: No Google Ads detected`);
        }
      });
      await Promise.all(adChecks);
    } catch (err) {
      console.log(`   ⚠️  Competitor ads check failed: ${err.message}`);
    }

    // Phase 7: Ads Detection (Google + Meta)
    console.log(`\n📱 PHASE 7: ADS DETECTION`);
    try {
      const { detectAdsWithBrowser } = require('./ads-detector');
      research.adsData = await detectAdsWithBrowser(browser, effectiveFirmName, firmWebsite, country);
      research.adsData.detectionSucceeded = true;
      console.log(`   📊 Google Ads: ${research.adsData.summary.runningGoogleAds ? `Running (${research.adsData.googleAds.adCount} ads)` : 'Not detected'}`);
      console.log(`   📊 Meta Ads: ${research.adsData.summary.runningMetaAds ? `Running (${research.adsData.metaAds.activeCount} active)` : 'Not detected'}`);
    } catch (adsError) {
      console.log(`   ⚠️  Ads detection failed: ${adsError.message}`);
      // Mark as failed so downstream knows this is "unknown" not "confirmed no ads"
      research.adsData.detectionSucceeded = false;
      research.adsData.detectionError = adsError.message;
    }

    // Phase 8: AI Synthesis
    research.intelligence = await synthesizeWithAI(research);
    
  } catch (error) {
    console.error(`\n❌ Research error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  research.researchDuration = duration;
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ RESEARCH COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n⏱️  Duration: ${duration}s`);
  console.log(`📄 Website pages: ${research.websitePages.length}`);
  console.log(`👥 Attorney profiles: ${research.attorneyLinkedIns.length}`);
  console.log(`⭐ Google rating: ${research.googleBusiness.rating}⭐ (${research.googleBusiness.reviews} reviews)`);
  console.log(`📱 Social profiles: ${Object.values(research.socialMedia).filter(v => v).length}`);
  console.log(`📰 News mentions: ${research.news.length}`);
  console.log(`🎯 Competitors analyzed: ${research.competitors.length}`);
  console.log(`📢 Google Ads: ${research.adsData?.summary?.runningGoogleAds ? `Running (${research.adsData.googleAds?.adCount || 0})` : 'Not running'}`);
  console.log(`📢 Meta Ads: ${research.adsData?.summary?.runningMetaAds ? `Running (${research.adsData.metaAds?.activeCount || 0})` : 'Not running'}\n`);
  
  // Save to file - use extracted firm name, fallback to company, then domain
  const slugSource = research.firmName || company || new URL(firmWebsite).hostname.replace(/^www\./, '').split('.')[0];
  const slug = slugSource.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() || 'unknown-firm';
  const outputPath = path.join(__dirname, 'reports', `${slug}-maximal-research.json`);
  
  if (!fs.existsSync(path.join(__dirname, 'reports'))) {
    fs.mkdirSync(path.join(__dirname, 'reports'), { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(research, null, 2));
  console.log(`💾 Saved: ${outputPath}\n`);
  
  return research;
}

// CLI mode
if (require.main === module) {
  const firmWebsite = process.argv[2];
  const contactName = process.argv[3] || 'Partner';
  const city = process.argv[4] || '';
  const state = process.argv[5] || '';
  const country = process.argv[6] || 'US';
  const company = process.argv[7] || '';
  
  if (!firmWebsite) {
    console.error('Usage: node maximal-research-v2.js <website> [contactName] [city] [state] [country] [company]');
    process.exit(1);
  }
  
  maximalResearch(firmWebsite, contactName, city, state, country, company)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { maximalResearch };
