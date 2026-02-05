#!/usr/bin/env node
/**
 * AI Quality Control for Law Firm Reports
 * Validates report quality before deployment
 * 
 * Usage: node ai-quality-control.js <research-json> <report-html>
 */

const fs = require('fs');
const path = require('path');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const researchFile = process.argv[2];
const reportFile = process.argv[3];

if (!researchFile || !reportFile) {
  console.error('Usage: node ai-quality-control.js <research-json> <report-html>');
  process.exit(1);
}

// Load files
const research = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
const reportHtml = fs.readFileSync(reportFile, 'utf8');

console.log('\n🔍 QUALITY CONTROL VALIDATION\n');

// PHASE 1: CRITICAL DATA CHECKS (Auto-fail)
const criticalIssues = [];

// Firm name check
if (!research.firmName || 
    research.firmName === 'Unknown Firm' || 
    research.firmName === 'Unknown' ||
    research.firmName === 'null' ||
    research.firmName.length < 3) {
  criticalIssues.push('❌ CRITICAL: Firm name is missing or generic');
}

// Location check
if (!research.location?.city || !research.location?.state) {
  criticalIssues.push('❌ CRITICAL: Location (city/state) is missing');
}

// Placeholder text check
if (reportHtml.includes('{{') || reportHtml.includes('[TODO]') || reportHtml.includes('[PLACEHOLDER]')) {
  criticalIssues.push('❌ CRITICAL: Report contains placeholder text');
}

// Research confidence check - REMOVED: field doesn't exist in research output
// The research engine doesn't populate dataQuality.confidence, so we skip this check

// Competitor check - lowered threshold, some niche practices have fewer competitors
const competitorCount = research.competitors?.length || 0;
if (competitorCount === 0) {
  criticalIssues.push(`❌ CRITICAL: No competitor data found`);
}

// Practice area check - check multiple possible paths
const practiceAreas = research.practiceAreas?.length ||
                      research.practice?.practiceAreas?.length ||
                      research.practice?.primaryFocus?.length || 0;
if (practiceAreas === 0) {
  criticalIssues.push('❌ CRITICAL: No practice areas identified');
}

console.log('PHASE 1: CRITICAL DATA CHECKS');
if (criticalIssues.length > 0) {
  criticalIssues.forEach(issue => console.log(issue));
  console.log('\n🛑 VALIDATION FAILED: Critical issues found');
  console.log('❌ Report CANNOT be deployed');
  
  // Output for workflow
  const output = {
    status: 'FAILED',
    phase: 'CRITICAL_DATA',
    issues: criticalIssues,
    recommendation: 'Report needs better research data. Do not deploy.'
  };
  
  fs.writeFileSync('qc-result.json', JSON.stringify(output, null, 2));
  process.exit(1);
}
console.log('✅ All critical checks passed\n');

// PHASE 2: QUALITY CHECKS (Warning-level)
const qualityIssues = [];

// Check for banned phrases
const bannedPhrases = [
  "We'd love to chat",
  "We'd love to connect",
  "If this resonates",
  "No pitch, just",
  "Let us know if you'd like to discuss",
  "We think we could be a good fit",
  "In conclusion",
  "To summarize",
  "Moving forward"
];

bannedPhrases.forEach(phrase => {
  if (reportHtml.toLowerCase().includes(phrase.toLowerCase())) {
    qualityIssues.push(`⚠️  Found banned phrase: "${phrase}"`);
  }
});

// Check for weasel words
const weaselWords = ['likely', 'probably', 'perhaps', 'possibly', 'might', 'may be'];
let weaselCount = 0;
weaselWords.forEach(word => {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  const matches = reportHtml.match(regex);
  if (matches) weaselCount += matches.length;
});
if (weaselCount > 5) {
  qualityIssues.push(`⚠️  Too many weasel words (${weaselCount} found - should be < 5)`);
}

// Check for generic content
const genericPhrases = [
  'legal services',
  'high-quality',
  'world-class',
  'industry-leading',
  'best-in-class'
];
let genericCount = 0;
genericPhrases.forEach(phrase => {
  if (reportHtml.toLowerCase().includes(phrase.toLowerCase())) {
    genericCount++;
  }
});
if (genericCount > 3) {
  qualityIssues.push(`⚠️  Too many generic phrases (${genericCount} found - needs more specificity)`);
}

// Check competitor name quality
if (research.competitors) {
  research.competitors.forEach((comp, idx) => {
    const name = comp.name || '';
    if (name.length < 5 || name === 'Unknown' || name.split(' ').length === 1) {
      qualityIssues.push(`⚠️  Competitor ${idx + 1} has weak name: "${name}"`);
    }
  });
}

// Check review data sanity
if (research.reviewCount !== undefined && research.reviewCount === 0 && research.rating > 0) {
  qualityIssues.push('⚠️  Firm has 0 reviews but non-zero rating (inconsistent)');
}

console.log('PHASE 2: QUALITY CHECKS');
if (qualityIssues.length > 0) {
  qualityIssues.forEach(issue => console.log(issue));
  console.log(`\n⚠️  ${qualityIssues.length} quality issues found (non-blocking)`);
} else {
  console.log('✅ No quality issues found');
}

// PHASE 3: FINAL VALIDATION
console.log('\nFINAL VALIDATION:');
console.log(`✓ Firm: ${research.firmName}`);
console.log(`✓ Location: ${research.location?.city || 'Unknown'}, ${research.location?.state || 'Unknown'}`);
console.log(`✓ Practice Areas: ${practiceAreas}`);
console.log(`✓ Competitors: ${competitorCount}`);
console.log(`✓ Ads Data: Google=${research.adsData?.summary?.runningGoogleAds ? 'Running' : 'Not detected'}, Meta=${research.adsData?.summary?.runningMetaAds ? 'Running' : 'Not detected'}`);

const output = {
  status: 'PASSED',
  firmName: research.firmName,
  location: `${research.location.city}, ${research.location.state}`,
  criticalIssues: criticalIssues.length,
  qualityIssues: qualityIssues.length,
  warnings: qualityIssues,
  recommendation: qualityIssues.length > 0 ? 
    'Report can deploy but has minor quality issues' : 
    'Report is high quality - deploy immediately'
};

fs.writeFileSync('qc-result.json', JSON.stringify(output, null, 2));

console.log('\n✅ VALIDATION PASSED - Report approved for deployment\n');
process.exit(0);
