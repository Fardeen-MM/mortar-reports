#!/usr/bin/env node
/**
 * AI-Powered Analysis Engine
 * Takes raw research data and generates intelligent strategic insights using Claude API
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

console.log(`🤖 Starting AI analysis for: ${researchData.firmName}`);
console.log(`📊 Data loaded: ${researchData.pagesAnalyzed.length} pages, ${researchData.competitors.length} competitors\n`);

// Build strategic analysis prompt
function buildAnalysisPrompt(data) {
  const competitorSummary = data.competitors.slice(0, 5).map((c, i) => 
    `${i + 1}. ${c.name} - ${c.reviews} reviews (${c.rating}★)`
  ).join('\n');

  const locationSummary = data.allLocations.map(l => 
    `${l.city}, ${l.state}`
  ).join(', ');

  return `You are a legal marketing strategist analyzing a law firm. Your goal is to find strategic insights and actionable opportunities.

FIRM PROFILE:
- Name: ${data.firmName}
- Website: ${data.website}
- Contact: ${data.contactPerson}
- Locations: ${locationSummary}
- Practice Areas: ${data.practiceAreas.join(', ')}
- Team Size: ${data.attorneys.length} attorneys

WEBSITE PERFORMANCE:
- Load Time: ${(data.pageSpeed / 1000).toFixed(1)}s (${data.pageSpeedScore})
- Pages Analyzed: ${data.pagesAnalyzed.length}
- 24/7 Support: ${data.gaps.support24x7.hasGap ? 'No' : 'Yes'}
- Chatbot: ${data.hasChatbot ? 'Yes' : 'No'}

TOP COMPETITORS (${data.location.city}, ${data.location.state}):
${competitorSummary}

CURRENT ADVERTISING:
- Google Ads: ${data.googleAdsData.running ? `Running (${data.googleAdsData.adCount} ads)` : 'Not running'}
- Meta Ads: ${data.gaps.metaAds.hasGap ? 'Not running' : 'Running'}

IDENTIFIED GAPS:
${Object.entries(data.gaps).filter(([_, v]) => v.hasGap).map(([key, gap]) => 
  `- ${key}: ${gap.details}`
).join('\n')}

ANALYZE THIS FIRM AND PROVIDE:

1. UNIQUE POSITIONING
   - What makes this firm different from competitors?
   - What's their strategic advantage (even if they're not leveraging it)?
   - Any unique background, credentials, or approach?

2. COMPETITIVE ANALYSIS
   - Why are the top competitors winning?
   - What can this firm do to compete despite fewer reviews?
   - What white space opportunities exist?

3. MARKET INSIGHTS
   - What's happening in the ${data.location.city}, ${data.location.state} legal market?
   - Any trends or opportunities specific to this area?
   - Underserved segments?

4. STRATEGIC RECOMMENDATIONS
   - What should they prioritize first?
   - Why would it work for THIS specific firm?
   - Expected impact and timeline?

5. HIDDEN OPPORTUNITIES
   - Non-obvious gaps the competition isn't exploiting
   - Creative angles based on their specific situation
   - Quick wins they could implement this month

Be specific. Think strategically. Don't give generic advice. Everything should be tailored to THIS firm's actual situation.

Respond in JSON format:
{
  "positioning": "...",
  "competitive_analysis": "...",
  "market_insights": "...",
  "strategic_recommendations": ["...", "...", "..."],
  "hidden_opportunities": ["...", "...", "..."],
  "executive_summary": "2-3 sentence summary of the biggest opportunity"
}`;
}

// Call Claude API
function callClaudeAPI(prompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
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
            
            // Extract JSON from response (Claude might wrap it in markdown)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              reject(new Error('Could not extract JSON from Claude response'));
            }
          } catch (e) {
            reject(new Error(`Failed to parse Claude response: ${e.message}`));
          }
        } else {
          reject(new Error(`Claude API returned status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

// Main execution
(async () => {
  try {
    console.log('🧠 Sending data to Claude for analysis...');
    
    const prompt = buildAnalysisPrompt(researchData);
    const analysis = await callClaudeAPI(prompt);
    
    console.log('✅ AI analysis complete!\n');
    console.log('📋 Executive Summary:');
    console.log(`   ${analysis.executive_summary}\n`);
    
    // Merge AI analysis into research data
    researchData.ai_analysis = analysis;
    researchData.ai_analyzed_at = new Date().toISOString();
    
    // Save enhanced research data
    fs.writeFileSync(researchJsonPath, JSON.stringify(researchData, null, 2));
    
    console.log('💾 Enhanced research data saved with AI insights');
    console.log(`📊 Analysis includes:`);
    console.log(`   - Positioning insights`);
    console.log(`   - Competitive analysis`);
    console.log(`   - Market insights`);
    console.log(`   - ${analysis.strategic_recommendations.length} strategic recommendations`);
    console.log(`   - ${analysis.hidden_opportunities.length} hidden opportunities`);
    
  } catch (error) {
    console.error('❌ AI analysis failed:', error.message);
    console.error('\n⚠️  Continuing without AI insights (report will use template copy)');
    
    // Don't fail the entire pipeline - just continue without AI
    process.exit(0);
  }
})();
