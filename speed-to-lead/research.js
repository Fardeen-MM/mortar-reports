#!/usr/bin/env node
/**
 * RESEARCH SCRIPT
 * Scrapes law firm website + Google for data needed in the report
 */

const { chromium } = require('playwright');

async function researchFirm(firmWebsite) {
  console.log(`🔍 Starting research on: ${firmWebsite}`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const research = {
    firmName: '',
    website: firmWebsite,
    location: { city: '', state: '' },
    practiceAreas: [],
    credentials: [],
    awards: [],
    attorneys: [],
    hasGoogleAds: false,
    hasMetaAds: false,
    competitors: [],
    googleBusinessProfile: null,
    reviewCount: 0,
    rating: 0,
    pageSpeed: 'Unknown',
    researchedAt: new Date().toISOString()
  };

  try {
    // Step 1: Visit the firm website
    console.log('📄 Loading firm website...');
    await page.goto(firmWebsite, { waitUntil: 'networkidle', timeout: 15000 });
    
    // Extract firm name (usually in title or H1)
    const title = await page.title();
    research.firmName = title.split('|')[0].trim() || title.split('-')[0].trim();
    
    // Try to find firm name in H1
    const h1Text = await page.locator('h1').first().textContent().catch(() => '');
    if (h1Text && h1Text.length < 50) {
      research.firmName = h1Text.trim();
    }
    
    console.log(`✅ Firm Name: ${research.firmName}`);
    
    // Extract location from footer, contact page, or address tags
    const bodyText = await page.textContent('body');
    const locationRegex = /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})/g;
    const locationMatches = [...bodyText.matchAll(locationRegex)];
    if (locationMatches.length > 0) {
      research.location.city = locationMatches[0][1];
      research.location.state = locationMatches[0][2];
      console.log(`📍 Location: ${research.location.city}, ${research.location.state}`);
    }
    
    // Extract practice areas (common keywords)
    const practiceKeywords = [
      'estate planning', 'immigration', 'family law', 'personal injury',
      'criminal defense', 'business law', 'real estate', 'bankruptcy',
      'employment law', 'civil litigation', 'probate', 'elder law',
      'divorce', 'custody', 'DUI', 'workers compensation'
    ];
    
    const foundPracticeAreas = practiceKeywords.filter(keyword => 
      bodyText.toLowerCase().includes(keyword)
    );
    research.practiceAreas = [...new Set(foundPracticeAreas)];
    console.log(`⚖️  Practice Areas: ${research.practiceAreas.join(', ')}`);
    
    // Extract credentials/awards
    const credentialKeywords = [
      'super lawyers', 'best lawyers', 'avvo', 'martindale',
      'harvard', 'yale', 'stanford', 'columbia',
      'board certified', 'top rated', 'award', 'recognition'
    ];
    
    const foundCredentials = [];
    for (const keyword of credentialKeywords) {
      if (bodyText.toLowerCase().includes(keyword)) {
        foundCredentials.push(keyword);
      }
    }
    research.credentials = [...new Set(foundCredentials)];
    console.log(`🏆 Credentials Found: ${research.credentials.join(', ')}`);
    
    // Check page speed (rough estimate based on load time)
    const startTime = Date.now();
    await page.reload();
    const loadTime = Date.now() - startTime;
    research.pageSpeed = loadTime < 2000 ? 'Fast' : loadTime < 4000 ? 'Medium' : 'Slow';
    console.log(`⚡ Page Speed: ${research.pageSpeed} (${loadTime}ms)`);
    
    // Step 2: Check if they're running Google Ads
    console.log('🔍 Checking for Google Ads...');
    const searchQuery = `${research.practiceAreas[0] || 'attorney'} ${research.location.city || research.location.state}`;
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    const hasAds = await page.locator('div[data-text-ad]').count() > 0;
    research.hasGoogleAds = hasAds;
    console.log(`💰 Google Ads: ${hasAds ? 'Yes' : 'No'}`);
    
    // Extract competitors (firms showing up in search results)
    const searchResults = await page.locator('h3').allTextContents();
    research.competitors = searchResults
      .slice(0, 5)
      .filter(text => text.length > 0 && text.length < 100)
      .map(text => text.split('|')[0].split('-')[0].trim());
    console.log(`🏢 Competitors: ${research.competitors.slice(0, 3).join(', ')}`);
    
    // Step 3: Check Facebook Ad Library
    console.log('📱 Checking Meta Ads...');
    const fbSearchQuery = research.firmName.replace(/\s+/g, '+');
    await page.goto(`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=${fbSearchQuery}`, { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const noResults = await page.getByText('No results found').count() > 0;
    research.hasMetaAds = !noResults;
    console.log(`📘 Meta Ads: ${research.hasMetaAds ? 'Yes' : 'No'}`);
    
  } catch (error) {
    console.error('❌ Error during research:', error.message);
  } finally {
    await browser.close();
  }
  
  console.log('\n✅ Research complete!\n');
  return research;
}

// If run directly (not imported)
if (require.main === module) {
  const firmWebsite = process.argv[2];
  
  if (!firmWebsite) {
    console.error('Usage: node research.js <firm-website-url>');
    process.exit(1);
  }
  
  researchFirm(firmWebsite).then(data => {
    console.log('\n📊 RESEARCH RESULTS:\n');
    console.log(JSON.stringify(data, null, 2));
    
    // Save to file
    const fs = require('fs');
    const path = require('path');
    const firmSlug = data.firmName.replace(/\s+/g, '-').toLowerCase();
    const filename = path.resolve(__dirname, `reports/${firmSlug}-research.json`);
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`\n💾 Saved to: ${filename}`);
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { researchFirm };
