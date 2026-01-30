#!/usr/bin/env node
/**
 * Inject AI enhancements into the report
 * Replaces generic copy with personalized insights (subtly)
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
let html = fs.readFileSync(reportHtmlPath, 'utf8');
const research = JSON.parse(fs.readFileSync(researchJsonPath, 'utf8'));

if (!research.ai_enhancements) {
  console.log('⚠️  No AI enhancements found. Skipping.');
  process.exit(0);
}

console.log('🤖 Enhancing report with AI insights...');

const ai = research.ai_enhancements;

// 1. Enhance the hero hook (replace generic intro paragraph)
// Find the paragraph after the hero heading and replace it
const heroPattern = /<h1>.*?<\/h1>\s*<p>(.*?)<\/p>/s;
const heroMatch = html.match(heroPattern);

if (heroMatch) {
  const genericIntro = heroMatch[1];
  html = html.replace(genericIntro, ai.personalized_hook);
  console.log('   ✓ Enhanced hero hook');
}

// 2. Enhance gap explanations
// Replace the generic "Here's what we found:" paragraph with the opportunity frame
const whatWeFoundPattern = /<p>Here's what we found:.*?<\/p>/s;
if (html.match(whatWeFoundPattern)) {
  html = html.replace(whatWeFoundPattern, `<p>${ai.opportunity_frame}</p>`);
  console.log('   ✓ Enhanced opportunity framing');
}

// 3. Enhance individual gap descriptions
// Look for gap sections and add personalized context

// Meta Ads gap
if (ai.gap_explanations.meta_ads) {
  const metaPattern = /(<div class="gap-item">[\s\S]*?<h3>Not Running Meta Ads<\/h3>\s*<p>)([\s\S]*?)(<\/p>)/;
  const metaMatch = html.match(metaPattern);
  if (metaMatch) {
    html = html.replace(metaPattern, `$1${ai.gap_explanations.meta_ads}$3`);
    console.log('   ✓ Enhanced Meta ads explanation');
  }
}

// Google Ads gap
if (ai.gap_explanations.google_ads) {
  const googlePattern = /(<div class="gap-item">[\s\S]*?<h3>Not Running Google Ads<\/h3>\s*<p>)([\s\S]*?)(<\/p>)/;
  const googleMatch = html.match(googlePattern);
  if (googleMatch) {
    html = html.replace(googlePattern, `$1${ai.gap_explanations.google_ads}$3`);
    console.log('   ✓ Enhanced Google ads explanation');
  }
}

// 24/7 Intake gap
if (ai.gap_explanations.intake_24_7) {
  const intakePattern = /(<div class="gap-item">[\s\S]*?<h3>No 24\/7 Intake System<\/h3>\s*<p>)([\s\S]*?)(<\/p>)/;
  const intakeMatch = html.match(intakePattern);
  if (intakeMatch) {
    html = html.replace(intakePattern, `$1${ai.gap_explanations.intake_24_7}$3`);
    console.log('   ✓ Enhanced intake explanation');
  }
}

// CRM gap
if (ai.gap_explanations.crm) {
  const crmPattern = /(<div class="gap-item">[\s\S]*?<h3>No Automated CRM<\/h3>\s*<p>)([\s\S]*?)(<\/p>)/;
  const crmMatch = html.match(crmPattern);
  if (crmMatch) {
    html = html.replace(crmPattern, `$1${ai.gap_explanations.crm}$3`);
    console.log('   ✓ Enhanced CRM explanation');
  }
}

// Save enhanced report
fs.writeFileSync(reportHtmlPath, html);

console.log('✅ Report enhanced with AI insights (seamlessly)');
