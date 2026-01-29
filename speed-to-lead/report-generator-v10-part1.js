#!/usr/bin/env node
/**
 * REPORT GENERATOR V10 - MASSIVE VALUE AUDIT
 * 
 * Make them feel like they got a $5,000 audit for free.
 * 17 comprehensive sections with deep explanations.
 */

const fs = require('fs');
const path = require('path');

function generateReport(researchPath, contactName) {
  const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
  
  const {
    firmName,
    location,
    practiceAreas,
    competitors = [],
    keywordOpportunities = [],
    websiteAudit,
    googleProfile,
    adAnalysis,
    localSEO = {},
    scorecard,
    gaps,
    totalMonthlyLoss,
    avgCaseValue
  } = research;

  const primaryPractice = practiceAreas[0] || 'legal services';
  const locationStr = location.full || location.city + ', ' + location.state;
  
  const monthlyOpp = totalMonthlyLoss;
  const yearlyOpp = monthlyOpp * 12;
  const weeklyOpp = Math.round(monthlyOpp / 4);
  
  const today = new Date().toLocaleDateString('en-US', { 
    month: 'long', day: 'numeric', year: 'numeric' 
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Marketing Audit: ${firmName} | $${(monthlyOpp/1000).toFixed(0)}K/Mo Opportunity</title>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  ${getStyles()}
</head>
<body>
  <div class="container">
    
    ${generateHeader(contactName, firmName, today)}
    ${generateHero(firmName, locationStr, primaryPractice, monthlyOpp, competitors.length, keywordOpportunities.length)}
    ${generateScorecard(scorecard)}
    ${generateCompetitorTable(firmName, competitors, googleProfile)}
    ${generateKeywordTable(keywordOpportunities, primaryPractice, locationStr)}
    ${generateWebsiteAudit(websiteAudit, firmName)}
    ${generateGoogleProfileAudit(googleProfile, competitors, firmName)}
    ${generateAdAnalysis(adAnalysis, firmName, primaryPractice)}
    ${generatePainScenarios(firmName, locationStr, primaryPractice)}
    ${generateRevenueGaps(gaps, firmName, avgCaseValue)}
    ${generateMidCTA(firmName)}
    ${generateSolutions(gaps, firmName, primaryPractice, locationStr)}
    ${generateTimeline()}
    ${generateCaseStudy(primaryPractice)}
    ${generateFAQ(firmName)}
    ${generateFinalCTA(firmName, weeklyOpp)}

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

  ${getJavaScript()}
</body>
</html>`;

  return html;
}
