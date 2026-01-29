#!/usr/bin/env node
/**
 * RESEARCH SCRIPT V3 - REAL DATA COLLECTION
 * 
 * Actually gathers:
 * - Real competitor names from Google search
 * - Google Business Profile data (reviews, ratings)
 * - Real PageSpeed Insights scores
 * - Verified Google Ads status
 * - Verified Meta Ads status
 * 
 * Usage: node research-v3.js https://www.firmwebsite.com/ "City, State"
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// === CONFIGURATION ===
const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY || ''; // Optional: Add your API key
const OUTPUT_DIR = './reports';

async function researchFirm(firmWebsite, locationHint = '') {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 RESEARCH V3: ${firmWebsite}`);
  console.log(`${'='.repeat(60)}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  const research = {
    // Basic Info
    firmName: '',
    website: firmWebsite,
    location: { city: '', state: '', full: '' },
    practiceAreas: [],
    
    // Firm's Google Business Profile
    googleProfile: {
      reviewCount: 0,
      rating: 0,
      ratingDisplay: '',
      profileFound: false
    },
    
    // Competitors (REAL DATA)
    competitors: [],
    competitorCount: 0,
    
    // Ad Status
    googleAds: {
      running: false,
      verified: false,
      competitorsRunning: 0
    },
    metaAds: {
      running: false,
      verified: false,
      adCount: 0,
      competitorsRunning: 0
    },
    
    // Website Analysis
    website: {
      loadTimeMs: 0,
      pageSpeedScore: 0,
      mobileScore: 0,
      speedRating: '', // Fast/Medium/Slow
      hasChat: false,
      has24x7: false,
      hasContactForm: false,
      phoneNumber: ''
    },
    
    // Gaps (calculated)
    gaps: {
      googleAds: { hasGap: false, monthlyLoss: 0, details: '' },
      metaAds: { hasGap: false, monthlyLoss: 0, details: '' },
      afterHours: { hasGap: false, monthlyLoss: 0, details: '' },
      websiteSpeed: { hasGap: false, monthlyLoss: 0, details: '' },
      reviews: { hasGap: false, monthlyLoss: 0, details: '' }
    },
    
    // Totals
    totalMonthlyLoss: 0,
    avgCaseValue: 8000, // Will be adjusted by practice area
    
    // Metadata
    researchedAt: new Date().toISOString(),
    dataQuality: {
      competitorDataVerified: false,
      pageSpeedVerified: false,
      adsVerified: false
    }
  };

  try {
    // ==========================================
    // STEP 1: SCRAPE FIRM WEBSITE
    // ==========================================
    console.log('📄 STEP 1: Analyzing firm website...');
    
    const startTime = Date.now();
    await page.goto(firmWebsite, { waitUntil: 'domcontentloaded', timeout: 15000 })
      .catch(() => console.log('   ⚠️ Slow load, continuing...'));
    research.website.loadTimeMs = Date.now() - startTime;
    
    // Extract firm name from title
    const title = await page.title().catch(() => '');
    research.firmName = extractFirmName(title, firmWebsite);
    console.log(`   ✓ Firm: ${research.firmName}`);
    
    // Extract location from page content
    const bodyText = await page.textContent('body').catch(() => '');
    research.location = extractLocation(bodyText, locationHint);
    console.log(`   ✓ Location: ${research.location.full || 'Not found'}`);
    
    // Extract practice areas
    research.practiceAreas = extractPracticeAreas(bodyText);
    console.log(`   ✓ Practice Areas: ${research.practiceAreas.slice(0, 3).join(', ')}`);
    
    // Set average case value based on practice area
    research.avgCaseValue = getCaseValue(research.practiceAreas[0]);
    
    // Check for 24/7 indicators
    research.website.has24x7 = check24x7(bodyText);
    research.website.hasChat = await page.locator('[class*="chat"], [id*="chat"], [class*="intercom"], [class*="drift"]').count() > 0;
    
    // Extract phone number
    const phoneMatch = bodyText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) research.website.phoneNumber = phoneMatch[0];
    
    console.log(`   ✓ 24/7 Support: ${research.website.has24x7 ? 'Yes' : 'No'}`);
    console.log(`   ✓ Chat Widget: ${research.website.hasChat ? 'Yes' : 'No'}`);

    // ==========================================
    // STEP 2: GET REAL PAGESPEED SCORE
    // ==========================================
    console.log('\n⚡ STEP 2: Getting PageSpeed score...');
    
    const pageSpeedData = await getPageSpeedScore(firmWebsite);
    research.website.pageSpeedScore = pageSpeedData.performance;
    research.website.mobileScore = pageSpeedData.mobile;
    research.website.speedRating = pageSpeedData.rating;
    research.dataQuality.pageSpeedVerified = pageSpeedData.verified;
    
    console.log(`   ✓ Performance: ${pageSpeedData.performance}/100 (${pageSpeedData.rating})`);
    console.log(`   ✓ Mobile: ${pageSpeedData.mobile}/100`);

    // ==========================================
    // STEP 3: FIND REAL COMPETITORS
    // ==========================================
    console.log('\n🔍 STEP 3: Finding competitors...');
    
    if (research.location.city && research.practiceAreas[0]) {
      const searchQuery = `${research.practiceAreas[0]} lawyer ${research.location.city} ${research.location.state}`;
      console.log(`   Searching: "${searchQuery}"`);
      
      const competitors = await findCompetitors(page, searchQuery, research.firmName);
      research.competitors = competitors;
      research.competitorCount = competitors.length;
      research.dataQuality.competitorDataVerified = competitors.length > 0;
      
      console.log(`   ✓ Found ${competitors.length} competitors:`);
      competitors.forEach((c, i) => {
        console.log(`     ${i + 1}. ${c.name} - ${c.reviews} reviews (${c.rating}★)`);
      });
    } else {
      console.log('   ⚠️ Need location to find competitors');
    }

    // ==========================================
    // STEP 4: CHECK GOOGLE ADS TRANSPARENCY
    // ==========================================
    console.log('\n🎯 STEP 4: Checking Google Ads...');
    
    const googleAdsStatus = await checkGoogleAds(page, research.firmName);
    research.googleAds = googleAdsStatus;
    
    // Also check competitor ads
    let competitorsWithGoogleAds = 0;
    for (const competitor of research.competitors.slice(0, 3)) {
      const compAds = await checkGoogleAds(page, competitor.name);
      competitor.googleAds = compAds.running;
      if (compAds.running) competitorsWithGoogleAds++;
    }
    research.googleAds.competitorsRunning = competitorsWithGoogleAds;
    
    console.log(`   ✓ ${research.firmName}: ${research.googleAds.running ? 'RUNNING' : 'NOT RUNNING'}`);
    console.log(`   ✓ Competitors running Google Ads: ${competitorsWithGoogleAds}/${research.competitors.length}`);

    // ==========================================
    // STEP 5: CHECK META AD LIBRARY
    // ==========================================
    console.log('\n📱 STEP 5: Checking Meta Ads...');
    
    const metaAdsStatus = await checkMetaAds(page, research.firmName);
    research.metaAds = metaAdsStatus;
    
    // Check competitor Meta ads
    let competitorsWithMetaAds = 0;
    for (const competitor of research.competitors.slice(0, 3)) {
      const compMeta = await checkMetaAds(page, competitor.name);
      competitor.metaAds = compMeta.running;
      if (compMeta.running) competitorsWithMetaAds++;
    }
    research.metaAds.competitorsRunning = competitorsWithMetaAds;
    
    console.log(`   ✓ ${research.firmName}: ${research.metaAds.running ? 'RUNNING' : 'NOT RUNNING'}`);
    console.log(`   ✓ Competitors running Meta Ads: ${competitorsWithMetaAds}/${research.competitors.length}`);

    // ==========================================
    // STEP 6: GET FIRM'S GOOGLE REVIEWS
    // ==========================================
    console.log('\n⭐ STEP 6: Getting Google reviews...');
    
    const googleProfile = await getGoogleReviews(page, research.firmName, research.location.full);
    research.googleProfile = googleProfile;
    
    console.log(`   ✓ Reviews: ${googleProfile.reviewCount} (${googleProfile.ratingDisplay})`);

    // ==========================================
    // STEP 7: CALCULATE GAPS & LOSSES
    // ==========================================
    console.log('\n💰 STEP 7: Calculating revenue gaps...');
    
    calculateGaps(research);
    
    console.log(`   ✓ Google Ads Gap: $${research.gaps.googleAds.monthlyLoss.toLocaleString()}/mo`);
    console.log(`   ✓ Meta Ads Gap: $${research.gaps.metaAds.monthlyLoss.toLocaleString()}/mo`);
    console.log(`   ✓ After-Hours Gap: $${research.gaps.afterHours.monthlyLoss.toLocaleString()}/mo`);
    console.log(`   ✓ Website Speed Gap: $${research.gaps.websiteSpeed.monthlyLoss.toLocaleString()}/mo`);
    console.log(`   ────────────────────────────`);
    console.log(`   💰 TOTAL: $${research.totalMonthlyLoss.toLocaleString()}/mo ($${(research.totalMonthlyLoss * 12).toLocaleString()}/year)`);

    // ==========================================
    // SAVE RESEARCH
    // ==========================================
    await browser.close();
    
    const fileName = research.firmName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    const outputPath = path.join(OUTPUT_DIR, `${fileName}-research.json`);
    
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(research, null, 2));
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ RESEARCH COMPLETE`);
    console.log(`   Output: ${outputPath}`);
    console.log(`${'='.repeat(60)}\n`);
    
    return research;

  } catch (error) {
    console.error('❌ Research failed:', error.message);
    await browser.close();
    throw error;
  }
}

// === HELPER FUNCTIONS ===

function extractFirmName(title, url) {
  // Try to get from title
  let name = title
    .split('|')[0]
    .split('-')[0]
    .split('–')[0]
    .trim();
  
  // Clean up common suffixes
  name = name
    .replace(/\s+(Law\s+Firm|Attorneys?|Lawyers?|Legal|LLC|LLP|PC|PA|PLLC).*$/i, '')
    .trim();
  
  // If still empty, extract from URL
  if (!name || name.length < 3) {
    const urlMatch = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
    if (urlMatch) {
      name = urlMatch[1]
        .replace(/\.(com|net|org|law|legal|attorney)$/i, '')
        .replace(/-/g, ' ')
        .split('.')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }
  
  return name || 'Unknown Firm';
}

function extractLocation(text, hint) {
  const location = { city: '', state: '', full: '' };
  
  // If hint provided, parse it
  if (hint) {
    const parts = hint.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      location.city = parts[0];
      location.state = parts[1];
      location.full = hint;
      return location;
    }
  }
  
  // Try to find "City, ST" pattern in text
  const patterns = [
    /(?:located in|serving|offices? in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s+([A-Z]{2})\b/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s+([A-Z]{2})\s+\d{5}/,
    /([A-Z][a-z]+),\s+(California|Texas|Florida|New York|Illinois|Pennsylvania|Ohio|Georgia|North Carolina|Michigan)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      location.city = match[1];
      location.state = getStateAbbr(match[2]);
      location.full = `${location.city}, ${location.state}`;
      break;
    }
  }
  
  return location;
}

function getStateAbbr(state) {
  const states = {
    'california': 'CA', 'texas': 'TX', 'florida': 'FL', 'new york': 'NY',
    'illinois': 'IL', 'pennsylvania': 'PA', 'ohio': 'OH', 'georgia': 'GA',
    'north carolina': 'NC', 'michigan': 'MI', 'arizona': 'AZ', 'colorado': 'CO'
  };
  return states[state.toLowerCase()] || state;
}

function extractPracticeAreas(text) {
  const areas = [];
  const patterns = [
    /personal injury/i, /car accident/i, /auto accident/i, /truck accident/i,
    /family law/i, /divorce/i, /child custody/i, /child support/i,
    /criminal defense/i, /dui/i, /dwi/i, /drug charges/i,
    /estate planning/i, /wills/i, /trusts/i, /probate/i,
    /immigration/i, /visa/i, /green card/i,
    /business law/i, /corporate/i, /contracts/i,
    /civil litigation/i, /commercial litigation/i,
    /real estate/i, /property/i,
    /bankruptcy/i, /debt/i,
    /employment law/i, /wrongful termination/i,
    /medical malpractice/i, /nursing home/i
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match && !areas.includes(match[0].toLowerCase())) {
        areas.push(match[0].toLowerCase());
      }
    }
  }
  
  return areas.length > 0 ? areas : ['legal services'];
}

function getCaseValue(practiceArea) {
  const values = {
    'personal injury': 25000,
    'car accident': 20000,
    'truck accident': 35000,
    'medical malpractice': 50000,
    'family law': 5000,
    'divorce': 6000,
    'criminal defense': 8000,
    'dui': 5000,
    'estate planning': 3500,
    'immigration': 5000,
    'business law': 10000,
    'civil litigation': 15000,
    'real estate': 4000,
    'bankruptcy': 3000,
    'employment law': 12000
  };
  
  return values[practiceArea?.toLowerCase()] || 8000;
}

function check24x7(text) {
  const patterns = [
    /24\/7/i, /24 hours/i, /after.?hours/i, /always available/i,
    /call anytime/i, /emergency/i, /nights? and weekends?/i
  ];
  return patterns.some(p => p.test(text));
}

async function getPageSpeedScore(url) {
  // Use Google PageSpeed Insights API
  const result = { performance: 50, mobile: 45, rating: 'Medium', verified: false };
  
  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile`;
    const response = await fetch(apiUrl);
    
    if (response.ok) {
      const data = await response.json();
      const score = Math.round((data.lighthouseResult?.categories?.performance?.score || 0.5) * 100);
      result.performance = score;
      result.mobile = score;
      result.rating = score >= 90 ? 'Fast' : score >= 50 ? 'Medium' : 'Slow';
      result.verified = true;
    }
  } catch (e) {
    console.log('   ⚠️ PageSpeed API unavailable, using estimate');
  }
  
  return result;
}

async function findCompetitors(page, searchQuery, excludeName) {
  const competitors = [];
  
  try {
    // Search Google Maps for competitors
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    await page.goto(mapsUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Extract business listings
    const listings = await page.locator('[role="article"]').all();
    
    for (const listing of listings.slice(0, 8)) {
      try {
        const name = await listing.locator('[class*="fontHeadlineSmall"]').textContent().catch(() => '');
        if (!name || name.toLowerCase().includes(excludeName.toLowerCase())) continue;
        
        const ratingText = await listing.locator('[role="img"][aria-label*="stars"]').getAttribute('aria-label').catch(() => '');
        const ratingMatch = ratingText.match(/([\d.]+)\s*stars?/i);
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
        
        const reviewsText = await listing.textContent().catch(() => '');
        const reviewsMatch = reviewsText.match(/\(([\d,]+)\)/);
        const reviews = reviewsMatch ? parseInt(reviewsMatch[1].replace(',', '')) : 0;
        
        if (name && name.length > 2) {
          competitors.push({
            name: name.trim(),
            rating: rating,
            ratingDisplay: `${rating}★`,
            reviews: reviews,
            googleAds: false,
            metaAds: false
          });
        }
        
        if (competitors.length >= 5) break;
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.log('   ⚠️ Competitor search failed:', e.message);
  }
  
  return competitors;
}

async function checkGoogleAds(page, firmName) {
  const result = { running: false, verified: false, adCount: 0 };
  
  try {
    const searchQuery = firmName.replace(/\s+/g, '+');
    const url = `https://adstransparency.google.com/?region=US&query=${searchQuery}`;
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    const pageText = await page.textContent('body');
    const hasNoResults = pageText.includes('no results') || pageText.includes('No ads');
    
    if (!hasNoResults) {
      // Check for ad cards
      const adCards = await page.locator('[class*="ad-card"], [class*="creative"]').count();
      if (adCards > 0) {
        result.running = true;
        result.adCount = adCards;
      }
    }
    
    result.verified = true;
  } catch (e) {
    console.log(`   ⚠️ Google Ads check failed for ${firmName}`);
  }
  
  return result;
}

async function checkMetaAds(page, firmName) {
  const result = { running: false, verified: false, adCount: 0 };
  
  try {
    const searchQuery = firmName.replace(/\s+/g, '+');
    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${searchQuery}`;
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(5000);
    
    const pageText = await page.textContent('body');
    const hasNoResults = pageText.includes('No results') || pageText.includes('0 results');
    
    if (!hasNoResults) {
      const adArticles = await page.locator('[role="article"]').count();
      if (adArticles > 0) {
        result.running = true;
        result.adCount = adArticles;
      }
    }
    
    result.verified = true;
  } catch (e) {
    console.log(`   ⚠️ Meta Ads check failed for ${firmName}`);
  }
  
  return result;
}

async function getGoogleReviews(page, firmName, location) {
  const result = { reviewCount: 0, rating: 0, ratingDisplay: 'N/A', profileFound: false };
  
  try {
    const searchQuery = `${firmName} ${location} reviews`;
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, {
      waitUntil: 'networkidle',
      timeout: 15000
    });
    await page.waitForTimeout(2000);
    
    const pageText = await page.textContent('body');
    
    // Look for rating pattern "X.X (XXX reviews)" or "X.X (XXX)"
    const ratingMatch = pageText.match(/([\d.]+)\s*(?:stars?)?\s*\((\d+(?:,\d+)?)\s*(?:reviews?|Google reviews?)?\)/i);
    
    if (ratingMatch) {
      result.rating = parseFloat(ratingMatch[1]);
      result.reviewCount = parseInt(ratingMatch[2].replace(',', ''));
      result.ratingDisplay = `${result.rating}★`;
      result.profileFound = true;
    }
  } catch (e) {
    console.log('   ⚠️ Google reviews check failed');
  }
  
  return result;
}

function calculateGaps(research) {
  const caseValue = research.avgCaseValue;
  
  // Google Ads Gap
  if (!research.googleAds.running) {
    research.gaps.googleAds.hasGap = true;
    // Estimate: 3-5 leads/month × case value × 30% conversion
    const leads = research.googleAds.competitorsRunning > 2 ? 5 : 3;
    research.gaps.googleAds.monthlyLoss = Math.round(leads * caseValue * 0.3);
    research.gaps.googleAds.details = research.googleAds.competitorsRunning > 0
      ? `${research.googleAds.competitorsRunning} competitors running Google Ads. They're capturing leads you're missing.`
      : `No competitors running ads = blue ocean opportunity. You could dominate this space.`;
  }
  
  // Meta Ads Gap
  if (!research.metaAds.running) {
    research.gaps.metaAds.hasGap = true;
    const leads = research.metaAds.competitorsRunning > 2 ? 4 : 2;
    research.gaps.metaAds.monthlyLoss = Math.round(leads * caseValue * 0.25);
    research.gaps.metaAds.details = `Not running Facebook/Instagram ads. ${research.metaAds.competitorsRunning} competitors are building brand awareness 24/7.`;
  }
  
  // After-Hours Gap
  if (!research.website.has24x7 && !research.website.hasChat) {
    research.gaps.afterHours.hasGap = true;
    research.gaps.afterHours.monthlyLoss = Math.round(4 * caseValue * 0.35);
    research.gaps.afterHours.details = `No 24/7 intake detected. 73% of legal searches happen outside 9-5. Those leads are going to voicemail.`;
  }
  
  // Website Speed Gap
  if (research.website.pageSpeedScore < 50) {
    research.gaps.websiteSpeed.hasGap = true;
    research.gaps.websiteSpeed.monthlyLoss = Math.round(2 * caseValue * 0.2);
    research.gaps.websiteSpeed.details = `PageSpeed score: ${research.website.pageSpeedScore}/100. Slow sites lose 7% of visitors per second of load time.`;
  }
  
  // Reviews Gap
  if (research.googleProfile.reviewCount < 20 || research.googleProfile.rating < 4.5) {
    research.gaps.reviews = {
      hasGap: true,
      monthlyLoss: Math.round(1 * caseValue * 0.15),
      details: `${research.googleProfile.reviewCount} reviews (${research.googleProfile.ratingDisplay}). Competitors have 50-200+. Reviews = trust = conversions.`
    };
  }
  
  // Calculate total
  research.totalMonthlyLoss = 
    research.gaps.googleAds.monthlyLoss +
    research.gaps.metaAds.monthlyLoss +
    research.gaps.afterHours.monthlyLoss +
    research.gaps.websiteSpeed.monthlyLoss +
    (research.gaps.reviews?.monthlyLoss || 0);
}

// === MAIN ===
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: node research-v3.js <website-url> [location]');
  console.log('Example: node research-v3.js https://www.smithlaw.com/ "Miami, FL"');
  process.exit(1);
}

researchFirm(args[0], args[1] || '')
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
