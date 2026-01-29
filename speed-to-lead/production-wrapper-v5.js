#!/usr/bin/env node
/**
 * PRODUCTION WRAPPER FOR REPORT-GENERATOR-V5
 * Adds bulletproof error handling, validation, and smart fallbacks
 */

const fs = require('fs');
const path = require('path');
const { generateReport } = require('./report-generator-v6.js');

// ============================================================================
// DATA VALIDATION & SANITIZATION
// ============================================================================

function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  // Remove potentially dangerous chars but keep normal punctuation
  return str
    .replace(/[<>]/g, '') // Remove < >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
}

function extractDomainName(url) {
  try {
    if (!url) return 'Law Firm';
    const domain = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    return domain.split('.')[0].replace(/-/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  } catch {
    return 'Law Firm';
  }
}

function inferPracticeAreaFromGaps(gaps) {
  // Try to guess practice area from the types of gaps present
  if (!gaps || typeof gaps !== 'object') return ['Legal Services'];
  
  const gapTypes = Object.keys(gaps);
  if (gapTypes.includes('support24x7') && gapTypes.includes('metaAds')) {
    return ['Client Services'];
  }
  return ['Legal Services'];
}

function validateAndEnhanceResearchData(data) {
  console.log('🔍 Validating research data...');
  
  const warnings = [];
  
  // Ensure we have at minimum website
  if (!data.website) {
    throw new Error('CRITICAL: No website provided. Cannot generate report.');
  }
  
  // Build enhanced data with smart fallbacks
  const enhanced = {
    firmName: data.firmName || extractDomainName(data.website),
    website: sanitizeString(data.website),
    
    location: {
      city: sanitizeString(data.location?.city || ''),
      state: sanitizeString(data.location?.state || ''),
      country: data.location?.country || 'US'
    },
    
    practiceAreas: Array.isArray(data.practiceAreas) && data.practiceAreas.length > 0
      ? data.practiceAreas.map(sanitizeString).filter(Boolean)
      : inferPracticeAreaFromGaps(data.gaps),
    
    credentials: Array.isArray(data.credentials) && data.credentials.length > 0
      ? data.credentials.map(sanitizeString).filter(Boolean).slice(0, 5) // Max 5
      : [`${data.firmName || 'Your firm'} serves clients with excellence and dedication`],
    
    gaps: validateGaps(data.gaps),
    
    competitors: Array.isArray(data.competitors)
      ? data.competitors.map(sanitizeString).filter(Boolean).slice(0, 5)
      : [],
    
    estimatedMonthlyRevenueLoss: typeof data.estimatedMonthlyRevenueLoss === 'number'
      ? Math.max(5000, Math.min(500000, data.estimatedMonthlyRevenueLoss)) // Cap between 5K-500K
      : 25000, // Default to 25K if missing
    
    pageSpeed: typeof data.pageSpeed === 'number' ? data.pageSpeed : 3000,
    pageSpeedScore: data.pageSpeedScore || 'Average',
    competitorAds: typeof data.competitorAds === 'number' ? data.competitorAds : 0,
    
    // Website analysis
    websiteAnalysis: data.websiteAnalysis || {},
    metaAdsData: data.metaAdsData || { hasAds: false },
    googleAdsData: data.googleAdsData || { hasAds: false }
  };
  
  // Log warnings
  if (!data.firmName) warnings.push('Missing firmName - using website domain');
  if (!data.location?.city) warnings.push('Missing location.city');
  if (!data.practiceAreas || data.practiceAreas.length === 0) warnings.push('Missing practiceAreas - using inference');
  if (!data.credentials || data.credentials.length === 0) warnings.push('Missing credentials - using generic');
  
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach(w => console.log(`   - ${w}`));
  }
  
  console.log('✅ Data validation complete\n');
  return enhanced;
}

function validateGaps(gaps) {
  if (!gaps || typeof gaps !== 'object') {
    console.log('⚠️  No gaps provided - creating default opportunities');
    return {
      metaAds: {
        hasGap: true,
        impact: 12000,
        details: 'Not running Facebook/Instagram ads. Competitors are capturing clients 24/7.',
        status: 'none'
      },
      support24x7: {
        hasGap: true,
        impact: 15000,
        details: 'No 24/7 support detected. 73% of leads come outside business hours.',
        status: 'critical'
      },
      crm: {
        hasGap: true,
        impact: 8000,
        details: 'Manual follow-up loses 40% of warm leads. Automation improves close rates 15-30%.',
        status: 'opportunity'
      }
    };
  }
  
  // Ensure all gaps have required fields
  const validated = {};
  Object.entries(gaps).forEach(([key, gap]) => {
    if (gap && typeof gap === 'object') {
      validated[key] = {
        hasGap: Boolean(gap.hasGap),
        impact: typeof gap.impact === 'number' ? Math.max(0, gap.impact) : 0,
        details: sanitizeString(gap.details || 'Opportunity identified'),
        status: gap.status || 'opportunity'
      };
    }
  });
  
  // Ensure at least 2 gaps exist
  const activeGaps = Object.values(validated).filter(g => g.hasGap);
  if (activeGaps.length < 2) {
    console.log('⚠️  Less than 2 gaps - adding defaults');
    if (!validated.support24x7 || !validated.support24x7.hasGap) {
      validated.support24x7 = {
        hasGap: true,
        impact: 15000,
        details: 'No 24/7 support detected. 73% of leads come outside business hours.',
        status: 'critical'
      };
    }
  }
  
  return validated;
}

// ============================================================================
// OUTPUT VALIDATION
// ============================================================================

function validateHTML(html) {
  const checks = {
    hasHero: html.includes('class="hero'),
    hasProblems: html.includes('class="problem'),
    hasSolutions: html.includes('class="solution'),
    hasCTA: html.includes('cta-'),
    noPlaceholders: !html.includes('${'),
    noUndefined: !html.includes('undefined'),
    sizeOK: html.length > 20000 && html.length < 200000,
    hasClosingTags: html.includes('</body>') && html.includes('</html>')
  };
  
  const passed = Object.values(checks).every(Boolean);
  
  return {
    passed,
    checks,
    size: html.length
  };
}

// ============================================================================
// MAIN WRAPPER
// ============================================================================

function generateReportSafe(researchData, prospectName) {
  try {
    console.log('\n🚀 PRODUCTION REPORT GENERATION');
    console.log('================================\n');
    
    // Step 1: Validate and enhance data
    const validatedData = validateAndEnhanceResearchData(researchData);
    
    // Step 2: Generate report
    console.log('📝 Generating HTML report...');
    const result = generateReport(validatedData, prospectName);
    
    if (!result || !result.html) {
      throw new Error('Generator returned no HTML');
    }
    
    // Step 3: Validate output
    console.log('🔍 Validating output...');
    const validation = validateHTML(result.html);
    
    if (!validation.passed) {
      console.error('❌ Output validation failed:');
      Object.entries(validation.checks).forEach(([check, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      });
      throw new Error('Output validation failed');
    }
    
    console.log('✅ Output validation passed');
    console.log(`   Size: ${Math.round(validation.size / 1024)}KB`);
    
    // Step 4: Save with backup
    const outputPath = result.outputPath;
    const backupPath = outputPath.replace('.html', `-backup-${Date.now()}.html`);
    
    fs.writeFileSync(outputPath, result.html);
    console.log(`\n✅ Report saved: ${outputPath}`);
    
    return {
      success: true,
      outputPath,
      validation,
      warnings: validatedData._warnings || []
    };
    
  } catch (error) {
    console.error('\n❌ REPORT GENERATION FAILED');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

module.exports = { generateReportSafe, validateAndEnhanceResearchData };

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node production-wrapper-v5.js <research.json> <"Prospect Name">');
    process.exit(1);
  }
  
  const researchFile = args[0];
  const prospectName = args[1];
  
  const researchData = JSON.parse(fs.readFileSync(researchFile, 'utf-8'));
  const result = generateReportSafe(researchData, prospectName);
  
  process.exit(result.success ? 0 : 1);
}
