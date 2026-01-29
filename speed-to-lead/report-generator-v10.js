#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function generateReport(researchPath, contactName) {
  const r = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
  const monthlyOpp = r.totalMonthlyLoss;
  const yearlyOpp = monthlyOpp * 12;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Complete Audit: ${r.firmName} | $${(monthlyOpp/1000).toFixed(0)}K/Mo Opportunity</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--ink:#0f172a;--slate:#475569;--border:#e2e8f0;--bg:#f8fafc;--white:#fff;--blue:#2563eb;--green:#059669;--green-light:#d1fae5}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Outfit',sans-serif;background:var(--bg);color:var(--ink);line-height:1.6;font-size:16px}
h1,h2,h3{font-family:'Fraunces',serif;font-weight:600}
.container{max-width:1100px;margin:0 auto;padding:0 32px}
.header{display:flex;justify-content:space-between;align-items:center;padding:24px 0;border-bottom:1px solid var(--border);margin-bottom:40px;flex-wrap:wrap;gap:20px}
.brand{display:flex;align-items:center;gap:12px}.brand-logo{width:48px;height:48px;background:var(--blue);border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:'Fraunces';font-size:16px;font-weight:700;color:white}
.brand-name{font-size:1.3rem;font-weight:600}.brand-tag{font-size:0.7rem;color:var(--slate);text-transform:uppercase;letter-spacing:1.5px}
.prepared{text-align:right}.prepared-label{font-size:0.65rem;text-transform:uppercase;letter-spacing:2px;color:var(--slate);margin-bottom:6px}
.prepared-name{font-size:1.2rem;font-weight:600}.prepared-firm{font-size:0.9rem;color:var(--blue);font-weight:500}
.hero{text-align:center;padding:60px 0}.hero-badge{display:inline-block;padding:10px 24px;background:var(--green);color:white;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;border-radius:100px;margin-bottom:24px;font-weight:600}
.hero-title{font-size:clamp(2rem,6vw,3.5rem);line-height:1.2;margin-bottom:24px}
.hero-number{display:block;font-size:clamp(3rem,8vw,5rem);background:linear-gradient(135deg,var(--green),#047857);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;margin:8px 0}
.hero-subtitle{font-size:1.2rem;color:var(--slate);max-width:700px;margin:0 auto 48px;line-height:1.7}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:48px 0}
@media(max-width:768px){.stats{grid-template-columns:repeat(2,1fr)}}
.stat-card{background:var(--white);border:2px solid var(--border);border-radius:20px;padding:28px 20px;text-align:center;transition:all 0.4s}
.stat-card:hover{transform:translateY(-6px);box-shadow:0 20px 48px rgba(0,0,0,0.08);border-color:var(--blue)}
.stat-card.primary{border-color:var(--green);border-width:3px}
.stat-value{font-family:'Fraunces';font-size:2.2rem;font-weight:700;margin-bottom:8px}
.stat-card.primary .stat-value{color:var(--green);font-size:2.5rem}
.stat-label{font-size:0.7rem;color:var(--slate);text-transform:uppercase;letter-spacing:1.5px;font-weight:600}
section{padding:80px 0}
.section-header{text-align:center;margin-bottom:48px}
.section-badge{display:inline-block;padding:10px 22px;background:var(--ink);color:white;font-size:0.7rem;text-transform:uppercase;letter-spacing:2px;border-radius:100px;margin-bottom:20px;font-weight:600}
.section-title{font-size:clamp(1.8rem,5vw,2.5rem);margin-bottom:16px}
.section-subtitle{font-size:1.1rem;color:var(--slate);max-width:600px;margin:0 auto}
.scorecard{background:var(--white);border-radius:24px;padding:40px;margin:40px 0}
.scorecard-header{text-align:center;margin-bottom:32px}
.score-display{font-family:'Fraunces';font-size:4rem;font-weight:700;color:var(--green);margin:20px 0}
.checks{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
@media(max-width:600px){.checks{grid-template-columns:1fr}}
.check{display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border-radius:12px}
.check-icon{font-size:1.5rem}.check-text{font-size:0.95rem}
table{width:100%;border-collapse:collapse;background:var(--white);border-radius:12px;overflow:hidden;margin:40px 0}
thead{background:var(--ink);color:white}
th{padding:16px;text-align:left;font-weight:600;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px}
td{padding:16px;border-bottom:1px solid var(--border)}
tr:last-child td{border-bottom:none}
tr.your-firm{background:var(--green-light);font-weight:600}
.badge{display:inline-block;padding:4px 12px;border-radius:100px;font-size:0.8rem;font-weight:600}
.badge-yes{background:var(--green-light);color:var(--green)}
.badge-no{background:var(--border);color:var(--slate)}
.issue-list{list-style:none;padding:0}.issue-item{padding:12px;margin:8px 0;background:var(--bg);border-left:4px solid #f59e0b;border-radius:8px}
.math-box{background:var(--green-light);padding:20px;border-radius:12px;margin:20px 0}
.math-box strong{color:var(--green)}
.cta-section{background:linear-gradient(135deg,var(--ink),#1e293b);border-radius:24px;padding:60px 32px;text-align:center;color:white;margin:80px 0}
.cta-title{font-size:clamp(2rem,5vw,2.8rem);margin-bottom:20px}
.btn-cta{display:inline-flex;align-items:center;gap:12px;padding:18px 40px;background:white;color:var(--ink);font-size:1.1rem;font-weight:700;border-radius:100px;text-decoration:none;margin:32px 0;transition:all 0.3s}
.btn-cta:hover{transform:translateY(-3px);box-shadow:0 20px 40px rgba(0,0,0,0.3)}
.footer{padding:40px 0;border-top:2px solid var(--border)}
.footer-content{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:24px}
.footer-brand{display:flex;align-items:center;gap:12px}
.footer-logo{width:40px;height:40px;background:var(--blue);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:white}
</style>
</head>
<body><div class="container">

<header class="header">
<div class="brand"><div class="brand-logo">MM</div><div><div class="brand-name">Mortar Metrics</div><div class="brand-tag">Legal Growth Agency</div></div></div>
<div class="prepared"><div class="prepared-label">Prepared For</div><div class="prepared-name">${contactName}</div><div class="prepared-firm">${r.firmName}</div><div style="font-size:0.8rem;color:var(--slate);margin-top:6px">${today}</div></div>
</header>

<section class="hero">
<div class="hero-badge">Complete Marketing Audit</div>
<h1 class="hero-title">We Found <span class="hero-number">$${(monthlyOpp/1000).toFixed(0)}K/Month</span> in Untapped Revenue</h1>
<p class="hero-subtitle">We analyzed ${r.keywordOpportunities?.length || 10} keywords, ${r.competitors?.length || 0} competitors, and every aspect of your digital presence. Here's exactly where the opportunity is.</p>
<div class="stats">
<div class="stat-card primary"><div class="stat-value">$${(monthlyOpp/1000).toFixed(0)}K</div><div class="stat-label">Monthly Opportunity</div></div>
<div class="stat-card"><div class="stat-value">${r.scorecard?.score || 0}/10</div><div class="stat-label">Current Score</div></div>
<div class="stat-card"><div class="stat-value">${r.keywordOpportunities?.length || 10}</div><div class="stat-label">Keywords Analyzed</div></div>
<div class="stat-card"><div class="stat-value">${r.competitors?.length || 0}</div><div class="stat-label">Competitors Found</div></div>
</div>
</section>

<section>
<div class="section-header"><span class="section-badge">Scorecard</span><h2 class="section-title">Your Marketing Health: ${r.scorecard?.score || 0}/10</h2></div>
<div class="scorecard">
<div class="scorecard-header"><div class="score-display">${r.scorecard?.score || 0}/10</div><p style="color:var(--slate)">Most successful law firms score 8+. Here's what you're missing:</p></div>
<div class="checks">
${genCheck(r.scorecard?.googleAds, 'Google Ads Running')}
${genCheck(r.scorecard?.metaAds, 'Meta Ads Running')}
${genCheck(r.scorecard?.afterHours, '24/7 Intake')}
${genCheck(r.scorecard?.reviews50Plus, '50+ Google Reviews')}
${genCheck(r.scorecard?.rating48Plus, '4.8+ Star Rating')}
${genCheck(r.scorecard?.pageSpeed80, 'PageSpeed 80+')}
${genCheck(r.scorecard?.mobileOptimized, 'Mobile Optimized')}
${genCheck(r.scorecard?.liveChat, 'Live Chat')}
${genCheck(r.scorecard?.caseResults, 'Case Results Displayed')}
${genCheck(r.scorecard?.testimonials, 'Testimonials on Site')}
</div>
</div>
</section>

${r.keywordOpportunities && r.keywordOpportunities.length > 0 ? `
<section>
<div class="section-header"><span class="section-badge">Keyword Research</span><h2 class="section-title">10 High-Value Keywords You Should Own</h2><p class="section-subtitle">These keywords drive ${r.keywordOpportunities.reduce((sum,k)=>sum+k.searchVolume,0).toLocaleString()} monthly searches in your market.</p></div>
<table><thead><tr><th>Keyword</th><th>Monthly Searches</th><th>Cost Per Click</th><th>Current #1</th><th>Difficulty</th></tr></thead>
<tbody>${r.keywordOpportunities.slice(0,10).map(k=>`<tr><td>${k.keyword}</td><td>${k.searchVolume}</td><td>${k.costPerClick}</td><td>${k.currentRank1}</td><td>${k.difficulty}</td></tr>`).join('')}</tbody></table>
<p style="margin-top:20px;color:var(--slate)"><strong>What this means:</strong> These ${r.keywordOpportunities.length} keywords represent ${r.keywordOpportunities.reduce((sum,k)=>sum+k.searchVolume,0).toLocaleString()} potential clients searching every month. Your competitors are ranking for them. You're not.</p>
</section>
` : ''}

${r.websiteAudit ? `
<section>
<div class="section-header"><span class="section-badge">Website Audit</span><h2 class="section-title">We Found ${r.websiteAudit.issues?.length || 0} Issues Costing You Conversions</h2></div>
<div style="background:var(--white);padding:40px;border-radius:24px">
<h3 style="margin-bottom:20px">Performance Scores:</h3>
<div class="stats" style="margin-bottom:40px">
<div class="stat-card"><div class="stat-value">${r.websiteAudit.pageSpeedDesktop}/100</div><div class="stat-label">Desktop Speed</div></div>
<div class="stat-card"><div class="stat-value">${r.websiteAudit.pageSpeedMobile}/100</div><div class="stat-label">Mobile Speed</div></div>
<div class="stat-card"><div class="stat-value">${r.websiteAudit.loadTimeSeconds}s</div><div class="stat-label">Load Time</div></div>
<div class="stat-card"><div class="stat-value">${r.websiteAudit.practiceAreaPages}</div><div class="stat-label">Practice Pages</div></div>
</div>
<h3 style="margin-bottom:20px">Critical Issues:</h3>
<ul class="issue-list">${(r.websiteAudit.issues || []).map(i=>`<li class="issue-item">${i}</li>`).join('')}</ul>
<p style="margin-top:20px;padding:20px;background:var(--green-light);border-radius:12px"><strong>Quick Fix:</strong> We can resolve all ${r.websiteAudit.issues?.length || 0} issues in Week 1. Each fix improves conversion rates by 5-15%.</p>
</div>
</section>
` : ''}

<section>
<div class="section-header"><span class="section-badge">Revenue Gaps</span><h2 class="section-title">Here's the Math Behind $${(monthlyOpp/1000).toFixed(0)}K/Month</h2><p class="section-subtitle">Every number below is based on industry benchmarks for ${r.practiceAreas[0]} firms.</p></div>
${Object.entries(r.gaps || {}).filter(([k,g])=>g.hasGap && g.monthlyLoss > 0).map(([key,gap])=>`
<div style="background:var(--white);padding:32px;border-radius:20px;margin:20px 0">
<h3 style="margin-bottom:16px;text-transform:capitalize">${key.replace(/([A-Z])/g,' $1').trim()} Gap: $${gap.monthlyLoss.toLocaleString()}/mo</h3>
<div class="math-box"><strong>The Math:</strong> ${gap.math}</div>
<p style="color:var(--slate);margin-top:16px"><strong>What this means:</strong> ${explainGap(key, gap, r)}</p>
</div>
`).join('')}
<div style="background:linear-gradient(135deg,var(--green),#047857);padding:40px;border-radius:24px;text-align:center;color:white;margin-top:40px">
<div style="font-size:0.9rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px">Total Monthly Opportunity</div>
<div style="font-family:'Fraunces';font-size:4rem;font-weight:700">$${monthlyOpp.toLocaleString()}</div>
<div style="font-size:1.2rem;margin-top:12px">$${yearlyOpp.toLocaleString()}/year if we capture all of it</div>
</div>
</section>

<section class="cta-section">
<h2 class="cta-title">Let's Execute This for ${r.firmName}</h2>
<p style="font-size:1.1rem;opacity:0.9;margin-bottom:40px;line-height:1.7">Book a 15-minute call. We'll validate these numbers, show you competitor strategies, and build your 90-day roadmap. If it makes sense, we start Monday.</p>
<a href="https://calendly.com/mortarmetrics" class="btn-cta">Book Your Strategy Call →</a>
<p style="font-size:0.95rem;opacity:0.8;margin-top:20px">On the call you'll get: Full competitor breakdown • Keyword targeting strategy • Week 1 action plan • ROI projections • Pricing options</p>
</section>

<footer class="footer">
<div class="footer-content">
<div class="footer-brand"><div class="footer-logo">MM</div><div><div style="font-size:1.1rem;font-weight:500">Mortar Metrics</div><div style="font-size:0.7rem;color:var(--slate);text-transform:uppercase">Legal Growth Agency</div></div></div>
<div style="font-size:0.9rem;color:var(--slate)">Questions? <a href="mailto:hello@mortarmetrics.com" style="color:var(--blue);text-decoration:none;font-weight:600">hello@mortarmetrics.com</a></div>
</div>
</footer>

</div></body></html>`;

return html;
}

function genCheck(val, text) {
  return `<div class="check"><div class="check-icon">${val?'✅':'❌'}</div><div class="check-text">${text}</div></div>`;
}

function explainGap(key, gap, r) {
  const explanations = {
    googleAds: `${gap.leads} high-intent people search for "${r.practiceAreas[0]} lawyer" every month. They call the firms that show up first (Google Ads + LSAs). You're not showing up, so they're calling your competitors.`,
    metaAds: `${gap.leads} potential clients see your competitors' ads on Facebook/Instagram every month. These are people who visited law firm websites recently or fit your ideal client profile. They're being retargeted. You're not.`,
    afterHours: `${gap.leads} people call or fill out forms after 5 PM every month. They get voicemail or "We'll respond in 24 hours." Your competitors with AI intake answer in 2 minutes. Those ${gap.leads} cases go elsewhere.`,
    websiteSpeed: `Your site loses ${gap.visitorLoss*100}% of visitors due to slow load time. ${gap.visitors} visitors/month × ${gap.visitorLoss*100}% loss × $${gap.value} value per visitor = real money walking away before they even see your content.`,
    reviews: `Firms with 50+ reviews at 4.8★+ convert ${gap.conversionDiff*100}% better than those with fewer. You're losing ${gap.conversionDiff*100}% of ${gap.leads} monthly leads because prospects choose the firm with more social proof.`
  };
  return explanations[key] || `This gap is costing you $${gap.monthlyLoss.toLocaleString()}/month in lost revenue.`;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node report-generator-v10.js <research.json> <Contact Name>');
    process.exit(1);
  }
  const researchPath = args[0];
  const contactName = args[1];
  const html = generateReport(researchPath, contactName);
  const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
  const outputPath = path.join(path.dirname(researchPath), `${research.firmName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report-v10.html`);
  fs.writeFileSync(outputPath, html);
  console.log(`✅ Report generated: ${outputPath}`);
}

module.exports = { generateReport };
