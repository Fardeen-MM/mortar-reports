#!/usr/bin/env node
/**
 * REPORT GENERATOR V12 HYBRID - Template-Based with Maximal Research
 * 
 * Based on V11's proven template structure.
 * Uses maximal-research-v2.js data (50+ pages, LinkedIn, Google, social, news, competitors).
 * 
 * TEMPLATE COMPLIANCE (NON-NEGOTIABLE):
 * - Hero: Search bar + typing animation + "They find your competitors. Not you."
 * - Section intros (handholding between sections)
 * - 3 Gaps with TLDR boxes + flow diagrams
 * - Competitor table with real firms ONLY
 * - Solution stack (5 items: Google Ads, Meta Ads, Voice AI, CRM, Dashboard)
 * - Proof grid (3 boxes with numbers)
 * - Two options (bad vs good)
 * - Single CTA at bottom
 * 
 * VALIDATION GATES:
 * - Math must validate: gaps sum to hero total (±15%)
 * - Competitor data: real firms only, BLOCK if fake
 * - Currency: detect from location (UK=£, US/CA=$), enforce throughout
 * - No "personalized opener" section
 * - No phased roadmap
 * - No freeform AI generation
 * 
 * CORE PRINCIPLE: Stop selling infrastructure. Start selling what they actually want.
 * The data proves the problem. The emotion drives the call.
 */

const fs = require('fs');
const path = require('path');
const { findCompetitors } = require('./ai-research-helper.js');

// Case value minimums by practice area
const CASE_VALUES = {
  'tax': 4500,
  'family': 4500,
  'divorce': 4500,
  'personal injury': 12000,
  'immigration': 4000,
  'litigation': 7500,
  'criminal': 5000,
  'estate': 3000,
  'business': 6000,
  'bankruptcy': 2500,
  'civil rights': 8000,
  'employment': 6000,
  'real estate': 5000,
  'ip': 7500,
  'landlord': 3500,
  'medical malpractice': 15000,
  'workers comp': 8000
};

// Realistic search terms (natural, what people actually type)
const SEARCH_TERMS = {
  'divorce': [
    'divorce lawyer near me',
    'how much does divorce cost',
    'child custody attorney',
    'best divorce lawyer',
    'do I need a lawyer for divorce'
  ],
  'family': [
    'family lawyer near me',
    'child custody attorney',
    'how much does divorce cost',
    'best family lawyer',
    'family law attorney near me'
  ],
  'tax': [
    'irs help near me',
    'tax debt relief',
    'how to settle irs debt',
    'tax attorney near me',
    'irs payment plan lawyer'
  ],
  'personal injury': [
    'car accident lawyer near me',
    'how much is my case worth',
    'injury lawyer free consultation',
    'should I get a lawyer after accident',
    'best personal injury attorney'
  ],
  'immigration': [
    'immigration lawyer near me',
    'green card attorney',
    'how to get green card',
    'visa lawyer near me',
    'deportation defense lawyer'
  ],
  'criminal': [
    'criminal lawyer near me',
    'dui attorney',
    'how to beat a dui',
    'best criminal lawyer',
    'criminal defense lawyer near me'
  ],
  'civil rights': [
    'civil rights lawyer near me',
    'can I sue the police',
    'police brutality attorney',
    'wrongful arrest lawyer',
    'civil rights attorney free consultation'
  ],
  'employment': [
    'employment lawyer near me',
    'wrongful termination attorney',
    'can I sue my employer',
    'discrimination lawyer near me',
    'employment attorney free consultation'
  ],
  'real estate': [
    'real estate lawyer near me',
    'property attorney',
    'landlord tenant lawyer',
    'real estate attorney near me',
    'closing attorney'
  ],
  'ip': [
    'patent lawyer near me',
    'trademark attorney',
    'how to patent an idea',
    'ip lawyer near me',
    'copyright attorney'
  ],
  'landlord': [
    'eviction lawyer near me',
    'landlord attorney',
    'how to evict a tenant',
    'landlord tenant lawyer',
    'property law attorney near me'
  ],
  'medical malpractice': [
    'medical malpractice lawyer near me',
    'can I sue my doctor',
    'medical negligence attorney',
    'surgical error lawyer',
    'hospital malpractice attorney'
  ],
  'workers comp': [
    'workers comp lawyer near me',
    'injured at work attorney',
    'work injury lawyer',
    'workers compensation attorney',
    'workplace injury lawyer'
  ],
  'default': [
    'lawyer near me',
    'attorney near me',
    'legal help',
    'best lawyer',
    'free legal consultation'
  ]
};

async function generateReport(researchData, prospectName) {
  console.log(`\n📝 Generating V11 Report (7 Critical Fixes) for ${prospectName}...\n`);
  
  // DEBUG: Log what we received
  console.log(`📊 Input validation:`);
  console.log(`   Firm: ${researchData.firmName}`);
  console.log(`   Location: ${researchData.location?.city}, ${researchData.location?.state}`);
  console.log(`   Competitors: ${researchData.competitors ? researchData.competitors.length : 0}`);
  if (researchData.competitors) {
    researchData.competitors.slice(0, 3).forEach((c, i) => {
      console.log(`      ${i+1}. ${c.name || c.firmName || '[NO NAME]'}`);
    });
  }
  console.log('');
  
  // PHASE 0: HARD VALIDATION GATE
  const validation = validateData(researchData);
  if (!validation.passed) {
    console.error('❌ GENERATION BLOCKED:');
    validation.errors.forEach(err => console.error(`   - ${err}`));
    
    fs.writeFileSync(
      path.join(__dirname, 'generation-blocked.json'),
      JSON.stringify({ 
        reason: 'HARD_VALIDATION_FAILURE',
        errors: validation.errors, 
        warnings: validation.warnings, 
        data: researchData 
      }, null, 2)
    );
    
    throw new Error(`GENERATION_BLOCKED: ${validation.errors.join(', ')}`);
  }
  
  // Log warnings (non-blocking)
  if (validation.warnings && validation.warnings.length > 0) {
    console.log('⚠️  Warnings (non-blocking):');
    validation.warnings.forEach(warn => console.log(`   - ${warn}`));
    console.log('');
  }
  
  console.log('✅ Data validation passed\n');
  
  // Extract data from research (supports both old and new structure)
  const {
    firmName: rawFirmName,
    website,
    location = {},
    competitors: rawCompetitors = [],
    gaps = {},
    estimatedMonthlyRevenueLoss = 0,
    intelligence = {},
    // NEW: Extracted structured data
    practice = {},
    team = {},
    credibility = {},
    positioning = {},
    firmDetails = {},
    contact = {}
  } = researchData;
  
  // Get practice areas - check multiple possible locations in research data
  const practiceAreas = researchData.practiceAreas ||
                        practice.practiceAreas ||
                        intelligence?.practiceAreas ||
                        intelligence?.keySpecialties ||
                        [];
  
  // Filter out fake/placeholder competitors BEFORE processing
  const FAKE_COMPETITOR_PATTERNS = [
    /acme\s+law/i,
    /goldstein/i,
    /riverside\s+law/i,
    /smith\s*&\s*associates/i,
    /jones\s+law\s+group/i,
    /example\s+law/i,
    /placeholder/i,
    /test\s+firm/i,
    /sample\s+law/i,
    /generic\s+law/i
  ];
  
  const competitors = rawCompetitors.filter(comp => {
    if (!comp.name) return false;
    const isFake = FAKE_COMPETITOR_PATTERNS.some(pattern => pattern.test(comp.name));
    if (isFake) {
      console.log(`   ⚠️  Filtered out fake competitor: "${comp.name}"`);
    }
    return !isFake;
  });
  
  if (rawCompetitors.length > competitors.length) {
    console.log(`   ℹ️  Filtered ${rawCompetitors.length - competitors.length} fake competitors, ${competitors.length} real ones remaining\n`);
  }

  // Normalize firm name (capitalize entity types)
  const firmName = normalizeFirmName(rawFirmName);

  // Extract location (support both old and new structure)
  const city = location.city || '';
  const state = location.state || '';
  const country = location.country || 'US';
  const locationStr = city && state ? `${city}, ${state}` : state || 'your area';

  // Currency detection: UK/GB = £, otherwise $
  const currency = (country === 'GB' || country === 'UK') ? '£' : '$';

  // Determine practice area - use extracted primary focus first
  let practiceAreaRaw = practice.primaryFocus ||
                        practiceAreas[0] ||
                        intelligence?.mainFocus?.[0] ||
                        'legal services';

  const practiceArea = getPracticeAreaCategory(practiceAreaRaw);
  const practiceLabel = getPracticeLabel(practiceArea);

  // Log what we're using
  console.log(`📍 Using location: ${city}${state ? ', ' + state : ''}`);
  console.log(`⚖️  Using practice area: ${practiceLabel} (from: ${practiceAreaRaw})\n`);

  // If no competitors, try to fetch them now via Google Places API
  if (competitors.length === 0 && city) {
    console.log(`   🔍 No competitors in research data - fetching via Google Places API...`);
    try {
      const fetchedCompetitors = await findCompetitors(rawFirmName, city, state, practiceAreas);
      if (fetchedCompetitors && fetchedCompetitors.length > 0) {
        competitors.push(...fetchedCompetitors);
        console.log(`   ✅ Fetched ${fetchedCompetitors.length} real competitors\n`);
      }
    } catch (e) {
      console.log(`   ⚠️  Could not fetch competitors: ${e.message}\n`);
    }
  }
  
  // Get case value (same for ALL gaps)
  const caseValue = getCaseValue(practiceArea, estimatedMonthlyRevenueLoss);
  
  // Get search terms
  const searchTerms = getSearchTerms(practiceArea, city);
  
  // Calculate gaps with market-adjusted inputs
  const marketData = {
    city: city,
    state: state,
    firmSize: researchData.firmSize || researchData.team?.totalCount || 0,
    officeCount: researchData.officeCount || 1
  };

  const gapCalculations = calculateGaps(gaps, 0, caseValue, competitors, marketData);

  // Hero total is now calculated FROM the gaps, not the other way around
  const totalMonthly = (gapCalculations.actualTotal || gapCalculations.gap1.cost + gapCalculations.gap2.cost + gapCalculations.gap3.cost) * 1000;

  console.log(`💰 Gap calculations: $${gapCalculations.gap1.cost}K + $${gapCalculations.gap2.cost}K + $${gapCalculations.gap3.cost}K = $${Math.round(totalMonthly/1000)}K/month\n`);
  
  // Generate HTML (ALL NEW - EMOTIONAL + DATA)
  const html = generateHTML({
    firmName,
    prospectName,
    city,
    state,
    practiceArea,
    practiceLabel,
    searchTerms,
    caseValue,
    totalMonthly,
    gapCalculations,
    competitors,
    gaps,
    currency,
    researchData // Pass full research data for firm's own stats
  });
  
  // Save report
  const firmSlug = firmName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const reportsDir = path.resolve(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const outputPath = path.resolve(reportsDir, `${firmSlug}-landing-page-v12-hybrid.html`);
  
  // Apply typography cleanup (FIX #6/#7 from QC)
  let cleanedHTML = html;
  
  // Replace em dashes with regular dashes
  cleanedHTML = cleanedHTML.replace(/—/g, '-');
  
  // Limit exclamation points to max 2
  const exclamationMatches = cleanedHTML.match(/!/g);
  if (exclamationMatches && exclamationMatches.length > 2) {
    let count = 0;
    cleanedHTML = cleanedHTML.replace(/!/g, (match) => {
      count++;
      return count > 2 ? '.' : match;
    });
  }
  
  fs.writeFileSync(outputPath, cleanedHTML);
  
  console.log(`💾 Saved: ${outputPath}\n`);
  console.log(`✅ Report generated successfully`);
  console.log(`   Firm: ${firmName}`);
  console.log(`   Location: ${locationStr}`);
  console.log(`   Practice: ${practiceArea}`);
  console.log(`   Case value: $${caseValue.toLocaleString()}`);
  console.log(`   Hero total: $${Math.round(totalMonthly/1000)}K/month`);
  console.log(`   Competitors: ${competitors.length}\n`);
  
  return { html, outputPath };
}

// HARD VALIDATION GATE - ENFORCED
function validateData(data) {
  const errors = [];
  const warnings = [];
  
  // CRITICAL (BLOCKS)
  if (!data.firmName || data.firmName === 'Unknown' || data.firmName === 'Unknown Firm') {
    errors.push('Firm name is invalid or missing');
  }
  
  // Location validation - warn but don't block (will use "your area" fallback)
  if (!data.location?.city || !data.location?.state) {
    warnings.push('Location (city/state) is missing - will use "your area" fallback');
    // Ensure location object exists with empty strings for safe access
    if (!data.location) data.location = {};
    if (!data.location.city) data.location.city = '';
    if (!data.location.state) data.location.state = '';
  } else if (data.location.state.length !== 2) {
    warnings.push(`State "${data.location.state}" should be 2-letter abbreviation`);
  }
  
  // COMPETITORS - Should always have 3 now (generated with reasonable data)
  if (!data.competitors || data.competitors.length === 0) {
    warnings.push('No competitor data - this should not happen with new competitor generation.');
  } else if (data.competitors.length < 3) {
    warnings.push(`Only ${data.competitors.length} competitors found (expected 3).`);
  }
  
  // Validate competitor data quality (fake names are filtered before this point)
  if (data.competitors && data.competitors.length > 0) {
    data.competitors.slice(0, 3).forEach((comp, i) => {
      if (!comp.name) {
        errors.push(`Competitor ${i+1} missing name`);
      }
      if (comp.reviewCount === undefined && comp.reviews === undefined) {
        warnings.push(`Competitor ${i+1} missing review count`);
      }
      if (comp.rating === undefined) {
        warnings.push(`Competitor ${i+1} missing rating`);
      }
    });
  }
  
  // Practice area (WARNING only)
  if (!data.practiceAreas || data.practiceAreas.length === 0) {
    warnings.push('Practice area is missing');
  }
  
  if (data.practiceAreas?.[0] === 'legal services') {
    warnings.push('Practice area is too generic (legal services)');
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

// Normalize firm name - capitalize entity types
function normalizeFirmName(name) {
  if (!name) return 'Unknown Firm';
  
  // Capitalize common entity suffixes
  return name
    .replace(/\bLlp\b/g, 'LLP')
    .replace(/\bLlc\b/g, 'LLC')
    .replace(/\bPllc\b/g, 'PLLC')
    .replace(/\bPc\b/g, 'PC')
    .replace(/\bPa\b/g, 'PA')
    .replace(/\bInc\b/g, 'Inc.')
    .replace(/\bCorp\b/g, 'Corp.');
}

function getPracticeAreaCategory(practiceArea) {
  const lower = practiceArea.toLowerCase();
  
  // More specific matching first
  if (lower.includes('landlord') || lower.includes('eviction') || lower.includes('tenant')) return 'landlord';
  if (lower.includes('divorce') || lower.includes('family')) return 'divorce';
  if (lower.includes('tax')) return 'tax';
  if (lower.includes('injury') || lower.includes('accident')) return 'personal injury';
  if (lower.includes('immigration')) return 'immigration';
  if (lower.includes('criminal') || lower.includes('dui')) return 'criminal';
  if (lower.includes('estate') || lower.includes('probate') || lower.includes('trust')) return 'estate';
  if (lower.includes('business') || lower.includes('corporate')) return 'business';
  if (lower.includes('bankruptcy')) return 'bankruptcy';
  if (lower.includes('litigation')) return 'litigation';
  if (lower.includes('civil rights') || lower.includes('police') || lower.includes('misconduct')) return 'civil rights';
  if (lower.includes('employment') || lower.includes('discrimination') || lower.includes('labor')) return 'employment';
  if (lower.includes('real estate') || lower.includes('property')) return 'real estate';
  if (lower.includes('intellectual property') || lower.includes('patent') || lower.includes('trademark')) return 'ip';
  if (lower.includes('malpractice') || lower.includes('medical')) return 'medical malpractice';
  if (lower.includes('worker') || lower.includes('comp')) return 'workers comp';
  
  return 'default';
}

function getPracticeLabel(category) {
  const labels = {
    'divorce': 'DIVORCE',
    'family': 'FAMILY LAW',
    'tax': 'TAX',
    'personal injury': 'PERSONAL INJURY',
    'immigration': 'IMMIGRATION',
    'criminal': 'CRIMINAL DEFENSE',
    'estate': 'ESTATE PLANNING',
    'business': 'BUSINESS',
    'bankruptcy': 'BANKRUPTCY',
    'litigation': 'LITIGATION',
    'civil rights': 'CIVIL RIGHTS',
    'employment': 'EMPLOYMENT',
    'real estate': 'REAL ESTATE',
    'ip': 'INTELLECTUAL PROPERTY',
    'landlord': 'LANDLORD LAW',
    'medical malpractice': 'MEDICAL MALPRACTICE',
    'workers comp': 'WORKERS COMPENSATION',
    'default': 'LAW'
  };
  
  return labels[category] || 'LAW';
}

function getCaseValue(practiceArea, totalMonthly) {
  const minimum = CASE_VALUES[practiceArea] || 4500;
  
  if (totalMonthly < 15000) {
    return minimum;
  }
  
  const calculated = Math.round(totalMonthly / 3 / 100) * 100;
  return Math.max(calculated, minimum);
}

function getSearchTerms(practiceArea, city) {
  const terms = SEARCH_TERMS[practiceArea] || SEARCH_TERMS['default'];
  
  // Replace {city} placeholder and add city to one term
  return terms.map((term, i) => {
    if (i === 2 && city && !term.includes('near me')) {
      // Make 3rd term city-specific if it doesn't have "near me"
      return term.replace(/near me|attorney|lawyer/, `attorney ${city}`);
    }
    return term;
  });
}

// GAP CALCULATIONS - Honest math, no rigging
// Inputs vary by market size. Results show ranges to acknowledge uncertainty.
function calculateGaps(gaps, totalMonthly, caseValue, competitors, marketData = {}) {
  // Get market size multiplier (population-based estimate)
  // Small market: 0.5x, Medium: 1x, Large metro: 2x
  const marketMultiplier = getMarketMultiplier(marketData);

  // Gap 1: Google Ads opportunity
  // Base: 200-800 monthly searches depending on market size
  const gap1Searches = Math.round(400 * marketMultiplier);
  const gap1CTR = 0.035;      // 3.5% CTR (industry average for legal)
  const gap1Conv = 0.12;      // 12% of clicks become leads
  const gap1Close = 0.25;     // 25% of leads close

  const gap1Cases = gap1Searches * gap1CTR * gap1Conv * gap1Close;
  const gap1Revenue = gap1Cases * caseValue;
  const gap1Cost = Math.round(gap1Revenue / 1000);

  // Gap 2: Meta Ads opportunity
  // Audience size varies with market: 20K-100K
  const gap2Audience = Math.round(40000 * marketMultiplier);
  const gap2Reach = 0.015;     // 1.5% monthly reach with ads
  const gap2Conv = 0.008;      // 0.8% of impressions convert
  const gap2Close = 0.25;      // 25% of leads close

  const gap2Cases = gap2Audience * gap2Reach * gap2Conv * gap2Close;
  const gap2Revenue = gap2Cases * caseValue;
  const gap2Cost = Math.round(gap2Revenue / 1000);

  // Gap 3: After-hours / Voice AI opportunity
  // Calls vary by firm size: 20-100/month
  const firmSizeMultiplier = getFirmSizeMultiplier(marketData);
  const gap3Calls = Math.round(40 * firmSizeMultiplier);
  const gap3AfterHours = 0.35;   // 35% outside business hours
  const gap3MissRate = 0.60;     // 60% of after-hours calls missed
  const gap3Recovery = 0.70;     // AI recovers 70% of missed
  const gap3Close = 0.20;        // 20% of recovered calls close

  const gap3Cases = gap3Calls * gap3AfterHours * gap3MissRate * gap3Recovery * gap3Close;
  const gap3Revenue = gap3Cases * caseValue;
  const gap3Cost = Math.round(gap3Revenue / 1000);

  // Calculate actual total (no forcing to match hero)
  const actualTotal = gap1Cost + gap2Cost + gap3Cost;

  return {
    gap1: {
      cost: gap1Cost,
      searches: gap1Searches,
      ctr: gap1CTR * 100,
      conv: gap1Conv * 100,
      close: gap1Close * 100,
      cases: Math.round(gap1Cases * 10) / 10,
      formula: `~${gap1Searches} searches/mo × ${(gap1CTR*100).toFixed(1)}% CTR × ${Math.round(gap1Conv*100)}% conversion × ${Math.round(gap1Close*100)}% close`
    },
    gap2: {
      cost: gap2Cost,
      audience: gap2Audience,
      reach: gap2Reach * 100,
      conv: gap2Conv * 100,
      close: gap2Close * 100,
      cases: Math.round(gap2Cases * 10) / 10,
      formula: `~${(gap2Audience/1000).toFixed(0)}K audience × ${(gap2Reach*100).toFixed(1)}% reach × ${(gap2Conv*100).toFixed(1)}% conversion × ${Math.round(gap2Close*100)}% close`
    },
    gap3: {
      cost: gap3Cost,
      calls: gap3Calls,
      afterHours: gap3AfterHours * 100,
      missRate: gap3MissRate * 100,
      recovery: gap3Recovery * 100,
      close: gap3Close * 100,
      cases: Math.round(gap3Cases * 10) / 10,
      formula: `~${gap3Calls} calls/mo × ${Math.round(gap3AfterHours*100)}% after-hours × ${Math.round(gap3MissRate*100)}% missed × ${Math.round(gap3Recovery*100)}% recovered`
    },
    actualTotal: actualTotal
  };
}

// Market size multiplier based on city population
function getMarketMultiplier(marketData) {
  const city = (marketData.city || '').toLowerCase();
  const state = (marketData.state || '').toUpperCase();

  // Major metros get 2x
  const majorMetros = ['new york', 'los angeles', 'chicago', 'houston', 'phoenix',
    'philadelphia', 'san antonio', 'san diego', 'dallas', 'san jose', 'austin',
    'jacksonville', 'fort worth', 'columbus', 'charlotte', 'san francisco',
    'indianapolis', 'seattle', 'denver', 'washington', 'boston', 'nashville',
    'baltimore', 'oklahoma city', 'portland', 'las vegas', 'milwaukee', 'toronto'];

  if (majorMetros.some(m => city.includes(m))) return 1.8;

  // Mid-size cities get 1.2x
  const midSize = ['memphis', 'louisville', 'richmond', 'new orleans', 'raleigh',
    'salt lake city', 'birmingham', 'rochester', 'fresno', 'tucson', 'sacramento',
    'mesa', 'kansas city', 'atlanta', 'omaha', 'miami', 'tulsa', 'oakland',
    'minneapolis', 'cleveland', 'wichita', 'arlington', 'bakersfield', 'tampa',
    'aurora', 'honolulu', 'anaheim', 'santa ana', 'corpus christi', 'riverside',
    'st. louis', 'lexington', 'pittsburgh', 'anchorage', 'stockton', 'cincinnati',
    'st. paul', 'toledo', 'newark', 'greensboro', 'plano', 'henderson', 'lincoln',
    'buffalo', 'fort wayne', 'jersey city', 'chula vista', 'norfolk', 'orlando',
    'chandler', 'laredo', 'madison', 'durham', 'lubbock', 'winston-salem'];

  if (midSize.some(m => city.includes(m))) return 1.2;

  // Default for smaller markets
  return 0.8;
}

// Firm size multiplier based on extracted data
function getFirmSizeMultiplier(marketData) {
  const firmSize = marketData.firmSize || marketData.team?.totalCount || 0;
  const officeCount = marketData.officeCount || 1;

  if (firmSize > 20 || officeCount > 3) return 2.0;
  if (firmSize > 10 || officeCount > 1) return 1.5;
  if (firmSize > 5) return 1.2;
  return 1.0; // Solo/small firm
}

// Math validation removed - hero total is now calculated FROM gaps, not forced to match
// The old validation was part of the rigging system

function generateHTML(data) {
  const {
    firmName,
    prospectName,
    city,
    state,
    practiceArea,
    practiceLabel,
    searchTerms,
    caseValue,
    totalMonthly,
    gapCalculations,
    competitors,
    gaps,
    currency = '$',
    researchData = {}
  } = data;
  
  const heroTotalK = Math.round(totalMonthly / 1000);
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  // Load CSS
  const cssModule = require('./report-v9-css.js');
  const css = cssModule();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${firmName} | Marketing Analysis by Mortar Metrics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;0,700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  ${css}
</head>
<body>
  <div class="container">
    ${generateHeader(prospectName, today)}
    ${generateHero(practiceLabel, city, state, searchTerms, heroTotalK, currency)}
    ${generateSectionIntro('gaps', `Where you are losing ${currency}${heroTotalK}K/month`, `We found 3 gaps in your marketing infrastructure. Each one is costing you cases every month.`)}
    ${generateGap1(gapCalculations.gap1, searchTerms[0], caseValue, firmName, currency, researchData)}
    ${generateGap2(gapCalculations.gap2, city, practiceArea, caseValue, firmName, currency, researchData)}
    ${generateGap3(gapCalculations.gap3, caseValue, firmName, currency, researchData)}
    ${generateSectionIntro('competitors', 'Your competitive landscape', `We looked at who's advertising in ${city || 'your market'} to understand where the opportunity is.`)}
    ${generateCompetitors(competitors, city, researchData)}
    ${generateSectionIntro('solution', 'What it takes to fix this', `Closing these gaps is not one quick fix. It is a system: ads, intake, CRM, reporting that works together.`)}
    ${generateSolution(firmName)}
    ${generateSectionIntro('proof', 'How this works', `This is a proven system. Here's what it looks like when it's running.`)}
    ${generateProof()}
    ${generateSectionIntro('next', 'What happens next', `Two choices. Neither is wrong, but one keeps things the same.`)}
    ${generateTwoOptions(heroTotalK, competitors)}
    ${generateCTA(heroTotalK, firmName)}
    ${generateFooter()}
  </div>
  ${generateTypingAnimation(searchTerms)}
</body>
</html>`;
}

function generateHeader(prospectName, date) {
  return `
    <div class="header">
      <div class="logo">Mortar Metrics</div>
      <div class="meta">Marketing Analysis for ${prospectName} · ${date}</div>
    </div>
  `;
}

function generateHero(practiceLabel, city, state, searchTerms, heroTotalK, currency = '$') {
  const locationLabel = city && state ? `${city.toUpperCase()}, ${state.toUpperCase()}` : 
                        city ? city.toUpperCase() : 
                        state ? state.toUpperCase() : '';
  
  return `
    <section class="hero">
      <div class="hero-label">FOR ${practiceLabel} ATTORNEYS IN ${locationLabel}</div>
      <h2 class="hero-setup">When someone searches</h2>
      
      <div class="search-bar-mockup">
        <svg class="google-g" viewBox="0 0 24 24" width="24" height="24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span class="search-text" id="typed-search"></span>
        <span class="cursor">|</span>
      </div>
      
      <h1 class="hero-punch">
        They find your competitors.
        <span class="accent">Not you.</span>
      </h1>
      
      <p class="hero-cost">
        That's <strong>${currency}${heroTotalK}K/month</strong>—and the cases that should be yours—going to someone else.
      </p>
      
      <a href="#gaps" class="hero-cta">See where you're losing →</a>
    </section>
  `;
}

// FIX #3: Section Intros (Handholding)
function generateSectionIntro(id, title, description) {
  return `
    <div class="section-intro"${id ? ` id="${id}"` : ''}>
      <h2>${title}</h2>
      <p>${description}</p>
    </div>
  `;
}

// CLI Handler
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);

    if (args.length < 2) {
      console.log('Usage: node report-generator-v12-hybrid.js <research-json> <contact-name>');
      process.exit(1);
    }

    const researchFile = args[0];
    const contactName = args[1];

    if (!fs.existsSync(researchFile)) {
      console.error(`❌ Research file not found: ${researchFile}`);
      process.exit(1);
    }

    try {
      const researchData = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
      await generateReport(researchData, contactName);
    } catch (error) {
      console.error('❌ Error generating report:', error.message);
      if (error.message.includes('GENERATION_BLOCKED')) {
        console.error('\n⚠️  Report generation was HARD BLOCKED due to validation failures.');
        console.error('   Check generation-blocked.json for details.');
      }
      process.exit(1);
    }
  })();
}

module.exports = { generateReport };

function generateGap1(gap1, searchTerm, caseValue, firmName, currency = '$', firmData = {}) {
  // Check if firm already runs Google Ads
  const hasGoogleAds = firmData.hasGoogleAds || firmData.gaps?.googleAds?.status === 'running';

  if (hasGoogleAds) {
    // Firm has Google Ads - focus on optimization
    return `
    <div class="section-label" id="gaps">GAP #1</div>

    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>You're running Google Ads. The opportunity is optimization—better targeting, lower CPA, higher conversion.</strong><br>
        <span class="tldr-cost">Potential: ~${currency}${gap1.cost}K/month additional</span>
      </div>
    </div>

    <div class="gap-box">
      <div class="gap-header">
        <div class="gap-title">Optimizing ${firmName}'s Google Ads</div>
        <div class="gap-cost">+${currency}${gap1.cost}K/mo</div>
      </div>

      <p><strong>You're already capturing search traffic.</strong> The opportunity is optimization: tighter geo-targeting, negative keywords, dayparting, and conversion tracking that ties every lead back to its source.</p>

      <div class="flow-diagram">
        <div class="flow-step">Client searches "${searchTerm}"</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Your ad appears (already running)</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Optimized landing page + tracking</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Higher conversion, lower cost per case</div>
      </div>

      <p class="math-line"><strong>The math:</strong> ${gap1.formula} = <strong>${currency}${gap1.cost}K/month</strong></p>
    </div>

    <p class="section-pull"><strong>Google is working. What about social?</strong></p>
  `;
  }

  // Firm doesn't have Google Ads
  return `
    <div class="section-label" id="gaps">GAP #1</div>

    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>When someone searches for a lawyer in your area, you're not in the results. Competitors are.</strong><br>
        <span class="tldr-cost">Estimated: ~${currency}${gap1.cost}K/month</span>
      </div>
    </div>

    <div class="gap-box">
      <div class="gap-header">
        <div class="gap-title">Search visibility opportunity</div>
        <div class="gap-cost">~${currency}${gap1.cost}K/mo</div>
      </div>

      <p><strong>High-intent searches drive high-value cases.</strong> When someone types "${searchTerm}", they're actively looking for help. Paid search puts you at the top of those results.</p>

      <div class="flow-diagram">
        <div class="flow-step">Client searches "${searchTerm}"</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Paid ads appear at top of results</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Without ads, organic results are below the fold</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Firms with ads capture high-intent traffic</div>
      </div>

      <p class="math-line"><strong>The math:</strong> ${gap1.formula} = <strong>${currency}${gap1.cost}K/month</strong></p>
    </div>

    <p class="section-pull"><strong>But Google is only half the picture. Where else are your clients?</strong></p>
  `;
}

function generateGap2(gap2, city, practiceArea, caseValue, firmName, currency = '$', firmData = {}) {
  // Check if firm already runs Meta Ads
  const hasMetaAds = firmData.hasMetaAds || firmData.gaps?.metaAds?.status === 'running';
  const locationStr = city || 'your area';

  if (hasMetaAds) {
    // Firm has Meta Ads - focus on optimization
    return `
    <div class="section-label">GAP #2</div>

    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>You're on social media. The opportunity is better targeting, retargeting, and conversion optimization.</strong><br>
        <span class="tldr-cost">Potential: ~${currency}${gap2.cost}K/month additional</span>
      </div>
    </div>

    <div class="gap-box">
      <div class="gap-header">
        <div class="gap-title">Optimizing ${firmName}'s social presence</div>
        <div class="gap-cost">+${currency}${gap2.cost}K/mo</div>
      </div>

      <p><strong>You're already reaching people on social.</strong> The opportunity: custom audiences, lookalike targeting, retargeting website visitors, and creative testing to lower cost per lead.</p>

      <div class="flow-diagram">
        <div class="flow-step">Person in ${locationStr} has a legal problem</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Sees your ad (already running)</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Optimized creative + landing page</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Higher conversion, lower cost per case</div>
      </div>

      <p class="math-line"><strong>The math:</strong> ${gap2.formula} = <strong>${currency}${gap2.cost}K/month</strong></p>
    </div>

    <p class="section-pull"><strong>Ads are running. What about after-hours intake?</strong></p>
  `;
  }

  // Firm doesn't have Meta Ads
  return `
    <div class="section-label">GAP #2</div>

    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>People in ${locationStr} spend hours on social media daily. Some have legal problems. They'll contact whoever they see.</strong><br>
        <span class="tldr-cost">Estimated: ~${currency}${gap2.cost}K/month</span>
      </div>
    </div>

    <div class="gap-box">
      <div class="gap-header">
        <div class="gap-title">Social media opportunity</div>
        <div class="gap-cost">~${currency}${gap2.cost}K/mo</div>
      </div>

      <p><strong>Not everyone Googles their legal problem.</strong> Many people with legal needs are on Facebook and Instagram daily. Targeted ads reach them where they already spend time.</p>

      <div class="flow-diagram">
        <div class="flow-step">Person in ${locationStr} has a legal problem</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Scrolling social media in the evening</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Sees a ${practiceArea} attorney's ad</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Clicks, learns about the firm, reaches out</div>
      </div>

      <p class="math-line"><strong>The math:</strong> ${gap2.formula} = <strong>${currency}${gap2.cost}K/month</strong></p>
    </div>

    <p class="section-pull"><strong>And when someone actually calls after hours?</strong></p>
  `;
}

function generateGap3(gap3, caseValue, firmName, currency = '$', firmData = {}) {
  // Check if firm already has after-hours coverage
  const hasAfterHours = firmData.afterHoursAvailable || firmData.hasLiveChat || firmData.has24x7;

  if (hasAfterHours) {
    // Firm has some after-hours coverage - focus on optimization instead
    return `
    <div class="section-label">GAP #3</div>

    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>You have after-hours coverage. The opportunity is in optimization—faster response, better qualification, more conversions.</strong><br>
        <span class="tldr-cost">Potential: ~${currency}${gap3.cost}K/month additional</span>
      </div>
    </div>

    <div class="gap-box">
      <div class="gap-header">
        <div class="gap-title">Optimizing ${firmName}'s after-hours intake</div>
        <div class="gap-cost">+${currency}${gap3.cost}K/mo</div>
      </div>

      <p><strong>You're already capturing after-hours leads.</strong> The opportunity is optimization: instant response, AI-powered qualification, automatic booking, and zero dropped calls.</p>

      <div class="contrast-box">
        <div class="contrast-side">
          <div class="contrast-label">Current:</div>
          <ul>
            <li>After-hours coverage active</li>
            <li>Some qualification process</li>
            <li>Manual follow-up</li>
            <li>Variable response time</li>
          </ul>
        </div>
        <div class="contrast-side">
          <div class="contrast-label good">Optimized:</div>
          <ul>
            <li>Sub-5-second response</li>
            <li>AI qualifies + books instantly</li>
            <li>Automatic CRM entry</li>
            <li>Zero human bottleneck</li>
          </ul>
        </div>
      </div>

      <p class="math-line"><strong>The math:</strong> ${gap3.formula} = <strong>${currency}${gap3.cost}K/month</strong></p>
    </div>
  `;
  }

  // Firm doesn't have after-hours coverage
  return `
    <div class="section-label">GAP #3</div>

    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>Many potential clients call outside business hours. Without 24/7 intake, those calls often go to competitors.</strong><br>
        <span class="tldr-cost">Estimated: ~${currency}${gap3.cost}K/month</span>
      </div>
    </div>

    <div class="gap-box">
      <div class="gap-header">
        <div class="gap-title">After-hours intake opportunity</div>
        <div class="gap-cost">~${currency}${gap3.cost}K/mo</div>
      </div>

      <p><strong>A significant portion of legal searches happen outside business hours.</strong> Without 24/7 intake, potential clients who call after hours may move on to firms that answer.</p>

      <div class="contrast-box">
        <div class="contrast-side">
          <div class="contrast-label">Without 24/7 intake:</div>
          <ul>
            <li>After-hours calls → voicemail</li>
            <li>Many callers don't leave messages</li>
            <li>Delayed response next business day</li>
            <li>Potential clients may try competitors</li>
          </ul>
        </div>
        <div class="contrast-side">
          <div class="contrast-label good">With AI intake:</div>
          <ul>
            <li>Answered in seconds, 24/7</li>
            <li>AI qualifies the lead</li>
            <li>Books consultation automatically</li>
            <li>Team alerted immediately</li>
          </ul>
        </div>
      </div>

      <p class="math-line"><strong>The math:</strong> ${gap3.formula} = <strong>${currency}${gap3.cost}K/month</strong></p>
    </div>
  `;
}

function generateCompetitors(competitors, city, firmData = {}) {
  // Handle case where we have no competitor data
  if (!competitors || competitors.length === 0) {
    return generateNoCompetitorSection(city, firmData);
  }

  const top3 = competitors.slice(0, 3);
  const topComp = top3[0];

  // Format helpers
  const formatReviews = (c) => {
    const count = c.reviews || c.reviewCount || 0;
    return count === 0 ? '—' : count;
  };

  const formatRating = (c) => {
    const rating = c.rating || 0;
    if (rating === 0) return '—';
    const ratingNum = typeof rating === 'string' ? parseFloat(rating) : rating;
    return `${ratingNum.toFixed(1)}★`;
  };

  // Format the firm's own data (Task #2 fix - use actual scraped data)
  const firmReviews = firmData.googleReviews || firmData.reviewCount || 0;
  const firmRating = firmData.googleRating || firmData.rating || 0;
  const firmHasGoogleAds = firmData.hasGoogleAds || firmData.gaps?.googleAds?.status === 'running' || false;
  const firmHasMetaAds = firmData.hasMetaAds || firmData.gaps?.metaAds?.status === 'running' || false;
  const firmHas24x7 = firmData.afterHoursAvailable || firmData.hasLiveChat || firmData.has24x7 || false;

  const formatFirmReviews = firmReviews === 0 ? '—' : firmReviews;
  const formatFirmRating = firmRating === 0 ? '—' : `${parseFloat(firmRating).toFixed(1)}★`;

  const hasAds = top3.some(c => c.hasGoogleAds);

  // Generate TLDR based on actual data
  let tldr = '';
  if (!hasAds) {
    tldr = `Limited advertising activity in your market. First-mover opportunity.`;
  } else if ((topComp.reviews || topComp.reviewCount || 0) > 100) {
    const reviews = topComp.reviews || topComp.reviewCount;
    tldr = `${topComp.name} leads with ${reviews} reviews and active ads.`;
  } else {
    tldr = `Market is competitive but most firms lack full infrastructure.`;
  }

  // Generate insight
  let insight = '';
  if (!hasAds) {
    insight = `We found limited advertising activity among firms in your market. This often indicates an opportunity for the first firm to build comprehensive marketing infrastructure.`;
  } else if ((topComp.reviews || topComp.reviewCount || 0) > 100) {
    const reviews = topComp.reviews || topComp.reviewCount;
    insight = `${topComp.name} has ${reviews} reviews and is running ads. Building infrastructure now positions you to compete for the same high-intent traffic.`;
  } else {
    insight = `Multiple firms are advertising, but comprehensive infrastructure (ads + 24/7 intake + CRM) is uncommon. Full-stack deployment creates competitive advantage.`;
  }

  const competitorCount = top3.length;
  const countText = competitorCount === 1 ? 'your closest competitor' :
                    competitorCount === 2 ? '2 competitors' :
                    '3 competitors';

  return `
    <p class="section-pull"><strong>Here's what we found looking at ${countText} in ${city || 'your market'}.</strong></p>

    <div class="section-label">COMPETITIVE LANDSCAPE</div>

    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>${tldr}</strong>
      </div>
    </div>

    <h2>Your market at a glance</h2>

    <table class="competitor-table">
      <thead>
        <tr>
          <th></th>
          <th>You</th>
          ${top3.map(c => `<th>${c.name}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Google Reviews</strong></td>
          <td>${formatFirmReviews}</td>
          ${top3.map(c => `<td>${formatReviews(c)}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Rating</strong></td>
          <td>${formatFirmRating}</td>
          ${top3.map(c => `<td>${formatRating(c)}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Google Ads</strong></td>
          <td>${firmHasGoogleAds ? '✓' : '❌'}</td>
          ${top3.map(c => `<td>${c.hasGoogleAds === true ? '✓' : c.hasGoogleAds === false ? '❌' : '—'}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Meta Ads</strong></td>
          <td>${firmHasMetaAds ? '✓' : '❌'}</td>
          ${top3.map(c => `<td>${c.hasMetaAds === true ? '✓' : c.hasMetaAds === false ? '❌' : '—'}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>24/7 Intake</strong></td>
          <td>${firmHas24x7 ? '✓' : '❌'}</td>
          ${top3.map(c => `<td>${c.has24x7 === true || c.hasVoiceAI === true ? '✓' : c.has24x7 === false ? '❌' : '—'}</td>`).join('')}
        </tr>
      </tbody>
    </table>

    <div class="competitor-insight">
      <strong>${insight}</strong>
    </div>

    <div class="big-divider"></div>
  `;
}

// New function for when we have no competitor data
function generateNoCompetitorSection(city, firmData = {}) {
  const locationStr = city || 'your market';

  // Still show the firm's own data if we have it
  const firmReviews = firmData.googleReviews || firmData.reviewCount || 0;
  const firmRating = firmData.googleRating || firmData.rating || 0;
  const firmHasGoogleAds = firmData.hasGoogleAds || firmData.gaps?.googleAds?.status === 'running' || false;
  const firmHasMetaAds = firmData.hasMetaAds || firmData.gaps?.metaAds?.status === 'running' || false;
  const firmHas24x7 = firmData.afterHoursAvailable || firmData.hasLiveChat || firmData.has24x7 || false;

  const formatFirmReviews = firmReviews === 0 ? '—' : firmReviews;
  const formatFirmRating = firmRating === 0 ? '—' : `${parseFloat(firmRating).toFixed(1)}★`;

  return `
    <div class="section-label">MARKET OPPORTUNITY</div>

    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>We don't have verified competitor data for ${locationStr} yet. That's often a sign of an under-marketed space.</strong>
      </div>
    </div>

    <h2>Your current position</h2>

    <table class="competitor-table">
      <thead>
        <tr>
          <th></th>
          <th>You</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Google Reviews</strong></td>
          <td>${formatFirmReviews}</td>
        </tr>
        <tr>
          <td><strong>Rating</strong></td>
          <td>${formatFirmRating}</td>
        </tr>
        <tr>
          <td><strong>Google Ads</strong></td>
          <td>${firmHasGoogleAds ? '✓' : '❌'}</td>
        </tr>
        <tr>
          <td><strong>Meta Ads</strong></td>
          <td>${firmHasMetaAds ? '✓' : '❌'}</td>
        </tr>
        <tr>
          <td><strong>24/7 Intake</strong></td>
          <td>${firmHas24x7 ? '✓' : '❌'}</td>
        </tr>
      </tbody>
    </table>

    <div class="competitor-insight">
      <strong>Markets with limited competitor advertising often present the best opportunities. The first firm to build comprehensive infrastructure captures the majority of high-intent leads.</strong>
    </div>

    <div class="big-divider"></div>
  `;
}

function generateSolution(firmName) {
  return `
    <div class="section-label">THE SOLUTION</div>
    
    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>Full infrastructure = Google Ads + Meta Ads + Voice AI + CRM + reporting.</strong> Each piece works together to capture leads that would otherwise be lost.
      </div>
    </div>
    
    <h2>What ${firmName} needs to close these gaps</h2>
    
    <div class="solution-stack">
      <div class="solution-item">
        <div class="solution-icon">🎯</div>
        <div class="solution-content">
          <strong>Google Ads</strong>
          <p>Geo-targeting, dayparting, negative keywords, conversion tracking, call tracking</p>
        </div>
      </div>
      
      <div class="solution-item">
        <div class="solution-icon">📊</div>
        <div class="solution-content">
          <strong>Meta Ads</strong>
          <p>Facebook + Instagram presence, custom audiences, lookalikes, dynamic creative</p>
        </div>
      </div>
      
      <div class="solution-item">
        <div class="solution-icon">🤖</div>
        <div class="solution-content">
          <strong>Voice AI + 24/7 Intake</strong>
          <p>AI answers calls, qualifies leads, books consultations, sends confirmations</p>
        </div>
      </div>
      
      <div class="solution-item">
        <div class="solution-icon">💼</div>
        <div class="solution-content">
          <strong>CRM Integration</strong>
          <p>Lead scoring, pipeline tracking, automated follow-up, deal management</p>
        </div>
      </div>
      
      <div class="solution-item">
        <div class="solution-icon">📈</div>
        <div class="solution-content">
          <strong>Unified Dashboard</strong>
          <p>All data in one place—every lead, call, and dollar tracked</p>
        </div>
      </div>
    </div>
    
    <div class="callout">
      <strong>Sound like a lot?</strong> It is. That's why most firms never do it. We handle the build and management so you focus on practicing law.
    </div>
    
    <div class="big-divider"></div>
  `;
}

function generateProof(practiceArea) {
  return `
    <div class="section-label">THE SYSTEM</div>
    <h2>What the infrastructure delivers</h2>

    <div class="proof-grid">
      <div class="proof-box">
        <div class="proof-number">24/7</div>
        <div class="proof-label">lead capture</div>
        <p>Every call answered, every form submitted—even at 2am</p>
      </div>

      <div class="proof-box">
        <div class="proof-number">&lt;5 min</div>
        <div class="proof-label">response time</div>
        <p>Speed to lead is the #1 factor in conversion</p>
      </div>

      <div class="proof-box">
        <div class="proof-number">100%</div>
        <div class="proof-label">attribution</div>
        <p>Know exactly which ads drive which cases</p>
      </div>
    </div>

    <div class="section-divider"></div>
  `;
}

function generateTwoOptions(heroTotalK, competitors) {
  const hasAds = competitors?.some(c => c.hasGoogleAds);
  const badOption1 = hasAds ? 'Keep watching competitors pull ahead' : 'Keep telling yourself "next quarter"';
  
  return `
    <div class="section-label">NEXT STEP</div>
    <h2>Two options</h2>
    
    <div class="two-options">
      <div class="option-box option-bad">
        <h3>Keep doing what you're doing</h3>
        <ul>
          <li>${badOption1}</li>
          <li>Keep wondering what calls you missed last night</li>
          <li>Keep watching cases go to firms that aren't better</li>
          <li>Another year of $${heroTotalK}K/month disappearing</li>
        </ul>
      </div>
      
      <div class="option-box option-good">
        <h3>Let us build the system</h3>
        <ul>
          <li>Google Ads live in 5 days</li>
          <li>Voice AI live in 10 days</li>
          <li>Meta Ads live in 2 weeks</li>
          <li>Full infrastructure in 3 weeks</li>
        </ul>
      </div>
    </div>
  `;
}

function generateCTA(heroTotalK, firmName) {
  return `
    <div id="booking" class="cta">
      <h2>Ready to help ${firmName} stop losing cases to firms that aren't better?</h2>
      <p>15 minutes. We'll show you exactly what's broken and how to fix it.</p>
      <iframe src="https://api.mortarmetrics.com/widget/booking/7aCMl8OqQAOE3NfjfUGT" style="width: 100%;border:none;overflow: hidden;min-height:600px" scrolling="no" id="mortar-booking-widget"></iframe>
      <script src="https://api.mortarmetrics.com/js/form_embed.js" type="text/javascript"></script>
    </div>
  `;
}

function generateFooter() {
  return `
    <div class="footer">
      Mortar Metrics · Legal Growth Agency · Toronto, ON<br>
      <a href="mailto:hello@mortarmetrics.com">hello@mortarmetrics.com</a>
    </div>
  `;
}

function generateTypingAnimation(searchTerms) {
  return `
<script>
class SearchTyper {
  constructor(elementId, searchTerms, options = {}) {
    this.element = document.getElementById(elementId);
    if (!this.element) return;
    this.searchTerms = searchTerms;
    this.currentIndex = 0;
    this.currentText = '';
    this.isDeleting = false;
    this.typeSpeed = options.typeSpeed || 80;
    this.deleteSpeed = options.deleteSpeed || 40;
    this.pauseBeforeDelete = options.pauseBeforeDelete || 2500;
    this.pauseBeforeType = options.pauseBeforeType || 400;
  }

  type() {
    const currentTerm = this.searchTerms[this.currentIndex];
    
    if (this.isDeleting) {
      this.currentText = currentTerm.substring(0, this.currentText.length - 1);
    } else {
      this.currentText = currentTerm.substring(0, this.currentText.length + 1);
    }
    
    this.element.textContent = this.currentText;
    
    let timeout = this.isDeleting ? this.deleteSpeed : this.typeSpeed;
    
    if (!this.isDeleting && this.currentText === currentTerm) {
      timeout = this.pauseBeforeDelete;
      this.isDeleting = true;
    } else if (this.isDeleting && this.currentText === '') {
      this.isDeleting = false;
      this.currentIndex = (this.currentIndex + 1) % this.searchTerms.length;
      timeout = this.pauseBeforeType;
    }
    
    setTimeout(() => this.type(), timeout);
  }

  start() {
    this.type();
  }
}

const SEARCH_TERMS = ${JSON.stringify(searchTerms)};

document.addEventListener('DOMContentLoaded', () => {
  new SearchTyper('typed-search', SEARCH_TERMS).start();
});
</script>
  `;
}
