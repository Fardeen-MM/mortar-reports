#!/usr/bin/env node
/**
 * Fix Report Issues Based on QC Feedback
 * Uses Claude to regenerate sections that failed QC
 */

const fs = require('fs');
const https = require('https');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const qcResultFile = process.argv[2];
const researchFile = process.argv[3];
const reportFile = process.argv[4];

if (!qcResultFile || !researchFile || !reportFile) {
  console.error('Usage: node fix-report-issues.js <qc-result.json> <research.json> <report.html>');
  process.exit(1);
}

const qcResult = JSON.parse(fs.readFileSync(qcResultFile, 'utf8'));
const research = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
const reportHtml = fs.readFileSync(reportFile, 'utf8');

console.log('\n🔧 FIXING REPORT ISSUES\n');
console.log(`Issues to fix: ${qcResult.issues?.length || 0}`);

if (!qcResult.issues || qcResult.issues.length === 0) {
  console.log('✅ No issues to fix');
  process.exit(0);
}

// Build fix prompt
const fixPrompt = `You are fixing a law firm marketing report based on QC feedback.

RESEARCH DATA:
${JSON.stringify(research, null, 2)}

QC ISSUES FOUND:
${qcResult.issues.join('\n')}

CURRENT REPORT EXCERPT (first 2000 chars):
${reportHtml.substring(0, 2000)}

YOUR TASK:
1. Identify what data is missing or incorrect
2. Extract correct data from research JSON
3. Provide specific fixes for each issue

OUTPUT FORMAT (JSON):
{
  "fixes": [
    {
      "issue": "Firm name is Unknown",
      "fix": "Replace 'Unknown Firm' with '${research.firmName}'",
      "data": "${research.firmName}"
    }
  ],
  "canFix": true/false
}

If issues can't be fixed with available data, set canFix=false and explain why.`;

// Call Claude API
function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          resolve(response.content[0].text);
        } else {
          reject(new Error(`Claude API error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  try {
    console.log('🤖 Asking Claude for fixes...');
    const fixResponse = await callClaude(fixPrompt);
    
    // Parse Claude's response
    const fixData = JSON.parse(fixResponse);
    
    if (!fixData.canFix) {
      console.log('❌ Cannot fix issues with available data');
      console.log('Reason:', fixData.reason || 'Unknown');
      fs.writeFileSync('fix-result.json', JSON.stringify({
        success: false,
        canFix: false,
        reason: fixData.reason
      }, null, 2));
      process.exit(1);
    }

    console.log(`\n✅ Claude provided ${fixData.fixes.length} fixes\n`);
    
    fixData.fixes.forEach((fix, i) => {
      console.log(`${i + 1}. ${fix.issue}`);
      console.log(`   → ${fix.fix}\n`);
    });

    // Save fix suggestions
    fs.writeFileSync('fix-result.json', JSON.stringify({
      success: true,
      canFix: true,
      fixes: fixData.fixes,
      needsRegeneration: true
    }, null, 2));

    console.log('💾 Fixes saved to fix-result.json');
    console.log('⚠️  Report needs regeneration with corrected data\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    fs.writeFileSync('fix-result.json', JSON.stringify({
      success: false,
      error: error.message
    }, null, 2));
    process.exit(1);
  }
})();
