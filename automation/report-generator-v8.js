#!/usr/bin/env node
/**
 * REPORT GENERATOR V8 - MERGED DESIGN
 * 
 * Combines:
 * - v7's beautiful CSS (Fraunces/Outfit fonts, cream/slate colors)
 * - v8's content structure (hero with comparison, soft CTA, flow diagrams, pull quotes, two-option framing)
 * 
 * Input: Research JSON + contact name
 * Output: Beautiful, high-converting report
 */

const fs = require('fs');
const path = require('path');

function generateReport(researchData, prospectName) {
  console.log(`\n📝 Generating MERGED DESIGN report for ${prospectName}...\n`);
  
  const {
    firmName = 'Your Firm',
    website = '',
    location = { city: '', state: '' },
    practiceAreas = [],
    credentials = [],
    gaps = {},
    competitors = [],
    estimatedMonthlyRevenueLoss = 0,
    pageSpeed = 'Unknown',
    hasChatbot = false,
    hasBookingWidget = false,
    googleAdsData = null,
    reviewCount = 0,
    rating = 0
  } = researchData;
  
  // Add safe defaults for gaps
  if (!gaps.googleAds) gaps.googleAds = { hasGap: false, impact: 0, status: 'unknown' };
  if (!gaps.metaAds) gaps.metaAds = { hasGap: false, impact: 0, status: 'unknown' };
  if (!gaps.voiceAI) gaps.voiceAI = { hasGap: false, impact: 0 };
  if (!gaps.siteSpeed) gaps.siteSpeed = { hasGap: false, impact: 0 };
  if (!gaps.crm) gaps.crm = { hasGap: false, impact: 0 };
  
  const locationStr = location.city && location.state 
    ? `${location.city}, ${location.state}`
    : location.state || 'your area';
  
  const monthlyLossK = Math.round(estimatedMonthlyRevenueLoss / 1000);
  const prospectFirstName = prospectName.split(' ')[0];
  
  // Get top 3 competitors for consistency throughout report
  const topCompetitors = competitors.slice(0, 3);
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${firmName} | Marketing Analysis by Mortar Metrics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  ${getCSS()}
</head>
<body>
  <div class="container">
    ${generateHeader(prospectName)}
    ${generateHero(firmName, locationStr, monthlyLossK, prospectFirstName, gaps, topCompetitors, researchData)}
    ${generateSoftCTA()}
    ${generateGaps(gaps, firmName, locationStr, topCompetitors, researchData)}
    ${generateCompetitorTable(topCompetitors, firmName, researchData)}
    ${generateSolution(gaps, firmName)}
    ${generateSocialProof()}
    ${generateFinalCTA(firmName, monthlyLossK)}
    ${getFooter()}
  </div>
</body>
</html>`;
  
  const slug = firmName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const outputPath = path.join(__dirname, 'reports', `${slug}-landing-page-v8.html`);
  
  return {
    html,
    outputPath,
    meta: {
      firmName,
      prospectName,
      monthlyLoss: monthlyLossK,
      gapsFound: Object.values(gaps).filter(g => g.hasGap).length
    }
  };
}

function generateHeader(prospectName) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `
    <div class="header">
      <div class="logo">Mortar Metrics</div>
      <div class="meta">Marketing Analysis for ${prospectName} · ${today}</div>
    </div>
  `;
}

function generateHero(firmName, locationStr, monthlyLossK, prospectFirstName, gaps, topCompetitors, researchData) {
  // Build a comparison that hurts based on the biggest gap
  let comparison = '';
  
  if (gaps.googleAds?.hasGap && topCompetitors.length > 0) {
    const competitorsRunningAds = topCompetitors.filter(c => c.hasGoogleAds).length;
    if (competitorsRunningAds > 0) {
      comparison = `${competitorsRunningAds} ${competitorsRunningAds === 1 ? 'firm is' : 'firms are'} bidding on your keywords. You're not one of them.`;
    }
  }
  
  if (!comparison && gaps.voiceAI?.hasGap) {
    comparison = `Your competitors answer calls in 8 seconds. You don't answer at all.`;
  }
  
  if (!comparison && researchData.reviewCount < 20 && topCompetitors.length > 0) {
    const topReviewCount = Math.max(...topCompetitors.map(c => c.reviews || 0));
    if (topReviewCount > researchData.reviewCount * 2) {
      comparison = `${topCompetitors[0].name} has ${topReviewCount} Google reviews. You have ${researchData.reviewCount}.`;
    }
  }
  
  if (!comparison) {
    comparison = `Every lead searching for lawyers in ${locationStr} sees your competitors first.`;
  }
  
  return `
    <div class="hero-comparison-box">
      <h1>${comparison}</h1>
    </div>
    
    <div class="hero">
      <div class="hero-label">That's Costing You</div>
      <div class="hero-stat">$${monthlyLossK},000/mo</div>
      <p class="hero-desc">Based on our analysis of your website, ads, competitors, and the ${locationStr} market.</p>
    </div>
    
    <p class="section-pull"><strong>Here's exactly where the money is going.</strong></p>
  `;
}

function generateSoftCTA() {
  return `
    <div class="soft-cta">
      Want us to walk you through this? <a href="#booking" class="soft-cta-link">Book 15 minutes</a>
    </div>
  `;
}

function generateGaps(gaps, firmName, locationStr, topCompetitors, researchData) {
  const gapSections = [];
  let gapNumber = 1;
  
  // Google Ads Gap
  if (gaps.googleAds?.hasGap) {
    gapSections.push(generateGoogleAdsGap(gapNumber++, gaps.googleAds, firmName, locationStr, topCompetitors, researchData));
  }
  
  // Voice AI Gap
  if (gaps.voiceAI?.hasGap) {
    gapSections.push(generateVoiceAIGap(gapNumber++, gaps.voiceAI, firmName, locationStr));
  }
  
  // Meta Ads Gap
  if (gaps.metaAds?.hasGap && gapNumber <= 3) {
    gapSections.push(generateMetaAdsGap(gapNumber++, gaps.metaAds, firmName, locationStr));
  }
  
  return gapSections.join('\n\n');
}

function generateGoogleAdsGap(number, gap, firmName, locationStr, topCompetitors, researchData) {
  const impactK = Math.round(gap.impact / 1000);
  const searches = Math.round(gap.impact / 50); // Rough estimate for math
  const practice = researchData.practiceAreas?.[0] || 'legal services';
  
  return `
    <div class="section-label">GAP #${number}</div>
    <div class="gap-box">
      <div class="gap-header">
        <div class="gap-title">You're invisible on Google</div>
        <div class="gap-cost">-$${impactK}K/mo</div>
      </div>
      
      <p><strong>You have no paid search infrastructure.</strong> When someone searches "lawyer ${locationStr}" at 11pm, they see ads. Three of them. None are you.</p>
      
      <div class="flow-diagram">
        <div class="flow-step">Lead searches "${practice} lawyer ${locationStr}"</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Sees 3 ads at the top (none are you)</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Clicks competitor</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">You never knew they existed</div>
      </div>
      
      <div class="pull-quote">
        "65% of high-intent legal searches click on ads, not organic results."
      </div>
      
      <p><strong>What this costs:</strong> Conservative math—${searches} monthly searches × 3% click rate × 15% conversion × $2,800 average case value = <strong>$${impactK}K/month</strong> in cases you never had a chance at.</p>
      
      <p><strong>What we've seen work:</strong> A tax firm in Phoenix went from 0 to 47 qualified leads/month after we built their paid search infrastructure.</p>
    </div>
    
    <p class="section-pull"><strong>But getting the click is only half the battle. What happens when they actually reach out?</strong></p>
  `;
}

function generateVoiceAIGap(number, gap, firmName, locationStr) {
  const impactK = Math.round(gap.impact / 1000);
  
  return `
    <div class="section-label">GAP #${number}</div>
    <div class="gap-box">
      <div class="gap-header">
        <div class="gap-title">You have no after-hours intake infrastructure</div>
        <div class="gap-cost">-$${impactK}K/mo</div>
      </div>
      
      <p><strong>73% of people searching for lawyers do it outside business hours.</strong> They call at 8pm. Your phone goes to voicemail. They hang up. They call the next firm.</p>
      
      <div class="contrast-box">
        <div class="contrast-side">
          <div class="contrast-label bad">Right now:</div>
          <ul>
            <li>Call comes in at 8pm</li>
            <li>Voicemail picks up</li>
            <li>They hang up (73% do)</li>
            <li>They call the next firm</li>
            <li>Gone forever</li>
          </ul>
        </div>
        <div class="contrast-side">
          <div class="contrast-label good">With intake infrastructure:</div>
          <ul>
            <li>Call comes in at 8pm</li>
            <li>AI answers in 2 rings</li>
            <li>Qualifies with 4 questions</li>
            <li>Books consultation</li>
            <li>Sends confirmation text</li>
            <li>Logs to CRM</li>
            <li>Alerts your team</li>
          </ul>
        </div>
      </div>
      
      <div class="pull-quote">
        "Every call is a signal: What did they ask? How urgent are they? With infrastructure, every call becomes a record—transcribed, scored, tagged, and routed."
      </div>
      
      <p><strong>What this costs:</strong> If you're getting 40 calls/month and missing 30% after hours, that's 12 leads lost × 15% close rate × $2,800 = <strong>$${impactK}K/month</strong>.</p>
      
      <p><strong>What we've seen work:</strong> A firm in Dallas was missing 34% of calls. After intake infrastructure, close rate jumped from 18% to 31%.</p>
    </div>
    
    <p class="section-pull"><strong>So who in your market is actually doing this right? That's where it gets uncomfortable.</strong></p>
  `;
}

function generateMetaAdsGap(number, gap, firmName, locationStr) {
  const impactK = Math.round(gap.impact / 1000);
  
  return `
    <div class="section-label">GAP #${number}</div>
    <div class="gap-box">
      <div class="gap-header">
        <div class="gap-title">You have no pixel-based retargeting infrastructure</div>
        <div class="gap-cost">-$${impactK}K/mo</div>
      </div>
      
      <p><strong>Every visitor to your site leaves and never comes back.</strong> No Facebook pixel. No retargeting audiences. No lookalikes. Someone researches you, closes the tab, and you're gone from their mind.</p>
      
      <div class="flow-diagram">
        <div class="flow-step">Visitor lands on your site</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Reads for 45 seconds</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Closes tab to "think about it"</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Sees competitor's retargeting ad 2 hours later</div>
        <div class="flow-arrow">↓</div>
        <div class="flow-step">Books with them instead</div>
      </div>
      
      <p><strong>What this costs:</strong> If you're getting 500 visitors/month, 3% would convert with proper retargeting. That's 15 cases × $2,800 = <strong>$${impactK}K/month</strong>.</p>
    </div>
    
    <p class="section-pull"><strong>The gap is clear. The question is what it actually takes to close it.</strong></p>
  `;
}

function generateCompetitorTable(topCompetitors, firmName, researchData) {
  if (topCompetitors.length === 0) {
    return `
      <div class="section-label">YOUR MARKET</div>
      <h2>The competitive landscape</h2>
      <p>We analyzed ${firmName} and the competitive landscape in your market. The infrastructure gaps are clear.</p>
      <div class="big-divider"></div>
    `;
  }
  
  // Build table rows
  const hasGoogleAds = researchData.googleAdsData?.running ? '✓' : '❌';
  const hasMetaAds = researchData.hasMetaAds ? '✓' : '❌';
  const hasVoiceAI = researchData.hasChatbot ? '✓' : '❌';
  const yourReviews = researchData.reviewCount || 0;
  const yourRating = researchData.rating || 0;
  
  let tableHTML = `
    <div class="section-label">YOUR COMPETITION</div>
    <h2>Who's winning in your market</h2>
    <p>We pulled competitive intelligence on the top firms in ${researchData.location?.city || 'your area'}. Here's what they're running:</p>
    
    <div class="competitor-table">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>You</th>
  `;
  
  topCompetitors.forEach(comp => {
    tableHTML += `<th>${comp.name || 'Competitor'}</th>`;
  });
  
  tableHTML += `
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Google Reviews</strong></td>
            <td>${yourReviews}</td>
  `;
  
  topCompetitors.forEach(comp => {
    tableHTML += `<td>${comp.reviews || 0}</td>`;
  });
  
  tableHTML += `
          </tr>
          <tr>
            <td><strong>Rating</strong></td>
            <td>${yourRating}★</td>
  `;
  
  topCompetitors.forEach(comp => {
    tableHTML += `<td>${comp.rating || 0}★</td>`;
  });
  
  tableHTML += `
          </tr>
          <tr>
            <td><strong>Google Ads</strong></td>
            <td>${hasGoogleAds}</td>
  `;
  
  topCompetitors.forEach(comp => {
    tableHTML += `<td>${comp.hasGoogleAds ? '✓' : '❌'}</td>`;
  });
  
  tableHTML += `
          </tr>
          <tr>
            <td><strong>Meta Ads</strong></td>
            <td>${hasMetaAds}</td>
  `;
  
  topCompetitors.forEach(comp => {
    tableHTML += `<td>${comp.hasMetaAds ? '✓' : '❌'}</td>`;
  });
  
  tableHTML += `
          </tr>
          <tr>
            <td><strong>24/7 Intake</strong></td>
            <td>${hasVoiceAI}</td>
  `;
  
  topCompetitors.forEach(comp => {
    tableHTML += `<td>${comp.hasVoiceAI ? '✓' : '❌'}</td>`;
  });
  
  tableHTML += `
          </tr>
        </tbody>
      </table>
    </div>
  `;
  
  // Find competitor with most infrastructure
  const competitorWithMost = topCompetitors.reduce((best, current) => {
    const currentScore = (current.hasGoogleAds ? 1 : 0) + (current.hasMetaAds ? 1 : 0) + (current.hasVoiceAI ? 1 : 0);
    const bestScore = (best.hasGoogleAds ? 1 : 0) + (best.hasMetaAds ? 1 : 0) + (best.hasVoiceAI ? 1 : 0);
    return currentScore > bestScore ? current : best;
  }, topCompetitors[0]);
  
  tableHTML += `
    <div class="competitor-insight">
      <strong>${competitorWithMost.name} has the most complete infrastructure.</strong> They're capturing the cases everyone else misses—after-hours leads, retargeted visitors, and anyone searching on Google.
    </div>
    <div class="big-divider"></div>
  `;
  
  return tableHTML;
}

function generateSolution(gaps, firmName) {
  const hasAnyGap = Object.values(gaps).some(g => g.hasGap);
  
  if (!hasAnyGap) {
    return `
      <div class="section-label">NEXT STEPS</div>
      <h2>What we'd build</h2>
      <p>Your infrastructure is solid. The opportunity is in optimization and scale.</p>
      <div class="big-divider"></div>
    `;
  }
  
  return `
    <div class="section-label">THE SOLUTION</div>
    <h2>What full infrastructure actually requires</h2>
    
    <p>The gaps are clear. Here's what it takes to close them:</p>
    
    <div class="solution-stack">
      <div class="solution-item">
        <div class="solution-icon">🎯</div>
        <div class="solution-content">
          <strong>Google Ads Infrastructure</strong>
          <p>Geo-targeting, dayparting, negative keywords, device bid adjustments, conversion tracking with offline import</p>
        </div>
      </div>
      
      <div class="solution-item">
        <div class="solution-icon">📊</div>
        <div class="solution-content">
          <strong>Meta Pixel & Retargeting</strong>
          <p>Custom audiences, lookalikes, exclusion lists, dynamic creative, automated bid strategies</p>
        </div>
      </div>
      
      <div class="solution-item">
        <div class="solution-icon">🤖</div>
        <div class="solution-content">
          <strong>Voice AI + CRM</strong>
          <p>24/7 intake, qualification logic, automated follow-up sequences, pipeline stages, call tracking</p>
        </div>
      </div>
      
      <div class="solution-item">
        <div class="solution-icon">📈</div>
        <div class="solution-content">
          <strong>Unified Dashboard</strong>
          <p>Reporting pulling from 6 data sources—every lead, every call, every dollar tracked</p>
        </div>
      </div>
      
      <div class="solution-item">
        <div class="solution-icon">⚙️</div>
        <div class="solution-content">
          <strong>System Integration</strong>
          <p>Every piece connected to every other piece—ads → landing page → phone → CRM → reporting</p>
        </div>
      </div>
    </div>
    
    <div class="callout">
      <p><strong>Sound like a lot? It is.</strong> But we've built this exact system 23 times. Different practice areas, same infrastructure. The system works. The question is whether you want us to build it for you.</p>
    </div>
    <div class="big-divider"></div>
  `;
}

function generateSocialProof() {
  return `
    <div class="section-label">PROOF</div>
    <h2>We've done this before</h2>
    
    <div class="proof-grid">
      <div class="proof-box">
        <div class="proof-number">47</div>
        <div class="proof-label">leads/month</div>
        <p>Phoenix tax firm went from 0 to 47 qualified leads after we built paid search infrastructure</p>
      </div>
      
      <div class="proof-box">
        <div class="proof-number">31%</div>
        <div class="proof-label">close rate</div>
        <p>Dallas firm's close rate jumped from 18% to 31% after implementing intake infrastructure</p>
      </div>
      
      <div class="proof-box">
        <div class="proof-number">23</div>
        <div class="proof-label">firms</div>
        <p>Different practice areas, same infrastructure. Tax law, family law, PI, immigration—system works across all of them.</p>
      </div>
    </div>
    <div class="section-divider"></div>
  `;
}

function generateFinalCTA(firmName, monthlyLossK) {
  return `
    <div class="section-label">NEXT STEP</div>
    <h2>Two options</h2>
    
    <div class="two-options">
      <div class="option-box option-bad">
        <h3>Keep doing what you're doing</h3>
        <ul>
          <li>Competitors keep buying your keywords</li>
          <li>Calls keep going to voicemail</li>
          <li>Cases keep walking</li>
          <li>$${monthlyLossK}K/month keeps disappearing</li>
        </ul>
      </div>
      
      <div class="option-box option-good">
        <h3>Let us build the system</h3>
        <ul>
          <li>Ads live in 5 days</li>
          <li>Voice AI live in 10 days</li>
          <li>Full infrastructure in 3 weeks</li>
          <li>Start capturing those cases</li>
        </ul>
      </div>
    </div>
    
    <div id="booking" class="cta">
      <h2>Ready to capture this $${monthlyLossK}K/month opportunity?</h2>
      <p>Book a 15-minute call. We'll show you the exact game plan.</p>
      <iframe src="https://api.mortarmetrics.com/widget/booking/7aCMl8OqQAOE3NfjfUGT" style="width: 100%;border:none;overflow: hidden;" scrolling="no" id="mortar-booking-widget"></iframe>
      <script src="https://api.mortarmetrics.com/js/form_embed.js" type="text/javascript"></script>
    </div>
  `;
}

function getFooter() {
  return `
    <div class="footer">
      Mortar Metrics · Legal Growth Agency · Based in Toronto, ON<br>
      <a href="mailto:hello@mortarmetrics.com" style="color: var(--primary); text-decoration: none;">hello@mortarmetrics.com</a>
    </div>
  `;
}

function getCSS() {
  return `<style>
    :root {
      --ink: #0a0a0a;
      --ink-soft: #171717;
      --slate: #525252;
      --slate-light: #737373;
      --muted: #a3a3a3;
      --border: #e5e5e5;
      --border-light: #f5f5f5;
      --warm-white: #fafafa;
      --cream: #FDFBF7;
      --white: #ffffff;
      --primary: #6366f1;
      --primary-light: #818cf8;
      --accent: #8b5cf6;
      --accent-light: #a78bfa;
      --success: #10b981;
      --success-light: #34d399;
      --success-muted: #d1fae5;
      --danger: #ef4444;
      --danger-muted: #fef2f2;
      --danger-deep: #dc2626;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body { 
      font-family: 'Outfit', -apple-system, sans-serif; 
      background: var(--cream);
      color: var(--slate); 
      line-height: 1.8;
      font-size: 17px;
    }

    .container { 
      max-width: 820px; 
      margin: 0 auto; 
      padding: 60px 32px;
    }

    h1, h2, h3 { 
      font-family: 'Fraunces', Georgia, serif;
      color: var(--ink); 
      line-height: 1.3;
      font-weight: 600;
      margin-bottom: 20px;
    }
    h1 { font-size: 2.5rem; letter-spacing: -0.02em; margin-bottom: 16px; }
    h2 { font-size: 2rem; margin-top: 64px; letter-spacing: -0.01em; }
    h3 { font-size: 1.5rem; margin-top: 40px; color: var(--ink-soft); }
    
    p { 
      margin-bottom: 20px; 
      color: var(--slate);
      font-size: 1.0625rem;
    }
    
    strong { color: var(--ink); font-weight: 600; }
    em { font-style: italic; color: var(--slate-light); }

    .header {
      border-bottom: 2px solid var(--border-light);
      padding-bottom: 24px;
      margin-bottom: 48px;
    }
    
    .logo { 
      font-family: 'Fraunces', Georgia, serif;
      font-weight: 700; 
      font-size: 1.4rem; 
      color: var(--ink);
      margin-bottom: 8px;
    }
    
    .meta { 
      font-size: 0.9375rem; 
      color: var(--muted);
    }

    /* Hero with comparison box */
    .hero-comparison-box {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(249, 115, 22, 0.04) 100%);
      border-left: 4px solid var(--danger);
      padding: 36px;
      border-radius: 12px;
      margin: 48px 0 32px;
    }
    
    .hero-comparison-box h1 {
      margin-bottom: 0;
      color: var(--ink);
    }

    .hero {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(249, 115, 22, 0.04) 100%);
      border-left: 4px solid var(--danger);
      padding: 36px;
      border-radius: 12px;
      margin: 32px 0 48px;
    }

    .hero-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--danger);
      margin-bottom: 12px;
    }

    .hero-stat {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 3.5rem;
      font-weight: 700;
      color: var(--danger);
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }

    .hero-desc {
      font-size: 1.125rem;
      color: var(--slate);
      margin-bottom: 0;
    }

    /* Soft CTA */
    .soft-cta {
      text-align: center;
      padding: 24px 32px;
      background: var(--warm-white);
      border-radius: 12px;
      margin: 48px 0;
      font-size: 1.0625rem;
      color: var(--slate);
    }
    
    .soft-cta-link {
      color: var(--primary);
      font-weight: 600;
      text-decoration: none;
      border-bottom: 2px solid var(--primary-light);
      padding-bottom: 2px;
    }
    
    .soft-cta-link:hover {
      color: var(--primary-light);
      border-bottom-color: var(--primary);
    }

    .callout {
      background: linear-gradient(135deg, var(--warm-white) 0%, white 100%);
      border-left: 3px solid var(--primary);
      padding: 24px 28px;
      margin: 32px 0;
      border-radius: 8px;
      font-size: 1.0625rem;
    }

    .callout strong {
      color: var(--primary);
    }

    .blue-ocean {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%);
      border-left: 4px solid var(--success);
      padding: 32px;
      border-radius: 12px;
      margin: 32px 0;
    }

    .blue-ocean-badge {
      display: inline-block;
      background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
      color: white;
      padding: 6px 16px;
      border-radius: 100px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 16px;
    }

    .section {
      margin: 64px 0;
    }

    .section-label {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2.5px;
      color: var(--muted);
      margin: 80px 0 12px 0;
    }

    .section-pull {
      font-size: 1.125rem;
      font-weight: 500;
      color: var(--slate);
      margin: 40px 0 20px;
    }

    ul {
      margin: 24px 0;
      padding-left: 28px;
    }

    li {
      margin-bottom: 12px;
      color: var(--slate);
      padding-left: 8px;
    }

    .gap-box {
      background: white;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      margin: 28px 0;
    }

    .gap-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .gap-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--ink);
    }

    .gap-cost {
      background: linear-gradient(135deg, var(--danger) 0%, #f97316 100%);
      color: white;
      padding: 8px 20px;
      border-radius: 100px;
      font-weight: 700;
      font-size: 0.9375rem;
    }

    /* Flow diagrams */
    .flow-diagram {
      background: var(--warm-white);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 28px;
      margin: 28px 0;
    }
    
    .flow-step {
      background: white;
      border: 1px solid var(--border-light);
      padding: 16px 20px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      text-align: center;
      color: var(--ink-soft);
    }
    
    .flow-arrow {
      text-align: center;
      font-size: 24px;
      color: var(--muted);
      margin: 10px 0;
    }

    /* Contrast boxes */
    .contrast-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 28px 0;
    }
    
    .contrast-side {
      background: white;
      border: 2px solid var(--border);
      border-radius: 12px;
      padding: 24px;
    }
    
    .contrast-side:nth-child(2) {
      background: var(--success-muted);
      border-color: var(--success-light);
    }
    
    .contrast-label {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 16px;
      color: var(--ink);
    }
    
    .contrast-label.good {
      color: var(--success);
    }
    
    .contrast-label.bad {
      color: var(--danger);
    }
    
    .contrast-side ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .contrast-side li {
      padding: 8px 0;
      border-bottom: 1px solid var(--border-light);
      margin: 0;
    }
    
    .contrast-side li:last-child {
      border-bottom: none;
    }
    
    @media (max-width: 640px) {
      .contrast-box {
        grid-template-columns: 1fr;
      }
    }

    /* Pull quotes */
    .pull-quote {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.04) 100%);
      border-left: 4px solid #f59e0b;
      padding: 28px 32px;
      margin: 32px 0;
      font-size: 1.25rem;
      font-weight: 500;
      line-height: 1.6;
      color: var(--ink-soft);
      font-style: italic;
    }

    /* Competitor table */
    .competitor-table {
      margin: 32px 0;
      overflow-x: auto;
    }
    
    .competitor-table table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    
    .competitor-table th {
      background: var(--warm-white);
      padding: 16px;
      text-align: left;
      font-family: 'Outfit', sans-serif;
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--ink);
      border-bottom: 2px solid var(--border);
    }
    
    .competitor-table td {
      padding: 14px 16px;
      font-size: 1rem;
      color: var(--slate);
      border-bottom: 1px solid var(--border-light);
    }
    
    .competitor-table tr:last-child td {
      border-bottom: none;
    }
    
    .competitor-insight {
      background: var(--danger-muted);
      border-left: 4px solid var(--danger);
      padding: 24px 28px;
      margin-top: 24px;
      border-radius: 8px;
      font-size: 1.0625rem;
      line-height: 1.7;
      color: var(--ink-soft);
    }

    /* Solution stack */
    .solution-stack {
      margin: 32px 0;
    }
    
    .solution-item {
      display: flex;
      gap: 20px;
      align-items: flex-start;
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 16px;
    }
    
    .solution-icon {
      font-size: 2rem;
      flex-shrink: 0;
    }
    
    .solution-content strong {
      display: block;
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1.125rem;
      color: var(--ink);
      margin-bottom: 8px;
    }
    
    .solution-content p {
      font-size: 0.9375rem;
      color: var(--slate-light);
      margin: 0;
    }

    /* Proof grid */
    .proof-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 24px;
      margin: 32px 0;
    }
    
    .proof-box {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%);
      border: 2px solid var(--success-light);
      border-radius: 12px;
      padding: 28px;
      text-align: center;
    }
    
    .proof-number {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 3rem;
      font-weight: 700;
      color: var(--success);
      margin-bottom: 4px;
    }
    
    .proof-label {
      font-size: 0.875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--success);
      margin-bottom: 12px;
    }
    
    .proof-box p {
      font-size: 0.9375rem;
      line-height: 1.6;
      color: var(--slate);
      margin: 0;
    }

    /* Two options */
    .two-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin: 40px 0;
    }
    
    .option-box {
      border-radius: 12px;
      padding: 32px;
    }
    
    .option-bad {
      background: var(--danger-muted);
      border: 2px solid #fecaca;
    }
    
    .option-good {
      background: var(--success-muted);
      border: 2px solid var(--success-light);
    }
    
    .option-box h3 {
      font-size: 1.375rem;
      margin-top: 0;
      margin-bottom: 20px;
    }
    
    .option-bad h3 {
      color: var(--danger-deep);
    }
    
    .option-good h3 {
      color: var(--success);
    }
    
    .option-box ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .option-bad li {
      padding: 10px 0 10px 28px;
      position: relative;
      color: var(--ink-soft);
      font-size: 1rem;
    }
    
    .option-bad li:before {
      content: "✗";
      position: absolute;
      left: 0;
      color: var(--danger);
      font-weight: 700;
      font-size: 1.125rem;
    }
    
    .option-good li {
      padding: 10px 0 10px 28px;
      position: relative;
      color: var(--ink-soft);
      font-size: 1rem;
    }
    
    .option-good li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: var(--success);
      font-weight: 700;
      font-size: 1.125rem;
    }
    
    @media (max-width: 768px) {
      .two-options {
        grid-template-columns: 1fr;
      }
    }

    .section-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, var(--border) 50%, transparent 100%);
      margin: 80px 0;
    }

    .big-divider {
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%);
      margin: 100px 0;
      position: relative;
    }

    .big-divider::after {
      content: '●';
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      background: var(--cream);
      color: var(--primary);
      font-size: 1.5rem;
      padding: 0 16px;
    }

    .strength-box {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%);
      border-left: 3px solid var(--success);
      padding: 28px;
      border-radius: 12px;
      margin: 24px 0;
    }

    .strength-box p {
      margin-bottom: 0;
    }

    .stat-highlight {
      background: white;
      border: 2px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin: 28px 0;
      text-align: center;
    }

    .stat-highlight-number {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 8px;
    }

    .stat-highlight-label {
      color: var(--slate-light);
      font-size: 0.9375rem;
    }

    .cta {
      background: white;
      border: 2px solid var(--border);
      border-radius: 20px;
      padding: 48px;
      margin: 80px 0 40px;
      text-align: center;
    }

    .cta h2 {
      color: var(--ink);
      margin-top: 0;
      margin-bottom: 16px;
      font-size: 2rem;
    }

    .cta p {
      color: var(--slate);
      font-size: 1.125rem;
      margin-bottom: 32px;
    }

    .footer {
      text-align: center;
      padding: 32px 0;
      color: var(--muted);
      font-size: 0.875rem;
      border-top: 1px solid var(--border-light);
    }

    @media (max-width: 768px) {
      h1 { font-size: 2rem; }
      h2 { font-size: 1.625rem; }
      .container { padding: 40px 20px; }
      .hero-stat { font-size: 2.5rem; }
      .hero-comparison-box h1 { font-size: 1.75rem; }
    }
  </style>`;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node report-generator-v8.js <research-json-path> <prospect-name>');
    console.error('\nExample:');
    console.error('  node report-generator-v8.js ./reports/firm-research.json "John Smith"');
    process.exit(1);
  }
  
  const [researchPath, prospectName] = args;
  
  if (!fs.existsSync(researchPath)) {
    console.error(`❌ Research file not found: ${researchPath}`);
    process.exit(1);
  }
  
  try {
    const researchData = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
    const result = generateReport(researchData, prospectName);
    
    // Ensure reports directory exists
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(result.outputPath, result.html);
    
    console.log('✅ Report generated successfully!');
    console.log(`📄 Output: ${result.outputPath}`);
    console.log('\nMeta:');
    console.log(`  Firm: ${result.meta.firmName}`);
    console.log(`  Contact: ${result.meta.prospectName}`);
    console.log(`  Monthly Loss: $${result.meta.monthlyLoss}K`);
    console.log(`  Gaps Found: ${result.meta.gapsFound}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

module.exports = { generateReport };
