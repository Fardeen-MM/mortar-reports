#!/usr/bin/env node
/**
 * REPORT GENERATOR V3 - Matching paletz-report-v3.html Reference
 * 
 * Structure (in order):
 * 1. Hero - typing animation, "They find other firms. Not yours.", scroll hint
 * 2. Gap Section Intro - "Where you're losing cases right now"
 * 3. Gap Card 1 - Google Ads (badge, headline, cost range, math box with caveat)
 * 4. Gap Card 2 - Meta Ads (badge, client perspective story)
 * 5. Gap Card 3 - Voice AI (badge, before/after comparison)
 * 6. Total Strip - Black bar with combined range
 * 7. Competitor Section - Horizontal bar chart for reviews
 * 8. Build List - Numbered list with timeline badges
 * 9. CTA - Simple booking widget, no guilt trips
 * 10. Footer
 * 
 * REMOVED from V12:
 * - TLDR boxes
 * - Section labels ("GAP #1", "GAP #2")
 * - Section pull quotes
 * - Flow diagrams
 * - Proof grid
 * - Two-options guilt trip box
 * - Hero CTA button
 * - Solution stack with emoji icons
 */

const fs = require('fs');
const path = require('path');
const { findCompetitors, getSearchTerms } = require('./ai-research-helper.js');

// Case value ranges by practice area (low-high for ranges)
const CASE_VALUES = {
  'tax': { low: 3500, high: 5500 },
  'family': { low: 4000, high: 6000 },
  'divorce': { low: 4000, high: 6000 },
  'personal injury': { low: 8000, high: 15000 },
  'immigration': { low: 3500, high: 5000 },
  'litigation': { low: 6000, high: 10000 },
  'criminal': { low: 4000, high: 7000 },
  'estate': { low: 2500, high: 4000 },
  'business': { low: 5000, high: 8000 },
  'bankruptcy': { low: 2000, high: 3500 },
  'civil rights': { low: 7000, high: 12000 },
  'employment': { low: 5000, high: 8000 },
  'real estate': { low: 4000, high: 7000 },
  'ip': { low: 6000, high: 10000 },
  'landlord': { low: 3000, high: 5000 },
  'medical malpractice': { low: 12000, high: 20000 },
  'workers comp': { low: 6000, high: 10000 },
  'default': { low: 3500, high: 5500 }
};

// Client type labels by practice area (singular and plural)
const CLIENT_LABELS = {
  'landlord': { singular: 'landlord', plural: 'landlords' },
  'personal injury': { singular: 'accident victim', plural: 'accident victims' },
  'divorce': { singular: 'spouse', plural: 'people going through divorce' },
  'family': { singular: 'parent', plural: 'families' },
  'immigration': { singular: 'immigrant', plural: 'immigrants' },
  'criminal': { singular: 'defendant', plural: 'defendants' },
  'estate': { singular: 'family member', plural: 'families' },
  'business': { singular: 'business owner', plural: 'business owners' },
  'bankruptcy': { singular: 'debtor', plural: 'people in debt' },
  'tax': { singular: 'taxpayer', plural: 'taxpayers' },
  'employment': { singular: 'employee', plural: 'employees' },
  'real estate': { singular: 'buyer', plural: 'property buyers' },
  'default': { singular: 'potential client', plural: 'potential clients' }
};

// Emergency scenarios by practice area
const EMERGENCY_SCENARIOS = {
  'landlord': 'an eviction emergency',
  'personal injury': 'an accident',
  'divorce': 'a custody emergency',
  'family': 'a family crisis',
  'immigration': 'deportation notice',
  'criminal': 'an arrest',
  'estate': 'a sudden death in the family',
  'business': 'a business dispute',
  'bankruptcy': 'creditor harassment',
  'tax': 'an IRS notice',
  'employment': 'wrongful termination',
  'real estate': 'a closing deadline',
  'default': 'a legal emergency'
};

async function generateReport(researchData, prospectName) {
  console.log(`\n📝 Generating V3 Report for ${prospectName}...\n`);
  
  // Validation
  const validation = validateData(researchData);
  if (!validation.passed) {
    console.error('❌ GENERATION BLOCKED:');
    validation.errors.forEach(err => console.error(`   - ${err}`));
    throw new Error(`GENERATION_BLOCKED: ${validation.errors.join(', ')}`);
  }
  
  if (validation.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    validation.warnings.forEach(warn => console.log(`   - ${warn}`));
  }
  
  console.log('✅ Data validation passed\n');
  
  // Extract data
  const {
    firmName: rawFirmName,
    location = {},
    competitors: rawCompetitors = [],
    practiceAreas = []
  } = researchData;
  
  const firmName = normalizeFirmName(rawFirmName);
  const city = location.city || '';
  const state = location.state || '';
  const country = location.country || 'US';
  const currency = (country === 'GB' || country === 'UK') ? '£' : '$';
  
  // Determine practice area - try multiple sources
  const practiceArea = detectPracticeArea(practiceAreas, researchData);
  const practiceLabel = getPracticeLabel(practiceArea);
  const clientLabels = CLIENT_LABELS[practiceArea] || CLIENT_LABELS['default'];
  const clientLabel = clientLabels.singular;
  const clientLabelPlural = clientLabels.plural;
  const emergencyScenario = EMERGENCY_SCENARIOS[practiceArea] || EMERGENCY_SCENARIOS['default'];
  
  console.log(`📍 Location: ${city}, ${state}`);
  console.log(`⚖️  Practice: ${practiceLabel}`);
  
  // Get competitors
  let competitors = rawCompetitors.filter(c => c.name && !isFakeCompetitor(c.name));
  
  if (competitors.length === 0 && city) {
    console.log('🔍 Fetching competitors via Google Places API...');
    try {
      const fetched = await findCompetitors(rawFirmName, city, state, practiceAreas);
      if (fetched && fetched.length > 0) {
        competitors = fetched;
        console.log(`✅ Found ${competitors.length} real competitors`);
      }
    } catch (e) {
      console.log(`⚠️  Could not fetch competitors: ${e.message}`);
    }
  }
  
  // Get search terms for typing animation
  const searchTerms = getSearchTerms(practiceArea, city, state);
  
  // Calculate gaps with RANGES
  const marketMultiplier = getMarketMultiplier(city);
  const firmSizeMultiplier = getFirmSizeMultiplier(researchData);
  const caseValues = CASE_VALUES[practiceArea] || CASE_VALUES['default'];
  
  const gap1 = calculateGap1(marketMultiplier, caseValues);
  const gap2 = calculateGap2(marketMultiplier, caseValues, city);
  const gap3 = calculateGap3(firmSizeMultiplier, caseValues);
  
  const totalLow = gap1.low + gap2.low + gap3.low;
  const totalHigh = gap1.high + gap2.high + gap3.high;
  
  console.log(`💰 Gap ranges: ${currency}${formatRange(gap1.low, gap1.high)} + ${currency}${formatRange(gap2.low, gap2.high)} + ${currency}${formatRange(gap3.low, gap3.high)}`);
  console.log(`   Total: ${currency}${formatRange(totalLow, totalHigh)}/month\n`);
  
  // Get firm's own data for competitor comparison
  const firmReviews = researchData.googleReviews || researchData.googleBusiness?.reviews || 0;
  const firmRating = researchData.googleRating || researchData.googleBusiness?.rating || 0;
  
  // Generate HTML
  const html = generateHTML({
    firmName,
    prospectName,
    city,
    state,
    practiceArea,
    practiceLabel,
    clientLabel,
    clientLabelPlural,
    emergencyScenario,
    searchTerms,
    caseValues,
    currency,
    gap1,
    gap2,
    gap3,
    totalLow,
    totalHigh,
    competitors,
    firmReviews,
    firmRating
  });
  
  // Save report
  const firmSlug = firmName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const reportsDir = path.resolve(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const outputPath = path.resolve(reportsDir, `${firmSlug}-report-v3.html`);
  fs.writeFileSync(outputPath, html);
  
  console.log(`💾 Saved: ${outputPath}`);
  console.log(`✅ Report generated successfully`);
  console.log(`   Lines: ${html.split('\n').length}\n`);
  
  return { html, outputPath };
}

function validateData(data) {
  const errors = [];
  const warnings = [];
  
  if (!data.firmName || data.firmName === 'Unknown' || data.firmName === 'Unknown Firm') {
    errors.push('Firm name is invalid or missing');
  }
  
  if (!data.location?.city || !data.location?.state) {
    warnings.push('Location missing - will use generic copy');
  }
  
  if (!data.practiceAreas || data.practiceAreas.length === 0) {
    warnings.push('Practice area missing');
  }
  
  return { passed: errors.length === 0, errors, warnings };
}

function normalizeFirmName(name) {
  if (!name) return 'Unknown Firm';
  return name
    .replace(/\bLlp\b/g, 'LLP')
    .replace(/\bLlc\b/g, 'LLC')
    .replace(/\bPllc\b/g, 'PLLC')
    .replace(/\bPc\b/g, 'PC')
    .replace(/\bPa\b/g, 'PA');
}

function isFakeCompetitor(name) {
  const patterns = [/acme/i, /placeholder/i, /test\s+firm/i, /sample\s+law/i, /generic/i];
  return patterns.some(p => p.test(name));
}

// Sanitize competitor names - truncate long names, clean up garbage
function sanitizeCompetitorName(name) {
  if (!name) return 'Competitor';

  // If name has multiple commas, it's likely concatenated garbage - take first part
  if ((name.match(/,/g) || []).length >= 2) {
    name = name.split(',')[0].trim();
  }

  // If still too long (>50 chars), truncate intelligently
  if (name.length > 50) {
    // Try to cut at a word boundary
    const truncated = name.substring(0, 47);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 30) {
      return truncated.substring(0, lastSpace) + '...';
    }
    return truncated + '...';
  }

  return name;
}

// Try to detect practice area from multiple sources
function detectPracticeArea(practiceAreas, researchData) {
  // Try each practice area in order until we find a specific one
  for (const pa of (practiceAreas || [])) {
    const category = getPracticeAreaCategory(pa);
    if (category !== 'default') {
      return category;
    }
  }

  // Try to infer from services
  const services = researchData.services || researchData.intelligence?.services || [];
  for (const service of services) {
    const category = getPracticeAreaCategory(service);
    if (category !== 'default') {
      return category;
    }
  }

  // Try to infer from firm name
  const firmNameLower = (researchData.firmName || '').toLowerCase();
  if (firmNameLower.includes('family') || firmNameLower.includes('divorce')) return 'divorce';
  if (firmNameLower.includes('injury') || firmNameLower.includes('accident')) return 'personal injury';
  if (firmNameLower.includes('immigration')) return 'immigration';
  if (firmNameLower.includes('criminal') || firmNameLower.includes('defense')) return 'criminal';
  if (firmNameLower.includes('estate') || firmNameLower.includes('trust') || firmNameLower.includes('probate')) return 'estate';
  if (firmNameLower.includes('tax')) return 'tax';
  if (firmNameLower.includes('landlord') || firmNameLower.includes('eviction')) return 'landlord';
  if (firmNameLower.includes('employment') || firmNameLower.includes('labor')) return 'employment';
  if (firmNameLower.includes('bankruptcy')) return 'bankruptcy';

  // Default to 'default' which will show "LEGAL SERVICES"
  return 'default';
}

function getPracticeAreaCategory(raw) {
  if (!raw) return 'default';
  const lower = raw.toLowerCase();
  if (lower.includes('landlord') || lower.includes('eviction') || lower.includes('tenant')) return 'landlord';
  if (lower.includes('divorce') || lower.includes('family')) return 'divorce';
  if (lower.includes('tax')) return 'tax';
  if (lower.includes('injury') || lower.includes('accident')) return 'personal injury';
  if (lower.includes('immigration')) return 'immigration';
  if (lower.includes('criminal') || lower.includes('dui')) return 'criminal';
  if (lower.includes('estate') || lower.includes('probate') || lower.includes('trust')) return 'estate';
  if (lower.includes('business') || lower.includes('corporate')) return 'business';
  if (lower.includes('bankruptcy')) return 'bankruptcy';
  if (lower.includes('employment') || lower.includes('labor')) return 'employment';
  if (lower.includes('real estate') || lower.includes('property')) return 'real estate';
  if (lower.includes('ip') || lower.includes('patent') || lower.includes('trademark')) return 'ip';
  if (lower.includes('malpractice') || lower.includes('medical')) return 'medical malpractice';
  if (lower.includes('worker') || lower.includes('comp')) return 'workers comp';
  return 'default';
}

function getPracticeLabel(category) {
  const labels = {
    'divorce': 'FAMILY LAW',
    'family': 'FAMILY LAW',
    'tax': 'TAX LAW',
    'personal injury': 'PERSONAL INJURY',
    'immigration': 'IMMIGRATION LAW',
    'criminal': 'CRIMINAL DEFENSE',
    'estate': 'ESTATE PLANNING',
    'business': 'BUSINESS LAW',
    'bankruptcy': 'BANKRUPTCY LAW',
    'employment': 'EMPLOYMENT LAW',
    'real estate': 'REAL ESTATE LAW',
    'ip': 'INTELLECTUAL PROPERTY',
    'landlord': 'LANDLORD LAW',
    'medical malpractice': 'MEDICAL MALPRACTICE',
    'workers comp': 'WORKERS COMPENSATION',
    'default': 'LEGAL SERVICES'
  };
  return labels[category] || 'LEGAL SERVICES';
}

// Get practice area description for prose (lowercase, readable)
function getPracticeDescription(category) {
  const descriptions = {
    'divorce': 'family law',
    'family': 'family law',
    'tax': 'tax law',
    'personal injury': 'personal injury',
    'immigration': 'immigration',
    'criminal': 'criminal defense',
    'estate': 'estate planning',
    'business': 'business law',
    'bankruptcy': 'bankruptcy',
    'employment': 'employment law',
    'real estate': 'real estate',
    'ip': 'intellectual property',
    'landlord': 'landlord law',
    'medical malpractice': 'medical malpractice',
    'workers comp': 'workers compensation',
    'default': 'legal services'
  };
  return descriptions[category] || 'legal services';
}

// Get attorney type for "X attorney" phrasing
function getAttorneyType(category) {
  const types = {
    'divorce': 'family',
    'family': 'family',
    'tax': 'tax',
    'personal injury': 'personal injury',
    'immigration': 'immigration',
    'criminal': 'criminal defense',
    'estate': 'estate planning',
    'business': 'business',
    'bankruptcy': 'bankruptcy',
    'employment': 'employment',
    'real estate': 'real estate',
    'ip': 'IP',
    'landlord': 'landlord',
    'medical malpractice': 'medical malpractice',
    'workers comp': 'workers comp',
    'default': ''
  };
  return types[category] || '';
}

function getMarketMultiplier(city) {
  const c = (city || '').toLowerCase();
  const major = ['new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
    'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'san francisco',
    'seattle', 'denver', 'boston', 'nashville', 'portland', 'las vegas', 'toronto'];
  if (major.some(m => c.includes(m))) return 1.8;
  
  const mid = ['memphis', 'louisville', 'richmond', 'new orleans', 'raleigh', 'salt lake city',
    'atlanta', 'miami', 'minneapolis', 'cleveland', 'tampa', 'orlando', 'pittsburgh'];
  if (mid.some(m => c.includes(m))) return 1.2;
  
  return 0.8;
}

function getFirmSizeMultiplier(data) {
  const firmSize = data.firmSize || data.team?.totalCount || 0;
  if (firmSize > 20) return 2.0;
  if (firmSize > 10) return 1.5;
  if (firmSize > 5) return 1.2;
  return 1.0;
}

// Gap calculations returning RANGES
function calculateGap1(marketMultiplier, caseValues) {
  const searches = Math.round(400 * marketMultiplier);
  const ctr = 0.035;
  const conv = 0.12;
  const close = 0.25;
  
  const casesPerMonth = searches * ctr * conv * close;
  const low = Math.round(casesPerMonth * caseValues.low / 500) * 500;
  const high = Math.round(casesPerMonth * caseValues.high / 500) * 500;
  
  return {
    low: Math.max(1500, low),
    high: Math.max(3000, high),
    searches,
    formula: `~${searches} monthly searches × 3.5% CTR × 12% inquiry rate × 25% close rate × $${caseValues.low.toLocaleString()}-${caseValues.high.toLocaleString()} avg case value`
  };
}

function calculateGap2(marketMultiplier, caseValues, city) {
  const audience = Math.round(32000 * marketMultiplier);
  const reach = 0.015;
  const conv = 0.008;
  const close = 0.25;
  
  const casesPerMonth = audience * reach * conv * close;
  const low = Math.round(casesPerMonth * caseValues.low / 500) * 500;
  const high = Math.round(casesPerMonth * caseValues.high / 500) * 500;
  
  return {
    low: Math.max(2000, low),
    high: Math.max(4000, high),
    audience,
    city: city || 'your area',
    formula: `~${(audience/1000).toFixed(0)}K reachable audience in ${city || 'metro'} × 1.5% monthly ad reach × 0.8% conversion to inquiry × 25% close rate × $${caseValues.low.toLocaleString()}-${caseValues.high.toLocaleString()} avg case value`
  };
}

function calculateGap3(firmSizeMultiplier, caseValues) {
  const calls = Math.round(40 * firmSizeMultiplier);
  const afterHours = 0.35;
  const missRate = 0.60;
  const recovery = 0.70;
  const close = 0.20;
  
  const casesPerMonth = calls * afterHours * missRate * recovery * close;
  const low = Math.round(casesPerMonth * caseValues.low / 500) * 500;
  const high = Math.round(casesPerMonth * caseValues.high / 500) * 500;
  
  return {
    low: Math.max(2000, low),
    high: Math.max(3500, high),
    calls,
    formula: `~${calls} inbound calls/mo × 35% outside business hours × 60% that won't leave a voicemail × 70% recoverable with live intake × $${caseValues.low.toLocaleString()}-${caseValues.high.toLocaleString()} avg case value`
  };
}

function formatMoney(num) {
  if (num >= 1000) {
    const k = num / 1000;
    // Show .5 for half thousands, otherwise whole number
    if (k % 1 === 0.5) {
      return k.toFixed(1) + 'K';
    }
    return Math.round(k).toLocaleString() + 'K';
  }
  return num.toLocaleString();
}

function formatRange(low, high) {
  return `${formatMoney(low)}-${formatMoney(high)}`;
}

function generateHTML(data) {
  const {
    firmName,
    prospectName,
    city,
    state,
    practiceArea,
    practiceLabel,
    clientLabel,
    clientLabelPlural,
    emergencyScenario,
    searchTerms,
    caseValues,
    currency,
    gap1,
    gap2,
    gap3,
    totalLow,
    totalHigh,
    competitors,
    firmReviews,
    firmRating
  } = data;
  
  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const locationStr = city && state ? `${city}, ${state}` : city || state || 'your area';
  const locationLabel = city && state ? `${city.toUpperCase()}, ${state.toUpperCase()}` : '';
  
  const cssModule = require('./report-v3-css.js');
  const css = cssModule();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${firmName} | Marketing Analysis by Mortar Metrics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
${css}
</head>
<body>
  <div class="container">

    <div class="header">
      <div class="logo">Mortar Metrics</div>
      <div class="meta">Prepared for ${prospectName} - ${today}</div>
    </div>

    <!-- HERO -->
    <section class="hero">
      <div class="hero-context">${practiceLabel} · ${locationLabel}</div>

      <h2 class="hero-setup">Every month, people in ${city || 'your area'} search for</h2>

      <div class="search-bar">
        <svg viewBox="0 0 24 24" width="22" height="22" style="flex-shrink:0">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <div class="search-bar-inner">
          <span class="typed" id="typed-search"></span><span class="cursor-blink"></span>
        </div>
      </div>

      <h1>
        They find other firms.<br>
        <span class="highlight">Not yours.</span>
      </h1>

      <p class="hero-sub">
        We analyzed the ${getPracticeDescription(practiceArea)} market in ${locationStr} — who's showing up, who's advertising, and where the gaps are. Below is where you're losing cases, and exactly how to get them back.
      </p>

      <div class="scroll-hint">
        2 minute read
        <span>↓</span>
      </div>
    </section>


    <!-- THREE GAPS -->
    <div class="divider"></div>

    <div class="narrative">
      <h2>Where you're losing cases right now</h2>

      <p>We looked at how people find and contact ${getAttorneyType(practiceArea) ? getAttorneyType(practiceArea) + ' attorneys' : 'attorneys'} in ${locationStr}. Three specific gaps came up — places where potential clients are looking for help and ending up with someone else. These are patterns we see consistently across legal markets where firms haven't built out their marketing infrastructure.</p>
    </div>


    <!-- GAP 1 - Google Ads -->
    <div class="gap-card">
      <div class="badge badge-search">Google Ads</div>
      <h3>~${gap1.searches} people searched for ${getAttorneyType(practiceArea) ? 'a ' + getAttorneyType(practiceArea) + ' attorney' : 'an attorney'} last month. The firms running ads got those clicks.</h3>
      <div class="gap-card-cost">Estimated opportunity: ~${currency}${formatMoney(gap1.low)}-${formatMoney(gap1.high)}/mo</div>

      <p>When someone types "${searchTerms[0]}", the first thing they see is paid ads. Below that, the Map Pack - which ranks heavily on reviews. Below that, organic results. Without ads and with ${firmReviews || 'few'} reviews against competitors with hundreds or thousands, you're not showing up in any of those three spots for most searches.</p>

      <p>This is the highest-intent channel in legal marketing — these people are actively looking for exactly what you do, right now. In our experience, search ads consistently deliver the fastest results for law firms because the intent is already there.</p>

      <div class="math-box">
        <strong>How we estimated this:</strong> ${gap1.formula}. These conversion rates are based on benchmarks we've seen across legal markets — your actual numbers will vary based on your intake process and close rate.
      </div>
    </div>


    <!-- GAP 2 - Meta Ads -->
    <div class="gap-card">
      <div class="badge badge-social">Meta Ads · Facebook + Instagram</div>
      <h3>Not every ${clientLabel} with a legal problem Googles it. Many are scrolling Facebook right now.</h3>
      <div class="gap-card-cost">Estimated opportunity: ~${currency}${formatMoney(gap2.low)}-${formatMoney(gap2.high)}/mo</div>

      <p>Think about it from a ${clientLabel}'s perspective. They have a legal problem. They're stressed. They're not Googling yet — they're venting in groups, scrolling at night, reading posts from others in similar situations.</p>

      <p>A targeted ad reaches them before they ever search. That's a client your competitors can't touch with search ads alone. The best-performing firms we've seen use both channels because they capture completely different people at different stages.</p>

      <div class="math-box">
        <strong>How we estimated this:</strong> ${gap2.formula}. Wide range because social performance depends heavily on ad creative and targeting — but well-run campaigns for legal services consistently outperform these baselines.
      </div>
    </div>


    <!-- GAP 3 - Voice AI -->
    <div class="gap-card">
      <div class="badge badge-intake">Voice AI · 24/7 Intake</div>
      <h3>When a ${clientLabel} calls at 7pm about ${emergencyScenario} - what happens?</h3>
      <div class="gap-card-cost">Estimated opportunity: ~${currency}${formatMoney(gap3.low)}-${formatMoney(gap3.high)}/mo</div>

      <p>A ${clientLabel} has an emergency. It's Tuesday evening. They call three attorneys. Two go to voicemail. One picks up, qualifies them in 90 seconds, and books a consultation for tomorrow morning. Which firm gets that case?</p>

      <p>Once you're running ads and driving calls, this becomes the difference between paying for leads and actually converting them. The 60% voicemail drop-off is well-documented in legal intake studies — it's the most common leak in the funnel we see.</p>

      <div class="before-after">
        <div class="ba-side ba-before">
          <div class="ba-label">Without 24/7 intake</div>
          <p>Voicemail → caller feels ignored → tries next firm → you follow up next morning but they've already booked elsewhere</p>
        </div>
        <div class="ba-side ba-after">
          <div class="ba-label good">With AI-powered intake</div>
          <p>Answered in seconds → AI qualifies the lead → books consultation → your team is alerted → you wake up with a new client on the calendar</p>
        </div>
      </div>

      <div class="math-box">
        <strong>How we estimated this:</strong> ${gap3.formula}.
      </div>
    </div>


    <!-- TOTAL STRIP -->
    <div class="total-strip">
      <div class="total-strip-text">Combined estimated monthly opportunity</div>
      <div class="total-strip-number">${currency}${formatMoney(totalLow)}-${formatMoney(totalHigh)}</div>
    </div>

    <div class="narrative">
      <p>That's the range — not a guarantee. It depends on your case values, close rate, and how well the system is optimized. The point isn't the exact number. It's that real people in ${locationStr} are searching for the exact service you provide, and right now they're finding other firms instead of you.</p>
    </div>


    <!-- COMPETITOR SECTION -->
    <div class="divider"></div>

    <div class="narrative">
      <h2>And those other firms? Here's who's getting your cases.</h2>

      <p>We pulled the firms showing up for ${getPracticeDescription(practiceArea)} searches in ${locationStr}. Google uses reviews as a major trust signal — more reviews and higher ratings push firms into the Map Pack at the top of results, where most clicks happen. Here's where you stand.</p>
    </div>

${generateCompetitorBars(competitors, firmName, firmReviews, firmRating)}


    <!-- BUILD LIST -->
    <div class="divider"></div>

    <div class="narrative">
      <h2>Here's how we'd close these gaps</h2>

      <p>It's not one thing — it's a system. Each piece feeds the next. Ads drive calls, intake captures them, CRM tracks them, reporting shows you what's working. We handle the build and management. You focus on practicing law.</p>
    </div>

    <div class="build-list">
      <div class="build-item">
        <div class="build-number">1</div>
        <div class="build-content">
          <strong>Google Ads targeting ${getAttorneyType(practiceArea) ? getAttorneyType(practiceArea) + ' law' : 'legal'} searches in your area</strong>
          <p>You show up at the top when someone searches for exactly what you do. Every click tracked, every call recorded, every dollar accounted for.</p>
          <span class="build-timeline">Typically live in 1-2 weeks</span>
        </div>
      </div>

      <div class="build-item">
        <div class="build-number">2</div>
        <div class="build-content">
          <strong>Meta Ads reaching ${clientLabelPlural} before they search</strong>
          <p>Targeted campaigns on Facebook and Instagram — putting your firm in front of ${clientLabelPlural} who need help but haven't started looking.</p>
          <span class="build-timeline">Typically live in 2-3 weeks</span>
        </div>
      </div>

      <div class="build-item">
        <div class="build-number">3</div>
        <div class="build-content">
          <strong>AI-powered intake that answers every call, 24/7</strong>
          <p>No more voicemail. Every call answered, qualified, and booked - even at 2am. Your team gets notified instantly.</p>
          <span class="build-timeline">Typically live in 1-2 weeks</span>
        </div>
      </div>

      <div class="build-item">
        <div class="build-number">4</div>
        <div class="build-content">
          <strong>CRM + reporting so you know what's working</strong>
          <p>Every lead tracked from first click to signed retainer. You see exactly which dollars are producing cases.</p>
          <span class="build-timeline">Set up alongside launch</span>
        </div>
      </div>
    </div>


    <!-- CTA -->
    <div class="divider"></div>

    <div id="booking" class="cta">
      <h2>Want to walk through these numbers together?</h2>
      <p>15 minutes. We'll go through what's realistic for your firm specifically and you can decide if it's worth pursuing.</p>
      <iframe src="https://api.mortarmetrics.com/widget/booking/7aCMl8OqQAOE3NfjfUGT" style="width: 100%; border: none; overflow: hidden; min-height: 600px;" scrolling="no" id="mortar-booking-widget"></iframe>
      <script src="https://api.mortarmetrics.com/js/form_embed.js" type="text/javascript"></script>
    </div>


    <div class="footer">
      Mortar Metrics - Legal Growth Agency - Toronto, ON<br>
      <a href="mailto:hello@mortarmetrics.com">hello@mortarmetrics.com</a>
    </div>

  </div>

${generateTypingScript(searchTerms)}
</body>
</html>`;
}

function generateCompetitorBars(competitors, firmName, firmReviews, firmRating) {
  if (!competitors || competitors.length === 0) {
    return `
    <div class="competitor-section">
      <div class="competitor-takeaway">
        <strong>We couldn't find verified competitor data for this market.</strong> That's often a sign of an under-marketed space - which means first-mover advantage for firms that build comprehensive marketing infrastructure.
      </div>
    </div>
`;
  }

  // Find max reviews for scaling
  const allReviews = [...competitors.map(c => c.reviews || c.reviewCount || 0), firmReviews];
  const maxReviews = Math.max(...allReviews, 1);

  let bars = '<div class="competitor-section">\n';
  
  // Competitor bars
  competitors.slice(0, 3).forEach(comp => {
    const reviews = comp.reviews || comp.reviewCount || 0;
    const rating = comp.rating || 0;
    const width = Math.max((reviews / maxReviews) * 100, 2);
    const cleanName = sanitizeCompetitorName(comp.name);

    bars += `      <div class="review-bar-group">
        <div class="review-bar-label">
          <span class="review-bar-name">${cleanName}</span>
          <span class="review-bar-count">${reviews.toLocaleString()} reviews${rating ? ` · ${rating.toFixed(1)}★` : ''}</span>
        </div>
        <div class="review-bar-track">
          <div class="review-bar-fill competitor" style="width: ${width.toFixed(1)}%"></div>
        </div>
      </div>

`;
  });

  // Firm's bar (in red)
  const firmWidth = Math.max((firmReviews / maxReviews) * 100, 0.5);
  bars += `      <div class="review-bar-group">
        <div class="review-bar-label">
          <span class="review-bar-name you">${firmName} (You)</span>
          <span class="review-bar-count you">${firmReviews || 0} reviews${firmRating ? ` · ${firmRating.toFixed(1)}★` : ''}</span>
        </div>
        <div class="review-bar-track">
          <div class="review-bar-fill yours" style="width: ${firmWidth.toFixed(2)}%"></div>
        </div>
      </div>

      <div class="competitor-takeaway">
        <strong>This doesn't mean they're better attorneys.</strong> In every market we've analyzed, the firms that dominate search results aren't always the best lawyers — they're the ones that invested in infrastructure. Reviews are just the visible part. The real gap is what's happening underneath: ads, intake, and follow-up systems that capture clients before they ever scroll past the first result.
      </div>
    </div>
`;

  return bars;
}

function generateTypingScript(searchTerms) {
  return `
<script>
class SearchTyper {
  constructor(el, terms, opts = {}) {
    this.el = document.getElementById(el);
    if (!this.el) return;
    this.terms = terms;
    this.i = 0;
    this.text = '';
    this.del = false;
    this.ts = opts.typeSpeed || 75;
    this.ds = opts.deleteSpeed || 35;
    this.pd = opts.pauseDel || 2200;
    this.pt = opts.pauseType || 350;
  }
  tick() {
    const t = this.terms[this.i];
    this.text = this.del ? t.substring(0, this.text.length - 1) : t.substring(0, this.text.length + 1);
    this.el.textContent = this.text;
    let d = this.del ? this.ds : this.ts;
    if (!this.del && this.text === t) { d = this.pd; this.del = true; }
    else if (this.del && this.text === '') { this.del = false; this.i = (this.i + 1) % this.terms.length; d = this.pt; }
    setTimeout(() => this.tick(), d);
  }
  start() { this.tick(); }
}

document.addEventListener('DOMContentLoaded', () => {
  new SearchTyper('typed-search', ${JSON.stringify(searchTerms)}).start();
});
</script>
`;
}

// CLI Handler
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);

    if (args.length < 2) {
      console.log('Usage: node report-generator-v3.js <research-json> <contact-name>');
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
      console.error('❌ Error:', error.message);
      if (error.message.includes('GENERATION_BLOCKED')) {
        console.error('\n⚠️  Report generation was blocked due to validation failures.');
      }
      process.exit(1);
    }
  })();
}

module.exports = { generateReport };
