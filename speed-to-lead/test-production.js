#!/usr/bin/env node
/**
 * TEST SUITE FOR PRODUCTION REPORT GENERATOR
 * Tests all edge cases and failure modes
 */

const { generateReportSafe } = require('./production-wrapper-v5.js');

console.log('\n🧪 PRODUCTION REPORT GENERATOR TEST SUITE\n');
console.log('=========================================\n');

const tests = [];
let passed = 0;
let failed = 0;

// Helper
function test(name, testFn) {
  tests.push({ name, fn: testFn });
}

function runTests() {
  tests.forEach(({ name, fn }, i) => {
    process.stdout.write(`[${i+1}/${tests.length}] ${name}... `);
    try {
      const result = fn();
      if (result === true || (result && result.success)) {
        console.log('✅ PASS');
        passed++;
      } else {
        console.log(`❌ FAIL: ${result.error || 'Unknown'}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      failed++;
    }
  });
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`Success rate: ${Math.round(passed/(passed+failed)*100)}%`);
  console.log(`${'='.repeat(50)}\n`);
  
  return failed === 0;
}

// ============================================================================
// TEST CASES
// ============================================================================

// Test 1: Perfect data (Akerman)
test('Perfect data with all fields', () => {
  const data = {
    firmName: 'Akerman LLP',
    website: 'https://www.akerman.com',
    location: { city: 'Miami', state: 'FL', country: 'US' },
    practiceAreas: ['M&A', 'Private Equity'],
    credentials: ['Best Lawyers 2026', 'Top 100 U.S. Law Firm', '700+ Attorneys'],
    gaps: {
      metaAds: { hasGap: true, impact: 12000, details: 'No Meta ads', status: 'none' },
      support24x7: { hasGap: true, impact: 15000, details: 'No 24/7', status: 'critical' }
    },
    competitors: ['Kirkland', 'Latham'],
    estimatedMonthlyRevenueLoss: 43000
  };
  
  const result = generateReportSafe(data, 'Test User');
  return result.success;
});

// Test 2: Minimal data (just website)
test('Minimal data with only website', () => {
  const data = {
    website: 'https://example-law-firm.com'
  };
  
  const result = generateReportSafe(data, 'Test User');
  return result.success;
});

// Test 3: Missing firmName
test('Missing firmName', () => {
  const data = {
    website: 'https://smith-attorneys.com',
    location: { city: 'Austin', state: 'TX' },
    gaps: {
      metaAds: { hasGap: true, impact: 10000, details: 'No ads' }
    }
  };
  
  const result = generateReportSafe(data, 'Test User');
  return result.success;
});

// Test 4: No gaps provided
test('No gaps provided', () => {
  const data = {
    firmName: 'Test Law Firm',
    website: 'https://testlaw.com',
    location: { city: 'Boston', state: 'MA' }
  };
  
  const result = generateReportSafe(data, 'Test User');
  return result.success && result.warnings && result.warnings.length > 0;
});

// Test 5: Empty arrays
test('Empty arrays for practiceAreas and credentials', () => {
  const data = {
    firmName: 'Empty Firm',
    website: 'https://empty.com',
    location: {},
    practiceAreas: [],
    credentials: [],
    gaps: {
      crm: { hasGap: true, impact: 5000, details: 'Manual CRM' }
    }
  };
  
  const result = generateReportSafe(data, 'Test User');
  return result.success;
});

// Test 6: XSS attempt in firmName
test('XSS attempt in firmName', () => {
  const data = {
    firmName: '<script>alert("xss")</script>Legit Firm',
    website: 'https://legit.com',
    gaps: {
      metaAds: { hasGap: true, impact: 10000, details: 'Test' }
    }
  };
  
  const result = generateReportSafe(data, 'Test User');
  return result.success && !result.validation.checks.hasUndefined;
});

// Test 7: Very long firm name
test('Very long firm name', () => {
  const data = {
    firmName: 'Smith Anderson Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez'.repeat(3),
    website: 'https://longname.com',
    gaps: {
      support24x7: { hasGap: true, impact: 15000, details: 'No support' }
    }
  };
  
  const result = generateReportSafe(data, 'Test User');
  return result.success;
});

// Test 8: Special characters in location
test('Special characters in location', () => {
  const data = {
    firmName: 'Test Firm',
    website: 'https://test.com',
    location: {
      city: 'São Paulo',
      state: 'SP',
      country: 'BR'
    },
    gaps: {
      metaAds: { hasGap: true, impact: 8000, details: 'Test' }
    }
  };
  
  const result = generateReportSafe(data, 'Test User');
  return result.success;
});

// Test 9: Negative impact values
test('Negative impact values', () => {
  const data = {
    firmName: 'Test Firm',
    website: 'https://test.com',
    gaps: {
      metaAds: { hasGap: true, impact: -5000, details: 'Invalid' },
      crm: { hasGap: true, impact: 10000, details: 'Valid' }
    }
  };
  
  const result = generateReportSafe(data, 'Test User');
  return result.success;
});

// Test 10: Extreme monthly loss value
test('Extreme monthly loss value', () => {
  const data = {
    firmName: 'Test Firm',
    website: 'https://test.com',
    estimatedMonthlyRevenueLoss: 10000000, // 10M - should be capped
    gaps: {
      metaAds: { hasGap: true, impact: 5000, details: 'Test' }
    }
  };
  
  const result = generateReportSafe(data, 'Test User');
  return result.success;
});

// Test 11: All gap types
test('All gap types present', () => {
  const data = {
    firmName: 'Complete Firm',
    website: 'https://complete.com',
    location: { city: 'Seattle', state: 'WA' },
    practiceAreas: ['Personal Injury'],
    gaps: {
      metaAds: { hasGap: true, impact: 12000, details: 'No Meta' },
      googleAds: { hasGap: true, impact: 8000, details: 'No Google', status: 'blue-ocean' },
      support24x7: { hasGap: true, impact: 15000, details: 'No 24/7', status: 'critical' },
      websiteSpeed: { hasGap: true, impact: 6000, details: 'Slow' },
      crm: { hasGap: true, impact: 8000, details: 'Manual CRM' }
    }
  };
  
  const result = generateReportSafe(data, 'Test User');
  return result.success;
});

// Test 12: Immigration practice area
test('Immigration practice area detection', () => {
  const data = {
    firmName: 'Immigration Law Firm',
    website: 'https://immigration.com',
    location: { city: 'Toronto', state: 'ON', country: 'CA' },
    practiceAreas: ['Immigration', 'Business Immigration'],
    gaps: {
      metaAds: { hasGap: true, impact: 10000, details: 'Test' }
    }
  };
  
  const result = generateReportSafe(data, 'Test User');
  return result.success;
});

// ============================================================================
// RUN TESTS
// ============================================================================

const success = runTests();
process.exit(success ? 0 : 1);
