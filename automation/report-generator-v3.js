#!/usr/bin/env node
/**
 * REPORT GENERATOR V3 — AI Prose + Fixed Structure
 *
 * Architecture: Three layers
 *   STRUCTURE (fixed) — HTML, CSS, JS animations, competitor bars
 *   MATH (fixed) — Gap formulas, market multipliers, case values
 *   PROSE (AI) — Claude writes ALL copy, in the correct locale, natively
 *
 * AI writes every prose paragraph in one call. If the AI call fails,
 * falls back to the old hardcoded templates (kept as safety net).
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

// Escape HTML then auto-bold key numbers so busy readers can scan
function formatGapProse(text) {
  let s = escapeHtml(text);
  // Dollar/pound ranges: ~$1,000-$2,500/mo or $500
  s = s.replace(/(~?[\$£A-Z]*\$?[\d,]+\s*-\s*[\$£]?[\d,]+(?:\/mo(?:nth)?)?)/g, '<strong>$1</strong>');
  // Standalone dollar/pound amounts not already wrapped
  s = s.replace(/(?<!<strong>)(~?[\$£][\d,]+(?:\/mo(?:nth)?)?)(?!<\/strong>)/g, '<strong>$1</strong>');
  // Percentages: 60%, 3.5%, 20-40%
  s = s.replace(/([\d.]+-[\d.]+%|[\d.]+%)/g, '<strong>$1</strong>');
  // Tilde-prefixed numbers with context: ~250 people searched
  s = s.replace(/(~[\d,]+\s+(?:people|searches|calls|monthly searches))/gi, '<strong>$1</strong>');
  return s;
}

// Case value ranges by practice area (low-high for ranges) — USD
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
  'default': { low: 4500, high: 7000 }
};

// Case value ranges for UK market — GBP
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
  'default': { low: 3000, high: 5500 }
};

// Client labels by practice area (used in visuals + fallback prose)
const CLIENT_LABELS = {
  'landlord': { singular: 'landlord', plural: 'landlords' },
  'personal injury': { singular: 'accident victim', plural: 'accident victims' },
  'divorce': { singular: 'spouse', plural: 'spouses' },
  'family': { singular: 'parent', plural: 'parents' },
  'immigration': { singular: 'immigrant', plural: 'immigrants' },
  'criminal': { singular: 'defendant', plural: 'defendants' },
  'estate': { singular: 'family member', plural: 'family members' },
  'business': { singular: 'business owner', plural: 'business owners' },
  'bankruptcy': { singular: 'debtor', plural: 'debtors' },
  'tax': { singular: 'taxpayer', plural: 'taxpayers' },
  'employment': { singular: 'employee', plural: 'employees' },
  'default': { singular: 'potential client', plural: 'potential clients' }
};

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
  'tax': 'a tax notice',  // localized later for UK/US
  'employment': 'wrongful termination',
  'default': 'a legal emergency'
};

const ATTORNEY_TYPES = {
  'divorce': 'family', 'family': 'family', 'tax': 'tax',
  'personal injury': 'personal injury', 'immigration': 'immigration',
  'criminal': 'criminal defense', 'estate': 'estate planning',
  'business': 'business', 'bankruptcy': 'bankruptcy', 'employment': 'employment',
  'default': ''
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

function getLocalizedEmergency(practiceArea, country) {
  const isUK = (country === 'GB' || country === 'UK');
  if (practiceArea === 'tax') return isUK ? 'an HMRC notice' : 'an IRS notice';
  return EMERGENCY_SCENARIOS[practiceArea] || EMERGENCY_SCENARIOS['default'];
}

// ============================================================================
// AI PROSE GENERATION — One Claude call writes ALL prose
// ============================================================================

/**
 * Call Claude API for prose generation
 */
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
 * Generate ALL prose content in one Claude call.
 * Returns structured JSON with every prose section of the report.
 */
async function generateProseContent(context) {
  const {
    firmName, city, state, country, currency,
    practiceArea, practiceDescription,
    searchTerms,
    gap1, gap2, gap3, totalLow, totalHigh,
    runningGoogleAds, runningMetaAds,
    googleAdCount, metaAdCount,
    competitors
  } = context;

  const isUK = (country === 'GB' || country === 'UK');
  const isAU = (country === 'AU');
  const locationStr = city && state ? `${city}, ${state}` : city || state || 'your area';

  // Build competitor context
  const competitorNames = (competitors || []).slice(0, 3).map(c => {
    const reviews = c.reviews || c.reviewCount || 0;
    const rating = c.rating || 0;
    return `${c.name} (${reviews} reviews, ${rating}★)`;
  }).join(', ');

  const localeInstructions = isUK
    ? `LOCALE: United Kingdom. Use UK English throughout: solicitor (not attorney), enquiry (not inquiry), practise (verb), practice (noun), law practice (not law firm), £ (not $), HMRC (not IRS), child arrangements (not child custody). Write naturally in UK English. Do NOT just find-replace US terms.`
    : isAU
      ? `LOCALE: Australia. Use Australian English: solicitor or lawyer, enquiry, practice, A$ or $. Write naturally in Australian English.`
      : `LOCALE: United States. Use US English: attorney, lawyer, law firm, inquiry, $, IRS. Write naturally in US English.`;

  const adsContext = `
Google Ads: ${runningGoogleAds ? `RUNNING (${googleAdCount} detected)` : 'NOT running'}
Meta Ads: ${runningMetaAds ? `RUNNING (${metaAdCount} active)` : 'NOT running'}`;

  const prompt = `You are writing a personalised marketing report for a law firm. Write ALL the prose sections below.

FIRM CONTEXT:
- Name: ${firmName}
- Location: ${locationStr}
- Practice area: ${practiceDescription}
- Country: ${country || 'US'}

${localeInstructions}

COMPETITOR DATA:
${competitorNames || 'No competitor data available'}

ADS STATUS:${adsContext}

GAP CALCULATIONS (already computed, use these EXACT numbers in your prose):
- Gap 1 (Search Ads): ~${gap1.searches} monthly searches, ${currency}${formatMoney(gap1.low)}-${formatMoney(gap1.high)}/month opportunity
- Gap 2 (Social Ads): ~${(gap2.audience/1000).toFixed(0)}K audience, ${currency}${formatMoney(gap2.low)}-${formatMoney(gap2.high)}/month opportunity
- Gap 3 (After-Hours Intake): ~${gap3.calls} calls/month, ${currency}${formatMoney(gap3.low)}-${formatMoney(gap3.high)}/month opportunity
- Total: ${currency}${formatMoney(totalLow)}-${formatMoney(totalHigh)}/month
- Gap 1 formula: ${gap1.formula}
- Gap 2 formula: ${gap2.formula}
- Gap 3 formula: ${gap3.formula}

SEARCH TERMS (for reference): ${searchTerms.join(', ')}

STYLE GUIDE:
- Punchy, direct, no fluff. Write like a strategist, not a salesperson.
- Short paragraphs (2-3 sentences max per paragraph).
- Reference THEIR specific data. Don't be generic.
- Tone: confident but honest. Use ranges and caveats, not guarantees.
- DO NOT use: "In today's", "leverage", "utilize", "cutting-edge", "game-changer", "robust", "landscape", "unlock", "empower"
- DO NOT fabricate statistics, case studies, or claims.
- Use the correct legal terminology for the country (this is critical).
- Keep each field concise. The HTML structure provides visual breathing room.
- DO NOT use em dashes (—). Use periods or commas instead.

EXAMPLE STYLE (match this voice):
"~250 people searched for a personal injury attorney in Denver last month. You're not running Google Ads. The firms that are? They got those clicks."

Return ONLY valid JSON with these exact fields:

{
  "heroSubheading": "One paragraph. We analyzed the [practice] market in [location]. Who shows up, who advertises, where the gaps are. 1-2 sentences.",
  "gapSectionHeadline": "Short punchy headline for the gap section. e.g. 'Where you're losing cases right now'",
  "totalStripTransition": "One sentence bridging the total opportunity number to the gap breakdown below. e.g. 'Here's where that number comes from.' or 'Three gaps. Let's break them down.' Keep it short and punchy, max 1-2 sentences.",
  "gap1Headline": "${runningGoogleAds ? 'Headline about their ads potentially being unoptimized. Reference the search volume number.' : 'Headline about missing search ad opportunity. Reference the search volume number.'}",
  "gap1Context": "ONE sentence, max 25 words. ${runningGoogleAds ? 'Reference the search volume and question whether their clicks are converting.' : 'Reference the search volume and the fact they are not showing up.'} A visual SERP mockup follows this sentence, so do NOT describe what search results look like.",
  "gap1MathIntro": "${runningGoogleAds ? '"Why this matters:" then explain optimization opportunity' : '"How we estimated this:" then explain the formula in plain English, with caveat about actual numbers varying.'}",
  "gap2Headline": "${runningMetaAds ? 'Headline about their social ads potentially being unoptimized.' : 'Headline about clients who do not Google their problem. Mention the type of client naturally.'}",
  "gap2Context": "ONE sentence, max 25 words. ${runningMetaAds ? 'Question whether their social targeting and creative are converting.' : 'The insight that not every client Googles their problem. Some are scrolling social media.'} A visual comparison follows, so do NOT describe the two client types.",
  "gap2MathIntro": "${runningMetaAds ? '"Why this matters:" then explain optimization value' : '"How we estimated this:" then explain the formula with caveat about creative quality.'}",
  "gap3Headline": "Headline about after-hours calls. Natural scenario for this practice area, what emergency makes someone call at 7pm?",
  "gap3Context": "1-2 sentences, max 35 words. Specific emergency scenario for this practice area. Someone calls, gets voicemail, calls the next firm. A before/after visual follows, so do NOT describe the flow.",
  "totalStripContext": "One paragraph after the total strip. Caveat that it's a range, not a guarantee. Why the exact number isn't the point.",
  "competitorHeadline": "Headline introducing competitor comparison. Punchy.",
  "competitorIntro": "One paragraph about the competitor data source and what reviews mean for search visibility.",
  "competitorTakeaway": "One paragraph takeaway. These firms aren't necessarily better. They just invested in marketing infrastructure. Reviews are the visible part.",
  "buildHeadline": "Headline introducing the build list.",
  "buildIntro": "One paragraph. It's a system, each piece feeds the next. Short.",
  "buildItem1Title": "${runningGoogleAds ? 'Title for auditing/optimizing existing Google Ads' : 'Title for launching Google Ads targeting their practice area'}",
  "buildItem1Detail": "One sentence description of what this involves.",
  "buildItem1Timeline": "${runningGoogleAds ? 'Audit in 1 week, optimizations ongoing' : 'Typically live in 1-2 weeks'}",
  "buildItem2Title": "${runningMetaAds ? 'Title for auditing/optimizing existing Meta Ads' : 'Title for launching Meta Ads reaching their client type'}",
  "buildItem2Detail": "One sentence description.",
  "buildItem2Timeline": "${runningMetaAds ? 'Audit in 1 week, optimizations ongoing' : 'Typically live in 2-3 weeks'}",
  "buildItem3Title": "Title for AI-powered 24/7 intake",
  "buildItem3Detail": "One sentence about what this solves.",
  "buildItem3Timeline": "Typically live in 1-2 weeks",
  "buildItem4Title": "Title for CRM + reporting",
  "buildItem4Detail": "One sentence about tracking leads to signed cases.",
  "buildItem4Timeline": "Set up alongside launch",
  "ctaHeadline": "Headline for the booking CTA. Conversational, low-pressure.",
  "ctaSubtext": "One sentence. 15 minutes, specific to their firm, they decide."
}`;

  console.log('🤖 Generating AI prose content...');

  const response = await callClaude(prompt, 3000);

  // Parse JSON from response
  let jsonStr = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Try to find JSON object in response
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

  // Validate essential fields are present
  const requiredFields = ['heroSubheading', 'gap1Headline', 'gap1Context', 'gap2Headline', 'gap2Context', 'gap3Headline', 'gap3Context'];
  const missing = requiredFields.filter(f => !prose[f]);
  if (missing.length > 0) {
    throw new Error(`AI prose missing fields: ${missing.join(', ')}`);
  }

  console.log('✅ AI prose generated successfully');
  return prose;
}

// ============================================================================
// FALLBACK PROSE — Old hardcoded templates (safety net)
// ============================================================================

function generateFallbackProse(context) {
  const {
    firmName, city, state, country, currency,
    practiceArea, practiceDescription,
    searchTerms,
    gap1, gap2, gap3, totalLow, totalHigh,
    runningGoogleAds, runningMetaAds,
    googleAdCount, metaAdCount,
    clientLabel, clientLabelPlural, emergencyScenario,
    attorneyPhrase, attorneyPhrasePlural
  } = context;

  const locationStr = city && state ? `${city}, ${state}` : city || state || 'your area';
  const isUK = (country === 'GB' || country === 'UK');
  const lawFirmWord = isUK ? 'law practice' : 'law firm';
  const article = startsWithVowelSound(attorneyPhrase) ? 'an' : 'a';

  return {
    heroSubheading: `We analyzed the ${practiceDescription} market in ${locationStr}. Who's showing up, who's advertising, and where the gaps are. Below is where you're losing cases, and exactly how to get them back.`,
    gapSectionHeadline: "Where you're losing cases right now",
    totalStripTransition: `Here's where that number comes from. Three gaps we found in your current setup.`,
    gap1Headline: runningGoogleAds
      ? `You're running Google Ads${googleAdCount > 0 ? ` (${googleAdCount} detected)` : ''}. The question is whether they're ${isUK ? 'optimised' : 'optimized'}.`
      : `~${gap1.searches} people searched for ${article} ${attorneyPhrase} last month. The ${lawFirmWord}s running ads got those clicks.`,
    gap1Context: runningGoogleAds
      ? `~${gap1.searches} people searched for ${article} ${attorneyPhrase} in ${locationStr} last month. You're competing for those clicks, but are you winning them?`
      : `~${gap1.searches} people searched for ${article} ${attorneyPhrase} in ${locationStr} last month. You're not showing up.`,
    gap1MathIntro: runningGoogleAds
      ? `Why this matters: You're already paying for clicks. Improving your quality score by even a few points can drop your cost-per-click significantly while increasing conversion rate. We typically find 20-40% improvement opportunities in existing campaigns.`
      : `How we estimated this: ${gap1.formula}. These conversion rates are based on benchmarks we've seen across legal markets. Your actual numbers will vary based on your intake process and close rate.`,
    gap2Headline: runningMetaAds
      ? `You're running Meta Ads${metaAdCount > 0 ? ` (${metaAdCount} active)` : ''}. Are they reaching the right people?`
      : `Not every ${clientLabel} with a legal problem Googles it. Many are scrolling Facebook right now.`,
    gap2Context: runningMetaAds
      ? `You're already investing in social. The question is whether your targeting and creative are actually converting.`
      : `Not every ${clientLabel} Googles their problem. Some are scrolling Facebook at 11pm.`,
    gap2MathIntro: runningMetaAds
      ? `Why this matters: Meta's algorithm rewards well-${isUK ? 'optimised' : 'optimized'} campaigns with lower costs and broader reach. Fresh creative, refined audiences, and proper pixel setup can turn a break-even campaign into a profitable one.`
      : `How we estimated this: ${gap2.formula}. Wide range because social performance depends heavily on ad creative and targeting, but well-run campaigns for legal services consistently outperform these baselines.`,
    gap3Headline: `When a ${clientLabel} calls at 7pm about ${emergencyScenario}, what happens?`,
    gap3Context: `A ${clientLabel} calls about ${emergencyScenario} at 7pm. Two ${lawFirmWord}s go to voicemail. One picks up.`,
    gap3MathIntro: `How we estimated this: ${gap3.formula}.`,
    totalStripContext: `That's the range, not a guarantee. It depends on your case values, close rate, and how well the system is ${isUK ? 'optimised' : 'optimized'}. The point isn't the exact number. It's that real people in ${locationStr} are searching for the exact service you provide, and right now they're finding other ${lawFirmWord}s instead of you.`,
    competitorHeadline: `And those other ${lawFirmWord}s? Here's who's getting your cases.`,
    competitorIntro: `We pulled the ${lawFirmWord}s showing up for ${practiceDescription} searches in ${locationStr}. Google uses reviews as a major trust signal. More reviews and higher ratings push ${lawFirmWord}s into the Map Pack at the top of results, where most clicks happen. Here's where you stand.`,
    competitorTakeaway: `This doesn't mean they're better ${isUK ? 'solicitors' : 'attorneys'}. In every market we've ${isUK ? 'analysed' : 'analyzed'}, the ${lawFirmWord}s that dominate search results aren't always the best. They're the ones that invested in infrastructure. Reviews are just the visible part. The real gap is what's happening underneath: ads, intake, and follow-up systems that capture clients before they ever scroll past the first result.`,
    buildHeadline: `Here's how we'd close these gaps`,
    buildIntro: `It's not one thing. It's a system. Each piece feeds the next. Ads drive calls, intake captures them, CRM tracks them, reporting shows you what's working. We handle the build and management. You focus on ${isUK ? 'practising' : 'practicing'} law.`,
    buildItem1Title: runningGoogleAds ? `Audit + ${isUK ? 'optimise' : 'optimize'} your existing Google Ads` : `Google Ads targeting ${practiceDescription} searches in your area`,
    buildItem1Detail: runningGoogleAds
      ? `We'll ${isUK ? 'analyse' : 'analyze'} what's working, cut wasted spend, and improve your cost-per-case. Every click tracked, every call recorded.`
      : `You show up at the top when someone searches for exactly what you do. Every click tracked, every call recorded.`,
    buildItem1Timeline: runningGoogleAds ? `Audit in 1 week, ${isUK ? 'optimisations' : 'optimizations'} ongoing` : 'Typically live in 1-2 weeks',
    buildItem2Title: runningMetaAds ? `Audit + ${isUK ? 'optimise' : 'optimize'} your Meta Ads campaigns` : `Meta Ads reaching people before they search`,
    buildItem2Detail: runningMetaAds
      ? `We'll review your audiences, creative, and conversion tracking to ${isUK ? 'maximise' : 'maximize'} return on your existing spend.`
      : `Targeted campaigns on Facebook and Instagram, putting your ${lawFirmWord} in front of people who need help but haven't started looking.`,
    buildItem2Timeline: runningMetaAds ? `Audit in 1 week, ${isUK ? 'optimisations' : 'optimizations'} ongoing` : 'Typically live in 2-3 weeks',
    buildItem3Title: `AI-powered intake that answers every call, 24/7`,
    buildItem3Detail: `No more voicemail. Every call answered, qualified, and booked, even at 2am. Your team gets notified instantly.`,
    buildItem3Timeline: 'Typically live in 1-2 weeks',
    buildItem4Title: `CRM + reporting so you know what's working`,
    buildItem4Detail: `Every lead tracked from first click to signed retainer. You see exactly which ${currency === '£' ? 'pounds are' : 'dollars are'} producing cases.`,
    buildItem4Timeline: 'Set up alongside launch',
    ctaHeadline: `Want to walk through these numbers together?`,
    ctaSubtext: `15 minutes. We'll go through what's realistic for your ${lawFirmWord} specifically and you can decide if it's worth pursuing.`
  };
}

// ============================================================================
// MAIN GENERATION
// ============================================================================

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
    practiceAreas = [],
    adsData = {}
  } = researchData;

  // Extract ads status (check multiple paths for old + new JSON formats)
  const adsDetectionFailed = adsData?.detectionSucceeded === false;
  let runningGoogleAds = adsData?.summary?.runningGoogleAds || adsData?.googleAds?.running || researchData.googleAdsData?.running || false;
  let runningMetaAds = adsData?.summary?.runningMetaAds || adsData?.metaAds?.hasActiveAds || researchData.metaAdsData?.running || false;
  const googleAdCount = adsData?.googleAds?.adCount || researchData.googleAdsData?.adCount || 0;
  const metaAdCount = adsData?.metaAds?.activeCount || researchData.metaAdsData?.activeCount || researchData.metaAdsData?.inactiveAdCount || 0;

  // Safety net: if detector says "running" but found 0 ads, it's a false positive
  if (runningGoogleAds && googleAdCount === 0) {
    console.log('⚠️  Google Ads false positive: "running" but 0 ads detected — treating as not running');
    runningGoogleAds = false;
  }
  if (runningMetaAds && metaAdCount === 0) {
    console.log('⚠️  Meta Ads false positive: "running" but 0 ads detected — treating as not running');
    runningMetaAds = false;
  }

  if (adsDetectionFailed) {
    console.log(`📢 Ads detection: FAILED (${adsData?.detectionError || 'unknown error'}) - treating as unknown`);
  } else {
    console.log(`📢 Google Ads: ${runningGoogleAds ? `Running (${googleAdCount} ads)` : 'Not detected'}`);
    console.log(`📢 Meta Ads: ${runningMetaAds ? `Running (${metaAdCount} ads)` : 'Not detected'}`);
  }

  const firmName = normalizeFirmName(rawFirmName);
  const city = location.city || '';
  const state = location.state || '';
  const country = location.country || 'US';
  const currency = (country === 'GB' || country === 'UK') ? '£' : '$';

  // Determine practice area - try multiple sources
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

  // Calculate gaps with RANGES
  const isUK = (country === 'GB' || country === 'UK');
  const marketMultiplier = getMarketMultiplier(city, country);
  const countryBaseline = getCountryBaseline(country);
  const firmSizeMultiplier = getFirmSizeMultiplier(researchData);
  const caseValueTable = isUK ? CASE_VALUES_GBP : CASE_VALUES;
  const caseValues = caseValueTable[practiceArea] || caseValueTable['default'];

  const gap1 = calculateGap1(marketMultiplier, caseValues, countryBaseline, currency);
  const gap2 = calculateGap2(marketMultiplier, caseValues, city, countryBaseline, currency);
  const gap3 = calculateGap3(firmSizeMultiplier, caseValues, countryBaseline, currency);

  const totalLow = gap1.low + gap2.low + gap3.low;
  const totalHigh = gap1.high + gap2.high + gap3.high;

  console.log(`💰 Gap ranges: ${currency}${formatRange(gap1.low, gap1.high)} + ${currency}${formatRange(gap2.low, gap2.high)} + ${currency}${formatRange(gap3.low, gap3.high)}`);
  console.log(`   Total: ${currency}${formatRange(totalLow, totalHigh)}/month\n`);

  // Get firm's own data for competitor comparison
  let firmReviews = researchData.googleReviews || researchData.googleBusiness?.reviews || 0;
  let firmRating = researchData.googleRating || researchData.googleBusiness?.rating || 0;

  // If no reviews in research data, try to fetch from Google Places
  if (firmReviews === 0 && city) {
    try {
      const googleData = await fetchFirmGoogleData(firmName, city, state, country);
      if (googleData.reviews > 0) {
        firmReviews = googleData.reviews;
        firmRating = googleData.rating;
        console.log(`📊 Fetched firm reviews: ${firmReviews} reviews, ${firmRating}★`);
      }
    } catch (e) {
      console.log(`⚠️  Could not fetch firm Google data: ${e.message}`);
    }
  }

  // Compute client label and emergency scenario for visuals + prose
  const clientLabelObj = CLIENT_LABELS[practiceArea] || CLIENT_LABELS['default'];
  const clientLabel = clientLabelObj.singular;
  const clientLabelPlural = clientLabelObj.plural;
  const emergencyScenario = getLocalizedEmergency(practiceArea, country);
  const attorneyPhrase = getAttorneyPhrase(practiceArea, false, country);
  const attorneyPhrasePlural = getAttorneyPhrase(practiceArea, true, country);

  // Build prose context (shared between AI and fallback)
  const proseContext = {
    firmName, city, state, country, currency,
    practiceArea, practiceDescription,
    searchTerms,
    gap1, gap2, gap3, totalLow, totalHigh,
    runningGoogleAds, runningMetaAds,
    googleAdCount, metaAdCount,
    competitors,
    clientLabel, clientLabelPlural, emergencyScenario,
    attorneyPhrase, attorneyPhrasePlural
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

  // Generate HTML with prose
  const html = generateHTML({
    firmName,
    prospectName,
    practiceArea,
    practiceLabel,
    searchTerms,
    currency,
    gap1,
    gap2,
    gap3,
    totalLow,
    totalHigh,
    competitors,
    firmReviews,
    firmRating,
    runningGoogleAds,
    runningMetaAds,
    googleAdCount,
    metaAdCount,
    city,
    state,
    prose,
    proseSource,
    clientLabel,
    country
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
  console.log(`✅ Report generated successfully (prose: ${proseSource})`);
  console.log(`   Lines: ${html.split('\n').length}\n`);

  return { html, outputPath };
}

// ============================================================================
// VISUAL HELPERS — SERP mockup, two-client comparison
// ============================================================================

/**
 * Generate a mini SERP mockup showing where the firm does/doesn't appear.
 * Uses real competitor names from Google Places API.
 */
function generateSerpMockup(competitors, firmName, searchTerms, runningGoogleAds) {
  const query = (searchTerms && searchTerms[0]) || 'lawyer near me';
  const topComps = (competitors || []).slice(0, 3);

  let rows = '';

  if (runningGoogleAds) {
    // Firm IS running ads — show them in the first ad slot
    rows += `        <div class="serp-row serp-you-running">
          <span class="serp-tag serp-tag-ad">Ad</span>
          <span class="serp-name">${escapeHtml(firmName)}</span>
          <span class="serp-note">you're here, but converting?</span>
        </div>\n`;
    // Show competitors in ad/map slots
    if (topComps.length >= 1) {
      rows += `        <div class="serp-row">
          <span class="serp-tag serp-tag-ad">Ad</span>
          <span class="serp-name">${escapeHtml(sanitizeCompetitorName(topComps[0].name))}</span>
          <span class="serp-note">paying for clicks</span>
        </div>\n`;
    }
    if (topComps.length >= 2) {
      const reviews = topComps[1].reviews || topComps[1].reviewCount || 0;
      rows += `        <div class="serp-row">
          <span class="serp-tag serp-tag-map">Map</span>
          <span class="serp-name">${escapeHtml(sanitizeCompetitorName(topComps[1].name))}</span>
          <span class="serp-note">${reviews} reviews</span>
        </div>\n`;
    }
    if (topComps.length >= 3) {
      const reviews = topComps[2].reviews || topComps[2].reviewCount || 0;
      rows += `        <div class="serp-row">
          <span class="serp-tag serp-tag-map">Map</span>
          <span class="serp-name">${escapeHtml(sanitizeCompetitorName(topComps[2].name))}</span>
          <span class="serp-note">${reviews} reviews</span>
        </div>\n`;
    }
  } else {
    // Firm NOT running ads — show competitors filling the space
    if (topComps.length >= 1) {
      rows += `        <div class="serp-row">
          <span class="serp-tag serp-tag-ad">Ad</span>
          <span class="serp-name">${escapeHtml(sanitizeCompetitorName(topComps[0].name))}</span>
          <span class="serp-note">paying for clicks</span>
        </div>\n`;
    } else {
      rows += `        <div class="serp-row">
          <span class="serp-tag serp-tag-ad">Ad</span>
          <span class="serp-name">Firms running ads</span>
          <span class="serp-note">paying for clicks</span>
        </div>\n`;
    }
    if (topComps.length >= 2) {
      rows += `        <div class="serp-row">
          <span class="serp-tag serp-tag-ad">Ad</span>
          <span class="serp-name">${escapeHtml(sanitizeCompetitorName(topComps[1].name))}</span>
          <span class="serp-note">paying for clicks</span>
        </div>\n`;
    } else {
      rows += `        <div class="serp-row">
          <span class="serp-tag serp-tag-ad">Ad</span>
          <span class="serp-name">Another firm with ads</span>
          <span class="serp-note">paying for clicks</span>
        </div>\n`;
    }
    if (topComps.length >= 3) {
      const reviews = topComps[2].reviews || topComps[2].reviewCount || 0;
      rows += `        <div class="serp-row">
          <span class="serp-tag serp-tag-map">Map</span>
          <span class="serp-name">${escapeHtml(sanitizeCompetitorName(topComps[2].name))}</span>
          <span class="serp-note">${reviews} reviews</span>
        </div>\n`;
    } else {
      rows += `        <div class="serp-row">
          <span class="serp-tag serp-tag-map">Map</span>
          <span class="serp-name">Top-reviewed firm</span>
          <span class="serp-note">100+ reviews</span>
        </div>\n`;
    }
    // Ellipsis row
    rows += `        <div class="serp-row serp-ellipsis">
          <span class="serp-tag"></span>
          <span class="serp-name" style="color: var(--muted);">···</span>
          <span class="serp-note"></span>
        </div>\n`;
    // "You" row — not showing up
    rows += `        <div class="serp-row serp-you">
          <span class="serp-tag serp-tag-you">You</span>
          <span class="serp-name">${escapeHtml(firmName)}</span>
          <span class="serp-note">not showing up</span>
        </div>\n`;
  }

  return `      <div class="serp-mockup">
        <div class="serp-query">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <span>"${escapeHtml(query)}"</span>
        </div>
${rows}      </div>`;
}

/**
 * Generate a two-client comparison visual for Gap 2.
 * Shows "The searcher" vs "The scroller" for firms not running Meta Ads,
 * or a "Current" vs "Optimized" view for firms already running them.
 */
function generateTwoClientVisual(clientLabel, runningMetaAds, metaAdCount, country) {
  const currencyWord = (country === 'GB' || country === 'UK') ? 'pound' : 'dollar';
  if (runningMetaAds) {
    return `      <div class="before-after">
        <div class="ba-side ba-before">
          <div class="ba-label">Current setup</div>
          <p>Running ads${metaAdCount > 0 ? ` (${metaAdCount} active)` : ''}, but are the right people seeing them? Are they clicking? Are they converting?</p>
        </div>
        <div class="ba-side ba-social">
          <div class="ba-label good">Optimized setup</div>
          <p>Refined audiences, fresh creative, proper tracking. Every ${currencyWord} measured from impression to signed case.</p>
        </div>
      </div>`;
  }

  return `      <div class="before-after">
        <div class="ba-side ba-before">
          <div class="ba-label">The searcher</div>
          <p>Knows they need a lawyer. Googling right now. Gap 1 catches them.</p>
        </div>
        <div class="ba-side ba-social">
          <div class="ba-label" style="color: #3b5998;">The scroller</div>
          <p>Doesn't know yet. Scrolling Facebook at 11pm. Only social ads reach them.</p>
        </div>
      </div>`;
}

// ============================================================================
// HTML GENERATION — Fixed structure, AI prose
// ============================================================================

function generateHTML(data) {
  const {
    firmName,
    prospectName,
    practiceArea,
    practiceLabel,
    searchTerms,
    currency,
    gap1,
    gap2,
    gap3,
    totalLow,
    totalHigh,
    competitors,
    firmReviews,
    firmRating,
    runningGoogleAds,
    runningMetaAds,
    googleAdCount,
    metaAdCount,
    city,
    state,
    prose,
    clientLabel,
    country
  } = data;

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const locationStr = city && state ? `${city}, ${state}` : city || state || 'your area';
  const locationLabel = city && state ? `${city.toUpperCase()}, ${state.toUpperCase()}` : '';

  const cssModule = require('./report-v3-css.js');
  const css = cssModule();

  // Gap stat blocks (big visual number + label)
  const gap1Stat = runningGoogleAds
    ? { number: `~${currency}${formatMoney(Math.round(gap1.low * 0.3))}-${formatMoney(Math.round(gap1.high * 0.3))}`, label: 'potential monthly optimization' }
    : { number: `~${currency}${formatMoney(gap1.low)}-${formatMoney(gap1.high)}`, label: 'estimated monthly opportunity' };

  const gap2Stat = runningMetaAds
    ? { number: `~${currency}${formatMoney(Math.round(gap2.low * 0.25))}-${formatMoney(Math.round(gap2.high * 0.25))}`, label: 'potential monthly optimization' }
    : { number: `~${currency}${formatMoney(gap2.low)}-${formatMoney(gap2.high)}`, label: 'estimated monthly opportunity' };

  const gap3Stat = { number: `~${currency}${formatMoney(gap3.low)}-${formatMoney(gap3.high)}`, label: 'estimated monthly opportunity' };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(firmName)} | Marketing Analysis by Mortar Metrics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
${css}
</head>
<body>
  <div class="container">

    <div class="header">
      <div class="logo">Mortar Metrics</div>
      <div class="meta">Prepared for ${escapeHtml(prospectName || 'Your Firm')} · ${today}</div>
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
        They find other firms.<br>
        <span class="highlight">Not yours.</span>
      </h1>

      <p class="hero-sub">
        ${escapeHtml(prose.heroSubheading)}
      </p>

      <div class="scroll-hint">
        2 minute read
        <span>↓</span>
      </div>
    </section>


    <!-- THREE GAPS -->
    <div class="divider"></div>

    <div class="narrative">
      <h2>${escapeHtml(prose.gapSectionHeadline)}</h2>
    </div>

    <!-- TOTAL STRIP -->
    <div class="total-strip">
      <div class="total-strip-text">Combined estimated monthly opportunity</div>
      <div class="total-strip-number">${currency}${formatMoney(totalLow)}-${formatMoney(totalHigh)}</div>
    </div>

    <div class="callout">
      <p>${escapeHtml(prose.totalStripTransition || "Here's where that number comes from.")}</p>
    </div>


    <!-- GAP 1 - Google Ads -->
    <div class="gap-card gap-search fade-in">
      <div class="badge badge-search">Google Ads</div>
      <h3>${escapeHtml(prose.gap1Headline)}</h3>

      <div class="gap-stat">
        <div class="gap-stat-number">${gap1Stat.number}<span>/mo</span></div>
        <div class="gap-stat-label">${gap1Stat.label}</div>
      </div>

      <p>${formatGapProse(prose.gap1Context)}</p>

${generateSerpMockup(competitors, firmName, searchTerms, runningGoogleAds)}

      <div class="math-box">
        <span class="math-box-label">The math</span>
        <strong>${escapeHtml(prose.gap1MathIntro)}</strong>
      </div>
    </div>

    <div class="gap-connector" style="border-color: #3b5998; color: #3b5998;">+</div>

    <!-- GAP 2 - Meta Ads -->
    <div class="gap-card gap-social fade-in">
      <div class="badge badge-social">Meta Ads · Facebook + Instagram</div>
      <h3>${escapeHtml(prose.gap2Headline)}</h3>

      <div class="gap-stat">
        <div class="gap-stat-number">${gap2Stat.number}<span>/mo</span></div>
        <div class="gap-stat-label">${gap2Stat.label}</div>
      </div>

      <p>${formatGapProse(prose.gap2Context)}</p>

${generateTwoClientVisual(clientLabel, runningMetaAds, metaAdCount, country)}

      <div class="math-box">
        <span class="math-box-label">The math</span>
        <strong>${escapeHtml(prose.gap2MathIntro)}</strong>
      </div>
    </div>

    <div class="gap-connector" style="border-color: #059669; color: #059669;">+</div>

    <!-- GAP 3 - Voice AI -->
    <div class="gap-card gap-intake fade-in">
      <div class="badge badge-intake">Voice AI · 24/7 Intake</div>
      <h3>${escapeHtml(prose.gap3Headline)}</h3>

      <div class="gap-stat">
        <div class="gap-stat-number">${gap3Stat.number}<span>/mo</span></div>
        <div class="gap-stat-label">${gap3Stat.label}</div>
      </div>

      <p>${formatGapProse(prose.gap3Context)}</p>

      <div class="before-after">
        <div class="ba-side ba-before">
          <div class="ba-label">Without 24/7 intake</div>
          <p>Voicemail → caller hangs up → calls the next firm → you follow up next morning but they've already signed elsewhere</p>
        </div>
        <div class="ba-side ba-after">
          <div class="ba-label good">With AI-powered intake</div>
          <p>Answered in seconds → qualified → consultation booked → your team is notified → new client on the calendar</p>
        </div>
      </div>

      <div class="math-box">
        <span class="math-box-label">The math</span>
        <strong>${escapeHtml(prose.gap3MathIntro)}</strong>
      </div>
    </div>


    <div class="callout">
      <p>${escapeHtml(prose.totalStripContext)}</p>
    </div>


    <!-- COMPETITOR SECTION -->
    <div class="divider"></div>

    <div class="narrative">
      <h2>${escapeHtml(prose.competitorHeadline)}</h2>

      <p>${escapeHtml(prose.competitorIntro)}</p>
    </div>

${generateCompetitorBars(competitors, firmName, firmReviews, firmRating, prose.competitorTakeaway)}


    <!-- BUILD LIST -->
    <div class="divider"></div>

    <div class="narrative">
      <h2>${escapeHtml(prose.buildHeadline)}</h2>

      <p>${escapeHtml(prose.buildIntro)}</p>
    </div>

    <!-- CLIENT JOURNEY -->
    <div class="journey-heading">Every new client follows this path</div>
    <div class="journey-flow">
      <div class="journey-step">
        <div class="journey-icon" style="background: rgba(66,133,244,0.1); color: #4285F4;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </div>
        <span class="journey-label">Search</span>
      </div>
      <div class="journey-line"></div>
      <div class="journey-step">
        <div class="journey-icon" style="background: rgba(79,70,229,0.1); color: #4f46e5;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/></svg>
        </div>
        <span class="journey-label">Click</span>
      </div>
      <div class="journey-line"></div>
      <div class="journey-step">
        <div class="journey-icon" style="background: rgba(5,150,105,0.1); color: #059669;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </div>
        <span class="journey-label">Call</span>
      </div>
      <div class="journey-line"></div>
      <div class="journey-step">
        <div class="journey-icon" style="background: rgba(234,88,12,0.1); color: #ea580c;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
        <span class="journey-label">Sign</span>
      </div>
    </div>

    <div class="build-list fade-in">
      <div class="build-item">
        <div class="build-number">1</div>
        <div class="build-content">
          <strong>${escapeHtml(prose.buildItem1Title)}</strong>
          <p>${escapeHtml(prose.buildItem1Detail)}</p>
          <span class="build-timeline">${escapeHtml(prose.buildItem1Timeline)}</span>
        </div>
      </div>

      <div class="build-item">
        <div class="build-number">2</div>
        <div class="build-content">
          <strong>${escapeHtml(prose.buildItem2Title)}</strong>
          <p>${escapeHtml(prose.buildItem2Detail)}</p>
          <span class="build-timeline">${escapeHtml(prose.buildItem2Timeline)}</span>
        </div>
      </div>

      <div class="build-item">
        <div class="build-number">3</div>
        <div class="build-content">
          <strong>${escapeHtml(prose.buildItem3Title)}</strong>
          <p>${escapeHtml(prose.buildItem3Detail)}</p>
          <span class="build-timeline">${escapeHtml(prose.buildItem3Timeline)}</span>
        </div>
      </div>

      <div class="build-item">
        <div class="build-number">4</div>
        <div class="build-content">
          <strong>${escapeHtml(prose.buildItem4Title)}</strong>
          <p>${escapeHtml(prose.buildItem4Detail)}</p>
          <span class="build-timeline">${escapeHtml(prose.buildItem4Timeline)}</span>
        </div>
      </div>
    </div>


    <!-- CTA -->
    <div class="divider"></div>

    <div id="booking" class="cta fade-in">
      <h2>${escapeHtml(prose.ctaHeadline)}</h2>
      <p>${escapeHtml(prose.ctaSubtext)}</p>
      <iframe src="https://api.mortarmetrics.com/widget/booking/7aCMl8OqQAOE3NfjfUGT" style="width: 100%; border: none; overflow: hidden; min-height: 600px;" scrolling="no" id="mortar-booking-widget"></iframe>
      <script src="https://api.mortarmetrics.com/js/form_embed.js" type="text/javascript"></script>
    </div>


    <div class="footer">
      Mortar Metrics · Legal Growth Agency · ${escapeHtml(city && state ? `${city}, ${state}` : city || state || '')}<br>
      <a href="mailto:hello@mortarmetrics.com">hello@mortarmetrics.com</a>
    </div>

  </div>

${generateTypingScript(searchTerms)}
<noscript><style>.fade-in { opacity: 1 !important; }</style></noscript>
</body>
</html>`;
}

// ============================================================================
// COMPETITOR BARS — Data-driven, not prose
// ============================================================================

function generateCompetitorBars(competitors, firmName, firmReviews, firmRating, takeawayText) {
  if (!competitors || competitors.length === 0) {
    return `
    <div class="competitor-section fade-in">
      <div class="competitor-takeaway">
        <strong>We couldn't find verified competitor data for this market.</strong> That's often a sign of an under-marketed space - which means first-mover advantage for firms that build comprehensive marketing infrastructure.
      </div>
    </div>
`;
  }

  // Find max reviews for scaling
  const allReviews = [...competitors.map(c => c.reviews || c.reviewCount || 0), firmReviews];
  const maxReviews = Math.max(...allReviews, 1);

  let bars = '<div class="competitor-section fade-in">\n';

  // Competitor bars
  competitors.slice(0, 3).forEach(comp => {
    const reviews = comp.reviews || comp.reviewCount || 0;
    const rating = comp.rating || 0;
    const width = Math.max((reviews / maxReviews) * 100, 2);
    const cleanName = sanitizeCompetitorName(comp.name);

    bars += `      <div class="review-bar-group">
        <div class="review-bar-label">
          <span class="review-bar-name">${escapeHtml(cleanName)}</span>
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
          <span class="review-bar-name you">${escapeHtml(firmName)} (You)</span>
          <span class="review-bar-count you">${firmReviews || 0} reviews${firmRating ? ` · ${firmRating.toFixed(1)}★` : ''}</span>
        </div>
        <div class="review-bar-track">
          <div class="review-bar-fill yours" style="width: ${firmWidth.toFixed(2)}%"></div>
        </div>
      </div>

      <div class="competitor-takeaway">
        <strong>${escapeHtml(takeawayText)}</strong>
      </div>
    </div>
`;

  return bars;
}

// ============================================================================
// TYPING ANIMATION SCRIPT
// ============================================================================

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
  const el = document.getElementById('typed-search');
  if (el) el.textContent = '';
  new SearchTyper('typed-search', ${JSON.stringify(searchTerms)}).start();

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.fade-in, .competitor-section').forEach(el => io.observe(el));
});
</script>
`;
}

// ============================================================================
// HELPER FUNCTIONS (kept from original)
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
  name = name
    .replace(/\s*-\s*(Tax|Family|Criminal|Immigration|Estate|Property|Customs|VAT)(\s*-\s*\w+)*/i, '')
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
  const websiteLower = (researchData.website || '').toLowerCase();
  if (websiteLower.includes('family') || websiteLower.includes('divorce')) return 'divorce';
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
    'divorce': 'FAMILY LAW', 'family': 'FAMILY LAW', 'tax': 'TAX LAW',
    'personal injury': 'PERSONAL INJURY', 'immigration': 'IMMIGRATION LAW',
    'criminal': 'CRIMINAL DEFENSE', 'estate': 'ESTATE PLANNING',
    'business': 'BUSINESS LAW', 'bankruptcy': 'BANKRUPTCY LAW',
    'employment': 'EMPLOYMENT LAW', 'real estate': 'REAL ESTATE LAW',
    'ip': 'INTELLECTUAL PROPERTY', 'landlord': 'LANDLORD LAW',
    'medical malpractice': 'MEDICAL MALPRACTICE', 'workers comp': 'WORKERS COMPENSATION',
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
  const c = (city || '').toLowerCase();
  const ctry = (country || 'US').toUpperCase();
  if (ctry === 'GB' || ctry === 'UK') {
    if (c.includes('london')) return 1.8;
    const midUK = ['manchester', 'birmingham', 'leeds', 'glasgow', 'liverpool',
      'edinburgh', 'bristol', 'cardiff', 'belfast', 'nottingham', 'sheffield',
      'leicester', 'newcastle', 'brighton', 'reading', 'swindon'];
    if (midUK.some(m => c.includes(m))) return 1.3;
    return 1.0;
  }
  const major = ['new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
    'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'san francisco',
    'seattle', 'denver', 'boston', 'nashville', 'portland', 'las vegas', 'toronto'];
  if (major.some(m => c.includes(m))) return 1.8;
  const mid = ['memphis', 'louisville', 'richmond', 'new orleans', 'raleigh', 'salt lake city',
    'atlanta', 'miami', 'minneapolis', 'cleveland', 'tampa', 'orlando', 'pittsburgh'];
  if (mid.some(m => c.includes(m))) return 1.3;
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

function calculateGap1(marketMultiplier, caseValues, countryBaseline, currency) {
  const sym = currency || '$';
  const searches = Math.round(880 * marketMultiplier * countryBaseline);
  const ctr = 0.045; const conv = 0.15; const close = 0.25;
  const casesPerMonth = searches * ctr * conv * close;
  const low = Math.round(casesPerMonth * caseValues.low / 500) * 500;
  const high = Math.round(casesPerMonth * caseValues.high / 500) * 500;
  const minLow = Math.round(3500 * countryBaseline / 500) * 500 || 500;
  const minHigh = Math.round(7000 * countryBaseline / 500) * 500 || 1000;
  return {
    low: Math.max(minLow, low), high: Math.max(minHigh, high), searches,
    formula: `~${searches} monthly searches × 4.5% CTR × 15% inquiry rate × 25% close rate × ${sym}${caseValues.low.toLocaleString()}-${caseValues.high.toLocaleString()} avg case value`
  };
}

function calculateGap2(marketMultiplier, caseValues, city, countryBaseline, currency) {
  const sym = currency || '$';
  const audience = Math.round(65000 * marketMultiplier * countryBaseline);
  const reach = 0.020; const conv = 0.012; const close = 0.25;
  const casesPerMonth = audience * reach * conv * close;
  const low = Math.round(casesPerMonth * caseValues.low / 500) * 500;
  const high = Math.round(casesPerMonth * caseValues.high / 500) * 500;
  const minLow = Math.round(4000 * countryBaseline / 500) * 500 || 500;
  const minHigh = Math.round(8000 * countryBaseline / 500) * 500 || 1000;
  return {
    low: Math.max(minLow, low), high: Math.max(minHigh, high), audience, city: city || 'your area',
    formula: `~${(audience/1000).toFixed(0)}K reachable audience in ${city || 'metro'} × 2.0% monthly ad reach × 1.2% conversion to inquiry × 25% close rate × ${sym}${caseValues.low.toLocaleString()}-${caseValues.high.toLocaleString()} avg case value`
  };
}

function calculateGap3(firmSizeMultiplier, caseValues, countryBaseline, currency) {
  const sym = currency || '$';
  const calls = Math.round(85 * firmSizeMultiplier * countryBaseline);
  const afterHours = 0.35; const missRate = 0.60; const recovery = 0.70; const close = 0.25;
  const casesPerMonth = calls * afterHours * missRate * recovery * close;
  const low = Math.round(casesPerMonth * caseValues.low / 500) * 500;
  const high = Math.round(casesPerMonth * caseValues.high / 500) * 500;
  const minLow = Math.round(3500 * countryBaseline / 500) * 500 || 500;
  const minHigh = Math.round(7000 * countryBaseline / 500) * 500 || 1000;
  return {
    low: Math.max(minLow, low), high: Math.max(minHigh, high), calls,
    formula: `~${calls} inbound calls/mo × 35% outside business hours × 60% that won't leave a voicemail × 70% recoverable with live intake × 25% close rate × ${sym}${caseValues.low.toLocaleString()}-${caseValues.high.toLocaleString()} avg case value`
  };
}

function formatMoney(num) {
  if (num >= 1000) {
    const k = num / 1000;
    if (k % 1 === 0.5) return k.toFixed(1) + 'K';
    return Math.round(k).toLocaleString() + 'K';
  }
  return num.toLocaleString();
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
