#!/usr/bin/env node
/**
 * WEBHOOK SERVER
 * Listens for Instantly webhooks when positive replies come in
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { researchFirm } = require('./research-v2.js');
const { generateReportSafe } = require('./production-wrapper-v5.js');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
const app = express();

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Speed-to-lead webhook server running' });
});

// Main webhook endpoint
app.post('/webhook/reply', async (req, res) => {
  console.log('\n🚨 NEW POSITIVE REPLY RECEIVED!');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const payload = req.body;
    
    // Log the full payload for debugging
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    // Extract lead info (Instantly's webhook structure)
    const leadEmail = payload.email || payload.lead_email;
    const leadName = payload.name || payload.lead_name;
    const companyName = payload.company || payload.company_name;
    const replyBody = payload.body || payload.message;
    const originalThread = payload.thread_id || payload.conversation_id;
    
    console.log(`\n👤 Lead: ${leadName}`);
    console.log(`📧 Email: ${leadEmail}`);
    console.log(`🏢 Company: ${companyName}`);
    console.log(`💬 Reply: ${replyBody?.substring(0, 100)}...`);
    
    // Acknowledge receipt immediately
    res.json({ 
      status: 'received', 
      message: 'Processing your lead...',
      leadEmail 
    });
    
    // Start background processing
    processLead({
      leadEmail,
      leadName,
      companyName,
      replyBody,
      originalThread,
      receivedAt: new Date().toISOString()
    }).catch(err => {
      console.error('❌ Error processing lead:', err);
    });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function processLead(lead) {
  console.log('\n🔄 Starting lead processing pipeline...');
  
  try {
    // Step 1: Save lead info
    const leadsDir = path.join(__dirname, 'leads');
    if (!fs.existsSync(leadsDir)) fs.mkdirSync(leadsDir);
    
    const leadId = `${Date.now()}-${lead.leadEmail.replace(/[^a-z0-9]/gi, '-')}`;
    const leadFile = path.join(leadsDir, `${leadId}.json`);
    
    fs.writeFileSync(leadFile, JSON.stringify(lead, null, 2));
    console.log(`💾 Lead saved: ${leadFile}`);
    
    // Step 2: Try to find their website
    let firmWebsite = null;
    
    // Try to extract from email domain
    const domain = lead.leadEmail.split('@')[1];
    firmWebsite = `https://${domain}`;
    
    console.log(`🌐 Firm website: ${firmWebsite}`);
    
    // Step 3: Research the firm
    console.log('\n🔍 Starting firm research...');
    const research = await researchFirm(firmWebsite);
    
    // Save research
    const researchFile = path.join(leadsDir, `${leadId}-research.json`);
    fs.writeFileSync(researchFile, JSON.stringify(research, null, 2));
    console.log(`💾 Research saved: ${researchFile}`);
    
    // Step 4: Generate the HTML report (PRODUCTION-SAFE)
    console.log('\n📝 Generating HTML report with production wrapper...');
    const reportResult = generateReportSafe(research, lead.leadName);
    
    if (!reportResult.success) {
      console.error('❌ Report generation failed:', reportResult.error);
      // Log to admin but don't crash - we still have the research
      // TODO: Send error notification to admin
      throw new Error(`Report generation failed: ${reportResult.error}`);
    }
    
    console.log('✅ Report validation passed');
    if (reportResult.warnings && reportResult.warnings.length > 0) {
      console.log('⚠️  Warnings:', reportResult.warnings.join(', '));
    }
    
    const reportFile = reportResult.outputPath;
    
    console.log('\n✅ PIPELINE COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Lead: ${lead.leadName}`);
    console.log(`Firm: ${research.firmName}`);
    console.log(`Location: ${research.location.city}, ${research.location.state}`);
    console.log(`Practice Areas: ${research.practiceAreas.slice(0, 3).join(', ')}`);
    console.log(`Gaps Found: ${Object.values(research.gaps).filter(g => g.hasGap).length}`);
    console.log(`Monthly Opportunity: $${research.estimatedMonthlyRevenueLoss.toLocaleString()}`);
    console.log(`Annual Opportunity: $${(research.estimatedMonthlyRevenueLoss * 12).toLocaleString()}`);
    console.log(`\n📄 Report: ${reportFile}`);
    console.log(`👉 Open: open "${reportFile}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Create a notification file for tracking
    const notificationFile = path.join(__dirname, 'completed-reports.txt');
    const notification = `\n[${new Date().toISOString()}] ${lead.leadName} | ${research.firmName} | ${reportFile}`;
    fs.appendFileSync(notificationFile, notification);
    
  } catch (error) {
    console.error('❌ Pipeline error:', error);
  }
}

// Start server
const PORT = config.port || 3456;
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Speed-to-Lead Webhook Server Running');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook/reply`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⏳ Waiting for positive replies...\n');
});
