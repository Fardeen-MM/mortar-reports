#!/usr/bin/env node
/**
 * RESEARCH SCRIPT V2 - FIXED
 * Extracts firm information properly:
 * 1. Firm name from <title> tag (not tagline/h1)
 * 2. Location from schema.org + address patterns
 * 3. Credentials from About Us page
 * 4. All other data
 */

const { chromium } = require('playwright');
const fs = require('fs');

// Helper: Extract firm name from domain
function extractFirmNameFromDomain(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const parts = domain.split('.');
    if (parts.length >= 2) {
      // "dosslaw.ca" → "Doss Law"
      const name = parts[0]
        .replace(/law|legal|attorney|lawyers/gi, ' $& ')
        .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → spaces
        .replace(/\s+/g, ' ')
        .trim();
      
      // Capitalize each word
      return name.split(' ').map(w => 
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
    }
  } catch (e) {
    return '';
  }
  return '';
}

// Helper: Check if text is a tagline/slogan (not firm name)
function isTagline(text) {
  const taglinePatterns = [
    /excellence/i,
    /with a.*approach/i,
    /your.*partner/i,
    /strategic/i,
    /trusted/i,
    /personalized/i,
    /professional/i,
    /serving/i,
    /committed to/i
  ];
  
  return taglinePatterns.some(pattern => pattern.test(text));
}

async function researchFirm(firmWebsite) {
  console.log(`\n🔍 Starting deep research on: ${firmWebsite}\n`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const research = {
    firmName: '',
    website: firmWebsite,
    location: { city: '', state: '', country: 'US' },
    credentials: [],
    practiceAreas: [],
    
    // Gap Detection
    gaps: {
      metaAds: { hasGap: false, impact: 0, details: '', status: 'none' },
      googleAds: { hasGap: false, impact: 0, details: '', status: 'none' },
      support24x7: { hasGap: false, impact: 0, details: '' },
      websiteSpeed: { hasGap: false, impact: 0, details: '' },
      crm: { hasGap: false, impact: 0, details: '' }
    },
    
    competitors: [],
    competitorAds: 0,
    
    metaAdsData: {
      hasAds: false,
      hasActiveAds: false,
      hasInactiveAds: false,
      adCount: 0,
      activeCount: 0,
      inactiveCount: 0,
      adExamples: [],
      lastActiveDate: null,
      competitors: []
    },
    googleAdsData: {
      hasAds: false,
      adCount: 0,
      adExamples: [],
      competitors: [],
      searchResults: []
    },
    
    pageSpeed: 0,
    pageSpeedScore: '',
    hasChatbot: false,
    hasBookingWidget: false,
    mobileOptimized: false,
    
    websiteAnalysis: {},
    
    researchedAt: new Date().toISOString(),
    estimatedMonthlyRevenueLoss: 0
  };
  
  try {
    // === STEP 1: LOAD HOMEPAGE & MEASURE SPEED ===
    console.log(`📄 Analyzing firm website...`);
    const startTime = Date.now();
    await page.goto(firmWebsite, { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - startTime;
    research.pageSpeed = loadTime;
    research.pageSpeedScore = loadTime < 2000 ? 'Fast' : loadTime < 4000 ? 'Medium' : 'Slow';
    
    if (loadTime > 3000) {
      research.gaps.websiteSpeed.hasGap = true;
      research.gaps.websiteSpeed.impact = 8000;
      research.gaps.websiteSpeed.details = `${(loadTime/1000).toFixed(1)}s load time. Every extra second = 7% conversion loss.`;
    }
    
    console.log(`   ⚡ Load time: ${(loadTime/1000).toFixed(1)}s (${research.pageSpeedScore})`);
    
    // === STEP 2: EXTRACT FIRM NAME (PROPERLY) ===
    const pageTitle = await page.title();
    let firmName = '';
    
    // Method 1: Extract from <title> tag
    if (pageTitle) {
      // Split on common separators: | – -
      const titleParts = pageTitle.split(/[|\–\-]/).map(p => p.trim()).filter(p => p.length > 0);
      
      // Strategy: Find the part that looks most like a firm name
      // Usually: "Generic Description | Services | FIRM NAME"
      // So check from the END first, then beginning
      
      let bestMatch = '';
      
      // Check last part first (often the actual firm name)
      if (titleParts.length > 0) {
        const lastPart = titleParts[titleParts.length - 1];
        // If it contains "Law", "Legal", "Professional Corporation", etc and is short, it's likely the firm name
        if (/\b(law|legal|attorney|lawyer|professional corporation|pc|llp|pllc)\b/i.test(lastPart) && lastPart.length < 80) {
          bestMatch = lastPart;
        }
      }
      
      // If no match at end, check first part
      if (!bestMatch && titleParts.length > 0) {
        const firstPart = titleParts[0];
        if (/\b(law|legal|attorney|lawyer|professional corporation|pc|llp|pllc)\b/i.test(firstPart) && firstPart.length < 80) {
          bestMatch = firstPart;
        }
      }
      
      // If still no match, take the shortest part that's not a generic term
      if (!bestMatch) {
        const genericTerms = /^(home|welcome|services|about|contact|toronto|new york|los angeles|chicago)/i;
        for (const part of titleParts) {
          if (!genericTerms.test(part) && part.length > 5 && part.length < 80) {
            bestMatch = part;
            break;
          }
        }
      }
      
      firmName = bestMatch || titleParts[0] || '';
    }
    
    // Method 2: If title looks like a tagline or is empty, try domain extraction
    if (!firmName || isTagline(firmName) || firmName.length < 3) {
      const domainName = extractFirmNameFromDomain(firmWebsite);
      if (domainName && domainName.length > 3) {
        firmName = domainName;
        console.log(`   📝 Extracted from domain: ${firmName}`);
      }
    }
    
    // Method 3: Check H1 only if it looks like a firm name (not tagline)
    if (!firmName || firmName.length < 3) {
      const h1Text = await page.locator('h1').first().textContent().catch(() => '');
      if (h1Text && h1Text.length < 60 && h1Text.length > 5 && !isTagline(h1Text)) {
        firmName = h1Text.trim();
      }
    }
    
    // Fallback to domain if still empty
    if (!firmName || firmName.length < 3) {
      firmName = extractFirmNameFromDomain(firmWebsite) || 'Law Firm';
    }
    
    research.firmName = firmName;
    console.log(`   ✅ Firm: ${research.firmName}`);
    
    // === STEP 3: EXTRACT LOCATION (PROPERLY) ===
    let locationFound = false;
    
    // Method 1: Schema.org JSON-LD (most reliable)
    try {
      const schemaScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
      for (const scriptContent of schemaScripts) {
        try {
          const schema = JSON.parse(scriptContent);
          const schemas = Array.isArray(schema) ? schema : schema['@graph'] ? schema['@graph'] : [schema];
          
          for (const item of schemas) {
            if (item.address && item.address.addressLocality && item.address.addressRegion) {
              research.location.city = item.address.addressLocality;
              research.location.state = item.address.addressRegion;
              if (item.address.addressCountry) {
                research.location.country = item.address.addressCountry === 'CA' ? 'CA' : 'US';
              }
              locationFound = true;
              console.log(`   📍 Location (from schema): ${research.location.city}, ${research.location.state}`);
              break;
            }
          }
          if (locationFound) break;
        } catch (e) {}
      }
    } catch (e) {}
    
    // Method 2: Look for address patterns in footer/contact
    if (!locationFound) {
      const bodyText = await page.textContent('body');
      
      // Canadian address pattern: "Ajax, ON" "Toronto, Ontario"
      const canadianPattern = /\b([A-Z][a-zA-Z\s]+),\s*(ON|Ontario|BC|British Columbia|AB|Alberta|QC|Quebec|MB|Manitoba|SK|Saskatchewan|NS|Nova Scotia|NB|New Brunswick|PE|Prince Edward Island|NL|Newfoundland)\b/gi;
      const canadianMatches = [...bodyText.matchAll(canadianPattern)];
      
      // Count frequency of each city mention
      const cityFrequency = {};
      for (const match of canadianMatches) {
        let city = match[1].trim();
        const state = match[2];
        
        // Skip if city has obvious bad patterns
        if (/[0-9]/.test(city)) continue; // Has numbers
        if (city.length > 30) continue; // Too long
        if (city.length < 3) continue; // Too short
        
        // If city is CamelCase (like "HoltPickering"), extract the last word
        if (/[A-Z][a-z]*[A-Z]/.test(city.replace(/\s/g, ''))) {
          // Extract last CamelCase word: "HoltPickering" → "Pickering"
          const camelParts = city.match(/[A-Z][a-z]+/g);
          if (camelParts && camelParts.length > 1) {
            city = camelParts[camelParts.length - 1]; // Take last part
          }
        }
        
        // Skip if cleaned city is in firm name or too short
        if (research.firmName.includes(city)) continue;
        if (city.length < 3) continue;
        
        const key = `${city}, ${state}`;
        cityFrequency[key] = (cityFrequency[key] || 0) + 1;
      }
      
      // Pick the most frequently mentioned location (likely the real one)
      if (Object.keys(cityFrequency).length > 0) {
        const sortedCities = Object.entries(cityFrequency).sort((a, b) => b[1] - a[1]);
        const [cityState, count] = sortedCities[0];
        const [city, state] = cityState.split(', ');
        
        research.location.city = city;
        research.location.state = state;
        research.location.country = 'CA';
        locationFound = true;
        console.log(`   📍 Location (from text): ${research.location.city}, ${research.location.state} (${count} mentions)`);
      }
      
      // US address pattern if no Canadian found
      if (!locationFound) {
        const usPattern = /\b([A-Z][a-zA-Z\s]+),\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|California|New York|Texas|Florida|Illinois)\b/gi;
        const usMatches = [...bodyText.matchAll(usPattern)];
        
        if (usMatches.length > 0) {
          // Filter out matches that are part of the firm name
          const validMatch = usMatches.find(match => {
            const city = match[1];
            const state = match[2];
            // Skip if state looks like "PC", "PA" (professional corp)
            if (['PC', 'PA', 'PS', 'LLP'].includes(state.toUpperCase())) return false;
            // Skip if city is in firm name
            if (research.firmName.includes(city)) return false;
            return true;
          });
          
          if (validMatch) {
            research.location.city = validMatch[1].trim();
            research.location.state = validMatch[2];
            research.location.country = 'US';
            locationFound = true;
            console.log(`   📍 Location (from text): ${research.location.city}, ${research.location.state}`);
          }
        }
      }
    }
    
    // === STEP 4: EXTRACT PRACTICE AREAS ===
    const practiceKeywords = [
      'family law', 'divorce', 'custody', 'child support',
      'estate planning', 'wills', 'trusts', 'probate',
      'real estate', 'property law',
      'corporate', 'business law',
      'immigration', 'citizenship', 'visa',
      'personal injury', 'accident',
      'criminal defense', 'dui',
      'litigation', 'trial',
      'tax planning', 'tax law',
      'employment law'
    ];
    
    const bodyTextLower = (await page.textContent('body')).toLowerCase();
    for (const keyword of practiceKeywords) {
      if (bodyTextLower.includes(keyword) && !research.practiceAreas.includes(keyword)) {
        research.practiceAreas.push(keyword);
      }
    }
    
    // Also extract from navigation menu
    const menuLinks = await page.locator('nav a, .menu a').allTextContents();
    for (const link of menuLinks) {
      const linkLower = link.toLowerCase();
      for (const keyword of practiceKeywords) {
        if (linkLower.includes(keyword) && !research.practiceAreas.includes(keyword)) {
          research.practiceAreas.push(keyword);
        }
      }
    }
    
    console.log(`   ⚖️  Practice areas: ${research.practiceAreas.slice(0, 3).join(', ')}...`);
    
    // === STEP 5: CHECK 24/7 SUPPORT ===
    console.log(`\n📞 Checking support availability...`);
    const support247Keywords = [
      '24/7', '24-7', 'twenty four seven',
      'after hours', 'available anytime',
      'call anytime', 'evening hours',
      'weekend hours', 'always available'
    ];
    
    let has247 = false;
    for (const keyword of support247Keywords) {
      if (bodyTextLower.includes(keyword.toLowerCase())) {
        has247 = true;
        break;
      }
    }
    
    // Check for chatbot
    const hasChatbot = await page.locator('[class*="chat"], [id*="chat"], [class*="intercom"], [id*="drift"]').count() > 0;
    research.hasChatbot = hasChatbot;
    
    if (!has247 && !hasChatbot) {
      research.gaps.support24x7.hasGap = true;
      research.gaps.support24x7.impact = 15000;
      research.gaps.support24x7.details = `No 24/7 support detected. 73% of leads come outside business hours.`;
      console.log(`   ❌ No 24/7 support found`);
    } else if (hasChatbot) {
      console.log(`   ✅ Has chatbot`);
    } else {
      console.log(`   ✅ Has 24/7 support`);
    }
    
    // === STEP 6: CHECK META ADS (Facebook/Instagram) ===
    console.log(`\n📱 Checking Meta Ads (Facebook/Instagram)...`);
    const metaPage = await browser.newPage();
    
    try {
      const country = research.location.country === 'CA' ? 'CA' : 'US';
      const fbSearchQuery = research.firmName.replace(/\s+/g, '+');
      const fbUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${fbSearchQuery}&search_type=keyword_unordered&media_type=all`;
      
      console.log(`   🌍 Searching in ${country}...`);
      await metaPage.goto(fbUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await metaPage.waitForTimeout(3000);
      
      // Count ACTUAL ad articles, not UI text
      const adArticleCount = await metaPage.locator('[role="article"]').count();
      
      if (adArticleCount > 0) {
        // Check status within articles
        const adArticles = await metaPage.locator('[role="article"]').all();
        let activeCount = 0;
        let inactiveCount = 0;
        
        for (const article of adArticles) {
          const articleText = await article.textContent();
          if (articleText.includes('Active')) activeCount++;
          if (articleText.includes('Inactive')) inactiveCount++;
        }
        
        research.metaAdsData.adCount = adArticleCount;
        research.metaAdsData.activeCount = activeCount;
        research.metaAdsData.inactiveCount = inactiveCount;
        research.metaAdsData.hasAds = true;
        research.metaAdsData.hasActiveAds = activeCount > 0;
        research.metaAdsData.hasInactiveAds = inactiveCount > 0;
        
        console.log(`   📊 Found ${adArticleCount} ad(s) (${activeCount} active, ${inactiveCount} inactive)`);
      } else {
        console.log(`   ❌ No Meta Ads found`);
      }
      
      if (!research.metaAdsData.hasActiveAds) {
        research.gaps.metaAds.hasGap = true;
        research.gaps.metaAds.impact = 12000;
        research.gaps.metaAds.details = `Not running Facebook/Instagram ads. Competitors are capturing clients 24/7.`;
        research.gaps.metaAds.status = 'none';
      }
    } catch (e) {
      console.log(`   ⚠️  Could not check Meta Ads: ${e.message}`);
    }
    
    await metaPage.close();
    
    // === STEP 7: CHECK GOOGLE ADS & EXTRACT COMPETITORS ===
    console.log(`\n🔍 Checking Google Ads & extracting competitors...`);
    const googleAdsPage = await browser.newPage();
    
    try {
      // Search for their practice area + location
      const searchTerm = research.practiceAreas[0] || 'lawyer';
      const searchQuery = `${searchTerm} ${research.location.city}`;
      console.log(`   🔍 Searching: "${searchQuery}"`);
      
      await googleAdsPage.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, { 
        waitUntil: 'networkidle', 
        timeout: 30000 
      });
      await googleAdsPage.waitForTimeout(2000);
      
      // Extract ALL law firm names from the page (ads + organic results)
      const competitorSet = new Set();
      
      // Method 1: Extract from H3 headings (both ads and organic)
      const headings = await googleAdsPage.locator('h3').allTextContents();
      for (const heading of headings) {
        // Clean up the heading
        let firmName = heading.trim();
        
        // Skip if it's the search firm itself
        if (firmName.toLowerCase().includes(research.firmName.toLowerCase())) continue;
        
        // Skip if too short or too long
        if (firmName.length < 5 || firmName.length > 80) continue;
        
        // Skip generic terms
        if (/^(home|about|contact|services|legal|law|lawyer|attorney)$/i.test(firmName)) continue;
        
        // If it contains law-related terms, it's likely a firm
        if (/\b(law|legal|attorney|attorneys|lawyer|lawyers|llp|pc|pllc|esq)\b/i.test(firmName)) {
          // Clean up common suffixes in the heading
          firmName = firmName
            .replace(/\s*-\s*.*$/, '') // Remove "- anything after dash"
            .replace(/\s*\|.*$/, '') // Remove "| anything after pipe"
            .trim();
          
          if (firmName.length > 5 && firmName.length < 80) {
            competitorSet.add(firmName);
          }
        }
      }
      
      // Method 2: Extract from cite elements (URLs often have firm names)
      const citations = await googleAdsPage.locator('cite').allTextContents();
      for (const cite of citations) {
        const domain = cite.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        if (domain && domain !== new URL(firmWebsite).hostname.replace('www.', '')) {
          // Convert domain to potential firm name: "smithlaw.com" → "Smith Law"
          const potentialName = domain
            .split('.')[0]
            .replace(/law|legal|attorney|lawyers/gi, ' $& ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .trim();
          
          if (potentialName.length > 3 && /[a-z]/i.test(potentialName)) {
            const formatted = potentialName.split(/\s+/).map(w => 
              w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
            ).join(' ');
            
            if (formatted.length > 5 && formatted.length < 50) {
              competitorSet.add(formatted);
            }
          }
        }
      }
      
      // Convert Set to Array
      research.competitors = Array.from(competitorSet).slice(0, 10); // Keep top 10
      
      // Count ads
      const adCount = await googleAdsPage.locator('span:has-text("Sponsored"), span:has-text("Ad")').count();
      
      if (adCount === 0) {
        research.gaps.googleAds.hasGap = true;
        research.gaps.googleAds.impact = 8000;
        research.gaps.googleAds.details = `Market opportunity: No competitors advertising. You could dominate this space with proper Google Ads strategy.`;
        research.gaps.googleAds.status = 'blue-ocean';
        console.log(`   ⚠️  No competitor ads detected in this market`);
      } else {
        console.log(`   📊 Found ${adCount} competitor ad(s)`);
        research.googleAdsData.adCount = adCount;
      }
      
      console.log(`   🏢 Found ${research.competitors.length} competitors: ${research.competitors.slice(0, 3).join(', ')}...`);
      
    } catch (e) {
      console.log(`   ⚠️  Could not check Google Ads: ${e.message}`);
    }
    
    await googleAdsPage.close();
    
    // === STEP 8: CRM GAP (ALWAYS FLAGGED) ===
    console.log(`\n💼 Evaluating CRM/Automation...`);
    research.gaps.crm.hasGap = true;
    research.gaps.crm.impact = 8000;
    research.gaps.crm.details = `Manual follow-up wastes 15+ hrs/week and loses 40% of warm leads. Automation improves close rates 15-30%.`;
    console.log(`   ⚠️  CRM/automation gap (assumed)`);
    
    // === STEP 9: TRY TO EXTRACT CREDENTIALS FROM ABOUT PAGE ===
    try {
      // Look for common about page patterns
      const aboutLinks = await page.locator('a[href*="about"], a[href*="our-firm"], a[href*="team"]').all();
      if (aboutLinks.length > 0) {
        const aboutUrl = await aboutLinks[0].getAttribute('href');
        if (aboutUrl) {
          const fullAboutUrl = aboutUrl.startsWith('http') ? aboutUrl : new URL(aboutUrl, firmWebsite).href;
          await page.goto(fullAboutUrl, { waitUntil: 'networkidle', timeout: 15000 });
          
          const aboutText = await page.textContent('body');
          
          // Extract credentials patterns
          const credPatterns = [
            /founded by ([^.,]+)/i,
            /([A-Z][a-z]+ [A-Z][a-z]+),?\s+(B\.?Sc\.?|LL\.?B\.?|J\.?D\.?|Esq\.?)/gi,
            /(serving|offices in) ([^.]+)/gi,
            /([0-9]+\+?\s+years)/gi
          ];
          
          for (const pattern of credPatterns) {
            const matches = aboutText.match(pattern);
            if (matches) {
              for (const match of matches) {
                if (match.length < 100 && !research.credentials.includes(match)) {
                  research.credentials.push(match.trim());
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // Not critical if about page fails
    }
    
    // === CALCULATE TOTALS ===
    research.estimatedMonthlyRevenueLoss = Object.values(research.gaps)
      .reduce((sum, gap) => sum + (gap.impact || 0), 0);
    
    console.log(`\n💰 Total Monthly Opportunity: $${(research.estimatedMonthlyRevenueLoss/1000).toFixed(0)},000`);
    console.log(`💰 Annual Opportunity: $${(research.estimatedMonthlyRevenueLoss*12/1000).toFixed(0)},000`);
    
  } catch (error) {
    console.error(`❌ Research error: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  console.log(`\n✅ Research complete!`);
  console.log(`\n📊 RESEARCH SUMMARY:\n`);
  console.log(`Firm: ${research.firmName}`);
  console.log(`Location: ${research.location.city}, ${research.location.state}`);
  console.log(`Practice Areas: ${research.practiceAreas.slice(0, 5).join(', ')}`);
  console.log(`\nGaps Detected:`);
  
  for (const [key, gap] of Object.entries(research.gaps)) {
    if (gap.hasGap) {
      console.log(`  ❌ ${key}: $${(gap.impact/1000).toFixed(0)},000/mo - ${gap.details}`);
    }
  }
  
  console.log(`\nTotal Monthly Loss: $${(research.estimatedMonthlyRevenueLoss/1000).toFixed(0)},000`);
  console.log(`Total Annual Loss: $${(research.estimatedMonthlyRevenueLoss*12/1000).toFixed(0)},000`);
  
  // Save to file
  const firmSlug = research.firmName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const path = require('path');
  const outputPath = path.resolve(__dirname, `reports/${firmSlug}-research.json`);
  fs.writeFileSync(outputPath, JSON.stringify(research, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}\n`);
  
  return research;
}

// CLI
if (require.main === module) {
  const url = process.argv[2];
  if (!url) {
    console.log('Usage: node research-v2-FIXED.js <website-url>');
    process.exit(1);
  }
  researchFirm(url).then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { researchFirm };
