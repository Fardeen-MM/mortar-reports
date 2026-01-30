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

// Google Ads gap (matches template: "You're invisible on Google")
if (ai.gap_explanations.google_ads) {
  const googlePattern = /(<div class="gap-title">You're invisible on Google<\/div>[\s\S]{0,500}<p>)([\s\S]{100,600}?)(<\/p>)/;
  if (html.match(googlePattern)) {
    html = html.replace(googlePattern, `$1${ai.gap_explanations.google_ads}$3`);
    console.log('   ✓ Enhanced Google ads explanation');
  }
}

// 24/7 Intake gap (matches template: "Nobody's answering the phone at 9pm")
if (ai.gap_explanations.intake_24_7) {
  const intakePattern = /(<div class="gap-title">Nobody's answering the phone at 9pm<\/div>[\s\S]{0,500}<p>)([\s\S]{100,600}?)(<\/p>)/;
  if (html.match(intakePattern)) {
    html = html.replace(intakePattern, `$1${ai.gap_explanations.intake_24_7}$3`);
    console.log('   ✓ Enhanced intake explanation');
  }
}

// Meta Ads gap (matches template: "Not running Facebook/Instagram ads")
if (ai.gap_explanations.meta_ads) {
  const metaPattern = /(<div class="gap-title">Not running Facebook\/Instagram ads<\/div>[\s\S]{0,500}<p>)([\s\S]{100,600}?)(<\/p>)/;
  if (html.match(metaPattern)) {
    html = html.replace(metaPattern, `$1${ai.gap_explanations.meta_ads}$3`);
    console.log('   ✓ Enhanced Meta ads explanation');
  }
}

// CRM gap (matches template: "Voice AI + CRM")
if (ai.gap_explanations.crm) {
  const crmPattern = /(<div class="gap-title">Voice AI \+ CRM<\/div>[\s\S]{0,500}<p>)([\s\S]{100,600}?)(<\/p>)/;
  if (html.match(crmPattern)) {
    html = html.replace(crmPattern, `$1${ai.gap_explanations.crm}$3`);
    console.log('   ✓ Enhanced CRM explanation');
  }
}

// Save enhanced report
fs.writeFileSync(reportHtmlPath, html);

console.log('✅ Report enhanced with AI insights (seamlessly)');
