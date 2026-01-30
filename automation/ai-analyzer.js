#!/usr/bin/env node
/**
 * AI-Powered Analysis Engine
 * Generates personalized enhancements for the report (not additions)
 * 
 * Usage: node ai-analyzer.js <research-json-path>
 */

const https = require('https');
const fs = require('fs');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const researchJsonPath = process.argv[2];

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY environment variable not set');
  process.exit(1);
}

if (!researchJsonPath) {
  console.error('Usage: node ai-analyzer.js <research-json-path>');
  process.exit(1);
}

// Load research data
const researchData = JSON.parse(fs.readFileSync(researchJsonPath, 'utf8'));

console.log(`🤖 Analyzing: ${researchData.firmName}`);

// Normalize data format (handle both old and new v5 format)
function normalizeData(data) {
  // If it's the new v5 format (has firmIntel), transform it
  if (data.firmIntel) {
    return {
      firmName: data.firmName,
      practiceAreas: data.firmIntel.keySpecialties || data.practiceAreas || [],
      allLocations: data.allLocations || [],
      attorneys: data.sampleAttorneys || [],
      positioning: data.firmIntel.positioning || '',
      firmSize: data.firmIntel.firmSize?.estimate || 'unknown',
      recentNews: data.firmIntel.recentNews || [],
      growthSignals: data.firmIntel.growthSignals || [],
      credentials: data.firmIntel.credentials || [],
      // Old format gaps (not available in v5)
      hasMetaAds: false,
      hasGoogleAds: false,
      has24_7Intake: false,
      hasCRM: false,
      competitors: []
    };
  }
  // Old format, return as-is
  return data;
}

const normalizedData = normalizeData(researchData);

// Build prompt focused on enhancing existing sections
function buildAnalysisPrompt(data) {
  const gaps = [];
  if (!data.hasMetaAds) gaps.push('No Meta ads');
  if (!data.hasGoogleAds) gaps.push('No Google Ads');
  if (!data.has24_7Intake) gaps.push('No 24/7 intake');
  if (!data.hasCRM) gaps.push('No CRM');

  const competitorSummary = data.competitors && data.competitors.length > 0
    ? data.competitors.slice(0, 5).map((c, i) => 
        `${i + 1}. ${c.name} - ${c.reviews} reviews (${c.rating}★)`
      ).join('\n')
    : 'No competitor data available';

  // Add v5-specific context if available
  const v5Context = data.positioning ? `
FIRM POSITIONING: ${data.positioning}
FIRM SIZE: ${data.firmSize}
${data.recentNews && data.recentNews.length > 0 ? `RECENT NEWS:\n${data.recentNews.map(n => `- ${n}`).join('\n')}` : ''}
${data.growthSignals && data.growthSignals.length > 0 ? `GROWTH SIGNALS:\n${data.growthSignals.map(g => `- ${g}`).join('\n')}` : ''}
${data.credentials && data.credentials.length > 0 ? `CREDENTIALS: ${data.credentials.join(', ')}` : ''}
` : '';

  return `You're writing a personalized marketing pitch for ${data.firmName}, a law firm.

FIRM INFO:
- Practice areas: ${data.practiceAreas.join(', ')}
- Locations: ${data.allLocations.map(l => `${l.city}, ${l.state}`).join(', ')}
- Team: ${data.attorneys.length} attorneys
- Current gaps: ${gaps.join(', ')}
${v5Context}
TOP COMPETITORS:
${competitorSummary}

Your job: Write SHORT, PUNCHY enhancements that make the pitch feel like we did deep research on THEIR specific firm.

Write in a conversational, confident tone. NO consultant jargon. NO buzzwords. Sound human.

Provide:

1. **personalized_hook** (1 sentence): Why THIS firm specifically is sitting on untapped money. Make it specific to them (their locations, practice areas, team size, etc). NOT generic "you're losing money" - something that shows we studied THEIR situation.

2. **gap_explanations**: For each gap they have, write a 1-2 sentence explanation of what it means FOR THEM specifically (not generic). Reference their practice areas, locations, competitors when relevant.

Format like this:
{
  "meta_ads": "...",
  "google_ads": "...",
  "intake_24_7": "...",
  "crm": "..."
}

Only include gaps that exist (from the list above).

3. **opportunity_frame** (1 sentence): Reframe the revenue opportunity in terms of THEIR specific situation. Not "$60K/month" but "With 5 offices, you should be dominating local search in all 5 markets - that's XX divorce cases/month you're missing."

Return ONLY valid JSON. No markdown, no explanation, just:
{
  "personalized_hook": "...",
  "gap_explanations": { ... },
  "opportunity_frame": "..."
}`;
}

// Call Claude API
function callClaudeAPI(prompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            const content = response.content[0].text;
            
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              reject(new Error('No JSON found in Claude response'));
            }
          } catch (err) {
            reject(new Error(`Failed to parse Claude response: ${err.message}`));
          }
        } else {
          reject(new Error(`Claude API error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// Main
(async () => {
  try {
    const prompt = buildAnalysisPrompt(normalizedData);
    console.log('📡 Calling Claude API...');
    
    const analysis = await callClaudeAPI(prompt);
    
    console.log('✅ AI analysis complete');
    console.log(`   - Personalized hook: ${analysis.personalized_hook.substring(0, 60)}...`);
    console.log(`   - Gap explanations: ${Object.keys(analysis.gap_explanations || {}).length}`);
    console.log(`   - Opportunity frame: ${analysis.opportunity_frame ? analysis.opportunity_frame.substring(0, 60) + '...' : 'N/A'}`);
    
    // Merge into ORIGINAL research data (preserve v5 format)
    researchData.ai_enhancements = analysis;
    
    // Save enhanced research file
    fs.writeFileSync(researchJsonPath, JSON.stringify(researchData, null, 2));
    
    console.log(`💾 Enhanced research saved to: ${researchJsonPath}`);
    
  } catch (err) {
    console.error('❌ AI analysis failed:', err.message);
    process.exit(1);
  }
})();
