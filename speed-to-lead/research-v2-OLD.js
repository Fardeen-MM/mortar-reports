#!/usr/bin/env node
/**
 * RESEARCH SCRIPT V2
 * Deep research to identify gaps and opportunities
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function researchFirm(firmWebsite) {
  console.log(`\n🔍 Starting deep research on: ${firmWebsite}\n`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const research = {
    firmName: '',
    website: firmWebsite,
    location: { city: '', state: '', country: 'US' },
    practiceAreas: [],
    
    // Gap Detection
    gaps: {
      metaAds: { hasGap: false, impact: 0, details: '', status: 'none' }, // none/active/inactive
      googleAds: { hasGap: false, impact: 0, details: '', status: 'none' }, // none/active/blue-ocean
      support24x7: { hasGap: false, impact: 0, details: '' },
      websiteSpeed: { hasGap: false, impact: 0, details: '' },
      crm: { hasGap: false, impact: 0, details: '' }
    },
    
    // Competitive Intel
    competitors: [],
    competitorAds: 0,
    
    // Detailed Ad Data
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
    
    // Website Quality
    pageSpeed: 0, // milliseconds
    pageSpeedScore: '', // Fast/Medium/Slow
    hasChatbot: false,
    hasBookingWidget: false,
    mobileOptimized: false,
    
    // Website Content Analysis
    websiteAnalysis: {
      // Above the fold
      headline: '',
      subheadline: '',
      aboveFoldScreenshot: '', // path to screenshot
      
      // CTAs
      ctaCount: 0,
      ctaButtons: [], // { text, position, prominent }
      mainCTA: '',
      
      // Trust signals
      hasTestimonials: false,
      testimonialCount: 0,
      testimonialExamples: [],
      hasAwards: false,
      hasCaseResults: false,
      yearsInBusiness: null,
      
      // Forms
      hasContactForm: false,
      formFieldCount: 0,
      formFields: [],
      hasPhoneNumber: false,
      phoneNumber: '',
      
      // Content
      homepageWordCount: 0,
      hasBlog: false,
      practiceAreaPages: [],
      
      // Navigation
      menuItems: [],
      
      // Social proof
      hasReviews: false,
      reviewCount: 0,
      reviewScore: null,
      
      // Technical
      metaDescription: '',
      h1Count: 0,
      hasSchema: false
    },
    
    // Metadata
    researchedAt: new Date().toISOString(),
    estimatedMonthlyRevenueLoss: 0
  };

  try {
    // ========================================
    // STEP 1: ANALYZE FIRM WEBSITE
    // ========================================
    console.log('📄 Analyzing firm website...');
    const startTime = Date.now();
    
    await page.goto(firmWebsite, { 
      waitUntil: 'networkidle', 
      timeout: 20000 
    }).catch(() => {
      console.log('⚠️  Website slow to load, continuing anyway...');
    });
    
    const loadTime = Date.now() - startTime;
    research.pageSpeed = loadTime;
    research.pageSpeedScore = loadTime < 2000 ? 'Fast' : loadTime < 4000 ? 'Medium' : 'Slow';
    
    if (loadTime > 3000) {
      research.gaps.websiteSpeed.hasGap = true;
      research.gaps.websiteSpeed.impact = 8000; // $8K/month avg
      research.gaps.websiteSpeed.details = `${(loadTime/1000).toFixed(1)}s load time. Every extra second = 7% conversion loss.`;
    }
    
    console.log(`   ⚡ Load time: ${(loadTime/1000).toFixed(1)}s (${research.pageSpeedScore})`);
    
    // Extract firm name
    const title = await page.title();
    research.firmName = title
      .split('|')[0]
      .split('-')[0]
      .trim()
      .replace(/\s+Law\s+Firm.*$/i, '')
      .replace(/\s+Attorney.*$/i, '')
      .replace(/\s+Lawyer.*$/i, '');
    
    const h1Text = await page.locator('h1').first().textContent().catch(() => '');
    if (h1Text && h1Text.length < 60 && h1Text.length > 5) {
      research.firmName = h1Text.trim();
    }
    
    console.log(`   ✅ Firm: ${research.firmName}`);
    
    // Get all text content
    const bodyText = await page.textContent('body');
    
    // Extract location - Method 1: Try schema.org JSON-LD first (most reliable)
    try {
      const schemaScripts = await page.locator('script[type="application/ld+json"]').allTextContents();
      for (const scriptContent of schemaScripts) {
        try {
          const schema = JSON.parse(scriptContent);
          // Handle both single objects and arrays
          const schemas = Array.isArray(schema) ? schema : schema['@graph'] ? schema['@graph'] : [schema];
          
          for (const item of schemas) {
            // Look for LocalBusiness, LegalService, or Organization with address
            if (item.address && item.address.addressLocality && item.address.addressRegion) {
              research.location.city = item.address.addressLocality;
              research.location.state = item.address.addressRegion;
              console.log(`   📍 Location (from schema): ${research.location.city}, ${research.location.state}`);
              break;
            }
            // Check department array for multiple locations
            if (item.department && Array.isArray(item.department) && item.department[0]?.address) {
              research.location.city = item.department[0].address.addressLocality;
              research.location.state = item.department[0].address.addressRegion;
              console.log(`   📍 Location (from schema): ${research.location.city}, ${research.location.state}`);
              break;
            }
          }
          if (research.location.city) break;
        } catch {}
      }
    } catch {}
    
    // Method 2: Fallback to regex (filter out firm name)
    if (!research.location.city) {
      const locationRegex = /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2}(?![a-z]))/g;
      const locationMatches = [...bodyText.matchAll(locationRegex)];
      for (const match of locationMatches) {
        const city = match[1];
        const state = match[2];
        // Skip if it's part of the firm name or looks like "Name, P.C."
        if (state !== 'PC' && state !== 'PA' && state !== 'PS' && state !== 'LLP' && 
            !research.firmName.includes(city)) {
          research.location.city = city;
          research.location.state = state;
          console.log(`   📍 Location (from text): ${research.location.city}, ${research.location.state}`);
          break;
        }
      }
    }
    
    // Extract practice areas (law-specific)
    const practiceKeywords = [
      'personal injury', 'car accident', 'truck accident', 'motorcycle accident',
      'slip and fall', 'medical malpractice', 'workers compensation',
      'criminal defense', 'DUI', 'DWI', 'drug crimes',
      'family law', 'divorce', 'child custody', 'child support',
      'estate planning', 'probate', 'wills', 'trusts',
      'business law', 'corporate law', 'contracts',
      'immigration', 'deportation', 'citizenship',
      'bankruptcy', 'chapter 7', 'chapter 13',
      'employment law', 'wrongful termination',
      'real estate', 'landlord tenant',
      'civil litigation', 'appeals'
    ];
    
    research.practiceAreas = practiceKeywords.filter(keyword => 
      bodyText.toLowerCase().includes(keyword)
    );
    
    console.log(`   ⚖️  Practice areas: ${research.practiceAreas.slice(0, 3).join(', ')}${research.practiceAreas.length > 3 ? '...' : ''}`);
    
    // Check for 24/7 support indicators
    console.log('\n📞 Checking support availability...');
    const support24x7Patterns = [
      /24\/7/i,
      /24 hours/i,
      /24-hour/i,
      /around the clock/i,
      /always available/i,
      /available anytime/i
    ];
    
    const hasChatbot = await page.locator('[class*="chat"]').count() > 0 ||
                       await page.locator('[id*="chat"]').count() > 0 ||
                       await page.locator('iframe[title*="chat" i]').count() > 0;
    
    research.hasChatbot = hasChatbot;
    
    const has24x7Text = support24x7Patterns.some(pattern => pattern.test(bodyText));
    
    if (!has24x7Text && !hasChatbot) {
      research.gaps.support24x7.hasGap = true;
      research.gaps.support24x7.impact = 15000; // $15K/month avg
      research.gaps.support24x7.details = 'No 24/7 support detected. 73% of leads come outside business hours.';
      console.log(`   ❌ No 24/7 support found`);
    } else {
      console.log(`   ✅ Has ${hasChatbot ? 'chatbot' : '24/7 text'}`);
    }
    
    // Check for booking widget
    research.hasBookingWidget = await page.locator('[class*="calendly"]').count() > 0 ||
                                 await page.locator('[class*="calendar"]').count() > 0 ||
                                 await page.locator('iframe[src*="calendly"]').count() > 0;
    
    // Check mobile optimization
    const viewport = page.viewportSize();
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    const isMobileResponsive = await page.evaluate(() => {
      return document.body.scrollWidth <= window.innerWidth * 1.1;
    });
    research.mobileOptimized = isMobileResponsive;
    await page.setViewportSize(viewport);
    
    // ========================================
    // DEEP WEBSITE CONTENT ANALYSIS
    // ========================================
    console.log('\n🔍 Analyzing website content & messaging...');
    
    // 1. ABOVE THE FOLD - Take screenshot and extract headline
    const screenshotPath = `./reports/${research.firmName.toLowerCase().replace(/\s+/g, '-')}-hero.png`;
    await page.screenshot({ 
      path: screenshotPath, 
      clip: { x: 0, y: 0, width: 1440, height: 900 }
    }).catch(() => console.log('   ⚠️  Screenshot failed'));
    research.websiteAnalysis.aboveFoldScreenshot = screenshotPath;
    
    // Extract headline (first H1)
    const h1 = await page.locator('h1').first().textContent().catch(() => '');
    research.websiteAnalysis.headline = h1.trim();
    research.websiteAnalysis.h1Count = await page.locator('h1').count();
    
    // Extract subheadline (first h2 or large p near h1)
    const h2 = await page.locator('h2').first().textContent().catch(() => '');
    research.websiteAnalysis.subheadline = h2.trim();
    
    console.log(`   📝 Headline: "${research.websiteAnalysis.headline.substring(0, 60)}${research.websiteAnalysis.headline.length > 60 ? '...' : ''}"`);
    
    // 2. CTA BUTTONS - Find all buttons/links with action words
    const ctaSelectors = [
      'button',
      'a[class*="btn"]',
      'a[class*="button"]',
      'a[href*="contact"]',
      'a[href*="consultation"]',
      'a[href*="call"]',
      'input[type="submit"]'
    ];
    
    for (const selector of ctaSelectors) {
      const elements = await page.locator(selector).all();
      for (const el of elements) {
        const text = await el.textContent().catch(() => '');
        const isVisible = await el.isVisible().catch(() => false);
        if (text && text.trim().length > 0 && text.trim().length < 50 && isVisible) {
          research.websiteAnalysis.ctaButtons.push({
            text: text.trim(),
            position: 'unknown',
            prominent: text.length < 20
          });
        }
      }
    }
    
    research.websiteAnalysis.ctaCount = research.websiteAnalysis.ctaButtons.length;
    if (research.websiteAnalysis.ctaButtons.length > 0) {
      research.websiteAnalysis.mainCTA = research.websiteAnalysis.ctaButtons[0].text;
    }
    
    console.log(`   🎯 CTAs found: ${research.websiteAnalysis.ctaCount} (main: "${research.websiteAnalysis.mainCTA}")`);
    
    // 3. TESTIMONIALS - Look for testimonial sections
    const testimonialPatterns = [
      '[class*="testimonial"]',
      '[class*="review"]',
      '[class*="client-review"]',
      '[data-testimonial]'
    ];
    
    let testimonialCount = 0;
    for (const pattern of testimonialPatterns) {
      const count = await page.locator(pattern).count();
      testimonialCount = Math.max(testimonialCount, count);
    }
    
    research.websiteAnalysis.hasTestimonials = testimonialCount > 0;
    research.websiteAnalysis.testimonialCount = testimonialCount;
    
    // Try to extract some testimonial text
    if (testimonialCount > 0) {
      const testimonials = await page.locator('[class*="testimonial"]').allTextContents();
      research.websiteAnalysis.testimonialExamples = testimonials
        .slice(0, 2)
        .map(t => t.trim().substring(0, 150));
      console.log(`   💬 Testimonials: ${testimonialCount} found`);
    }
    
    // 4. TRUST SIGNALS - Awards, case results, years
    research.websiteAnalysis.hasAwards = bodyText.toLowerCase().includes('award') || 
                                         bodyText.toLowerCase().includes('recognized');
    research.websiteAnalysis.hasCaseResults = bodyText.toLowerCase().includes('million') ||
                                              bodyText.toLowerCase().includes('recovered') ||
                                              bodyText.toLowerCase().includes('won');
    
    // Extract years in business
    const yearMatch = bodyText.match(/(\d{2,4})\+?\s*years/i);
    if (yearMatch) {
      research.websiteAnalysis.yearsInBusiness = parseInt(yearMatch[1]);
    }
    
    // 5. CONTACT FORM - Check for form fields
    const formInputs = await page.locator('form input, form textarea').count();
    research.websiteAnalysis.hasContactForm = formInputs > 0;
    research.websiteAnalysis.formFieldCount = formInputs;
    
    const formFieldTypes = await page.locator('form input').evaluateAll(inputs => 
      inputs.map(i => i.getAttribute('name') || i.getAttribute('placeholder') || i.type)
    ).catch(() => []);
    research.websiteAnalysis.formFields = formFieldTypes.slice(0, 10);
    
    if (formInputs > 0) {
      console.log(`   📋 Contact form: ${formInputs} fields`);
    }
    
    // 6. PHONE NUMBER - Extract visible phone
    const phoneMatch = bodyText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
      research.websiteAnalysis.hasPhoneNumber = true;
      research.websiteAnalysis.phoneNumber = phoneMatch[0];
      console.log(`   📞 Phone: ${research.websiteAnalysis.phoneNumber}`);
    }
    
    // 7. CONTENT ANALYSIS - Word count
    const wordCount = bodyText.split(/\s+/).length;
    research.websiteAnalysis.homepageWordCount = wordCount;
    
    // Check for blog
    research.websiteAnalysis.hasBlog = bodyText.toLowerCase().includes('blog') ||
                                       await page.locator('a[href*="blog"]').count() > 0;
    
    // 8. NAVIGATION - Extract menu items
    const navLinks = await page.locator('nav a, header a').allTextContents();
    research.websiteAnalysis.menuItems = navLinks
      .filter(text => text.trim().length > 0 && text.trim().length < 30)
      .slice(0, 15);
    
    // 9. PRACTICE AREA PAGES - Look for links
    const practiceLinks = await page.locator('a[href*="practice"], a[href*="services"]').count();
    research.websiteAnalysis.practiceAreaPages = practiceLinks;
    
    // 10. REVIEWS - Check for Google reviews widget or star ratings
    research.websiteAnalysis.hasReviews = await page.locator('[class*="review"]').count() > 0 ||
                                          bodyText.includes('Google Reviews') ||
                                          bodyText.includes('5 star');
    
    // Try to extract review count
    const reviewMatch = bodyText.match(/(\d+)\+?\s*reviews?/i);
    if (reviewMatch) {
      research.websiteAnalysis.reviewCount = parseInt(reviewMatch[1]);
    }
    
    // 11. TECHNICAL SEO - Meta description
    const metaDesc = await page.locator('meta[name="description"]').getAttribute('content').catch(() => '');
    research.websiteAnalysis.metaDescription = metaDesc;
    
    // Check for schema markup
    research.websiteAnalysis.hasSchema = await page.locator('script[type="application/ld+json"]').count() > 0;
    
    console.log(`   📊 Content: ${wordCount} words, ${research.websiteAnalysis.menuItems.length} menu items`);
    console.log(`   ✅ Website analysis complete`);
    
    // ========================================
    // STEP 2: CHECK META ADS (Facebook/Instagram)
    // ========================================
    console.log('\n📱 Checking Meta Ads (Facebook/Instagram)...');
    
    const metaAdsData = {
      hasAds: false,
      hasActiveAds: false,
      hasInactiveAds: false,
      adCount: 0,
      activeCount: 0,
      inactiveCount: 0,
      adExamples: [],
      lastActiveDate: null,
      competitors: []
    };
    
    try {
      // Use detected country (CA for Canada, US default)
      const country = research.location.state === 'ON' || research.location.state === 'BC' || 
                     research.location.state === 'AB' || research.location.state === 'QC' ? 'CA' : 'US';
      
      const fbSearchQuery = research.firmName.replace(/\s+/g, '+');
      await page.goto(`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${fbSearchQuery}`, { 
        timeout: 20000,
        waitUntil: 'networkidle'
      });
      console.log(`   🌍 Searching in ${country}...`);
      await page.waitForTimeout(8000);
      
      // Check for ACTUAL ad results (not just the word "Active" in UI)
      const pageText = await page.textContent('body');
      const hasNoResults = pageText.includes('No results found') || pageText.includes('0 results');
      
      // Count actual ad articles on page (this is the real check)
      const adArticleCount = await page.locator('[role="article"]').count();
      
      // Look for result count text
      let resultMatch = pageText.match(/~?(\d+)\s+results?/i);
      if (!resultMatch) resultMatch = pageText.match(/(\d+)\s+ads?/i);
      if (!resultMatch) resultMatch = pageText.match(/Showing\s+(\d+)/i);
      
      // Only proceed if we have ACTUAL ad results (not just the word "Active" in the UI)
      if (!hasNoResults && (resultMatch || adArticleCount > 0)) {
        const resultCount = resultMatch ? parseInt(resultMatch[1]) : adArticleCount;
        
        if (resultCount > 0) {
          metaAdsData.adCount = resultCount;
          
          // Check if ads are active or inactive by looking at ad status badges (not filter UI)
          // Look for status text within actual ad articles
          const adArticles = await page.locator('[role="article"]').all();
          let activeCount = 0;
          let inactiveCount = 0;
          
          for (const article of adArticles) {
            const articleText = await article.textContent().catch(() => '');
            if (articleText.includes('Active') && !articleText.includes('Inactive')) {
              activeCount++;
            } else if (articleText.includes('Inactive')) {
              inactiveCount++;
            }
          }
          
          metaAdsData.hasInactiveAds = inactiveCount > 0;
          metaAdsData.hasActiveAds = activeCount > 0;
          metaAdsData.hasAds = activeCount > 0 || inactiveCount > 0;
          metaAdsData.activeCount = activeCount;
          metaAdsData.inactiveCount = inactiveCount;
          
          // Logging
          if (inactiveCount > 0) {
            // Try to extract date range for inactive ads
            const dateMatch = pageText.match(/(\w+ \d+, \d+)\s*-\s*(\w+ \d+, \d+)/);
            if (dateMatch) {
              metaAdsData.lastActiveDate = dateMatch[2]; // End date
              console.log(`   ⚠️  Found ${inactiveCount} INACTIVE ad(s) (stopped ${dateMatch[2]})`);
            } else {
              console.log(`   ⚠️  Found ${inactiveCount} INACTIVE ad(s)`);
            }
          }
          
          if (activeCount > 0) {
            console.log(`   ✅ Running ${activeCount} ACTIVE Meta Ad(s)`);
          }
          
          if (activeCount === 0 && inactiveCount === 0 && resultCount > 0) {
            // Found ads but couldn't determine status - assume they exist
            console.log(`   📊 Found ${resultCount} ad(s) (status unclear)`);
          }
          
          // Try to extract ad text
          const adTexts = await page.locator('div[dir="auto"]').allTextContents();
          metaAdsData.adExamples = adTexts.slice(0, 2).filter(t => t.length > 20 && t.length < 200);
        }
      }
      
      // Check competitor ads
      if (!metaAdsData.hasAds) {
        const primaryPractice = research.practiceAreas[0] || 'lawyer';
        const competitorSearchQuery = `${primaryPractice} ${research.location.city || research.location.state}`.replace(/\s+/g, '+');
        
        await page.goto(`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=${competitorSearchQuery}`, {
          timeout: 15000,
          waitUntil: 'domcontentloaded'
        });
        await page.waitForTimeout(4000);
        
        const competitorAdCount = await page.locator('[role="article"]').count();
        if (competitorAdCount > 0) {
          // Extract competitor page names
          const pageNames = await page.locator('[role="article"] a[href*="/ads/library/"]').allTextContents();
          metaAdsData.competitors = [...new Set(pageNames.slice(0, 5))].filter(n => n.length > 0);
          console.log(`   🏢 Found ${competitorAdCount} competitor ads running`);
        }
      }
      
      // Determine gap status and messaging
      if (metaAdsData.hasActiveAds) {
        // They're running ads - optimization opportunity
        research.gaps.metaAds.hasGap = true;
        research.gaps.metaAds.impact = 6000; // Lower impact (optimization, not starting from zero)
        research.gaps.metaAds.details = `Running ${metaAdsData.activeCount} active Meta ad(s). Great start! We can optimize targeting, creative, and funnel to lower CPA and scale profitably.`;
        research.gaps.metaAds.status = 'active';
      } else if (metaAdsData.hasInactiveAds) {
        // They tried but stopped - different pitch
        research.gaps.metaAds.hasGap = true;
        research.gaps.metaAds.impact = 12000;
        const dateNote = metaAdsData.lastActiveDate ? ` until ${metaAdsData.lastActiveDate}` : '';
        research.gaps.metaAds.details = `Ran Meta ads${dateNote} but stopped. If results weren't profitable, it's fixable with better targeting, creative, and funnel optimization. We've made this work for 40+ law firms.`;
        research.gaps.metaAds.status = 'inactive';
      } else {
        // Never ran ads
        research.gaps.metaAds.hasGap = true;
        research.gaps.metaAds.impact = 12000;
        const competitorNote = metaAdsData.competitors.length > 0 
          ? ` Meanwhile, ${metaAdsData.competitors[0]} and ${metaAdsData.competitors.length - 1} other firms are running ads.`
          : '';
        research.gaps.metaAds.details = `Not running Facebook/Instagram ads.${competitorNote} Competitors are capturing clients 24/7.`;
        research.gaps.metaAds.status = 'none';
        console.log(`   ❌ No Meta Ads found`);
      }
      
    } catch (error) {
      console.log(`   ⚠️  Could not verify Meta Ads (${error.message})`);
      // Still mark as gap if we can't verify
      research.gaps.metaAds.hasGap = true;
      research.gaps.metaAds.impact = 12000;
      research.gaps.metaAds.details = 'Could not verify Meta Ads. Recommend investigation.';
    }
    
    research.metaAdsData = metaAdsData;
    
    // ========================================
    // STEP 3: CHECK GOOGLE ADS TRANSPARENCY
    // ========================================
    console.log('\n🔍 Checking Google Ads Transparency...');
    
    const googleAdsData = {
      hasAds: false,
      adCount: 0,
      adExamples: [],
      competitors: [],
      searchResults: []
    };
    
    try {
      // Step 3a: Check if THIS firm is running ads via Ads Transparency
      const domain = firmWebsite.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      
      await page.goto(`https://adstransparency.google.com/?region=anywhere&domain=${domain}`, {
        timeout: 15000,
        waitUntil: 'domcontentloaded'
      });
      await page.waitForTimeout(4000);
      
      // Check for ad results - look for "X ads" text on page
      const pageText = await page.textContent('body');
      const hasNoAds = pageText.includes('No ads found') || 
                      pageText.includes('no ads to show') ||
                      pageText.includes('This advertiser has no ads');
      
      // Try to extract ad count from "17 ads" text
      const adCountMatch = pageText.match(/(\d+)\s+ads?/i);
      
      if (!hasNoAds && adCountMatch) {
        const adCount = parseInt(adCountMatch[1]);
        if (adCount > 0) {
          googleAdsData.hasAds = true;
          googleAdsData.adCount = adCount;
          console.log(`   ✅ Running ${adCount} Google Ads`);
          
          // Try to extract ad text (look for advertiser name, headlines)
          const firmNameOnPage = await page.locator(`text="${research.firmName}"`).count() > 0;
          if (firmNameOnPage) {
            googleAdsData.adExamples.push(research.firmName);
          }
        }
      } else if (!hasNoAds) {
        // Fallback: try counting creative elements
        const creativeElements = await page.locator('creative-preview, [class*="creative"]').count();
        if (creativeElements > 0) {
          googleAdsData.hasAds = true;
          googleAdsData.adCount = creativeElements;
          console.log(`   ✅ Running ~${creativeElements} Google Ads (estimated)`);
        }
      }
      
      // Step 3b: Search for competitor ads in their market
      const primaryPractice = research.practiceAreas[0] || 'lawyer';
      const searchQuery = `${primaryPractice} ${research.location.city || research.location.state || ''}`.trim();
      
      console.log(`   🔍 Searching: "${searchQuery}"`);
      
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, {
        timeout: 15000,
        waitUntil: 'domcontentloaded'
      });
      await page.waitForTimeout(3000);
      
      // Check for ads on SERP
      const adCount = await page.locator('div[data-text-ad], [aria-label*="Ads" i]').count();
      googleAdsData.competitors.length = adCount;
      
      if (adCount > 0) {
        // Extract competitor ad details
        const adHeadlines = await page.locator('div[data-text-ad] [role="heading"], [aria-label*="Ad" i] [role="heading"]').allTextContents();
        const adDescriptions = await page.locator('div[data-text-ad] [data-content-feature], [aria-label*="Ad" i] [data-content-feature]').allTextContents();
        
        googleAdsData.searchResults = adHeadlines
          .slice(0, 5)
          .filter(h => h.length > 0)
          .map((headline, i) => ({
            headline: headline.split('|')[0].split('-')[0].trim(),
            description: adDescriptions[i] || ''
          }));
        
        research.competitors = googleAdsData.searchResults.map(r => r.headline);
        research.competitorAds = adCount;
        
        console.log(`   🏢 Found ${adCount} competitor ads`);
        if (googleAdsData.searchResults.length > 0) {
          console.log(`   📋 Top ad: "${googleAdsData.searchResults[0].headline}"`);
        }
      }
      
      // Determine gap status
      if (!googleAdsData.hasAds && adCount > 0) {
        research.gaps.googleAds.hasGap = true;
        research.gaps.googleAds.impact = 10000;
        const topCompetitor = googleAdsData.searchResults[0]?.headline || 'competitors';
        research.gaps.googleAds.details = `Not running Google Ads. ${adCount} competitors (including ${topCompetitor}) are capturing leads when people search "${searchQuery}".`;
        research.gaps.googleAds.status = 'none';
        console.log(`   ❌ Not running Google Ads (${adCount} competitors are)`);
      } else if (googleAdsData.hasAds) {
        console.log(`   ✅ Running ${googleAdsData.adCount} Google Ads`);
        // They're advertising - optimization opportunity (like Meta)
        research.gaps.googleAds.hasGap = true;
        research.gaps.googleAds.impact = 5000; // Lower impact (optimization vs starting fresh)
        research.gaps.googleAds.details = `Running ${googleAdsData.adCount} Google Ad(s). We can audit your campaigns, improve Quality Score, optimize bidding, and likely cut CPA by 20-40%.`;
        research.gaps.googleAds.status = 'active';
      } else if (adCount === 0) {
        console.log(`   ⚠️  No competitor ads detected in this market`);
        research.gaps.googleAds.hasGap = true;
        research.gaps.googleAds.impact = 8000;
        research.gaps.googleAds.details = 'Market opportunity: No competitors advertising. You could dominate this space with proper Google Ads strategy.';
        research.gaps.googleAds.status = 'blue-ocean';
      }
      
    } catch (error) {
      console.log(`   ⚠️  Could not verify Google Ads (${error.message})`);
      // Mark as potential gap if we can't verify
      research.gaps.googleAds.hasGap = true;
      research.gaps.googleAds.impact = 10000;
      research.gaps.googleAds.details = 'Could not verify Google Ads status. Recommend investigation.';
    }
    
    research.googleAdsData = googleAdsData;
    
    // ========================================
    // STEP 4: CRM GAP (Always assume this as a gap)
    // ========================================
    console.log('\n💼 Evaluating CRM/Automation...');
    
    // Most small law firms don't have proper CRM automation
    research.gaps.crm.hasGap = true;
    research.gaps.crm.impact = 8000; // $8K/month avg
    research.gaps.crm.details = 'Manual follow-up wastes 15+ hrs/week and loses 40% of warm leads. Automation improves close rates 15-30%.';
    console.log(`   ⚠️  CRM/automation gap (assumed)`);
    
    // ========================================
    // CALCULATE TOTAL OPPORTUNITY
    // ========================================
    research.estimatedMonthlyRevenueLoss = 
      research.gaps.metaAds.impact +
      research.gaps.googleAds.impact +
      research.gaps.support24x7.impact +
      research.gaps.websiteSpeed.impact +
      research.gaps.crm.impact;
    
    console.log(`\n💰 Total Monthly Opportunity: $${research.estimatedMonthlyRevenueLoss.toLocaleString()}`);
    console.log(`💰 Annual Opportunity: $${(research.estimatedMonthlyRevenueLoss * 12).toLocaleString()}`);
    
  } catch (error) {
    console.error('\n❌ Error during research:', error.message);
  } finally {
    await browser.close();
  }
  
  console.log('\n✅ Research complete!\n');
  return research;
}

// If run directly
if (require.main === module) {
  const firmWebsite = process.argv[2];
  
  if (!firmWebsite) {
    console.error('Usage: node research-v2.js <firm-website-url>');
    console.error('Example: node research-v2.js https://example-lawfirm.com');
    process.exit(1);
  }
  
  researchFirm(firmWebsite).then(data => {
    console.log('📊 RESEARCH SUMMARY:\n');
    console.log(`Firm: ${data.firmName}`);
    console.log(`Location: ${data.location.city}, ${data.location.state}`);
    console.log(`Practice Areas: ${data.practiceAreas.slice(0, 3).join(', ')}`);
    console.log(`\nGaps Detected:`);
    
    Object.entries(data.gaps).forEach(([gap, info]) => {
      if (info.hasGap) {
        console.log(`  ❌ ${gap}: $${info.impact.toLocaleString()}/mo - ${info.details}`);
      }
    });
    
    console.log(`\nTotal Monthly Loss: $${data.estimatedMonthlyRevenueLoss.toLocaleString()}`);
    console.log(`Total Annual Loss: $${(data.estimatedMonthlyRevenueLoss * 12).toLocaleString()}`);
    
    // Save to file
    const firmSlug = data.firmName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const filename = `./reports/${firmSlug}-research.json`;
    
    if (!fs.existsSync('./reports')) {
      fs.mkdirSync('./reports');
    }
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`\n💾 Saved to: ${filename}`);
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { researchFirm };
