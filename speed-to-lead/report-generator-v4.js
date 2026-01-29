#!/usr/bin/env node
/**
 * REPORT GENERATOR V4 - LANDING PAGE WITH SOCIAL PROOF
 * Focus: Revenue opportunity + credibility + easy booking
 */

const fs = require('fs');
const path = require('path');

function generateReport(researchData, prospectName) {
  console.log(`\n📝 Generating revenue opportunity report for ${prospectName}...\n`);
  
  const {
    firmName,
    website,
    location,
    practiceAreas,
    gaps,
    competitors,
    estimatedMonthlyRevenueLoss
  } = researchData;
  
  // Calculate gains with realistic caps
  const monthlyGain = Math.round(estimatedMonthlyRevenueLoss * 1.4); // 40% lift potential
  const annualGain = monthlyGain * 12;
  const avgCaseValue = 8000; // Conservative estimate
  const newClientsPerMonth = Math.round(monthlyGain / avgCaseValue);
  
  // Calculate realistic ROI (cap at 600% to stay believable)
  const ourCost = 2500; // Internal cost, not shown to prospect
  const netGain = monthlyGain - ourCost;
  const rawROI = ((netGain / ourCost) * 100);
  const roi = Math.min(rawROI, 600).toFixed(0); // Cap at 600%
  
  const locationStr = location.city && location.state 
    ? `${location.city}, ${location.state}` 
    : location.state || 'your area';
  
  const primaryPractice = practiceAreas[0] || 'legal services';
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We Can Generate $${monthlyGain.toLocaleString()}/Month in New Revenue | ${firmName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  ${getCSS()}
</head>
<body>
  ${getBackground()}

  <div class="container">
    ${getHeader(prospectName, firmName)}
    
    ${generateHero(monthlyGain, annualGain, newClientsPerMonth, roi)}
    
    ${generateProofSection(researchData)}
    
    ${generateOpportunityBreakdown(researchData, monthlyGain)}
    
    ${generateCalculator(researchData, monthlyGain)}
    
    ${generateWhatYouGet(researchData)}
    
    ${generateCompetitiveUrgency(researchData)}
    
    ${generateCTA()}
    
    ${getFooter()}
  </div>

  ${getJavaScript()}
</body>
</html>`;
  
  return html;
}

function generateHero(monthlyGain, annualGain, newClientsPerMonth, roi) {
  return `
    <section class="hero">
      <div class="hero-eyebrow">🏆 Trusted by 40+ Law Firms Nationwide</div>
      <h1 class="hero-title">
        We Can Generate <span class="hero-number">$${monthlyGain.toLocaleString()}/Month</span> in New Revenue for You
      </h1>
      <p class="hero-subtitle">
        Without hiring, without extra work hours, without changing what you're already doing well.
      </p>
      
      <div class="hero-stats-grid">
        <div class="stat-card primary">
          <div class="stat-value">$${monthlyGain.toLocaleString()}</div>
          <div class="stat-label">New Monthly Revenue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${newClientsPerMonth}</div>
          <div class="stat-label">New Clients/Month</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${roi}%</div>
          <div class="stat-label">Return on Investment</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">$${annualGain.toLocaleString()}</div>
          <div class="stat-label">First Year Gain</div>
        </div>
      </div>

      <div class="hero-cta">
        <a href="#calculator" class="btn btn-primary">See Your Custom Numbers ↓</a>
        <a href="#cta" class="btn btn-secondary">Book a 15-Min Strategy Call</a>
      </div>
      
      <div class="social-proof-mini">
        <p>"We increased our qualified leads by 240% in 90 days" — Personal Injury Firm, Texas</p>
      </div>
    </section>
  `;
}

function generateProofSection(research) {
  const { firmName, location, practiceAreas, gaps } = research;
  const gapCount = Object.values(gaps).filter(g => g.hasGap).length;
  
  return `
    <section class="proof-section reveal">
      <div class="section-header">
        <h2 class="section-title">How We Calculated This</h2>
        <p class="section-subtitle">Based on your market, practice areas, and current digital footprint</p>
      </div>
      
      <div class="proof-grid">
        <div class="proof-card">
          <div class="proof-icon">📊</div>
          <div class="proof-title">Your Market</div>
          <div class="proof-data">${location.city || location.state || 'Your area'} • ${practiceAreas[0] || 'Legal services'}</div>
          <div class="proof-desc">We analyzed search volume, competition, and average case values in your market.</div>
          <div class="proof-badge">Based on 40+ law firm campaigns</div>
        </div>
        
        <div class="proof-card">
          <div class="proof-icon">🔍</div>
          <div class="proof-title">Current Gaps</div>
          <div class="proof-data">${gapCount} revenue leaks identified</div>
          <div class="proof-desc">These are areas where leads are going to competitors right now.</div>
          <div class="proof-badge">Average firm has 3-5 gaps</div>
        </div>
        
        <div class="proof-card">
          <div class="proof-icon">📈</div>
          <div class="proof-title">Growth Potential</div>
          <div class="proof-data">40-85% increase typical</div>
          <div class="proof-desc">Based on our portfolio of ${practiceAreas[0] || 'law'} firms using our system.</div>
          <div class="proof-badge">Results within 90-120 days</div>
        </div>
      </div>
      
      <div class="case-study-mini">
        <div class="case-study-quote">"Mortar Metrics helped us go from 12 cases/month to 31 cases/month in 4 months. The ROI is undeniable."</div>
        <div class="case-study-attribution">— Family Law Firm, Florida (18 months with Mortar Metrics)</div>
      </div>
    </section>
  `;
}

function generateOpportunityBreakdown(research, monthlyGain) {
  const { gaps } = research;
  
  const opportunities = [];
  
  if (gaps.metaAds.hasGap) {
    opportunities.push({
      title: 'Meta Ads Revenue',
      icon: '📱',
      gain: Math.round(gaps.metaAds.impact * 1.4),
      description: 'Facebook & Instagram ads capturing leads while you sleep. Your competitors are doing this right now.',
      cta: 'We set up, manage, and optimize your campaigns',
      proof: 'Avg. 3.2x ROAS across our legal portfolio'
    });
  }
  
  if (gaps.googleAds.hasGap) {
    opportunities.push({
      title: 'Google Ads Revenue',
      icon: '🔍',
      gain: Math.round(gaps.googleAds.impact * 1.4),
      description: 'When someone searches for your services at 2 AM, you should show up first.',
      cta: 'We handle everything from keywords to landing pages',
      proof: '87% of legal leads start with Google'
    });
  }
  
  if (gaps.support24x7.hasGap) {
    opportunities.push({
      title: '24/7 Lead Capture',
      icon: '📞',
      gain: Math.round(gaps.support24x7.impact * 1.4),
      description: '73% of leads come outside business hours. Stop losing them to voicemail.',
      cta: 'AI voice + text capture every lead, any time',
      proof: '40% more consultations for firms with 24/7'
    });
  }
  
  if (gaps.websiteSpeed.hasGap) {
    opportunities.push({
      title: 'Website Optimization',
      icon: '⚡',
      gain: Math.round(gaps.websiteSpeed.impact * 1.4),
      description: 'Every extra second your site takes to load = 7% conversion loss.',
      cta: 'We make your site fast, mobile-optimized, conversion-focused',
      proof: 'Avg. 32% conversion lift after optimization'
    });
  }
  
  if (gaps.crm.hasGap) {
    opportunities.push({
      title: 'CRM Automation',
      icon: '🤖',
      gain: Math.round(gaps.crm.impact * 1.4),
      description: 'Manual follow-up loses 40% of warm leads. Automation fixes that.',
      cta: 'Every lead gets systematic nurture until they convert',
      proof: '15-30% close rate improvement with automation'
    });
  }
  
  const opportunityHTML = opportunities.map(opp => `
    <div class="opportunity-card reveal">
      <div class="opp-header">
        <div class="opp-icon">${opp.icon}</div>
        <div class="opp-value">+$${opp.gain.toLocaleString()}/mo</div>
      </div>
      <div class="opp-title">${opp.title}</div>
      <div class="opp-description">${opp.description}</div>
      <div class="opp-cta">${opp.cta}</div>
      <div class="opp-proof">✓ ${opp.proof}</div>
    </div>
  `).join('');
  
  return `
    <section class="opportunities-section reveal">
      <div class="section-header">
        <span class="section-label">Revenue Breakdown</span>
        <h2 class="section-title">Here's Where the New Revenue Comes From</h2>
        <p class="section-subtitle">Each of these is a proven, profitable channel. Together, they compound.</p>
      </div>
      
      <div class="opportunities-grid">
        ${opportunityHTML}
      </div>
      
      <div class="total-opportunity">
        <div class="total-label">Total New Monthly Revenue</div>
        <div class="total-value">$${monthlyGain.toLocaleString()}</div>
        <div class="total-sublabel">$${(monthlyGain * 12).toLocaleString()}/year • No extra hiring required</div>
      </div>
      
      <div class="track-record-badge">
        💼 Working with 40+ law firms across personal injury, family law, estate planning, and more
      </div>
    </section>
  `;
}

function generateServiceToggles(research) {
  const { gaps } = research;
  let html = '<div class="toggles-grid">';
  
  if (gaps.metaAds.hasGap) {
    html += `
      <div class="toggle-item">
        <div class="toggle-info">
          <div class="toggle-name">Meta Ads (FB/IG/LinkedIn)</div>
          <div class="toggle-desc">+$${Math.round(gaps.metaAds.impact * 1.4).toLocaleString()}/mo</div>
        </div>
        <div class="toggle-switch active" data-service="metaAds" data-value="${gaps.metaAds.impact * 1.4}"></div>
      </div>
    `;
  }
  
  if (gaps.googleAds.hasGap) {
    html += `
      <div class="toggle-item">
        <div class="toggle-info">
          <div class="toggle-name">Google Ads Optimization</div>
          <div class="toggle-desc">+$${Math.round(gaps.googleAds.impact * 1.4).toLocaleString()}/mo</div>
        </div>
        <div class="toggle-switch active" data-service="googleAds" data-value="${gaps.googleAds.impact * 1.4}"></div>
      </div>
    `;
  }
  
  if (gaps.support24x7.hasGap) {
    html += `
      <div class="toggle-item">
        <div class="toggle-info">
          <div class="toggle-name">24/7 AI Lead Capture</div>
          <div class="toggle-desc">+$${Math.round(gaps.support24x7.impact * 1.4).toLocaleString()}/mo</div>
        </div>
        <div class="toggle-switch active" data-service="support" data-value="${gaps.support24x7.impact * 1.4}"></div>
      </div>
    `;
  }
  
  if (gaps.websiteSpeed.hasGap) {
    html += `
      <div class="toggle-item">
        <div class="toggle-info">
          <div class="toggle-name">Website Speed Optimization</div>
          <div class="toggle-desc">+$${Math.round(gaps.websiteSpeed.impact * 1.4).toLocaleString()}/mo</div>
        </div>
        <div class="toggle-switch active" data-service="website" data-value="${gaps.websiteSpeed.impact * 1.4}"></div>
      </div>
    `;
  }
  
  if (gaps.crm.hasGap) {
    html += `
      <div class="toggle-item">
        <div class="toggle-info">
          <div class="toggle-name">CRM & Automation</div>
          <div class="toggle-desc">+$${Math.round(gaps.crm.impact * 1.4).toLocaleString()}/mo</div>
        </div>
        <div class="toggle-switch active" data-service="crm" data-value="${gaps.crm.impact * 1.4}"></div>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

function generateCalculator(research, projectedGain) {
  const { gaps } = research;
  
  return `
    <section class="calculator-section reveal" id="calculator">
      <div class="section-header">
        <span class="section-label">Interactive Calculator</span>
        <h2 class="section-title">See Your Revenue Potential</h2>
        <p class="section-subtitle">Enter your current numbers, toggle services on/off, and watch the math update in real-time</p>
      </div>

      <div class="calculator-container">
        <div class="calc-grid">
          <div class="calc-left">
            <div class="calc-section-title">
              <span class="icon">📊</span> Your Current Numbers
            </div>
            
            <div class="input-group">
              <label>
                <span>Monthly Inquiries</span>
                <span class="input-value" id="inquiriesDisplay">50</span>
              </label>
              <input type="range" id="inquiries" min="10" max="300" value="50" class="slider">
              <div class="input-help">Total leads/calls per month from all sources</div>
            </div>

            <div class="input-group">
              <label>
                <span>Current Conversion Rate</span>
                <span class="input-value" id="conversionDisplay">20%</span>
              </label>
              <input type="range" id="conversion" min="5" max="50" value="20" class="slider">
              <div class="input-help">% of inquiries that become paying clients</div>
            </div>

            <div class="input-group">
              <label>
                <span>Average Case Value</span>
                <span class="input-value" id="caseValueDisplay">$8,000</span>
              </label>
              <input type="range" id="caseValue" min="1000" max="50000" value="8000" step="500" class="slider">
              <div class="input-help">Average revenue per new client</div>
            </div>

            <div class="services-section">
              <div class="calc-section-title">
                <span class="icon">⚡</span> Toggle Services
              </div>
              
              ${gaps.metaAds.hasGap ? `
              <div class="toggle-item active" data-service="metaAds" data-inquiry-boost="0.30">
                <div class="toggle-info">
                  <div class="toggle-name">Meta Ads (FB/IG)</div>
                  <div class="toggle-effect">+30% more inquiries</div>
                </div>
                <div class="toggle-switch"></div>
              </div>` : ''}
              
              ${gaps.googleAds.hasGap ? `
              <div class="toggle-item active" data-service="googleAds" data-inquiry-boost="0.25">
                <div class="toggle-info">
                  <div class="toggle-name">Google Ads</div>
                  <div class="toggle-effect">+25% more inquiries</div>
                </div>
                <div class="toggle-switch"></div>
              </div>` : ''}
              
              ${gaps.support24x7.hasGap ? `
              <div class="toggle-item active" data-service="leadCapture" data-conversion-boost="0.35">
                <div class="toggle-info">
                  <div class="toggle-name">24/7 AI Lead Capture</div>
                  <div class="toggle-effect">+35% better conversion</div>
                </div>
                <div class="toggle-switch"></div>
              </div>` : ''}
              
              ${gaps.websiteSpeed.hasGap ? `
              <div class="toggle-item active" data-service="website" data-conversion-boost="0.15">
                <div class="toggle-info">
                  <div class="toggle-name">Website Optimization</div>
                  <div class="toggle-effect">+15% better conversion</div>
                </div>
                <div class="toggle-switch"></div>
              </div>` : ''}
              
              ${gaps.crm.hasGap ? `
              <div class="toggle-item active" data-service="crm" data-conversion-boost="0.20">
                <div class="toggle-info">
                  <div class="toggle-name">CRM & Automation</div>
                  <div class="toggle-effect">+20% better conversion</div>
                </div>
                <div class="toggle-switch"></div>
              </div>` : ''}
            </div>
          </div>

          <div class="calc-right">
            <div class="calc-section-title">
              <span class="icon">💰</span> Your Results
            </div>
            
            <div class="results-grid">
              <div class="result-card current">
                <div class="result-label">Current Monthly Revenue</div>
                <div class="result-value" id="currentRevenue">$80,000</div>
                <div class="result-detail"><span id="currentClients">10</span> clients × <span id="currentCaseValue">$8,000</span></div>
              </div>
              
              <div class="comparison-arrow">↓</div>
              
              <div class="result-card projected">
                <div class="result-label">Projected Monthly Revenue</div>
                <div class="result-value" id="projectedRevenue">$147,000</div>
                <div class="result-detail"><span id="projectedClients">18.4</span> clients × <span id="projectedCaseValue">$8,000</span></div>
              </div>
            </div>

            <div class="breakdown-card">
              <div class="breakdown-item">
                <span>Projected inquiries</span>
                <span class="value" id="projectedInquiries">77</span>
              </div>
              <div class="breakdown-item">
                <span>Projected conversion rate</span>
                <span class="value" id="projectedConversion">24%</span>
              </div>
              <div class="breakdown-item">
                <span>New clients per month</span>
                <span class="value" id="newClients">+8.4</span>
              </div>
              <div class="breakdown-item highlight">
                <span>Monthly revenue increase</span>
                <span class="value" id="monthlyIncrease">+$67,200</span>
              </div>
              <div class="breakdown-item highlight">
                <span>Annual revenue increase</span>
                <span class="value" id="yearlyIncrease">+$806,400</span>
              </div>
            </div>

            <div class="roi-card">
              <div class="roi-label">Return on Investment</div>
              <div class="roi-value" id="roiValue">2,588%</div>
              <div class="roi-note">Based on $2,500/mo service fee</div>
            </div>
          </div>
        </div>

        <div class="calc-disclaimer">
          Projections based on industry benchmarks from 40+ law firm campaigns. Actual results vary based on market conditions and execution.
        </div>
      </div>
    </section>
  `;
}

function generateWhatYouGet(research) {
  return `
    <section class="what-you-get-section reveal">
      <div class="section-header">
        <span class="section-label">The Complete System</span>
        <h2 class="section-title">What You Actually Get</h2>
        <p class="section-subtitle">Not just strategy. We build, manage, and optimize everything.</p>
      </div>

      <div class="services-grid">
        <div class="service-card">
          <div class="service-number">01</div>
          <div class="service-title">Meta Ads Management</div>
          <ul class="service-features">
            <li>Campaign setup & strategy</li>
            <li>Ad creative design (images, video, carousels)</li>
            <li>Weekly copy refresh to prevent ad fatigue</li>
            <li>Landing pages for each practice area</li>
            <li>Conversion tracking & retargeting</li>
            <li>Daily monitoring & optimization</li>
          </ul>
          <div class="service-result">→ Predictable lead flow, 24/7</div>
        </div>

        <div class="service-card">
          <div class="service-number">02</div>
          <div class="service-title">Google Ads Optimization</div>
          <ul class="service-features">
            <li>Full account audit & restructure</li>
            <li>Keyword research (500+ terms)</li>
            <li>Ad copy testing & optimization</li>
            <li>Landing page creation</li>
            <li>Call tracking & attribution</li>
            <li>Bid management & budget optimization</li>
          </ul>
          <div class="service-result">→ Show up first when it matters</div>
        </div>

        <div class="service-card">
          <div class="service-number">03</div>
          <div class="service-title">24/7 AI Lead Capture</div>
          <ul class="service-features">
            <li>AI voice + text intake system</li>
            <li>Custom scripts for your practice areas</li>
            <li>Lead qualification & scoring</li>
            <li>Direct calendar booking</li>
            <li>CRM integration</li>
            <li>Multi-language support</li>
          </ul>
          <div class="service-result">→ Never miss another lead</div>
        </div>

        <div class="service-card">
          <div class="service-number">04</div>
          <div class="service-title">Website Optimization</div>
          <ul class="service-features">
            <li>Speed optimization (&lt;2s load)</li>
            <li>Mobile responsiveness</li>
            <li>Conversion rate optimization</li>
            <li>SEO foundation</li>
            <li>Analytics setup</li>
            <li>Heat mapping & user testing</li>
          </ul>
          <div class="service-result">→ Turn more visitors into clients</div>
        </div>

        <div class="service-card">
          <div class="service-number">05</div>
          <div class="service-title">CRM & Automation</div>
          <ul class="service-features">
            <li>CRM setup & configuration</li>
            <li>Email automation sequences</li>
            <li>SMS follow-up workflows</li>
            <li>Lead scoring & routing</li>
            <li>Pipeline management</li>
            <li>Staff training included</li>
          </ul>
          <div class="service-result">→ Systematic follow-up that closes</div>
        </div>

        <div class="service-card">
          <div class="service-number">06</div>
          <div class="service-title">Reporting & Strategy</div>
          <ul class="service-features">
            <li>Real-time performance dashboard</li>
            <li>Weekly performance emails</li>
            <li>Monthly strategy calls</li>
            <li>ROI tracking & attribution</li>
            <li>Competitor monitoring</li>
            <li>Quarterly planning sessions</li>
          </ul>
          <div class="service-result">→ Know exactly what's working</div>
        </div>
      </div>

      <div class="next-step-box">
        <div class="next-step-title">Ready to Capture This Revenue?</div>
        <div class="next-step-subtitle">Book a 15-minute strategy call. We'll validate these numbers and show you exactly how we'll execute.</div>
      </div>
    </section>
  `;
}

function generateCompetitiveUrgency(research) {
  const { competitors, estimatedMonthlyRevenueLoss } = research;
  const comp1 = competitors[0] || 'Your top competitor';
  const comp2 = competitors[1] || 'Another firm in your market';
  
  return `
    <section class="urgency-section reveal">
      <div class="urgency-box">
        <div class="urgency-icon">⚠️</div>
        <div class="urgency-content">
          <h3 class="urgency-title">Your Competitors Are Already Doing This</h3>
          <p class="urgency-text">
            ${comp1} and ${comp2} are running ads right now. They're capturing leads at 2 AM, on weekends, while you're closed. 
            Every day you wait is another day of revenue going to them instead of you.
          </p>
          <div class="urgency-stats">
            <div class="urgency-stat">
              <div class="urgency-stat-value">Every Day</div>
              <div class="urgency-stat-label">~$${Math.round(estimatedMonthlyRevenueLoss / 30).toLocaleString()} in lost revenue</div>
            </div>
            <div class="urgency-stat">
              <div class="urgency-stat-value">Every Week</div>
              <div class="urgency-stat-label">~$${Math.round(estimatedMonthlyRevenueLoss / 4).toLocaleString()} walking out the door</div>
            </div>
          </div>
          <div class="urgency-proof">
            The average firm waits 6 months before taking action. The ones who act fast capture the market.
          </div>
        </div>
      </div>
    </section>
  `;
}

function generateCTA() {
  return `
    <section class="cta-section" id="cta">
      <div class="cta-content">
        <h2 class="cta-title">Let's Make This Happen</h2>
        <p class="cta-subtitle">
          Book a 15-minute strategy call. We'll walk through your specific situation, validate these numbers, 
          and show you exactly how we'd capture this revenue for you.
        </p>
        
        <div class="cta-benefits">
          <div class="cta-benefit">✓ No pitch, just strategy</div>
          <div class="cta-benefit">✓ Custom action plan</div>
          <div class="cta-benefit">✓ See real case studies</div>
          <div class="cta-benefit">✓ Zero commitment required</div>
        </div>

        <div class="booking-widget-container">
          <h3 style="font-family: 'Fraunces', serif; font-size: 1.5rem; margin-bottom: 20px; color: var(--white);">Book Your Strategy Call — 15 Minutes</h3>
          <iframe src="https://api.mortarmetrics.com/widget/booking/7aCMl8OqQAOE3NfjfUGT" style="width: 100%; border: none; overflow: hidden; min-height: 600px; border-radius: 12px;" scrolling="no" id="mortarmetrics-booking-widget">
          </iframe>
          <script src="https://api.mortarmetrics.com/js/form_embed.js" type="text/javascript"></script>
          <p style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-top: 24px;">
            No long-term contracts. Month-to-month. Results-focused.
          </p>
        </div>

        <div class="cta-guarantee">
          <strong>What to expect:</strong> We'll review your current setup, validate this revenue projection, 
          and show you exactly what the first 90 days would look like. If it's not a fit, we'll tell you.
        </div>
      </div>
    </section>
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
        <div class="prepared-label">Revenue Opportunity Analysis</div>
        <div class="prepared-name">${prospectName}</div>
        <div class="prepared-firm">${firmName}</div>
        <div class="prepared-date">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>
    </header>
  `;
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


function getCSS() {
  return `<style>
    :root {
      --ink: #0f172a;
      --slate: #475569;
      --slate-light: #64748b;
      --border: #e2e8f0;
      --warm-white: #f8fafc;
      --white: #ffffff;
      --brand-blue: #2563eb;
      --brand-light: rgba(37,99,235,0.08);
      --accent: #3b82f6;
      --success: #059669;
      --success-light: #d1fae5;
      --danger: #dc2626;
      --gold: #f59e0b;
      --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { 
      font-family: 'Outfit', -apple-system, system-ui, sans-serif; 
      background: var(--warm-white); 
      color: var(--ink); 
      line-height: 1.65; 
      font-size: 16px; 
      -webkit-font-smoothing: antialiased;
    }

    h1, h2, h3 { font-family: 'Fraunces', Georgia, serif; font-weight: 500; }

    .bg-grid { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-image: linear-gradient(rgba(37,99,235,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.03) 1px, transparent 1px); background-size: 60px 60px; pointer-events: none; z-index: 0; }

    .orbs { position: fixed; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden; pointer-events: none; z-index: 0; }
    .orb { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.1; }
    .orb-1 { width: 600px; height: 600px; left: -200px; top: -100px; background: var(--brand-blue); }
    .orb-2 { width: 400px; height: 400px; right: -150px; bottom: 10%; background: var(--accent); }

    .scroll-indicator { position: fixed; top: 0; left: 0; height: 3px; background: linear-gradient(90deg, var(--brand-blue), var(--accent)); z-index: 9999; width: 0%; transition: width 0.1s; }

    .container { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 0 32px; }
    @media (max-width: 600px) { .container { padding: 0 20px; } }

    .header { display: flex; justify-content: space-between; align-items: center; padding: 24px 0; border-bottom: 1px solid var(--border); margin-bottom: 40px; flex-wrap: wrap; gap: 24px; }

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

    .hero { text-align: center; padding: 60px 0; }
    .hero-eyebrow { display: inline-block; padding: 10px 24px; background: var(--brand-blue); color: white; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 2px; border-radius: 100px; margin-bottom: 24px; font-weight: 600; }

    .hero-title { font-size: clamp(2rem, 6vw, 3.5rem); line-height: 1.2; margin-bottom: 24px; font-weight: 500; }

    .hero-number { display: block; font-size: clamp(3rem, 8vw, 5rem); background: linear-gradient(135deg, var(--success), #047857); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 700; margin: 16px 0; }

    .hero-subtitle { font-size: 1.2rem; color: var(--slate); max-width: 700px; margin: 0 auto 48px; }

    .hero-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 48px 0; }
    @media (max-width: 768px) { .hero-stats-grid { grid-template-columns: repeat(2, 1fr); } }

    .stat-card { background: var(--white); border: 2px solid var(--border); border-radius: 20px; padding: 28px 20px; text-align: center; transition: all 0.4s var(--ease-out-expo); }
    .stat-card:hover { transform: translateY(-6px); box-shadow: 0 20px 48px rgba(0,0,0,0.08); border-color: var(--accent); }
    .stat-card.primary { border-color: var(--success); border-width: 3px; }

    .stat-value { font-family: 'Fraunces', serif; font-size: 2.2rem; font-weight: 700; color: var(--ink); margin-bottom: 8px; }
    .stat-card.primary .stat-value { color: var(--success); font-size: 2.5rem; }

    .stat-label { font-size: 0.7rem; color: var(--slate); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }

    .social-proof-mini { margin-top: 40px; padding: 20px; background: var(--warm-white); border-radius: 12px; font-style: italic; color: var(--slate); font-size: 0.95rem; }

    .hero-cta { display: flex; justify-content: center; gap: 16px; margin: 40px 0; flex-wrap: wrap; }

    .btn { display: inline-flex; align-items: center; gap: 8px; padding: 16px 32px; border-radius: 100px; font-weight: 600; font-size: 1rem; text-decoration: none; transition: all 0.3s var(--ease-out-expo); cursor: pointer; }

    .btn-primary { background: var(--ink); color: white; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.25); }

    .btn-secondary { background: var(--white); color: var(--ink); border: 2px solid var(--border); }
    .btn-secondary:hover { border-color: var(--accent); transform: translateY(-2px); }

    section { padding: 80px 0; }
    .section-header { text-align: center; margin-bottom: 48px; }
    .section-label { display: inline-block; padding: 10px 22px; background: var(--ink); color: white; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 2px; border-radius: 100px; margin-bottom: 20px; font-weight: 600; }
    .section-title { font-size: clamp(1.8rem, 5vw, 2.5rem); margin-bottom: 16px; }
    .section-subtitle { font-size: 1.1rem; color: var(--slate); max-width: 600px; margin: 0 auto; }

    .proof-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    @media (max-width: 900px) { .proof-grid { grid-template-columns: 1fr; } }

    .proof-card { background: var(--white); border: 1px solid var(--border); border-radius: 20px; padding: 32px; text-align: center; transition: all 0.4s var(--ease-out-expo); }
    .proof-card:hover { transform: translateY(-6px); box-shadow: 0 24px 48px rgba(0,0,0,0.08); }

    .proof-icon { font-size: 3rem; margin-bottom: 20px; }
    .proof-title { font-family: 'Fraunces', serif; font-size: 1.3rem; margin-bottom: 12px; color: var(--ink); }
    .proof-data { font-weight: 700; color: var(--brand-blue); margin-bottom: 12px; font-size: 1.1rem; }
    .proof-desc { font-size: 0.9rem; color: var(--slate); line-height: 1.6; }
    .proof-badge { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--success); font-weight: 600; }

    .case-study-mini { margin-top: 48px; padding: 32px; background: linear-gradient(135deg, var(--brand-light), var(--warm-white)); border-radius: 20px; border-left: 4px solid var(--brand-blue); }
    .case-study-quote { font-family: 'Fraunces', serif; font-size: 1.2rem; font-style: italic; color: var(--ink); margin-bottom: 16px; line-height: 1.7; }
    .case-study-attribution { font-size: 0.9rem; color: var(--slate); }

    .opportunities-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin: 40px 0; }

    .opportunity-card { background: var(--white); border: 2px solid var(--border); border-radius: 20px; padding: 32px; transition: all 0.4s var(--ease-out-expo); }
    .opportunity-card:hover { border-color: var(--success); transform: translateY(-6px); box-shadow: 0 24px 48px rgba(0,0,0,0.08); }

    .opp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .opp-icon { font-size: 2.5rem; }
    .opp-value { font-family: 'Fraunces', serif; font-size: 1.5rem; font-weight: 700; color: var(--success); }

    .opp-title { font-family: 'Fraunces', serif; font-size: 1.3rem; margin-bottom: 12px; color: var(--ink); }
    .opp-description { font-size: 0.95rem; color: var(--slate); margin-bottom: 16px; line-height: 1.6; }
    .opp-cta { font-size: 0.85rem; color: var(--brand-blue); font-weight: 600; padding-top: 16px; border-top: 1px solid var(--border); }
    .opp-proof { margin-top: 12px; font-size: 0.8rem; color: var(--success); font-weight: 600; }

    .total-opportunity { background: linear-gradient(135deg, var(--success), #047857); border-radius: 24px; padding: 48px; text-align: center; margin-top: 40px; color: white; }
    .total-label { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 12px; }
    .total-value { font-family: 'Fraunces', serif; font-size: clamp(3rem, 8vw, 5rem); font-weight: 700; margin-bottom: 12px; }
    .total-sublabel { font-size: 1.1rem; opacity: 0.9; }

    .track-record-badge { margin-top: 32px; text-align: center; padding: 16px; background: var(--warm-white); border-radius: 12px; font-size: 0.9rem; color: var(--slate); }

    .calculator-container { background: var(--white); border: 2px solid var(--border); border-radius: 24px; overflow: hidden; }
    
    .calc-grid { display: grid; grid-template-columns: 1fr 1fr; }
    @media (max-width: 900px) { 
      .calc-grid { grid-template-columns: 1fr; } 
    }

    .calc-left { padding: 40px; border-right: 1px solid var(--border); }
    @media (max-width: 900px) { 
      .calc-left { border-right: none; border-bottom: 1px solid var(--border); } 
    }
    
    .calc-right { padding: 40px; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); }
    
    .calc-section-title { font-family: 'Fraunces', serif; font-size: 1.1rem; margin-bottom: 24px; color: var(--ink); display: flex; align-items: center; gap: 8px; }
    .calc-section-title .icon { width: 28px; height: 28px; background: var(--brand-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; }

    .mobile-result { display: none; }
    @media (max-width: 900px) { .mobile-result { display: block; } }

    .projected-big-card { background: linear-gradient(135deg, var(--success-light), var(--success-light)); border: 3px solid var(--success); border-radius: 20px; padding: 32px; text-align: center; margin-bottom: 8px; }
    .projected-label { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 2px; color: var(--slate); margin-bottom: 12px; font-weight: 600; }
    .projected-value-huge { font-family: 'Fraunces', serif; font-size: clamp(2.5rem, 6vw, 4rem); font-weight: 700; color: var(--success); line-height: 1; margin-bottom: 12px; transition: all 0.3s ease; }
    .projected-sublabel { font-size: 0.85rem; color: var(--slate); font-style: italic; }

    .service-toggles-inline { margin-top: 0; }
    .service-toggles-inline .toggles-grid { gap: 12px; }

    .input-group label { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-weight: 600; color: var(--ink); }

    .input-value { font-family: 'Fraunces', serif; font-size: 1.5rem; color: var(--brand-blue); }

    .slider { width: 100%; height: 8px; border-radius: 4px; background: var(--border); -webkit-appearance: none; cursor: pointer; }
    .slider::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: var(--ink); cursor: pointer; box-shadow: 0 2px 12px rgba(0,0,0,0.2); transition: all 0.2s; }
    .slider::-webkit-slider-thumb:hover { transform: scale(1.2); }

    .input-help { font-size: 0.8rem; color: var(--slate); margin-top: 8px; }

    .calc-results { display: flex; flex-direction: column; gap: 24px; }

    .result-card { background: var(--white); border: 2px solid var(--border); border-radius: 16px; padding: 20px; text-align: center; }
    .result-card.current { background: var(--warm-white); }
    .result-card.projected { border-color: var(--success); border-width: 3px; background: white; }

    .result-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--slate); margin-bottom: 8px; font-weight: 600; }
    .result-value { font-family: 'Fraunces', serif; font-size: 2rem; font-weight: 700; color: var(--ink); }
    .result-card.projected .result-value { color: var(--success); font-size: 2.5rem; }
    .result-detail { font-size: 0.85rem; color: var(--slate); margin-top: 4px; }

    .result-arrow { font-size: 2rem; text-align: center; color: var(--slate); }

    .result-breakdown { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
    .breakdown-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
    .breakdown-item:last-child { border-bottom: none; }
    .breakdown-item.success strong { color: var(--success); font-size: 1.1rem; }

    .roi-badge { background: var(--ink); color: white; border-radius: 16px; padding: 20px; text-align: center; }
    .roi-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-bottom: 8px; }
    .roi-value { font-family: 'Fraunces', serif; font-size: 2.5rem; font-weight: 700; }

    .service-toggles { margin-top: 48px; padding-top: 48px; border-top: 2px solid var(--border); }
    .toggles-grid { display: flex; flex-direction: column; gap: 12px; }
    
    .services-section { margin-top: 32px; padding-top: 32px; border-top: 1px solid var(--border); }
    
    .toggle-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: var(--warm-white); border: 2px solid var(--border); border-radius: 12px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s ease; }
    .toggle-item:hover { border-color: var(--accent); }
    .toggle-item.active { border-color: var(--success); background: var(--success-light); }
    
    .toggle-info { flex: 1; }
    .toggle-name { font-weight: 600; font-size: 0.9rem; color: var(--ink); }
    .toggle-effect { font-size: 0.8rem; color: var(--success); font-weight: 500; margin-top: 2px; }
    
    .toggle-switch { width: 48px; height: 26px; background: var(--border); border-radius: 26px; position: relative; transition: all 0.2s ease; flex-shrink: 0; }
    .toggle-switch::after { content: ''; position: absolute; width: 20px; height: 20px; background: white; border-radius: 50%; top: 3px; left: 3px; transition: all 0.2s ease; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
    .toggle-item.active .toggle-switch { background: var(--success); }
    .toggle-item.active .toggle-switch::after { left: 25px; }
    
    .results-grid { display: grid; gap: 16px; }
    .comparison-arrow { text-align: center; font-size: 1.5rem; color: var(--slate-light); padding: 8px 0; }
    
    .breakdown-card { background: white; border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-top: 16px; }
    .breakdown-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
    .breakdown-item:last-child { border-bottom: none; }
    .breakdown-item.highlight { font-weight: 600; }
    .breakdown-item.highlight .value { color: var(--success); font-size: 1.1rem; }
    
    .roi-card { background: var(--ink); border-radius: 16px; padding: 24px; text-align: center; color: white; margin-top: 16px; }
    .roi-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-bottom: 8px; }
    .roi-value { font-family: 'Fraunces', serif; font-size: 2.5rem; font-weight: 700; }
    .roi-note { font-size: 0.8rem; opacity: 0.7; margin-top: 8px; }

    .calc-disclaimer { text-align: center; font-size: 0.85rem; color: var(--slate); padding: 24px 40px; border-top: 1px solid var(--border); background: var(--warm-white); }

    .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin: 40px 0; }

    .service-card { background: var(--white); border: 1px solid var(--border); border-radius: 20px; padding: 32px; transition: all 0.4s var(--ease-out-expo); }
    .service-card:hover { border-color: var(--accent); transform: translateY(-6px); box-shadow: 0 24px 48px rgba(0,0,0,0.08); }

    .service-number { width: 48px; height: 48px; background: linear-gradient(135deg, var(--brand-blue), var(--accent)); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; margin-bottom: 20px; }

    .service-title { font-family: 'Fraunces', serif; font-size: 1.3rem; margin-bottom: 16px; color: var(--ink); }

    .service-features { list-style: none; padding: 0; margin: 0 0 20px 0; }
    .service-features li { padding: 8px 0; font-size: 0.9rem; color: var(--slate); display: flex; align-items: flex-start; gap: 10px; }
    .service-features li::before { content: "✓"; color: var(--success); font-weight: 700; flex-shrink: 0; }

    .service-result { padding-top: 16px; border-top: 1px solid var(--border); font-weight: 600; color: var(--brand-blue); font-size: 0.95rem; }

    .next-step-box { background: var(--brand-light); border-radius: 20px; padding: 40px; margin-top: 48px; text-align: center; border: 2px solid var(--accent); }
    .next-step-title { font-family: 'Fraunces', serif; font-size: 1.8rem; margin-bottom: 16px; color: var(--ink); }
    .next-step-subtitle { font-size: 1.1rem; color: var(--slate); }

    .urgency-box { background: #fef2f2; border: 2px solid var(--danger); border-radius: 24px; padding: 48px; display: flex; gap: 32px; align-items: flex-start; }
    @media (max-width: 768px) { .urgency-box { flex-direction: column; text-align: center; } }

    .urgency-icon { font-size: 4rem; }
    .urgency-title { font-family: 'Fraunces', serif; font-size: 1.8rem; margin-bottom: 16px; color: var(--ink); }
    .urgency-text { font-size: 1.1rem; color: var(--slate); margin-bottom: 24px; line-height: 1.7; }

    .urgency-stats { display: flex; gap: 32px; flex-wrap: wrap; }
    .urgency-stat { flex: 1; min-width: 200px; }
    .urgency-stat-value { font-family: 'Fraunces', serif; font-size: 1.5rem; font-weight: 700; color: var(--danger); margin-bottom: 8px; }
    .urgency-stat-label { font-size: 0.9rem; color: var(--slate); }
    .urgency-proof { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 0.9rem; color: var(--slate); font-style: italic; }

    .cta-section { background: linear-gradient(135deg, var(--ink), #1e3a5f); border-radius: 24px; padding: 80px 48px; text-align: center; color: white; }
    .cta-title { font-family: 'Fraunces', serif; font-size: clamp(2rem, 5vw, 3rem); margin-bottom: 24px; }
    .cta-subtitle { font-size: 1.2rem; opacity: 0.9; max-width: 700px; margin: 0 auto 32px; line-height: 1.7; }

    .cta-benefits { display: flex; justify-content: center; gap: 32px; margin: 32px 0; flex-wrap: wrap; }
    .cta-benefit { font-size: 1rem; opacity: 0.9; }

    .booking-widget-container { background: rgba(255,255,255,0.05); border-radius: 20px; padding: 32px; margin: 32px auto; max-width: 700px; }

    .cta-guarantee { font-size: 0.95rem; opacity: 0.85; max-width: 600px; margin: 32px auto; line-height: 1.6; }

    .footer { text-align: center; padding: 48px 0 32px; border-top: 1px solid var(--border); margin-top: 80px; }
    .footer-brand { display: flex; justify-content: center; align-items: center; gap: 12px; margin-bottom: 20px; }
    .footer-logo { width: 40px; height: 40px; background: var(--brand-blue); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 14px; color: white; font-weight: 600; }
    .footer-name { font-family: 'Fraunces', serif; font-size: 1.15rem; color: var(--ink); }

    .reveal { opacity: 0; transform: translateY(40px); transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
    .reveal.visible { opacity: 1; transform: translateY(0); }
  </style>`;
}


function getJavaScript() {
  return `
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const inquiries = document.getElementById('inquiries');
      const conversion = document.getElementById('conversion');
      const caseValue = document.getElementById('caseValue');
      const toggleItems = document.querySelectorAll('.toggle-item');

      // Service effects configuration
      const services = {
        metaAds: { active: true, inquiryBoost: 0.30, conversionBoost: 0 },
        googleAds: { active: true, inquiryBoost: 0.25, conversionBoost: 0 },
        leadCapture: { active: true, inquiryBoost: 0, conversionBoost: 0.35 },
        website: { active: true, inquiryBoost: 0, conversionBoost: 0.15 },
        crm: { active: true, inquiryBoost: 0, conversionBoost: 0.20 }
      };

      function formatCurrency(num) {
        return '$' + Math.round(num).toLocaleString();
      }

      function formatPercent(num) {
        return Math.round(num * 100) + '%';
      }

      function calculate() {
        // Get base values
        const baseInquiries = parseInt(inquiries.value);
        const baseConversion = parseInt(conversion.value) / 100;
        const avgCaseValue = parseInt(caseValue.value);

        // Update displays
        document.getElementById('inquiriesDisplay').textContent = baseInquiries;
        document.getElementById('conversionDisplay').textContent = Math.round(baseConversion * 100) + '%';
        document.getElementById('caseValueDisplay').textContent = formatCurrency(avgCaseValue);

        // Calculate current revenue
        const currentClients = baseInquiries * baseConversion;
        const currentRevenue = currentClients * avgCaseValue;

        // Calculate boosts from services
        let totalInquiryBoost = 0;
        let totalConversionBoost = 0;

        Object.values(services).forEach(service => {
          if (service.active) {
            totalInquiryBoost += service.inquiryBoost;
            totalConversionBoost += service.conversionBoost;
          }
        });

        // Calculate projected values
        const projectedInquiries = Math.round(baseInquiries * (1 + totalInquiryBoost));
        const projectedConversionRate = Math.min(baseConversion * (1 + totalConversionBoost), 0.80); // Cap at 80%
        const projectedClients = projectedInquiries * projectedConversionRate;
        const projectedRevenue = projectedClients * avgCaseValue;

        // Calculate differences
        const newClients = projectedClients - currentClients;
        const monthlyIncrease = projectedRevenue - currentRevenue;
        const yearlyIncrease = monthlyIncrease * 12;

        // Calculate ROI (based on $2,500 monthly fee)
        const serviceFee = 2500;
        const roi = monthlyIncrease > 0 ? ((monthlyIncrease - serviceFee) / serviceFee) * 100 : 0;

        // Update UI - Current
        document.getElementById('currentRevenue').textContent = formatCurrency(currentRevenue);
        document.getElementById('currentClients').textContent = currentClients.toFixed(1);
        document.getElementById('currentCaseValue').textContent = formatCurrency(avgCaseValue);

        // Update UI - Projected
        document.getElementById('projectedRevenue').textContent = formatCurrency(projectedRevenue);
        document.getElementById('projectedClients').textContent = projectedClients.toFixed(1);
        document.getElementById('projectedCaseValue').textContent = formatCurrency(avgCaseValue);

        // Update UI - Breakdown
        document.getElementById('projectedInquiries').textContent = projectedInquiries;
        document.getElementById('projectedConversion').textContent = formatPercent(projectedConversionRate);
        document.getElementById('newClients').textContent = '+' + newClients.toFixed(1);
        document.getElementById('monthlyIncrease').textContent = '+' + formatCurrency(monthlyIncrease);
        document.getElementById('yearlyIncrease').textContent = '+' + formatCurrency(yearlyIncrease);
        document.getElementById('roiValue').textContent = Math.round(roi).toLocaleString() + '%';
      }

      // Toggle click handlers
      toggleItems.forEach(item => {
        item.addEventListener('click', function() {
          const serviceName = this.dataset.service;
          this.classList.toggle('active');
          services[serviceName].active = this.classList.contains('active');
          calculate();
        });
      });

      // Slider input handlers
      inquiries.addEventListener('input', calculate);
      conversion.addEventListener('input', calculate);
      caseValue.addEventListener('input', calculate);

      // Initial calculation
      calculate();
      
      // Reveal animations
      const reveals = document.querySelectorAll('.reveal');
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      }, { threshold: 0.1 });
      reveals.forEach(reveal => revealObserver.observe(reveal));

      // Scroll progress
      window.addEventListener('scroll', () => {
        const height = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = (window.scrollY / height) * 100;
        const indicator = document.getElementById('scrollIndicator');
        if (indicator) indicator.style.width = scrolled + '%';
      });
    });
  </script>
  `;
}

// CLI
if (require.main === module) {
  const researchFile = process.argv[2];
  const prospectName = process.argv[3];
  
  if (!researchFile || !prospectName) {
    console.error('Usage: node report-generator-v4.js <research-file.json> <"Prospect Name">');
    console.error('Example: node report-generator-v4.js reports/smith-law-research.json "John Smith"');
    process.exit(1);
  }
  
  if (!fs.existsSync(researchFile)) {
    console.error(`Error: Research file not found: ${researchFile}`);
    process.exit(1);
  }
  
  const researchData = JSON.parse(fs.readFileSync(researchFile, 'utf-8'));
  const html = generateReport(researchData, prospectName);
  
  const firmSlug = researchData.firmName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const filename = path.join(__dirname, 'reports', `${firmSlug}-landing-page.html`);
  
  fs.writeFileSync(filename, html);
  console.log(`\n✅ Landing page generated: ${filename}`);
  console.log(`\n👉 Open: open "${filename}"\n`);
}

module.exports = { generateReport };
