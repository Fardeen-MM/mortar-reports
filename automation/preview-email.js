#!/usr/bin/env node
/**
 * Preview Email Template
 * Shows what the email will look like before sending
 * 
 * Usage: node preview-email.js <firm_name> <contact_name> <report_url>
 */

const fs = require('fs');
const path = require('path');
const { buildPersonalizedEmail, buildSimpleEmail } = require('./email-templates');

const firmName = process.argv[2];
const contactName = process.argv[3];
const reportUrl = process.argv[4];

if (!firmName || !contactName || !reportUrl) {
  console.log('Usage: node preview-email.js <firm_name> <contact_name> <report_url>');
  console.log('\nExample:');
  console.log('  node preview-email.js "Roth Jackson" "Andrew Condlin" "https://reports.mortarmetrics.com/RothJackson/"');
  process.exit(1);
}

// Try to load research data
const reportsDir = path.join(__dirname, 'reports');
const possibleFiles = [
  `${firmName.toLowerCase().replace(/\s+/g, '-')}-intel-v5.json`,
  `${firmName.toLowerCase().replace(/\s+/g, '-')}-research.json`,
];

let researchData = null;

for (const filename of possibleFiles) {
  const filepath = path.join(reportsDir, filename);
  if (fs.existsSync(filepath)) {
    try {
      researchData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      console.log(`✅ Loaded research data: ${filename}\n`);
      break;
    } catch (e) {
      console.warn(`⚠️  Could not parse ${filename}`);
    }
  }
}

// Build email
let emailContent;
if (researchData) {
  emailContent = buildPersonalizedEmail(researchData, contactName, reportUrl);
  console.log('📧 EMAIL PREVIEW (AI-Personalized)\n');
} else {
  emailContent = buildSimpleEmail(contactName, reportUrl);
  console.log('📧 EMAIL PREVIEW (Standard Template)\n');
}

console.log('═'.repeat(60));
console.log(`Subject: ${emailContent.subject}`);
console.log('═'.repeat(60));
console.log(emailContent.body);
console.log('═'.repeat(60));

if (researchData) {
  console.log('\n📊 Personalization Data Used:');
  console.log(`   Firm: ${researchData.firmName}`);
  console.log(`   Size: ${researchData.firmIntel?.firmSize?.estimate || 'Unknown'}`);
  console.log(`   Location: ${researchData.location?.city || 'Unknown'}, ${researchData.location?.state || ''}`);
  console.log(`   Key Specialty: ${researchData.firmIntel?.keySpecialties?.[0] || 'None'}`);
  console.log(`   Recent News: ${researchData.firmIntel?.recentNews?.[0] || 'None'}`);
  console.log(`   Growth Signal: ${researchData.firmIntel?.growthSignals?.[0] || 'None'}`);
}

console.log('\n✅ This is what will be sent when you approve!\n');
