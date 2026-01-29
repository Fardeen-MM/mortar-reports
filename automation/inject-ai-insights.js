#!/usr/bin/env node
/**
 * Inject AI insights into generated HTML report
 * This enhances the template-based report with strategic AI analysis
 * 
 * Usage: node inject-ai-insights.js <report-html-path> <research-json-path>
 */

const fs = require('fs');

const reportHtmlPath = process.argv[2];
const researchJsonPath = process.argv[3];

if (!reportHtmlPath || !researchJsonPath) {
  console.error('Usage: node inject-ai-insights.js <report-html-path> <research-json-path>');
  process.exit(1);
}

// Load files
const html = fs.readFileSync(reportHtmlPath, 'utf8');
const research = JSON.parse(fs.readFileSync(researchJsonPath, 'utf8'));

if (!research.ai_analysis) {
  console.log('⚠️  No AI analysis found in research data. Skipping AI enhancement.');
  process.exit(0);
}

console.log('🤖 Injecting AI insights into report...');

const ai = research.ai_analysis;

// Build AI insights section
const aiInsightsSection = `
    <div class="big-divider"></div>
    
    <h2>Strategic Analysis</h2>
    <p>We ran your firm through our AI analysis engine. Here's what stood out:</p>
    
    <div class="blue-ocean">
      <div class="blue-ocean-badge">AI INSIGHT</div>
      <p><strong>${ai.executive_summary}</strong></p>
    </div>
    
    <h3>Your Unique Position</h3>
    <p>${ai.positioning}</p>
    
    <h3>Competitive Landscape</h3>
    <p>${ai.competitive_analysis}</p>
    
    <h3>Market Opportunity</h3>
    <p>${ai.market_insights}</p>
    
    <h3>What You Should Do First</h3>
    <p>Based on your specific situation, here's what we'd prioritize:</p>
    <ul>
${ai.strategic_recommendations.map(rec => `      <li>${rec}</li>`).join('\n')}
    </ul>
    
    ${ai.hidden_opportunities && ai.hidden_opportunities.length > 0 ? `
    <h3>Hidden Opportunities</h3>
    <p>Non-obvious gaps your competitors aren't exploiting:</p>
    <ul>
${ai.hidden_opportunities.map(opp => `      <li>${opp}</li>`).join('\n')}
    </ul>
    ` : ''}
`;

// Inject before "The Problems Costing You Money" section
const injectionPoint = html.indexOf('<h2>The Problems Costing You Money</h2>');

if (injectionPoint === -1) {
  console.error('❌ Could not find injection point in HTML');
  process.exit(1);
}

const enhancedHtml = html.slice(0, injectionPoint) + aiInsightsSection + html.slice(injectionPoint);

// Save enhanced report
fs.writeFileSync(reportHtmlPath, enhancedHtml);

console.log('✅ AI insights injected successfully');
console.log(`📊 Added:`);
console.log(`   - Executive summary`);
console.log(`   - Positioning analysis`);
console.log(`   - Competitive analysis`);
console.log(`   - Market insights`);
console.log(`   - ${ai.strategic_recommendations.length} strategic recommendations`);
if (ai.hidden_opportunities) {
  console.log(`   - ${ai.hidden_opportunities.length} hidden opportunities`);
}
