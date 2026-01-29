#!/usr/bin/env node
/**
 * REPORT GENERATOR V9 - OPPORTUNITY-FOCUSED, VALUE-DRIVEN
 * 
 * Key changes from V8:
 * - Opportunity messaging (not fear-based)
 * - Green/blue colors (growth, not panic)
 * - Deep personalization throughout
 * - More value & explanation
 * - "We found money" not "You're losing money"
 */

const fs = require('fs');
const path = require('path');

function generateReport(researchPath, contactName) {
  const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
  
  const {
    firmName,
    location,
    practiceAreas,
    googleProfile,
    competitors,
    googleAds,
    metaAds,
    website,
    gaps,
    totalMonthlyLoss,
    avgCaseValue
  } = research;

  const primaryPractice = practiceAreas[0] || 'legal services';
  const locationStr = location.full || `${location.city}, ${location.state}` || 'your area';
  
  const monthlyOpp = totalMonthlyLoss;
  const yearlyOpp = monthlyOpp * 12;
  const weeklyOpp = Math.round(monthlyOpp / 4);
  const dailyOpp = Math.round(monthlyOpp / 30);
  
  const today = new Date().toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We Found $${monthlyOpp.toLocaleString()}/Month in Revenue for ${firmName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  ${getStyles()}
</head>
<body>

  <div class="container">

    <!-- Header -->
    <header class="header">
      <div class="brand">
        <div class="brand-logo">MM</div>
        <div>
          <div class="brand-name">Mortar Metrics</div>
          <div class="brand-tagline">Legal Growth Agency</div>
        </div>
      </div>
      <div class="prepared">
        <div class="prepared-label">Prepared For</div>
        <div class="prepared-name">${contactName}</div>
        <div class="prepared-firm">${firmName}</div>
        <div class="prepared-date">${today}</div>
      </div>
    </header>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-badge">Revenue Opportunity Analysis</div>
      <h1 class="hero-title">
        We Found <span class="hero-number">$${(monthlyOpp/1000).toFixed(0)}K/Month</span> 
        in Untapped Revenue
      </h1>
      <p class="hero-subtitle">
        We spent 3 hours analyzing the ${locationStr} ${primaryPractice} market. 
        Found <strong>${competitors.length} competitors</strong> you're competing against. 
        Here's the exact playbook to capture this revenue—starting Week 1.
      </p>

      <div class="hero-stats">
        <div class="stat-card primary">
          <div class="stat-value">$${(monthlyOpp/1000).toFixed(0)}K</div>
          <div class="stat-label">Monthly Opportunity</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${competitors.length}</div>
          <div class="stat-label">Competitors Analyzed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">Week 1</div>
          <div class="stat-label">First Results</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">$47M+</div>
          <div class="stat-label">Generated for Firms</div>
        </div>
      </div>

      ${generateWeek1Box()}
    </section>

    <!-- What We Found -->
    <section class="research-section">
      <div class="section-header">
        <span class="section-badge">Deep Research</span>
        <h2 class="section-title">What We Found About ${firmName}</h2>
        <p class="section-subtitle">
          We analyzed your market position, ${competitors.length} competitors, and website. 
          Here's where the opportunity is hiding.
        </p>
      </div>

      ${generateResearchFindings(research, competitors, primaryPractice, locationStr)}
    </section>

    <!-- Competitor Comparison -->
    ${generateCompetitorTable(firmName, googleProfile, competitors, googleAds, metaAds)}

    <!-- Solutions -->
    <section class="solutions-section">
      <div class="section-header">
        <span class="section-badge">The Playbook</span>
        <h2 class="section-title">How We'll Capture This for ${firmName}</h2>
        <p class="section-subtitle">
          We've executed this playbook for 40+ law firms. Here's your roadmap—and your Week 1 results.
        </p>
      </div>

      ${generateSolutions(gaps, firmName, primaryPractice, locationStr, competitors)}

      <div class="scope-banner">
        <div class="scope-item">
          <div class="scope-number">340+</div>
          <div class="scope-text">Tasks We'll Execute</div>
        </div>
        <div class="scope-divider">•</div>
        <div class="scope-item">
          <div class="scope-number">90 Days</div>
          <div class="scope-text">To Full Build</div>
        </div>
        <div class="scope-divider">•</div>
        <div class="scope-item">
          <div class="scope-number">Week 1</div>
          <div class="scope-text">You See Results</div>
        </div>
      </div>
    </section>

    <!-- Case Study -->
    ${generateCaseStudy(primaryPractice)}

    <!-- CTA -->
    <section class="cta-section">
      <div class="cta-content">
        <h2 class="cta-title">Let's Execute This for ${firmName}</h2>
        <p class="cta-subtitle">
          Book a 15-minute call. We'll validate these numbers, show you competitors you didn't know existed, 
          and build your custom 90-day roadmap. If it makes sense, we start Monday.
        </p>

        <div class="cta-timeline">
          <div class="cta-step">📞 <strong>Today:</strong> Book your call</div>
          <div class="cta-step">🔍 <strong>Monday:</strong> We audit your assets</div>
          <div class="cta-step">🚀 <strong>Tuesday:</strong> Quick wins go live</div>
          <div class="cta-step">💰 <strong>Friday:</strong> 3-5 qualified leads</div>
        </div>

        <a href="https://calendly.com/mortarmetrics" class="btn-cta" id="book">
          Book Your Strategy Call →
        </a>

        <p class="cta-note">
          <strong>No pressure.</strong> If it doesn't make sense, we'll tell you. 
          If it does, we start Monday and you'll see results by Friday.
        </p>
      </div>

      <div class="cta-urgency">
        Every week = ~$${(weeklyOpp/1000).toFixed(0)}K in opportunity cost
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-brand">
          <div class="footer-logo">MM</div>
          <div>
            <div class="footer-name">Mortar Metrics</div>
            <div class="footer-tagline">Legal Growth Agency</div>
          </div>
        </div>
        <div class="footer-contact">
          Questions? <a href="mailto:hello@mortarmetrics.com">hello@mortarmetrics.com</a>
        </div>
      </div>
    </footer>

  </div>

  <script>
    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
          behavior: 'smooth'
        });
      });
    });

    // Reveal on scroll
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.research-card, .solution-card, .case-study').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
      observer.observe(el);
    });
  </script>

</body>
</html>`;

  return html;
}

function generateWeek1Box() {
  return `
    <div class="week1-box">
      <div class="week1-header">
        <span class="week1-icon">⚡</span>
        <strong>Week 1 Results:</strong> 3-5 qualified leads while we build the long-term machine
      </div>
      <div class="week1-grid">
        <div class="week1-item">
          <strong>Mon:</strong> Audit your Google Business Profile → Fix 8-12 issues → Higher visibility by Tuesday
        </div>
        <div class="week1-item">
          <strong>Tue:</strong> Launch Local Service Ads → You'll rank #1 by Wednesday → First lead in 48-72hrs
        </div>
        <div class="week1-item">
          <strong>Wed:</strong> Retarget past 30 days of traffic → They see your ads tonight → 8-12% convert in 7 days
        </div>
        <div class="week1-item">
          <strong>Fri:</strong> 3-5 qualified leads in your pipeline → You close cases → We keep building
        </div>
      </div>
    </div>
  `;
}

function generateResearchFindings(research, competitors, primaryPractice, locationStr) {
  const { gaps, googleAds, metaAds, website, googleProfile } = research;
  
  const competitorsRunningGoogle = competitors.filter(c => c.googleAds).length;
  const competitorsRunningMeta = competitors.filter(c => c.metaAds).length;
  const avgCompetitorRating = competitors.length > 0 
    ? (competitors.reduce((sum, c) => sum + (c.rating || 0), 0) / competitors.length).toFixed(1)
    : 'N/A';
  
  return `
    <div class="research-grid">
      
      <!-- Market Intelligence Card -->
      <div class="research-card highlight">
        <div class="research-icon">🔍</div>
        <div class="research-title">Market Intelligence</div>
        <div class="research-data">
          We analyzed <strong>${competitors.length} competitors</strong> in ${locationStr}. 
          ${competitorsRunningGoogle > 0 ? `<strong>${competitorsRunningGoogle} are running Google Ads.</strong>` : ''} 
          ${competitorsRunningMeta > 0 ? `<strong>${competitorsRunningMeta} are running Meta ads.</strong>` : ''} 
          Average competitor rating: <strong>${avgCompetitorRating}★</strong>.
          ${googleProfile.profileFound ? ` Your rating: <strong>${googleProfile.rating}★</strong> (${googleProfile.reviewCount} reviews).` : ' We couldn\'t find your Google Business Profile.'}
        </div>
      </div>

      ${gaps.googleAds?.hasGap ? `
      <div class="research-card gap">
        <div class="research-icon">🎯</div>
        <div class="research-title">Google Ads Opportunity</div>
        <div class="research-data">
          ${googleAds.running 
            ? `You're running Google Ads. We can optimize to cut your cost-per-case 20-40%.` 
            : competitorsRunningGoogle > 0
            ? `<strong>Not running Google Ads.</strong> ${competitorsRunningGoogle} competitors are capturing high-intent searches like "${primaryPractice} lawyer ${locationStr}".`
            : `<strong>Blue ocean opportunity:</strong> Zero competitors advertising in your market. You could dominate "${primaryPractice} ${locationStr}" searches.`
          }
        </div>
        <div class="research-cost">
          <strong>Opportunity: $${(gaps.googleAds.monthlyLoss/1000).toFixed(1)}K/month</strong>
          <div class="research-explanation">
            That's ${Math.round(gaps.googleAds.monthlyLoss / research.avgCaseValue)} ${primaryPractice} cases going to competitors every month.
          </div>
        </div>
      </div>
      ` : ''}

      ${gaps.metaAds?.hasGap ? `
      <div class="research-card gap">
        <div class="research-icon">📱</div>
        <div class="research-title">Meta Ads Opportunity</div>
        <div class="research-data">
          ${metaAds.running 
            ? `You're running Meta ads. We can improve creative and targeting for better ROI.` 
            : competitorsRunningMeta > 0
            ? `<strong>Not running Facebook/Instagram ads.</strong> ${competitorsRunningMeta} competitors are running campaigns. They're retargeting your website visitors.`
            : `Your competitors aren't running Meta ads either. First-mover advantage available.`
          }
        </div>
        <div class="research-cost">
          <strong>Opportunity: $${(gaps.metaAds.monthlyLoss/1000).toFixed(1)}K/month</strong>
          <div class="research-explanation">
            Meta ads convert at 8-12%. For every $1,000 spent, most firms see $4,000-6,000 in case value.
          </div>
        </div>
      </div>
      ` : ''}

      ${gaps.afterHours?.hasGap ? `
      <div class="research-card gap">
        <div class="research-icon">🌙</div>
        <div class="research-title">After-Hours Intake Gap</div>
        <div class="research-data">
          <strong>No 24/7 intake detected.</strong> 
          73% of ${primaryPractice} searches happen outside 9-5. 
          Your phone goes to voicemail. Competitors with AI intake answer in 2 minutes.
        </div>
        <div class="research-cost">
          <strong>Lost revenue: $${(gaps.afterHours.monthlyLoss/1000).toFixed(1)}K/month</strong>
          <div class="research-explanation">
            Right now, at 11 PM, someone's Googling "${primaryPractice} lawyer ${locationStr}". 
            They'll call 3-4 firms. First to answer gets the case.
          </div>
        </div>
      </div>
      ` : ''}

      ${gaps.websiteSpeed?.hasGap ? `
      <div class="research-card gap">
        <div class="research-icon">⚡</div>
        <div class="research-title">Website Speed Issue</div>
        <div class="research-data">
          PageSpeed score: <strong>${website.pageSpeedScore}/100</strong> (Mobile: ${website.mobileScore}/100). 
          Google recommends 90+. Slow sites lose 40% of visitors within 3 seconds.
        </div>
        <div class="research-cost">
          <strong>Lost conversions: $${(gaps.websiteSpeed.monthlyLoss/1000).toFixed(1)}K/month</strong>
          <div class="research-explanation">
            For every second your site takes to load, conversion rates drop 7%. 
            We can get you to 90+ in 2 weeks.
          </div>
        </div>
      </div>
      ` : ''}

    </div>

    <div class="insight-box">
      <div class="insight-icon">💡</div>
      <div class="insight-text">
        <strong>Bottom line:</strong> ${research.firmName} isn't losing on expertise—you're being outgunned on 
        <strong>speed and availability</strong>. These gaps are costing you ${Math.round(research.totalMonthlyLoss / research.avgCaseValue)} cases/month. 
        All fixable. Starting Week 1.
      </div>
    </div>
  `;
}

function generateCompetitorTable(firmName, googleProfile, competitors, googleAds, metaAds) {
  if (competitors.length === 0) return '';
  
  const topCompetitors = competitors.slice(0, 5);
  
  return `
    <section class="competitor-section">
      <div class="section-header">
        <span class="section-badge">Competitive Reality</span>
        <h2 class="section-title">Who You're Competing Against in Real-Time</h2>
        <p class="section-subtitle">
          We pulled live data on your top ${topCompetitors.length} competitors. Here's what they're doing that you're not.
        </p>
      </div>

      <div class="competitor-table-wrapper">
        <table class="competitor-table">
          <thead>
            <tr>
              <th>Firm</th>
              <th>Rating</th>
              <th>Reviews</th>
              <th>Google Ads</th>
              <th>Meta Ads</th>
            </tr>
          </thead>
          <tbody>
            <tr class="your-firm">
              <td><strong>${firmName}</strong> (You)</td>
              <td>${googleProfile.profileFound ? googleProfile.ratingDisplay : 'N/A'}</td>
              <td>${googleProfile.reviewCount || 0}</td>
              <td><span class="badge ${googleAds.running ? 'badge-yes' : 'badge-no'}">${googleAds.running ? '✓ Yes' : '✗ No'}</span></td>
              <td><span class="badge ${metaAds.running ? 'badge-yes' : 'badge-no'}">${metaAds.running ? '✓ Yes' : '✗ No'}</span></td>
            </tr>
            ${topCompetitors.map(c => `
              <tr>
                <td>${c.name}</td>
                <td>${c.ratingDisplay || 'N/A'}</td>
                <td>${c.reviews || 0}</td>
                <td><span class="badge ${c.googleAds ? 'badge-yes' : 'badge-no'}">${c.googleAds ? '✓ Yes' : '✗ No'}</span></td>
                <td><span class="badge ${c.metaAds ? 'badge-yes' : 'badge-no'}">${c.metaAds ? '✓ Yes' : '✗ No'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="insight-box">
        <div class="insight-icon">🎯</div>
        <div class="insight-text">
          The firms running ads are getting calls <em>right now</em>. The ones with higher ratings are closing at higher rates. 
          We'll help you catch up—and then dominate.
        </div>
      </div>
    </section>
  `;
}

function generateSolutions(gaps, firmName, primaryPractice, locationStr, competitors) {
  let html = '<div class="solutions-grid">';
  
  if (gaps.googleAds?.hasGap) {
    html += `
      <div class="solution-card">
        <div class="solution-header">
          <div class="solution-icon">🎯</div>
          <div class="solution-title">Google Ads Domination</div>
        </div>
        <div class="solution-week1">
          <strong>Week 1:</strong> Launch Local Service Ads. You'll rank #1 for "${firmName.split(' ')[0]} lawyer ${locationStr}" by Wednesday. 
          First qualified lead typically arrives within 48-72 hours. Google guarantees these leads—you only pay for qualified calls.
        </div>
        <div class="solution-full">
          <strong>Full Build (Month 1-2):</strong> 12 campaigns targeting high-intent searches. 340+ keywords. 
          67 ad variants (A/B tested weekly). 23 practice-area specific landing pages. 
          You'll own the first 3 Google results: LSA + Paid Ad + Organic.
        </div>
        <div class="solution-result">
          <strong>Expected Result:</strong> Predictable pipeline of 15-25 high-intent leads/month at $180-250 cost per case. 
          3.2x ROI average across our 40+ law firm clients.
        </div>
      </div>
    `;
  }
  
  if (gaps.metaAds?.hasGap) {
    html += `
      <div class="solution-card">
        <div class="solution-header">
          <div class="solution-icon">📱</div>
          <div class="solution-title">Meta Ads + Retargeting</div>
        </div>
        <div class="solution-week1">
          <strong>Week 1:</strong> Retarget everyone who visited your site in the last 30 days. They'll see your ads tonight on Facebook/Instagram. 
          8-12% typically convert within 7 days. Cost: $200-400. Return: $8K-15K in new cases.
        </div>
        <div class="solution-full">
          <strong>Full Build (Month 1-2):</strong> 8 audience segments (demographics, interests, lookalikes). 
          47 creative variants (video, carousel, testimonials). Lead gen forms (pre-filled, mobile optimized). 
          Messenger automation for instant response. Weekly creative refresh.
        </div>
        <div class="solution-result">
          <strong>Expected Result:</strong> 10-15 qualified leads/month from cold traffic + retargeting. 
          Lower cost-per-case than Google ($120-180 avg). Great for brand awareness + remarketing.
        </div>
      </div>
    `;
  }
  
  if (gaps.afterHours?.hasGap) {
    html += `
      <div class="solution-card">
        <div class="solution-header">
          <div class="solution-icon">🤖</div>
          <div class="solution-title">24/7 AI Intake System</div>
        </div>
        <div class="solution-week1">
          <strong>This Week:</strong> We bridge with our trained intake team <em>tonight</em>. 
          Your after-hours calls forward to us. We qualify, book consultations, text you summaries. 
          Zero lost leads starting immediately. Converts 67% of after-hours calls.
        </div>
        <div class="solution-full">
          <strong>Week 2-3:</strong> Custom AI goes live (trained on ${primaryPractice}, handles objections, books consultations into your calendar). 
          Speaks Spanish if needed. Texts transcripts. Integrates with your CRM. Our team bridges until then.
        </div>
        <div class="solution-result">
          <strong>Expected Result:</strong> Capture 100% of leads, 24/7, forever. 
          Typical ${primaryPractice} firm captures 23 extra cases/month after implementing 24/7 intake. That's $${Math.round(23 * 15000 / 1000)}K/month.
        </div>
      </div>
    `;
  }
  
  if (gaps.websiteSpeed?.hasGap) {
    html += `
      <div class="solution-card">
        <div class="solution-header">
          <div class="solution-icon">⚡</div>
          <div class="solution-title">Website Speed Optimization</div>
        </div>
        <div class="solution-week1">
          <strong>Week 1:</strong> Audit complete. We identify the 8-12 issues killing your speed (images, scripts, hosting). 
          Most are quick fixes. You'll see improvement within 48 hours.
        </div>
        <div class="solution-full">
          <strong>Week 2:</strong> Full optimization. Image compression, code cleanup, CDN setup, caching. 
          We'll get you to 90+ PageSpeed score. Mobile-first. Loads in under 2 seconds.
        </div>
        <div class="solution-result">
          <strong>Expected Result:</strong> 30-40% more conversions from existing traffic. 
          Every second saved = 7% higher conversion rate. Your SEO ranking improves too (Google rewards fast sites).
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

function generateCaseStudy(primaryPractice) {
  const caseStudies = {
    'personal injury': {
      firm: 'Martinez & Associates',
      location: 'Phoenix, AZ',
      practice: 'Personal Injury',
      before: '$45K/mo',
      beforeCases: '9 cases/month',
      after: '$180K/mo',
      afterCases: '42 cases/month',
      week1: '6 leads from LSAs + retargeting ($32K in potential cases). They closed 3 by Week 3.',
      month1: 'AI intake went live. Captured 31 after-hours leads (24 converted). Revenue jumped to $95K/month.',
      month3: 'Running 340 keywords, 12 campaigns. Predictable pipeline. 42 cases/month. 4.2x ROI.',
      quote: 'Week 1 results paid for the entire first year. By Month 3, we had to hire two more attorneys. We went from scrapping for cases to turning them away.',
      attribution: 'Managing Partner'
    },
    'civil litigation': {
      firm: 'Blackwell Litigation',
      location: 'Denver, CO',
      practice: 'Civil Litigation',
      before: '$52K/mo',
      beforeCases: '7 cases/month',
      after: '$165K/mo',
      afterCases: '22 cases/month',
      week1: '4 leads from Google LSAs. High-value cases ($40K+ avg). Closed 2 within 14 days.',
      month1: 'Google Ads campaign at scale. Dominating "business litigation Denver" searches. 18 leads/month.',
      month3: 'Predictable pipeline. 22 cases/month. Able to be selective with client quality. 3.8x ROI.',
      quote: 'Our biggest problem now is capacity. Mortar Metrics built a machine that generates more qualified leads than we can handle. Great problem to have.',
      attribution: 'Founding Partner'
    }
  };
  
  const practice = primaryPractice.toLowerCase().includes('personal injury') ? 'personal injury' 
    : primaryPractice.toLowerCase().includes('civil') ? 'civil litigation'
    : 'personal injury';
  
  const cs = caseStudies[practice];
  
  return `
    <section class="case-study-section">
      <div class="section-header">
        <span class="section-badge">Proof</span>
        <h2 class="section-title">This Playbook Works</h2>
        <p class="section-subtitle">Real results from a ${cs.practice} firm that was in your exact position 6 months ago.</p>
      </div>

      <div class="case-study">
        <div class="case-header">
          <div class="case-firm">${cs.firm}</div>
          <div class="case-meta">${cs.practice} • ${cs.location}</div>
        </div>
        
        <div class="case-results">
          <div class="case-before">
            <div class="case-label">Before</div>
            <div class="case-value">${cs.before}</div>
            <div class="case-detail">${cs.beforeCases}</div>
          </div>
          <div class="case-arrow">→</div>
          <div class="case-after">
            <div class="case-label">After (90 days)</div>
            <div class="case-value">${cs.after}</div>
            <div class="case-detail">${cs.afterCases}</div>
          </div>
        </div>

        <div class="case-timeline">
          <div class="case-week"><strong>Week 1:</strong> ${cs.week1}</div>
          <div class="case-week"><strong>Month 1:</strong> ${cs.month1}</div>
          <div class="case-week"><strong>Month 3:</strong> ${cs.month3}</div>
        </div>

        <div class="case-quote">
          "${cs.quote}"
          <div class="case-attribution">— ${cs.attribution}, ${cs.firm}</div>
        </div>
      </div>
    </section>
  `;
}

function getStyles() {
  return `
<style>
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
    --warning: #f59e0b;
    --ease: cubic-bezier(0.16, 1, 0.3, 1);
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

  .container { max-width: 1100px; margin: 0 auto; padding: 0 32px; }
  @media (max-width: 600px) { .container { padding: 0 20px; } }

  /* Header */
  .header { 
    display: flex; justify-content: space-between; align-items: center; 
    padding: 24px 0; border-bottom: 1px solid var(--border); 
    margin-bottom: 40px; flex-wrap: wrap; gap: 24px; 
  }

  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-logo { 
    width: 56px; height: 56px; background: var(--brand-blue); 
    border-radius: 16px; display: flex; align-items: center; 
    justify-content: center; font-family: 'Fraunces', serif; 
    font-size: 18px; font-weight: 600; color: white; 
  }
  .brand-name { font-family: 'Fraunces', serif; font-size: 1.4rem; font-weight: 500; }
  .brand-tagline { font-size: 0.7rem; color: var(--slate); text-transform: uppercase; letter-spacing: 2px; font-weight: 600; }

  .prepared { text-align: right; }
  .prepared-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 2px; color: var(--slate-light); margin-bottom: 6px; }
  .prepared-name { font-family: 'Fraunces', serif; font-size: 1.35rem; color: var(--ink); }
  .prepared-firm { font-size: 0.9rem; color: var(--brand-blue); font-weight: 500; }
  .prepared-date { font-size: 0.8rem; color: var(--slate-light); margin-top: 6px; }

  /* Hero */
  .hero { text-align: center; padding: 60px 0; }
  .hero-badge { 
    display: inline-block; padding: 10px 24px; background: var(--success); 
    color: white; font-size: 0.75rem; text-transform: uppercase; 
    letter-spacing: 2px; border-radius: 100px; margin-bottom: 24px; font-weight: 600; 
  }
  .hero-title { font-size: clamp(2rem, 6vw, 3.5rem); line-height: 1.2; margin-bottom: 24px; }
  .hero-number { 
    display: block; font-size: clamp(3rem, 8vw, 5rem); 
    background: linear-gradient(135deg, var(--success), #047857); 
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; 
    background-clip: text; font-weight: 700; margin: 8px 0; 
  }
  .hero-subtitle { font-size: 1.2rem; color: var(--slate); max-width: 700px; margin: 0 auto 48px; line-height: 1.7; }

  .hero-stats { 
    display: grid; grid-template-columns: repeat(4, 1fr); 
    gap: 16px; margin: 48px 0; 
  }
  @media (max-width: 768px) { .hero-stats { grid-template-columns: repeat(2, 1fr); } }

  .stat-card { 
    background: var(--white); border: 2px solid var(--border); 
    border-radius: 20px; padding: 28px 20px; text-align: center; 
    transition: all 0.4s var(--ease); 
  }
  .stat-card:hover { transform: translateY(-6px); box-shadow: 0 20px 48px rgba(0,0,0,0.08); border-color: var(--accent); }
  .stat-card.primary { border-color: var(--success); border-width: 3px; }

  .stat-value { font-family: 'Fraunces', serif; font-size: 2.2rem; font-weight: 700; color: var(--ink); margin-bottom: 8px; }
  .stat-card.primary .stat-value { color: var(--success); font-size: 2.5rem; }
  .stat-label { font-size: 0.7rem; color: var(--slate); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }

  /* Week 1 Box */
  .week1-box { 
    background: linear-gradient(135deg, var(--success-light), var(--white)); 
    border: 2px solid var(--success); border-radius: 20px; 
    padding: 32px; margin: 48px auto; max-width: 800px; 
  }
  .week1-header { font-size: 1.2rem; margin-bottom: 20px; text-align: center; color: var(--ink); }
  .week1-icon { font-size: 1.5rem; margin-right: 8px; }
  .week1-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 20px; }
  @media (max-width: 600px) { .week1-grid { grid-template-columns: 1fr; } }
  .week1-item { background: var(--white); padding: 16px; border-radius: 12px; font-size: 0.95rem; color: var(--slate); }
  .week1-item strong { color: var(--success); }

  /* Sections */
  section { padding: 80px 0; }
  .section-header { text-align: center; margin-bottom: 48px; }
  .section-badge { 
    display: inline-block; padding: 10px 22px; background: var(--ink); 
    color: white; font-size: 0.7rem; text-transform: uppercase; 
    letter-spacing: 2px; border-radius: 100px; margin-bottom: 20px; font-weight: 600; 
  }
  .section-title { font-size: clamp(1.8rem, 5vw, 2.5rem); margin-bottom: 16px; }
  .section-subtitle { font-size: 1.1rem; color: var(--slate); max-width: 600px; margin: 0 auto; }

  /* Research Grid */
  .research-section { background: var(--white); border-radius: 24px; padding: 60px 32px; }
  .research-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin: 40px 0; }

  .research-card { 
    background: var(--warm-white); border: 2px solid var(--border); 
    border-radius: 20px; padding: 28px; transition: all 0.4s var(--ease); 
  }
  .research-card:hover { transform: translateY(-6px); box-shadow: 0 24px 48px rgba(0,0,0,0.08); }
  .research-card.gap { border-color: var(--warning); }
  .research-card.highlight { border-color: var(--brand-blue); border-width: 3px; }

  .research-icon { font-size: 2.5rem; margin-bottom: 16px; }
  .research-title { font-family: 'Fraunces', serif; font-size: 1.3rem; margin-bottom: 12px; color: var(--ink); }
  .research-data { font-size: 0.95rem; color: var(--slate); line-height: 1.7; margin-bottom: 12px; }
  .research-data strong { color: var(--ink); }
  .research-cost { 
    font-size: 1rem; color: var(--success); font-weight: 700; 
    padding-top: 12px; border-top: 1px solid var(--border); margin-top: 12px;
  }
  .research-explanation { 
    font-size: 0.85rem; color: var(--slate); font-weight: 400; margin-top: 4px; line-height: 1.6;
  }

  .insight-box { 
    background: var(--brand-light); border-left: 4px solid var(--brand-blue); 
    border-radius: 16px; padding: 28px; margin-top: 40px; 
    display: flex; align-items: flex-start; gap: 16px; 
  }
  .insight-icon { font-size: 2rem; flex-shrink: 0; }
  .insight-text { font-size: 1.1rem; color: var(--ink); line-height: 1.7; }
  .insight-text strong { color: var(--brand-blue); }

  /* Competitor Table */
  .competitor-section { background: var(--warm-white); border-radius: 24px; padding: 60px 32px; }
  .competitor-table-wrapper { overflow-x: auto; margin: 40px 0; }
  .competitor-table { 
    width: 100%; border-collapse: collapse; 
    background: var(--white); border-radius: 12px; 
    overflow: hidden; 
  }
  .competitor-table thead { background: var(--ink); color: white; }
  .competitor-table th { 
    padding: 16px; text-align: left; font-weight: 600; 
    font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; 
  }
  .competitor-table td { padding: 16px; border-bottom: 1px solid var(--border); }
  .competitor-table tr:last-child td { border-bottom: none; }
  .competitor-table tr.your-firm { background: var(--success-light); font-weight: 600; }
  .competitor-table tr:hover { background: var(--warm-white); }

  .badge { 
    display: inline-block; padding: 4px 12px; border-radius: 100px; 
    font-size: 0.8rem; font-weight: 600; 
  }
  .badge-yes { background: var(--success-light); color: var(--success); }
  .badge-no { background: var(--border); color: var(--slate); }

  /* Solutions */
  .solutions-section { background: var(--white); border-radius: 24px; padding: 60px 32px; }
  .solutions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin: 40px 0; }

  .solution-card { 
    background: var(--warm-white); border: 2px solid var(--border); 
    border-radius: 20px; padding: 28px; transition: all 0.4s var(--ease); 
  }
  .solution-card:hover { 
    transform: translateY(-6px); box-shadow: 0 24px 48px rgba(0,0,0,0.08); 
    border-color: var(--success); 
  }

  .solution-header { 
    display: flex; align-items: center; gap: 12px; 
    margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid var(--border); 
  }
  .solution-icon { font-size: 2rem; }
  .solution-title { font-family: 'Fraunces', serif; font-size: 1.3rem; color: var(--ink); }

  .solution-week1 { 
    background: var(--success-light); padding: 16px; border-radius: 12px; 
    margin-bottom: 16px; font-size: 0.95rem; color: var(--ink); line-height: 1.7; 
  }
  .solution-week1 strong { color: var(--success); }

  .solution-full { font-size: 0.9rem; color: var(--slate); line-height: 1.7; margin-bottom: 16px; }
  .solution-full strong { color: var(--ink); }

  .solution-result { 
    font-size: 0.95rem; font-weight: 600; color: var(--brand-blue); 
    padding-top: 16px; border-top: 1px solid var(--border); 
  }

  .scope-banner { 
    display: flex; align-items: center; justify-content: center; 
    gap: 32px; padding: 32px; background: var(--brand-light); 
    border-radius: 16px; margin-top: 48px; flex-wrap: wrap; 
  }
  .scope-item { text-align: center; }
  .scope-number { font-family: 'Fraunces', serif; font-size: 2.5rem; font-weight: 700; color: var(--brand-blue); }
  .scope-text { font-size: 0.9rem; color: var(--slate); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  .scope-divider { font-size: 1.5rem; color: var(--border); }

  /* Case Study */
  .case-study-section { background: var(--warm-white); border-radius: 24px; padding: 60px 32px; }
  .case-study { 
    background: var(--white); border: 2px solid var(--border); 
    border-radius: 24px; padding: 40px; max-width: 800px; margin: 0 auto; 
  }

  .case-header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid var(--border); }
  .case-firm { font-family: 'Fraunces', serif; font-size: 1.8rem; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
  .case-meta { font-size: 0.9rem; color: var(--slate); }

  .case-results { 
    display: flex; align-items: center; justify-content: center; 
    gap: 32px; padding: 32px; background: var(--warm-white); 
    border-radius: 16px; margin-bottom: 24px; flex-wrap: wrap; 
  }
  .case-before, .case-after { text-align: center; }
  .case-label { 
    font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; 
    color: var(--slate-light); margin-bottom: 8px; font-weight: 600; 
  }
  .case-value { 
    font-family: 'Fraunces', serif; font-size: 2.5rem; 
    font-weight: 700; color: var(--success); margin-bottom: 4px; 
  }
  .case-detail { font-size: 0.9rem; color: var(--slate); }
  .case-arrow { font-size: 2rem; color: var(--success); font-weight: 700; }

  .case-timeline { display: flex; flex-direction: column; gap: 12px; margin: 24px 0; }
  .case-week { 
    font-size: 0.95rem; color: var(--slate); 
    padding-left: 24px; position: relative; line-height: 1.7; 
  }
  .case-week::before { 
    content: '→'; position: absolute; left: 0; 
    color: var(--success); font-weight: 700; 
  }
  .case-week strong { color: var(--ink); }

  .case-quote { 
    margin-top: 24px; padding: 24px; background: var(--brand-light); 
    border-left: 4px solid var(--brand-blue); border-radius: 12px; 
    font-style: italic; font-size: 1.05rem; color: var(--ink); line-height: 1.7; 
  }
  .case-attribution { 
    margin-top: 12px; font-style: normal; 
    font-size: 0.9rem; color: var(--slate); font-weight: 600; 
  }

  /* CTA */
  .cta-section { 
    background: linear-gradient(135deg, var(--ink), #1e293b); 
    border-radius: 24px; padding: 60px 32px; 
    text-align: center; color: white; margin: 80px 0; 
  }

  .cta-content { max-width: 700px; margin: 0 auto; }
  .cta-title { font-family: 'Fraunces', serif; font-size: clamp(2rem, 5vw, 2.8rem); margin-bottom: 20px; }
  .cta-subtitle { font-size: 1.1rem; opacity: 0.9; margin-bottom: 40px; line-height: 1.7; }

  .cta-timeline { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 32px 0; }
  @media (max-width: 600px) { .cta-timeline { grid-template-columns: 1fr; } }
  .cta-step { 
    background: rgba(255,255,255,0.05); padding: 16px; 
    border-radius: 12px; font-size: 0.95rem; text-align: left; 
  }
  .cta-step strong { color: white; }

  .btn-cta { 
    display: inline-flex; align-items: center; gap: 12px; 
    padding: 18px 40px; background: white; color: var(--ink); 
    font-size: 1.1rem; font-weight: 700; border-radius: 100px; 
    text-decoration: none; margin: 32px 0; transition: all 0.3s var(--ease); 
  }
  .btn-cta:hover { transform: translateY(-3px); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }

  .cta-note { font-size: 0.95rem; opacity: 0.8; margin-top: 20px; }

  .cta-urgency { 
    margin-top: 32px; padding-top: 32px; 
    border-top: 1px solid rgba(255,255,255,0.1); 
    font-size: 0.9rem; opacity: 0.7; 
  }

  /* Footer */
  .footer { padding: 40px 0; border-top: 2px solid var(--border); }
  .footer-content { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 24px; }
  .footer-brand { display: flex; align-items: center; gap: 12px; }
  .footer-logo { 
    width: 40px; height: 40px; background: var(--brand-blue); 
    border-radius: 10px; display: flex; align-items: center; 
    justify-content: center; font-family: 'Fraunces', serif; 
    font-size: 14px; font-weight: 600; color: white; 
  }
  .footer-name { font-family: 'Fraunces', serif; font-size: 1.1rem; font-weight: 500; color: var(--ink); }
  .footer-tagline { font-size: 0.7rem; color: var(--slate); text-transform: uppercase; letter-spacing: 1px; }
  .footer-contact { font-size: 0.9rem; color: var(--slate); }
  .footer-contact a { color: var(--brand-blue); text-decoration: none; font-weight: 600; }

  @media (max-width: 768px) {
    .hero-stats { grid-template-columns: repeat(2, 1fr); }
    .research-grid { grid-template-columns: 1fr; }
    .solutions-grid { grid-template-columns: 1fr; }
    .case-results { flex-direction: column; }
    .footer-content { flex-direction: column; text-align: center; }
  }
</style>
  `;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node report-generator-v9.js <research.json> <Contact Name>');
    process.exit(1);
  }
  
  const researchPath = args[0];
  const contactName = args[1];
  
  const html = generateReport(researchPath, contactName);
  
  const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
  const outputPath = path.join(
    path.dirname(researchPath),
    `${research.firmName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report-v9.html`
  );
  
  fs.writeFileSync(outputPath, html);
  console.log(`✅ Report generated: ${outputPath}`);
  console.log('   Open in browser to preview.');
}

module.exports = { generateReport };
