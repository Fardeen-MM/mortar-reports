#!/usr/bin/env node
/**
 * REPORT GENERATOR
 * Takes research data + generates HTML report using Claude
 */

const fs = require('fs');
const path = require('path');

// This will use Clawdbot's Claude API (no extra cost!)
async function generateReport(researchData, prospectName) {
  console.log(`📝 Generating report for ${prospectName}...`);
  
  // Load the massive prompt
  const promptTemplate = fs.readFileSync(
    path.join(__dirname, 'report-prompt.txt'),
    'utf-8'
  );
  
  // Build the input for Claude
  const input = `
${promptTemplate}

---

Prospect Info:
- Name: ${prospectName}
- Firm: ${researchData.firmName}
- Website: ${researchData.website}
- Practice Area: ${researchData.practiceAreas.join(', ')}
- Location: ${researchData.location.city}, ${researchData.location.state}
- Credentials: ${researchData.credentials.join(', ')}
- Has Google Ads: ${researchData.hasGoogleAds ? 'Yes' : 'No'}
- Has Meta Ads: ${researchData.hasMetaAds ? 'Yes' : 'No'}
- Competitors: ${researchData.competitors.slice(0, 3).join(', ')}
- Page Speed: ${researchData.pageSpeed}

Additional Research Context:
${JSON.stringify(researchData, null, 2)}

Now generate the complete HTML report following ALL the instructions above.
`;

  // Use exec to call Claude via Clawdbot
  const tempInputFile = path.join(__dirname, 'temp-prompt.txt');
  fs.writeFileSync(tempInputFile, input);
  
  console.log('🤖 Calling Claude API via Clawdbot...');
  console.log('⏳ This takes 30-60 seconds...');
  
  // Call clawdbot to generate the report
  const { execSync } = require('child_process');
  
  try {
    // Use clawdbot's API directly via a temp script
    const reportHTML = await callClaudeDirect(input);
    
    // Clean up
    fs.unlinkSync(tempInputFile);
    
    return reportHTML;
    
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
    throw error;
  }
}

// Helper to call Claude via Clawdbot session
async function callClaudeDirect(prompt) {
  // This will be implemented to use the sessions API
  // For now, return a placeholder
  
  const axios = require('axios');
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
  
  // This will call the Clawdbot API endpoint
  // You'll need to set this up with your gateway token
  
  throw new Error('Not implemented yet - need to wire up to Clawdbot sessions API');
}

// If run directly
if (require.main === module) {
  const researchFile = process.argv[2];
  const prospectName = process.argv[3];
  
  if (!researchFile || !prospectName) {
    console.error('Usage: node generate-report.js <research-file.json> <"Prospect Name">');
    process.exit(1);
  }
  
  const researchData = JSON.parse(fs.readFileSync(researchFile, 'utf-8'));
  
  generateReport(researchData, prospectName).then(html => {
    const firmSlug = researchData.firmName.replace(/\s+/g, '-').toLowerCase();
    const filename = path.join(__dirname, 'reports', `${firmSlug}-report.html`);
    fs.writeFileSync(filename, html);
    console.log(`\n✅ Report saved to: ${filename}`);
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { generateReport };
