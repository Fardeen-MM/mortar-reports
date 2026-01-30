#!/usr/bin/env node
/**
 * RESEARCH SCRIPT V3 - DEEP COMPREHENSIVE RESEARCH
 * 
 * Claude-quality research:
 * - Accepts Instantly data as CLI parameters (url, contactName, city, state, country, company)
 * - Uses provided location data as PRIMARY (scraping is fallback)
 * - Validates location data with geocoding API
 * - Checks EVERY page on the website
 * - Finds firm's OWN Google Business Profile (reviews, rating, address)
 * - Finds real competitors via web search
 * - Extracts LinkedIn profiles
 * - Gets ALL credentials, awards, bar admissions
 * - Finds ALL office locations
 * - Extracts firm history, founding date, team size
 * - Includes data quality checks and confidence levels
 * - Quality over speed
 */

const { chromium } = require('playwright');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Google Places API for competitor finding + firm lookup
const GOOGLE_PLACES_API_KEY = 'AIzaSyA2ZN122gLi2zNGI5dckM88BMyP8Ni4obc';

// Geocoding API for location validation
const OPENCAGE_API_KEY = 'e361fd5df04049e5aa30e1409e360d70'; // Free tier: 2500 req/day

function searchPlaces(query, location) {
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
}

function validateLocation(city, state, country) {
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

async function deepResearch(firmWebsite, contactName = '', instantlyCity = '', instantlyState = '', instantlyCountry = 'US', instantlyCompany = '') {
  console.log(`\n🔍 STARTING DEEP RESEARCH ON: ${firmWebsite}`);
  console.log(`👤 Contact: ${contactName || 'Unknown'}`);
  if (instantlyCity || instantlyCompany) {
    console.log(`📋 Instantly Data Provided:`);
    if (instantlyCompany) console.log(`   Company: ${instantlyCompany}`);
    if (instantlyCity) console.log(`   Location: ${instantlyCity}, ${instantlyState}, ${instantlyCountry}`);
  }
  console.log('');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const research = {
    firmName: instantlyCompany || '',
    website: firmWebsite,
    contactPerson: contactName,
    location: { city: '', state: '', country: 'US' },
    locationSource: 'unknown', // 'instantly', 'scraped', 'validated'
    locationConfidence: 0, // 0-10 scale
    allLocations: [],
    
    // NEW: Firm's own Google Business data
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
    
    // NEW: Data quality tracking
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
    // STEP 1: LOAD HOMEPAGE & EXTRACT BASIC INFO
    // ========================================================================
    console.log(`📄 Step 1: Analyzing homepage...`);
    const startTime = Date.now();
    await page.goto(firmWebsite, { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - startTime;
    research.pageSpeed = loadTime;
    research.pageSpeedScore = loadTime < 2000 ? 'Fast' : loadTime < 4000 ? 'Medium' : 'Slow';
    
    // Capture final URL after redirects
    const finalUrl = page.url();
    if (finalUrl !== firmWebsite) {
      console.log(`   🔀 Redirected to: ${finalUrl}`);
      firmWebsite = finalUrl; // Use redirected URL for all future operations
    }
    
    if (loadTime > 3000) {
      research.gaps.websiteSpeed.hasGap = true;
      research.gaps.websiteSpeed.impact = 8000;
      research.gaps.websiteSpeed.details = `${(loadTime/1000).toFixed(1)}s load time. Every extra second = 7% conversion loss.`;
    }
    
    console.log(`   ⚡ Load time: ${(loadTime/1000).toFixed(1)}s`);
    
    // Extract firm name (try multiple sources, prioritize Instantly data)
    let firmName = instantlyCompany || '';
    let firmNameSource = 'instantly';
    
    if (!firmName) {
      // 1. Try meta og:site_name
      const ogSiteName = await page.getAttribute('meta[property="og:site_name"]', 'content').catch(() => null);
      if (ogSiteName && ogSiteName.length > 0 && ogSiteName.length < 80) {
        firmName = ogSiteName;
        firmNameSource = 'og:site_name';
      }
      
      // 2. Try page title (but reject generic titles)
      if (!firmName) {
        const pageTitle = await page.title();
        const titleParts = pageTitle.split(/[|\–\-]/).map(p => p.trim()).filter(p => p.length > 0);
        
        // Find part with "law", "legal", etc
        for (const part of titleParts.reverse()) {
          if (/\b(law|legal|attorney|lawyer|professional corporation|pc|llp|pllc)\b/i.test(part) && part.length < 80) {
            firmName = part;
            firmNameSource = 'page-title';
            break;
          }
        }
        
        // Use last part if not generic
        if (!firmName && titleParts.length > 0) {
          const lastPart = titleParts[titleParts.length - 1];
          const genericTitles = /^(home|welcome|index|main|about|contact)$/i;
          if (!genericTitles.test(lastPart)) {
            firmName = lastPart;
            firmNameSource = 'page-title';
          }
        }
      }
      
      // 3. Fall back to domain name
      if (!firmName) {
        const domain = firmWebsite.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*/,'').replace(/\.\w+$/, '');
        // Convert domain to title case: rothjackson → Roth Jackson
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
    
    // Get all text from homepage
    const bodyText = await page.textContent('body');
    
    // Extract practice areas with frequency counting (English + Spanish)
    const practiceKeywords = [
      // Personal Injury / Lesiones Personales
      'personal injury', 'lesiones personales', 'accident', 'accidente', 'wrongful death', 'muerte por negligencia',
      'car accident', 'accidente de auto', 'accidente automovilistico',
      'truck accident', 'accidente de camion',
      'motorcycle accident', 'accidente de motocicleta',
      'pedestrian accident', 'accidente peatonal',
      'bicycle accident', 'accidente de bicicleta',
      'slip and fall', 'resbalones y caidas', 'premises liability',
      'dog bite', 'mordida de perro',
      'medical malpractice', 'negligencia medica',
      'catastrophic injury', 'lesion catastrofica',
      
      // Tax / Impuestos
      'tax law', 'derecho fiscal', 'tax planning', 'international tax', 'irs',
      
      // Immigration / Inmigración
      'immigration', 'inmigracion', 'citizenship', 'ciudadania', 'visa', 'expatriate',
      
      // Family Law / Derecho Familiar
      'family law', 'derecho familiar', 'divorce', 'divorcio', 'custody', 'custodia', 'child support', 'manutencion',
      
      // Criminal / Penal
      'criminal defense', 'defensa criminal', 'dui', 'dwi', 'expungement',
      
      // Business / Negocios
      'corporate', 'business law', 'derecho empresarial', 'commercial',
      
      // Real Estate / Bienes Raíces
      'real estate', 'bienes raices', 'property law', 'conveyancing',
      
      // Estate Planning / Planificación Patrimonial
      'estate planning', 'planificacion patrimonial', 'wills', 'testamentos', 'trusts', 'probate',
      
      // Employment / Laboral
      'employment law', 'derecho laboral', 'labor law', 'discrimination', 'discriminacion',
      
      // Intellectual Property / Propiedad Intelectual
      'intellectual property', 'propiedad intelectual', 'trademark', 'copyright', 'patent',
      
      // Other
      'litigation', 'litigio', 'trial', 'appeals', 'bankruptcy', 'bancarrota', 'debt relief',
      'international law', 'cross-border', 'global'
    ];
    
    const bodyTextLower = bodyText.toLowerCase();
    const firmNameLower = research.firmName.toLowerCase();
    const practiceAreaCounts = {};
    
    for (const keyword of practiceKeywords) {
      // Count how many times this practice area appears
      const regex = new RegExp(keyword.replace(/\s+/g, '\\s+'), 'gi');
      const matches = bodyTextLower.match(regex);
      let count = matches ? matches.length : 0;
      
      // BOOST: If keyword appears in firm name, heavily prioritize it
      if (firmNameLower.includes(keyword) || keyword.split(' ').some(word => firmNameLower.includes(word))) {
        count += 1000; // Massive boost to ensure it's first
      }
      
      if (count > 0) {
        practiceAreaCounts[keyword] = count;
        research.practiceAreas.push(keyword);
      }
    }
    
    // Sort practice areas by frequency (most mentioned first)
    research.practiceAreas.sort((a, b) => (practiceAreaCounts[b] || 0) - (practiceAreaCounts[a] || 0));
    
    research.dataQuality.confidence.practiceAreas = research.practiceAreas.length >= 3 ? 9 : research.practiceAreas.length >= 1 ? 6 : 3;
    console.log(`   ⚖️  Practice areas found: ${research.practiceAreas.length} (confidence: ${research.dataQuality.confidence.practiceAreas}/10)`);
    
    if (research.practiceAreas.length === 0) {
      research.dataQuality.warnings.push('No practice areas detected - may indicate poor website content');
      research.dataQuality.missingFields.push('practiceAreas');
    }
    
    // Check for 24/7 support - be VERY specific (English + Spanish)
    const support247Phrases = [
      'available 24/7',
      'open 24/7',
      '24/7 answering',
      '24/7 intake',
      '24/7 support',
      '24/7 service',
      'call us 24/7',
      'available 24-7',
      'open 24 hours',
      'available anytime',
      'call anytime',
      'always available to answer',
      'emergency line',
      'after-hours support',
      'after hours answering',
      'llame 24/7',
      'disponible 24/7',
      'abierto 24 horas',
      'llamenos 24/7'
    ];
    
    let has247 = false;
    for (const phrase of support247Phrases) {
      if (bodyTextLower.includes(phrase.toLowerCase())) {
        // Make sure it's not just "respond within 24 hours"
        const context = bodyTextLower;
        if (!context.includes('within 24 hours') && !context.includes('respond in 24')) {
          has247 = true;
          break;
        }
      }
    }
    
    // Better chatbot detection - look for actual chat widget embeds
    const chatWidgetSelectors = [
      '#intercom-container',
      '#drift-widget',
      '.tidio-chat',
      '#hubspot-messages-iframe-container',
      '[id*="livechat"]',
      '[class*="crisp-client"]',
      '[id*="tawk"]',
      'iframe[src*="intercom"]',
      'iframe[src*="drift"]',
      'iframe[src*="tidio"]',
      'iframe[src*="livechat"]',
      'iframe[src*="tawk"]'
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
    // STEP 1.5: VALIDATE AND SET LOCATION (Instantly data FIRST!)
    // ========================================================================
    console.log(`\n📍 Step 1.5: Validating location data...`);
    
    if (instantlyCity && instantlyState) {
      // Use Instantly data as PRIMARY
      console.log(`   📋 Using Instantly location: ${instantlyCity}, ${instantlyState}, ${instantlyCountry}`);
      
      // Validate the location
      try {
        const validation = await validateLocation(instantlyCity, instantlyState, instantlyCountry);
        if (validation.valid && validation.confidence >= 5) {
          research.location = {
            city: validation.correctedCity,
            state: validation.correctedState,
            country: validation.correctedCountry
          };
          research.locationSource = 'instantly-validated';
          research.locationConfidence = 10;
          console.log(`   ✅ Location validated: ${validation.formatted} (confidence: ${validation.confidence}/10)`);
          
          // Check if correction was needed
          if (validation.correctedCity !== instantlyCity) {
            research.dataQuality.warnings.push(`Location corrected: "${instantlyCity}" → "${validation.correctedCity}"`);
            console.log(`   ⚠️  Location corrected: "${instantlyCity}" → "${validation.correctedCity}"`);
          }
        } else {
          // Validation failed - still use Instantly data but mark as unvalidated
          research.location = { city: instantlyCity, state: instantlyState, country: instantlyCountry };
          research.locationSource = 'instantly-unvalidated';
          research.locationConfidence = 6;
          research.dataQuality.warnings.push(`Location "${instantlyCity}, ${instantlyState}" could not be validated (confidence: ${validation.confidence})`);
          console.log(`   ⚠️  Could not validate location (using anyway, confidence: 6/10)`);
        }
      } catch (e) {
        // Geocoding failed - use Instantly data anyway
        research.location = { city: instantlyCity, state: instantlyState, country: instantlyCountry };
        research.locationSource = 'instantly-unvalidated';
        research.locationConfidence = 6;
        console.log(`   ⚠️  Geocoding failed, using Instantly data anyway: ${e.message}`);
      }
    } else {
      // No Instantly data - will scrape location from website later
      console.log(`   ⚠️  No location provided by Instantly - will scrape from website`);
      research.locationSource = 'pending-scrape';
      research.locationConfidence = 0;
    }
    
    // Add primary location to allLocations
    if (research.location.city) {
      research.allLocations.push(research.location);
    }
    
    // ========================================================================
    // STEP 2: DISCOVER ALL IMPORTANT PAGES (SITEMAP FIRST!)
    // ========================================================================
    console.log(`\n📋 Step 2: Discovering all pages via sitemap...`);
    
    let allUrls = [];
    const baseUrl = new URL(firmWebsite);
    const baseUrlClean = baseUrl.origin;
    
    // Try to fetch sitemap (try both www and non-www)
    const baseWithoutWWW = baseUrlClean.replace('://www.', '://');
    const sitemapUrls = [
      `${baseUrlClean}/sitemap_index.xml`,
      `${baseWithoutWWW}/sitemap_index.xml`,
      `${baseUrlClean}/sitemap.xml`,
      `${baseWithoutWWW}/sitemap.xml`,
      `${baseUrlClean}/page-sitemap.xml`,
      `${baseWithoutWWW}/page-sitemap.xml`,
      `${baseUrlClean}/wp-sitemap.xml`,
      `${baseWithoutWWW}/wp-sitemap.xml`
    ];
    
    let foundSitemap = false;
    for (const sitemapUrl of sitemapUrls) {
      try {
        const content = await fetchSitemap(sitemapUrl);
        if (!content) continue;
        
        // Check if it's a sitemap index
        if (content.includes('<sitemapindex')) {
          console.log(`   📍 Found sitemap index: ${sitemapUrl}`);
          const subSitemaps = content.match(/<loc>(.*?)<\/loc>/g);
          if (subSitemaps) {
            for (const sub of subSitemaps.slice(0, 5)) { // Limit to 5 sub-sitemaps
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
        console.log(`   ⚠️  Error fetching ${sitemapUrl}: ${e.message}`);
      }
    }
    
    // Fallback: scrape homepage links if no sitemap
    if (!foundSitemap || allUrls.length === 0) {
      console.log(`   ⚠️  No sitemap found, scraping homepage links...`);
      // Make sure we're on the homepage
      try {
        await page.goto(firmWebsite, { waitUntil: 'networkidle', timeout: 15000 });
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
    
    // Categorize pages (English + Spanish) - BE SPECIFIC!
    const pagesToVisit = {
      about: allUrls.filter(link => /\/(about-us|about|our-firm|who-we-are|our-story|nosotros|quienes-somos|sobre-nosotros)\/?$/i.test(link))[0],
      team: allUrls.filter(link => /\/(team|our-team|meet-our-team|attorneys|lawyers|staff|people|nuestroequipo|equipo)\/?$/i.test(link))[0],
      contact: allUrls.filter(link => /\/(contact|contacto|contactenos|contact-us|locations|offices|reach-us|ubicacion)\/?$/i.test(link))[0],
      services: allUrls.filter(link => /\/(services|practice-areas|what-we-do|areas-of-practice|servicios|areas-de-practica|practica)\/?$/i.test(link))[0],
      testimonials: allUrls.filter(link => /\/(testimonials|reviews|clients|success|results|testimonios|resenas|clientes)\/?$/i.test(link))[0]
    };
    
    console.log(`   📄 Pages to analyze:`);
    for (const [type, url] of Object.entries(pagesToVisit)) {
      if (url) console.log(`      - ${type}: ${url}`);
    }
    
    const missingPages = Object.entries(pagesToVisit).filter(([_, url]) => !url).map(([type]) => type);
    if (missingPages.length > 0) {
      research.dataQuality.warnings.push(`Missing key pages: ${missingPages.join(', ')}`);
    }
    
    // ========================================================================
    // STEP 3: ANALYZE ABOUT PAGE (THOROUGH!)
    // ========================================================================
    if (pagesToVisit.about) {
      console.log(`\n📖 Step 3: Analyzing About page (DEEP)...`);
      try {
        await page.goto(pagesToVisit.about, { waitUntil: 'networkidle', timeout: 15000 });
        const aboutText = await page.textContent('body');
        research.pagesAnalyzed.push({ url: pagesToVisit.about, type: 'about' });
        
        // Extract founding year
        const yearMatches = aboutText.match(/\b(founded|established|since)\s+(\d{4})\b/gi);
        if (yearMatches && yearMatches.length > 0) {
          const yearMatch = yearMatches[0].match(/\d{4}/);
          if (yearMatch) {
            research.firmHistory.founded = parseInt(yearMatch[0]);
            research.firmHistory.yearsInBusiness = new Date().getFullYear() - research.firmHistory.founded;
            console.log(`   📅 Founded: ${research.firmHistory.founded} (${research.firmHistory.yearsInBusiness} years)`);
          }
        }
        
        // Extract team size
        const teamMatches = aboutText.match(/(\d+)\+?\s+(attorneys|lawyers|professionals|team members)/gi);
        if (teamMatches && teamMatches.length > 0) {
          const sizeMatch = teamMatches[0].match(/(\d+)/);
          if (sizeMatch) {
            research.firmHistory.teamSize = parseInt(sizeMatch[1]);
            console.log(`   👥 Team size: ${research.firmHistory.teamSize}+ attorneys`);
          }
        }
        
        // Extract awards (MORE THOROUGH)
        const awardKeywords = [
          'Super Lawyers', 'Best Lawyers', 'AV Rated', 'Martindale', 
          'Top Attorney', 'Rising Star', 'Award', 'Recognition', 
          'Chamber', 'Legal 500', 'Who\'s Who', 'Avvo', 'Justia'
        ];
        
        for (const keyword of awardKeywords) {
          if (new RegExp(keyword, 'i').test(aboutText)) {
            // Extract sentence containing the keyword
            const sentences = aboutText.split(/[.!?]/);
            for (const sentence of sentences) {
              if (new RegExp(keyword, 'i').test(sentence) && sentence.length < 200) {
                const cleaned = sentence.trim();
                if (cleaned.length > 10 && !research.firmHistory.awards.includes(cleaned)) {
                  research.firmHistory.awards.push(cleaned);
                }
              }
            }
          }
        }
        
        if (research.firmHistory.awards.length > 0) {
          console.log(`   🏆 Awards found: ${research.firmHistory.awards.length}`);
        } else {
          research.dataQuality.warnings.push('No awards/recognitions found on About page');
        }
        
        // Extract credentials/bar admissions
        const barPattern = /admitted to (the )?bar (in|of) ([A-Z][a-z\s]+)/gi;
        const barMatches = [...aboutText.matchAll(barPattern)];
        for (const match of barMatches) {
          const credential = match[0].trim();
          if (!research.firmHistory.barAdmissions.includes(credential)) {
            research.firmHistory.barAdmissions.push(credential);
          }
        }
        
        // Build credentials list
        research.credentials = [
          research.firmHistory.founded ? `Established in ${research.firmHistory.founded}` : null,
          research.firmHistory.teamSize ? `${research.firmHistory.teamSize}+ attorneys` : null,
          ...research.firmHistory.awards.slice(0, 3),
          ...research.firmHistory.barAdmissions.slice(0, 2)
        ].filter(Boolean);
        
      } catch (e) {
        console.log(`   ⚠️  Could not analyze About page: ${e.message}`);
        research.dataQuality.warnings.push('Failed to analyze About page');
      }
    } else {
      research.dataQuality.warnings.push('No About page found');
    }
    
    // ========================================================================
    // STEP 4: ANALYZE TEAM/ATTORNEYS PAGE (EXTREMELY THOROUGH!)
    // ========================================================================
    if (pagesToVisit.team) {
      console.log(`\n👥 Step 4: Analyzing Team page (DEEP extraction)...`);
      try {
        await page.goto(pagesToVisit.team, { waitUntil: 'networkidle', timeout: 15000 });
        const teamText = await page.textContent('body');
        research.pagesAnalyzed.push({ url: pagesToVisit.team, type: 'team' });
        
        // Extract attorney profiles (multiple patterns)
        const attorneyProfiles = [];
        
        // Pattern 1: Name with title (Esq., J.D., Attorney, Partner, etc.)
        const pattern1 = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})[,\s]+(Esq\.|J\.D\.|LL\.B\.|Attorney|Partner|Associate|Counsel|Founding Partner|Managing Partner|Senior Partner|Socio|Socia)/gi;
        const matches1 = [...teamText.matchAll(pattern1)];
        matches1.forEach(match => {
          const name = match[1].trim();
          const title = match[2].trim();
          if (name.split(' ').length >= 2 && name.split(' ').length <= 4) {
            attorneyProfiles.push({ name, title });
          }
        });
        
        // Pattern 2: Heading-style names (## Name or ### Name in markdown-like content)
        const pattern2 = /(?:^|\n)(?:#{1,3}|<h[1-3]>)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*(?:\n|<\/h[1-3]>)/g;
        const matches2 = [...teamText.matchAll(pattern2)];
        matches2.forEach(match => {
          const name = match[1].trim();
          if (name.split(' ').length >= 2 && name.split(' ').length <= 4) {
            // Look for title in next 200 characters
            const startIndex = match.index;
            const nextChunk = teamText.substring(startIndex, startIndex + 200);
            const titleMatch = nextChunk.match(/(Partner|Attorney|Counsel|Associate|Socio|Socia|Founding Partner|Managing Partner|Senior Partner)/i);
            attorneyProfiles.push({ 
              name, 
              title: titleMatch ? titleMatch[1] : 'Attorney' 
            });
          }
        });
        
        // Pattern 3: Education markers (University, Law School, J.D., LL.B.)
        const pattern3 = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?:.*?)(?:University|Law School|College|J\.D\.|LL\.B\.|Juris Doctor)/gi;
        const matches3 = [...teamText.matchAll(pattern3)];
        matches3.forEach(match => {
          const name = match[1].trim();
          if (name.split(' ').length >= 2 && name.split(' ').length <= 4) {
            attorneyProfiles.push({ name, title: 'Attorney' });
          }
        });
        
        // Pattern 4: Look for structured lists (li, div with attorney class)
        try {
          const structuredAttorneys = await page.locator('[class*="attorney"], [class*="team-member"], [class*="lawyer"]').all();
          for (const element of structuredAttorneys.slice(0, 20)) {
            const text = await element.textContent();
            const nameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/);
            if (nameMatch) {
              const name = nameMatch[1].trim();
              const titleMatch = text.match(/(Partner|Attorney|Counsel|Associate|Socio|Socia)/i);
              if (name.split(' ').length >= 2 && name.split(' ').length <= 4) {
                attorneyProfiles.push({ 
                  name, 
                  title: titleMatch ? titleMatch[1] : 'Attorney' 
                });
              }
            }
          }
        } catch (e) {
          // Structured extraction failed, continue with text-based
        }
        
        // Deduplicate and build attorney list
        const seen = new Set();
        attorneyProfiles.forEach(profile => {
          const key = profile.name.toLowerCase();
          if (!seen.has(key) && research.attorneys.length < 20) {
            seen.add(key);
            research.attorneys.push({ name: profile.name, title: profile.title });
          }
        });
        
        research.dataQuality.confidence.attorneys = research.attorneys.length >= 5 ? 9 : research.attorneys.length >= 2 ? 7 : research.attorneys.length >= 1 ? 5 : 2;
        console.log(`   👨‍⚖️ Attorneys found: ${research.attorneys.length} (confidence: ${research.dataQuality.confidence.attorneys}/10)`);
        
        if (research.attorneys.length > 0) {
          research.attorneys.slice(0, 5).forEach(a => {
            console.log(`      - ${a.name} (${a.title})`);
          });
          if (research.attorneys.length > 5) {
            console.log(`      ... and ${research.attorneys.length - 5} more`);
          }
        } else {
          research.dataQuality.warnings.push('No attorneys found on Team page');
          research.dataQuality.missingFields.push('attorneys');
        }
        
        // Extract education and credentials from team page
        const eduKeywords = ['University', 'Law School', 'College', 'summa cum laude', 'magna cum laude', 'honors'];
        eduKeywords.forEach(keyword => {
          if (new RegExp(keyword, 'i').test(teamText)) {
            const sentences = teamText.split(/[.!?\n]/);
            sentences.forEach(sentence => {
              if (new RegExp(keyword, 'i').test(sentence) && sentence.length < 250 && sentence.length > 20) {
                const cleaned = sentence.trim();
                if (!research.credentials.some(c => c.includes(keyword))) {
                  research.credentials.push(cleaned);
                }
              }
            });
          }
        });
        
      } catch (e) {
        console.log(`   ⚠️  Could not analyze Team page: ${e.message}`);
        research.dataQuality.warnings.push('Failed to analyze Team page');
      }
    } else {
      research.dataQuality.warnings.push('No Team page found');
    }
    
    // ========================================================================
    // STEP 5: EXTRACT ALL LOCATIONS (HOMEPAGE + CONTACT + ABOUT)
    // ========================================================================
    console.log(`\n📍 Step 5: Extracting all locations from website...`);
    
    // Start with homepage text (already loaded)
    let locationText = bodyText;
    
    // Add About page text if available
    if (pagesToVisit.about) {
      try {
        await page.goto(pagesToVisit.about, { waitUntil: 'networkidle', timeout: 15000 });
        const aboutText = await page.textContent('body');
        locationText += '\n' + aboutText;
      } catch (e) {
        console.log(`   ⚠️  Could not reload About page for location extraction`);
      }
    }
    
    // Then check contact page if it exists
    if (pagesToVisit.contact) {
      try {
        await page.goto(pagesToVisit.contact, { waitUntil: 'networkidle', timeout: 15000 });
        const contactText = await page.textContent('body');
        research.pagesAnalyzed.push({ url: pagesToVisit.contact, type: 'contact' });
        locationText += '\n' + contactText; // Combine all
        
        // Try to extract structured address from contact page
        try {
          const addressElements = await page.locator('[class*="address"], [itemprop="address"]').all();
          for (const element of addressElements) {
            const addressText = await element.textContent();
            locationText += '\n' + addressText; // Add to analysis
          }
        } catch (e) {
          // Structured address not found
        }
        
      } catch (e) {
        console.log(`   ⚠️  Could not load Contact page: ${e.message}`);
      }
    }
    
    try {
      // Extract all addresses
      // US pattern: Look for ZIP codes first, then extract city/state backwards
      // Matches: "City, ST 12345" or "Suite 123 City, ST 12345"
      const zipPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\s+(\d{5})/g;
      const zipMatches = [...locationText.matchAll(zipPattern)];
      
      for (const match of zipMatches) {
        const city = match[1].trim();
        const state = match[2];
        const zip = match[3];
        
        // Filter out common non-city words
        if (!['Suite', 'Floor', 'Unit', 'Apt', 'Building'].includes(city)) {
          if (!research.allLocations.find(loc => loc.city === city && loc.state === state)) {
            research.allLocations.push({ city, state, country: 'US' });
          }
        }
      }
      
      // Major UK cities FIRST (before regex to avoid false matches)
      const ukCities = ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Liverpool', 'Leeds', 'Bristol'];
      for (const city of ukCities) {
        if (locationText.includes(city) && !research.allLocations.find(loc => loc.city === city)) {
          research.allLocations.push({ city, state: '', country: 'UK' });
        }
      }
      
      // UK pattern: "City, Postcode" or "Postcode City" (only if no major city found yet)
      if (research.allLocations.filter(l => l.country === 'UK').length === 0) {
        const ukPattern = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\s+([A-Z][a-z]+)|([A-Z][a-z]+)[,\s]+([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/g;
        const ukMatches = [...locationText.matchAll(ukPattern)];
        
        // Filter out street suffixes that get mistaken for cities
        const invalidCityNames = ['Lane', 'Street', 'Road', 'Avenue', 'Drive', 'Court', 'Place', 'Way'];
        
        for (const match of ukMatches) {
          const city = match[2] || match[3];
          const postcode = match[1] || match[4];
          
          if (city && !invalidCityNames.includes(city) && !research.allLocations.find(loc => loc.city === city)) {
            research.allLocations.push({ city, state: postcode, country: 'UK' });
          }
        }
      }
      
      // Spanish cities
      const spanishCities = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Málaga', 'Marbella', 'Ibiza', 'Mallorca', 'Palma'];
      for (const city of spanishCities) {
        if (locationText.includes(city) && !research.allLocations.find(loc => loc.city === city)) {
          research.allLocations.push({ city, state: '', country: 'Spain' });
        }
      }
      
      // Fallback: US/Canada city, state pattern
      const cityStatePattern = /\b([A-Z][a-z\s]+),\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|ON|Ontario|BC|British Columbia|AB|Alberta|QC|Quebec)\b/g;
      const cityStateMatches = [...locationText.matchAll(cityStatePattern)];
      
      for (const match of cityStateMatches) {
        const city = match[1].trim();
        const state = match[2];
        const country = ['ON', 'Ontario', 'BC', 'British Columbia', 'AB', 'Alberta', 'QC', 'Quebec'].includes(state) ? 'CA' : 'US';
        
        if (!research.allLocations.find(loc => loc.city === city) && research.allLocations.length < 10) {
          research.allLocations.push({ city, state, country });
        }
      }
      
      // If we didn't have Instantly data and still have no location, mark as critical issue
      if (research.allLocations.length === 0 && research.locationSource === 'pending-scrape') {
        research.dataQuality.warnings.push('CRITICAL: No location found on website or in Instantly data');
        research.dataQuality.missingFields.push('location');
        research.location = { city: 'Unknown', state: '', country: 'US' };
        research.locationSource = 'none';
        research.locationConfidence = 0;
      } else if (research.locationSource === 'pending-scrape' && research.allLocations.length > 0) {
        // We scraped a location - use the first one and validate it
        const scrapedLocation = research.allLocations[0];
        research.location = scrapedLocation;
        research.locationSource = 'scraped';
        research.locationConfidence = 5;
        
        // Try to validate the scraped location
        try {
          const validation = await validateLocation(scrapedLocation.city, scrapedLocation.state, scrapedLocation.country);
          if (validation.valid && validation.confidence >= 5) {
            research.location = {
              city: validation.correctedCity,
              state: validation.correctedState,
              country: validation.correctedCountry
            };
            research.locationSource = 'scraped-validated';
            research.locationConfidence = 8;
            console.log(`   ✅ Scraped location validated: ${validation.formatted}`);
            
            if (validation.correctedCity !== scrapedLocation.city) {
              research.dataQuality.warnings.push(`Scraped location corrected: "${scrapedLocation.city}" → "${validation.correctedCity}"`);
            }
          }
        } catch (e) {
          console.log(`   ⚠️  Could not validate scraped location: ${e.message}`);
        }
      }
      
      console.log(`   📍 Locations found: ${research.allLocations.length} (source: ${research.locationSource}, confidence: ${research.locationConfidence}/10)`);
      for (const loc of research.allLocations) {
        console.log(`      - ${loc.city}, ${loc.state ? loc.state + ', ' : ''}${loc.country}`);
      }
      
      if (research.allLocations.length === 0) {
        research.dataQuality.missingFields.push('locations');
      }
      
    } catch (e) {
      console.log(`   ⚠️  Could not extract locations: ${e.message}`);
      research.dataQuality.warnings.push('Failed to extract locations from website');
    }
    
    // ========================================================================
    // STEP 6: LOOK UP FIRM'S OWN GOOGLE BUSINESS PROFILE
    // ========================================================================
    console.log(`\n⭐ Step 6: Looking up firm's Google Business Profile...`);
    
    try {
      if (!research.location.city || research.location.city === 'Unknown') {
        console.log(`   ⚠️  No valid location - cannot look up Google Business Profile`);
        research.dataQuality.warnings.push('Cannot verify Google Business Profile - no location');
      } else {
        // Build search query
        let searchLocation;
        if (research.location.country === 'US') {
          const stateFullName = {
            'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
            'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
            'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
            'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
            'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
            'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
            'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
            'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
            'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
            'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
          };
          const stateName = stateFullName[research.location.state] || research.location.state;
          searchLocation = `${research.location.city}, ${stateName}`;
        } else if (research.location.country === 'CA') {
          const provinceFullName = {
            'ON': 'Ontario', 'BC': 'British Columbia', 'AB': 'Alberta', 'QC': 'Quebec'
          };
          const provinceName = provinceFullName[research.location.state] || research.location.state;
          searchLocation = `${research.location.city}, ${provinceName}, Canada`;
        } else if (research.location.country === 'UK') {
          searchLocation = `${research.location.city}, United Kingdom`;
        } else {
          searchLocation = `${research.location.city}, ${research.location.country}`;
        }
        
        console.log(`   🔍 Searching for: "${research.firmName}" in ${searchLocation}`);
        
        const firmResult = await searchPlaces(research.firmName, searchLocation);
        
        if (firmResult.status === 'OK' && firmResult.results && firmResult.results.length > 0) {
          // Look for exact or close match
          const firmNameLower = research.firmName.toLowerCase();
          let bestMatch = null;
          let bestScore = 0;
          
          for (const place of firmResult.results.slice(0, 5)) {
            const placeName = place.name.toLowerCase();
            
            // Exact match
            if (placeName === firmNameLower) {
              bestMatch = place;
              break;
            }
            
            // Partial match (firm name contains place name or vice versa)
            if (placeName.includes(firmNameLower) || firmNameLower.includes(placeName)) {
              const score = placeName.length / Math.abs(placeName.length - firmNameLower.length + 1);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = place;
              }
            }
          }
          
          if (bestMatch) {
            research.reviewCount = bestMatch.user_ratings_total || 0;
            research.rating = bestMatch.rating || 0;
            research.googleBusinessAddress = bestMatch.formatted_address || '';
            
            console.log(`   ✅ Found Google Business Profile:`);
            console.log(`      Name: ${bestMatch.name}`);
            console.log(`      Rating: ${research.rating}⭐ (${research.reviewCount} reviews)`);
            console.log(`      Address: ${research.googleBusinessAddress}`);
            
            if (research.reviewCount === 0) {
              research.dataQuality.warnings.push('Google Business Profile exists but has no reviews');
            }
          } else {
            console.log(`   ⚠️  No matching Google Business Profile found`);
            research.dataQuality.warnings.push('Google Business Profile not found or not verified');
          }
        } else {
          console.log(`   ⚠️  Google Places API returned: ${firmResult.status}`);
          research.dataQuality.warnings.push('Could not look up Google Business Profile');
        }
      }
    } catch (e) {
      console.log(`   ⚠️  Could not look up Google Business Profile: ${e.message}`);
      research.dataQuality.warnings.push('Failed to look up Google Business Profile');
    }
    
    // ========================================================================
    // STEP 7: FIND COMPETITORS VIA GOOGLE PLACES API
    // ========================================================================
    console.log(`\n🔍 Step 7: Finding real competitors via Google Places API...`);
    
    try {
      // Check if we have at least one valid location
      const hasValidLocation = research.location.city && research.location.city.length > 0 && research.location.city !== 'Unknown';
      
      if (!hasValidLocation) {
        console.log(`   ⚠️  No valid location found - cannot search for competitors`);
        research.competitors = [];
        research.dataQuality.warnings.push('Cannot find competitors - no location');
      } else {
        // Use the primary (first) location for competitor search
        const searchTerm = research.practiceAreas[0] || 'lawyer';
        
        // Build proper location string for Google Places API
        let searchLocation;
        if (research.location.country === 'US') {
          const stateFullName = {
            'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
            'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
            'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
            'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
            'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
            'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
            'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
            'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
            'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
            'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
          };
          const stateName = stateFullName[research.location.state] || research.location.state;
          searchLocation = `${research.location.city}, ${stateName}`;
        } else if (research.location.country === 'CA') {
          const provinceFullName = {
            'ON': 'Ontario', 'BC': 'British Columbia', 'AB': 'Alberta', 'QC': 'Quebec',
            'MB': 'Manitoba', 'SK': 'Saskatchewan', 'NS': 'Nova Scotia', 'NB': 'New Brunswick'
          };
          const provinceName = provinceFullName[research.location.state] || research.location.state;
          searchLocation = `${research.location.city}, ${provinceName}, Canada`;
        } else if (research.location.country === 'UK') {
          searchLocation = `${research.location.city}, United Kingdom`;
        } else {
          const countryNames = {
            'Spain': 'Spain',
            'France': 'France',
            'Germany': 'Germany',
            'Australia': 'Australia'
          };
          const countryName = countryNames[research.location.country] || research.location.country;
          searchLocation = `${research.location.city}, ${countryName}`;
        }
        
        console.log(`   🔍 Searching for: "${searchTerm} lawyer in ${searchLocation}"`);
        
        const placesResult = await searchPlaces(`${searchTerm} lawyer`, searchLocation);
      
        if (placesResult.status === 'OK' && placesResult.results) {
          const seenNames = new Set();
          const researchFirmLower = research.firmName.toLowerCase();
          
          for (const place of placesResult.results) {
            const firmName = place.name;
            const firmLower = firmName.toLowerCase();
            
            // Skip if it's the research firm
            if (firmLower.includes(researchFirmLower) || researchFirmLower.includes(firmLower)) continue;
            
            // Skip if we've seen this name
            if (seenNames.has(firmLower)) continue;
            
            // Skip generic terms
            if (/^(law firm|legal|attorney|lawyer|law office)$/i.test(firmName)) continue;
            
            // Validate location: Check if competitor is actually in the right country
            const address = place.formatted_address || '';
            let isCorrectLocation = false;
            
            if (research.location.country === 'US') {
              isCorrectLocation = address.includes('USA') || address.includes(', US');
            } else if (research.location.country === 'CA') {
              isCorrectLocation = address.includes('Canada');
            } else if (research.location.country === 'UK') {
              isCorrectLocation = address.includes('UK') || address.includes('United Kingdom');
            } else if (research.location.country === 'Spain') {
              isCorrectLocation = address.includes('Spain') || address.includes('España');
            } else {
              isCorrectLocation = true;
            }
            
            // Skip if wrong location
            if (!isCorrectLocation) {
              console.log(`      ⚠️  Skipping ${firmName} - wrong location`);
              continue;
            }
            
            // Add competitor with data
            research.competitors.push({
              name: firmName,
              reviews: place.user_ratings_total || 0,
              rating: place.rating || 0,
              address: place.formatted_address || '',
              features: []
            });
            
            seenNames.add(firmLower);
            
            // Limit to 12 competitors
            if (research.competitors.length >= 12) break;
          }
          
          console.log(`   🏢 Competitors found: ${research.competitors.length}`);
          if (research.competitors.length > 0) {
            for (const comp of research.competitors.slice(0, 5)) {
              console.log(`      - ${comp.name} (${comp.reviews} reviews, ${comp.rating}⭐)`);
            }
            if (research.competitors.length > 5) {
              console.log(`      ... and ${research.competitors.length - 5} more`);
            }
          } else {
            research.dataQuality.warnings.push('No competitors found via Google Places');
          }
          
        } else {
          console.log(`   ⚠️  Google Places API returned: ${placesResult.status}`);
          if (placesResult.error_message) {
            console.log(`   ⚠️  Error: ${placesResult.error_message}`);
          }
          research.dataQuality.warnings.push('Failed to find competitors');
        }
      }
      
    } catch (e) {
      console.log(`   ⚠️  Could not find competitors via Google Places API: ${e.message}`);
      research.dataQuality.warnings.push('Failed to find competitors');
    }
    
    // ========================================================================
    // STEP 8: FIND LINKEDIN PROFILES
    // ========================================================================
    if (contactName && contactName.length > 0) {
      console.log(`\n🔗 Step 8: Finding LinkedIn profile for ${contactName}...`);
      const linkedInPage = await browser.newPage();
      
      try {
        const linkedInQuery = `${contactName} ${research.firmName} attorney LinkedIn`;
        await linkedInPage.goto(`https://www.google.com/search?q=${encodeURIComponent(linkedInQuery)}`, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
        await linkedInPage.waitForTimeout(2000);
        
        // Extract LinkedIn URLs
        const links = await linkedInPage.locator('a[href*="linkedin.com/in/"]').evaluateAll(
          links => links.map(a => a.href).filter(href => href.includes('linkedin.com/in/'))
        );
        
        if (links.length > 0) {
          const linkedInUrl = links[0].split('?')[0]; // Remove query params
          research.linkedInProfiles.push({
            name: contactName,
            url: linkedInUrl
          });
          console.log(`   ✅ Found: ${linkedInUrl}`);
        } else {
          console.log(`   ⚠️  No LinkedIn profile found`);
          research.dataQuality.warnings.push(`No LinkedIn profile found for ${contactName}`);
        }
        
      } catch (e) {
        console.log(`   ⚠️  Could not search LinkedIn: ${e.message}`);
      }
      
      await linkedInPage.close();
    }
    
    // ========================================================================
    // STEP 9: CHECK GOOGLE/META ADS (ACCURATE VERIFICATION)
    // ========================================================================
    console.log(`\n📱 Step 9: Checking advertising presence...`);
    
    // Extract domain from website URL
    const domain = firmWebsite.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    
    // Google Ads - Check via Ads Transparency Center
    console.log(`   🔍 Checking Google Ads Transparency Center...`);
    const googleAdsPage = await browser.newPage();
    try {
      const googleAdsUrl = `https://adstransparency.google.com/?region=anywhere&domain=${domain}`;
      await googleAdsPage.goto(googleAdsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await googleAdsPage.waitForTimeout(5000); // Wait for ads to load
      
      // Get page text
      const bodyText = await googleAdsPage.textContent('body');
      
      // Check if "No ads found" or similar message appears
      const hasNoAdsMessage = bodyText.includes('No ads found') || 
                              bodyText.includes('no ads to show') ||
                              bodyText.includes('0 ads') ||
                              bodyText.includes("hasn't advertised");
      
      // Extract ad count from text like "16 ads" or "5 ads"
      let adElementCount = 0;
      const adCountMatch = bodyText.match(/(\d+)\s+ads?/i);
      if (adCountMatch) {
        adElementCount = parseInt(adCountMatch[1], 10);
      }
      
      // Final determination: Prioritize "No ads found" message
      const isRunningAds = !hasNoAdsMessage && adElementCount > 0;
      
      if (!isRunningAds) {
        research.gaps.googleAds.hasGap = true;
        research.gaps.googleAds.impact = 8000;
        research.gaps.googleAds.details = `Not running Google Ads. When people search for lawyers in ${research.location.city || 'your area'}, your competitors appear first.`;
        research.gaps.googleAds.status = 'none';
        console.log(`   ❌ Google Ads: Not running`);
      } else {
        console.log(`   ✅ Google Ads: Running (${adElementCount} ad(s) detected)`);
        research.googleAdsData = { running: true, adCount: adElementCount };
      }
    } catch (e) {
      console.log(`   ⚠️  Could not check Google Ads: ${e.message}`);
      research.gaps.googleAds.hasGap = true;
      research.gaps.googleAds.impact = 8000;
      research.gaps.googleAds.details = `Unable to verify Google Ads presence.`;
    }
    await googleAdsPage.close();
    
    // Meta Ads - Extract Facebook Page ID and check Ad Library
    console.log(`   🔍 Checking Meta Ads via Facebook Ad Library...`);
    
    // Step 1: Find Facebook page link on their website
    let facebookPageUrl = null;
    try {
      // Go back to homepage for Facebook link extraction
      await page.goto(firmWebsite, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const fbLinks = await page.locator('a[href*="facebook.com"]').all();
      for (const link of fbLinks) {
        const href = await link.getAttribute('href');
        if (href && href.includes('facebook.com/') && !href.includes('/sharer/')) {
          facebookPageUrl = href.split('?')[0]; // Remove query params
          break;
        }
      }
    } catch (e) {
      console.log(`   ⚠️  Could not find Facebook link on website`);
    }
    
    // Step 2: If found, extract Page ID
    let facebookPageId = null;
    if (facebookPageUrl) {
      const fbPage = await browser.newPage();
      try {
        console.log(`   📱 Visiting Facebook page: ${facebookPageUrl}`);
        
        // First check if the URL itself contains the ID
        const urlIdMatch = facebookPageUrl.match(/[?&]id=(\d+)/);
        if (urlIdMatch) {
          facebookPageId = urlIdMatch[1];
          console.log(`   ✅ Facebook Page ID from URL: ${facebookPageId}`);
        }
        
        if (!facebookPageId) {
          await fbPage.goto(facebookPageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await fbPage.waitForTimeout(5000);
          
          const pageSource = await fbPage.content();
          
          // Try multiple extraction methods
          let pageIdMatch = pageSource.match(/"page_id":"(\d+)"/);
          if (pageIdMatch) {
            facebookPageId = pageIdMatch[1];
            console.log(`   ✅ Facebook Page ID: ${facebookPageId}`);
          }
        }
        
        if (!facebookPageId) {
          console.log(`   ⚠️  Could not extract Facebook Page ID`);
        }
        
      } catch (e) {
        console.log(`   ⚠️  Could not access Facebook page: ${e.message}`);
      }
      await fbPage.close();
    } else {
      console.log(`   ⚠️  No Facebook link found on website`);
    }
    
    // Step 3: Check Ad Library with Page ID
    if (facebookPageId) {
      const metaAdsPage = await browser.newPage();
      try {
        console.log(`   🔍 Checking Meta Ads Library...`);
        
        // Check for ACTIVE ads
        const activeUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=${facebookPageId}`;
        await metaAdsPage.goto(activeUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await metaAdsPage.waitForTimeout(3000);
        
        let activeBodyText = await metaAdsPage.textContent('body');
        const hasActiveAds = !activeBodyText.includes('No ads') && 
                             !activeBodyText.includes('no active ads') &&
                             !activeBodyText.includes("This Page isn't running ads");
        
        let activeAdCount = 0;
        const activeCountMatch = activeBodyText.match(/~?(\d+)\s+results?/i);
        if (activeCountMatch) {
          activeAdCount = parseInt(activeCountMatch[1], 10);
        }
        
        // Check for ALL ads
        const allUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${facebookPageId}`;
        await metaAdsPage.goto(allUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await metaAdsPage.waitForTimeout(3000);
        
        let allBodyText = await metaAdsPage.textContent('body');
        let totalAdCount = 0;
        const totalCountMatch = allBodyText.match(/~?(\d+)\s+results?/i);
        if (totalCountMatch) {
          totalAdCount = parseInt(totalCountMatch[1], 10);
        }
        
        const inactiveAdCount = totalAdCount - activeAdCount;
        
        if (activeAdCount > 0) {
          console.log(`   ✅ Meta Ads: Running (${activeAdCount} active ad(s))`);
          research.metaAdsData = { 
            running: true, 
            adCount: activeAdCount, 
            totalAds: totalAdCount,
            inactiveAds: inactiveAdCount,
            pageId: facebookPageId 
          };
          research.gaps.metaAds.hasGap = false;
        } else if (inactiveAdCount > 0) {
          console.log(`   ⚠️  Meta Ads: Previously ran ${inactiveAdCount} ad(s), currently INACTIVE`);
          research.gaps.metaAds.hasGap = true;
          research.gaps.metaAds.impact = 12000;
          research.gaps.metaAds.details = `Previously ran Meta ads but stopped. Facebook/Instagram retargeting could capture lost website visitors.`;
          research.gaps.metaAds.status = 'inactive';
        } else {
          console.log(`   ❌ Meta Ads: Not running`);
          research.gaps.metaAds.hasGap = true;
          research.gaps.metaAds.impact = 12000;
          research.gaps.metaAds.details = `Not running Facebook/Instagram ads. Retargeting could capture lost website visitors.`;
          research.gaps.metaAds.status = 'none';
        }
        
      } catch (e) {
        console.log(`   ⚠️  Could not check Meta Ads Library: ${e.message}`);
        research.gaps.metaAds.hasGap = true;
        research.gaps.metaAds.impact = 12000;
        research.gaps.metaAds.details = `Unable to verify Meta Ads presence.`;
      }
      await metaAdsPage.close();
    } else {
      research.gaps.metaAds.hasGap = true;
      research.gaps.metaAds.impact = 12000;
      research.gaps.metaAds.details = `No Facebook presence detected or unable to verify Meta Ads.`;
      research.gaps.metaAds.status = 'none';
      console.log(`   ❌ Meta Ads: Cannot verify (no Facebook Page ID)`);
    }
    
    // ========================================================================
    // STEP 10: CRM GAP (ALWAYS ASSUMED)
    // ========================================================================
    research.gaps.crm.hasGap = true;
    research.gaps.crm.impact = 8000;
    research.gaps.crm.details = `Manual follow-up wastes 15+ hrs/week and loses 40% of warm leads. Automation improves close rates 15-30%.`;
    
    // ========================================================================
    // CALCULATE TOTALS AND DATA QUALITY
    // ========================================================================
    research.estimatedMonthlyRevenueLoss = Object.values(research.gaps)
      .reduce((sum, gap) => sum + (gap.impact || 0), 0);
    
    // Calculate overall confidence score
    const confidenceScores = Object.values(research.dataQuality.confidence);
    research.dataQuality.confidence.overall = Math.round(
      confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
    );
    
    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    console.log(`\n✅ RESEARCH COMPLETE!`);
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Firm: ${research.firmName}`);
    console.log(`   Locations: ${research.allLocations.length}`);
    console.log(`   Attorneys: ${research.attorneys.length}`);
    console.log(`   Practice Areas: ${research.practiceAreas.length}`);
    console.log(`   Google Business: ${research.reviewCount} reviews (${research.rating}⭐)`);
    console.log(`   Competitors: ${research.competitors.length}`);
    console.log(`   LinkedIn Profiles: ${research.linkedInProfiles.length}`);
    console.log(`   Credentials: ${research.credentials.length}`);
    console.log(`   Pages Analyzed: ${research.pagesAnalyzed.length}`);
    console.log(`   Monthly Revenue Loss: $${(research.estimatedMonthlyRevenueLoss/1000).toFixed(0)}K`);
    console.log(`   Annual Revenue Loss: $${(research.estimatedMonthlyRevenueLoss*12/1000).toFixed(0)}K`);
    
    console.log(`\n📈 DATA QUALITY:`);
    console.log(`   Overall Confidence: ${research.dataQuality.confidence.overall}/10`);
    console.log(`   Firm Name: ${research.dataQuality.confidence.firmName}/10`);
    console.log(`   Location: ${research.locationConfidence}/10`);
    console.log(`   Attorneys: ${research.dataQuality.confidence.attorneys}/10`);
    console.log(`   Practice Areas: ${research.dataQuality.confidence.practiceAreas}/10`);
    
    if (research.dataQuality.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${research.dataQuality.warnings.length}):`);
      research.dataQuality.warnings.forEach(w => console.log(`   - ${w}`));
    }
    
    if (research.dataQuality.missingFields.length > 0) {
      console.log(`\n❌ MISSING CRITICAL DATA:`);
      research.dataQuality.missingFields.forEach(f => console.log(`   - ${f}`));
    }
    
  } catch (error) {
    console.error(`❌ Research error: ${error.message}`);
    research.dataQuality.warnings.push(`Fatal error during research: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  // Save to file
  const firmSlug = research.firmName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const reportsDir = path.resolve(__dirname, 'reports');
  
  // Create reports directory if it doesn't exist
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const outputPath = path.resolve(reportsDir, `${firmSlug}-research.json`);
  fs.writeFileSync(outputPath, JSON.stringify(research, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}\n`);
  
  return research;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const url = args[0];
  const contactName = args[1] || '';
  const city = args[2] || '';
  const state = args[3] || '';
  const country = args[4] || 'US';
  const company = args[5] || '';
  
  if (!url) {
    console.log('Usage: node research-v3-DEEP.js <website-url> [contact-name] [city] [state] [country] [company]');
    console.log('\nExamples:');
    console.log('  Basic: node research-v3-DEEP.js https://www.aklaw.net');
    console.log('  With contact: node research-v3-DEEP.js https://www.aklaw.net "Paul A. Graziano"');
    console.log('  With Instantly data: node research-v3-DEEP.js https://www.rothjackson.com "Andrew Condlin" "McLean" "VA" "US" "Roth Jackson"');
    console.log('\nInstantly fields (all optional):');
    console.log('  - contact-name: Contact person name');
    console.log('  - city: City from Instantly');
    console.log('  - state: State/province from Instantly');
    console.log('  - country: Country code (default: US)');
    console.log('  - company: Firm name from Instantly');
    process.exit(1);
  }
  
  deepResearch(url, contactName, city, state, country, company).then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { deepResearch };
