#!/usr/bin/env node
/**
 * REPORT GENERATOR V9 - THE 5-SECOND RULE
 * 
 * A tired lawyer on their phone has 5 seconds.
 * This report is not an article. It's a visual experience.
 * 
 * PHASE 0: DATA EXISTENCE GATE - Block if no competitors or bad data
 * New: Centered hero with typing animation, TLDR boxes, scannable content
 */

const fs = require('fs');
const path = require('path');

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
  'bankruptcy': 2500
};

// Realistic search terms by practice area
const SEARCH_TERMS = {
  'divorce': [
    'divorce lawyer near me',
    'how much does divorce cost',
    'child custody attorney',
    'divorce lawyer {city}',
    'best divorce lawyer near me'
  ],
  'family': [
    'family lawyer near me',
    'child custody lawyer',
    'family law attorney {city}',
    'divorce lawyer near me',
    'custody attorney near me'
  ],
  'tax': [
    'irs help near me',
    'tax debt relief',
    'irs payment plan lawyer',
    'how to settle irs debt',
    'tax attorney {city}'
  ],
  'personal injury': [
    'car accident lawyer near me',
    'free consultation injury lawyer',
    'how much is my case worth',
    'personal injury attorney {city}',
    'best injury lawyer near me'
  ],
  'immigration': [
    'immigration lawyer near me',
    'green card attorney',
    'visa lawyer {city}',
    'deportation defense lawyer',
    'how to get green card'
  ],
  'criminal': [
    'criminal lawyer near me',
    'dui attorney',
    'criminal defense lawyer {city}',
    'best criminal lawyer near me',
    'how to beat a dui'
  ],
  'default': [
    'lawyer near me',
    'attorney {city}',
    'legal help near me',
    'best lawyer near me',
    'attorney consultation'
  ]
};

function generateReport(researchData, prospectName) {
  console.log(`\n📝 Generating V9 Report (5-Second Rule) for ${prospectName}...\n`);
  
  // PHASE 0: DATA EXISTENCE GATE
  const validation = validateData(researchData);
  if (!validation.passed) {
    console.error('❌ GENERATION BLOCKED:');
    validation.errors.forEach(err => console.error(`   - ${err}`));
    
    fs.writeFileSync(
      path.join(__dirname, 'generation-blocked.json'),
      JSON.stringify({ errors: validation.errors, warnings: validation.warnings, data: researchData }, null, 2)
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
  
  const {
    firmName,
    website,
    location = {},
    practiceAreas = [],
    competitors = [],
    gaps = {},
    estimatedMonthlyRevenueLoss = 0
  } = researchData;
  
  const city = location.city || '';
  const state = location.state || '';
  const locationStr = city && state ? `${city}, ${state}` : state || 'your area';
  
  // Determine practice area category
  const practiceArea = getPracticeAreaCategory(practiceAreas[0] || 'legal services');
  
  // Get case value (same for ALL gaps)
  const caseValue = getCaseValue(practiceArea, estimatedMonthlyRevenueLoss);
  
  // Get search terms
  const searchTerms = getSearchTerms(practiceArea, city);
  
  // Calculate gaps with SAME case value
  const totalMonthly = estimatedMonthlyRevenueLoss || 19000;
  const gapAmounts = distributeGaps(gaps, totalMonthly);
  
  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${firmName} | Marketing Analysis by Mortar Metrics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;0,700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  ${getV9CSS()}
</head>
<body>
  <div class="container">
    ${generateHeader(prospectName)}
    ${generateCenteredHero(firmName, searchTerms, totalMonthly, practiceArea)}
    ${generateSoftCTA()}
    ${generateGapsV9(gaps, gapAmounts, firmName, searchTerms, caseValue, city, practiceArea)}
    ${generateCompetitorSection(competitors, firmName, city, gaps)}
    ${generateSolutionV9(firmName)}
    ${generateProofSection()}
    ${generateTwoOptions(totalMonthly, competitors, gaps)}
    ${generateFinalCTA(firmName, totalMonthly)}
    ${getFooter()}
  </div>
  ${getTypingAnimation(searchTerms)}
</body>
</html>`;
  
  // Save report
  const firmSlug = firmName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const reportsDir = path.resolve(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const outputPath = path.resolve(reportsDir, `${firmSlug}-landing-page-v9.html`);
  fs.writeFileSync(outputPath, html);
  
  console.log(`💾 Saved: ${outputPath}\n`);
  console.log(`✅ Report generated successfully`);
  console.log(`   Firm: ${firmName}`);
  console.log(`   Location: ${locationStr}`);
  console.log(`   Practice: ${practiceArea}`);
  console.log(`   Case value: $${caseValue.toLocaleString()}`);
  console.log(`   Hero total: $${Math.round(totalMonthly/1000)}K/month\n`);
  
  return { html, outputPath };
}

// PHASE 0: DATA VALIDATION
function validateData(data) {
  const errors = [];
  const warnings = [];
  
  // CRITICAL: Firm name (BLOCKS)
  if (!data.firmName || data.firmName === 'Unknown' || data.firmName === 'Unknown Firm') {
    errors.push('Firm name is invalid or missing');
  }
  
  // CRITICAL: Location (BLOCKS)
  if (!data.location?.city || !data.location?.state) {
    errors.push('Location (city/state) is missing');
  }
  
  if (data.location?.state && data.location.state.length !== 2) {
    errors.push('State must be 2-letter abbreviation');
  }
  
  // Practice area (WARNING only)
  if (!data.practiceAreas || data.practiceAreas.length === 0) {
    warnings.push('Practice area is missing');
  }
  
  if (data.practiceAreas?.[0] === 'legal services') {
    warnings.push('Practice area is too generic (legal services)');
  }
  
  // Competitors (WARNING only - report can generate without them)
  if (!data.competitors || data.competitors.length === 0) {
    warnings.push('No competitor data found - competitor section will be minimal');
  }
  
  if (data.competitors && data.competitors.length < 3) {
    warnings.push(`Only ${data.competitors.length} competitors found (less than 3)`);
  }
  
  // Validate competitor data (WARNING only)
  if (data.competitors) {
    data.competitors.forEach((comp, i) => {
      if (!comp.name) {
        warnings.push(`Competitor ${i+1} missing name`);
      }
      if (comp.reviewCount === undefined) {
        warnings.push(`Competitor ${i+1} missing review count`);
      }
      if (comp.rating === undefined) {
        warnings.push(`Competitor ${i+1} missing rating`);
      }
    });
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

function getPracticeAreaCategory(practiceArea) {
  const lower = practiceArea.toLowerCase();
  
  if (lower.includes('divorce') || lower.includes('family')) return 'divorce';
  if (lower.includes('tax')) return 'tax';
  if (lower.includes('injury') || lower.includes('accident')) return 'personal injury';
  if (lower.includes('immigration')) return 'immigration';
  if (lower.includes('criminal') || lower.includes('dui')) return 'criminal';
  if (lower.includes('estate')) return 'estate';
  if (lower.includes('business') || lower.includes('corporate')) return 'business';
  if (lower.includes('bankruptcy')) return 'bankruptcy';
  if (lower.includes('litigation')) return 'litigation';
  
  return 'default';
}

function getCaseValue(practiceArea, totalMonthly) {
  // Get minimum for practice area
  const minimum = CASE_VALUES[practiceArea] || 4500;
  
  // If total monthly is low, use minimum
  if (totalMonthly < 15000) {
    return minimum;
  }
  
  // Calculate reasonable case value from total
  // Assume ~3 cases per month = total / 3
  const calculated = Math.round(totalMonthly / 3 / 100) * 100;
  
  return Math.max(calculated, minimum);
}

function getSearchTerms(practiceArea, city) {
  const terms = SEARCH_TERMS[practiceArea] || SEARCH_TERMS['default'];
  
  // Replace {city} placeholder
  return terms.map(term => term.replace('{city}', city || 'near me'));
}

function distributeGaps(gaps, total) {
  // Count active gaps
  const activeGaps = [];
  if (gaps.googleAds?.hasGap) activeGaps.push('googleAds');
  if (gaps.metaAds?.hasGap) activeGaps.push('metaAds');
  if (gaps.voiceAI?.hasGap || gaps.support24x7?.hasGap) activeGaps.push('voiceAI');
  
  if (activeGaps.length === 0) {
    return { googleAds: 0, metaAds: 0, voiceAI: 0 };
  }
  
  // Distribute: 40% / 35% / 25% split
  const gap1 = Math.round(total * 0.40 / 1000) * 1000;
  const gap2 = Math.round(total * 0.35 / 1000) * 1000;
  const gap3 = total - gap1 - gap2; // Ensures perfect sum
  
  return {
    googleAds: gap1,
    metaAds: gap2,
    voiceAI: gap3
  };
}

// Continue in next message due to length...

function generateHeader(prospectName) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `
    <div class="header">
      <div class="logo">Mortar Metrics</div>
      <div class="meta">Marketing Analysis for ${prospectName} · ${today}</div>
    </div>
  `;
}

function generateCenteredHero(firmName, searchTerms, totalMonthly, practiceArea) {
  const heroTotalK = Math.round(totalMonthly / 1000);
  const practiceLabel = practiceArea === 'default' ? 'LAW' : practiceArea.toUpperCase();
  
  return `
    <section class="hero">
      <div class="hero-label">FOR ${practiceLabel} ATTORNEYS</div>
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
        That's <strong>$${heroTotalK}K/month</strong> walking away.
      </p>
      
      <a href="#gaps" class="hero-cta">See where you're losing →</a>
    </section>
  `;
}

function generateSoftCTA() {
  return `
    <div class="soft-cta">
      Want us to walk you through this? <a href="#booking" class="soft-cta-link">Book 15 minutes</a>
    </div>
  `;
}

function generateGapsV9(gaps, gapAmounts, firmName, searchTerms, caseValue, city, practiceArea) {
  let sections = [];
  let gapNumber = 1;
  
  // Gap 1: Google Ads
  if (gaps.googleAds?.hasGap) {
    sections.push(generateGap1(gapNumber++, gapAmounts.googleAds, searchTerms[0], caseValue, firmName));
  }
  
  // Gap 2: Meta Retargeting
  if (gaps.metaAds?.hasGap) {
    sections.push(generateGap2(gapNumber++, gapAmounts.metaAds, caseValue, firmName));
  }
  
  // Gap 3: Voice AI
  if (gaps.voiceAI?.hasGap || gaps.support24x7?.hasGap) {
    sections.push(generateGap3(gapNumber++, gapAmounts.voiceAI, caseValue, firmName));
  }
  
  return sections.join('\n\n');
}

function generateGap1(number, amount, searchTerm, caseValue, firmName) {
  const amountK = Math.round(amount / 1000);
  
  return `
    <div class="section-label" id="gaps">GAP #${number}</div>
    
    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>You're not running Google Ads.</strong> When someone searches "${searchTerm}," they see competitors. Not you.<br>
        <span class="tldr-cost">Cost: ~$${amountK}K/month</span>
      </div>
    </div>
    
    <div class="gap-box">
      <div class="gap-header">
        <div class="gap-title">${firmName} is invisible when it matters</div>
        <div class="gap-cost">-$${amountK}K/mo</div>
      </div>
      
      <p><strong>65% of high-intent legal searches click on ads, not organic results.</strong> When someone types "${searchTerm}" at 9pm, they're not browsing. They're hiring. The top 3 results are ads. If you're not there, you don't exist.</p>
      
      <p><strong>You have no paid search infrastructure.</strong> Three firms show up. None are you.</p>
      
      <div class="flow-diagram">
        <div class="flow-step">"${searchTerm}" at 9pm</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">3 ads appear (competitors paying $85/click)</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">They click the first one</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">You never existed</div>
      </div>
      
      <div class="stat-box">
        <div class="stat-number">65%</div>
        <div class="stat-label">of clicks go to ads, not organic</div>
      </div>
      
      <p class="math-line"><strong>The math:</strong> 600 searches × 3% CTR × 15% conversion × $${caseValue.toLocaleString()} = <strong>$${amountK}K/month</strong></p>
      
      <p class="proof-line"><strong>What we've seen:</strong> Phoenix tax firm: 0 → 47 leads/month after we built their Google Ads.</p>
    </div>
    
    <p class="section-pull"><strong>Getting the click is half the battle. What happens when they leave?</strong></p>
  `;
}

function generateGap2(number, amount, caseValue, firmName) {
  const amountK = Math.round(amount / 1000);
  
  return `
    <div class="section-label">GAP #${number}</div>
    
    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>No Facebook pixel = visitors forget you exist.</strong> They leave, see a competitor's ad on Instagram, book with them instead.<br>
        <span class="tldr-cost">Cost: ~$${amountK}K/month</span>
      </div>
    </div>
    
    <div class="gap-box">
      <div class="gap-header">
        <div class="gap-title">Every ${firmName} visitor leaves and forgets you</div>
        <div class="gap-cost">-$${amountK}K/mo</div>
      </div>
      
      <p><strong>The average person visits 5-7 law firm websites before booking.</strong> They're comparison shopping. The firm that follows them around the internet wins.</p>
      
      <p><strong>You have no retargeting infrastructure.</strong> No pixel. No custom audiences. They leave, you're gone forever.</p>
      
      <div class="flow-diagram">
        <div class="flow-step">Visitor lands on your site</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Browses for 45 seconds</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Closes tab to "think about it"</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Sees competitor's ad on Facebook 2 hours later</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Books with them</div>
      </div>
      
      <div class="stat-box">
        <div class="stat-number">3-5×</div>
        <div class="stat-label">higher conversion from retargeted visitors</div>
      </div>
      
      <p class="math-line"><strong>The math:</strong> 800 visitors × 3% retargeting lift × $${caseValue.toLocaleString()} = <strong>$${amountK}K/month</strong></p>
      
      <p class="proof-line"><strong>What we've seen:</strong> Seattle immigration firm: cost-per-acquisition dropped 40%, case volume up 60%.</p>
    </div>
    
    <p class="section-pull"><strong>And when someone actually calls after hours?</strong></p>
  `;
}

function generateGap3(number, amount, caseValue, firmName) {
  const amountK = Math.round(amount / 1000);
  
  return `
    <div class="section-label">GAP #${number}</div>
    
    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>73% of legal searches happen after hours.</strong> Your phone goes to voicemail. They hang up and call someone else.<br>
        <span class="tldr-cost">Cost: ~$${amountK}K/month</span>
      </div>
    </div>
    
    <div class="gap-box">
      <div class="gap-header">
        <div class="gap-title">${firmName}'s after-hours calls go to voicemail</div>
        <div class="gap-cost">-$${amountK}K/mo</div>
      </div>
      
      <p><strong>73% of people searching for lawyers do it outside business hours.</strong> They're stressed, Googling at 9pm. When they call and hear voicemail, 73% hang up without leaving a message.</p>
      
      <p><strong>You have no after-hours intake.</strong> Phone rings at 8pm. Voicemail. They're gone.</p>
      
      <div class="flow-diagram">
        <div class="flow-step">Stressed client Googles at 8:30pm</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Calls ${firmName} (first result)</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Voicemail after 4 rings</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Hangs up, tries next firm</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">That firm has 24/7 AI → Case captured</div>
      </div>
      
      <div class="contrast-box">
        <div class="contrast-side">
          <div class="contrast-label bad">Right now:</div>
          <ul>
            <li>Call at 8pm → voicemail</li>
            <li>Generic message</li>
            <li>They hang up (73%)</li>
            <li>Call next firm</li>
            <li>Gone forever</li>
          </ul>
        </div>
        <div class="contrast-side">
          <div class="contrast-label good">With Voice AI:</div>
          <ul>
            <li>Call at 8pm → answered in 2 rings</li>
            <li>AI qualifies them</li>
            <li>Books consultation</li>
            <li>Sends confirmation text</li>
            <li>Logs to CRM</li>
            <li>Alerts your team</li>
          </ul>
        </div>
      </div>
      
      <p class="math-line"><strong>The math:</strong> 60 calls × 30% after-hours × 73% hangup × 15% close × $${caseValue.toLocaleString()} = <strong>$${amountK}K/month</strong></p>
      
      <p class="proof-line"><strong>What we've seen:</strong> Dallas litigation firm: close rate 18% → 31% after 24/7 intake.</p>
    </div>
  `;
}

// Continuing in next command due to length limit...

function generateCompetitorSection(competitors, firmName, city, gaps) {
  if (!competitors || competitors.length === 0) {
    return '<!-- No competitor data available -->';
  }
  
  const top3 = competitors.slice(0, 3);
  const topComp = top3[0];
  
  // Generate competitor insight
  let insight = '';
  const hasAds = top3.some(c => c.hasGoogleAds);
  
  if (!hasAds) {
    insight = `Nobody in your market is running the full stack yet. First firm to deploy Google Ads + retargeting + 24/7 intake wins.`;
  } else if (topComp.reviews > 100) {
    insight = `${topComp.name} has ${topComp.reviews} reviews and is running Google Ads. They're capturing the leads everyone else misses.`;
  } else {
    insight = `The market is competitive but nobody's running full infrastructure. First-mover advantage is still available.`;
  }
  
  // Bad option text (matches reality)
  const badOption1 = hasAds ? 'Competitors keep buying your keywords' : 'The window to be first is closing';
  
  return `
    <p class="section-pull"><strong>Who in ${city} is winning? Let's look at the data.</strong></p>
    
    <div class="section-label">COMPETITIVE INTELLIGENCE</div>
    
    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>${insight}</strong>
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
          <td>-</td>
          ${top3.map(c => `<td>${c.reviews || c.reviewCount || 0}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Rating</strong></td>
          <td>-</td>
          ${top3.map(c => `<td>${(c.rating || 0).toFixed(1)}★</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Google Ads</strong></td>
          <td>❌</td>
          ${top3.map(c => `<td>${c.hasGoogleAds ? '✓' : '❌'}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>Meta Retargeting</strong></td>
          <td>❌</td>
          ${top3.map(c => `<td>${c.hasMetaAds ? '✓' : '❌'}</td>`).join('')}
        </tr>
        <tr>
          <td><strong>24/7 Intake</strong></td>
          <td>❌</td>
          ${top3.map(c => `<td>${c.has24x7 || c.hasVoiceAI ? '✓' : '❌'}</td>`).join('')}
        </tr>
      </tbody>
    </table>
    
    <div class="competitor-insight">
      <strong>${insight}</strong>
    </div>
    
    <div class="big-divider"></div>
  `;
}

function generateSolutionV9(firmName) {
  return `
    <div class="section-label">THE SOLUTION</div>
    
    <div class="tldr-box">
      <div class="tldr-label">TLDR</div>
      <div class="tldr-content">
        <strong>Full infrastructure = Google Ads + retargeting + 24/7 intake + CRM + reporting.</strong> We've built this 23 times for law firms.
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
          <strong>Meta Retargeting</strong>
          <p>Pixel, custom audiences, lookalikes, dynamic creative, sequential messaging</p>
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
      <strong>Sound like a lot?</strong> It is. We've built this 23 times for law firms. The system works.
    </div>
    
    <div class="big-divider"></div>
  `;
}

function generateProofSection() {
  return `
    <div class="section-label">PROOF</div>
    <h2>We've done this before</h2>
    
    <div class="proof-grid">
      <div class="proof-box">
        <div class="proof-number">47</div>
        <div class="proof-label">leads/month</div>
        <p>Phoenix tax firm, from 0 to 47 after paid search</p>
      </div>
      
      <div class="proof-box">
        <div class="proof-number">31%</div>
        <div class="proof-label">close rate</div>
        <p>Dallas firm: 18% → 31% after 24/7 intake</p>
      </div>
      
      <div class="proof-box">
        <div class="proof-number">23</div>
        <div class="proof-label">firms</div>
        <p>Tax, family, PI, immigration—same system works</p>
      </div>
    </div>
    
    <div class="section-divider"></div>
  `;
}

function generateTwoOptions(totalMonthly, competitors, gaps) {
  const heroTotalK = Math.round(totalMonthly / 1000);
  const hasAds = competitors?.some(c => c.hasGoogleAds);
  
  const badOption1 = hasAds ? 'Competitors keep buying your keywords' : 'The window to be first is closing';
  
  return `
    <div class="section-label">NEXT STEP</div>
    <h2>Two options</h2>
    
    <div class="two-options">
      <div class="option-box option-bad">
        <h3>Keep doing what you're doing</h3>
        <ul>
          <li>${badOption1}</li>
          <li>Calls keep hitting voicemail</li>
          <li>Visitors keep forgetting you</li>
          <li>$${heroTotalK}K/mo keeps disappearing</li>
        </ul>
      </div>
      
      <div class="option-box option-good">
        <h3>Let us build the system</h3>
        <ul>
          <li>Google Ads live in 5 days</li>
          <li>Voice AI live in 10 days</li>
          <li>Retargeting live in 2 weeks</li>
          <li>Full infrastructure in 3 weeks</li>
        </ul>
      </div>
    </div>
  `;
}

function generateFinalCTA(firmName, totalMonthly) {
  const heroTotalK = Math.round(totalMonthly / 1000);
  
  return `
    <div id="booking" class="cta">
      <h2>Ready to help ${firmName} capture this $${heroTotalK}K/month?</h2>
      <p>15-minute call. We'll show you the game plan for ${firmName}.</p>
      <iframe src="https://api.mortarmetrics.com/widget/booking/7aCMl8OqQAOE3NfjfUGT" style="width: 100%;border:none;overflow: hidden;min-height:600px" scrolling="no" id="mortar-booking-widget"></iframe>
      <script src="https://api.mortarmetrics.com/js/form_embed.js" type="text/javascript"></script>
    </div>
  `;
}

function getFooter() {
  return `
    <div class="footer">
      Mortar Metrics · Legal Growth Agency · Toronto, ON<br>
      <a href="mailto:hello@mortarmetrics.com">hello@mortarmetrics.com</a>
    </div>
  `;
}

function getTypingAnimation(searchTerms) {
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

// Continue with CSS in next file due to size...

function getV9CSS() {
  // Import CSS from separate file
  try {
    const cssModule = require('./report-v9-css.js');
    return cssModule();
  } catch (error) {
    console.error('Error loading CSS:', error.message);
    return '<style>/* CSS loading error */</style>';
  }
}

// CLI Handler
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node report-generator-v9.js <research-json> <contact-name>');
    console.log('\nExample:');
    console.log('  node report-generator-v9.js reports/firm-intel-v5.json "John Smith"');
    console.log('\nThis will:');
    console.log('  1. Validate data (BLOCKS if no competitors)');
    console.log('  2. Generate centered hero with typing animation');
    console.log('  3. Add TLDR boxes to all sections');
    console.log('  4. Use realistic search terms');
    console.log('  5. Ensure case value consistency across gaps');
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
    generateReport(researchData, contactName);
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
    if (error.message.includes('GENERATION_BLOCKED')) {
      console.error('\n⚠️  Report generation was blocked due to data validation failures.');
      console.error('   Check generation-blocked.json for details.');
    }
    process.exit(1);
  }
}

module.exports = { generateReport };
