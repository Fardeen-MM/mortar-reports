#!/usr/bin/env node
/**
 * REPORT GENERATOR V12 - AI-POWERED PEAK QUALITY
 * 
 * Uses maximal research to generate ultra-personalized reports
 * Every section AI-generated based on actual firm data
 * No templates - pure intelligence-driven content
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not set');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ============================================================================
// AI CONTENT GENERATION
// ============================================================================

async function generateWithAI(prompt, research, maxTokens = 2000) {
  const context = JSON.stringify(research, null, 2).substring(0, 100000);
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    temperature: 0.7, // Slightly creative for better writing
    messages: [{
      role: 'user',
      content: `${prompt}\n\n<research_data>\n${context}\n</research_data>`
    }]
  });
  
  return response.content[0].text;
}

// ============================================================================
// AI-GENERATED HERO SECTION
// ============================================================================

async function generateHero(research) {
  console.log('   📝 AI generating hero...');
  
  const prompt = `Write a POWERFUL hero section for ${research.firmName}'s marketing audit report.

Use REAL DATA from the research:
- Their actual Google rating: ${research.googleBusiness.rating}⭐ (${research.googleBusiness.reviews} reviews)
- Competitor ratings: ${research.competitors.map(c => `${c.name}: ${c.rating}⭐ (${c.reviewCount} reviews)`).join(', ')}
- Their actual location: ${research.location.city}, ${research.location.state}
- Specific pain points identified: ${research.intelligence?.painPoints?.join(', ') || 'visibility gaps'}

Requirements:
1. Start with their EXACT firm name and location
2. Use REAL competitor names and data
3. Make it PAINFUL but TRUE - use actual numbers
4. Calculate real monthly revenue loss based on data
5. Be specific about what they're losing (use competitor review counts, ad presence)
6. 3-4 sentences max
7. End with a dollar amount (format: "$19K/month")

Return ONLY the HTML (no markdown, no code blocks):
<div class="hero">
  <h1>...</h1>
  <p class="hero-subhead">...</p>
  <div class="hero-stat">$XXK<span>/month</span></div>
</div>`;

  const html = await generateWithAI(prompt, research, 1000);
  return html.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
}

// ============================================================================
// AI-GENERATED GAP ANALYSIS
// ============================================================================

async function generateGaps(research) {
  console.log('   📝 AI generating gap analysis...');
  
  const prompt = `Analyze the 3 BIGGEST marketing gaps for ${research.firmName} based on the research data.

For each gap:
1. Use REAL DATA (their website pages, social presence, competitor comparison)
2. Be SPECIFIC - cite actual competitor names, review counts, ad presence
3. Calculate REAL cost (use their practice area, competitor data, location economics)
4. Include a 3-4 step flow showing what's happening
5. Provide proof/stat that's relevant
6. Keep each gap description to 2 short paragraphs max

GAP 1 should be about: Google Ads / Search visibility (use competitor ad data)
GAP 2 should be about: Social media / Meta ads (use their actual social presence vs competitors)
GAP 3 should be about: After-hours / Voice AI (use their hours data if available)

Return ONLY valid JSON (no markdown):
{
  "gap1": {
    "title": "...",
    "tldr": "...",
    "description": "...",
    "flow": ["step1", "step2", "step3", "step4"],
    "stat": "...",
    "cost": 8,
    "formula": "...",
    "proof": "..."
  },
  "gap2": { ... },
  "gap3": { ... }
}`;

  const response = await generateWithAI(prompt, research, 3000);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('Failed to generate gaps');
}

// ============================================================================
// AI-GENERATED COMPETITOR SECTION
// ============================================================================

async function generateCompetitorAnalysis(research) {
  console.log('   📝 AI generating competitor analysis...');
  
  const prompt = `Write a competitor analysis section for ${research.firmName}.

Use REAL competitor data:
${research.competitors.map(c => `
- ${c.name}: ${c.rating}⭐ (${c.reviewCount} reviews), ${c.hasGoogleAds ? 'Running Google Ads' : 'No ads'}, Website: ${c.website || 'N/A'}
`).join('')}

Requirements:
1. Introduce the top 3 competitors by name
2. Compare ${research.firmName}'s ${research.googleBusiness.rating}⭐ (${research.googleBusiness.reviews} reviews) to each competitor
3. Mention who's running ads and who isn't
4. Point out the opportunity gap
5. Make it factual but revealing
6. 3-4 paragraphs max

Return ONLY the HTML (no markdown):
<div class="competitor-section">
  <h2>Your Competitive Landscape</h2>
  <p>...</p>
  ... (use divs, strong tags, etc. as needed)
</div>`;

  const html = await generateWithAI(prompt, research, 1500);
  return html.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
}

// ============================================================================
// AI-GENERATED PERSONALIZED OPENER
// ============================================================================

async function generatePersonalizedOpener(research) {
  console.log('   📝 AI generating personalized opener...');
  
  const prompt = `Write a personalized opening paragraph for ${research.contactPerson} at ${research.firmName}.

Use SPECIFIC HOOKS from the research:
- Recent news: ${research.news.map(n => n.title).join('; ')}
- Growth signals: ${research.intelligence?.growthSignals?.join(', ')}
- Unique positioning: ${research.intelligence?.uniqueAngle}
- Decision maker background: ${research.intelligence?.keyDecisionMakers?.[0]?.background}

Requirements:
1. Reference something SPECIFIC about their firm (recent news, expansion, specialty)
2. Show you did your homework
3. Transition into "we noticed some gaps"
4. 2-3 sentences max
5. Professional but conversational

Return ONLY the HTML:
<p class="personalized-opener">...</p>`;

  const html = await generateWithAI(prompt, research, 500);
  return html.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
}

// ============================================================================
// AI-GENERATED SOLUTION ROADMAP
// ============================================================================

async function generateSolution(research) {
  console.log('   📝 AI generating solution roadmap...');
  
  const prompt = `Create a solution roadmap for ${research.firmName} to close their marketing gaps.

Based on their tech sophistication (${research.intelligence?.techSophistication}) and marketing maturity (${research.intelligence?.marketingMaturity}), recommend:

1. Phase 1: Quick wins (1-2 weeks)
2. Phase 2: Foundation building (1 month)
3. Phase 3: Scale & optimize (ongoing)

For each phase:
- List 2-3 specific actions
- Explain WHY it matters for THEIR firm specifically
- Use their actual gaps/weaknesses from research

Return ONLY the HTML:
<div class="solution-roadmap">
  <h2>What ${research.firmName} Needs to Fix This</h2>
  <div class="phase">
    <h3>Phase 1: ...</h3>
    <p>...</p>
  </div>
  ...
</div>`;

  const html = await generateWithAI(prompt, research, 2000);
  return html.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
}

// ============================================================================
// MAIN REPORT GENERATOR
// ============================================================================

async function generateReport(researchData, contactName) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 AI-POWERED REPORT GENERATION V12');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📊 Research quality:`);
  console.log(`   - Website pages: ${researchData.websitePages?.length || 0}`);
  console.log(`   - Attorney profiles: ${researchData.attorneyLinkedIns?.length || 0}`);
  console.log(`   - News mentions: ${researchData.news?.length || 0}`);
  console.log(`   - Competitors analyzed: ${researchData.competitors?.length || 0}`);
  console.log(`   - AI intelligence: ${researchData.intelligence ? '✅' : '❌'}\n`);
  
  if (!researchData.intelligence) {
    console.error('❌ No AI intelligence found in research data');
    console.error('   Run maximal-research-v2.js first to generate full intelligence\n');
    process.exit(1);
  }
  
  console.log('🎨 Generating AI-powered content sections...\n');
  
  // Generate each section with AI
  const hero = await generateHero(researchData);
  const opener = await generatePersonalizedOpener(researchData);
  const gaps = await generateGaps(researchData);
  const competitors = await generateCompetitorAnalysis(researchData);
  const solution = await generateSolution(researchData);
  
  console.log('\n✅ All sections generated\n');
  console.log('🔨 Assembling final report...\n');
  
  // Load CSS
  const cssModule = require('./report-v9-css.js');
  const css = cssModule();
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${researchData.firmName} | Marketing Intelligence Report by Mortar Metrics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;0,700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  ${css}
  <style>
    .personalized-opener {
      font-size: 1.1rem;
      line-height: 1.6;
      color: #2d3748;
      max-width: 700px;
      margin: 0 auto 3rem;
      padding: 1.5rem;
      background: #f7fafc;
      border-left: 4px solid #3182ce;
    }
    .gap-section {
      margin: 3rem 0;
    }
    .solution-roadmap {
      margin: 3rem 0;
    }
    .phase {
      margin: 2rem 0;
      padding: 1.5rem;
      background: #f7fafc;
      border-left: 4px solid #48bb78;
    }
    .competitor-section {
      margin: 3rem 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">MORTAR METRICS</div>
      <div class="header-info">
        <div><strong>Prepared for:</strong> ${contactName}</div>
        <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>
    </div>
    
    ${hero}
    
    ${opener}
    
    <div class="gap-section">
      <h2>Where You're Losing Money</h2>
      
      <div class="section-label">GAP #1</div>
      <div class="tldr-box">
        <div class="tldr-label">TLDR</div>
        <div class="tldr-content">
          <strong>${gaps.gap1.tldr}</strong><br>
          <span class="tldr-cost">Cost: ~$${gaps.gap1.cost}K/month</span>
        </div>
      </div>
      <div class="gap-box">
        <div class="gap-header">
          <div class="gap-title">${gaps.gap1.title}</div>
          <div class="gap-cost">-$${gaps.gap1.cost}K/mo</div>
        </div>
        <p>${gaps.gap1.description}</p>
        <div class="flow-diagram">
          ${gaps.gap1.flow.map((step, i) => `
            <div class="flow-step">${step}</div>
            ${i < gaps.gap1.flow.length - 1 ? '<div class="flow-arrow">↓</div>' : ''}
          `).join('')}
        </div>
        <p class="math-line"><strong>The math:</strong> ${gaps.gap1.formula} = <strong>$${gaps.gap1.cost}K/month</strong></p>
        <p class="proof-line">${gaps.gap1.proof}</p>
      </div>
      
      <div class="section-label">GAP #2</div>
      <div class="tldr-box">
        <div class="tldr-label">TLDR</div>
        <div class="tldr-content">
          <strong>${gaps.gap2.tldr}</strong><br>
          <span class="tldr-cost">Cost: ~$${gaps.gap2.cost}K/month</span>
        </div>
      </div>
      <div class="gap-box">
        <div class="gap-header">
          <div class="gap-title">${gaps.gap2.title}</div>
          <div class="gap-cost">-$${gaps.gap2.cost}K/mo</div>
        </div>
        <p>${gaps.gap2.description}</p>
        <div class="flow-diagram">
          ${gaps.gap2.flow.map((step, i) => `
            <div class="flow-step">${step}</div>
            ${i < gaps.gap2.flow.length - 1 ? '<div class="flow-arrow">↓</div>' : ''}
          `).join('')}
        </div>
        <p class="math-line"><strong>The math:</strong> ${gaps.gap2.formula} = <strong>$${gaps.gap2.cost}K/month</strong></p>
        <p class="proof-line">${gaps.gap2.proof}</p>
      </div>
      
      <div class="section-label">GAP #3</div>
      <div class="tldr-box">
        <div class="tldr-label">TLDR</div>
        <div class="tldr-content">
          <strong>${gaps.gap3.tldr}</strong><br>
          <span class="tldr-cost">Cost: ~$${gaps.gap3.cost}K/month</span>
        </div>
      </div>
      <div class="gap-box">
        <div class="gap-header">
          <div class="gap-title">${gaps.gap3.title}</div>
          <div class="gap-cost">-$${gaps.gap3.cost}K/mo</div>
        </div>
        <p>${gaps.gap3.description}</p>
        <div class="flow-diagram">
          ${gaps.gap3.flow.map((step, i) => `
            <div class="flow-step">${step}</div>
            ${i < gaps.gap3.flow.length - 1 ? '<div class="flow-arrow">↓</div>' : ''}
          `).join('')}
        </div>
        <p class="math-line"><strong>The math:</strong> ${gaps.gap3.formula} = <strong>$${gaps.gap3.cost}K/month</strong></p>
        <p class="proof-line">${gaps.gap3.proof}</p>
      </div>
    </div>
    
    ${competitors}
    
    ${solution}
    
    <div id="booking" class="cta">
      <h2>Ready to Fix This?</h2>
      <p>15 minutes. We'll show you exactly how to close these gaps.</p>
      <iframe src="https://api.mortarmetrics.com/widget/booking/7aCMl8OqQAOE3NfjfUGT" style="width: 100%;border:none;overflow: hidden;min-height:600px" scrolling="no" id="mortar-booking-widget"></iframe>
      <script src="https://api.mortarmetrics.com/js/form_embed.js" type="text/javascript"></script>
    </div>
    
    <div class="footer">
      Mortar Metrics · Legal Growth Agency · Toronto, ON<br>
      <a href="mailto:hello@mortarmetrics.com">hello@mortarmetrics.com</a>
    </div>
  </div>
</body>
</html>`;

  // Save report
  const firmName = researchData.firmName || 'unknown-firm';
  const slug = firmName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const outputPath = path.join(__dirname, 'reports', `${slug}-landing-page-v12-ai.html`);
  fs.writeFileSync(outputPath, html);
  
  console.log('✅ Report generated successfully');
  console.log(`💾 Saved: ${outputPath}\n`);
  
  return outputPath;
}

// CLI mode
if (require.main === module) {
  const researchFile = process.argv[2];
  const contactName = process.argv[3] || 'Partner';
  
  if (!researchFile) {
    console.error('Usage: node report-generator-v12-ai-powered.js <research-json> [contactName]');
    process.exit(1);
  }
  
  try {
    const researchData = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
    generateReport(researchData, contactName)
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Error:', error.message);
        process.exit(1);
      });
  } catch (error) {
    console.error('❌ Error reading research file:', error.message);
    process.exit(1);
  }
}

module.exports = { generateReport };
