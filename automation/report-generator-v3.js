#!/usr/bin/env node
/**
 * REPORT GENERATOR V7 - Positive framing, omnichannel, guarantee-forward
 *
 * Architecture: Three layers
 *   STRUCTURE (fixed) - HTML, CSS, JS animations, revenue cards, deliverables
 *   MATH (fixed) - Gap formulas, market multipliers, case values, boosted floors
 *   PROSE (AI) - Claude writes card body paragraphs + per-card insights
 *
 * V7 changes from V3:
 *   - Positive hero ("Here's how your firm adds $XXX/month")
 *   - ROI box with net revenue, ad spend, annual projection, case count
 *   - Omnichannel intro paragraph
 *   - 6-step journey bar
 *   - Revenue cards (replace gap cards) with expanded scope badges
 *   - SERP mockup always shows firm at TOP (positive framing)
 *   - Guarantee green banner
 *   - Case study (Mandall Law)
 *   - 21 deliverables in 3 groups
 *   - Timeline strip, "Your only job" box, confidence cards
 *   - Floating CTA button
 *   - Boosted min floors: $55K/$80K, $38K/$56K, $17K/$30K (US base)
 *
 * V8 changes (2026-02-11):
 *   - Population-scaled base volumes (POPULATION_TIERS, not flat 880/65K/85)
 *   - Practice-area-specific floors + case caps (PRACTICE_ECONOMICS)
 *   - Agricultural law category with firm-name signal detection
 *   - Strong firm-name signals checked BEFORE AI classification (Level 0)
 *   - Feature flags: USE_POPULATION_SCALING, USE_PRACTICE_FLOORS
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { findCompetitors, fetchFirmGoogleData, getSearchTerms } = require('./ai-research-helper.js');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// HTML-escape user-provided strings to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Case value ranges by practice area (low-high for ranges) - USD
const CASE_VALUES = {
  'tax': { low: 4500, high: 7000 },
  'family': { low: 5000, high: 7500 },
  'divorce': { low: 5000, high: 7500 },
  'personal injury': { low: 10000, high: 19000 },
  'immigration': { low: 4500, high: 6500 },
  'litigation': { low: 7500, high: 12500 },
  'criminal': { low: 5000, high: 9000 },
  'estate': { low: 3000, high: 5000 },
  'business': { low: 6500, high: 10000 },
  'bankruptcy': { low: 2500, high: 4500 },
  'civil rights': { low: 9000, high: 15000 },
  'employment': { low: 6500, high: 10000 },
  'real estate': { low: 5000, high: 9000 },
  'ip': { low: 7500, high: 12500 },
  'landlord': { low: 4000, high: 6500 },
  'medical malpractice': { low: 15000, high: 25000 },
  'workers comp': { low: 7500, high: 12500 },
  'agricultural': { low: 6000, high: 10000 },
  'default': { low: 4500, high: 7000 }
};

// Case value ranges for UK market - GBP
const CASE_VALUES_GBP = {
  'tax': { low: 3000, high: 5500 },
  'family': { low: 3500, high: 6000 },
  'divorce': { low: 3500, high: 6000 },
  'personal injury': { low: 6500, high: 12500 },
  'immigration': { low: 3000, high: 5000 },
  'litigation': { low: 5500, high: 10000 },
  'criminal': { low: 3500, high: 7000 },
  'estate': { low: 2500, high: 4500 },
  'business': { low: 5000, high: 8000 },
  'employment': { low: 5000, high: 8000 },
  'real estate': { low: 3500, high: 7000 },
  'ip': { low: 5500, high: 10000 },
  'landlord': { low: 3000, high: 5000 },
  'medical malpractice': { low: 10000, high: 19000 },
  'agricultural': { low: 4500, high: 8000 },
  'default': { low: 3000, high: 5500 }
};

// Feature flags (disable with env vars for A/B testing)
const USE_POPULATION_SCALING = process.env.USE_POPULATION_SCALING !== 'false';
const USE_PRACTICE_FLOORS = process.env.USE_PRACTICE_FLOORS !== 'false';
const USE_TIGHT_RANGES = process.env.USE_TIGHT_RANGES !== 'false';

// Population tiers - metro area sizes determine base search/audience/call volumes
const POPULATION_TIERS = {
  mega:  { searches: 1400, audience: 110000, calls: 130 },  // 5M+ (NYC, LA, Chicago)
  major: { searches: 1000, audience: 80000,  calls: 100 },  // 1.5M-5M (Phoenix, Seattle, Miami)
  mid:   { searches: 700,  audience: 50000,  calls: 75 },   // 500K-1.5M (Memphis, Raleigh)
  small: { searches: 450,  audience: 30000,  calls: 55 },   // 150K-500K (Lincoln, Boise)
  micro: { searches: 220,  audience: 15000,  calls: 30 },   // <150K
};

const CITY_POPULATION_TIER = {
  // Mega (5M+)
  'new york': 'mega', 'los angeles': 'mega', 'chicago': 'mega', 'dallas': 'mega',
  'houston': 'mega', 'toronto': 'mega', 'london': 'mega', 'sydney': 'mega',
  // Major (1.5M-5M)
  'phoenix': 'major', 'philadelphia': 'major', 'san diego': 'major', 'san jose': 'major',
  'austin': 'major', 'san francisco': 'major', 'seattle': 'major', 'denver': 'major',
  'boston': 'major', 'nashville': 'major', 'portland': 'major', 'las vegas': 'major',
  'vancouver': 'major', 'montreal': 'major', 'melbourne': 'major', 'atlanta': 'major',
  'miami': 'major', 'minneapolis': 'major', 'tampa': 'major', 'orlando': 'major',
  'irvine': 'major', 'san antonio': 'major',
  // Mid (500K-1.5M)
  'memphis': 'mid', 'louisville': 'mid', 'richmond': 'mid', 'new orleans': 'mid',
  'raleigh': 'mid', 'salt lake city': 'mid', 'manchester': 'mid', 'birmingham': 'mid',
  'leeds': 'mid', 'glasgow': 'mid', 'calgary': 'mid', 'ottawa': 'mid', 'brisbane': 'mid',
  'cleveland': 'mid', 'pittsburgh': 'mid',
  // Small (explicit)
  'lincoln': 'small', 'boise': 'small', 'sioux falls': 'small', 'des moines': 'small',
};

function getPopulationTier(city) {
  const c = (city || '').toLowerCase().trim();
  return POPULATION_TIERS[CITY_POPULATION_TIER[c] || 'small'];
}

// Practice economics: max case caps + floor multipliers per practice area
const PRACTICE_ECONOMICS = {
  'personal injury':     { maxCasesPerGap: 12, floorMultiplier: 1.0 },
  'medical malpractice': { maxCasesPerGap: 6,  floorMultiplier: 0.8 },
  'divorce':             { maxCasesPerGap: 15, floorMultiplier: 1.0 },
  'family':              { maxCasesPerGap: 15, floorMultiplier: 1.0 },
  'immigration':         { maxCasesPerGap: 18, floorMultiplier: 1.0 },
  'criminal':            { maxCasesPerGap: 15, floorMultiplier: 1.0 },
  'estate':              { maxCasesPerGap: 8,  floorMultiplier: 0.7 },
  'tax':                 { maxCasesPerGap: 10, floorMultiplier: 0.8 },
  'business':            { maxCasesPerGap: 10, floorMultiplier: 0.9 },
  'agricultural':        { maxCasesPerGap: 8,  floorMultiplier: 0.7 },
  'bankruptcy':          { maxCasesPerGap: 12, floorMultiplier: 0.9 },
  'employment':          { maxCasesPerGap: 10, floorMultiplier: 0.9 },
  'landlord':            { maxCasesPerGap: 12, floorMultiplier: 0.9 },
  'real estate':         { maxCasesPerGap: 10, floorMultiplier: 0.9 },
  'ip':                  { maxCasesPerGap: 6,  floorMultiplier: 0.8 },
  'workers comp':        { maxCasesPerGap: 10, floorMultiplier: 0.9 },
  'default':             { maxCasesPerGap: 12, floorMultiplier: 1.0 },
};

// Floor base cases per gap channel (used with floorMultiplier)
const GAP_FLOOR_BASE_CASES = { gap1: 10, gap2: 6, gap3: 4 };

// Client labels by practice area (used in fallback prose)
const CLIENT_LABELS = {
  'landlord': { singular: 'landlord', plural: 'landlords' },
  'personal injury': { singular: 'accident victim', plural: 'accident victims' },
  'divorce': { singular: 'spouse', plural: 'spouses' },
  'family': { singular: 'parent', plural: 'parents' },
  'immigration': { singular: 'immigrant', plural: 'immigrants' },
  'criminal': { singular: 'defendant', plural: 'defendants' },
  'estate': { singular: 'family member', plural: 'family members' },
  'agricultural': { singular: 'farmer', plural: 'farmers' },
  'business': { singular: 'business owner', plural: 'business owners' },
  'bankruptcy': { singular: 'debtor', plural: 'debtors' },
  'tax': { singular: 'taxpayer', plural: 'taxpayers' },
  'employment': { singular: 'employee', plural: 'employees' },
  'default': { singular: 'potential client', plural: 'potential clients' }
};

const ATTORNEY_TYPES = {
  'divorce': 'family', 'family': 'family', 'tax': 'tax',
  'personal injury': 'personal injury', 'immigration': 'immigration',
  'criminal': 'criminal defense', 'estate': 'estate planning',
  'business': 'business', 'bankruptcy': 'bankruptcy', 'employment': 'employment',
  'agricultural': 'agricultural',
  'default': ''
};

// Funnel examples per practice area (used in Card 2 body)
const FUNNEL_EXAMPLES = {
  'divorce': { guide: 'What to Expect in a {city} Divorce', topics: 'custody rights and property division' },
  'family': { guide: 'What to Expect in a {city} Divorce', topics: 'custody rights and property division' },
  'personal injury': { guide: 'What to Do After an Accident in {city}', topics: 'injury claims and settlement timelines' },
  'immigration': { guide: 'Your Immigration Rights in {city}', topics: 'visa options and timelines' },
  'criminal': { guide: 'What to Do If You\'re Arrested in {city}', topics: 'your rights and defense strategies' },
  'estate': { guide: 'Estate Planning Basics for {city} Families', topics: 'wills, trusts, and probate' },
  'tax': { guide: 'Tax Issues? Your {city} Guide', topics: 'tax resolution and audit defense' },
  'business': { guide: 'Starting a Business in {city}', topics: 'formation, contracts, and compliance' },
  'bankruptcy': { guide: 'Debt Relief Options in {city}', topics: 'Chapter 7, Chapter 13, and alternatives' },
  'employment': { guide: 'Know Your Workplace Rights in {city}', topics: 'wrongful termination and discrimination' },
  'landlord': { guide: 'Landlord Rights in {city}', topics: 'eviction procedures and tenant disputes' },
  'agricultural': { guide: 'Farm & Ranch Legal Planning in {city}', topics: 'agricultural estate planning, land transfers, and USDA compliance' },
  'default': { guide: 'Your Legal Rights in {city}', topics: 'legal options and next steps' }
};

// Authority signals — subtle experience/credibility cues to weave into prose
const AUTHORITY_SIGNALS = {
  'personal injury': [
    'PI keywords cost $100-300/click. The firms winning aren\'t outbidding everyone. They\'re using Performance Max and retargeting to cut cost per signed case in half.',
    'We typically see PI firms sign their first ad-sourced case within 10 days of launch.',
    'The biggest intake gap we see in PI is after-hours. 40% of injury calls come between 6pm and 8am.'
  ],
  'medical malpractice': [
    'Med mal has the highest cost-per-click in legal. The firms winning use Performance Max to diversify beyond search, then retarget website visitors who didn\'t convert.',
    'We typically see med mal firms generate their first qualified consultation within 14 days.',
    'Most med mal leads need 3-4 touchpoints before they call. That\'s why content funnels matter more here than in any other practice area.'
  ],
  'family': [
    'Family law keywords are competitive, but conversion rates are high because people searching are ready to act. The key is landing pages, not just ads.',
    'We typically see family law firms book their first consultation from ads within 7-10 days.',
    'The biggest gap we see in family law is follow-up. Most firms lose 40%+ of leads because they don\'t have automated nurture sequences.'
  ],
  'divorce': [
    'Family law keywords are competitive, but conversion rates are high because people searching are ready to act. The key is landing pages, not just ads.',
    'We typically see family law firms book their first consultation from ads within 7-10 days.',
    'The biggest gap we see in family law is follow-up. Most firms lose 40%+ of leads because they don\'t have automated nurture sequences.'
  ],
  'immigration': [
    'Immigration clients often search in multiple languages. Firms that run bilingual ads and landing pages see 2-3x the conversion rate.',
    'We typically see immigration firms fill their consultation calendar within the first 2 weeks of launching ads.',
    'The biggest opportunity in immigration is content. Free guides on visa processes generate leads for months after you publish them.'
  ],
  'criminal': [
    'Criminal defense is the most time-sensitive practice area. The firm that answers first gets the case, every single time.',
    'We typically see criminal defense firms sign their first ad-sourced case within a week of launch.',
    'Most criminal defense firms we work with were leaving money on the table because nobody answered at 2am when the calls actually come in.'
  ],
  'estate': [
    'Estate planning has lower search volume than other practice areas, but the clients who do search convert at a much higher rate. Less competition means lower ad costs.',
    'We typically see estate planning firms generate their first consultations within 2 weeks using a combination of ads and free guide funnels.',
    'The biggest opportunity in estate planning is educational content. Webinars on "what happens without a will" consistently fill rooms and pipelines.'
  ],
  'agricultural': [
    'Agricultural law is niche, but that works in your favor. Lower competition means lower ad costs and higher conversion rates.',
    'We typically see agricultural firms generate their first qualified leads within 2 weeks because the competition for these keywords is thin.',
    'Most agricultural law clients find their attorney through search. The firm that shows up first in the local results wins the case.'
  ],
  'tax': [
    'Tax law has huge seasonal surges. The firms that win are the ones with ads scaled up before filing deadlines, not scrambling after.',
    'We typically see tax firms generate their first leads within 10 days of launching ads.',
    'The biggest gap we see in tax law is follow-up. Someone who doesn\'t hire today still has a tax problem. Automated nurture turns "not yet" into signed retainers.'
  ],
  'business': [
    'Business law clients rarely search "business lawyer." They search their specific problem. The firms winning run ads on 50+ long-tail keywords, not just 5 generic ones.',
    'We typically see business law firms generate their first qualified consultation within 2 weeks.',
    'Most business law clients come from referrals. Digital marketing doesn\'t replace that. It adds a second pipeline of clients who don\'t know anyone to ask.'
  ],
  'bankruptcy': [
    'Bankruptcy clients are in crisis. The firm that shows up first and answers immediately gets the case. Speed-to-lead is everything.',
    'We typically see bankruptcy firms sign their first ad-sourced case within 10 days.',
    'Bankruptcy has tight deadlines and seasonal surges. The firms that win scale their ad spend up and down with demand, not flat monthly budgets.'
  ],
  'employment': [
    'Employment law clients often don\'t know they have a case until they find your content. Educational ads and free guides outperform direct-response ads 3:1.',
    'We typically see employment law firms generate their first qualified leads within 2 weeks.',
    'The biggest gap we see in employment law is content. Free guides on wrongful termination or discrimination generate leads for months.'
  ],
  'landlord': [
    'Landlord law has lower search volume, but the clients who search are ready to act. Conversion rates are consistently higher than other practice areas.',
    'We typically see landlord law firms book their first consultation from ads within 10 days.',
    'The biggest opportunity in landlord law is being the first result. Most landlords search once, call the first firm they find, and hire them.'
  ],
  'default': [
    'The firms winning in your market aren\'t the biggest. They\'re the ones answering first and showing up in every search.',
    'We typically see firms sign their first new case from ads within 10-14 days of launch.',
    'Most firms we work with are leaving money on the table because their website isn\'t built to convert visitors into consultations.'
  ]
};

// FAQ by practice area — tailored objection-handling questions
const FAQ_BY_PRACTICE = {
  'personal injury': [
    { q: 'How do you handle high-cost keywords?', a: 'PI keywords cost $100-300/click. We use Performance Max, retargeting, and content funnels to reduce cost per signed case. You pay per case signed, not per click.' },
  ],
  'medical malpractice': [
    { q: 'How do you handle high-cost keywords?', a: 'Med mal keywords are the most expensive in legal. We use Performance Max, retargeting, and content funnels to reduce cost per signed case. You pay per case signed, not per click.' },
  ],
  'family': [
    { q: 'My clients are going through emotional situations. Will the marketing feel appropriate?', a: 'Every touchpoint is designed with empathy. Free guides, educational webinars, warm follow-up. No ambulance-chasing. Your clients feel supported from the first click.' },
  ],
  'divorce': [
    { q: 'My clients are going through emotional situations. Will the marketing feel appropriate?', a: 'Every touchpoint is designed with empathy. Free guides, educational webinars, warm follow-up. No ambulance-chasing. Your clients feel supported from the first click.' },
  ],
  'immigration': [
    { q: 'My clients speak multiple languages. Can the system handle that?', a: 'AI intake handles English and Spanish. Landing pages and follow-up sequences can be translated to any language your clients need.' },
  ],
  'criminal': [
    { q: 'My cases are urgent. Leads need to reach me now.', a: 'That\'s exactly what AI intake solves. Every call answered in seconds, 24/7. After-hours leads booked before they call the next firm.' },
  ],
  'estate': [
    { q: 'My practice area is niche. Is there enough search volume?', a: 'The report shows your exact local search volume. Niche areas have less competition, which means lower ad costs and higher conversion rates. Less volume, more quality.' },
  ],
  'agricultural': [
    { q: 'My practice area is niche. Is there enough search volume?', a: 'The report shows your exact local search volume. Niche areas have less competition, which means lower ad costs and higher conversion rates. Less volume, more quality.' },
  ],
  'tax': [
    { q: 'My cases have tight deadlines. Can the system handle seasonal surges?', a: 'The ad spend scales up and down. Tax season, filing deadlines. We adjust budgets and targeting in real-time so you\'re not overspending in quiet months or missing leads in busy ones.' },
  ],
  'bankruptcy': [
    { q: 'My cases have tight deadlines. Can the system handle seasonal surges?', a: 'The ad spend scales up and down. Filing deadlines, seasonal surges. We adjust budgets and targeting in real-time so you capture every lead when demand spikes.' },
  ],
  'business': [
    { q: 'Most of my clients come from referrals. Will digital marketing cannibalize that?', a: 'No, it compounds it. Referrals still come in. Digital adds a second pipeline of clients who don\'t know anyone to ask. Two sources are better than one.' },
  ],
  'employment': [
    { q: 'Most of my clients come from referrals. Will digital marketing cannibalize that?', a: 'No, it compounds it. Referrals still come in. Digital adds a second pipeline of clients who don\'t know anyone to ask. Two sources are better than one.' },
  ],
  'default': [
    { q: 'My practice area is specialized. Do you have experience with it?', a: 'We build custom campaigns for every practice area. The research in this report is specific to your market and your competitors. Nothing is generic.' },
  ]
};

function getAttorneyType(practiceArea) {
  return ATTORNEY_TYPES[practiceArea] || '';
}

function getAttorneyPhrase(practiceArea, plural, country) {
  const isUK = (country === 'GB' || country === 'UK');
  const word = isUK ? (plural ? 'solicitors' : 'solicitor') : (plural ? 'attorneys' : 'attorney');
  const type = getAttorneyType(practiceArea);
  return type ? `${type} ${word}` : word;
}

// ============================================================================
// NEW V7 HELPERS
// ============================================================================

/**
 * Ad spend estimate: ~4% of total low, clamped $3K-$10K
 */
function calculateAdSpend(totalLow, countryBaseline, currency) {
  const raw = Math.round(totalLow * 0.04 / 500) * 500;
  const minSpend = Math.round(3000 * countryBaseline / 500) * 500 || 500;
  const maxSpend = Math.round(10000 * countryBaseline / 500) * 500 || 2000;
  return Math.max(minSpend, Math.min(maxSpend, raw));
}

/**
 * Case count per card
 */
function calculateCardCases(cardLow, caseValueLow, practiceArea) {
  const econ = PRACTICE_ECONOMICS[practiceArea] || PRACTICE_ECONOMICS['default'];
  const raw = Math.max(1, Math.round(cardLow / caseValueLow));
  return USE_PRACTICE_FLOORS ? Math.min(raw, econ.maxCasesPerGap) : raw;
}

/**
 * Annual projection: net revenue × 12
 */
function calculateAnnual(netLow, netHigh) {
  return { low: netLow * 12, high: netHigh * 12 };
}

/**
 * Get funnel example for practice area, with city substitution
 */
function getFunnelExample(practiceArea, city) {
  const entry = FUNNEL_EXAMPLES[practiceArea] || FUNNEL_EXAMPLES['default'];
  return {
    guide: entry.guide.replace('{city}', city || 'Your City'),
    topics: entry.topics
  };
}

// ============================================================================
// FIRM CONTEXT BUILDER - Assembles research data into plain-English summary
// ============================================================================

function buildFirmContext(researchData) {
  const lines = [];

  // Ads status
  const gAds = researchData.adsData?.googleAds || researchData.adsData?.summary;
  const mAds = researchData.adsData?.metaAds;
  if (gAds?.adCount > 0 || gAds?.runningGoogleAds) {
    lines.push(`Currently running ${gAds.adCount || 'some'} Google Ads.`);
  } else if (researchData.googleAdsData?.hasAds) {
    lines.push(`Currently running ${researchData.googleAdsData.adCount || 'some'} Google Ads.`);
  } else {
    lines.push('Not currently running Google Ads.');
  }

  if (mAds?.activeCount > 0) {
    lines.push(`Currently running ${mAds.activeCount} active Meta/Facebook ads.`);
  } else if (mAds?.inactiveCount > 0) {
    lines.push(`Previously ran Meta ads (${mAds.inactiveCount} inactive), but none active now.`);
  } else if (researchData.metaAdsData?.hasActiveAds) {
    lines.push(`Currently running Meta/Facebook ads (${researchData.metaAdsData.activeCount || 'some'} active).`);
  } else if (researchData.metaAdsData?.hasInactiveAds) {
    lines.push(`Previously ran Meta ads (${researchData.metaAdsData.inactiveCount || 'some'} inactive), but none active now.`);
  } else {
    lines.push('No Meta/Facebook ads detected.');
  }

  // Domain vs firm name
  try {
    const domain = new URL(researchData.website).hostname.replace('www.', '');
    const nameSlug = (researchData.firmName || '').toLowerCase().replace(/[^a-z]/g, '');
    const domainSlug = domain.split('.')[0].toLowerCase().replace(/[^a-z]/g, '');
    if (domainSlug && nameSlug && domainSlug !== nameSlug) {
      lines.push(`Domain "${domain}" differs from firm name. Likely an SEO/keyword domain strategy.`);
    }
  } catch (_) { /* invalid URL, skip */ }

  // Social & content
  const sm = researchData.socialMedia || {};
  const channels = Object.entries(sm).filter(([k, v]) => v).map(([k]) => k);
  if (channels.length) lines.push(`Social media presence: ${channels.join(', ')}.`);

  const mktg = researchData.marketing || {};
  if (mktg.hasBlog) lines.push('Has an active blog.');
  if (mktg.videoContent) lines.push('Has video content on their site.');
  if (mktg.hasLiveChat) lines.push('Has live chat on their website.');
  if (mktg.websiteModernization) lines.push(`Website modernization: ${mktg.websiteModernization}.`);

  // Scan pages for content signals
  const allText = (researchData.websitePages || []).map(p => (p.text || '').toLowerCase()).join(' ');
  const signals = [];
  if (allText.includes('webinar')) signals.push('webinars');
  if (allText.includes('podcast')) signals.push('podcast');
  if (allText.includes('newsletter') || allText.includes('subscribe')) signals.push('newsletter/email list');
  if (allText.includes('youtube') || allText.includes('video')) signals.push('video content');
  if (allText.includes('seminar') || allText.includes('workshop')) signals.push('seminars/workshops');
  if (signals.length) lines.push(`Content marketing signals: ${signals.join(', ')}.`);

  // Website features
  const features = [];
  if (researchData.hasChatbot) features.push('chatbot');
  if (researchData.hasBookingWidget) features.push('booking widget');
  if (researchData.mobileOptimized) features.push('mobile-optimized');
  if (features.length) lines.push(`Website features: ${features.join(', ')}.`);

  // Google Business — only note if profile is active, don't feed raw review counts
  const gmb = researchData.googleBusiness;
  if (gmb?.rating && gmb.rating > 0) {
    lines.push(`Google Business Profile: active (${gmb.rating} stars).`);
  }

  // AI intelligence
  const intel = researchData.intelligence || {};
  if (intel.marketingMaturity) {
    const maturityMap = {
      'low': 'Marketing is mostly word-of-mouth and referrals. Room to build digital infrastructure.',
      'medium': 'Some digital marketing in place. Opportunity to optimize and scale.',
      'high': 'Already investing in digital marketing. Opportunity to optimize ROI.'
    };
    const maturityDesc = maturityMap[(intel.marketingMaturity || '').toLowerCase()] || `Current marketing approach: ${intel.marketingMaturity}.`;
    lines.push(maturityDesc);
  }
  if (intel.painPoints?.length) {
    const filteredPains = intel.painPoints
      .filter(p => !/review|rating|credibility gap/i.test(p))
      .slice(0, 3);
    if (filteredPains.length) lines.push(`Potential pain points: ${filteredPains.join('; ')}.`);
  }
  if (intel.personalizationHooks?.length) lines.push(`Personalization hooks: ${intel.personalizationHooks.slice(0, 3).join('; ')}.`);
  if (intel.opportunities?.length) lines.push(`Opportunities: ${intel.opportunities.slice(0, 3).join('; ')}.`);

  // Positioning
  const pos = researchData.positioning || {};
  if (pos.uniqueSellingPoints?.length) lines.push(`USPs: ${pos.uniqueSellingPoints.slice(0, 3).join('; ')}.`);
  if (pos.differentiation) lines.push(`Differentiation: ${pos.differentiation}.`);

  return lines.join('\n');
}

// ============================================================================
// AI PROSE GENERATION - One Claude call writes card body paragraphs
// ============================================================================

function callClaude(prompt, maxTokens = 3000) {
  return new Promise((resolve, reject) => {
    if (!ANTHROPIC_API_KEY) {
      reject(new Error('No ANTHROPIC_API_KEY'));
      return;
    }

    const requestData = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
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
      timeout: 60000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.content?.[0]?.text) {
            resolve(result.content[0].text);
          } else if (result.error) {
            reject(new Error(`Claude API error: ${result.error.message || JSON.stringify(result.error)}`));
          } else {
            reject(new Error(`Unexpected Claude response: ${data.substring(0, 300)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Claude request timeout'));
    });

    req.write(requestData);
    req.end();
  });
}

/**
 * Generate card body paragraphs in one Claude call.
 * Only 3 AI-generated fields. Everything else is templated.
 */
async function generateProseContent(context) {
  const {
    firmName, city, state, country, currency,
    practiceArea, practiceDescription,
    gap1, gap2, gap3,
    competitors, firmContext
  } = context;

  const isUK = (country === 'GB' || country === 'UK');
  const isAU = (country === 'AU');
  const locationStr = city && state ? `${city}, ${state}` : city || state || 'your area';

  const competitorNames = (competitors || []).slice(0, 3).map(c => {
    const hasAds = c.hasGoogleAds === true;
    return `${c.name}${hasAds ? ' (running Google Ads)' : ''}`;
  }).join(', ');

  const localeInstructions = isUK
    ? `LOCALE: United Kingdom. Use UK English: solicitor (not attorney), enquiry (not inquiry), law practice (not law firm), £ (not $). Write naturally in UK English.`
    : isAU
      ? `LOCALE: Australia. Use Australian English: solicitor or lawyer, enquiry, A$ or $. Write naturally in Australian English.`
      : `LOCALE: United States. Use US English: attorney, lawyer, law firm, $. Write naturally in US English.`;

  const funnel = getFunnelExample(practiceArea, city);

  const firmContextBlock = firmContext
    ? `\nWHAT WE KNOW ABOUT THIS FIRM'S CURRENT MARKETING:\n${firmContext}\n\nFRAMING RULES:\n- If they're already doing something (running ads, posting content, hosting webinars), acknowledge it. Show them how to do it better, not how to start from scratch.\n- If they're NOT doing something, frame it as an untapped opportunity.\n- Reference specific things from the research above to prove we looked at their firm closely.\n- Never fabricate. Only reference what's listed above.\n- DO NOT use Google review counts as a criticism. Reviews and ads are separate channels. Focus on conversion-relevant gaps: ad strategy, funnel optimization, retargeting, intake automation.\n- DO NOT use the phrase "marketing maturity" or any internal scoring labels.\n`
    : '';

  // Get authority signals for this practice area
  const signals = AUTHORITY_SIGNALS[practiceArea] || AUTHORITY_SIGNALS['default'];

  const prompt = `You are writing body paragraphs for 3 revenue cards in a marketing report for a law firm. Write confident, specific copy that sounds like a strategist recommending a system, not a salesperson listing features.

FIRM CONTEXT:
- Name: ${firmName}
- Location: ${locationStr}
- Practice area: ${practiceDescription}
- Country: ${country || 'US'}
${localeInstructions}

COMPETITOR DATA: ${competitorNames || 'No competitor data available'}
${firmContextBlock}
DATA FOR CARDS:
- Card 1 (Google Ads + SEO + Website): ~${gap1.searches} monthly searches for ${practiceDescription} in ${locationStr}
- Card 2 (Meta Ads + Funnels + Content): ~${(gap2.audience/1000).toFixed(0)}K reachable audience. Funnel example: "${funnel.guide}" covering ${funnel.topics}
- Card 3 (AI Intake + CRM): ~${gap3.calls} calls/month, 35% after-hours, 60% won't leave voicemail

AUTHORITY CONTEXT (weave 1-2 of these naturally into the card bodies, don't force all of them):
${signals.join('\n')}

STYLE GUIDE:
- Punchy, direct, no fluff. Write like a strategist recommending specific tactics, not a salesperson listing features.
- Bold the opening sentence of each card with <strong> tags.
- Reference THEIR specific data (search volume, audience size, competitor names).
- Wrap key numbers in <span class="stat-highlight"> tags, e.g. <span class="stat-highlight">~700 searches</span>.
- Write 2-3 SHORT paragraphs per card (2-3 sentences each). Separate paragraphs with </p><p> tags.
- Weave in 1-2 subtle experience signals per card. Show you've done this before for similar firms. Don't brag, just casually reference patterns you've seen. Example: "One of the biggest mistakes we see ${practiceDescription} firms make is..." or "We typically see firms like yours..."
- DO NOT repeat the firm name in every card. Use it ONCE across all 3 cards max. Say "your firm", "you", "your team" instead. Repeating the name in every paragraph sounds like a mail merge.
- DO NOT use: "In today's", "leverage", "utilize", "cutting-edge", "game-changer", "robust", "landscape", "unlock", "empower"
- DO NOT use em dashes. Use periods or commas instead.
- DO NOT fabricate statistics or case studies.
- DO NOT use Google review counts as a criticism or gap. Reviews don't determine ad performance. Focus on ad strategy, funnels, and conversion systems.
- DO NOT use the phrase "marketing maturity" or internal scoring labels.

Return ONLY valid JSON with these exact fields:

{
  "card1Body": "Reference ~X searches and what competitors are doing with ads. Recommend specific ad strategies: Performance Max campaigns to dominate search + display + maps, retargeting visitors who didn't convert, dedicated landing pages that convert 3x better than a homepage. Mention SEO for long-term organic rankings. End with reference to the SERP mockup below. Use <strong> for the bold opening sentence.",
  "card2Body": "Reference ~XK audience. Bold opening: Google only catches people actively searching. Recommend a full content-to-client funnel: webinar funnels on ${funnel.topics} that position the firm as the authority, lead magnet funnels with the specific guide example, retargeting warm audiences who engaged but didn't convert. Explain how paid social + organic content compound into a pipeline. Use <strong> for the bold opening sentence.",
  "card3Body": "Bold opening: The first two channels drive leads, this is what makes sure none slip through. Reference after-hours stats and the revenue impact of missed calls. Emphasize speed-to-lead: the firm that answers first signs the case. Mention AI phone answering, website chatbot, social DM handling, CRM follow-up sequences, SMS and email nurture. Use <strong> for the bold opening sentence.",
  "card1Insight": "One punchy sentence about their current ad/SEO situation. If they run ads, acknowledge it and note the opportunity to scale. If not, note competitors who do. DO NOT mention review counts. Leave empty string if no data.",
  "card2Insight": "One punchy sentence about their content/funnel situation. If they have a blog/YouTube/social, note the untapped conversion potential. If nothing, note the audience they're not reaching. DO NOT mention reviews. Leave empty string if no data.",
  "card3Insight": "One punchy sentence about their intake setup. Frame missing tools as lost revenue, not criticism. DO NOT mention reviews. Leave empty string if no data."
}`;

  console.log('🤖 Generating AI prose content...');

  const response = await callClaude(prompt, 2500);

  let jsonStr = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    throw new Error('No JSON object found in AI response');
  }

  const prose = JSON.parse(objectMatch[0]);

  // Strip any em dashes the AI generates
  for (const key of Object.keys(prose)) {
    if (typeof prose[key] === 'string') {
      prose[key] = prose[key].replace(/\s*—\s*/g, '. ').replace(/\.\.\s/g, '. ');
    }
  }

  const requiredFields = ['card1Body', 'card2Body', 'card3Body'];
  const missing = requiredFields.filter(f => !prose[f]);
  if (missing.length > 0) {
    throw new Error(`AI prose missing fields: ${missing.join(', ')}`);
  }

  // Normalize card insights: ensure they're strings (optional)
  for (const key of ['card1Insight', 'card2Insight', 'card3Insight']) {
    if (typeof prose[key] !== 'string') prose[key] = '';
    prose[key] = prose[key].trim();
  }

  console.log('✅ AI prose generated successfully');
  const insightCount = ['card1Insight', 'card2Insight', 'card3Insight'].filter(k => prose[k]).length;
  if (insightCount > 0) {
    console.log(`   📌 ${insightCount} card insights generated`);
  }
  return prose;
}

// ============================================================================
// FALLBACK PROSE - Templates if AI call fails
// ============================================================================

function generateFallbackProse(context) {
  const {
    city, country, practiceArea, practiceDescription,
    gap1, gap2, gap3, competitors
  } = context;

  const isUK = (country === 'GB' || country === 'UK');
  const attorneyPhrase = getAttorneyPhrase(practiceArea, false, country);
  const article = startsWithVowelSound(attorneyPhrase) ? 'an' : 'a';
  const funnel = getFunnelExample(practiceArea, city);
  const locationStr = city || 'your area';

  const compNames = (competitors || []).slice(0, 3).map(c => sanitizeCompetitorName(c.name));
  const compRef = compNames.length > 0
    ? `The firms below are already doing this. We put you above all of them.`
    : `We put your firm at the top.`;

  return {
    card1Body: `<p><strong><span class="stat-highlight">~${gap1.searches.toLocaleString()}</span> people in ${escapeHtml(locationStr)} searched for ${article} ${escapeHtml(attorneyPhrase)} last month.</strong> That's real demand, and most of it is going to the firms that show up first.</p><p>We run Performance Max campaigns to put your firm across Google Search, Display, and Maps simultaneously. Visitors who don't convert get retargeted until they do. Every click lands on a dedicated page we build to convert, not your homepage. The firms winning in your market aren't the biggest. They're the ones showing up first. ${compRef}</p>`,
    card2Body: `<p><strong>Google only catches people who already know they need a ${isUK ? 'solicitor' : 'lawyer'}.</strong> Most people dealing with ${startsWithVowelSound(practiceDescription) ? 'an' : 'a'} ${escapeHtml(practiceDescription)} issue don't start with a search. They're scrolling at 11pm, thinking about it.</p><p>There are <span class="stat-highlight">~${(gap2.audience/1000).toFixed(0)}K</span> reachable people in your area matching this profile. We build a full content-to-client funnel: webinar funnels on ${escapeHtml(funnel.topics)} that position your firm as the authority, free guides like <em>"${escapeHtml(funnel.guide)}"</em> that capture contact info, and retargeting that brings warm audiences back when they're ready. Most firms we work with started with zero funnel infrastructure. Within 30 days they had a pipeline.</p>`,
    card3Body: `<p><strong>The first two channels drive leads. This is what makes sure none slip through.</strong> <span class="stat-highlight">35%</span> of your leads come in outside business hours, and <span class="stat-highlight">60%</span> of those won't leave a voicemail. That's signed cases walking out the door every week.</p><p>Our AI answers every call in under 60 seconds, responds to every website chat, and handles your Facebook and Instagram DMs automatically. Every lead gets qualified and booked onto your calendar. The ones that don't book get dropped into automated SMS and email follow-up sequences. The biggest leak we see is after-hours. Your competitors' missed calls become your signed cases.</p>`,
    card1Insight: '',
    card2Insight: '',
    card3Insight: ''
  };
}

// ============================================================================
// MAIN GENERATION
// ============================================================================

async function generateReport(researchData, prospectName) {
  console.log(`\n📝 Generating V7 Report for ${prospectName}...\n`);

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
    practiceAreas = [],
    adsData = {}
  } = researchData;

  const firmName = normalizeFirmName(rawFirmName);

  // Normalize country code to ISO 2-letter
  let country = (location.country || 'US').toUpperCase().trim();
  const countryNormMap = {
    'UK': 'GB', 'UNITED KINGDOM': 'GB', 'ENGLAND': 'GB', 'SCOTLAND': 'GB', 'WALES': 'GB',
    'CANADA': 'CA', 'AUSTRALIA': 'AU', 'NEW ZEALAND': 'NZ', 'IRELAND': 'IE',
    'UNITED STATES': 'US', 'USA': 'US', 'UNITED STATES OF AMERICA': 'US'
  };
  if (countryNormMap[country]) country = countryNormMap[country];

  // City validation gate: reject garbage scraped as city
  let city = location.city || '';
  if (city && (/[\n\t<>]/.test(city) || city.length > 40)) {
    console.log(`⚠️  City value looks like garbage: "${city.substring(0, 50)}", clearing`);
    city = '';
  }

  const state = location.state || '';
  const currency = country === 'GB' ? '£' : '$';

  // Determine practice area
  const practiceArea = detectPracticeArea(practiceAreas, researchData);
  const practiceLabel = getPracticeLabel(practiceArea);
  const practiceDescription = getPracticeDescription(practiceArea);

  console.log(`📍 Location: ${city}, ${state}`);
  console.log(`⚖️  Practice: ${practiceLabel}`);

  // Get competitors
  let competitors = rawCompetitors.filter(c => c.name && !isFakeCompetitor(c.name));

  if (competitors.length === 0 && city) {
    console.log('🔍 Fetching competitors via Google Places API...');
    try {
      const fetched = await findCompetitors(rawFirmName, city, state, practiceAreas, country);
      if (fetched && fetched.length > 0) {
        competitors = fetched;
        console.log(`✅ Found ${competitors.length} real competitors`);
      }
    } catch (e) {
      console.log(`⚠️  Could not fetch competitors: ${e.message}`);
    }
  }

  // Get search terms for typing animation
  let searchTerms = getSearchTerms(practiceArea, city, state, country);
  if (!searchTerms || searchTerms.length === 0 || !searchTerms[0]) {
    searchTerms = [`${practiceDescription} near me`];
  }

  // Calculate gaps with BOOSTED FLOORS (V7)
  const isUK = (country === 'GB' || country === 'UK');
  const marketMultiplier = getMarketMultiplier(city, country);
  const countryBaseline = getCountryBaseline(country);
  const firmSizeMultiplier = getFirmSizeMultiplier(researchData);
  const caseValueTable = isUK ? CASE_VALUES_GBP : CASE_VALUES;
  const caseValues = caseValueTable[practiceArea] || caseValueTable['default'];

  const gap1 = calculateGap1(marketMultiplier, caseValues, countryBaseline, currency, city, practiceArea);
  const gap2 = calculateGap2(marketMultiplier, caseValues, city, countryBaseline, currency, practiceArea);
  const gap3 = calculateGap3(firmSizeMultiplier, caseValues, countryBaseline, currency, city, practiceArea);

  const totalLow = gap1.low + gap2.low + gap3.low;
  const totalHigh = gap1.high + gap2.high + gap3.high;

  // V7 ROI calculations
  const adSpend = calculateAdSpend(totalLow, countryBaseline, currency);
  const netLow = totalLow - adSpend;
  const netHigh = totalHigh - adSpend;
  const annual = calculateAnnual(netLow, netHigh);
  const card1Cases = calculateCardCases(gap1.low, caseValues.low, practiceArea);
  const card2Cases = calculateCardCases(gap2.low, caseValues.low, practiceArea);
  const card3Cases = calculateCardCases(gap3.low, caseValues.low, practiceArea);
  const totalCases = card1Cases + card2Cases + card3Cases;

  console.log(`💰 Gap ranges: ${currency}${formatRange(gap1.low, gap1.high)} + ${currency}${formatRange(gap2.low, gap2.high)} + ${currency}${formatRange(gap3.low, gap3.high)}`);
  console.log(`   Total: ${currency}${formatRange(totalLow, totalHigh)}/month`);
  console.log(`   Ad spend: ~${currency}${formatMoney(adSpend)} | Net: ${currency}${formatRange(netLow, netHigh)}`);
  console.log(`   Cases: ${card1Cases} + ${card2Cases} + ${card3Cases} = ${totalCases}/month\n`);

  // Build prose context
  const firmContext = buildFirmContext(researchData);
  if (firmContext) {
    console.log('📋 Firm context for AI:\n' + firmContext.split('\n').map(l => '   ' + l).join('\n'));
  }

  const proseContext = {
    firmName, city, state, country, currency,
    practiceArea, practiceDescription,
    searchTerms,
    gap1, gap2, gap3, totalLow, totalHigh,
    competitors, firmContext
  };

  // Try AI prose generation, fall back to templates
  let prose;
  let proseSource = 'fallback';
  try {
    prose = await generateProseContent(proseContext);
    proseSource = 'ai';
    console.log('📝 Prose source: AI-generated');
  } catch (e) {
    console.log(`⚠️  AI prose generation failed: ${e.message}`);
    console.log('📝 Prose source: fallback templates');
    prose = generateFallbackProse(proseContext);
  }

  // Extract firm's own review/ads data for competitor table
  const firmReviews = researchData.googleBusiness?.reviews || researchData.googleReviews || researchData.reviews || 0;
  const gAdsForFirm = adsData.googleAds || adsData.summary || {};
  const firmHasAds = gAdsForFirm.running === true || (gAdsForFirm.adCount > 0);

  // Generate HTML
  const html = generateHTML({
    firmName, prospectName, practiceArea, practiceLabel, practiceDescription,
    searchTerms, currency,
    gap1, gap2, gap3,
    totalLow, totalHigh,
    netLow, netHigh,
    adSpend, annual,
    card1Cases, card2Cases, card3Cases, totalCases,
    competitors, city, state, country,
    prose, proseSource, caseValues,
    firmReviews, firmHasAds
  });

  // Save report
  const firmSlug = firmName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const reportsDir = path.resolve(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const outputPath = path.resolve(reportsDir, `${firmSlug}-report-v3.html`);

  // Validate report HTML before saving
  validateReportHTML(html, firmName);

  fs.writeFileSync(outputPath, html);

  // Write email data file for personalized emails (same 4-field format)
  const emailData = {
    totalRange: `${currency}${formatRange(totalLow, totalHigh)}`,
    totalCases: `${Math.round(totalCases * 0.7)}-${Math.round(totalCases * 1.3)}`,
    practiceLabel: getPracticeDescription(practiceArea),
    currency
  };
  const emailDataPath = path.resolve(reportsDir, `${firmSlug}-email-data.json`);
  fs.writeFileSync(emailDataPath, JSON.stringify(emailData));
  console.log(`📧 Email data: ${JSON.stringify(emailData)}`);

  console.log(`💾 Saved: ${outputPath}`);
  console.log(`✅ Report generated successfully (prose: ${proseSource})`);
  console.log(`   Lines: ${html.split('\n').length}\n`);

  return { html, outputPath };
}

// ============================================================================
// SERP MOCKUP - V7: Firm always at TOP (positive framing)
// ============================================================================

function generateSerpMockup(competitors, firmName, searchTerms) {
  const query = (searchTerms && searchTerms[0]) || 'lawyer near me';
  const topComps = (competitors || []).slice(0, 3);

  let rows = '';

  // Firm at TOP - positive framing
  rows += `        <div class="serp-row serp-you">
          <span class="serp-tag serp-tag-you">You</span>
          <span class="serp-name">${escapeHtml(firmName)}</span>
          <span class="serp-note">top of page</span>
        </div>\n`;

  // Competitors below — only show "Ad" tag if we actually know they run ads
  for (let i = 0; i < 3; i++) {
    if (topComps.length > i) {
      const comp = topComps[i];
      const reviews = comp.reviews || comp.reviewCount || 0;
      const hasAds = comp.hasGoogleAds === true;
      const tag = hasAds ? 'ad' : 'map';
      const tagLabel = hasAds ? 'Ad' : 'Map';
      const note = hasAds ? 'paying for clicks' : 'local result';
      rows += `        <div class="serp-row">
          <span class="serp-tag serp-tag-${tag}">${tagLabel}</span>
          <span class="serp-name">${escapeHtml(sanitizeCompetitorName(comp.name))}</span>
          <span class="serp-note">${note}</span>
        </div>\n`;
    } else {
      rows += `        <div class="serp-row">
          <span class="serp-tag serp-tag-map">Map</span>
          <span class="serp-name">${i === 0 ? 'Other firms' : 'Local result'}</span>
          <span class="serp-note">local result</span>
        </div>\n`;
    }
  }

  return `      <div class="serp-mockup">
        <div class="serp-query">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <span>"${escapeHtml(query)}"</span>
        </div>
${rows}      </div>`;
}

// ============================================================================
// DELIVERABLE CHECK SVG (reusable)
// ============================================================================

const CHECK_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';

// ============================================================================
// COMPETITOR COMPARISON TABLE
// ============================================================================

function generateCompetitorTable(competitors, firmName, firmReviews, firmHasAds) {
  const topComps = (competitors || []).slice(0, 3);
  if (topComps.length === 0) return '';

  let rows = '';
  for (const comp of topComps) {
    const hasAds = comp.hasGoogleAds === true;
    const adsCell = hasAds ? `<span class="ads-yes">${CHECK_SVG} Running ads</span>` : '<span class="ads-no">No ads detected</span>';
    rows += `          <tr>
            <td>${escapeHtml(sanitizeCompetitorName(comp.name))}</td>
            <td>${adsCell}</td>
          </tr>\n`;
  }

  // Firm's own row
  const firmAdsCell = firmHasAds ? `<span class="ads-yes">${CHECK_SVG} Running ads</span>` : '<span class="ads-no">Not yet</span>';
  rows += `          <tr class="competitor-table-you">
            <td>${escapeHtml(firmName)} (You)</td>
            <td>${firmAdsCell}</td>
          </tr>`;

  return `      <div class="competitor-table">
        <div class="competitor-table-label">Who you're competing against right now</div>
        <table>
          <thead>
            <tr>
              <th>Firm</th>
              <th>Google Ads</th>
            </tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>`;
}

// ============================================================================
// FAQ / OBJECTION HANDLER SECTION
// ============================================================================

function generateFaqSection(practiceArea) {
  const universalFaqs = [
    { q: 'How long before I see results?', a: 'Most firms see booked consultations within 14 days. Paid ads drive immediate traffic, while SEO and content compound over months. You\'ll have a full pipeline within 60-90 days.' },
    { q: 'What if I\'ve tried marketing before and it didn\'t work?', a: 'Most firms we talk to had agencies that ran ads but didn\'t build the full system: landing pages, intake, follow-up, tracking. We build the entire pipeline so nothing leaks.' },
    { q: 'How do you know these numbers are realistic?', a: 'Every number in this report comes from a formula with visible assumptions. We show our math and the conversion rates we use. If your market is smaller, the numbers adjust.' },
    { q: 'What\'s the catch with month-to-month?', a: 'No catch. We keep clients by delivering results, not by locking them in. You keep everything we build if you cancel.' },
    { q: 'Do I need to do anything?', a: 'Show up to consultations and sign cases. We handle ads, website, funnels, intake, follow-up, reporting. Your team gets a weekly report and a Slack channel for questions.' },
  ];

  const practiceFaqs = FAQ_BY_PRACTICE[practiceArea] || FAQ_BY_PRACTICE['default'] || [];

  const allFaqs = [...universalFaqs, ...practiceFaqs];

  const items = allFaqs.map(faq => `    <div class="faq-item">
      <button class="faq-question" onclick="this.parentElement.classList.toggle('open')">
        ${escapeHtml(faq.q)}
        <span class="faq-chevron">&#9656;</span>
      </button>
      <div class="faq-answer">
        <p>${escapeHtml(faq.a)}</p>
      </div>
    </div>`).join('\n');

  return `    <div class="faq-section fade-in">
      <div class="faq-label">Questions firms ask us</div>
      <div class="faq-list">
${items}
      </div>
    </div>`;
}

function deliverableItem(title, desc) {
  return `        <div class="deliverable-item">
          <div class="deliverable-check">${CHECK_SVG}</div>
          <div class="deliverable-text"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(desc)}</p></div>
        </div>`;
}

// ============================================================================
// HTML GENERATION - V7 structure
// ============================================================================

function generateHTML(data) {
  const {
    firmName, prospectName, practiceArea, practiceLabel, practiceDescription,
    searchTerms, currency,
    gap1, gap2, gap3,
    totalLow, totalHigh,
    netLow, netHigh,
    adSpend, annual,
    card1Cases, card2Cases, card3Cases, totalCases,
    competitors, city, state, country,
    prose, caseValues,
    firmReviews, firmHasAds
  } = data;

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const locationLabel = city && state ? `${city.toUpperCase()}, ${state.toUpperCase()}` : '';
  const funnel = getFunnelExample(practiceArea, city);

  const cssModule = require('./report-v3-css.js');
  const css = cssModule();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(firmName)} | Growth Report by Mortar Metrics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
${css}
</head>
<body>
  <div class="container">

    <div class="header">
      <div class="logo">Mortar Metrics</div>
      <div class="meta">Prepared for ${escapeHtml(prospectName || 'Your Firm')} at ${escapeHtml(firmName)} · ${today}</div>
    </div>

    <!-- HERO -->
    <section class="hero">
      <div class="hero-context">${practiceLabel}${locationLabel ? ' · ' + escapeHtml(locationLabel) : ''}</div>

      <h2 class="hero-setup">Every month, people in ${escapeHtml(city) || 'your area'} search for</h2>

      <div class="search-bar">
        <svg viewBox="0 0 24 24" width="22" height="22" style="flex-shrink:0">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <div class="search-bar-inner">
          <span class="typed" id="typed-search">${escapeHtml(searchTerms[0])}</span><span class="cursor-blink"></span>
        </div>
      </div>

      <h1>
        <span class="highlight">\u2248 ${totalCases} new signed cases</span><br>every month.
        <span class="hero-revenue-sub">That's ${currency}${formatMoney(totalLow)}\u2013${currency}${formatMoney(totalHigh)} in new revenue.</span>
      </h1>

      <p class="hero-sub">
        We build your website, run your ads, create your funnels, answer every lead, and book consultations on your calendar. 30 qualified leads in 30 days or we work for free until you get them.
      </p>

      <div class="scroll-hint">
        2 minute read
        <span>\u2193</span>
      </div>
    </section>


    <!-- THE NUMBERS -->
    <div class="divider"></div>

    <div class="roi-box fade-in">
      <div class="roi-hero-label">Net new revenue to your firm</div>
      <div class="roi-hero-number">${currency}${formatMoney(netLow)}\u2013${currency}${formatMoney(netHigh)}<span> /mo</span></div>

      <div class="roi-breakdown">
        <div class="roi-detail">
          <div class="roi-detail-number">${currency}${formatMoney(totalLow)}\u2013${currency}${formatMoney(totalHigh)}</div>
          <div class="roi-detail-label">Projected revenue</div>
        </div>
        <div class="roi-detail-divider">\u2212</div>
        <div class="roi-detail">
          <div class="roi-detail-number">~${currency}${formatMoney(adSpend)}</div>
          <div class="roi-detail-label">Ad spend</div>
        </div>
      </div>

      <div class="roi-bottom">
        <div class="roi-annual-number">${currency}${formatMoneyMillions(annual.low)} \u2013 ${currency}${formatMoneyMillions(annual.high)} in your first year</div>
        <div class="roi-annual-label">Across paid ads, SEO, funnels, and AI-powered intake</div>
        <div class="roi-cases">\u2248 ${totalCases} new signed cases every month</div>
      </div>
    </div>

    <!-- AT A GLANCE -->
    <div class="glance-strip fade-in">
      <div class="glance-item">
        <div class="glance-number">\u2248 ${totalCases}</div>
        <div class="glance-label">Cases / month</div>
      </div>
      <div class="glance-item">
        <div class="glance-number">${currency}${formatMoney(totalLow)}\u2013${currency}${formatMoney(totalHigh)}</div>
        <div class="glance-label">Revenue range</div>
      </div>
      <div class="glance-item">
        <div class="glance-number">~${currency}${formatMoney(adSpend)}</div>
        <div class="glance-label">Ad spend</div>
      </div>
      <div class="glance-item">
        <div class="glance-number">${Math.round(totalLow / (adSpend || 1))}x\u2013${Math.round(totalHigh / (adSpend || 1))}x</div>
        <div class="glance-label">ROI</div>
      </div>
    </div>

    <!-- OMNICHANNEL FRAMING -->
    <div class="omni-intro fade-in">
      <p><strong>A potential client doesn't just see one ad and call.</strong> They see your ad, then check your website. They read your reviews. They look at your social media. Maybe they download a guide or watch a webinar first. They check everything about you before they ever pick up the phone \u2014 and if any of those touchpoints looks off, they call someone else. We handle all of it. Every channel, every touchpoint, every follow-up. This is the full system.</p>
    </div>

    <!-- JOURNEY V2 -->
    <div class="journey-v2 fade-in">
      <div class="journey-v2-step">
        <div class="journey-v2-icon">\uD83D\uDC40</div>
        <div class="journey-v2-label">See your ad</div>
        <div class="journey-v2-sub">Google, Facebook, Instagram</div>
        <div class="journey-v2-handled">We handle this</div>
      </div>
      <div class="journey-v2-step">
        <div class="journey-v2-icon">\uD83D\uDD0D</div>
        <div class="journey-v2-label">Check you out</div>
        <div class="journey-v2-sub">Website, reviews, socials</div>
        <div class="journey-v2-handled">We handle this</div>
      </div>
      <div class="journey-v2-step">
        <div class="journey-v2-icon">\uD83D\uDCE5</div>
        <div class="journey-v2-label">Engage</div>
        <div class="journey-v2-sub">Guide, webinar, chat, DM</div>
        <div class="journey-v2-handled">We handle this</div>
      </div>
      <div class="journey-v2-step">
        <div class="journey-v2-icon">\uD83D\uDCDE</div>
        <div class="journey-v2-label">Reach out</div>
        <div class="journey-v2-sub">Call, form, or message</div>
        <div class="journey-v2-handled">We handle this</div>
      </div>
      <div class="journey-v2-step">
        <div class="journey-v2-icon">\uD83D\uDCC5</div>
        <div class="journey-v2-label">Book</div>
        <div class="journey-v2-sub">Consultation on your calendar</div>
        <div class="journey-v2-handled">We handle this</div>
      </div>
      <div class="journey-v2-step">
        <div class="journey-v2-icon">\u270D\uFE0F</div>
        <div class="journey-v2-label">Sign</div>
        <div class="journey-v2-sub">New retained client</div>
        <div class="journey-v2-handled" style="color: var(--primary);">You do this</div>
      </div>
    </div>

    <!-- 3 REVENUE STREAMS -->
    <div class="revenue-cards">
      <!-- GOOGLE ADS + SEO + WEBSITE -->
      <div class="revenue-card fade-in">
        <div class="revenue-card-header">
          <div class="revenue-card-badge search">Google Ads + SEO + Website</div>
          <div class="revenue-card-amount">
            <div class="revenue-card-number">${currency}${formatMoney(gap1.low)}\u2013${currency}${formatMoney(gap1.high)}</div>
            <div class="revenue-card-sub">per month</div>
            <div class="revenue-card-cases">\u2248 ${card1Cases} new signed cases</div>
          </div>
        </div>
${prose.card1Insight ? `        <div class="revenue-card-insight">\u2192 ${prose.card1Insight}</div>` : ''}
        <div class="revenue-card-body">
          ${prose.card1Body}
        </div>
${generateSerpMockup(competitors, firmName, searchTerms)}
${generateCompetitorTable(competitors, firmName, firmReviews, firmHasAds)}
      </div>

      <div class="card-connector">+</div>

      <!-- META ADS + FUNNELS -->
      <div class="revenue-card fade-in">
        <div class="revenue-card-header">
          <div class="revenue-card-badge social">Meta Ads + Funnels + Content</div>
          <div class="revenue-card-amount">
            <div class="revenue-card-number">${currency}${formatMoney(gap2.low)}\u2013${currency}${formatMoney(gap2.high)}</div>
            <div class="revenue-card-sub">per month</div>
            <div class="revenue-card-cases">\u2248 ${card2Cases} new signed cases</div>
          </div>
        </div>
${prose.card2Insight ? `        <div class="revenue-card-insight">\u2192 ${prose.card2Insight}</div>` : ''}
        <div class="revenue-card-body">
          ${prose.card2Body}
        </div>
        <div class="mini-compare">
          <div class="mini-compare-side mini-compare-a">
            <div class="mini-compare-label">Traditional ads</div>
            <p>See ad \u2192 not ready \u2192 scroll past \u2192 gone forever</p>
          </div>
          <div class="mini-compare-side mini-compare-b-social">
            <div class="mini-compare-label">Our funnels</div>
            <p>See ad \u2192 download guide \u2192 get nurtured \u2192 call when ready \u2192 already trust you</p>
          </div>
        </div>
      </div>

      <div class="card-connector">+</div>

      <!-- AI INTAKE + CRM -->
      <div class="revenue-card fade-in">
        <div class="revenue-card-header">
          <div class="revenue-card-badge intake">AI Intake + CRM \u00B7 The conversion engine</div>
          <div class="revenue-card-amount">
            <div class="revenue-card-number">${currency}${formatMoney(gap3.low)}\u2013${currency}${formatMoney(gap3.high)}</div>
            <div class="revenue-card-sub">per month</div>
            <div class="revenue-card-cases">\u2248 ${card3Cases} cases recovered</div>
          </div>
        </div>
${prose.card3Insight ? `        <div class="revenue-card-insight">\u2192 ${prose.card3Insight}</div>` : ''}
        <div class="revenue-card-body">
          ${prose.card3Body}
        </div>
        <div class="mini-compare">
          <div class="mini-compare-side mini-compare-a">
            <div class="mini-compare-label">Without us</div>
            <p>After-hours call \u2192 voicemail \u2192 website chat ignored \u2192 DM unseen \u2192 lead calls another firm</p>
          </div>
          <div class="mini-compare-side mini-compare-b-intake">
            <div class="mini-compare-label">With us</div>
            <p>Every call, chat, and DM answered instantly \u2192 qualified \u2192 booked or nurtured in CRM \u2192 nothing lost</p>
          </div>
        </div>
      </div>
    </div>


    <!-- COST OF INACTION -->
    <div class="cost-inaction fade-in">
      <div class="cost-inaction-label">The cost of staying the same</div>
      <h2 class="cost-inaction-headline">Every month without this system, your firm leaves
        <span class="cost-inaction-amount">${currency}${formatMoney(totalLow)}\u2013${currency}${formatMoney(totalHigh)}</span> on the table.</h2>
      <div class="cost-inaction-annual">That's ${currency}${formatMoneyMillions(annual.low)}\u2013${currency}${formatMoneyMillions(annual.high)} this year alone.</div>
      <p class="cost-inaction-body">Your competitors are already running ads, answering calls after hours, and following up with every lead. The cases you're not getting aren't disappearing \u2014 they're going to firms that show up first.</p>
    </div>

    <!-- GUARANTEE -->
    <div class="guarantee-section fade-in">
      <div class="guarantee-label">Our guarantee</div>
      <div class="guarantee-headline">You risk nothing. We risk everything.</div>
      <div class="guarantee-sub">30 qualified leads in 30 days or we work for free until you get them. If we don't deliver, we keep working at no cost until we hit it.</div>
    </div>

    <!-- CASE STUDY -->
    <div class="case-study fade-in">
      <div class="case-study-label">We've done this before</div>
      <div class="case-study-content">
        <div class="case-study-firm">Mandall Law</div>
        <div class="case-study-context">Personal injury firm, mid-size market</div>
        <div class="case-study-stats">
          <div class="case-study-stat">
            <div class="case-study-number">${currency}4K</div>
            <div class="case-study-desc">monthly ad spend</div>
          </div>
          <div class="case-study-arrow">\u2192</div>
          <div class="case-study-stat">
            <div class="case-study-number">${currency}92K/mo</div>
            <div class="case-study-desc">in new signed cases</div>
          </div>
        </div>
        <div class="case-study-timeline">
          <div class="case-study-milestone">
            <div class="case-study-milestone-time">Week 2</div>
            <div class="case-study-milestone-text">Ads live, website launched, AI intake active</div>
          </div>
          <div class="case-study-milestone">
            <div class="case-study-milestone-time">Month 1</div>
            <div class="case-study-milestone-text">18 booked consultations, 6 signed cases</div>
          </div>
          <div class="case-study-milestone">
            <div class="case-study-milestone-time">Month 3</div>
            <div class="case-study-milestone-text">Full pipeline \u2014 ${currency}92K/month in signed cases</div>
          </div>
        </div>
      </div>
    </div>


    <!-- WHAT WE BUILD -->
    <div class="divider"></div>

    <div class="narrative">
      <h2>Everything we build and manage for you</h2>
      <p style="margin-top: 8px;">Ads, funnels, website, SEO, AI intake, CRM \u2014 the entire system. The last digital marketing agency your firm will ever need.</p>
    </div>

    <div class="deliverables-group fade-in">
      <div class="deliverables-group-label">Drive leads</div>
      <div class="deliverables-grid">
${deliverableItem('Google Ads \u2014 full build + management', 'Targeting, bid strategy, A/B testing, optimization')}
${deliverableItem('Meta Ads \u2014 Facebook + Instagram', 'Ad creative, audience targeting, retargeting')}
${deliverableItem('SEO + local search optimization', 'Organic rankings so you show up without paying')}
${deliverableItem('Website redesign', 'Professional, fast, built to convert visitors into calls')}
${deliverableItem('Lead magnet funnels', 'Free guides and resources that capture contact info')}
${deliverableItem('Webinar funnels', 'Educational events that build trust and generate leads')}
${deliverableItem('Dedicated landing pages', 'Separate from your website, optimized for ad traffic')}
${deliverableItem('Re-engage old leads', 'Re-spark conversations with contacts that went cold')}
      </div>
    </div>

    <div class="deliverables-group fade-in">
      <div class="deliverables-group-label">Capture every lead</div>
      <div class="deliverables-grid">
${deliverableItem('AI voice agent \u2014 24/7', 'Answers every call, qualifies, books consultations')}
${deliverableItem('AI website chatbot', 'Engages every visitor, answers questions, captures leads')}
${deliverableItem('Social media DM handling', 'Auto-responds to Facebook & Instagram messages')}
${deliverableItem('Missed call text-back', 'Instant text if a lead doesn\'t connect')}
${deliverableItem('Speed-to-lead automation', 'Every inquiry gets a response in seconds')}
${deliverableItem('After-hours coverage', 'Nights, weekends, holidays \u2014 never miss a lead')}
      </div>
    </div>

    <div class="deliverables-group fade-in">
      <div class="deliverables-group-label">Convert &amp; track</div>
      <div class="deliverables-grid">
${deliverableItem('Automated follow-up sequences', 'SMS + email nurture for leads that don\'t book')}
${deliverableItem('CRM + full pipeline', 'Every lead tracked from click to signed retainer')}
${deliverableItem('Calendar integration', 'Consultations booked directly onto your calendar')}
${deliverableItem('Call recording + analytics', 'Every call recorded, tagged, tracked')}
${deliverableItem('Reporting dashboard', 'ROI, cost per lead, cost per case \u2014 full visibility')}
${deliverableItem('Review generation', 'Automated requests to build your Google reviews')}
${deliverableItem('Dedicated account manager', 'One point of contact. Not a ticket system.')}
      </div>
    </div>

    <!-- TIMELINE -->
    <div class="timeline-strip">
      <div class="timeline-strip-text">Everything above \u2014 built, live, and running in</div>
      <div class="timeline-strip-number">14 days</div>
    </div>

    <!-- YOUR ONLY JOB -->
    <div class="only-job fade-in">
      <div class="only-job-label">Your only job</div>
      <div class="only-job-big">Show up to consultations. Sign cases.</div>
      <div class="only-job-sub">Ads, funnels, website, SEO, intake, follow-up, CRM \u2014 we handle all of it.</div>
    </div>

    <!-- CONFIDENCE -->
    <div class="confidence-grid fade-in">
      <div class="confidence-item">
        <div class="confidence-icon">\uD83E\uDD1D</div>
        <strong>Month to month</strong>
        <p>No long-term contracts. Cancel anytime. Keep everything we built.</p>
      </div>
      <div class="confidence-item">
        <div class="confidence-icon">\uD83D\uDEE1\uFE0F</div>
        <strong>One firm per area</strong>
        <p>We never compete against our own clients. Your market is yours.</p>
      </div>
      <div class="confidence-item">
        <div class="confidence-icon">\u26A1</div>
        <strong>Results in 2 weeks</strong>
        <p>Most firms see booked consultations within the first 14 days.</p>
      </div>
    </div>

${generateFaqSection(practiceArea)}

    <!-- CTA -->
    <div class="divider"></div>

    <div id="booking" class="cta fade-in">
      <h2>30 qualified leads in 30 days or we work for free. Let's talk.</h2>
      <p>15 minutes. We'll walk you through the numbers and show you exactly how we'd deliver ${totalCases} new cases to your firm every month. Our clients typically see ${currency}5\u2013${currency}10 back for every ${currency}1 they invest.</p>
      <iframe src="https://api.mortarmetrics.com/widget/booking/7aCMl8OqQAOE3NfjfUGT" style="width: 100%; border: none; overflow: hidden; min-height: 600px;" scrolling="no" id="mortar-booking-widget"></iframe>
      <script src="https://api.mortarmetrics.com/js/form_embed.js" type="text/javascript"></script>
    </div>

    <div class="footer">
      Mortar Metrics \u00B7 Legal Growth Agency \u00B7 Toronto, ON<br>
      <a href="mailto:fardeen@mortarmetrics.com">fardeen@mortarmetrics.com</a>
    </div>

  </div>

  <!-- FLOATING CTA -->
  <div class="floating-cta" id="floatingCta">
    <a href="#booking">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      Book a call
    </a>
  </div>

${generateTypingScript(searchTerms)}
<noscript><style>.fade-in { opacity: 1 !important; }</style></noscript>
</body>
</html>`;
}

// ============================================================================
// TYPING + FLOATING CTA SCRIPT
// ============================================================================

function generateTypingScript(searchTerms) {
  return `
<script>
class SearchTyper {
  constructor(el, terms, opts = {}) {
    this.el = document.getElementById(el);
    if (!this.el) return;
    this.terms = terms; this.i = 0; this.text = ''; this.del = false;
    this.ts = opts.typeSpeed || 75; this.ds = opts.deleteSpeed || 35;
    this.pd = opts.pauseDel || 2200; this.pt = opts.pauseType || 350;
  }
  tick() {
    const t = this.terms[this.i];
    this.text = this.del ? t.substring(0, this.text.length - 1) : t.substring(0, this.text.length + 1);
    this.el.textContent = this.text || '\\u200B';
    let d = this.del ? this.ds : this.ts;
    if (!this.del && this.text === t) { d = this.pd; this.del = true; }
    else if (this.del && this.text === '') { this.del = false; this.i = (this.i + 1) % this.terms.length; d = this.pt; }
    setTimeout(() => this.tick(), d);
  }
  start() { this.tick(); }
}

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('typed-search');
  if (el) el.textContent = '';
  new SearchTyper('typed-search', ${JSON.stringify(searchTerms)}).start();

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.fade-in').forEach(el => io.observe(el));

  const floatingCta = document.getElementById('floatingCta');
  const bookingSection = document.getElementById('booking');
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const heroBottom = document.querySelector('.hero').getBoundingClientRect().bottom + window.scrollY;
    const bookingTop = bookingSection.getBoundingClientRect().top + window.scrollY;
    const windowBottom = scrollY + window.innerHeight;
    if (scrollY > heroBottom && windowBottom < bookingTop + 200) {
      floatingCta.classList.add('visible');
    } else {
      floatingCta.classList.remove('visible');
    }
  });
});
</script>
`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateData(data) {
  const errors = [];
  const warnings = [];

  if (!data.firmName || data.firmName === 'Unknown' || data.firmName === 'Unknown Firm') {
    errors.push('Firm name is invalid or missing');
  }

  if (!data.location?.city || !data.location?.state) {
    warnings.push('Location missing - will use generic copy');
  }

  const hasPracticeAreas = (data.practiceAreas?.length > 0) ||
                           (data.practice?.practiceAreas?.length > 0) ||
                           (data.practice?.primaryFocus);
  if (!hasPracticeAreas) {
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

function sanitizeCompetitorName(name) {
  if (!name) return 'Competitor';
  if ((name.match(/,/g) || []).length >= 2) {
    name = name.split(',')[0].trim();
  }
  // Strip practice area chains: "- Tax - Customs and Excise - Shipping - ..."
  name = name
    .replace(/\s*-\s*(Tax|Family|Criminal|Immigration|Estate|Property|Customs|VAT|Barrister|Solicitor|Litigation|Insolvency|Arbitration|Shipping)(\s*[-&]\s*[\w\s]+)*/i, '')
    .replace(/,?\s*(Solicitors?|Barristers?|Lawyers?|Attorneys?( at Law)?|Law (Firm|Office|Practice|Group)|LLP|LLC|Ltd\.?|Limited|P\.?C\.?|P\.?L\.?L\.?C\.?)$/i, '')
    .trim();
  if (name.length > 50) {
    const truncated = name.substring(0, 47);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 30) return truncated.substring(0, lastSpace) + '...';
    return truncated + '...';
  }
  return name || 'Competitor';
}

function detectPracticeArea(practiceAreas, researchData) {
  const firmNameLower = (researchData.firmName || '').toLowerCase();

  const aiCategory = researchData.practiceAreaCategory
    || researchData.practice?.practiceAreaCategory;
  if (aiCategory && aiCategory !== 'default') {
    const validCategories = Object.keys(CASE_VALUES);
    if (validCategories.includes(aiCategory)) {
      console.log(`   Practice area (AI classified): ${aiCategory}`);
      return aiCategory;
    }
  }

  for (const pa of (practiceAreas || [])) {
    const category = getPracticeAreaCategory(pa);
    if (category !== 'default') return category;
  }
  for (const pa of (researchData.practice?.practiceAreas || [])) {
    const category = getPracticeAreaCategory(pa);
    if (category !== 'default') return category;
  }
  if (researchData.practice?.primaryFocus) {
    const category = getPracticeAreaCategory(researchData.practice.primaryFocus);
    if (category !== 'default') return category;
  }
  for (const spec of (researchData.practice?.nicheSpecializations || [])) {
    const category = getPracticeAreaCategory(spec);
    if (category !== 'default') return category;
  }
  const services = researchData.services || researchData.intelligence?.services || [];
  for (const service of services) {
    const category = getPracticeAreaCategory(service);
    if (category !== 'default') return category;
  }
  // Level 7: Firm name substring checks (Level 0 handles strong signals, these catch remaining)
  if (firmNameLower.includes('family') || firmNameLower.includes('divorce') || firmNameLower.includes('prenup') || firmNameLower.includes('matrimonial')) return 'divorce';
  if (firmNameLower.includes('estate') || firmNameLower.includes('trust') || firmNameLower.includes('probate')) return 'estate';
  if (firmNameLower.includes('tax')) return 'tax';
  if (firmNameLower.includes('landlord') || firmNameLower.includes('eviction')) return 'landlord';
  if (firmNameLower.includes('employment') || firmNameLower.includes('labor')) return 'employment';
  const websiteLower = (researchData.website || '').toLowerCase();
  if (websiteLower.includes('family') || websiteLower.includes('divorce') || websiteLower.includes('prenup') || websiteLower.includes('matrimonial')) return 'divorce';
  if (websiteLower.includes('injury') || websiteLower.includes('accident')) return 'personal injury';
  if (websiteLower.includes('immigration')) return 'immigration';
  if (websiteLower.includes('criminal') || websiteLower.includes('defense') || websiteLower.includes('dui')) return 'criminal';
  if (websiteLower.includes('estate') || websiteLower.includes('probate') || websiteLower.includes('trust')) return 'estate';
  if (websiteLower.includes('tax')) return 'tax';
  if (websiteLower.includes('landlord') || websiteLower.includes('eviction') || websiteLower.includes('tenant')) return 'landlord';
  if (websiteLower.includes('employment') || websiteLower.includes('labor') || websiteLower.includes('worker')) return 'employment';
  if (websiteLower.includes('bankruptcy')) return 'bankruptcy';
  if (websiteLower.includes('business') || websiteLower.includes('corporate')) return 'business';
  return 'default';
}

function getPracticeAreaCategory(raw) {
  if (!raw) return 'default';
  const lower = raw.toLowerCase();
  if (lower.includes('agricult') || lower.includes('farm') || lower.includes('ranch') || lower.includes('ag law')) return 'agricultural';
  if (lower.includes('landlord') || lower.includes('eviction') || lower.includes('tenant')) return 'landlord';
  if (lower.includes('divorce') || lower.includes('family') || lower.includes('prenup') || lower.includes('postnup') || lower.includes('matrimonial') || lower.includes('cohabitation')) return 'divorce';
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
    'divorce': 'FAMILY LAW', 'family': 'FAMILY LAW', 'tax': 'TAX LAW',
    'personal injury': 'PERSONAL INJURY', 'immigration': 'IMMIGRATION LAW',
    'criminal': 'CRIMINAL DEFENSE', 'estate': 'ESTATE PLANNING',
    'business': 'BUSINESS LAW', 'bankruptcy': 'BANKRUPTCY LAW',
    'employment': 'EMPLOYMENT LAW', 'real estate': 'REAL ESTATE LAW',
    'ip': 'INTELLECTUAL PROPERTY', 'landlord': 'LANDLORD LAW',
    'medical malpractice': 'MEDICAL MALPRACTICE', 'workers comp': 'WORKERS COMPENSATION',
    'agricultural': 'AGRICULTURAL LAW',
    'default': 'LEGAL SERVICES'
  };
  return labels[category] || 'LEGAL SERVICES';
}

function getPracticeDescription(category) {
  const descriptions = {
    'divorce': 'family law', 'family': 'family law', 'tax': 'tax law',
    'personal injury': 'personal injury', 'immigration': 'immigration',
    'criminal': 'criminal defense', 'estate': 'estate planning',
    'business': 'business law', 'bankruptcy': 'bankruptcy',
    'employment': 'employment law', 'real estate': 'real estate',
    'ip': 'intellectual property', 'landlord': 'landlord law',
    'medical malpractice': 'medical malpractice', 'workers comp': 'workers compensation',
    'agricultural': 'agricultural law',
    'default': 'legal services'
  };
  return descriptions[category] || 'legal services';
}

function startsWithVowelSound(word) {
  const lower = (word || '').toLowerCase();
  if (/^(uni|use|eu|one|once)/.test(lower)) return false;
  if (/^(honest|hour|heir|honor)/.test(lower)) return true;
  if (/^[aeiou]/.test(lower)) return true;
  return false;
}

function getMarketMultiplier(city, country) {
  const c = (city || '').toLowerCase().trim();
  const ctry = (country || 'US').toUpperCase();

  // Exact city matching via map — prevents "londonderry" matching "london"
  const majorCities = {
    'new york': 1.8, 'new york city': 1.8, 'nyc': 1.8, 'manhattan': 1.8, 'brooklyn': 1.8,
    'los angeles': 1.8, 'chicago': 1.8, 'houston': 1.8, 'phoenix': 1.8, 'philadelphia': 1.8,
    'san antonio': 1.8, 'san diego': 1.8, 'dallas': 1.8, 'san jose': 1.8, 'austin': 1.8,
    'san francisco': 1.8, 'seattle': 1.8, 'denver': 1.8, 'boston': 1.8, 'nashville': 1.8,
    'portland': 1.8, 'las vegas': 1.8, 'toronto': 1.8, 'vancouver': 1.8, 'montreal': 1.8,
    'london': 1.8, 'sydney': 1.8, 'melbourne': 1.8,
    'memphis': 1.3, 'louisville': 1.3, 'richmond': 1.3, 'new orleans': 1.3, 'raleigh': 1.3,
    'salt lake city': 1.3, 'atlanta': 1.3, 'miami': 1.3, 'minneapolis': 1.3, 'cleveland': 1.3,
    'tampa': 1.3, 'orlando': 1.3, 'pittsburgh': 1.3,
    'manchester': 1.3, 'birmingham': 1.3, 'leeds': 1.3, 'glasgow': 1.3, 'liverpool': 1.3,
    'edinburgh': 1.3, 'bristol': 1.3, 'cardiff': 1.3, 'belfast': 1.3, 'nottingham': 1.3,
    'sheffield': 1.3, 'leicester': 1.3, 'newcastle': 1.3, 'brighton': 1.3, 'reading': 1.3,
    'swindon': 1.3, 'calgary': 1.3, 'ottawa': 1.3, 'edmonton': 1.3, 'brisbane': 1.3, 'perth': 1.3
  };

  if (majorCities[c]) return majorCities[c];
  return 1.0;
}

function getCountryBaseline(country) {
  const c = (country || 'US').toUpperCase();
  switch (c) {
    case 'GB': case 'UK': return 0.7;
    case 'AU': return 0.6;
    case 'CA': return 0.75;
    case 'NZ': return 0.4;
    case 'IE': return 0.35;
    default: return 1.0;
  }
}

function getFirmSizeMultiplier(data) {
  let firmSize = data.firmSize || data.firmDetails?.firmSize || data.team?.totalCount || data.intelligence?.firmSize || 0;
  if (typeof firmSize === 'string') {
    const match = firmSize.match(/(\d+)/);
    firmSize = match ? parseInt(match[1]) : 0;
  }
  if (firmSize > 20) return 2.0;
  if (firmSize > 10) return 1.5;
  if (firmSize > 5) return 1.2;
  return 1.0;
}

// ============================================================================
// GAP CALCULATIONS - V7 BOOSTED FLOORS
// ============================================================================

// Tighten a range to ~30% band (midpoint +/- 15%) for more credible numbers
function tightenRange(low, high) {
  if (!USE_TIGHT_RANGES) return { low, high };
  const mid = (low + high) / 2;
  return {
    low: Math.round(mid * 0.85 / 500) * 500,
    high: Math.round(mid * 1.15 / 500) * 500
  };
}

function calculateGap1(marketMultiplier, caseValues, countryBaseline, currency, city, practiceArea) {
  const sym = currency || '$';
  const tier = getPopulationTier(city);
  const baseSearches = USE_POPULATION_SCALING ? tier.searches : 880;
  const searches = Math.round(baseSearches * marketMultiplier * countryBaseline);
  const ctr = 0.045; const conv = 0.15; const close = 0.25;
  let casesPerMonth = searches * ctr * conv * close;
  const econ = PRACTICE_ECONOMICS[practiceArea] || PRACTICE_ECONOMICS['default'];
  if (USE_PRACTICE_FLOORS) casesPerMonth = Math.min(casesPerMonth, econ.maxCasesPerGap);
  const low = Math.round(casesPerMonth * caseValues.low / 500) * 500;
  const high = Math.round(casesPerMonth * caseValues.high / 500) * 500;
  // Practice-area-aware floors (replace universal $55K/$80K)
  let minLow, minHigh;
  if (USE_PRACTICE_FLOORS) {
    minLow = Math.round(GAP_FLOOR_BASE_CASES.gap1 * caseValues.low * econ.floorMultiplier * countryBaseline / 500) * 500 || 500;
    minHigh = Math.round(GAP_FLOOR_BASE_CASES.gap1 * caseValues.high * econ.floorMultiplier * countryBaseline / 500) * 500 || 1000;
  } else {
    minLow = Math.round(55000 * countryBaseline / 500) * 500 || 500;
    minHigh = Math.round(80000 * countryBaseline / 500) * 500 || 1000;
  }
  const floored = { low: Math.max(minLow, low), high: Math.max(minHigh, high) };
  const tight = tightenRange(floored.low, floored.high);
  return {
    low: tight.low, high: tight.high, searches, cases: casesPerMonth,
    formula: `~${searches} monthly searches × 4.5% CTR × 15% inquiry rate × 25% close rate × ${sym}${caseValues.low.toLocaleString()}-${caseValues.high.toLocaleString()} avg case value`
  };
}

function calculateGap2(marketMultiplier, caseValues, city, countryBaseline, currency, practiceArea) {
  const sym = currency || '$';
  const tier = getPopulationTier(city);
  const baseAudience = USE_POPULATION_SCALING ? tier.audience : 65000;
  const audience = Math.round(baseAudience * marketMultiplier * countryBaseline);
  const reach = 0.020; const conv = 0.012; const close = 0.25;
  let casesPerMonth = audience * reach * conv * close;
  const econ = PRACTICE_ECONOMICS[practiceArea] || PRACTICE_ECONOMICS['default'];
  if (USE_PRACTICE_FLOORS) casesPerMonth = Math.min(casesPerMonth, econ.maxCasesPerGap);
  const low = Math.round(casesPerMonth * caseValues.low / 500) * 500;
  const high = Math.round(casesPerMonth * caseValues.high / 500) * 500;
  // Practice-area-aware floors (replace universal $38K/$56K)
  let minLow, minHigh;
  if (USE_PRACTICE_FLOORS) {
    minLow = Math.round(GAP_FLOOR_BASE_CASES.gap2 * caseValues.low * econ.floorMultiplier * countryBaseline / 500) * 500 || 500;
    minHigh = Math.round(GAP_FLOOR_BASE_CASES.gap2 * caseValues.high * econ.floorMultiplier * countryBaseline / 500) * 500 || 1000;
  } else {
    minLow = Math.round(38000 * countryBaseline / 500) * 500 || 500;
    minHigh = Math.round(56000 * countryBaseline / 500) * 500 || 1000;
  }
  const floored = { low: Math.max(minLow, low), high: Math.max(minHigh, high) };
  const tight = tightenRange(floored.low, floored.high);
  return {
    low: tight.low, high: tight.high, audience, city: city || 'your area', cases: casesPerMonth,
    formula: `~${(audience/1000).toFixed(0)}K reachable audience in ${city || 'metro'} × 2.0% monthly ad reach × 1.2% conversion to inquiry × 25% close rate × ${sym}${caseValues.low.toLocaleString()}-${caseValues.high.toLocaleString()} avg case value`
  };
}

function calculateGap3(firmSizeMultiplier, caseValues, countryBaseline, currency, city, practiceArea) {
  const sym = currency || '$';
  const tier = getPopulationTier(city);
  const baseCalls = USE_POPULATION_SCALING ? tier.calls : 85;
  const calls = Math.round(baseCalls * firmSizeMultiplier * countryBaseline);
  const afterHours = 0.35; const missRate = 0.60; const recovery = 0.70; const close = 0.25;
  let casesPerMonth = calls * afterHours * missRate * recovery * close;
  const econ = PRACTICE_ECONOMICS[practiceArea] || PRACTICE_ECONOMICS['default'];
  if (USE_PRACTICE_FLOORS) casesPerMonth = Math.min(casesPerMonth, econ.maxCasesPerGap);
  const low = Math.round(casesPerMonth * caseValues.low / 500) * 500;
  const high = Math.round(casesPerMonth * caseValues.high / 500) * 500;
  // Practice-area-aware floors (replace universal $17K/$30K)
  let minLow, minHigh;
  if (USE_PRACTICE_FLOORS) {
    minLow = Math.round(GAP_FLOOR_BASE_CASES.gap3 * caseValues.low * econ.floorMultiplier * countryBaseline / 500) * 500 || 500;
    minHigh = Math.round(GAP_FLOOR_BASE_CASES.gap3 * caseValues.high * econ.floorMultiplier * countryBaseline / 500) * 500 || 1000;
  } else {
    minLow = Math.round(17000 * countryBaseline / 500) * 500 || 500;
    minHigh = Math.round(30000 * countryBaseline / 500) * 500 || 1000;
  }
  const floored = { low: Math.max(minLow, low), high: Math.max(minHigh, high) };
  const tight = tightenRange(floored.low, floored.high);
  return {
    low: tight.low, high: tight.high, calls, cases: casesPerMonth,
    formula: `~${calls} inbound calls/mo × 35% outside business hours × 60% that won't leave a voicemail × 70% recoverable with live intake × 25% close rate × ${sym}${caseValues.low.toLocaleString()}-${caseValues.high.toLocaleString()} avg case value`
  };
}

// ============================================================================
// VALIDATION - V7 section checks
// ============================================================================

function validateReportHTML(html, firmName) {
  const warnings = [];

  if (html.length < 5000) {
    warnings.push(`Report HTML suspiciously short (${html.length} chars)`);
  }

  // V7 required sections
  const sections = [
    ['hero', /class="hero"/i],
    ['roi-box', /class="roi-box/i],
    ['glance-strip', /class="glance-strip/i],
    ['revenue-card', /class="revenue-card/i],
    ['cost-inaction', /class="cost-inaction/i],
    ['guarantee', /class="guarantee-section/i],
    ['case-study', /class="case-study/i],
    ['case-study-timeline', /class="case-study-timeline/i],
    ['deliverables', /class="deliverables-group/i],
    ['only-job', /class="only-job/i],
    ['faq-section', /class="faq-section/i],
    ['footer', /class="footer"/i]
  ];
  for (const [name, pattern] of sections) {
    if (!pattern.test(html)) warnings.push(`Missing section: ${name}`);
  }

  // Broken content in visible text
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  for (const bad of ['undefined', 'null', 'NaN', '[object Object]']) {
    if (text.includes(bad)) warnings.push(`Found "${bad}" in visible text`);
  }

  // 3 revenue card numbers exist
  const revenueCards = html.match(/class="revenue-card-number"/g) || [];
  if (revenueCards.length < 3) warnings.push(`Only ${revenueCards.length} revenue card numbers (expected 3)`);

  // Firm name present
  if (firmName && !html.includes(firmName) && !html.includes(firmName.replace(/&/g, '&amp;'))) {
    warnings.push(`Firm name "${firmName}" not found in report`);
  }

  if (warnings.length > 0) {
    console.log('⚠️  REPORT VALIDATION WARNINGS:');
    for (const w of warnings) console.log(`   - ${w}`);
  } else {
    console.log('✅ Report validation passed');
  }
}

function formatMoney(num) {
  if (num >= 1000) {
    const k = num / 1000;
    if (k % 1 === 0.5) return k.toFixed(1) + 'K';
    return Math.round(k).toLocaleString() + 'K';
  }
  return num.toLocaleString();
}

function formatMoneyMillions(num) {
  if (num >= 1000000) {
    const m = num / 1000000;
    return m.toFixed(1) + 'M';
  }
  return formatMoney(num);
}

function formatRange(low, high) {
  return `${formatMoney(low)}-${formatMoney(high)}`;
}

// ============================================================================
// CLI Handler
// ============================================================================

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
