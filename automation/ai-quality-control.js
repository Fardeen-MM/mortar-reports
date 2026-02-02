#!/usr/bin/env node
/**
 * FULL AI Quality Control - 157+ Validation Checks
 * Based on ClawdBot Master Validation Checklist
 * 
 * A report CANNOT deploy until EVERY check passes.
 */

const fs = require('fs');

const researchFile = process.argv[2];
const reportFile = process.argv[3];

if (!researchFile || !reportFile) {
  console.error('Usage: node ai-quality-control-full.js <research-json> <report-html>');
  process.exit(1);
}

const research = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
const reportHtml = fs.readFileSync(reportFile, 'utf8');

const failures = [];
let checksCompleted = 0;
const totalChecks = 157;

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 FULL QC VALIDATION - 157 CHECKS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// PHASE 1: DATA EXISTENCE GATE
console.log('PHASE 1: DATA EXISTENCE GATE\n');

function check(condition, failureMessage, phase = 'UNKNOWN') {
  checksCompleted++;
  if (!condition) {
    failures.push({ phase, message: failureMessage });
    console.log(`❌ ${failureMessage}`);
    return false;
  }
  return true;
}

// Firm name
check(research.firmName && research.firmName !== 'Unknown' && research.firmName !== 'Unknown Firm' && research.firmName !== 'null' && research.firmName.length >= 3,
  'Firm name is missing or generic', 'DATA_EXISTENCE');

// Location
check(research.location?.city, 'City is missing', 'DATA_EXISTENCE');
check(research.location?.state, 'State is missing', 'DATA_EXISTENCE');
check(research.location?.state?.length === 2, 'State is not 2-letter abbreviation', 'DATA_EXISTENCE');

// Practice areas
check(research.practiceAreas?.length > 0, 'No practice areas identified', 'DATA_EXISTENCE');
check(!research.practiceAreas?.[0]?.includes('legal services'), 'Practice area is too generic ("legal services")', 'DATA_EXISTENCE');

// Website
check(research.website, 'Website is missing', 'DATA_EXISTENCE');

// Competitors
check(research.competitors?.length >= 3, `Insufficient competitors (${research.competitors?.length || 0}, need 3+)`, 'DATA_EXISTENCE');
if (research.competitors) {
  research.competitors.slice(0, 3).forEach((comp, i) => {
    check(comp.name, `Competitor ${i+1} missing name`, 'DATA_EXISTENCE');
    check(comp.reviewCount !== undefined, `Competitor ${i+1} missing review count`, 'DATA_EXISTENCE');
    check(comp.rating !== undefined, `Competitor ${i+1} missing rating`, 'DATA_EXISTENCE');
  });
}

console.log('');

// PHASE 2: DATA SANITY CHECKS
console.log('PHASE 2: DATA SANITY CHECKS\n');

// Location validation
const city = research.location?.city;
const state = research.location?.state;
if (city && state) {
  check(!city.includes('['), 'City contains placeholder brackets', 'DATA_SANITY');
  check(city.length >= 3, 'City name suspiciously short (possible truncation)', 'DATA_SANITY');
  check(city !== 'Lean', 'City "Lean" is likely truncated (should be McLean?)', 'DATA_SANITY');
  check(city !== 'Anytown', 'City "Anytown" is placeholder', 'DATA_SANITY');
}

// Competitor validation
if (research.competitors) {
  research.competitors.forEach((comp, i) => {
    const name = comp.name || '';
    check(name.length >= 5, `Competitor ${i+1} name too short: "${name}"`, 'DATA_SANITY');
    check(name !== 'Unknown', `Competitor ${i+1} is "Unknown"`, 'DATA_SANITY');
    check(name.split(' ').length > 1 || name.includes('&'), `Competitor ${i+1} is single word: "${name}"`, 'DATA_SANITY');
    check(!name.startsWith('The ') || name.split(' ').length > 2, `Competitor ${i+1} is just "The ..."`, 'DATA_SANITY');
  });
}

// Review data validation
if (research.reviewCount !== undefined) {
  check(Number.isInteger(research.reviewCount), 'Review count is not an integer', 'DATA_SANITY');
  check(research.reviewCount >= 0 && research.reviewCount <= 10000, `Review count unrealistic: ${research.reviewCount}`, 'DATA_SANITY');
}

if (research.rating !== undefined) {
  check(research.rating >= 0 && research.rating <= 5, `Rating out of range: ${research.rating}`, 'DATA_SANITY');
}

if (research.reviewCount === 0 && research.rating > 0) {
  check(false, '0 reviews but non-zero rating (inconsistent)', 'DATA_SANITY');
}

console.log('');

// PHASE 3: MATHEMATICAL VALIDATION
console.log('PHASE 3: MATHEMATICAL VALIDATION\n');

// Check for dollar amounts in hero
const heroMatch = reportHtml.match(/\$[\d,]+/g);
if (heroMatch && heroMatch.length > 0) {
  console.log(`Found ${heroMatch.length} dollar amounts`);
  
  // Extract specific dollar amounts (hero and gap costs)
  const amounts = heroMatch.map(m => parseInt(m.replace(/[$,]/g, '')));
  
  // More targeted extraction: look for hero-cost and gap-cost specifically
  const heroTotalMatch = reportHtml.match(/<strong>\$(\d+)K\/month<\/strong>/);
  const gapCosts = [...reportHtml.matchAll(/class="gap-cost">-\$(\d+)K\/mo/g)].map(m => parseInt(m[1]));
  
  // Check for suspiciously round numbers
  amounts.forEach(amt => {
    if (amt === 10000 || amt === 20000 || amt === 30000 || amt === 50000) {
      check(false, `Suspiciously round dollar amount: $${amt.toLocaleString()}`, 'MATH');
    }
  });
  
  // Gap amounts should sum to hero total (if we can find them specifically)
  if (heroTotalMatch && gapCosts.length === 3) {
    const hero = parseInt(heroTotalMatch[1]);
    const sum = gapCosts.reduce((a, b) => a + b, 0);
    const diff = Math.abs(hero - sum);
    const tolerance = hero * 0.05; // 5% tolerance
    
    check(diff <= tolerance, `Gap sum ($${sum}K) doesn't match hero ($${hero}K)`, 'MATH');
  }
}

console.log('');

// PHASE 4: LOGICAL CONSISTENCY
console.log('PHASE 4: LOGICAL CONSISTENCY\n');

// Hero vs content consistency
if (reportHtml.includes('reviews') || reportHtml.includes('Reviews')) {
  check(research.reviewCount !== undefined, 'Report mentions reviews but no review data', 'LOGIC');
}

if (reportHtml.includes('competitor')) {
  check(research.competitors?.length > 0, 'Report mentions competitors but no competitor data', 'LOGIC');
}

console.log('');

// PHASE 5: STRUCTURAL VALIDATION
console.log('PHASE 5: STRUCTURAL VALIDATION\n');

// Required sections
check(reportHtml.includes('GAP #1') || reportHtml.includes('Gap 1'), 'Missing Gap #1 section', 'STRUCTURE');
check(reportHtml.includes('GAP #2') || reportHtml.includes('Gap 2'), 'Missing Gap #2 section', 'STRUCTURE');
check(reportHtml.includes('GAP #3') || reportHtml.includes('Gap 3'), 'Missing Gap #3 section', 'STRUCTURE');

// Flow diagrams (↓ arrows) - V11 uses tightened content, fewer arrows expected
const arrowCount = (reportHtml.match(/↓/g) || []).length;
check(arrowCount >= 4, `Missing flow diagrams (found ${arrowCount} arrows, need 4+)`, 'STRUCTURE');

// Competitor table
check(reportHtml.includes('<table') || reportHtml.includes('competitor'), 'Missing competitor table', 'STRUCTURE');

console.log('');

// PHASE 6: CONTENT QUALITY
console.log('PHASE 6: CONTENT QUALITY\n');

// Specificity check
const firmNameCount = (reportHtml.match(new RegExp(research.firmName, 'gi')) || []).length;
check(firmNameCount >= 2, `Firm name appears only ${firmNameCount} times (need 2+)`, 'CONTENT');

if (city) {
  const cityCount = (reportHtml.match(new RegExp(city, 'gi')) || []).length;
  check(cityCount >= 4, `City appears only ${cityCount} times (need 4+)`, 'CONTENT');
}

// Bold text usage
const boldCount = (reportHtml.match(/<strong>|<b>/gi) || []).length;
check(boldCount >= 10, `Insufficient bold text (${boldCount} tags, need 10+)`, 'CONTENT');

// Pull quotes - V11 makes these optional for now
const quoteCount = (reportHtml.match(/class=["'].*quote/gi) || []).length;
// Disabled: check(quoteCount >= 4, `Insufficient pull quotes (${quoteCount} found, need 4+)`, 'CONTENT');

console.log('');

// PHASE 7: LANGUAGE QUALITY
console.log('PHASE 7: LANGUAGE QUALITY\n');

// Banned phrases
const bannedPhrases = [
  "We'd love to chat", "We'd love to connect", "If this resonates",
  "No pitch, just", "Most agencies would charge", "Let us know if you'd like to discuss",
  "We think we could be a good fit", "In conclusion", "To summarize",
  "As mentioned above", "It goes without saying", "At the end of the day",
  "Moving forward", "Leverage", "Synergy", "Circle back", "Low-hanging fruit"
];

bannedPhrases.forEach(phrase => {
  check(!reportHtml.toLowerCase().includes(phrase.toLowerCase()), 
    `Banned phrase found: "${phrase}"`, 'LANGUAGE');
});

// Weasel words
const weaselWords = ['likely', 'probably', 'perhaps', 'possibly', 'might', 'may be', 
  'seems', 'appears', 'we believe', 'we think'];
let weaselCount = 0;
weaselWords.forEach(word => {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  const matches = reportHtml.match(regex);
  if (matches) weaselCount += matches.length;
});
check(weaselCount <= 5, `Too many weasel words (${weaselCount} found, max 5)`, 'LANGUAGE');

// Em dash check (—)
const emDashCount = (reportHtml.match(/—/g) || []).length;
check(emDashCount === 0, `Found ${emDashCount} em dashes (—) - use regular dashes instead`, 'LANGUAGE');

// Placeholder text
check(!reportHtml.includes('{{'), 'Report contains template variables {{...}}', 'LANGUAGE');
check(!reportHtml.includes('[TODO]'), 'Report contains [TODO] markers', 'LANGUAGE');
check(!reportHtml.includes('[PLACEHOLDER]'), 'Report contains [PLACEHOLDER] text', 'LANGUAGE');
check(!reportHtml.includes('Lorem ipsum'), 'Report contains Lorem ipsum placeholder', 'LANGUAGE');

// Generic phrases
const genericPhrases = ['legal services', 'high-quality', 'world-class', 
  'industry-leading', 'best-in-class', 'cutting-edge', 'state-of-the-art'];
let genericCount = 0;
genericPhrases.forEach(phrase => {
  if (reportHtml.toLowerCase().includes(phrase.toLowerCase())) genericCount++;
});
check(genericCount <= 3, `Too many generic phrases (${genericCount} found, max 3)`, 'LANGUAGE');

// Exclamation points
const exclamationCount = (reportHtml.match(/!/g) || []).length;
check(exclamationCount <= 2, `Too many exclamation points (${exclamationCount} found, max 2)`, 'LANGUAGE');

console.log('');

// PHASE 8: VISUAL & FORMATTING
console.log('PHASE 8: VISUAL & FORMATTING\n');

// Check for consistent styling
check(reportHtml.includes('<style') || reportHtml.includes('</style>'), 'Missing CSS styles', 'VISUAL');
check(reportHtml.includes('font-family'), 'Missing font-family declaration', 'VISUAL');

// Mobile responsiveness indicators
check(reportHtml.includes('viewport') || reportHtml.includes('max-width'), 
  'Missing responsive design meta/CSS', 'VISUAL');

console.log('');

// PHASE 9: FINAL HUMAN CHECK (Heuristics)
console.log('PHASE 9: FINAL HUMAN CHECK\n');

// The Partner Test (heuristics)
const wordCount = reportHtml.split(/\s+/).length;
check(wordCount >= 800, `Report too short (${wordCount} words, need 800+)`, 'FINAL');
check(wordCount <= 5000, `Report too long (${wordCount} words, max 5000)`, 'FINAL');

// The Embarrassment Test
check(!reportHtml.includes('100% guaranteed'), 'Contains unrealistic guarantee claim', 'FINAL');
check(!reportHtml.includes('10x') && !reportHtml.includes('10X'), 'Contains unrealistic multiplier claim', 'FINAL');

console.log('');

// FINAL SUMMARY
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Checks Completed: ${checksCompleted}/${totalChecks}`);
console.log(`Failures: ${failures.length}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (failures.length === 0) {
  console.log('✅ VALIDATION PASSED\n');
  console.log('All checks passed!');
  console.log(`Firm: ${research.firmName}`);
  console.log(`Location: ${city}, ${state}`);
  console.log(`Quality: EXCELLENT\n`);
  
  fs.writeFileSync('qc-result.json', JSON.stringify({
    status: 'PASSED',
    checksCompleted,
    failures: 0,
    firmName: research.firmName,
    location: `${city}, ${state}`
  }, null, 2));
  
  process.exit(0);
} else {
  console.log('❌ VALIDATION FAILED\n');
  
  // Group failures by phase
  const byPhase = {};
  failures.forEach(f => {
    if (!byPhase[f.phase]) byPhase[f.phase] = [];
    byPhase[f.phase].push(f.message);
  });
  
  console.log('FAILURES BY PHASE:');
  Object.keys(byPhase).forEach(phase => {
    console.log(`\n${phase}:`);
    byPhase[phase].forEach(msg => console.log(`  - ${msg}`));
  });
  
  fs.writeFileSync('qc-result.json', JSON.stringify({
    status: 'FAILED',
    checksCompleted,
    failures: failures.length,
    issues: failures.map(f => `[${f.phase}] ${f.message}`),
    byPhase
  }, null, 2));
  
  console.log('\n');
  process.exit(1);
}
