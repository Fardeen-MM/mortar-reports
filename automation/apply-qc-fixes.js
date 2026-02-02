#!/usr/bin/env node
/**
 * Apply QC Fixes to Research Data
 * Takes AI guidance and modifies research data to fix issues
 */

const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const researchFile = process.argv[2];
const aiGuidance = process.argv[3]; // Text from AI analysis
const qcIssues = process.argv[4]; // JSON string of issues

if (!researchFile || !aiGuidance) {
  console.error('Usage: node apply-qc-fixes.js <research-json> <ai-guidance> [qc-issues-json]');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function applyFixes() {
  const research = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
  
  console.log('🔧 Applying AI-suggested fixes to research data...\n');
  
  // Use AI to generate specific data improvements
  const prompt = `You are fixing law firm research data based on QC failures.

CURRENT RESEARCH DATA:
${JSON.stringify(research, null, 2)}

AI ANALYSIS OF ISSUES:
${aiGuidance}

${qcIssues ? `QC ISSUES:\n${qcIssues}` : ''}

Generate IMPROVED research data by:
1. Fixing any generic/placeholder values
2. Improving specificity where data is weak
3. Adding missing critical fields
4. Ensuring mathematical consistency

Return ONLY valid JSON with the complete improved research object. No markdown, no explanation.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const improvedDataText = response.content[0].text.trim();
  
  // Extract JSON if it's wrapped in markdown
  let improvedData;
  if (improvedDataText.startsWith('```')) {
    const jsonMatch = improvedDataText.match(/```(?:json)?\n([\s\S]+?)\n```/);
    if (jsonMatch) {
      improvedData = JSON.parse(jsonMatch[1]);
    } else {
      throw new Error('Could not extract JSON from AI response');
    }
  } else {
    improvedData = JSON.parse(improvedDataText);
  }
  
  // Write improved research back to file
  fs.writeFileSync(researchFile, JSON.stringify(improvedData, null, 2));
  
  console.log('✅ Research data improved\n');
  console.log('Key changes:');
  
  // Show what changed
  const changes = [];
  if (research.firmName !== improvedData.firmName) {
    changes.push(`- Firm name: "${research.firmName}" → "${improvedData.firmName}"`);
  }
  if (JSON.stringify(research.location) !== JSON.stringify(improvedData.location)) {
    changes.push(`- Location: ${JSON.stringify(research.location)} → ${JSON.stringify(improvedData.location)}`);
  }
  if ((research.competitors?.length || 0) !== (improvedData.competitors?.length || 0)) {
    changes.push(`- Competitors: ${research.competitors?.length || 0} → ${improvedData.competitors?.length || 0}`);
  }
  
  if (changes.length === 0) {
    console.log('  (No structural changes - improvements are qualitative)');
  } else {
    changes.forEach(c => console.log(c));
  }
  
  console.log('\n');
  return true;
}

applyFixes()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Failed to apply fixes:', error.message);
    process.exit(1);
  });
