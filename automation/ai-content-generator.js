#!/usr/bin/env node
/**
 * AI CONTENT GENERATOR - Smart Practice Area Content Using Claude
 *
 * Generates contextually appropriate content for law firm reports based on
 * practice areas. Uses Claude Haiku for speed with in-memory caching.
 * Falls back to hardcoded mappings if AI fails.
 */

require('dotenv').config();
const https = require('https');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// In-memory cache for generated content (persists for process lifetime)
const contentCache = new Map();

/**
 * Generate practice-area-specific content using AI
 *
 * @param {string[]} practiceAreas - Array of practice areas
 * @param {string} firmName - Name of the firm
 * @param {string} city - City location
 * @param {string} state - State location
 * @returns {Object} Generated content with clientLabel, emergencyScenario, etc.
 */
async function generatePracticeContent(practiceAreas, firmName, city, state) {
  const primaryPractice = (practiceAreas[0] || '').toLowerCase();

  // Check cache first
  const cacheKey = `${primaryPractice}:${city}:${state}`;
  if (contentCache.has(cacheKey)) {
    console.log(`   💾 Using cached AI content for "${primaryPractice}"`);
    return contentCache.get(cacheKey);
  }

  // If no API key, return null (will use fallback)
  if (!ANTHROPIC_API_KEY) {
    console.log(`   ⚠️  ANTHROPIC_API_KEY not set - using fallback content`);
    return null;
  }

  console.log(`   🤖 Generating AI content for "${primaryPractice}"...`);

  const prompt = `You are generating content for a legal marketing report for a ${primaryPractice} law firm in ${city}, ${state}.

Generate contextually appropriate content. Be specific to the practice area - don't use generic terms.

For "${primaryPractice}", determine:

1. **clientLabel**: Who is the typical client? NOT "client" or "person".
   - Estate planning → "individual" or "person planning their estate" (NOT "family member" - that's probate)
   - Divorce → "spouse" or "person going through divorce"
   - Personal injury → "accident victim"
   - Immigration → "immigrant"
   - Criminal → "defendant"
   - Probate → "family member" or "heir"
   - Real estate → "buyer" or "property owner"
   - Business → "business owner"
   - Bankruptcy → "debtor"

2. **emergencyScenario**: What emergency triggers them to call? Be realistic for THIS practice area.
   - Estate planning → "needing to update their will" or "planning for their family's future" (NOT "sudden death" - that's probate)
   - Divorce → "a custody emergency" or "being served divorce papers"
   - Personal injury → "an accident"
   - Criminal → "an arrest"
   - Immigration → "a deportation notice"
   - Probate → "a death in the family"

3. **attorneyType**: How to describe this type of attorney (for "an X attorney").
   - Estate planning → "estate planning"
   - Real estate → "real estate"
   - Family → "family"

4. **startsWithVowel**: Does the attorneyType start with a vowel SOUND?
   - "estate planning" → true (starts with 'e')
   - "immigration" → true (starts with 'i')
   - "family" → false (starts with 'f')
   - "IP" → false (starts with "ai" sound but pronounced "eye-pee")

Return ONLY valid JSON (no markdown, no explanations):
{
  "clientLabel": {
    "singular": "individual",
    "plural": "individuals"
  },
  "emergencyScenario": "needing to update their estate plan",
  "attorneyType": "estate planning",
  "startsWithVowel": true,
  "searchQueryModifier": "wills trusts"
}`;

  try {
    const response = await callAnthropic(prompt, 500);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const content = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (content.clientLabel?.singular && content.emergencyScenario && content.attorneyType) {
        // Cache the result
        contentCache.set(cacheKey, content);
        console.log(`   ✅ AI generated: clientLabel="${content.clientLabel.singular}", scenario="${content.emergencyScenario}"`);
        return content;
      }
    }

    console.log(`   ⚠️  AI returned incomplete content - using fallback`);
    return null;

  } catch (error) {
    console.log(`   ⚠️  AI content generation failed: ${error.message} - using fallback`);
    return null;
  }
}

/**
 * Call Anthropic API with Claude Haiku
 */
function callAnthropic(prompt, maxTokens = 500) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{
        role: 'user',
        content: prompt
      }]
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
          if (result.content && result.content[0] && result.content[0].text) {
            resolve(result.content[0].text);
          } else if (result.error) {
            reject(new Error(`Anthropic API error: ${result.error.message || JSON.stringify(result.error)}`));
          } else {
            reject(new Error(`Unexpected AI response`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse AI response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('AI request timeout'));
    });

    req.write(requestData);
    req.end();
  });
}

/**
 * Hardcoded fallback content (used when AI fails or API key not set)
 */
const FALLBACK_CLIENT_LABELS = {
  'landlord': { singular: 'landlord', plural: 'landlords' },
  'personal injury': { singular: 'accident victim', plural: 'accident victims' },
  'divorce': { singular: 'spouse', plural: 'people going through divorce' },
  'family': { singular: 'parent', plural: 'families' },
  'immigration': { singular: 'immigrant', plural: 'immigrants' },
  'criminal': { singular: 'defendant', plural: 'defendants' },
  'estate': { singular: 'individual', plural: 'individuals' },  // Fixed: was "family member"
  'estate planning': { singular: 'individual', plural: 'individuals' },  // Fixed
  'probate': { singular: 'family member', plural: 'families' },  // Probate IS about family members
  'business': { singular: 'business owner', plural: 'business owners' },
  'bankruptcy': { singular: 'debtor', plural: 'people in debt' },
  'tax': { singular: 'taxpayer', plural: 'taxpayers' },
  'employment': { singular: 'employee', plural: 'employees' },
  'real estate': { singular: 'buyer', plural: 'property buyers' },
  'default': { singular: 'potential client', plural: 'potential clients' }
};

const FALLBACK_EMERGENCY_SCENARIOS = {
  'landlord': 'an eviction emergency',
  'personal injury': 'an accident',
  'divorce': 'a custody emergency',
  'family': 'a family crisis',
  'immigration': 'a deportation notice',
  'criminal': 'an arrest',
  'estate': 'needing to update their estate plan',  // Fixed: was "sudden death"
  'estate planning': 'needing to protect their family\'s future',  // Fixed
  'probate': 'a death in the family',  // Probate IS about death
  'business': 'a business dispute',
  'bankruptcy': 'creditor harassment',
  'tax': 'an IRS notice',
  'employment': 'wrongful termination',
  'real estate': 'a closing deadline',
  'default': 'a legal emergency'
};

const FALLBACK_ATTORNEY_TYPES = {
  'divorce': 'family',
  'family': 'family',
  'tax': 'tax',
  'personal injury': 'personal injury',
  'immigration': 'immigration',
  'criminal': 'criminal defense',
  'estate': 'estate planning',
  'estate planning': 'estate planning',
  'probate': 'probate',
  'business': 'business',
  'bankruptcy': 'bankruptcy',
  'employment': 'employment',
  'real estate': 'real estate',
  'ip': 'IP',
  'landlord': 'landlord',
  'medical malpractice': 'medical malpractice',
  'workers comp': 'workers comp',
  'default': ''
};

/**
 * Get content with AI-first approach and fallback
 *
 * @param {string[]} practiceAreas - Array of practice areas
 * @param {string} firmName - Name of the firm
 * @param {string} city - City location
 * @param {string} state - State location
 * @returns {Object} Content object with clientLabel, emergencyScenario, etc.
 */
async function getContentWithFallback(practiceAreas, firmName, city, state) {
  // Try AI first
  const aiContent = await generatePracticeContent(practiceAreas, firmName, city, state);

  if (aiContent) {
    return {
      clientLabel: aiContent.clientLabel.singular,
      clientLabelPlural: aiContent.clientLabel.plural,
      emergencyScenario: aiContent.emergencyScenario,
      attorneyType: aiContent.attorneyType,
      startsWithVowel: aiContent.startsWithVowel,
      searchQueryModifier: aiContent.searchQueryModifier,
      source: 'ai'
    };
  }

  // Fallback to hardcoded
  const primaryPractice = detectPracticeCategory(practiceAreas[0] || '');

  const clientLabels = FALLBACK_CLIENT_LABELS[primaryPractice] || FALLBACK_CLIENT_LABELS['default'];
  const attorneyType = FALLBACK_ATTORNEY_TYPES[primaryPractice] || FALLBACK_ATTORNEY_TYPES['default'];

  return {
    clientLabel: clientLabels.singular,
    clientLabelPlural: clientLabels.plural,
    emergencyScenario: FALLBACK_EMERGENCY_SCENARIOS[primaryPractice] || FALLBACK_EMERGENCY_SCENARIOS['default'],
    attorneyType: attorneyType,
    startsWithVowel: startsWithVowelSound(attorneyType),
    searchQueryModifier: null,
    source: 'fallback'
  };
}

/**
 * Detect practice area category from raw input
 */
function detectPracticeCategory(raw) {
  if (!raw) return 'default';
  const lower = raw.toLowerCase();

  // More specific matches first
  if (lower.includes('estate planning')) return 'estate planning';
  if (lower.includes('real estate') || lower.includes('property')) return 'real estate';
  if (lower.includes('probate')) return 'probate';
  if (lower.includes('landlord') || lower.includes('eviction') || lower.includes('tenant')) return 'landlord';
  if (lower.includes('divorce') || lower.includes('family')) return 'divorce';
  if (lower.includes('tax')) return 'tax';
  if (lower.includes('injury') || lower.includes('accident')) return 'personal injury';
  if (lower.includes('immigration')) return 'immigration';
  if (lower.includes('criminal') || lower.includes('dui')) return 'criminal';
  if (lower.includes('estate') || lower.includes('trust')) return 'estate';  // Generic estate = estate planning
  if (lower.includes('business') || lower.includes('corporate')) return 'business';
  if (lower.includes('bankruptcy')) return 'bankruptcy';
  if (lower.includes('employment') || lower.includes('labor')) return 'employment';
  if (lower.includes('ip') || lower.includes('patent') || lower.includes('trademark')) return 'ip';
  if (lower.includes('malpractice') || lower.includes('medical')) return 'medical malpractice';
  if (lower.includes('worker') || lower.includes('comp')) return 'workers comp';

  return 'default';
}

/**
 * Detect if a word starts with a vowel sound
 */
function startsWithVowelSound(word) {
  const lower = (word || '').toLowerCase();
  if (/^(uni|use|eu|one|once)/.test(lower)) return false;
  if (/^(honest|hour|heir|honor)/.test(lower)) return true;
  if (/^[aeiou]/.test(lower)) return true;
  return false;
}

/**
 * Clear the content cache (useful for testing)
 */
function clearCache() {
  contentCache.clear();
}

module.exports = {
  generatePracticeContent,
  getContentWithFallback,
  detectPracticeCategory,
  startsWithVowelSound,
  clearCache,
  // Export fallbacks for direct use if needed
  FALLBACK_CLIENT_LABELS,
  FALLBACK_EMERGENCY_SCENARIOS,
  FALLBACK_ATTORNEY_TYPES
};
