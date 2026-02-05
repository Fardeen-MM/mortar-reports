#!/usr/bin/env node
/**
 * AI-Powered Quality Control for V3 Law Firm Reports
 *
 * Two-phase validation:
 * 1. Basic structural checks (fast, no API)
 * 2. AI content analysis (Claude reviews like a human would)
 *
 * The AI catches issues that regex can't:
 * - Wrong competitors for the market (US firms for UK lead)
 * - Currency mismatches ($ for UK firms)
 * - Terminology issues (attorney vs solicitor)
 * - Awkward or unnatural phrasing
 * - Content that wouldn't convince a lead to book
 *
 * Usage: node ai-quality-control-v2.js <research-json> <report-html>
 */

require('dotenv').config();
const fs = require('fs');
const https = require('https');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const researchFile = process.argv[2];
const reportFile = process.argv[3];

if (!researchFile || !reportFile) {
  console.error('Usage: node ai-quality-control-v2.js <research-json> <report-html>');
  process.exit(1);
}

// Load files
let research, reportHtml;
try {
  research = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
  reportHtml = fs.readFileSync(reportFile, 'utf8');
} catch (e) {
  console.error(`Failed to load files: ${e.message}`);
  const output = { status: 'FAILED', phase: 'FILE_LOAD', issues: [e.message] };
  fs.writeFileSync('qc-result.json', JSON.stringify(output, null, 2));
  process.exit(1);
}

console.log('\n🔍 AI QUALITY CONTROL - V3 REPORT VALIDATION\n');

/**
 * Call Claude to analyze content
 */
async function askAI(prompt, maxTokens = 2000) {
  if (!ANTHROPIC_API_KEY) {
    console.log('⚠️  ANTHROPIC_API_KEY not set - skipping AI analysis');
    return null;
  }

  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestData)
      },
      timeout: 60000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.content && result.content[0] && result.content[0].text) {
            resolve(result.content[0].text);
          } else if (result.error) {
            reject(new Error(`AI API error: ${result.error.message || JSON.stringify(result.error)}`));
          } else {
            reject(new Error(`Unexpected response: ${data.substring(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('AI request timeout'));
    });

    req.write(requestData);
    req.end();
  });
}

/**
 * Extract visible text from HTML (strips tags)
 */
function extractText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Run basic structural checks (no API needed)
 */
function runBasicChecks() {
  const criticalIssues = [];
  const importantIssues = [];
  const warnings = [];

  console.log('━━━ PHASE 1: BASIC CHECKS ━━━');

  // Firm name
  const firmName = research.firmName || '';
  if (!firmName || firmName === 'Unknown Firm' || firmName.length < 3) {
    criticalIssues.push('Firm name missing or invalid');
  } else {
    console.log(`✓ Firm: ${firmName}`);
  }

  // Location
  const city = research.location?.city || '';
  const country = research.location?.country || '';
  if (!city) {
    criticalIssues.push('City is missing');
  } else {
    console.log(`✓ Location: ${city}${country ? ` (${country})` : ''}`);
  }

  // Report size
  if (!reportHtml || reportHtml.length < 1000) {
    criticalIssues.push('Report HTML is empty or too short');
  } else {
    console.log(`✓ Report size: ${Math.round(reportHtml.length / 1024)}KB`);
  }

  // Placeholders
  const placeholders = ['{{', '}}', '[TODO]', '[PLACEHOLDER]'];
  const foundPlaceholders = placeholders.filter(p => reportHtml.includes(p));
  if (foundPlaceholders.length > 0) {
    criticalIssues.push(`Placeholder text found: ${foundPlaceholders.join(', ')}`);
  }

  // Practice areas
  const practiceAreas = research.practiceAreas || research.practice?.practiceAreas || [];
  if ((Array.isArray(practiceAreas) ? practiceAreas.length : 0) === 0) {
    criticalIssues.push('No practice areas identified');
  } else {
    console.log(`✓ Practice areas: ${practiceAreas.length} found`);
  }

  // Gap calculations
  const gapMatches = reportHtml.match(/\$[\d.,]+K?-[\d.,]+K?\/mo/g) || [];
  if (gapMatches.length < 3) {
    importantIssues.push(`Missing gap calculations (found ${gapMatches.length}, need 3)`);
  }

  // Total strip
  if (!reportHtml.includes('total-strip') && !reportHtml.includes('Total opportunity')) {
    importantIssues.push('Total strip section missing');
  }

  // Required sections
  const requiredSections = [
    { marker: 'gap-card', name: 'Gap cards' },
    { marker: 'competitor-section', name: 'Competitor section' },
    { marker: 'build-list', name: 'Build list' }
  ];
  requiredSections.forEach(({ marker, name }) => {
    if (!reportHtml.includes(marker)) {
      warnings.push(`Missing section: ${name}`);
    }
  });

  return { criticalIssues, importantIssues, warnings };
}

/**
 * AI-powered content analysis
 */
async function runAIAnalysis() {
  console.log('\n━━━ PHASE 2: AI CONTENT ANALYSIS ━━━');

  const firmName = research.firmName || 'Unknown';
  const city = research.location?.city || '';
  const state = research.location?.state || '';
  const country = research.location?.country || '';
  const practiceAreas = research.practiceAreas || [];
  const competitors = research.competitors || [];

  // Build context for AI
  const location = [city, state, country].filter(Boolean).join(', ');
  const isUK = country?.toLowerCase().includes('uk') ||
               country?.toLowerCase().includes('united kingdom') ||
               country?.toLowerCase().includes('england') ||
               country?.toLowerCase().includes('scotland') ||
               country?.toLowerCase().includes('wales');

  const isCanada = country?.toLowerCase().includes('canada');
  const isAustralia = country?.toLowerCase().includes('australia');

  const expectedCurrency = isUK ? '£' : (isCanada || isAustralia ? '$' : '$');
  const expectedTerminology = isUK ? 'solicitor/barrister' : 'attorney/lawyer';

  // Extract text for analysis (truncate to avoid token limits)
  const reportText = extractText(reportHtml).substring(0, 30000);

  const prompt = `You are a brutal QC reviewer for marketing reports sent to law firm leads. Your job is to find EVERY issue that would make a lead NOT want to book a meeting.

CONTEXT:
- Firm: ${firmName}
- Location: ${location}
- Country: ${country || 'Unknown (assume US if no country)'}
- Practice areas: ${practiceAreas.join(', ')}
- Competitors found: ${competitors.map(c => typeof c === 'object' ? c.name : c).join(', ')}
- Expected currency: ${expectedCurrency}
- Expected terminology: ${expectedTerminology}

REPORT TEXT TO REVIEW:
${reportText}

ANALYZE FOR THESE SPECIFIC ISSUES:

1. GEOGRAPHIC MISMATCH (CRITICAL)
   - Are competitors from the WRONG geographic area? (e.g., US firms shown for UK lead)
   - Look for US indicators: "LLC", "PLLC", "P.C.", US city names, US area codes
   - Look for UK indicators: "LLP", "Limited", UK city names
   - Does the location make sense for this market?

2. CURRENCY MISMATCH (CRITICAL)
   - UK firms MUST use £ (GBP), not $ (USD)
   - US/Canada/Australia use $
   - Is the wrong currency symbol used?

3. TERMINOLOGY MISMATCH (IMPORTANT)
   - UK: "solicitor", "barrister", "practice"
   - US: "attorney", "lawyer", "firm"
   - Is wrong terminology used for the market?

4. AWKWARD PHRASING (IMPORTANT)
   - Unnatural client labels (e.g., "individual going through a divorce" vs "divorcing client")
   - Generic or robotic language
   - Grammar issues (a/an errors, etc.)

5. BROKEN CONTENT (CRITICAL)
   - Missing data (empty sections, "undefined", "null", "NaN")
   - Trailing punctuation with nothing after it
   - Placeholder text
   - Zero values that shouldn't be zero

6. CREDIBILITY ISSUES (IMPORTANT)
   - Claims that seem too good to be true
   - Missing context or caveats
   - Anything that would make a sophisticated law firm partner skeptical

7. WOULD YOU BOOK A MEETING? (OVERALL)
   - As a partner at ${firmName}, would this report convince you to book a call?
   - What's the single biggest issue that would make you ignore this?

Return your analysis as JSON ONLY (no other text):
{
  "issues": [
    {
      "severity": "CRITICAL|IMPORTANT|WARNING",
      "category": "GEOGRAPHIC|CURRENCY|TERMINOLOGY|PHRASING|BROKEN|CREDIBILITY",
      "issue": "Brief description of the problem",
      "evidence": "Quote from the report showing the issue",
      "fix": "What should be done to fix it"
    }
  ],
  "wouldBook": true/false,
  "overallVerdict": "One sentence summary of report quality",
  "biggestIssue": "The single most important thing to fix"
}`;

  try {
    const response = await askAI(prompt, 3000);
    if (!response) {
      return { issues: [], skipped: true };
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const analysis = JSON.parse(jsonStr.trim());
    return analysis;
  } catch (e) {
    console.log(`⚠️  AI analysis failed: ${e.message}`);
    return { issues: [], error: e.message };
  }
}

/**
 * Main QC function
 */
async function runQC() {
  // Phase 1: Basic checks
  const basic = runBasicChecks();

  // Early exit on critical failures
  if (basic.criticalIssues.length > 0) {
    console.log('\n🛑 CRITICAL FAILURES:');
    basic.criticalIssues.forEach(issue => console.log(`   ❌ ${issue}`));
    console.log('\n❌ QC FAILED - Report cannot be sent\n');

    const output = {
      status: 'FAILED',
      phase: 'BASIC',
      criticalIssues: basic.criticalIssues.length,
      qualityIssues: basic.importantIssues.length + basic.warnings.length,
      issues: basic.criticalIssues,
      recommendation: 'Report has critical structural issues. Do not send.'
    };
    fs.writeFileSync('qc-result.json', JSON.stringify(output, null, 2));
    process.exit(1);
  }

  console.log('✅ Basic checks passed\n');

  // Phase 2: AI content analysis
  const ai = await runAIAnalysis();

  if (ai.skipped) {
    console.log('⚠️  AI analysis skipped (no API key)\n');
  } else if (ai.error) {
    console.log(`⚠️  AI analysis error: ${ai.error}\n`);
  } else {
    // Process AI findings
    const aiCritical = (ai.issues || []).filter(i => i.severity === 'CRITICAL');
    const aiImportant = (ai.issues || []).filter(i => i.severity === 'IMPORTANT');
    const aiWarnings = (ai.issues || []).filter(i => i.severity === 'WARNING');

    if (aiCritical.length > 0) {
      console.log('\n🛑 AI FOUND CRITICAL ISSUES:');
      aiCritical.forEach(issue => {
        console.log(`   ❌ [${issue.category}] ${issue.issue}`);
        if (issue.evidence) console.log(`      Evidence: "${issue.evidence}"`);
        if (issue.fix) console.log(`      Fix: ${issue.fix}`);
      });
    }

    if (aiImportant.length > 0) {
      console.log('\n⚠️  AI FOUND IMPORTANT ISSUES:');
      aiImportant.forEach(issue => {
        console.log(`   ⚠️  [${issue.category}] ${issue.issue}`);
        if (issue.evidence) console.log(`      Evidence: "${issue.evidence}"`);
      });
    }

    if (aiWarnings.length > 0) {
      console.log('\n📋 AI WARNINGS:');
      aiWarnings.forEach(issue => {
        console.log(`   📋 [${issue.category}] ${issue.issue}`);
      });
    }

    // Add AI issues to basic issues
    aiCritical.forEach(i => basic.criticalIssues.push(`[AI] ${i.issue}`));
    aiImportant.forEach(i => basic.importantIssues.push(`[AI] ${i.issue}`));
    aiWarnings.forEach(i => basic.warnings.push(`[AI] ${i.issue}`));

    // AI verdict
    console.log('\n━━━ AI VERDICT ━━━');
    console.log(`Would book meeting: ${ai.wouldBook ? '✅ YES' : '❌ NO'}`);
    console.log(`Overall: ${ai.overallVerdict || 'No verdict'}`);
    if (ai.biggestIssue) {
      console.log(`Biggest issue: ${ai.biggestIssue}`);
    }
  }

  // Final result
  console.log('\n━━━ FINAL RESULT ━━━');

  const totalCritical = basic.criticalIssues.length;
  const totalImportant = basic.importantIssues.length;
  const totalWarnings = basic.warnings.length;
  const totalIssues = totalCritical + totalImportant + totalWarnings;

  const shouldFail = totalCritical > 0 || totalImportant > 1;

  let status, recommendation;
  if (shouldFail) {
    status = 'FAILED';
    if (totalCritical > 0) {
      recommendation = `${totalCritical} critical issue(s) found. Report cannot be sent.`;
    } else {
      recommendation = `${totalImportant} important issue(s) found. Review before sending.`;
    }
    console.log(`\n❌ QC FAILED - ${totalCritical} critical, ${totalImportant} important issues\n`);
  } else if (totalWarnings > 0 || totalImportant > 0) {
    status = 'PASSED';
    recommendation = `Passed with ${totalImportant + totalWarnings} minor issue(s). Safe to send.`;
    console.log(`\n✅ QC PASSED with ${totalImportant + totalWarnings} minor issues\n`);
  } else {
    status = 'PASSED';
    recommendation = 'High quality report. Send immediately.';
    console.log('\n✅ QC PASSED - High quality report\n');
  }

  // Include AI analysis in output
  const output = {
    status,
    firmName: research.firmName,
    location: [research.location?.city, research.location?.state].filter(Boolean).join(', '),
    country: research.location?.country || '',
    criticalIssues: totalCritical,
    importantIssues: totalImportant,
    warnings: totalWarnings,
    qualityIssues: totalIssues,
    issues: [
      ...basic.criticalIssues.map(i => ({ severity: 'CRITICAL', issue: i })),
      ...basic.importantIssues.map(i => ({ severity: 'IMPORTANT', issue: i })),
      ...basic.warnings.map(i => ({ severity: 'WARNING', issue: i }))
    ],
    aiAnalysis: ai.skipped ? 'skipped' : (ai.error ? 'error' : 'complete'),
    wouldBook: ai.wouldBook,
    biggestIssue: ai.biggestIssue,
    recommendation
  };

  fs.writeFileSync('qc-result.json', JSON.stringify(output, null, 2));
  process.exit(shouldFail ? 1 : 0);
}

// Run
runQC().catch(e => {
  console.error(`QC failed: ${e.message}`);
  process.exit(1);
});
