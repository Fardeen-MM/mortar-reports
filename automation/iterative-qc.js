#!/usr/bin/env node
/**
 * ITERATIVE QC SYSTEM
 * Validates report quality and automatically fixes issues
 * Loops up to 5 times until report is perfect
 */

const fs = require('fs');
const { execSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');

const MAX_ITERATIONS = 5;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Args: research.json report.html contactName
const researchFile = process.argv[2];
const reportFile = process.argv[3];
const contactName = process.argv[4] || 'Partner';

if (!researchFile || !reportFile) {
  console.error('Usage: node iterative-qc.js <research-json> <report-html> [contactName]');
  process.exit(1);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔄 ITERATIVE QC SYSTEM');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function runQCValidation() {
  console.log('🔍 Running validation checks...\n');
  
  try {
    execSync(`node ai-quality-control.js ${researchFile} ${reportFile}`, {
      stdio: 'inherit'
    });
    return { passed: true };
  } catch (error) {
    // QC script exits with code 1 on failure
    const qcResult = JSON.parse(fs.readFileSync('qc-result.json', 'utf8'));
    return { passed: false, issues: qcResult.issues, byPhase: qcResult.byPhase };
  }
}

async function analyzeWithAI(research, reportHtml, issues) {
  console.log('\n🤖 Analyzing issues with AI...\n');
  
  const prompt = `You are a quality control expert for law firm marketing reports. A report has failed validation with the following issues:

RESEARCH DATA:
${JSON.stringify(research, null, 2)}

CURRENT REPORT EXCERPT (first 3000 chars):
${reportHtml.substring(0, 3000)}

QC FAILURES:
${issues.join('\n')}

Analyze these failures and provide:
1. ROOT CAUSES: What's fundamentally wrong?
2. SPECIFIC FIXES: Concrete improvements needed
3. PRIORITY: Which issues are most critical?
4. REGENERATION GUIDANCE: What should the report generator focus on?

Be direct and actionable. No fluff.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  return response.content[0].text;
}

async function regenerateReport(research, aiGuidance, iteration, qcIssues) {
  console.log(`\n🔨 Regenerating report (iteration ${iteration})...\n`);
  
  // Step 1: Apply fixes to research data itself
  console.log('📊 Applying fixes to research data...');
  try {
    execSync(
      `node apply-qc-fixes.js ${researchFile} "${aiGuidance.replace(/"/g, '\\"')}" '${JSON.stringify(qcIssues)}'`,
      { stdio: 'inherit' }
    );
  } catch (error) {
    console.log('⚠️  Could not apply data fixes, continuing with improvement notes only');
  }
  
  // Step 2: Create improvement notes file for report generator
  const improvementNotes = `ITERATION ${iteration} - FIX THESE ISSUES:

${aiGuidance}

QC FAILURES TO ADDRESS:
${qcIssues.slice(0, 10).join('\n')}

CRITICAL REQUIREMENTS:
- Use ACTUAL firm name: "${research.firmName}"
- Use ACTUAL location: ${research.location.city}, ${research.location.state}
- Reference ACTUAL competitors by name (${research.competitors?.slice(0, 3).map(c => c.name).join(', ')})
- Use ACTUAL review data (Firm: ${research.reviewCount || 0} reviews @ ${research.rating || 0}⭐)
- Be PAINFULLY SPECIFIC - cite numbers, names, data points
- NO placeholder text or template variables
- NO banned phrases ("We'd love to chat", "If this resonates")
- NO weasel words (likely, probably, perhaps)
- Math must be accurate (all dollar amounts must add up correctly)
- Bold the most important parts (<strong>)
- Use pull quotes for key insights

HERO REQUIREMENTS:
- Must include firm name and location
- Must cite SPECIFIC competitor data if available
- Must show contrast (them vs competitors)
- Must be painful but accurate
`;

  fs.writeFileSync('improvement-notes.txt', improvementNotes);
  
  // Step 3: Regenerate with v8 generator
  try {
    execSync(`node report-generator-v8.js ${researchFile} "${contactName}"`, {
      stdio: 'inherit'
    });
    
    console.log('✅ Report regenerated\n');
    return true;
  } catch (error) {
    console.error('❌ Regeneration failed:', error.message);
    return false;
  }
}

async function iterativeQC() {
  const research = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
  
  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ITERATION ${iteration}/${MAX_ITERATIONS}`);
    console.log('='.repeat(60));
    
    // Run QC validation
    const qcResult = await runQCValidation();
    
    if (qcResult.passed) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ REPORT PERFECT - QC PASSED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`Iterations needed: ${iteration}`);
      console.log(`Firm: ${research.firmName}`);
      console.log(`Location: ${research.location.city}, ${research.location.state}\n`);
      
      // Write success result
      fs.writeFileSync('iterative-qc-result.json', JSON.stringify({
        status: 'PASSED',
        iterations: iteration,
        firmName: research.firmName
      }, null, 2));
      
      return 0;
    }
    
    // Failed - analyze and fix
    console.log(`\n❌ QC FAILED - ${qcResult.issues.length} issues found`);
    
    if (iteration === MAX_ITERATIONS) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('❌ MAX ITERATIONS REACHED - REPORT REJECTED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('Could not fix issues after 5 attempts.');
      console.log('Manual intervention required.\n');
      
      console.log('UNRESOLVED ISSUES:');
      Object.keys(qcResult.byPhase).forEach(phase => {
        console.log(`\n${phase}:`);
        qcResult.byPhase[phase].forEach(msg => console.log(`  - ${msg}`));
      });
      
      // Write failure result
      fs.writeFileSync('iterative-qc-result.json', JSON.stringify({
        status: 'FAILED',
        iterations: MAX_ITERATIONS,
        issues: qcResult.issues,
        byPhase: qcResult.byPhase
      }, null, 2));
      
      return 1;
    }
    
    // Get AI analysis
    const reportHtml = fs.readFileSync(reportFile, 'utf8');
    const aiGuidance = await analyzeWithAI(research, reportHtml, qcResult.issues);
    
    console.log('\n📋 AI ANALYSIS:');
    console.log('─'.repeat(60));
    console.log(aiGuidance);
    console.log('─'.repeat(60));
    
    // Regenerate with improvements
    const regenerated = await regenerateReport(research, aiGuidance, iteration, qcResult.issues);
    
    if (!regenerated) {
      console.log('\n❌ Could not regenerate report - aborting');
      return 1;
    }
    
    console.log('\n⏳ Waiting 2 seconds before next validation...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Run
iterativeQC()
  .then(code => process.exit(code))
  .catch(error => {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
