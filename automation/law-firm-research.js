#!/usr/bin/env node
/**
 * RESEARCH V5 - FIRM INTELLIGENCE (AI-FIRST)
 * 
 * Philosophy: Get enough intel to write a killer personalized email
 * - Firm positioning & specialties
 * - Size & growth signals
 * - Pain points & opportunities
 * - Recent news/wins
 * - 2-3 attorney names for personalization
 * 
 * Speed-to-lead focused: Fast, contextual, actionable
 */

require('dotenv').config();
const { chromium } = require('playwright');
const aiHelper = require('./ai-research-helper');
const fs = require('fs');
const path = require('path');

async function firmIntelligence(firmWebsite, contactName = '', city = '', state = '', country = 'US', company = '') {
  console.log(`\n🎯 FIRM INTELLIGENCE RESEARCH (AI-FIRST)`);
  console.log(`🌐 Website: ${firmWebsite}`);
  console.log(`👤 Contact: ${contactName}`);
  if (company) console.log(`🏢 Company: ${company}`);
  if (city) console.log(`📍 Location: ${city}, ${state}, ${country}\n`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true  // Ignore SSL cert errors
  });
  const page = await context.newPage();
  
  const research = {
    firmName: company || '',
    website: firmWebsite,
    contactPerson: contactName,
    location: { city: city || '', state: state || '', country: country || 'US' },
    
    // Core intelligence
    firmIntel: {
      positioning: '',
      keySpecialties: [],
      firmSize: { attorneys: 0, estimate: '' },
      recentNews: [],
      credentials: [],
      growthSignals: []
    },
    
    // Quick samples for personalization
    sampleAttorneys: [],
    
    // Competitors
    competitors: [],
    
    // Original structure for compatibility
    allLocations: [],
    practiceAreas: [],
    pagesAnalyzed: [],
    confidence: {}
  };
  
  try {
    console.log(`📋 Step 1: Loading key pages...`);
    
    // Load homepage
    await page.goto(firmWebsite, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const homeHtml = await page.content();
    research.pagesAnalyzed.push({ url: firmWebsite, type: 'home' });
    
    // Try to load about page
    let aboutHtml = null;
    const aboutUrls = [
      `${new URL(firmWebsite).origin}/about`,
      `${new URL(firmWebsite).origin}/about-us`,
      `${new URL(firmWebsite).origin}/about-the-firm`
    ];
    
    for (const url of aboutUrls) {
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        if (response && response.status() === 200) {
          aboutHtml = await page.content();
          research.pagesAnalyzed.push({ url, type: 'about' });
          console.log(`   ✅ Found about page: ${url}`);
          break;
        }
      } catch (e) { /* skip */ }
    }
    
    console.log(`   ✅ Loaded ${research.pagesAnalyzed.length} key pages\n`);
    
    // ========================================================================
    // STEP 2: AI FIRM ANALYSIS (This is the core intelligence)
    // ========================================================================
    console.log(`🧠 Step 2: AI Firm Analysis...`);
    
    const firmAnalysis = await aiHelper.analyzeFirm(homeHtml, aboutHtml, research.firmName);
    
    if (firmAnalysis) {
      research.firmIntel = {
        ...research.firmIntel,
        ...firmAnalysis
      };
      
      console.log(`   ✅ Positioning: ${firmAnalysis.positioning?.substring(0, 80)}...`);
      console.log(`   ✅ Key Specialties: ${firmAnalysis.keySpecialties?.join(', ')}`);
      console.log(`   ✅ Firm Size: ${firmAnalysis.firmSize?.estimate || 'Unknown'}`);
      console.log(`   ✅ Growth Signals: ${firmAnalysis.growthSignals?.length || 0} identified`);
      console.log(`   ✅ Recent News: ${firmAnalysis.recentNews?.length || 0} items`);
      
      // If AI found primary location in firm analysis, use it as early hint
      if (firmAnalysis.primaryLocation && (firmAnalysis.primaryLocation.city || firmAnalysis.primaryLocation.state)) {
        console.log(`   ✅ Primary Location Hint: ${firmAnalysis.primaryLocation.city}, ${firmAnalysis.primaryLocation.state}`);
        // Store for later use if dedicated extraction fails
        research._primaryLocationHint = firmAnalysis.primaryLocation;
      }
    }
    
    console.log();
    
    // ========================================================================
    // STEP 2.5: EXTRACT LOCATION IF MISSING FROM INSTANTLY
    // ========================================================================
    if (!research.location.city || !research.location.state) {
      console.log(`📍 Step 2.5: Location missing, extracting from website...`);
      
      // Try to extract from HTML
      const html = homeHtml + (aboutHtml || '');
      
      // Pattern 1: Look for address in schema.org markup
      const schemaMatch = html.match(/"addressLocality"\s*:\s*"([^"]+)"/);
      const schemaStateMatch = html.match(/"addressRegion"\s*:\s*"([^"]+)"/);
      
      if (schemaMatch && schemaStateMatch) {
        research.location.city = schemaMatch[1];
        research.location.state = schemaStateMatch[1];
        console.log(`   ✅ Extracted from schema.org: ${research.location.city}, ${research.location.state}`);
      } else {
        // Pattern 2: Look for common address patterns
        const addressPatterns = [
          /(\w+(?:\s+\w+)?),\s*([A-Z]{2})\s+\d{5}/g,  // City, ST 12345
          /located in (\w+(?:\s+\w+)?),\s*([A-Z]{2})/gi,  // "located in City, ST"
          /serving (\w+(?:\s+\w+)?),\s*([A-Z]{2})/gi,     // "serving City, ST"
          /(\w+(?:\s+\w+)?)\s+area/gi                      // "City area"
        ];
        
        for (const pattern of addressPatterns) {
          const matches = html.matchAll(pattern);
          for (const match of matches) {
            if (match[1] && match[2]) {
              research.location.city = match[1].trim();
              research.location.state = match[2].trim();
              console.log(`   ✅ Extracted from text: ${research.location.city}, ${research.location.state}`);
              break;
            }
          }
          if (research.location.city) break;
        }
      }
      
      // Pattern 3: Look in footer
      if (!research.location.city) {
        const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/i);
        if (footerMatch) {
          const footer = footerMatch[0];
          const cityStateMatch = footer.match(/(\w+(?:\s+\w+)?),\s*([A-Z]{2})/);
          if (cityStateMatch) {
            research.location.city = cityStateMatch[1];
            research.location.state = cityStateMatch[2];
            console.log(`   ✅ Extracted from footer: ${research.location.city}, ${research.location.state}`);
          }
        }
      }
      
      if (!research.location.city) {
        console.log(`   ⚠️  Could not extract location - will show as "your area"`);
      }
    } else {
      console.log(`📍 Location provided: ${research.location.city}, ${research.location.state}`);
    }
    
    console.log();
    
    // ========================================================================
    // STEP 3: QUICK ATTORNEY SAMPLE (for personalization)
    // ========================================================================
    console.log(`👥 Step 3: Sampling attorneys for personalization...`);
    
    // Try to find team page
    const teamUrls = [
      `${new URL(firmWebsite).origin}/team`,
      `${new URL(firmWebsite).origin}/our-team`,
      `${new URL(firmWebsite).origin}/attorneys`,
      `${new URL(firmWebsite).origin}/roth-jacksons-team`
    ];
    
    let teamHtml = null;
    for (const url of teamUrls) {
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        if (response && response.status() === 200) {
          teamHtml = await page.content();
          research.pagesAnalyzed.push({ url, type: 'team' });
          console.log(`   ✅ Found team page: ${url}`);
          break;
        }
      } catch (e) { /* skip */ }
    }
    
    if (teamHtml) {
      const attorneySample = await aiHelper.quickAttorneySample(teamHtml, 3);
      if (attorneySample && attorneySample.length > 0) {
        research.sampleAttorneys = attorneySample;
        research.firmIntel.firmSize.attorneys = attorneySample[0]?.totalCount || 0;
        console.log(`   ✅ Attorney count: ${research.firmIntel.firmSize.attorneys}`);
        console.log(`   ✅ Sampled ${attorneySample.length} for personalization:`);
        attorneySample.forEach(a => console.log(`      - ${a.name} (${a.title || 'Attorney'})`));
      }
    }
    
    console.log();
    
    // ========================================================================
    // STEP 4: AGGRESSIVE LOCATION EXTRACTION
    // ========================================================================
    console.log(`📍 Step 4: Extracting locations (AGGRESSIVE)...`);
    
    // Try 1: Extract from homepage
    let locations = await aiHelper.extractLocation(homeHtml, research.firmName);
    console.log(`   Step 4a: Home page → ${locations.length} location(s)`);
    
    // Try 2: If no luck, try about page
    if ((!locations || locations.length === 0) && aboutHtml) {
      console.log(`   Step 4b: Trying about page...`);
      locations = await aiHelper.extractLocation(aboutHtml, research.firmName);
      console.log(`   Step 4b: About page → ${locations.length} location(s)`);
    }
    
    // Try 3: If still no luck, try contact page
    if (!locations || locations.length === 0) {
      console.log(`   Step 4c: Trying contact page...`);
      const contactUrls = [
        `${new URL(firmWebsite).origin}/contact`,
        `${new URL(firmWebsite).origin}/contact-us`,
        `${new URL(firmWebsite).origin}/locations`
      ];
      
      for (const url of contactUrls) {
        try {
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          if (response && response.status() === 200) {
            const contactHtml = await page.content();
            locations = await aiHelper.extractLocation(contactHtml, research.firmName);
            if (locations && locations.length > 0) {
              console.log(`   Step 4c: Contact page → ${locations.length} location(s) ✅`);
              research.pagesAnalyzed.push({ url, type: 'contact' });
              break;
            }
          }
        } catch (e) { /* skip */ }
      }
    }
    
    // Try 4: Combined HTML (last resort - bigger context for AI)
    if (!locations || locations.length === 0) {
      console.log(`   Step 4d: Trying combined HTML (last resort)...`);
      const combinedHtml = homeHtml + '\n\n' + (aboutHtml || '');
      locations = await aiHelper.extractLocation(combinedHtml, research.firmName);
      console.log(`   Step 4d: Combined → ${locations.length} location(s)`);
    }
    
    // Final assignment
    if (locations && locations.length > 0) {
      research.allLocations = locations;
      research.location = {
        city: locations[0].city || '',
        state: locations[0].state || '',
        country: locations[0].country || 'US'
      };
      console.log(`   ✅ SUCCESS: Found ${locations.length} location(s)`);
      console.log(`   Primary: ${research.location.city}, ${research.location.state}`);
      research.confidence.location = 9;
    } else {
      // Try 5: Use location hint from firm analysis
      if (research._primaryLocationHint && (research._primaryLocationHint.city || research._primaryLocationHint.state)) {
        console.log(`   Step 4e: Using location from firm analysis...`);
        research.location = {
          city: research._primaryLocationHint.city || '',
          state: research._primaryLocationHint.state || '',
          country: 'US'
        };
        research.allLocations = [{ 
          city: research._primaryLocationHint.city || '', 
          state: research._primaryLocationHint.state || '', 
          country: 'US', 
          address: '' 
        }];
        console.log(`   ✅ Using firm analysis location: ${research.location.city}, ${research.location.state}`);
        research.confidence.location = 8;
      }
      // Try 6: Fallback to Instantly webhook data
      else if (city || state) {
        research.location = { city: city || '', state: state || '', country: country || 'US' };
        research.allLocations = [{ city: city || '', state: state || '', country: country || '', address: '' }];
        research.confidence.location = 6;
        console.log(`   ⚠️  Using Instantly webhook location: ${city}, ${state}`);
      }
      // Complete failure
      else {
        research.location = { city: '', state: '', country: 'US' };
        research.allLocations = [{ city: '', state: '', country: 'US', address: '' }];
        research.confidence.location = 0;
        console.log(`   ❌ NO LOCATION FOUND ANYWHERE`);
        console.log(`      - AI extraction: failed (4 attempts)`);
        console.log(`      - Firm analysis: no hint`);
        console.log(`      - Instantly webhook: empty`);
      }
    }
    
    // Clean up temp hint
    delete research._primaryLocationHint;
    
    console.log();
    
    // ========================================================================
    // STEP 5: PRACTICE AREAS (from firm analysis)
    // ========================================================================
    console.log(`📊 Step 5: Cataloging practice areas...`);
    
    if (research.firmIntel.keySpecialties && research.firmIntel.keySpecialties.length > 0) {
      research.practiceAreas = research.firmIntel.keySpecialties;
      console.log(`   ✅ ${research.practiceAreas.length} practice areas identified`);
      research.confidence.practiceAreas = 9;
    } else {
      console.log(`   ⚠️  No practice areas extracted`);
      research.confidence.practiceAreas = 0;
    }
    
    console.log();
    
    // ========================================================================
    // STEP 6: COMPETITOR SEARCH (AI-powered)
    // ========================================================================
    console.log(`🎯 Step 6: Finding competitors...`);
    
    const competitors = await aiHelper.findCompetitors(
      research.firmName || company,
      research.location.city || city,
      research.location.state || state,
      research.practiceAreas || []
    );
    
    if (competitors && competitors.length > 0) {
      research.competitors = competitors;
      console.log(`   ✅ Found ${competitors.length} competitors\n`);
    } else {
      research.competitors = [];
      console.log(`   ⚠️  No competitors found\n`);
    }
    
  } catch (error) {
    console.error(`❌ Research error: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  // Calculate overall confidence
  const confidenceValues = Object.values(research.confidence).filter(v => typeof v === 'number');
  research.confidence.overall = confidenceValues.length > 0 
    ? Math.round(confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length)
    : 0;
  
  // Summary
  console.log(`\n📊 FIRM INTELLIGENCE COMPLETE:`);
  console.log(`   Firm: ${research.firmName || 'Unknown'}`);
  console.log(`   Location: ${research.location.city || 'Unknown'}, ${research.location.state || '??'}`);
  console.log(`   Firm Size: ${research.firmIntel.firmSize?.estimate || 'Unknown'} (${research.firmIntel.firmSize?.attorneys || '?'} attorneys)`);
  console.log(`   Key Specialties: ${research.firmIntel.keySpecialties?.slice(0, 3).join(', ') || 'None'}`);
  console.log(`   Competitors Found: ${research.competitors?.length || 0}`);
  console.log(`   Growth Signals: ${research.firmIntel.growthSignals?.length || 0}`);
  console.log(`   Recent News: ${research.firmIntel.recentNews?.length || 0}`);
  console.log(`   Sample Attorneys: ${research.sampleAttorneys.length}`);
  console.log(`   Overall Confidence: ${research.confidence.overall}/10\n`);
  
  // Save
  const firmSlug = (research.firmName || 'unknown').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const reportsDir = path.resolve(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const outputPath = path.resolve(reportsDir, `${firmSlug}-intel-v5.json`);
  fs.writeFileSync(outputPath, JSON.stringify(research, null, 2));
  console.log(`💾 Saved: ${outputPath}\n`);
  
  return research;
}

// CLI
if (require.main === module) {
  const [url, contactName = '', city = '', state = '', country = 'US', company = ''] = process.argv.slice(2);
  
  if (!url) {
    console.log('Usage: node research-v5-FIRM-INTEL.js <url> [contactName] [city] [state] [country] [company]');
    console.log('\nExample:');
    console.log('  node research-v5-FIRM-INTEL.js https://www.rothjackson.com "Andrew Condlin" "McLean" "VA" "US" "Roth Jackson"');
    console.log('\nFocuses on firm-level intelligence for personalized outreach.');
    process.exit(1);
  }
  
  firmIntelligence(url, contactName, city, state, country, company)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { firmIntelligence };
