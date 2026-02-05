#!/usr/bin/env node
/**
 * Quality Control for V3 Law Firm Reports
 *
 * Validates reports before sending to ensure quality.
 *
 * CRITICAL = Auto-fail, report cannot be sent
 * IMPORTANT = Should fail, but can override
 * WARNING = Flag for review, doesn't block
 *
 * Usage: node ai-quality-control-basic.js <research-json> <report-html>
 */

const fs = require('fs');

const researchFile = process.argv[2];
const reportFile = process.argv[3];

if (!researchFile || !reportFile) {
  console.error('Usage: node ai-quality-control-basic.js <research-json> <report-html>');
  process.exit(1);
}

// Load files
let research, reportHtml;
try {
  research = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
  reportHtml = fs.readFileSync(reportFile, 'utf8');
} catch (e) {
  console.error(`❌ Failed to load files: ${e.message}`);
  const output = { status: 'FAILED', phase: 'FILE_LOAD', issues: [e.message] };
  fs.writeFileSync('qc-result.json', JSON.stringify(output, null, 2));
  process.exit(1);
}

console.log('\n🔍 QUALITY CONTROL - V3 REPORT VALIDATION\n');

const criticalIssues = [];
const importantIssues = [];
const warnings = [];

// ============================================================================
// PHASE 1: CRITICAL CHECKS (Auto-fail)
// ============================================================================
console.log('━━━ PHASE 1: CRITICAL CHECKS ━━━');

// 1.1 Firm name
const firmName = research.firmName || '';
if (!firmName || firmName === 'Unknown Firm' || firmName === 'Unknown' || firmName.length < 3) {
  criticalIssues.push('Firm name missing or invalid');
} else if (firmName.length > 80) {
  criticalIssues.push(`Firm name too long (${firmName.length} chars)`);
} else {
  console.log(`✓ Firm name: ${firmName}`);
}

// 1.2 Location - city required
const city = research.location?.city || '';
const state = research.location?.state || '';
const country = research.location?.country || '';
if (!city) {
  criticalIssues.push('City is missing');
} else {
  const locationStr = state ? `${city}, ${state}` : city;
  console.log(`✓ Location: ${locationStr}${country ? ` (${country})` : ''}`);
}

// 1.3 Report HTML exists and is reasonable
if (!reportHtml || reportHtml.length < 1000) {
  criticalIssues.push('Report HTML is empty or too short');
} else if (reportHtml.length > 500000) {
  criticalIssues.push('Report HTML is suspiciously large');
} else {
  console.log(`✓ Report size: ${Math.round(reportHtml.length / 1024)}KB`);
}

// 1.4 No placeholder text
const placeholders = ['{{', '}}', '[TODO]', '[PLACEHOLDER]', 'undefined', 'NaN'];
const foundPlaceholders = placeholders.filter(p => reportHtml.includes(p));
if (foundPlaceholders.length > 0) {
  criticalIssues.push(`Placeholder text found: ${foundPlaceholders.join(', ')}`);
} else {
  console.log('✓ No placeholder text');
}

// 1.5 Practice areas identified
const practiceAreas = research.practiceAreas || research.practice?.practiceAreas || [];
const practiceCount = Array.isArray(practiceAreas) ? practiceAreas.length : 0;
if (practiceCount === 0) {
  criticalIssues.push('No practice areas identified');
} else {
  console.log(`✓ Practice areas: ${practiceCount} found`);
}

// Check critical failures
if (criticalIssues.length > 0) {
  console.log('\n🛑 CRITICAL FAILURES:');
  criticalIssues.forEach(issue => console.log(`   ❌ ${issue}`));
  console.log('\n❌ QC FAILED - Report cannot be sent\n');

  const output = {
    status: 'FAILED',
    phase: 'CRITICAL',
    criticalIssues: criticalIssues.length,
    qualityIssues: 0,
    issues: criticalIssues,
    recommendation: 'Report has critical issues. Do not send.'
  };
  fs.writeFileSync('qc-result.json', JSON.stringify(output, null, 2));
  process.exit(1);
}
console.log('✅ All critical checks passed\n');

// ============================================================================
// PHASE 2: IMPORTANT CHECKS (Should fail)
// ============================================================================
console.log('━━━ PHASE 2: IMPORTANT CHECKS ━━━');

// 2.1 Competitors exist and have data
const competitors = research.competitors || [];
if (competitors.length === 0) {
  importantIssues.push('No competitors found - chart will be empty');
} else {
  // Handle both old format (strings) and new format (objects with reviews)
  const validCompetitors = competitors.filter(c => {
    if (typeof c === 'string') return c.length > 3;
    return c.name && c.name.length > 3;
  });
  const withReviews = competitors.filter(c =>
    typeof c === 'object' && (c.reviews > 0 || c.reviewCount > 0)
  );
  if (validCompetitors.length === 0) {
    importantIssues.push('No valid competitor names');
  } else if (withReviews.length === 0 && typeof competitors[0] === 'object') {
    warnings.push('Competitors have no review data - chart may look weak');
  }
  console.log(`✓ Competitors: ${validCompetitors.length} found`);
}

// 2.2 Firm's Google Business data
const firmReviews = research.googleBusiness?.reviews || research.reviewCount || 0;
const firmRating = research.googleBusiness?.rating || research.rating || 0;
if (firmReviews === 0 && firmRating === 0) {
  warnings.push('No Google Business data - "You" bar will show 0 reviews');
} else {
  console.log(`✓ Firm reviews: ${firmReviews} (${firmRating}★)`);
}

// 2.3 Gap calculations in HTML (format: $1.5K-3K/mo or $1,500-3,000/mo)
const gapMatches = reportHtml.match(/\$[\d.,]+K?-[\d.,]+K?\/mo/g) || [];
if (gapMatches.length < 3) {
  importantIssues.push(`Missing gap calculations (found ${gapMatches.length}, need 3)`);
} else {
  // Check for $0 gaps
  const zeroGaps = gapMatches.filter(g => g.match(/\$0[^0-9.]/));
  if (zeroGaps.length > 0) {
    importantIssues.push('Some gaps show $0 value');
  } else {
    console.log(`✓ Gap calculations: ${gapMatches.length} found`);
  }
}

// 2.4 Total strip exists
if (!reportHtml.includes('total-strip') && !reportHtml.includes('Total opportunity')) {
  importantIssues.push('Total strip section missing');
} else {
  console.log('✓ Total strip present');
}

// Check important failures
if (importantIssues.length > 0) {
  console.log('\n⚠️  IMPORTANT ISSUES:');
  importantIssues.forEach(issue => console.log(`   ⚠️  ${issue}`));
}

// ============================================================================
// PHASE 3: QUALITY WARNINGS
// ============================================================================
console.log('\n━━━ PHASE 3: QUALITY CHECKS ━━━');

// 3.1 Contact name personalization
const contactName = research.contactPerson || '';
const genericNames = ['partner', 'attorney', 'lawyer', 'counsel', 'firm'];
const isGenericContact = !contactName || genericNames.some(g =>
  contactName.toLowerCase() === g || contactName.toLowerCase().includes('unknown')
);
if (isGenericContact) {
  warnings.push(`Contact name is generic: "${contactName || 'none'}"`);
} else {
  console.log(`✓ Contact: ${contactName}`);
}

// 3.2 Ads detection status
const adsDetectionFailed = research.adsData?.detectionSucceeded === false;
if (adsDetectionFailed) {
  warnings.push('Ads detection failed - assuming no ads');
} else {
  const gAds = research.adsData?.summary?.runningGoogleAds ? 'Yes' : 'No';
  const mAds = research.adsData?.summary?.runningMetaAds ? 'Yes' : 'No';
  console.log(`✓ Ads detected: Google=${gAds}, Meta=${mAds}`);
}

// 3.3 Check for bad content patterns
const badPatterns = [
  { pattern: /\$0[^0-9]/g, desc: '$0 amounts' },
  { pattern: /undefined/gi, desc: 'undefined values' },
  { pattern: /null/gi, desc: 'null values' },
  { pattern: /NaN/g, desc: 'NaN values' },
  { pattern: /\[object Object\]/g, desc: 'object serialization errors' }
];

badPatterns.forEach(({ pattern, desc }) => {
  const matches = reportHtml.match(pattern);
  if (matches && matches.length > 0) {
    warnings.push(`Found ${matches.length} ${desc} in report`);
  }
});

// 3.4 Report structure check
const requiredSections = [
  { marker: 'gap-card', name: 'Gap cards' },
  { marker: 'competitor-section', name: 'Competitor section' },
  { marker: 'build-list', name: 'Build list' },
  { marker: 'class="cta"', name: 'CTA section' }
];

requiredSections.forEach(({ marker, name }) => {
  if (!reportHtml.includes(marker)) {
    warnings.push(`Missing section: ${name}`);
  }
});

// 3.5 Banned marketing phrases
const bannedPhrases = [
  "we'd love to chat",
  "we'd love to connect",
  "if this resonates",
  "no pitch, just",
  "in conclusion",
  "to summarize"
];

bannedPhrases.forEach(phrase => {
  if (reportHtml.toLowerCase().includes(phrase)) {
    warnings.push(`Banned phrase: "${phrase}"`);
  }
});

if (warnings.length > 0) {
  console.log('\n📋 WARNINGS:');
  warnings.forEach(w => console.log(`   📋 ${w}`));
}

// ============================================================================
// FINAL RESULT
// ============================================================================
console.log('\n━━━ FINAL RESULT ━━━');

const totalIssues = importantIssues.length + warnings.length;
const shouldFail = importantIssues.length > 0;

// Determine status
let status, recommendation;
if (shouldFail) {
  status = 'FAILED';
  recommendation = `${importantIssues.length} important issue(s) found. Review before sending.`;
  console.log(`\n❌ QC FAILED - ${importantIssues.length} important issues\n`);
} else if (warnings.length > 0) {
  status = 'PASSED';
  recommendation = `Passed with ${warnings.length} warning(s). Safe to send.`;
  console.log(`\n✅ QC PASSED with ${warnings.length} warnings\n`);
} else {
  status = 'PASSED';
  recommendation = 'High quality report. Send immediately.';
  console.log('\n✅ QC PASSED - High quality report\n');
}

// Write result
const output = {
  status,
  firmName: research.firmName,
  location: state ? `${city}, ${state}` : city,
  criticalIssues: criticalIssues.length,
  qualityIssues: importantIssues.length + warnings.length,
  importantIssues,
  warnings,
  recommendation
};

fs.writeFileSync('qc-result.json', JSON.stringify(output, null, 2));

// Exit code: 0 for pass, 1 for fail
process.exit(shouldFail ? 1 : 0);
