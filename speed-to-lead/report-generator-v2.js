#!/usr/bin/env node
/**
 * REPORT GENERATOR V2
 * Creates beautiful, modular gap analysis reports
 */

const fs = require('fs');
const path = require('path');

function generateReport(researchData, prospectName) {
  console.log(`\n📝 Generating gap analysis report for ${prospectName}...\n`);
  
  const {
    firmName,
    website,
    location,
    practiceAreas,
    gaps,
    competitors,
    competitorAds,
    pageSpeed,
    pageSpeedScore,
    hasChatbot,
    estimatedMonthlyRevenueLoss
  } = researchData;
  
  // Calculate which gaps to show
  const activeGaps = Object.entries(gaps).filter(([_, info]) => info.hasGap);
  const gapCount = activeGaps.length;
  
  // Calculate total annual opportunity
  const annualOpportunity = estimatedMonthlyRevenueLoss * 12;
  
  // Build hero stats (only show gaps that exist)
  const heroStats = [];
  if (gaps.metaAds.hasGap) {
    heroStats.push({ value: `$${gaps.metaAds.impact.toLocaleString()}`, label: 'Meta Ads Gap/Mo' });
  }
  if (gaps.googleAds.hasGap) {
    heroStats.push({ value: `$${gaps.googleAds.impact.toLocaleString()}`, label: 'Google Ads Gap/Mo' });
  }
  if (gaps.support24x7.hasGap) {
    heroStats.push({ value: `$${gaps.support24x7.impact.toLocaleString()}`, label: '24/7 Support Gap/Mo' });
  }
  if (gaps.websiteSpeed.hasGap) {
    heroStats.push({ value: `$${gaps.websiteSpeed.impact.toLocaleString()}`, label: 'Website Speed Gap/Mo' });
  }
  
  // Pad to 4 stats if needed
  while (heroStats.length < 4 && gaps.crm.hasGap) {
    heroStats.push({ value: `$${gaps.crm.impact.toLocaleString()}`, label: 'CRM/Automation Gap/Mo' });
    break;
  }
  
  // Generate gap summary cards (only active gaps)
  const gapSummaryHTML = activeGaps.map(([gapName, info]) => {
    const icons = {
      metaAds: '📱',
      googleAds: '🔍',
      support24x7: '📞',
      websiteSpeed: '⚡',
      crm: '💼'
    };
    
    const titles = {
      metaAds: 'Meta Ads Gap',
      googleAds: 'Google Ads Gap',
      support24x7: '24/7 Support Gap',
      websiteSpeed: 'Website Speed Gap',
      crm: 'CRM/Automation Gap'
    };
    
    return `
      <div class="gap-card">
        <div class="gap-icon">${icons[gapName]}</div>
        <div class="gap-title">${titles[gapName]}</div>
        <div class="gap-impact">-$${info.impact.toLocaleString()}/mo</div>
        <div class="gap-desc">${info.details}</div>
      </div>
    `;
  }).join('');
  
  // Generate hero stats HTML
  const heroStatsHTML = heroStats.map(stat => `
    <div class="hero-stat">
      <div class="hero-stat-value danger">${stat.value}</div>
      <div class="hero-stat-label">${stat.label}</div>
    </div>
  `).join('');
  
  // Generate playbook cards (only for active gaps)
  const playbookHTML = generatePlaybookHTML(activeGaps, researchData);
  
  // Generate competitive table
  const competitiveTableHTML = generateCompetitiveTable(researchData);
  
  // Primary practice area for context
  const primaryPractice = practiceAreas[0] || 'legal services';
  const locationStr = location.city && location.state ? `${location.city}, ${location.state}` : 'your area';
  
  // Full HTML template
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
  <div class="scroll-indicator" id="scrollIndicator"></div>
  <div class="bg-grid"></div>
  <div class="orbs"><div class="orb orb-1"></div><div class="orb orb-2"></div></div>

  <div class="container">
    <!-- HEADER -->
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

    <!-- HERO -->
    <section class="hero">
      <h1 class="hero-title">
        You're leaving <em>$${annualOpportunity.toLocaleString()}/year</em> on the table.
      </h1>
      <p class="hero-subtitle">
        ${heroSubtitle(researchData)}
      </p>
      <div class="hero-stats">
        ${heroStatsHTML}
      </div>
      
      <div class="quick-cta">
        <a href="#calculator" class="quick-cta-btn primary">↓ See Your Numbers</a>
        <a href="#cta" class="quick-cta-btn secondary">Book 15 Min Call</a>
      </div>
    </section>

    <!-- BIG OPPORTUNITY -->
    <div class="opportunity-box reveal">
      <div class="opportunity-label">Annual Revenue You Could Recover</div>
      <div class="opportunity-value">$${annualOpportunity.toLocaleString()}</div>
      <div class="opportunity-context">No new hires. No extra hours. Same great work—more clients finding you.</div>
    </div>

    <!-- GAP SUMMARY -->
    <div class="gap-summary reveal">
      ${gapSummaryHTML}
    </div>

    ${generateStoryMini(researchData)}

    ${competitiveTableHTML}

    ${generateCalculator(researchData)}

    ${playbookHTML}

    ${generateCTA()}

    ${getFooter()}
  </div>

  ${getJavaScript()}
</body>
</html>`;
  
  return html;
}

function heroSubtitle(research) {
  const { firmName, location, practiceAreas, competitors, gaps } = research;
  const locationStr = location.city ? `${location.city}, ${location.state}` : location.state || 'your market';
  const practice = practiceAreas[0] || 'legal services';
  
  // Build dynamic subtitle based on gaps
  let subtitle = `${firmName} serves clients in ${locationStr}. `;
  
  if (gaps.metaAds.hasGap && competitors.length > 0) {
    subtitle += `But when someone searches "${practice}" at 2 AM, ${competitors[0] || "your competitors"} show up first. `;
  } else if (gaps.googleAds.hasGap) {
    subtitle += `Your competitors are running ads 24/7 while you rely on referrals. `;
  }
  
  if (gaps.support24x7.hasGap) {
    subtitle += `73% of leads come outside business hours—and most go unanswered. `;
  }
  
  subtitle += `Here's exactly what's costing you money, and how to fix it.`;
  
  return subtitle;
}

function generateStoryMini(research) {
  if (!research.gaps.support24x7.hasGap) return '';
  
  return `
    <div class="story-mini reveal">
      <p class="story-mini-text">
        <strong>Tuesday, 11:47 PM.</strong> A potential client just got in an accident. They Google "${research.practiceAreas[0] || 'attorney'} near me." They call three firms. Two go to voicemail. One answers—an AI intake system that books them for tomorrow morning. That firm gets the case. You got the voicemail.
      </p>
      <p class="story-mini-outcome">Your expertise didn't lose. Your availability did. This happens every week.</p>
    </div>
  `;
}

function generateCompetitiveTable(research) {
  const { gaps, firmName, competitors } = research;
  const competitor1 = competitors[0] || 'Competitor A';
  const competitor2 = competitors[1] || 'Competitor B';
  
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
            <th>${competitor1}</th>
            <th>${competitor2}</th>
            <th>YOU</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Google Ads</td>
            <td><span class="check">✓ Active</span></td>
            <td><span class="check">✓ Active</span></td>
            <td><span class="${gaps.googleAds.hasGap ? 'cross' : 'check'}">${gaps.googleAds.hasGap ? '✗ Not Running' : '✓ Active'}</span></td>
          </tr>
          <tr>
            <td>Meta Ads (FB/IG)</td>
            <td><span class="check">✓ Active</span></td>
            <td><span class="partial">◐ Limited</span></td>
            <td><span class="${gaps.metaAds.hasGap ? 'cross' : 'check'}">${gaps.metaAds.hasGap ? '✗ Not Running' : '✓ Active'}</span></td>
          </tr>
          <tr>
            <td>24/7 Support</td>
            <td><span class="check">✓ Yes</span></td>
            <td><span class="check">✓ Yes</span></td>
            <td><span class="${gaps.support24x7.hasGap ? 'cross' : 'check'}">${gaps.support24x7.hasGap ? '✗ Business Hours Only' : '✓ Yes'}</span></td>
          </tr>
          <tr>
            <td>Website Speed</td>
            <td><span class="check">✓ Fast</span></td>
            <td><span class="check">✓ Fast</span></td>
            <td><span class="${gaps.websiteSpeed.hasGap ? 'cross' : 'check'}">${gaps.websiteSpeed.hasGap ? '✗ Slow' : '✓ Fast'}</span></td>
          </tr>
          <tr>
            <td>Automated Follow-Up</td>
            <td><span class="check">✓ Yes</span></td>
            <td><span class="check">✓ Yes</span></td>
            <td><span class="${gaps.crm.hasGap ? 'cross' : 'check'}">${gaps.crm.hasGap ? '✗ Manual' : '✓ Automated'}</span></td>
          </tr>
        </tbody>
      </table>
      <div class="insight-box">
        <strong>The gap isn't your expertise—it's infrastructure.</strong> You're likely great at what you do. But in 2026, clients expect instant response, 24/7 availability, and systematic follow-up. The firms capturing market share aren't better lawyers—they're just easier to reach.
      </div>
    </section>
  `;
}

function generateCalculator(research) {
  const monthly = research.estimatedMonthlyRevenueLoss;
  const annual = monthly * 12;
  
  return `
    <div class="calculator-section reveal" id="calculator">
      <div class="calc-header">
        <span class="section-label">Your Numbers</span>
        <h2 class="section-title">See Exactly What You're Missing</h2>
        <p style="color: var(--slate); margin-top: 10px;">Adjust the sliders. Watch the math.</p>
      </div>

      <div class="calc-grid">
        <div class="calc-inputs">
          <div class="calc-input-group">
            <div class="calc-input-label">
              <span>Monthly Inquiries</span>
              <span class="calc-input-value" id="inquiriesValue">40</span>
            </div>
            <input type="range" class="calc-slider" id="inquiries" min="10" max="200" value="40">
          </div>
          <div class="calc-input-group">
            <div class="calc-input-label">
              <span>After-Hours %</span>
              <span class="calc-input-value" id="afterHoursValue">60%</span>
            </div>
            <input type="range" class="calc-slider" id="afterHours" min="40" max="80" value="60">
          </div>
          <div class="calc-input-group">
            <div class="calc-input-label">
              <span>Average Case Value</span>
              <span class="calc-input-value" id="caseValueValue">$8,000</span>
            </div>
            <input type="range" class="calc-slider" id="caseValue" min="2000" max="50000" value="8000" step="1000">
          </div>
          <div class="calc-input-group">
            <div class="calc-input-label">
              <span>Current Close Rate</span>
              <span class="calc-input-value" id="closeRateValue">25%</span>
            </div>
            <input type="range" class="calc-slider" id="closeRate" min="10" max="50" value="25">
          </div>
        </div>
        <div class="calc-results">
          <div class="calc-result-card">
            <div class="calc-result-value danger" id="lostMonthly">$${monthly.toLocaleString()}</div>
            <div class="calc-result-label">Currently Missing/Month</div>
          </div>
          <div class="calc-result-card">
            <div class="calc-result-value success" id="recoverMonthly">$${Math.round(monthly * 1.4).toLocaleString()}</div>
            <div class="calc-result-label">Could Recover/Month</div>
          </div>
          <div class="calc-result-card">
            <div class="calc-result-value" style="color: var(--brand-blue);" id="newClients">5.2</div>
            <div class="calc-result-label">New Clients/Month</div>
          </div>
          <div class="calc-total">
            <div class="calc-total-value" id="annualTotal">$${annual.toLocaleString()}</div>
            <div class="calc-total-label">Annual Revenue Opportunity</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function generatePlaybookHTML(activeGaps, research) {
  let html = `
    <section class="reveal">
      <div class="section-header">
        <span class="section-label">The Playbook</span>
        <h2 class="section-title">How to Fix Each Gap</h2>
        <p class="section-subtitle">DIY or done-for-you. Your choice.</p>
      </div>
  `;
  
  activeGaps.forEach(([gapName, info], index) => {
    html += generatePlaybookCard(gapName, info, index + 1, research);
  });
  
  html += `</section>`;
  return html;
}

function generatePlaybookCard(gapName, info, number, research) {
  const playbooks = {
    metaAds: {
      title: 'Get Found — Meta Ads',
      problem: "Your potential clients are scrolling Facebook and Instagram right now. Your competitors are showing up in their feed. You're not.",
      diy: [
        'Set up Facebook Business Manager',
        'Create custom audiences by location & interests',
        'Design ad creative for each practice area',
        'Write ad copy (refresh weekly to avoid fatigue)',
        'Build landing pages with lead forms',
        'Set up pixel tracking & retargeting',
        'Monitor daily, adjust bids, test variations'
      ],
      diyTime: '⏱️ Setup: 20-30 hrs | 🔄 Ongoing: 10-15 hrs/week',
      dfy: [
        'Campaign strategy & setup',
        'Custom audience targeting (location, demographics, behaviors)',
        'Professional ad creative (images, video, carousels)',
        'Weekly fresh copy to prevent ad fatigue',
        'Landing pages optimized for each practice area',
        'Pixel installation & conversion tracking',
        'A/B testing & continuous optimization',
        'Monthly performance reports',
        'Budget management across platforms'
      ],
      dfyResult: 'You approve the budget. We make Meta Ads work.'
    },
    googleAds: {
      title: 'Get Optimized — Google Ads',
      problem: "When someone searches \"attorney near me\" at 2 AM, your competitor shows up first. You don't.",
      diy: [
        'Audit current campaigns for wasted spend',
        'Research 200+ keywords for your practice areas',
        'Add negative keywords weekly',
        'Build landing pages for each service',
        'Set up call tracking & form conversion tracking',
        'Write ad copy variations',
        'Adjust bids by device, time, location',
        'Monitor search terms daily'
      ],
      diyTime: '⏱️ Setup: 15-25 hrs | 🔄 Ongoing: 8-12 hrs/week',
      dfy: [
        'Full account audit & restructure',
        'Keyword research (500+ terms)',
        'Negative keyword optimization',
        'Landing page creation & optimization',
        'Ad copy testing (weekly variations)',
        'Call tracking & conversion setup',
        'Bid management & budget optimization',
        'Competitor monitoring',
        'Monthly performance reports'
      ],
      dfyResult: 'Same budget. Better results. More qualified consultations.'
    },
    support24x7: {
      title: 'Get Answered — 24/7 AI Voice',
      problem: '73% of leads come outside business hours. When they call and get voicemail, they call the next firm.',
      diy: [
        'Research AI voice platforms',
        'Write intake scripts for each practice area',
        'Configure qualification logic',
        'Set up calendar integration for booking',
        'Connect to your CRM',
        'Test thoroughly',
        'Monitor and optimize weekly'
      ],
      diyTime: '⏱️ Setup: 12-20 hrs | 🔄 Ongoing: 3-5 hrs/week',
      dfy: [
        'AI voice system setup',
        'Custom intake scripts for each practice area',
        'Qualification logic (case type, urgency, budget)',
        'Calendar integration for direct booking',
        'CRM integration for lead delivery',
        'Call recording & transcription',
        'Multi-language support',
        'Ongoing optimization'
      ],
      dfyResult: 'Capture leads 24/7. No more missed calls.'
    },
    websiteSpeed: {
      title: 'Get Fast — Website Optimization',
      problem: `Your site takes ${(research.pageSpeed / 1000).toFixed(1)}s to load. Every extra second = 7% conversion loss.`,
      diy: [
        'Run PageSpeed Insights audit',
        'Compress and optimize all images',
        'Minify CSS/JavaScript',
        'Enable browser caching',
        'Upgrade hosting if needed',
        'Implement CDN',
        'Remove unnecessary plugins',
        'Test on mobile devices'
      ],
      diyTime: '⏱️ Setup: 8-15 hrs | 🔄 Ongoing: 2-4 hrs/month',
      dfy: [
        'Full speed audit',
        'Image optimization (WebP conversion)',
        'Code minification',
        'Caching setup',
        'CDN implementation',
        'Mobile optimization',
        'Ongoing monitoring',
        'Monthly performance reports'
      ],
      dfyResult: '<2 second load time. Better rankings. More conversions.'
    },
    crm: {
      title: 'Get Organized — CRM & Automation',
      problem: 'Manual follow-up wastes 15+ hrs/week and loses 40% of warm leads. Automation closes the gap.',
      diy: [
        'Choose a CRM (Clio, MyCase, etc.)',
        'Migrate existing contacts',
        'Build email sequences for each lead type',
        'Set up automated follow-ups',
        'Create SMS workflows',
        'Train staff on the system',
        'Monitor weekly, optimize monthly'
      ],
      diyTime: '⏱️ Setup: 15-25 hrs | 🔄 Ongoing: 5-8 hrs/week',
      dfy: [
        'CRM selection & setup',
        'Contact migration',
        'Automated email sequences',
        'SMS workflows',
        'Lead scoring & routing',
        'Follow-up automation',
        'Staff training',
        'Monthly optimization'
      ],
      dfyResult: 'Every lead gets systematic follow-up. Close rates improve 15-30%.'
    }
  };
  
  const playbook = playbooks[gapName];
  if (!playbook) return '';
  
  return `
    <div class="playbook-card">
      <div class="playbook-header">
        <div class="playbook-number">${String(number).padStart(2, '0')}</div>
        <div class="playbook-title-group">
          <div class="playbook-title">${playbook.title}</div>
          <div class="playbook-problem">${playbook.problem}</div>
        </div>
      </div>
      <div class="playbook-content">
        <div class="playbook-diy">
          <div class="playbook-column-title">🛠️ DIY Fix</div>
          <div class="playbook-steps">
            ${playbook.diy.map((step, i) => `
              <div class="playbook-step">
                <span class="playbook-step-num">${i + 1}</span>${step}
              </div>
            `).join('')}
          </div>
          <div class="playbook-time">${playbook.diyTime}</div>
        </div>
        <div class="playbook-done-for-you">
          <div class="playbook-column-title">✨ We Handle All of This</div>
          <ul class="playbook-dfy-list">
            ${playbook.dfy.map(item => `<li>${item}</li>`).join('')}
          </ul>
          <div class="playbook-dfy-result">${playbook.dfyResult}</div>
        </div>
      </div>
    </div>
  `;
}

function generateCTA() {
  return `
    <div class="cta-section" id="cta">
      <div class="cta-title">Let's Fix Your Lead Funnel</div>
      <p class="cta-subtitle">
        Book 15 minutes. We'll walk through your specific situation and show you exactly 
        where the gaps are (no pitch, no pressure).
      </p>
      <a href="https://calendly.com/yaseer-mortarmetrics" class="cta-button" target="_blank">
        Schedule Your Free Analysis
      </a>
      <p style="margin-top: 30px; font-size: 0.95rem; opacity: 0.9;">
        Or reply to this email — I read every message personally.
      </p>
    </div>
  `;
}

function getFooter() {
  return `
    <div class="footer">
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
        This report was generated ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} based on publicly available data and industry benchmarks.
      </p>
    </div>
  `;
}

function getCSS() {
  return `
  <style>
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

    /* Story Mini */
    .story-mini { background: var(--white); border-left: 4px solid var(--danger); padding: 24px 28px; margin: 40px 0; border-radius: 0 16px 16px 0; }
    .story-mini-text { font-size: 1.05rem; color: var(--ink); margin-bottom: 8px; }
    .story-mini-outcome { font-size: 0.9rem; color: var(--slate); font-style: italic; }

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
    .playbook-time { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--slate); }
    .playbook-dfy-list { list-style: none; padding: 0; margin: 0; }
    .playbook-dfy-list li { padding: 6px 0; font-size: 0.8rem; color: var(--ink); display: flex; align-items: flex-start; gap: 8px; line-height: 1.4; }
    .playbook-dfy-list li::before { content: "✓"; color: var(--success); font-weight: 700; }
    .playbook-dfy-result { font-size: 0.85rem; font-weight: 600; color: var(--brand-primary); margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }

    /* CTA */
    .cta-section { background: linear-gradient(135deg, var(--ink), var(--brand-primary)); border-radius: 24px; padding: 60px 44px; text-align: center; margin: 60px 0; position: relative; overflow: hidden; }
    .cta-section::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 20% 30%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(96,165,250,0.1) 0%, transparent 40%); pointer-events: none; }
    .cta-title { font-family: 'Fraunces', serif; font-size: clamp(1.6rem, 4vw, 2.2rem); color: var(--white); margin-bottom: 14px; }
    .cta-subtitle { font-size: 1rem; color: rgba(255,255,255,0.8); margin-bottom: 36px; max-width: 550px; margin-left: auto; margin-right: auto; }
    .cta-button { display: inline-block; background: white; color: var(--ink); padding: 15px 40px; border-radius: 100px; text-decoration: none; font-weight: 700; font-size: 1.1rem; margin-top: 20px; transition: transform 0.2s; }
    .cta-button:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(255,255,255,0.3); }

    /* Footer */
    .footer { text-align: center; padding: 40px 0 24px; border-top: 1px solid var(--border); margin-top: 60px; }
    .footer-brand { display: flex; justify-content: center; align-items: center; gap: 12px; margin-bottom: 16px; }
    .footer-logo { width: 40px; height: 40px; background: var(--brand-blue); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 14px; color: var(--white); font-weight: 600; }
    .footer-name { font-family: 'Fraunces', serif; font-size: 1.15rem; color: var(--ink); }

    /* Animations */
    .reveal { opacity: 0; transform: translateY(30px); transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
    .reveal.visible { opacity: 1; transform: translateY(0); }
  </style>
  `;
}

function getJavaScript() {
  return `
  <script>
    // Scroll indicator
    window.addEventListener('scroll', () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = (window.scrollY / height) * 100;
      document.getElementById('scrollIndicator').style.width = scrolled + '%';
    });

    // Reveal animations
    const reveals = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });
    
    reveals.forEach(reveal => revealObserver.observe(reveal));

    // Calculator
    const inquiries = document.getElementById('inquiries');
    const afterHours = document.getElementById('afterHours');
    const caseValue = document.getElementById('caseValue');
    const closeRate = document.getElementById('closeRate');

    function formatCurrency(num) {
      return '$' + Math.round(num).toLocaleString();
    }

    function calculate() {
      const inq = parseInt(inquiries.value);
      const afterPct = parseInt(afterHours.value) / 100;
      const caseVal = parseInt(caseValue.value);
      const closePct = parseInt(closeRate.value) / 100;

      // Update displayed values
      document.getElementById('inquiriesValue').textContent = inq;
      document.getElementById('afterHoursValue').textContent = Math.round(afterPct * 100) + '%';
      document.getElementById('caseValueValue').textContent = formatCurrency(caseVal);
      document.getElementById('closeRateValue').textContent = Math.round(closePct * 100) + '%';

      // Calculate losses
      const afterHoursLeads = inq * afterPct;
      const currentCapture = afterHoursLeads * 0.3; // 30% capture without 24/7
      const lostLeads = afterHoursLeads - currentCapture;
      const monthlyLost = lostLeads * closePct * caseVal;

      // With optimization
      const optimizedCapture = afterHoursLeads * 0.85; // 85% with 24/7 + automation
      const newLeads = optimizedCapture - currentCapture;
      const monthlyRecovered = newLeads * (closePct * 1.3) * caseVal; // 30% better close rate

      const annualTotal = monthlyRecovered * 12;
      const newClientsPerMonth = newLeads * (closePct * 1.3);

      // Update results
      document.getElementById('lostMonthly').textContent = formatCurrency(monthlyLost);
      document.getElementById('recoverMonthly').textContent = formatCurrency(monthlyRecovered);
      document.getElementById('annualTotal').textContent = formatCurrency(annualTotal);
      document.getElementById('newClients').textContent = newClientsPerMonth.toFixed(1);
    }

    inquiries.addEventListener('input', calculate);
    afterHours.addEventListener('input', calculate);
    caseValue.addEventListener('input', calculate);
    closeRate.addEventListener('input', calculate);

    calculate();
  </script>
  `;
}

// CLI
if (require.main === module) {
  const researchFile = process.argv[2];
  const prospectName = process.argv[3];
  
  if (!researchFile || !prospectName) {
    console.error('Usage: node report-generator-v2.js <research-file.json> <"Prospect Name">');
    console.error('Example: node report-generator-v2.js reports/smith-law-research.json "John Smith"');
    process.exit(1);
  }
  
  if (!fs.existsSync(researchFile)) {
    console.error(`Error: Research file not found: ${researchFile}`);
    process.exit(1);
  }
  
  const researchData = JSON.parse(fs.readFileSync(researchFile, 'utf-8'));
  const html = generateReport(researchData, prospectName);
  
  const firmSlug = researchData.firmName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const filename = path.join(__dirname, 'reports', `${firmSlug}-report.html`);
  
  fs.writeFileSync(filename, html);
  console.log(`✅ Report generated: ${filename}`);
  console.log(`\n👉 Open in browser: open "${filename}"`);
}

module.exports = { generateReport };
