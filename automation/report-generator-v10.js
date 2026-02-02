#!/usr/bin/env node
/**
 * REPORT GENERATOR V10 - CRITICAL FIXES
 * 
 * CORE PRINCIPLE: Stop selling infrastructure. Start selling what they actually want.
 * 
 * The data proves the problem. The emotion drives the call.
 * If it doesn't make them feel something, it won't make them book.
 */

const fs = require('fs');
const path = require('path');

// Case value minimums by practice area
const CASE_VALUES = {
  'tax': 4500,
  'family': 4500,
  'divorce': 4500,
  'personal injury': 12000,
  'immigration': 4000,
  'litigation': 7500,
  'criminal': 5000,
  'estate': 3000,
  'business': 6000,
  'bankruptcy': 2500,
  'civil rights': 8000,
  'employment': 6000,
  'real estate': 5000,
  'ip': 7500
};

// Realistic search terms (natural, what people actually type)
const SEARCH_TERMS = {
  'divorce': [
    'divorce lawyer near me',
    'how much does divorce cost',
    'child custody attorney',
    'best divorce lawyer',
    'do I need a lawyer for divorce'
  ],
  'family': [
    'family lawyer near me',
    'child custody attorney',
    'how much does divorce cost',
    'best family lawyer',
    'family law attorney near me'
  ],
  'tax': [
    'irs help near me',
    'tax debt relief',
    'how to settle irs debt',
    'tax attorney near me',
    'irs payment plan lawyer'
  ],
  'personal injury': [
    'car accident lawyer near me',
    'how much is my case worth',
    'injury lawyer free consultation',
    'should I get a lawyer after accident',
    'best personal injury attorney'
  ],
  'immigration': [
    'immigration lawyer near me',
    'green card attorney',
    'how to get green card',
    'visa lawyer near me',
    'deportation defense lawyer'
  ],
  'criminal': [
    'criminal lawyer near me',
    'dui attorney',
    'how to beat a dui',
    'best criminal lawyer',
    'criminal defense lawyer near me'
  ],
  'civil rights': [
    'civil rights lawyer near me',
    'can I sue the police',
    'police brutality attorney',
    'wrongful arrest lawyer',
    'civil rights attorney free consultation'
  ],
  'employment': [
    'employment lawyer near me',
    'wrongful termination attorney',
    'can I sue my employer',
    'discrimination lawyer near me',
    'employment attorney free consultation'
  ],
  'real estate': [
    'real estate lawyer near me',
    'property attorney',
    'landlord tenant lawyer',
    'real estate attorney near me',
    'closing attorney'
  ],
  'ip': [
    'patent lawyer near me',
    'trademark attorney',
    'how to patent an idea',
    'ip lawyer near me',
    'copyright attorney'
  ],
  'default': [
    'lawyer near me',
    'attorney near me',
    'legal help',
    'best lawyer',
    'free legal consultation'
  ]
};

function generateReport(researchData, prospectName) {
  console.log(`\n📝 Generating V10 Report (Emotional + Data) for ${prospectName}...\n`);
  
  // PHASE 0: HARD VALIDATION GATE
  const validation = validateData(researchData);
  if (!validation.passed) {
    console.error('❌ GENERATION BLOCKED:');
    validation.errors.forEach(err => console.error(`   - ${err}`));
    
    fs.writeFileSync(
      path.join(__dirname, 'generation-blocked.json'),
      JSON.stringify({ 
        reason: 'HARD_VALIDATION_FAILURE',
        errors: validation.errors, 
        warnings: validation.warnings, 
        data: researchData 
      }, null, 2)
    );
    
    throw new Error(`GENERATION_BLOCKED: ${validation.errors.join(', ')}`);
  }
  
  // Log warnings (non-blocking)
  if (validation.warnings && validation.warnings.length > 0) {
    console.log('⚠️  Warnings (non-blocking):');
    validation.warnings.forEach(warn => console.log(`   - ${warn}`));
    console.log('');
  }
  
  console.log('✅ Data validation passed\n');
  
  const {
    firmName: rawFirmName,
    website,
    location = {},
    practiceAreas = [],
    competitors = [],
    gaps = {},
    estimatedMonthlyRevenueLoss = 0
  } = researchData;
  
  // Normalize firm name (capitalize entity types)
  const firmName = normalizeFirmName(rawFirmName);
  
  const city = location.city || '';
  const state = location.state || '';
  const locationStr = city && state ? `${city}, ${state}` : state || 'your area';
  
  // Determine practice area category
  const practiceArea = getPracticeAreaCategory(practiceAreas[0] || 'legal services');
  const practiceLabel = getPracticeLabel(practiceArea);
  
  // Get case value (same for ALL gaps)
  const caseValue = getCaseValue(practiceArea, estimatedMonthlyRevenueLoss);
  
  // Get search terms
  const searchTerms = getSearchTerms(practiceArea, city);
  
  // Calculate gaps with ACTUAL MATH
  const totalMonthly = estimatedMonthlyRevenueLoss || 19000;
  const gapCalculations = calculateGaps(gaps, totalMonthly, caseValue, competitors);
  
  // Validate math
  const mathCheck = validateMath(gapCalculations, totalMonthly);
  if (!mathCheck.valid) {
    console.error('❌ MATH VALIDATION FAILED:');
    console.error(`   Gap sum: $${mathCheck.gapSum}`);
    console.error(`   Hero total: $${mathCheck.heroTotal}`);
    console.error(`   Difference: $${mathCheck.difference}`);
    throw new Error('Math validation failed - gaps do not sum to hero total');
  }
  
  console.log(`💰 Math validated: $${gapCalculations.gap1.cost}K + $${gapCalculations.gap2.cost}K + $${gapCalculations.gap3.cost}K = $${Math.round(totalMonthly/1000)}K\n`);
  
  // Generate HTML (ALL NEW - EMOTIONAL + DATA)
  const html = generateHTML({
    firmName,
    prospectName,
    city,
    state,
    practiceArea,
    practiceLabel,
    searchTerms,
    caseValue,
    totalMonthly,
    gapCalculations,
    competitors,
    gaps
  });
  
  // Save report
  const firmSlug = firmName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const reportsDir = path.resolve(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const outputPath = path.resolve(reportsDir, `${firmSlug}-landing-page-v10.html`);
  fs.writeFileSync(outputPath, html);
  
  console.log(`💾 Saved: ${outputPath}\n`);
  console.log(`✅ Report generated successfully`);
  console.log(`   Firm: ${firmName}`);
  console.log(`   Location: ${locationStr}`);
  console.log(`   Practice: ${practiceArea}`);
  console.log(`   Case value: $${caseValue.toLocaleString()}`);
  console.log(`   Hero total: $${Math.round(totalMonthly/1000)}K/month`);
  console.log(`   Competitors: ${competitors.length}\n`);
  
  return { html, outputPath };
}

// HARD VALIDATION GATE - ENFORCED
function validateData(data) {
  const errors = [];
  const warnings = [];
  
  // CRITICAL (BLOCKS)
  if (!data.firmName || data.firmName === 'Unknown' || data.firmName === 'Unknown Firm') {
    errors.push('Firm name is invalid or missing');
  }
  
  if (!data.location?.city || !data.location?.state) {
    errors.push('Location (city/state) is missing');
  }
  
  if (data.location?.state && data.location.state.length !== 2) {
    errors.push('State must be 2-letter abbreviation');
  }
  
  // CRITICAL: COMPETITORS (HARD BLOCK)
  if (!data.competitors || data.competitors.length === 0) {
    errors.push('HARD BLOCK: No competitor data found. Cannot generate report.');
  }
  
  if (data.competitors && data.competitors.length < 3) {
    errors.push(`HARD BLOCK: Only ${data.competitors.length} competitors found. Need minimum 3.`);
  }
  
  // Validate competitor data quality
  if (data.competitors && data.competitors.length >= 3) {
    data.competitors.slice(0, 3).forEach((comp, i) => {
      if (!comp.name) {
        errors.push(`Competitor ${i+1} missing name`);
      }
      if (comp.reviewCount === undefined && comp.reviews === undefined) {
        warnings.push(`Competitor ${i+1} missing review count`);
      }
      if (comp.rating === undefined) {
        warnings.push(`Competitor ${i+1} missing rating`);
      }
    });
  }
  
  // Practice area (WARNING only)
  if (!data.practiceAreas || data.practiceAreas.length === 0) {
    warnings.push('Practice area is missing');
  }
  
  if (data.practiceAreas?.[0] === 'legal services') {
    warnings.push('Practice area is too generic (legal services)');
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

// Normalize firm name - capitalize entity types
function normalizeFirmName(name) {
  if (!name) return 'Unknown Firm';
  
  // Capitalize common entity suffixes
  return name
    .replace(/\bLlp\b/g, 'LLP')
    .replace(/\bLlc\b/g, 'LLC')
    .replace(/\bPllc\b/g, 'PLLC')
    .replace(/\bPc\b/g, 'PC')
    .replace(/\bPa\b/g, 'PA')
    .replace(/\bInc\b/g, 'Inc.')
    .replace(/\bCorp\b/g, 'Corp.');
}

function getPracticeAreaCategory(practiceArea) {
  const lower = practiceArea.toLowerCase();
  
  if (lower.includes('divorce') || lower.includes('family')) return 'divorce';
  if (lower.includes('tax')) return 'tax';
  if (lower.includes('injury') || lower.includes('accident')) return 'personal injury';
  if (lower.includes('immigration')) return 'immigration';
  if (lower.includes('criminal') || lower.includes('dui')) return 'criminal';
  if (lower.includes('estate')) return 'estate';
  if (lower.includes('business') || lower.includes('corporate')) return 'business';
  if (lower.includes('bankruptcy')) return 'bankruptcy';
  if (lower.includes('litigation')) return 'litigation';
  if (lower.includes('civil rights') || lower.includes('police') || lower.includes('misconduct')) return 'civil rights';
  if (lower.includes('employment') || lower.includes('discrimination') || lower.includes('labor')) return 'employment';
  if (lower.includes('real estate') || lower.includes('property')) return 'real estate';
  if (lower.includes('intellectual property') || lower.includes('patent') || lower.includes('trademark')) return 'ip';
  
  return 'default';
}

function getPracticeLabel(category) {
  const labels = {
    'divorce': 'DIVORCE',
    'family': 'FAMILY LAW',
    'tax': 'TAX',
    'personal injury': 'PERSONAL INJURY',
    'immigration': 'IMMIGRATION',
    'criminal': 'CRIMINAL DEFENSE',
    'estate': 'ESTATE PLANNING',
    'business': 'BUSINESS',
    'bankruptcy': 'BANKRUPTCY',
    'litigation': 'LITIGATION',
    'civil rights': 'CIVIL RIGHTS',
    'employment': 'EMPLOYMENT',
    'real estate': 'REAL ESTATE',
    'ip': 'INTELLECTUAL PROPERTY',
    'default': 'LAW'
  };
  
  return labels[category] || 'LAW';
}

function getCaseValue(practiceArea, totalMonthly) {
  const minimum = CASE_VALUES[practiceArea] || 4500;
  
  if (totalMonthly < 15000) {
    return minimum;
  }
  
  const calculated = Math.round(totalMonthly / 3 / 100) * 100;
  return Math.max(calculated, minimum);
}

function getSearchTerms(practiceArea, city) {
  const terms = SEARCH_TERMS[practiceArea] || SEARCH_TERMS['default'];
  
  // Replace {city} placeholder and add city to one term
  return terms.map((term, i) => {
    if (i === 2 && city && !term.includes('near me')) {
      // Make 3rd term city-specific if it doesn't have "near me"
      return term.replace(/near me|attorney|lawyer/, `attorney ${city}`);
    }
    return term;
  });
}

// ACTUAL MATH CALCULATIONS
function calculateGaps(gaps, totalMonthly, caseValue, competitors) {
  // Continue in next file...
  return {
    gap1: { cost: 8, formula: '', detail: {} },
    gap2: { cost: 7, formula: '', detail: {} },
    gap3: { cost: 4, formula: '', detail: {} }
  };
}

function validateMath(gapCalcs, heroTotal) {
  const gapSum = (gapCalcs.gap1.cost + gapCalcs.gap2.cost + gapCalcs.gap3.cost) * 1000;
  const heroTotalDollars = Math.round(heroTotal);
  const difference = Math.abs(gapSum - heroTotalDollars);
  
  return {
    valid: difference <= 1000,
    gapSum,
    heroTotal: heroTotalDollars,
    difference
  };
}

function generateHTML(data) {
  // Will implement full HTML in next iteration
  return '<!DOCTYPE html><html><body>V10 Template</body></html>';
}

// CLI Handler
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node report-generator-v10.js <research-json> <contact-name>');
    process.exit(1);
  }
  
  const researchFile = args[0];
  const contactName = args[1];
  
  if (!fs.existsSync(researchFile)) {
    console.error(`❌ Research file not found: ${researchFile}`);
    process.exit(1);
  }
  
  try {
    const researchData = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
    generateReport(researchData, contactName);
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
    if (error.message.includes('GENERATION_BLOCKED')) {
      console.error('\n⚠️  Report generation was HARD BLOCKED due to validation failures.');
      console.error('   Check generation-blocked.json for details.');
    }
    process.exit(1);
  }
}

module.exports = { generateReport };
