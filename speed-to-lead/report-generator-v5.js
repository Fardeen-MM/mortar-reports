#!/usr/bin/env node
/**
 * REPORT GENERATOR V5 - SOBIROVSLAW-QUALITY GAP ANALYSIS
 * 
 * Features:
 * - Deep personalization with specific scenarios
 * - Practice area templates (Immigration, M&A, Personal Injury, Family Law, Criminal)
 * - Interactive calculator with service toggles
 * - Math breakdown section (transparent calculations)
 * - Competitive comparison table
 * - Playbook cards (DIY vs done-for-you)
 * - Market intelligence per practice area
 * - Story scenarios throughout
 * - Reveal animations
 * - Smart gap handling (blue ocean badges, critical badges)
 * 
 * Input: Research JSON + contact name
 * Output: Beautiful HTML report like SobirovsLaw
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// PRACTICE AREA TEMPLATES
// ============================================================================

const practiceAreaTemplates = {
  'Immigration': {
    urgencyAngle: 'visa deadlines and time-sensitive applications',
    storyScenario: (firmName, location) => `
      <strong>Tuesday, 2:47 AM ${location.city || 'your city'} time.</strong> A tech founder in Singapore just learned Canada's Start-Up Visa program is closing to new applications in 48 hours. She Googles "best Canada business immigration lawyer." Sees your content. Incredible credentials. Calls your number. Voicemail. Fills out your form. Gets a reply 9 hours later—during her Wednesday night. By then, she's already had a call with your competitor who answered at 3 AM via their AI intake. She's their client now.
    `,
    marketData: {
      stat1: { value: '40%+', label: 'Entrepreneurs will be immigrants by 2034' },
      stat2: { value: '2.9%', label: 'Immigrant entrepreneur rate' },
      stat3: { value: '160+', label: 'Annual applications (estimate)' },
      stat4: { value: '72%+', label: 'Average approval rate' }
    },
    calculatorDefaults: {
      inquiries: 50,
      afterHours: 45,
      caseValue: 12000,
      closeRate: 30
    },
    competitiveLandscape: 'Business immigration is 24/7 global. Your clients are in Dubai at 3 AM, Singapore at 4 AM, Mumbai at midnight. When they search, who answers first wins.'
  },
  
  'M&A': {
    urgencyAngle: 'hostile takeovers and time-sensitive deal flow',
    storyScenario: (firmName, location) => `
      <strong>Sunday, 11:43 PM.</strong> A private equity partner receives a hostile takeover notice. The board meets Monday at 9 AM. He Googles "emergency M&A attorney ${location.state || 'near me'}." Sees three firms. Yours has incredible credentials—Best Lawyers recognition, 700+ attorneys. But your contact form says "We'll respond within 24 hours." Your competitor's AI answers immediately, qualifies the case, and books a 7 AM emergency call. By Monday at 9 AM, they're already drafting the defense. Your firm gets a reply-all email Tuesday: "Thanks, but we've retained counsel."
    `,
    marketData: {
      stat1: { value: '$2.1T', label: 'U.S. M&A Deal Volume (2024)' },
      stat2: { value: '68%', label: 'Deals happen outside business hours' },
      stat3: { value: '$850K', label: 'Average deal legal spend' },
      stat4: { value: '4-6', label: 'Firms considered per deal' }
    },
    calculatorDefaults: {
      inquiries: 30,
      afterHours: 55,
      caseValue: 85000,
      closeRate: 25
    },
    competitiveLandscape: 'M&A moves at the speed of crisis. When a hostile bid drops at 11 PM, the firm that responds at 11:05 PM wins. The firm that responds Monday at 9 AM loses.'
  },
  
  'Personal Injury': {
    urgencyAngle: 'accidents happen at night and on weekends',
    storyScenario: (firmName, location) => `
      <strong>Saturday, 9:17 PM.</strong> A father is rear-ended on I-95 with his daughter in the car. Minor injuries, major concern. At the ER, he Googles "best car accident lawyer ${location.city || location.state}." Sees your firm—5-star reviews, millions recovered. Calls. Voicemail. Tries your competitor. Gets an AI assistant that takes his info, explains his rights, and books a Monday consultation. Sunday morning, he gets a follow-up text with a case intake video. By Monday, he's already signed. Your firm never had a chance.
    `,
    marketData: {
      stat1: { value: '73%', label: 'Accidents happen outside 9-5' },
      stat2: { value: '85%', label: 'Victims call within 48 hours' },
      stat3: { value: '$52K', label: 'Average settlement value' },
      stat4: { value: '4.2', label: 'Attorneys contacted per case' }
    },
    calculatorDefaults: {
      inquiries: 80,
      afterHours: 60,
      caseValue: 8500,
      closeRate: 35
    },
    competitiveLandscape: 'Personal injury is a speed game. The attorney who responds first—and stays in touch—gets the case. Voicemail loses to AI every time.'
  },
  
  'Family Law': {
    urgencyAngle: 'emotional crises happen at 2 AM',
    storyScenario: (firmName, location) => `
      <strong>Thursday, 2:14 AM.</strong> A mother discovers her husband is filing for divorce and seeking full custody. She's terrified. Googles "emergency custody attorney ${location.city || location.state}." Finds your firm—excellent reviews, compassionate approach. Fills out your contact form. Gets an auto-reply: "We'll respond within 1-2 business days." She's in crisis *now*. Finds another firm with 24/7 intake. Talks to someone immediately. Books a Friday morning consultation. By the time your firm responds Monday, she's already retained counsel.
    `,
    marketData: {
      stat1: { value: '67%', label: 'Divorce inquiries outside business hours' },
      stat2: { value: '48hrs', label: 'Decision window for most clients' },
      stat3: { value: '$15K', label: 'Average case value (contested)' },
      stat4: { value: '3.8', label: 'Attorneys contacted before deciding' }
    },
    calculatorDefaults: {
      inquiries: 60,
      afterHours: 55,
      caseValue: 9500,
      closeRate: 32
    },
    competitiveLandscape: 'Family law clients are in emotional crisis. They need help NOW—not Monday morning. The firm that answers at 2 AM earns their trust and their case.'
  },
  
  'Criminal Defense': {
    urgencyAngle: 'arrests happen at night—calls happen from jail',
    storyScenario: (firmName, location) => `
      <strong>Friday, 10:52 PM.</strong> A college student is arrested for DUI. His father, panicked, Googles "best DUI attorney ${location.city || location.state}" from the police station. Sees your firm—former prosecutor, 400+ cases won. Calls. Voicemail. Keeps scrolling. Finds a firm with 24/7 intake. Speaks to someone in 30 seconds. They explain the process, quote a fee, and start the paperwork. By Saturday morning, that attorney is at the arraignment. Your firm's voicemail: deleted.
    `,
    marketData: {
      stat1: { value: '82%', label: 'Arrests happen outside business hours' },
      stat2: { value: '4hrs', label: 'Average decision window' },
      stat3: { value: '$8K', label: 'Average DUI case value' },
      stat4: { value: '2.1', label: 'Attorneys called before deciding' }
    },
    calculatorDefaults: {
      inquiries: 70,
      afterHours: 70,
      caseValue: 7500,
      closeRate: 38
    },
    competitiveLandscape: 'Criminal defense is urgency at its peak. Clients call from jail, from the police station, from panic. The attorney who answers immediately—not tomorrow—gets the case.'
  }
};

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

function generateReport(researchData, prospectName) {
  console.log(`\n📝 Generating SobirovsLaw-quality gap analysis for ${prospectName}...\n`);
  
  const {
    firmName,
    website,
    location,
    practiceAreas,
    credentials,
    gaps,
    competitors,
    estimatedMonthlyRevenueLoss,
    pageSpeed,
    competitorAds
  } = researchData;
  
  // Detect practice area and load template
  const primaryPractice = detectPracticeArea(practiceAreas);
  const template = practiceAreaTemplates[primaryPractice] || practiceAreaTemplates['Personal Injury'];
  
  // Calculate gains
  const gapsArray = Object.entries(gaps).filter(([key, gap]) => gap.hasGap);
  const totalGapImpact = gapsArray.reduce((sum, [key, gap]) => sum + gap.impact, 0);
  const monthlyGain = Math.round(totalGapImpact * 1.4);
  const annualGain = monthlyGain * 12;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Marketing Gap Analysis | ${prospectName} | ${firmName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  ${getCSS()}
</head>
<body>
  ${getBackground()}

  <div class="container">
    ${getHeader(prospectName, firmName)}
    
    ${generateHero(firmName, monthlyGain, annualGain, template, gapsArray, credentials, location, practiceAreas)}
    
    ${generateOpportunityBox(annualGain)}
    
    ${generateGapSummary(gaps)}
    
    ${generateStoryMini(template, firmName, location, competitors)}
    
    ${generateSpeedHighlight()}
    
    ${generateMarketData(template, primaryPractice)}
    
    ${generateCompetitiveTable(gaps, competitors, firmName)}
    
    ${generateCalculator(gaps, template, primaryPractice)}
    
    ${generateAIComparison()}
    
    ${generatePlaybook(gaps, primaryPractice)}
    
    ${generateVisionBox(credentials, firmName)}
    
    ${generateCTA(monthlyGain, template)}
    
    ${getFooter()}
  </div>

  ${getJavaScript()}
</body>
</html>`;
  
  // Build output path
  const slug = firmName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const outputPath = path.join(__dirname, 'reports', `${slug}-report.html`);
  
  return {
    html,
    outputPath,
    meta: {
      firmName,
      prospectName,
      monthlyGain,
      annualGain,
      practiceArea: primaryPractice,
      gapCount: gapsArray.length
    }
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function detectPracticeArea(practiceAreas) {
  const areas = practiceAreas.join(' ').toLowerCase();
  
  if (areas.includes('immigration') || areas.includes('visa')) return 'Immigration';
  if (areas.includes('m&a') || areas.includes('merger') || areas.includes('private equity')) return 'M&A';
  if (areas.includes('personal injury') || areas.includes('accident') || areas.includes('plaintiff')) return 'Personal Injury';
  if (areas.includes('family') || areas.includes('divorce') || areas.includes('custody')) return 'Family Law';
  if (areas.includes('criminal') || areas.includes('dui') || areas.includes('defense')) return 'Criminal Defense';
  
  return 'Personal Injury'; // Default fallback
}

function generateHero(firmName, monthlyGain, annualGain, template, gapsArray, credentials, location, practiceAreas) {
  // Build rich, personalized subtitle
  const credList = credentials && credentials.length > 0 ? credentials.slice(0, 3).join('. ') + '.' : `${firmName} is recognized as a leading law firm.`;
  const locationDetail = location.city && location.state ? `based in ${location.city}, ${location.state}` : location.state ? `serving ${location.state}` : 'serving clients nationwide';
  const practiceDetail = practiceAreas && practiceAreas.length > 0 ? ` Your ${practiceAreas.slice(0, 2).join(' and ')} practice is exceptional.` : '';
  
  return `
    <section class="hero">
      <h1 class="hero-title">
        You're leaving <em>$${annualGain.toLocaleString()}/year</em> on the table.
      </h1>
      <p class="hero-subtitle">
        ${credList} ${practiceDetail} You're ${locationDetail}. None of it matters when a high-value client searches for help at 3 AM—and your competitor's ad shows up first.
      </p>
      <p class="hero-subtitle" style="font-weight: 600; color: var(--ink);">
        Your expertise isn't the problem. Your availability is. Here's exactly how to fix it—and capture the $${(monthlyGain/1000).toFixed(0)}K/month walking out your door.
      </p>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-value danger">$${(monthlyGain/1000).toFixed(0)}K</div>
          <div class="hero-stat-label">Lost Monthly</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-value success">$${Math.round(monthlyGain * 1.15 / 1000)}K</div>
          <div class="hero-stat-label">Recoverable/Mo</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-value gold">${((monthlyGain * 1.15) / 2500).toFixed(1)}x</div>
          <div class="hero-stat-label">Potential ROI</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-value" style="color: var(--brand-blue);">${gapsArray.length}</div>
          <div class="hero-stat-label">Revenue Gaps</div>
        </div>
      </div>
      
      <div class="quick-cta">
        <a href="#calculator" class="quick-cta-btn primary">↓ See Your Numbers</a>
        <a href="#cta" class="quick-cta-btn secondary">Book 15 Min Call</a>
      </div>
    </section>
  `;
}

function generateOpportunityBox(annualGain) {
  return `
    <div class="opportunity-box reveal">
      <div class="opportunity-label">Annual Revenue You Could Recover</div>
      <div class="opportunity-value">$${annualGain.toLocaleString()}</div>
      <div class="opportunity-context">No new hires. No extra hours. Same great work—more clients finding you.</div>
    </div>
  `;
}

function generateGapSummary(gaps) {
  const gapCards = [];
  
  const gapConfig = {
    metaAds: {
      icon: '📱',
      title: 'Meta Ads Gap',
      desc: (gap) => `Not running Facebook/Instagram/LinkedIn ads. Competitors are capturing clients 24/7 while you rely on referrals.`
    },
    googleAds: {
      icon: '🔍',
      title: 'Google Ads Gap',
      desc: (gap) => {
        if (gap.status === 'blue-ocean') {
          return `<span class="blue-ocean-badge">BLUE OCEAN</span> Minimal competition. You could dominate high-intent searches.`;
        }
        return `Running ads but not optimized. Wasted spend on wrong keywords, missing high-intent searches.`;
      }
    },
    support24x7: {
      icon: '🌙',
      title: '24/7 Availability Gap',
      desc: (gap) => {
        if (gap.status === 'critical') {
          return `<span class="critical-badge">CRITICAL</span> ${gap.details}`;
        }
        return gap.details;
      }
    },
    websiteSpeed: {
      icon: '⚡',
      title: 'Website Speed Gap',
      desc: (gap) => gap.details
    },
    crm: {
      icon: '🤖',
      title: 'Follow-Up Gap',
      desc: (gap) => `Manual follow-up lets warm leads go cold. High-value clients need faster, systematic nurture.`
    }
  };
  
  for (const [key, gap] of Object.entries(gaps)) {
    if (gap.hasGap && gapConfig[key]) {
      const config = gapConfig[key];
      gapCards.push(`
        <div class="gap-card">
          <div class="gap-icon">${config.icon}</div>
          <div class="gap-title">${config.title}</div>
          <div class="gap-impact">-$${(gap.impact/1000).toFixed(0)}K/mo</div>
          <div class="gap-desc">${config.desc(gap)}</div>
        </div>
      `);
    }
  }
  
  if (gapCards.length === 0) return '';
  
  return `
    <div class="gap-summary reveal">
      ${gapCards.join('')}
    </div>
  `;
}

function generateStoryMini(template, firmName, location, competitors) {
  const comp = competitors[0] || 'your competitor';
  
  return `
    <div class="story-mini reveal">
      <p class="story-mini-text">
        ${template.storyScenario(firmName, location)}
      </p>
      <p class="story-mini-outcome">Your expertise didn't lose. Your availability did. This happens every week.</p>
    </div>
  `;
}

function generateSpeedHighlight() {
  return `
    <div class="speed-highlight reveal">
      <div class="speed-highlight-stat">21x</div>
      <div class="speed-highlight-text">
        Leads contacted within <strong>5 minutes</strong> are 21 times more likely to convert.<br>
        <span style="opacity: 0.9;">Every hour you delay is a competitor's gain. Speed wins.</span>
      </div>
    </div>
  `;
}

function generateMarketData(template, practiceArea) {
  const data = template.marketData;
  
  return `
    <section class="reveal">
      <div class="section-header">
        <span class="section-label">Why Now</span>
        <h2 class="section-title">The ${practiceArea} Market Is Growing</h2>
      </div>
      <div class="market-stats">
        <div class="market-stat">
          <div class="market-stat-value">${data.stat1.value}</div>
          <div class="market-stat-label">${data.stat1.label}</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-value">${data.stat2.value}</div>
          <div class="market-stat-label">${data.stat2.label}</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-value">${data.stat3.value}</div>
          <div class="market-stat-label">${data.stat3.label}</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-value">${data.stat4.value}</div>
          <div class="market-stat-label">${data.stat4.label}</div>
        </div>
      </div>
      <p style="text-align: center; color: var(--slate); font-size: 0.95rem; margin-top: 20px;">
        ${template.competitiveLandscape}
      </p>
    </section>
  `;
}

function generateCompetitiveTable(gaps, competitors, firmName) {
  const comp1 = competitors[0] || 'Top Competitor';
  const comp2 = competitors[1] || 'Another Firm';
  
  const checkmark = (hasIt) => hasIt ? '<span class="check">✓</span>' : '<span class="cross">✗</span>';
  const partial = '<span class="partial">◐</span>';
  
  // Safe gap check helper
  const hasGap = (gapName) => gaps && gaps[gapName] && gaps[gapName].hasGap;
  const gapStatus = (gapName) => gaps && gaps[gapName] && gaps[gapName].status;
  
  return `
    <section class="reveal">
      <div class="section-header">
        <span class="section-label">Competitive Reality</span>
        <h2 class="section-title">Who's Winning Right Now</h2>
      </div>
      <table class="competitive-table">
        <thead>
          <tr>
            <th>Capability</th>
            <th>${comp1}</th>
            <th>${comp2}</th>
            <th>YOU</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Google Ads</td>
            <td>${checkmark(true)}</td>
            <td>${checkmark(true)}</td>
            <td>${hasGap('googleAds') ? '<span class="cross">✗ Not Running</span>' : gapStatus('googleAds') === 'blue-ocean' ? '<span class="partial">◐ Blue Ocean</span>' : checkmark(true)}</td>
          </tr>
          <tr>
            <td>Meta Ads (FB/IG/LI)</td>
            <td>${checkmark(true)}</td>
            <td>${checkmark(true)}</td>
            <td>${hasGap('metaAds') ? '<span class="cross">✗ Not Running</span>' : checkmark(true)}</td>
          </tr>
          <tr>
            <td>24/7 Lead Capture</td>
            <td>${checkmark(true)}</td>
            <td>${checkmark(true)}</td>
            <td>${hasGap('support24x7') ? '<span class="cross">✗ Voicemail Only</span>' : checkmark(true)}</td>
          </tr>
          <tr>
            <td>Website Speed (&lt;2s)</td>
            <td>${checkmark(true)}</td>
            <td>${checkmark(true)}</td>
            <td>${hasGap('websiteSpeed') ? '<span class="cross">✗ Slow</span>' : '<span class="check">✓ Fast</span>'}</td>
          </tr>
          <tr>
            <td>Automated Follow-Up</td>
            <td>${checkmark(true)}</td>
            <td>${checkmark(true)}</td>
            <td>${hasGap('crm') ? '<span class="partial">◐ Manual</span>' : checkmark(true)}</td>
          </tr>
        </tbody>
      </table>
      <div class="insight-box">
        <strong>What you have that they don't:</strong> ${firmName}'s unique expertise and reputation.<br><br>
        <strong>What they have that you don't:</strong> The infrastructure to capture leads 24/7, nurture them automatically, and close them faster.
      </div>
    </section>
  `;
}

function generateCalculator(gaps, template, practiceArea) {
  const defaults = template.calculatorDefaults;
  const gapsArray = Object.entries(gaps).filter(([key, gap]) => gap.hasGap);
  
  // Generate service toggles
  let togglesHTML = '';
  const serviceConfig = {
    metaAds: { name: 'Meta Ads (FB/IG/LinkedIn)', desc: 'Capture clients while you sleep', impact: gaps.metaAds.impact },
    googleAds: { name: 'Google Ads Optimization', desc: 'Show up when it matters most', impact: gaps.googleAds.impact },
    support24x7: { name: 'AI Voice + Text Intake (24/7)', desc: 'Never miss another lead', impact: gaps.support24x7.impact },
    websiteSpeed: { name: 'Website Speed Optimization', desc: 'Convert more visitors', impact: gaps.websiteSpeed.impact },
    crm: { name: 'CRM & Follow-Up Automation', desc: 'Systematic nurture that closes', impact: gaps.crm.impact }
  };
  
  for (const [key, gap] of Object.entries(gaps)) {
    if (gap.hasGap && serviceConfig[key]) {
      const svc = serviceConfig[key];
      togglesHTML += `
        <div class="service-toggle" data-service="${key}" data-impact="${svc.impact}">
          <div class="service-toggle-info">
            <span class="service-toggle-name">${svc.name}</span>
            <span class="service-toggle-desc">${svc.desc}</span>
          </div>
          <div class="toggle-switch active" onclick="toggleService('${key}')"></div>
        </div>
      `;
    }
  }
  
  return `
    <div class="calculator-section reveal" id="calculator">
      <div class="calc-header">
        <span class="section-label">Your Numbers</span>
        <h2 class="section-title">See Exactly What You're Missing</h2>
        <p style="color: var(--slate); margin-top: 10px;">Adjust the sliders. Watch the math. These projections are specific to ${practiceArea}.</p>
      </div>

      <div class="calc-grid">
        <div class="calc-inputs">
          <div class="calc-input-group">
            <div class="calc-input-label">
              <span>Monthly Inquiries (All Sources)</span>
              <span class="calc-input-value" id="inquiriesValue">${defaults.inquiries}</span>
            </div>
            <input type="range" class="calc-slider" id="inquiries" min="20" max="200" value="${defaults.inquiries}">
          </div>
          <div class="calc-input-group">
            <div class="calc-input-label">
              <span>After-Hours / Global %</span>
              <span class="calc-input-value" id="afterHoursValue">${defaults.afterHours}%</span>
            </div>
            <input type="range" class="calc-slider" id="afterHours" min="25" max="80" value="${defaults.afterHours}">
          </div>
          <div class="calc-input-group">
            <div class="calc-input-label">
              <span>Average Case Value</span>
              <span class="calc-input-value" id="caseValueValue">$${defaults.caseValue.toLocaleString()}</span>
            </div>
            <input type="range" class="calc-slider" id="caseValue" min="5000" max="100000" value="${defaults.caseValue}" step="1000">
          </div>
          <div class="calc-input-group">
            <div class="calc-input-label">
              <span>Current Close Rate</span>
              <span class="calc-input-value" id="closeRateValue">${defaults.closeRate}%</span>
            </div>
            <input type="range" class="calc-slider" id="closeRate" min="15" max="50" value="${defaults.closeRate}">
          </div>
        </div>
        <div class="calc-results">
          <div class="calc-result-card">
            <div class="calc-result-value danger" id="lostMonthly">$0</div>
            <div class="calc-result-label">Currently Missing/Month</div>
          </div>
          <div class="calc-result-card">
            <div class="calc-result-value success" id="recoverMonthly">$0</div>
            <div class="calc-result-label">Could Recover/Month</div>
          </div>
          <div class="calc-result-card">
            <div class="calc-result-value" style="color: var(--brand-blue);" id="newClients">0</div>
            <div class="calc-result-label">New Clients/Month</div>
          </div>
          <div class="calc-total">
            <div class="calc-total-value" id="annualTotal">$0</div>
            <div class="calc-total-label">Annual Revenue Opportunity</div>
          </div>
        </div>
      </div>

      <div class="service-toggles">
        <h3 style="font-family: 'Fraunces', serif; font-size: 1.2rem; margin-bottom: 20px; color: var(--ink);">Toggle Services to See Impact</h3>
        ${togglesHTML}
      </div>

      <div class="math-section">
        <div class="math-title">📊 The Math (Transparent)</div>
        
        <div class="math-step">
          <div class="math-step-title">Step 1: Your Baseline</div>
          <div class="math-line"><span>Monthly inquiries:</span><span id="mathInquiries">50</span></div>
          <div class="math-line"><span>After-hours %:</span><span id="mathAfterHoursPct">× 45%</span></div>
          <div class="math-line"><span>= After-hours inquiries:</span><span id="mathAfterHoursInq">22.5/mo</span></div>
        </div>

        <div class="math-step">
          <div class="math-step-title">Step 2: The Time Gap</div>
          <div class="math-line"><span>After-hours inquiries/month:</span><span id="mathGlobalInq">22.5</span></div>
          <div class="math-line"><span>Current capture (voicemail ~30%):</span><span id="mathCurrentCapture">6.8</span></div>
          <div class="math-line loss"><span>= Lost to delayed response:</span><span id="mathLost">15.7/mo</span></div>
        </div>

        <div class="math-step">
          <div class="math-step-title">Step 3: Revenue Impact</div>
          <div class="math-line"><span>Lost leads × Close rate × Case value:</span><span></span></div>
          <div class="math-line"><span id="mathCloseRate">× 30%</span><span id="mathCaseValue">× $12,000</span></div>
          <div class="math-line loss total"><span>= MONTHLY TIME LOSS:</span><span id="mathMonthlyLoss">$0</span></div>
        </div>

        <div class="math-step">
          <div class="math-step-title">Step 4: Total Recovery (All Services)</div>
          <div class="math-line" id="mathMetaLine" style="display:none;"><span>Meta Ads:</span><span id="mathMetaRecovery">$0</span></div>
          <div class="math-line" id="mathGoogleLine" style="display:none;"><span>Google Ads:</span><span id="mathGoogleRecovery">$0</span></div>
          <div class="math-line" id="mathAILine" style="display:none;"><span>AI Voice (90% vs 30% capture):</span><span id="mathAIRecovery">$0</span></div>
          <div class="math-line" id="mathCRMLine" style="display:none;"><span>CRM Automation:</span><span id="mathCRMRecovery">$0</span></div>
          <div class="math-line result total"><span>= TOTAL RECOVERY:</span><span id="mathTotalRecovery">$0</span></div>
        </div>
      </div>

      <div class="authority-flex">
        These projections are based on industry benchmarks from ${practiceArea} law firm marketing campaigns.
      </div>
    </div>
  `;
}

function generateAIComparison() {
  return `
    <div class="ai-comparison reveal">
      <div class="ai-comparison-title">Your Lead Capture Options</div>
      <div class="ai-comparison-grid">
        <div class="ai-option voicemail">
          <div class="ai-option-title">❌ Voicemail Only</div>
          <div class="ai-option-features">
            <div class="ai-option-feature">❌ Captures: ~15%</div>
            <div class="ai-option-feature">❌ Response: Next business day</div>
            <div class="ai-option-feature">❌ Languages: 1</div>
            <div class="ai-option-feature">❌ Qualification: None</div>
            <div class="ai-option-feature">❌ After-hours: None</div>
          </div>
        </div>
        <div class="ai-option answering">
          <div class="ai-option-title">⚠️ Contact Form Only</div>
          <div class="ai-option-features">
            <div class="ai-option-feature">⚠️ Captures: ~40%</div>
            <div class="ai-option-feature">⚠️ Response: Email (hours later)</div>
            <div class="ai-option-feature">⚠️ Languages: 1</div>
            <div class="ai-option-feature">⚠️ Voice: None</div>
            <div class="ai-option-feature">⚠️ Booking: Manual callback</div>
          </div>
        </div>
        <div class="ai-option ai">
          <div class="ai-option-title">✅ AI Voice + Text (24/7)</div>
          <div class="ai-option-features">
            <div class="ai-option-feature">✅ Captures: 90%+</div>
            <div class="ai-option-feature">✅ Response: Instant voice + text</div>
            <div class="ai-option-feature">✅ Languages: 30+</div>
            <div class="ai-option-feature">✅ Qualification: Full intake</div>
            <div class="ai-option-feature">✅ Booking: Direct calendar</div>
          </div>
        </div>
      </div>
      <div class="authority-flex">
        AI voice enhancement recovers an average of 50% more leads from existing traffic.
      </div>
    </div>
  `;
}

function generatePlaybook(gaps, practiceArea) {
  const playbookCards = [];
  
  // Meta Ads Playbook
  if (gaps && gaps.metaAds && gaps.metaAds.hasGap) {
    playbookCards.push(`
      <div class="playbook-card">
        <div class="playbook-header">
          <div class="playbook-number">01</div>
          <div class="playbook-title-group">
            <div class="playbook-title">Get Found — Meta Ads</div>
            <div class="playbook-problem">Your competitors are running Facebook, Instagram, and LinkedIn ads 24/7. You're invisible to clients scrolling at night.</div>
          </div>
        </div>
        <div class="playbook-content">
          <div class="playbook-diy">
            <div class="playbook-column-title">🛠️ DIY Fix</div>
            <div class="playbook-steps">
              <div class="playbook-step"><span class="playbook-step-num">1</span>Create Meta Business account & ad accounts</div>
              <div class="playbook-step"><span class="playbook-step-num">2</span>Build custom audiences by location & demographics</div>
              <div class="playbook-step"><span class="playbook-step-num">3</span>Design ad creative (images, video, carousels)</div>
              <div class="playbook-step"><span class="playbook-step-num">4</span>Write ad copy variations (test weekly)</div>
              <div class="playbook-step"><span class="playbook-step-num">5</span>Build landing pages for each practice area</div>
              <div class="playbook-step"><span class="playbook-step-num">6</span>Set up conversion tracking & retargeting</div>
              <div class="playbook-step"><span class="playbook-step-num">7</span>Monitor, test, optimize daily</div>
            </div>
            <div class="playbook-time">
              ⏱️ Setup: 20-30 hrs<br>
              🔄 Ongoing: 10-15 hrs/week FOREVER
            </div>
          </div>
          <div class="playbook-done-for-you">
            <div class="playbook-column-title">✨ We Handle All of This</div>
            <ul class="playbook-dfy-list">
              <li>Complete Meta Ads setup & strategy</li>
              <li>Custom audiences & lookalikes</li>
              <li>Ad creative design (all formats)</li>
              <li>Weekly fresh ad copy</li>
              <li>Landing page creation & optimization</li>
              <li>Conversion tracking setup</li>
              <li>Daily monitoring & optimization</li>
              <li>LinkedIn Ads for B2B clients</li>
              <li>Monthly performance reports</li>
            </ul>
            <div class="playbook-dfy-result">You approve the budget. We make the phone ring.</div>
          </div>
        </div>
      </div>
    `);
  }
  
  // Google Ads Playbook
  if (gaps && gaps.googleAds && gaps.googleAds.hasGap) {
    const isBlueOcean = gaps.googleAds.status === 'blue-ocean';
    playbookCards.push(`
      <div class="playbook-card">
        <div class="playbook-header">
          <div class="playbook-number">02</div>
          <div class="playbook-title-group">
            <div class="playbook-title">Get Found First — Google Ads ${isBlueOcean ? '<span class="blue-ocean-badge">BLUE OCEAN</span>' : ''}</div>
            <div class="playbook-problem">${isBlueOcean ? 'Minimal competition means you can dominate high-intent searches at a fraction of typical cost.' : 'Running ads but leaving money on the table. Wasted spend, wrong keywords, suboptimal landing pages.'}</div>
          </div>
        </div>
        <div class="playbook-content">
          <div class="playbook-diy">
            <div class="playbook-column-title">🛠️ DIY Fix</div>
            <div class="playbook-steps">
              <div class="playbook-step"><span class="playbook-step-num">1</span>${isBlueOcean ? 'Research high-intent keywords (low competition)' : 'Audit current campaigns for wasted spend'}</div>
              <div class="playbook-step"><span class="playbook-step-num">2</span>Review search terms weekly—add negatives</div>
              <div class="playbook-step"><span class="playbook-step-num">3</span>Target high-intent keywords specific to ${practiceArea}</div>
              <div class="playbook-step"><span class="playbook-step-num">4</span>Build dedicated landing pages</div>
              <div class="playbook-step"><span class="playbook-step-num">5</span>Set up proper conversion tracking</div>
              <div class="playbook-step"><span class="playbook-step-num">6</span>Test ad copy variations weekly</div>
              <div class="playbook-step"><span class="playbook-step-num">7</span>Adjust bids by device, time, location</div>
            </div>
            <div class="playbook-time">
              ⏱️ Audit: 12-20 hrs<br>
              🔄 Ongoing: 8-12 hrs/week FOREVER
            </div>
          </div>
          <div class="playbook-done-for-you">
            <div class="playbook-column-title">✨ We Handle All of This</div>
            <ul class="playbook-dfy-list">
              <li>Full account ${isBlueOcean ? 'setup' : 'audit'} & strategy</li>
              <li>Keyword research (500+ terms analyzed)</li>
              <li>Negative keyword optimization</li>
              <li>Landing page optimization</li>
              <li>Ad copy testing (weekly)</li>
              <li>Conversion tracking setup</li>
              <li>Bid management & budget optimization</li>
              <li>Competitor monitoring</li>
              <li>Monthly performance reports</li>
            </ul>
            <div class="playbook-dfy-result">${isBlueOcean ? "Dominate the blue ocean. Capture leads your competitors don't even know exist." : "Same budget. Better results. More qualified consultations."}</div>
          </div>
        </div>
      </div>
    `);
  }
  
  // 24/7 AI Voice Playbook
  if (gaps && gaps.support24x7 && gaps.support24x7.hasGap) {
    const isCritical = gaps.support24x7.status === 'critical';
    playbookCards.push(`
      <div class="playbook-card">
        <div class="playbook-header">
          <div class="playbook-number">03</div>
          <div class="playbook-title-group">
            <div class="playbook-title">Get Answered — 24/7 AI Voice ${isCritical ? '<span class="critical-badge">CRITICAL</span>' : ''}</div>
            <div class="playbook-problem">73% of ${practiceArea} leads come outside business hours. Voicemail loses to instant answers every time.</div>
          </div>
        </div>
        <div class="playbook-content">
          <div class="playbook-diy">
            <div class="playbook-column-title">🛠️ DIY Fix</div>
            <div class="playbook-steps">
              <div class="playbook-step"><span class="playbook-step-num">1</span>Research AI voice platforms</div>
              <div class="playbook-step"><span class="playbook-step-num">2</span>Write intake scripts for each case type</div>
              <div class="playbook-step"><span class="playbook-step-num">3</span>Configure qualification logic</div>
              <div class="playbook-step"><span class="playbook-step-num">4</span>Set up multilingual support</div>
              <div class="playbook-step"><span class="playbook-step-num">5</span>Integrate with calendar for booking</div>
              <div class="playbook-step"><span class="playbook-step-num">6</span>Connect to CRM for lead delivery</div>
              <div class="playbook-step"><span class="playbook-step-num">7</span>Train and test extensively</div>
            </div>
            <div class="playbook-time">
              ⏱️ Setup: 15-25 hrs<br>
              🔄 Ongoing: 4-6 hrs/week
            </div>
          </div>
          <div class="playbook-done-for-you">
            <div class="playbook-column-title">✨ We Handle All of This</div>
            <ul class="playbook-dfy-list">
              <li>AI voice system setup</li>
              <li>Custom intake scripts for ${practiceArea}</li>
              <li>Qualification logic (urgency, budget, case type)</li>
              <li>Calendar integration for direct booking</li>
              <li>CRM integration for lead delivery</li>
              <li>30+ language support</li>
              <li>Call recording & transcription</li>
              <li>SMS follow-up automation</li>
              <li>Ongoing optimization</li>
            </ul>
            <div class="playbook-dfy-result">Never miss another lead. Capture 90% instead of 30%.</div>
          </div>
        </div>
      </div>
    `);
  }
  
  // CRM Automation Playbook
  if (gaps && gaps.crm && gaps.crm.hasGap) {
    playbookCards.push(`
      <div class="playbook-card">
        <div class="playbook-header">
          <div class="playbook-number">04</div>
          <div class="playbook-title-group">
            <div class="playbook-title">Get Systematic — CRM Automation</div>
            <div class="playbook-problem">Manual follow-up loses 40% of warm leads. High-value clients need consistent nurture—automation never forgets.</div>
          </div>
        </div>
        <div class="playbook-content">
          <div class="playbook-diy">
            <div class="playbook-column-title">🛠️ DIY Fix</div>
            <div class="playbook-steps">
              <div class="playbook-step"><span class="playbook-step-num">1</span>Choose CRM (GoHighLevel, HubSpot, etc.)</div>
              <div class="playbook-step"><span class="playbook-step-num">2</span>Design intake workflows</div>
              <div class="playbook-step"><span class="playbook-step-num">3</span>Write email sequences (multiple case types)</div>
              <div class="playbook-step"><span class="playbook-step-num">4</span>Set up SMS automation</div>
              <div class="playbook-step"><span class="playbook-step-num">5</span>Create lead scoring rules</div>
              <div class="playbook-step"><span class="playbook-step-num">6</span>Integrate with calendar & phone</div>
              <div class="playbook-step"><span class="playbook-step-num">7</span>Train staff on new system</div>
            </div>
            <div class="playbook-time">
              ⏱️ Setup: 20-35 hrs<br>
              🔄 Ongoing: 3-5 hrs/week
            </div>
          </div>
          <div class="playbook-done-for-you">
            <div class="playbook-column-title">✨ We Handle All of This</div>
            <ul class="playbook-dfy-list">
              <li>CRM setup & configuration</li>
              <li>Email automation sequences</li>
              <li>SMS follow-up workflows</li>
              <li>Lead scoring & routing</li>
              <li>Pipeline management</li>
              <li>Calendar integration</li>
              <li>Staff training included</li>
              <li>Ongoing optimization & support</li>
            </ul>
            <div class="playbook-dfy-result">Every lead gets systematic nurture. Close rates improve 15-30%.</div>
          </div>
        </div>
      </div>
    `);
  }
  
  if (playbookCards.length === 0) return '';
  
  return `
    <section class="reveal">
      <div class="section-header">
        <span class="section-label">The Playbook</span>
        <h2 class="section-title">How to Fix Each Gap</h2>
        <p class="section-subtitle">DIY or done-for-you. Your choice.</p>
      </div>
      ${playbookCards.join('')}
    </section>
  `;
}

function generateVisionBox(credentials, firmName) {
  const cred1 = credentials[0] || 'Top-rated law firm';
  const cred2 = credentials[1] || 'Proven track record';
  
  return `
    <div class="vision-box reveal">
      <div class="vision-credential">${cred1}. ${cred2}. You've built something exceptional.</div>
      <div class="vision-quote">"The best firms don't compete on expertise anymore—they compete on availability and speed."</div>
      <div class="vision-list">
        <div class="vision-list-item">✓ Your expertise is world-class</div>
        <div class="vision-list-item">✓ Your credentials are impressive</div>
        <div class="vision-list-item">✓ Your results speak for themselves</div>
        <div class="vision-list-item">✓ But if clients can't reach you at 2 AM, they'll never know</div>
      </div>
    </div>
  `;
}

function generateCTA(monthlyGain, template) {
  return `
    <section class="cta-section" id="cta">
      <div class="cta-urgency">Every Day = ~$${Math.round(monthlyGain / 30).toLocaleString()} Lost</div>
      <h2 class="cta-title">Let's Capture This Revenue Together</h2>
      <p class="cta-subtitle">
        Book a 15-minute strategy call. We'll validate these numbers, walk through your specific gaps, 
        and show you exactly how we'd execute this playbook for you.
      </p>
      
      <div class="cta-columns">
        <div class="cta-column">
          <div class="cta-column-title">What You'll Get</div>
          <div class="cta-column-list">
            <div class="cta-column-item">✓ Custom action plan</div>
            <div class="cta-column-item">✓ Revenue projections validated</div>
            <div class="cta-column-item">✓ Timeline & next steps</div>
            <div class="cta-column-item">✓ Zero commitment required</div>
          </div>
        </div>
        <div class="cta-column">
          <div class="cta-column-title">What We Won't Do</div>
          <div class="cta-column-list">
            <div class="cta-column-item">✓ No hard sell</div>
            <div class="cta-column-item">✓ No long-term contracts</div>
            <div class="cta-column-item">✓ No wasted time</div>
            <div class="cta-column-item">✓ If it's not a fit, we'll tell you</div>
          </div>
        </div>
      </div>

      <div class="why-works">
        <div class="why-works-title">Why This Works</div>
        <div class="why-works-grid">
          <div>
            <div class="why-works-col-title">We've Done This Before</div>
            <div class="why-works-col-list">
              <div class="why-works-col-item">40+ law firms as clients</div>
              <div class="why-works-col-item">Results within 90-120 days</div>
              <div class="why-works-col-item">Average 3.2x ROAS on Meta Ads</div>
              <div class="why-works-col-item">15-30% close rate improvement</div>
            </div>
          </div>
          <div>
            <div class="why-works-col-title">We Handle Everything</div>
            <div class="why-works-col-list">
              <div class="why-works-col-item">Setup, strategy, execution</div>
              <div class="why-works-col-item">Daily monitoring & optimization</div>
              <div class="why-works-col-item">Monthly reporting & reviews</div>
              <div class="why-works-col-item">You approve, we execute</div>
            </div>
          </div>
        </div>
      </div>

      <div class="booking-widget-container">
        <h3 style="font-family: 'Fraunces', serif; font-size: 1.5rem; margin-bottom: 20px; color: var(--white);">Book Your Strategy Call — 15 Minutes</h3>
        <iframe src="https://api.mortarmetrics.com/widget/booking/7aCMl8OqQAOE3NfjfUGT" style="width: 100%; border: none; overflow: hidden; min-height: 600px; border-radius: 12px;" scrolling="no" id="mortarmetrics-booking-widget">
        </iframe>
        <script src="https://api.mortarmetrics.com/js/form_embed.js" type="text/javascript"></script>
      </div>

      <div class="cta-guarantee">
        <strong>What to expect:</strong> We'll review your current setup, validate this revenue projection, 
        and show you exactly what the first 90 days would look like. Month-to-month. No long-term contracts. Results-focused.
      </div>

      <div class="authority-flex">
        "We've seen firms wait 6 months before taking action. The ones who act fast capture the market. Don't let your competitors get there first." — Yaseer Choudhury, Founder
      </div>
    </section>
  `;
}

// ============================================================================
// CSS & JAVASCRIPT
// ============================================================================

function getCSS() {
  // Using the exact CSS from SobirovsLaw with minor adjustments
  return `<style>
    :root {
      --ink: #0f172a;
      --ink-soft: #1e293b;
      --slate: #475569;
      --slate-light: #64748b;
      --muted: #94a3b8;
      --border: #e2e8f0;
      --border-light: #f1f5f9;
      --warm-white: #f8fafc;
      --white: #ffffff;
      --brand-primary: #1e3a5f;
      --brand-blue: #2563eb;
      --brand-light: rgba(37,99,235,0.08);
      --accent: #3b82f6;
      --accent-light: #60a5fa;
      --success: #059669;
      --success-light: #d1fae5;
      --danger: #dc2626;
      --danger-light: #fef2f2;
      --gold: #f59e0b;
      --gold-light: #fef3c7;
      --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: 'Outfit', -apple-system, system-ui, sans-serif; background: var(--warm-white); color: var(--ink); line-height: 1.65; font-size: 16px; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
    h1, h2, h3, .display { font-family: 'Fraunces', Georgia, serif; font-weight: 500; }

    /* Background */
    .bg-grid { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-image: linear-gradient(rgba(37,99,235,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.03) 1px, transparent 1px); background-size: 60px 60px; pointer-events: none; z-index: 0; }
    .orbs { position: fixed; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden; pointer-events: none; z-index: 0; }
    .orb { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.1; }
    .orb-1 { width: 600px; height: 600px; left: -200px; top: -100px; background: var(--brand-blue); }
    .orb-2 { width: 400px; height: 400px; right: -150px; bottom: 10%; background: var(--accent); }
    .scroll-indicator { position: fixed; top: 0; left: 0; height: 3px; background: linear-gradient(90deg, var(--brand-blue), var(--accent)); z-index: 9999; width: 0%; }
    .container { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 0 32px; }
    @media (max-width: 600px) { .container { padding: 0 20px; } }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: center; padding: 24px 0; border-bottom: 1px solid var(--border); margin-bottom: 32px; flex-wrap: wrap; gap: 24px; }
    .brand-mark { display: flex; align-items: center; gap: 14px; }
    .logo { width: 56px; height: 56px; background: var(--brand-blue); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; color: white; transition: all 0.4s var(--ease-out-expo); }
    .logo:hover { transform: scale(1.08) rotate(3deg); box-shadow: 0 12px 40px rgba(37,99,235,0.3); }
    .brand-text { display: flex; flex-direction: column; }
    .brand-name { font-family: 'Fraunces', serif; font-size: 1.4rem; font-weight: 500; color: var(--ink); }
    .brand-sub { font-size: 0.7rem; color: var(--slate); text-transform: uppercase; letter-spacing: 2px; font-weight: 600; }
    .prepared-for { text-align: right; }
    .prepared-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 2px; color: var(--slate-light); margin-bottom: 6px; font-weight: 500; }
    .prepared-name { font-family: 'Fraunces', serif; font-size: 1.35rem; color: var(--ink); font-weight: 500; }
    .prepared-firm { font-size: 0.9rem; color: var(--brand-blue); font-weight: 500; }
    .prepared-date { font-size: 0.8rem; color: var(--slate-light); margin-top: 6px; }

    /* Hero */
    .hero { text-align: center; padding: 20px 0 40px; }
    .hero-title { font-size: clamp(2rem, 5vw, 3rem); font-weight: 500; line-height: 1.2; color: var(--ink); margin-bottom: 20px; }
    .hero-title em { font-style: italic; background: linear-gradient(135deg, var(--brand-blue) 0%, var(--accent) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .hero-subtitle { font-size: 1.1rem; color: var(--slate); max-width: 700px; margin: 0 auto 32px; line-height: 1.7; }

    /* Hero Stats */
    .hero-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 32px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
    @media (max-width: 768px) { .hero-stats { grid-template-columns: repeat(2, 1fr); } }
    .hero-stat { text-align: center; padding: 20px 12px; background: var(--white); border: 1px solid var(--border); border-radius: 16px; transition: all 0.4s var(--ease-out-expo); }
    .hero-stat:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,0,0,0.06); border-color: var(--accent); }
    .hero-stat-value { font-family: 'Fraunces', serif; font-size: 2rem; font-weight: 600; line-height: 1; margin-bottom: 8px; }
    .hero-stat-value.danger { color: var(--danger); }
    .hero-stat-value.success { color: var(--success); }
    .hero-stat-value.gold { color: var(--gold); }
    .hero-stat-label { font-size: 0.7rem; color: var(--slate); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }

    /* Quick Jump CTA */
    .quick-cta { display: flex; justify-content: center; gap: 16px; margin: 32px 0; flex-wrap: wrap; }
    .quick-cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 100px; font-weight: 600; font-size: 0.95rem; text-decoration: none; transition: all 0.3s var(--ease-out-expo); }
    .quick-cta-btn.primary { background: var(--ink); color: white; }
    .quick-cta-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(0,0,0,0.2); }
    .quick-cta-btn.secondary { background: var(--white); color: var(--ink); border: 2px solid var(--border); }
    .quick-cta-btn.secondary:hover { border-color: var(--accent); transform: translateY(-2px); }

    /* Sections */
    section { padding: 60px 0; }
    .section-header { text-align: center; margin-bottom: 40px; }
    .section-label { display: inline-block; padding: 10px 22px; background: var(--ink); color: var(--white); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 2px; border-radius: 100px; margin-bottom: 18px; font-weight: 600; }
    .section-title { font-size: clamp(1.6rem, 4vw, 2.2rem); color: var(--ink); margin-bottom: 12px; }
    .section-subtitle { font-size: 1rem; color: var(--slate); max-width: 600px; margin: 0 auto; line-height: 1.7; }

    /* Cards */
    .card { background: var(--white); border: 1px solid var(--border); border-radius: 20px; padding: 32px; transition: all 0.4s var(--ease-out-expo); }
    .card:hover { transform: translateY(-6px); box-shadow: 0 24px 48px rgba(0,0,0,0.08); border-color: var(--accent); }

    /* Big Opportunity Box */
    .opportunity-box { background: linear-gradient(135deg, var(--success), #047857); border-radius: 24px; padding: 48px; text-align: center; margin: 40px 0; position: relative; overflow: hidden; }
    .opportunity-box::before { content: ''; position: absolute; top: -50%; right: -30%; width: 80%; height: 200%; background: radial-gradient(ellipse, rgba(255,255,255,0.1) 0%, transparent 50%); pointer-events: none; }
    .opportunity-label { font-size: 0.85rem; color: rgba(255,255,255,0.85); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; }
    .opportunity-value { font-family: 'Fraunces', serif; font-size: clamp(3.5rem, 10vw, 6rem); font-weight: 600; color: white; line-height: 1; margin-bottom: 16px; text-shadow: 0 4px 30px rgba(0,0,0,0.2); }
    .opportunity-context { font-size: 1.2rem; color: rgba(255,255,255,0.9); }

    /* Gap Summary */
    .gap-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 40px 0; }
    @media (max-width: 900px) { .gap-summary { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) { .gap-summary { grid-template-columns: 1fr; } }
    .gap-card { background: var(--white); border: 2px solid var(--border); border-radius: 20px; padding: 28px; text-align: center; transition: all 0.3s var(--ease-out-expo); }
    .gap-card:hover { border-color: var(--danger); transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,0,0,0.06); }
    .gap-icon { font-size: 2.5rem; margin-bottom: 16px; }
    .gap-title { font-family: 'Fraunces', serif; font-size: 1.2rem; color: var(--ink); margin-bottom: 8px; }
    .gap-impact { font-size: 1.4rem; font-weight: 700; color: var(--danger); margin-bottom: 8px; }
    .gap-desc { font-size: 0.85rem; color: var(--slate); }

    /* Badges */
    .blue-ocean-badge { display: inline-block; padding: 4px 12px; background: linear-gradient(135deg, #0ea5e9, #06b6d4); color: white; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-radius: 100px; margin-left: 8px; }
    .critical-badge { display: inline-block; padding: 4px 12px; background: var(--danger); color: white; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-radius: 100px; margin-left: 8px; }

    /* Story Mini */
    .story-mini { background: var(--white); border-left: 4px solid var(--danger); padding: 24px 28px; margin: 40px 0; border-radius: 0 16px 16px 0; }
    .story-mini-text { font-size: 1.05rem; color: var(--ink); margin-bottom: 8px; }
    .story-mini-outcome { font-size: 0.9rem; color: var(--slate); font-style: italic; }

    /* Market Stats */
    .market-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 32px 0; }
    @media (max-width: 768px) { .market-stats { grid-template-columns: repeat(2, 1fr); } }
    .market-stat { background: var(--white); border: 1px solid var(--border); border-radius: 16px; padding: 24px 16px; text-align: center; }
    .market-stat-value { font-family: 'Fraunces', serif; font-size: 1.7rem; font-weight: 600; color: var(--brand-blue); margin-bottom: 6px; }
    .market-stat-label { font-size: 0.7rem; color: var(--slate); text-transform: uppercase; letter-spacing: 1px; font-weight: 500; }

    /* Competitive Table */
    .competitive-table { width: 100%; border-collapse: collapse; margin: 32px 0; background: var(--white); border-radius: 16px; overflow: hidden; border: 1px solid var(--border); }
    .competitive-table th { background: var(--ink); color: var(--white); padding: 16px 18px; text-align: left; font-size: 0.85rem; font-weight: 600; }
    .competitive-table td { padding: 16px 18px; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
    .competitive-table tr:last-child td { border-bottom: none; }
    .competitive-table tr:hover td { background: var(--warm-white); }
    .check { color: var(--success); font-weight: 700; }
    .cross { color: var(--danger); font-weight: 700; }
    .partial { color: var(--gold); font-weight: 700; }
    .insight-box { background: var(--warm-white); border-radius: 16px; padding: 24px; margin-top: 24px; font-size: 0.95rem; color: var(--ink); line-height: 1.7; }

    /* Speed Highlight */
    .speed-highlight { background: linear-gradient(135deg, var(--gold), #d97706); border-radius: 20px; padding: 32px; display: flex; align-items: center; gap: 28px; margin: 40px 0; color: white; }
    @media (max-width: 700px) { .speed-highlight { flex-direction: column; text-align: center; } }
    .speed-highlight-stat { font-family: 'Fraunces', serif; font-size: 3.5rem; font-weight: 700; white-space: nowrap; }
    .speed-highlight-text { font-size: 1.05rem; line-height: 1.6; }

    /* Calculator */
    .calculator-section { background: var(--white); border: 2px solid var(--accent); border-radius: 24px; padding: 40px; margin: 60px 0; box-shadow: 0 20px 60px rgba(0,0,0,0.04); }
    @media (max-width: 600px) { .calculator-section { padding: 28px 20px; } }
    .calc-header { text-align: center; margin-bottom: 40px; }
    .calc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; }
    @media (max-width: 900px) { .calc-grid { grid-template-columns: 1fr; } }
    .calc-inputs { display: flex; flex-direction: column; gap: 24px; }
    .calc-input-group { display: flex; flex-direction: column; gap: 10px; }
    .calc-input-label { font-size: 0.85rem; font-weight: 600; color: var(--ink); display: flex; justify-content: space-between; align-items: center; }
    .calc-input-value { font-family: 'Fraunces', serif; font-size: 1.3rem; color: var(--brand-blue); font-weight: 600; }
    .calc-slider { width: 100%; height: 8px; border-radius: 4px; background: var(--border); -webkit-appearance: none; cursor: pointer; }
    .calc-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: var(--ink); cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
    .calc-results { display: flex; flex-direction: column; gap: 16px; }
    .calc-result-card { background: var(--warm-white); border: 1px solid var(--border); border-radius: 16px; padding: 24px; text-align: center; transition: all 0.3s var(--ease-out-expo); }
    .calc-result-card:hover { border-color: var(--accent); transform: translateY(-3px); }
    .calc-result-value { font-family: 'Fraunces', serif; font-size: 2rem; font-weight: 600; }
    .calc-result-value.danger { color: var(--danger); }
    .calc-result-value.success { color: var(--success); }
    .calc-result-label { font-size: 0.7rem; color: var(--slate); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin-top: 6px; }
    .calc-total { background: linear-gradient(135deg, var(--success), #047857); border-radius: 18px; padding: 28px; text-align: center; margin-top: 8px; }
    .calc-total-value { font-family: 'Fraunces', serif; font-size: 2.5rem; font-weight: 600; color: var(--white); }
    .calc-total-label { font-size: 0.75rem; color: rgba(255,255,255,0.85); text-transform: uppercase; letter-spacing: 2px; margin-top: 6px; }

    /* Service Toggles */
    .service-toggles { margin-top: 36px; padding-top: 36px; border-top: 1px solid var(--border); }
    .service-toggle { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--border-light); }
    .service-toggle:last-child { border-bottom: none; }
    .service-toggle-info { display: flex; flex-direction: column; gap: 4px; }
    .service-toggle-name { font-weight: 600; color: var(--ink); font-size: 0.95rem; }
    .service-toggle-desc { font-size: 0.8rem; color: var(--slate); }
    .toggle-switch { position: relative; width: 56px; height: 30px; background: var(--border); border-radius: 30px; cursor: pointer; transition: all 0.3s; }
    .toggle-switch.active { background: var(--success); }
    .toggle-switch::after { content: ''; position: absolute; width: 24px; height: 24px; background: white; border-radius: 50%; top: 3px; left: 3px; transition: all 0.3s; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
    .toggle-switch.active::after { left: 29px; }

    /* Math Section */
    .math-section { margin-top: 40px; padding: 32px; background: var(--warm-white); border-radius: 16px; border: 1px solid var(--border); }
    .math-title { font-family: 'Fraunces', serif; font-size: 1.2rem; color: var(--ink); margin-bottom: 24px; display: flex; align-items: center; gap: 10px; }
    .math-step { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
    .math-step:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    .math-step-title { font-weight: 700; color: var(--brand-blue); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .math-line { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 0.9rem; }
    .math-line.total { font-weight: 700; color: var(--ink); font-size: 1rem; padding-top: 12px; border-top: 1px solid var(--border); margin-top: 8px; }
    .math-line.result { color: var(--success); font-weight: 700; }
    .math-line.loss { color: var(--danger); }

    /* AI Comparison */
    .ai-comparison { margin: 50px 0; background: var(--white); border: 2px solid var(--accent); border-radius: 20px; padding: 32px; }
    .ai-comparison-title { font-family: 'Fraunces', serif; font-size: 1.3rem; color: var(--ink); margin-bottom: 24px; text-align: center; }
    .ai-comparison-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    @media (max-width: 800px) { .ai-comparison-grid { grid-template-columns: 1fr; } }
    .ai-option { padding: 24px; border-radius: 16px; text-align: center; }
    .ai-option.voicemail { background: var(--danger-light); }
    .ai-option.answering { background: var(--gold-light); }
    .ai-option.ai { background: var(--success-light); border: 2px solid var(--success); }
    .ai-option-title { font-weight: 700; font-size: 0.95rem; margin-bottom: 16px; color: var(--ink); }
    .ai-option-features { text-align: left; display: flex; flex-direction: column; gap: 8px; }
    .ai-option-feature { font-size: 0.8rem; color: var(--slate); display: flex; align-items: flex-start; gap: 8px; }

    /* Playbook */
    .playbook-card { background: var(--white); border: 1px solid var(--border); border-radius: 20px; padding: 28px; margin-bottom: 28px; transition: all 0.4s var(--ease-out-expo); }
    .playbook-card:hover { transform: translateY(-4px); box-shadow: 0 20px 48px rgba(0,0,0,0.06); border-color: var(--accent); }
    .playbook-header { display: flex; align-items: flex-start; gap: 18px; margin-bottom: 24px; }
    .playbook-number { width: 48px; height: 48px; min-width: 48px; background: linear-gradient(135deg, var(--brand-primary), var(--accent)); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; }
    .playbook-title-group { flex: 1; }
    .playbook-title { font-family: 'Fraunces', serif; font-size: 1.3rem; color: var(--ink); margin-bottom: 6px; }
    .playbook-problem { font-size: 0.9rem; color: var(--slate); }
    .playbook-content { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 800px) { .playbook-content { grid-template-columns: 1fr; } }
    .playbook-diy { background: var(--warm-white); border-radius: 14px; padding: 22px; }
    .playbook-done-for-you { background: var(--brand-light); border-radius: 14px; padding: 22px; border: 1px solid rgba(37,99,235,0.15); }
    .playbook-column-title { font-weight: 700; font-size: 0.85rem; color: var(--ink); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
    .playbook-steps { display: flex; flex-direction: column; gap: 8px; }
    .playbook-step { font-size: 0.8rem; color: var(--slate); display: flex; align-items: flex-start; gap: 10px; line-height: 1.5; }
    .playbook-step-num { width: 18px; height: 18px; min-width: 18px; background: var(--brand-blue); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; margin-top: 2px; }
    .playbook-time { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--slate); display: flex; flex-direction: column; gap: 4px; }
    .playbook-dfy-list { list-style: none; padding: 0; margin: 0 0 14px 0; }
    .playbook-dfy-list li { padding: 6px 0; font-size: 0.8rem; color: var(--ink); display: flex; align-items: flex-start; gap: 8px; line-height: 1.4; }
    .playbook-dfy-list li::before { content: "✓"; color: var(--success); font-weight: 700; }
    .playbook-dfy-result { font-size: 0.85rem; font-weight: 600; color: var(--brand-primary); margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }

    /* Vision */
    .vision-box { background: linear-gradient(135deg, var(--ink), var(--brand-primary)); border-radius: 24px; padding: 44px; color: white; text-align: center; margin: 50px 0; position: relative; overflow: hidden; }
    .vision-box::before { content: ''; position: absolute; top: -50%; right: -30%; width: 80%; height: 200%; background: radial-gradient(ellipse, rgba(255,255,255,0.05) 0%, transparent 50%); pointer-events: none; }
    .vision-credential { font-size: 1rem; color: rgba(255,255,255,0.85); margin-bottom: 20px; line-height: 1.7; }
    .vision-quote { font-family: 'Fraunces', serif; font-size: 1.4rem; font-style: italic; margin-bottom: 28px; position: relative; }
    .vision-list { display: flex; flex-direction: column; gap: 10px; max-width: 500px; margin: 0 auto; text-align: left; }
    .vision-list-item { display: flex; align-items: center; gap: 12px; font-size: 0.95rem; color: rgba(255,255,255,0.9); }

    /* CTA */
    .cta-section { background: var(--ink); border-radius: 24px; padding: 60px 44px; text-align: center; margin: 60px 0; position: relative; overflow: hidden; }
    .cta-section::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 20% 30%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(96,165,250,0.1) 0%, transparent 40%); pointer-events: none; }
    .cta-urgency { font-family: 'Fraunces', serif; font-size: 1.8rem; color: var(--danger); background: var(--white); display: inline-block; padding: 14px 28px; border-radius: 12px; margin-bottom: 28px; }
    .cta-title { font-family: 'Fraunces', serif; font-size: clamp(1.6rem, 4vw, 2.2rem); color: var(--white); margin-bottom: 14px; }
    .cta-subtitle { font-size: 1rem; color: rgba(255,255,255,0.8); margin-bottom: 36px; max-width: 550px; margin-left: auto; margin-right: auto; }
    .cta-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-bottom: 36px; text-align: left; max-width: 650px; margin-left: auto; margin-right: auto; }
    @media (max-width: 700px) { .cta-columns { grid-template-columns: 1fr; } }
    .cta-column { background: rgba(255,255,255,0.05); border-radius: 16px; padding: 22px; border: 1px solid rgba(255,255,255,0.1); }
    .cta-column-title { font-weight: 700; font-size: 0.8rem; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px; }
    .cta-column-list { display: flex; flex-direction: column; gap: 8px; }
    .cta-column-item { font-size: 0.9rem; color: rgba(255,255,255,0.9); display: flex; align-items: center; gap: 8px; }
    .why-works { background: rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; margin: 36px 0; border: 1px solid rgba(255,255,255,0.1); }
    .why-works-title { font-family: 'Fraunces', serif; font-size: 1.2rem; color: var(--white); margin-bottom: 20px; }
    .why-works-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 600px) { .why-works-grid { grid-template-columns: 1fr; } }
    .why-works-col-title { font-size: 0.75rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
    .why-works-col-list { display: flex; flex-direction: column; gap: 8px; }
    .why-works-col-item { font-size: 0.9rem; color: rgba(255,255,255,0.85); }
    .cta-guarantee { font-size: 0.85rem; color: rgba(255,255,255,0.7); margin-top: 24px; }
    .authority-flex { background: var(--warm-white); border-radius: 12px; padding: 18px 22px; font-size: 0.85rem; color: var(--slate); font-style: italic; margin-top: 24px; text-align: center; }

    /* Booking Widget Container */
    .booking-widget-container { background: rgba(255,255,255,0.05); border-radius: 20px; padding: 28px; margin: 28px 0; border: 1px solid rgba(255,255,255,0.1); }

    /* Footer */
    .footer { text-align: center; padding: 40px 0 24px; border-top: 1px solid var(--border); margin-top: 60px; }
    .footer-brand { display: flex; justify-content: center; align-items: center; gap: 12px; margin-bottom: 16px; }
    .footer-logo { width: 40px; height: 40px; background: var(--brand-blue); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 14px; color: var(--white); font-weight: 600; }
    .footer-name { font-family: 'Fraunces', serif; font-size: 1.15rem; color: var(--ink); }

    /* Animations */
    .reveal { opacity: 0; transform: translateY(30px); transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
    .reveal.visible { opacity: 1; transform: translateY(0); }
  </style>`;
}

function getBackground() {
  return `
    <div class="scroll-indicator" id="scrollIndicator"></div>
    <div class="bg-grid"></div>
    <div class="orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>
  `;
}

function getHeader(prospectName, firmName) {
  return `
    <header class="header">
      <div class="brand-mark">
        <div class="logo">M</div>
        <div class="brand-text">
          <div class="brand-name">Mortar Metrics</div>
          <div class="brand-sub">Performance Marketing</div>
        </div>
      </div>
      <div class="prepared-for">
        <div class="prepared-label">Marketing Gap Analysis For</div>
        <div class="prepared-name">${prospectName}</div>
        <div class="prepared-firm">${firmName}</div>
        <div class="prepared-date">${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
      </div>
    </header>
  `;
}

function getFooter() {
  return `
    <footer class="footer">
      <div class="footer-brand">
        <div class="footer-logo">M</div>
        <div class="footer-name">Mortar Metrics</div>
      </div>
      <p style="margin-top: 16px; color: var(--slate); font-size: 0.9rem;">
        <strong>Yaseer Choudhury</strong> | Founder
      </p>
      <p style="margin-top: 10px;">
        <a href="https://mortarmetrics.com/" style="color: var(--brand-blue); text-decoration: none;">mortarmetrics.com</a> | 
        <a href="https://www.linkedin.com/in/yaseer-choudhury/" style="color: var(--brand-blue); text-decoration: none;">LinkedIn</a>
      </p>
      <p style="margin-top: 20px; font-size: 0.85rem; color: #adb5bd;">
        Revenue projections based on industry benchmarks from 40+ law firm campaigns. 
        Generated ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
      </p>
    </footer>
  `;
}

function getJavaScript() {
  return `
  <script>
    // ============================================================================
    // SCROLL INDICATOR
    // ============================================================================
    window.addEventListener('scroll', () => {
      const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      document.getElementById('scrollIndicator').style.width = scrolled + '%';
    });

    // ============================================================================
    // REVEAL ANIMATIONS
    // ============================================================================
    const reveals = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    reveals.forEach(reveal => revealObserver.observe(reveal));

    // ============================================================================
    // CALCULATOR LOGIC
    // ============================================================================
    const inquiries = document.getElementById('inquiries');
    const afterHours = document.getElementById('afterHours');
    const caseValue = document.getElementById('caseValue');
    const closeRate = document.getElementById('closeRate');

    // Service impacts (set from PHP data)
    const serviceImpacts = {};
    document.querySelectorAll('.service-toggle').forEach(toggle => {
      const service = toggle.dataset.service;
      const impact = parseFloat(toggle.dataset.impact) || 0;
      serviceImpacts[service] = {
        active: true,
        impact: impact
      };
    });

    function formatCurrency(num) {
      return '$' + Math.round(num).toLocaleString();
    }

    function calculate() {
      // Get base values
      const baseInquiries = parseInt(inquiries.value);
      const afterHoursPct = parseInt(afterHours.value) / 100;
      const avgCaseValue = parseInt(caseValue.value);
      const closeRatePct = parseInt(closeRate.value) / 100;

      // Update displays
      document.getElementById('inquiriesValue').textContent = baseInquiries;
      document.getElementById('afterHoursValue').textContent = Math.round(afterHoursPct * 100) + '%';
      document.getElementById('caseValueValue').textContent = formatCurrency(avgCaseValue);
      document.getElementById('closeRateValue').textContent = Math.round(closeRatePct * 100) + '%';

      // Calculate after-hours inquiries
      const afterHoursInquiries = baseInquiries * afterHoursPct;
      const currentCapture = afterHoursInquiries * 0.30; // 30% capture with voicemail
      const lostLeads = afterHoursInquiries - currentCapture;

      // Calculate loss from time gap
      const timeLoss = lostLeads * closeRatePct * avgCaseValue;

      // Calculate recovery from all active services
      let totalRecovery = 0;
      let metaRecovery = 0, googleRecovery = 0, aiRecovery = 0, crmRecovery = 0;

      if (serviceImpacts.metaAds && serviceImpacts.metaAds.active) {
        metaRecovery = serviceImpacts.metaAds.impact * 1.4;
        totalRecovery += metaRecovery;
        document.getElementById('mathMetaLine').style.display = 'flex';
        document.getElementById('mathMetaRecovery').textContent = formatCurrency(metaRecovery);
      } else {
        document.getElementById('mathMetaLine').style.display = 'none';
      }

      if (serviceImpacts.googleAds && serviceImpacts.googleAds.active) {
        googleRecovery = serviceImpacts.googleAds.impact * 1.4;
        totalRecovery += googleRecovery;
        document.getElementById('mathGoogleLine').style.display = 'flex';
        document.getElementById('mathGoogleRecovery').textContent = formatCurrency(googleRecovery);
      } else {
        document.getElementById('mathGoogleLine').style.display = 'none';
      }

      if (serviceImpacts.support24x7 && serviceImpacts.support24x7.active) {
        // AI improves capture from 30% to 90%
        const improvedCapture = afterHoursInquiries * 0.90;
        const additionalLeads = improvedCapture - currentCapture;
        aiRecovery = additionalLeads * closeRatePct * avgCaseValue;
        totalRecovery += aiRecovery;
        document.getElementById('mathAILine').style.display = 'flex';
        document.getElementById('mathAIRecovery').textContent = formatCurrency(aiRecovery);
      } else {
        document.getElementById('mathAILine').style.display = 'none';
      }

      if (serviceImpacts.crm && serviceImpacts.crm.active) {
        crmRecovery = serviceImpacts.crm.impact * 1.4;
        totalRecovery += crmRecovery;
        document.getElementById('mathCRMLine').style.display = 'flex';
        document.getElementById('mathCRMRecovery').textContent = formatCurrency(crmRecovery);
      } else {
        document.getElementById('mathCRMLine').style.display = 'none';
      }

      // Calculate new clients
      const newClients = totalRecovery / avgCaseValue;

      // Update displays
      document.getElementById('lostMonthly').textContent = formatCurrency(timeLoss);
      document.getElementById('recoverMonthly').textContent = formatCurrency(totalRecovery);
      document.getElementById('newClients').textContent = newClients.toFixed(1);
      document.getElementById('annualTotal').textContent = formatCurrency(totalRecovery * 12);

      // Update math section
      document.getElementById('mathInquiries').textContent = baseInquiries;
      document.getElementById('mathAfterHoursPct').textContent = '× ' + Math.round(afterHoursPct * 100) + '%';
      document.getElementById('mathAfterHoursInq').textContent = afterHoursInquiries.toFixed(1) + '/mo';
      document.getElementById('mathGlobalInq').textContent = afterHoursInquiries.toFixed(1);
      document.getElementById('mathCurrentCapture').textContent = currentCapture.toFixed(1);
      document.getElementById('mathLost').textContent = lostLeads.toFixed(1) + '/mo';
      document.getElementById('mathCloseRate').textContent = '× ' + Math.round(closeRatePct * 100) + '%';
      document.getElementById('mathCaseValue').textContent = '× ' + formatCurrency(avgCaseValue);
      document.getElementById('mathMonthlyLoss').textContent = formatCurrency(timeLoss);
      document.getElementById('mathTotalRecovery').textContent = formatCurrency(totalRecovery) + '/mo';
    }

    // Service toggle handler
    window.toggleService = function(service) {
      const toggle = document.querySelector('.service-toggle[data-service="' + service + '"]');
      const switchEl = toggle.querySelector('.toggle-switch');
      
      serviceImpacts[service].active = !serviceImpacts[service].active;
      switchEl.classList.toggle('active');
      
      calculate();
    };

    // Event listeners
    inquiries.addEventListener('input', calculate);
    afterHours.addEventListener('input', calculate);
    caseValue.addEventListener('input', calculate);
    closeRate.addEventListener('input', calculate);

    // Initial calculation
    calculate();
  </script>
  `;
}

// ============================================================================
// EXPORT & CLI
// ============================================================================

module.exports = { generateReport };

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: ./report-generator-v5.js <research.json> <ProspectName>');
    process.exit(1);
  }
  
  const researchFile = args[0];
  const prospectName = args[1];
  
  try {
    const researchData = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
    const result = generateReport(researchData, prospectName);
    
    const outputDir = path.dirname(researchFile);
    const outputFile = path.join(outputDir, `${researchData.firmName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-report.html`);
    
    fs.writeFileSync(outputFile, result.html || result);
    
    console.log(`✅ Report generated: ${outputFile}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

// Export for production wrapper
module.exports = { generateReport };
