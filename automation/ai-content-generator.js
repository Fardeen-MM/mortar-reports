#!/usr/bin/env node
/**
 * AI CONTENT GENERATOR - Let Claude Handle All the Nuance
 *
 * Instead of brittle hardcoded mappings that break on edge cases,
 * let Claude understand the practice area context and generate
 * appropriate content.
 *
 * AI handles: estate planning vs probate vs real estate, grammar, etc.
 * Fallback: VERY generic content that works for any practice area.
 */

require('dotenv').config();
const https = require('https');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// In-memory cache (persists for process lifetime)
const contentCache = new Map();

/**
 * Generate ALL practice-area content using AI
 * This is the PRIMARY path - AI understands context better than regex
 */
async function generatePracticeContent(practiceAreas, firmName, city, state) {
  const practiceList = (practiceAreas || []).join(', ') || 'general law';

  // Check cache
  const cacheKey = `${practiceList}:${city}:${state}`.toLowerCase();
  if (contentCache.has(cacheKey)) {
    console.log(`   💾 Using cached AI content`);
    return contentCache.get(cacheKey);
  }

  if (!ANTHROPIC_API_KEY) {
    console.log(`   ⚠️  No API key - using generic fallback`);
    return null;
  }

  console.log(`   🤖 AI generating content for: ${practiceList}`);

  const prompt = `You're writing marketing content for a law firm. Based on their practice areas, generate contextually appropriate content.

**Firm's practice areas:** ${practiceList}
**Location:** ${city}, ${state}

Determine the PRIMARY practice area and generate content for it. Important distinctions:
- "Estate planning" = proactive planning (wills, trusts) - client is "individual planning ahead"
- "Probate" = after death - client is "family member" dealing with "a death in the family"
- "Real estate" = property transactions - client is "buyer" or "property owner"
- "Estate" alone usually means estate planning, NOT real estate
- "Landlord/tenant" = eviction cases - client is "landlord" facing "an eviction situation"

Return ONLY this JSON:
{
  "primaryPracticeArea": "the main practice area you identified",
  "clientLabel": {
    "singular": "who the typical client is (landlord, accident victim, immigrant, etc.)",
    "plural": "plural form"
  },
  "emergencyScenario": "what situation triggers them to call (realistic for THIS practice area)",
  "attorneyType": "how to describe this attorney type (family, estate planning, immigration, etc.)",
  "articleForAttorney": "a" or "an" (based on sound - 'an estate' but 'a family')",
  "articleForClient": "a" or "an" (based on sound - 'an individual' but 'a landlord')"
}`;

  try {
    const response = await callAnthropic(prompt, 500);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const content = JSON.parse(jsonMatch[0]);

      // Validate we got the essentials
      if (content.clientLabel?.singular && content.emergencyScenario) {
        contentCache.set(cacheKey, content);
        console.log(`   ✅ AI: "${content.primaryPracticeArea}" → client="${content.clientLabel.singular}", scenario="${content.emergencyScenario}"`);
        return content;
      }
    }

    console.log(`   ⚠️  AI response incomplete - using fallback`);
    return null;

  } catch (error) {
    console.log(`   ⚠️  AI failed: ${error.message} - using fallback`);
    return null;
  }
}

/**
 * Call Anthropic API with Claude Haiku (fast + cheap)
 */
function callAnthropic(prompt, maxTokens = 500) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      temperature: 0,
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
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestData)
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.content?.[0]?.text) {
            resolve(result.content[0].text);
          } else if (result.error) {
            reject(new Error(result.error.message || 'API error'));
          } else {
            reject(new Error('Unexpected response'));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.write(requestData);
    req.end();
  });
}

/**
 * GENERIC FALLBACK - Works for ANY practice area
 *
 * These are intentionally generic so they don't make wrong assumptions.
 * Better to say "potential client" than guess wrong with "family member".
 */
const GENERIC_FALLBACK = {
  clientLabel: { singular: 'potential client', plural: 'potential clients' },
  emergencyScenario: 'a legal situation',
  attorneyType: '',
  articleForAttorney: 'an',
  articleForClient: 'a',
  primaryPracticeArea: 'legal services'
};

/**
 * Main entry point - tries AI first, falls back to generic
 */
async function getContentWithFallback(practiceAreas, firmName, city, state) {
  // Try AI first (this is the PRIMARY path)
  const aiContent = await generatePracticeContent(practiceAreas, firmName, city, state);

  if (aiContent) {
    return {
      clientLabel: aiContent.clientLabel.singular,
      clientLabelPlural: aiContent.clientLabel.plural,
      emergencyScenario: aiContent.emergencyScenario,
      attorneyType: aiContent.attorneyType || '',
      articleForAttorney: aiContent.articleForAttorney || 'a',
      articleForClient: aiContent.articleForClient || 'a',
      primaryPracticeArea: aiContent.primaryPracticeArea,
      source: 'ai'
    };
  }

  // Fallback: generic content that works for anything
  console.log(`   📋 Using generic fallback content`);
  return {
    clientLabel: GENERIC_FALLBACK.clientLabel.singular,
    clientLabelPlural: GENERIC_FALLBACK.clientLabel.plural,
    emergencyScenario: GENERIC_FALLBACK.emergencyScenario,
    attorneyType: GENERIC_FALLBACK.attorneyType,
    articleForAttorney: GENERIC_FALLBACK.articleForAttorney,
    articleForClient: GENERIC_FALLBACK.articleForClient,
    primaryPracticeArea: GENERIC_FALLBACK.primaryPracticeArea,
    source: 'fallback'
  };
}

/**
 * Clear cache (for testing)
 */
function clearCache() {
  contentCache.clear();
}

module.exports = {
  generatePracticeContent,
  getContentWithFallback,
  clearCache,
  GENERIC_FALLBACK
};
