#!/usr/bin/env node
/**
 * AI REPORT PERFECTOR
 *
 * Iteratively improves reports until they're 10/10.
 *
 * Process:
 * 1. Look up lead's LinkedIn profile for context
 * 2. Run brutal AI QC on the report WITH lead intelligence
 * 3. If issues found → AI fixes them directly in the HTML
 * 4. Re-run QC until perfect or max iterations reached
 *
 * Usage: node ai-report-perfector.js <research-json> <report-html> [lead-email]
 */

require('dotenv').config();
const fs = require('fs');
const https = require('https');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MAX_ITERATIONS = 3;  // Generator now handles most issues; perfector is safety net
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyD5L9ILVBw3nBg8cI5_a14KmtJhAqLZ9fM';

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY required for AI report perfector');
  process.exit(1);
}

const researchFile = process.argv[2];
const reportFile = process.argv[3];
const leadEmail = process.argv[4];

if (!researchFile || !reportFile) {
  console.error('Usage: node ai-report-perfector.js <research-json> <report-html> [lead-email]');
  process.exit(1);
}

// Load files
let research, reportHtml;
try {
  research = JSON.parse(fs.readFileSync(researchFile, 'utf8'));
  reportHtml = fs.readFileSync(reportFile, 'utf8');
} catch (e) {
  console.error(`Failed to load files: ${e.message}`);
  process.exit(1);
}

/**
 * Call Claude API
 */
async function askAI(prompt, maxTokens = 4000) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
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
      timeout: 120000
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
            reject(new Error(`AI API error: ${result.error.message || JSON.stringify(result.error)}`));
          } else {
            reject(new Error(`Unexpected response: ${data.substring(0, 500)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
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
 * Fetch a URL and return the response body
 */
async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

/**
 * Search Google for LinkedIn profile
 */
async function searchGoogle(query) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=017576662512468239146:omuauf_lfve&q=${encodeURIComponent(query)}&num=5`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.items || []);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

/**
 * Parse LinkedIn profile HTML to extract key info
 */
async function parseLinkedInProfile(html) {
  // Use AI to extract structured data from LinkedIn HTML
  const prompt = `Extract the following information from this LinkedIn profile HTML. Return ONLY valid JSON.

HTML:
${html.substring(0, 30000)}

Return this exact JSON structure (use null for missing fields):
{
  "name": "Full name",
  "title": "Current job title",
  "company": "Current company name",
  "about": "About/summary section text (first 500 chars)",
  "location": "Location if visible"
}`;

  try {
    const response = await askAI(prompt, 1000);
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    return JSON.parse(jsonStr.trim());
  } catch (e) {
    return null;
  }
}

/**
 * Determine seniority level from job title
 */
function determineSeniority(title) {
  if (!title) return { seniority: 'unknown', isDecisionMaker: false };

  const titleLower = title.toLowerCase();

  // Senior decision-makers
  const seniorTitles = [
    'partner', 'managing partner', 'senior partner', 'founding partner',
    'owner', 'founder', 'co-founder', 'principal',
    'ceo', 'chief', 'director', 'president',
    'of counsel', 'shareholder'
  ];

  // Mid-level
  const midTitles = [
    'associate', 'senior associate', 'attorney', 'solicitor',
    'counsel', 'lawyer', 'manager', 'head of'
  ];

  // Junior
  const juniorTitles = [
    'paralegal', 'legal assistant', 'intern', 'trainee',
    'coordinator', 'executive', 'specialist', 'administrator'
  ];

  for (const t of seniorTitles) {
    if (titleLower.includes(t)) {
      return { seniority: 'senior', isDecisionMaker: true };
    }
  }

  for (const t of midTitles) {
    if (titleLower.includes(t)) {
      return { seniority: 'mid', isDecisionMaker: false };
    }
  }

  for (const t of juniorTitles) {
    if (titleLower.includes(t)) {
      return { seniority: 'junior', isDecisionMaker: false };
    }
  }

  // Marketing roles - special case
  if (titleLower.includes('marketing')) {
    if (titleLower.includes('director') || titleLower.includes('head') || titleLower.includes('vp')) {
      return { seniority: 'senior', isDecisionMaker: true };
    }
    return { seniority: 'mid', isDecisionMaker: false };
  }

  return { seniority: 'unknown', isDecisionMaker: false };
}

/**
 * Look up lead's LinkedIn profile
 */
async function lookupLinkedIn(email, firmName) {
  console.log(`\n🔍 LINKEDIN LOOKUP`);
  console.log(`   Email: ${email}`);
  console.log(`   Firm: ${firmName}`);

  const localPart = email.split('@')[0].replace(/[._-]/g, ' ');

  // Skip generic emails
  if (['info', 'contact', 'hello', 'office', 'admin', 'reception', 'enquiries', 'mail'].includes(localPart.toLowerCase().trim())) {
    console.log(`   ⚠️  Generic email address, skipping LinkedIn lookup`);
    return null;
  }

  // Search Google for LinkedIn profile
  const searchQuery = `${localPart} ${firmName} LinkedIn`;
  console.log(`   Searching: "${searchQuery}"`);

  try {
    const searchResults = await searchGoogle(searchQuery);

    // Find LinkedIn URL in results
    const linkedInResult = searchResults.find(r =>
      r.link && r.link.includes('linkedin.com/in/')
    );

    if (!linkedInResult) {
      console.log(`   ⚠️  No LinkedIn profile found in search results`);
      return null;
    }

    console.log(`   Found: ${linkedInResult.link}`);

    // Fetch LinkedIn profile
    const profileHtml = await fetchUrl(linkedInResult.link);

    if (!profileHtml || profileHtml.length < 1000) {
      console.log(`   ⚠️  Could not fetch LinkedIn profile`);
      return null;
    }

    // Parse profile with AI
    const profileData = await parseLinkedInProfile(profileHtml);

    if (!profileData || !profileData.name) {
      console.log(`   ⚠️  Could not parse LinkedIn profile`);
      return null;
    }

    // Determine seniority
    const { seniority, isDecisionMaker } = determineSeniority(profileData.title);

    const result = {
      name: profileData.name,
      title: profileData.title,
      company: profileData.company,
      about: profileData.about,
      location: profileData.location,
      seniority,
      isDecisionMaker,
      source: 'linkedin',
      linkedInUrl: linkedInResult.link
    };

    console.log(`   ✅ Found: ${result.name}, ${result.title}`);
    console.log(`   Seniority: ${seniority}, Decision-maker: ${isDecisionMaker ? 'YES' : 'NO'}`);

    return result;
  } catch (e) {
    console.log(`   ⚠️  LinkedIn lookup failed: ${e.message}`);
    return null;
  }
}

/**
 * Match lead to research data (firm website profiles)
 */
function matchLeadToResearch(email, research) {
  const localPart = email.split('@')[0].toLowerCase().replace(/[._-]/g, ' ');
  const nameParts = localPart.split(' ').filter(p => p.length > 1);

  // Check founding partners
  const partners = research.team?.foundingPartners || [];
  for (const p of partners) {
    if (!p.name) continue;
    const partnerName = p.name.toLowerCase();
    const matchCount = nameParts.filter(part => partnerName.includes(part)).length;
    if (matchCount >= 1 && nameParts.length <= 3) {
      console.log(`   ✅ Matched to founding partner: ${p.name}`);
      return {
        name: p.name,
        title: p.title || 'Founding Partner',
        company: research.firmName,
        about: p.bio || null,
        seniority: 'senior',
        isDecisionMaker: true,
        source: 'firm_website'
      };
    }
  }

  // Check key attorneys
  const attorneys = research.team?.keyAttorneys || [];
  for (const a of attorneys) {
    if (!a.name) continue;
    const attorneyName = a.name.toLowerCase();
    const matchCount = nameParts.filter(part => attorneyName.includes(part)).length;
    if (matchCount >= 1 && nameParts.length <= 3) {
      console.log(`   ✅ Matched to attorney: ${a.name}`);
      const { seniority, isDecisionMaker } = determineSeniority(a.title);
      return {
        name: a.name,
        title: a.title || 'Attorney',
        company: research.firmName,
        about: a.bio || null,
        seniority,
        isDecisionMaker,
        source: 'firm_website'
      };
    }
  }

  // Check key decision makers
  const decisionMakers = research.intelligence?.keyDecisionMakers || [];
  for (const dm of decisionMakers) {
    if (!dm.name) continue;
    const dmName = dm.name.toLowerCase();
    const matchCount = nameParts.filter(part => dmName.includes(part)).length;
    if (matchCount >= 1 && nameParts.length <= 3) {
      console.log(`   ✅ Matched to decision maker: ${dm.name}`);
      return {
        name: dm.name,
        title: dm.title || dm.role || 'Decision Maker',
        company: research.firmName,
        about: null,
        seniority: 'senior',
        isDecisionMaker: true,
        source: 'firm_website'
      };
    }
  }

  return null;
}

/**
 * Infer lead info from email address
 */
function inferFromEmail(email) {
  const localPart = email.split('@')[0].toLowerCase();

  // Partner/senior patterns
  if (localPart.includes('partner') || localPart.includes('managing') ||
      localPart.includes('founder') || localPart.includes('owner')) {
    return {
      name: null,
      title: 'Partner (inferred)',
      seniority: 'senior',
      isDecisionMaker: true,
      source: 'email_inference'
    };
  }

  // Generic patterns - unknown
  if (['info', 'contact', 'hello', 'office', 'admin', 'reception', 'enquiries', 'mail'].includes(localPart)) {
    return {
      name: null,
      title: null,
      seniority: 'unknown',
      isDecisionMaker: false,
      source: 'email_inference',
      isGenericEmail: true
    };
  }

  // Personal email format (john.smith@) - likely professional
  if (localPart.includes('.') || localPart.includes('_')) {
    const nameParts = localPart.replace(/[._-]/g, ' ').split(' ');
    const possibleName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    return {
      name: possibleName,
      title: null,
      seniority: 'unknown',
      isDecisionMaker: false,
      source: 'email_inference'
    };
  }

  return {
    name: null,
    title: null,
    seniority: 'unknown',
    isDecisionMaker: false,
    source: 'email_inference'
  };
}

/**
 * Get lead intelligence using all available sources
 */
async function getLeadIntelligence(email, firmName, research) {
  if (!email) {
    console.log(`\n⚠️  No lead email provided, skipping intelligence lookup`);
    return null;
  }

  console.log('\n' + '─'.repeat(50));
  console.log('👤 LEAD INTELLIGENCE LOOKUP');
  console.log('─'.repeat(50));

  // Strategy 1: Try LinkedIn
  const linkedin = await lookupLinkedIn(email, firmName);
  if (linkedin && linkedin.name) {
    return linkedin;
  }

  // Strategy 2: Match to firm website data
  console.log(`\n🔍 FIRM WEBSITE MATCH`);
  console.log(`   Checking research data for matching profiles...`);
  const websiteMatch = matchLeadToResearch(email, research);
  if (websiteMatch) {
    return websiteMatch;
  }
  console.log(`   ⚠️  No match found in firm website data`);

  // Strategy 3: Infer from email
  console.log(`\n🔍 EMAIL INFERENCE`);
  const inference = inferFromEmail(email);
  console.log(`   Inferred: seniority=${inference.seniority}, decision-maker=${inference.isDecisionMaker ? 'YES' : 'NO'}`);
  return inference;
}

/**
 * Extract visible text from HTML
 */
function extractText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pre-fix common phrasing issues with direct string replacement
 * This catches verbose client labels before AI QC runs, making fixes more reliable
 */
function preFixCommonIssues(html) {
  let fixedHtml = html;
  let fixCount = 0;

  // Common verbose client label patterns → concise replacements
  const phraseFixes = [
    // Divorce-related verbose phrases
    { pattern: /individual going through a divorce/gi, replacement: 'divorcing client' },
    { pattern: /individual going through divorce/gi, replacement: 'divorcing client' },
    { pattern: /person going through a divorce/gi, replacement: 'divorcing client' },
    { pattern: /person going through divorce/gi, replacement: 'divorcing client' },
    { pattern: /someone going through a divorce/gi, replacement: 'divorcing client' },
    { pattern: /someone going through divorce/gi, replacement: 'divorcing client' },
    { pattern: /people going through a divorce/gi, replacement: 'divorcing clients' },
    { pattern: /people going through divorce/gi, replacement: 'divorcing clients' },
    { pattern: /individuals going through divorce/gi, replacement: 'divorcing clients' },

    // Family law verbose phrases
    { pattern: /individual dealing with a family matter/gi, replacement: 'family law client' },
    { pattern: /person dealing with a family matter/gi, replacement: 'family law client' },
    { pattern: /individual facing a family issue/gi, replacement: 'family law client' },

    // Estate planning verbose phrases
    { pattern: /family member dealing with estate/gi, replacement: 'someone planning their estate' },
    { pattern: /individual planning their estate/gi, replacement: 'estate planning client' },
    { pattern: /person planning their estate/gi, replacement: 'estate planning client' },

    // Immigration verbose phrases
    { pattern: /individual facing immigration issues/gi, replacement: 'immigration client' },
    { pattern: /person facing immigration issues/gi, replacement: 'immigration client' },
    { pattern: /individual dealing with immigration/gi, replacement: 'immigration client' },

    // Personal injury verbose phrases
    { pattern: /individual injured in an accident/gi, replacement: 'accident victim' },
    { pattern: /person injured in an accident/gi, replacement: 'accident victim' },
    { pattern: /individual who was injured/gi, replacement: 'accident victim' },

    // Generic "individual/person planning ahead" labels (common AI output for estate/general practice)
    { pattern: /individual planning ahead/gi, replacement: 'potential client' },
    { pattern: /individuals planning ahead/gi, replacement: 'potential clients' },
    { pattern: /person planning ahead/gi, replacement: 'potential client' },
    { pattern: /people planning ahead/gi, replacement: 'potential clients' },
    { pattern: /someone planning ahead/gi, replacement: 'potential client' },

    // General verbose phrases
    { pattern: /individual with a legal problem/gi, replacement: 'potential client' },
    { pattern: /person with a legal problem/gi, replacement: 'potential client' },
    { pattern: /individual seeking legal help/gi, replacement: 'potential client' },
    { pattern: /person seeking legal help/gi, replacement: 'potential client' },

    // Catch-all: "an individual" / "a individual" in client context → "a potential client"
    { pattern: /\ban individual\b/gi, replacement: 'a potential client' },
    { pattern: /\ba individual\b/gi, replacement: 'a potential client' }
  ];

  for (const fix of phraseFixes) {
    const beforeLength = fixedHtml.length;
    fixedHtml = fixedHtml.replace(fix.pattern, fix.replacement);
    if (fixedHtml.length !== beforeLength || fix.pattern.test(html)) {
      // Check if we actually made replacements
      const matches = html.match(fix.pattern);
      if (matches) {
        fixCount += matches.length;
      }
    }
  }

  if (fixCount > 0) {
    console.log(`   ✅ Pre-fixed ${fixCount} verbose phrase(s)`);
  }

  return fixedHtml;
}

/**
 * BRUTAL AI QC - Find every issue that would make a lead not book
 */
async function brutalQC(html, research, iteration, leadIntel = null) {
  console.log(`\n🔍 BRUTAL QC - Iteration ${iteration}`);

  const firmName = research.firmName || 'Unknown';
  const city = research.location?.city || '';
  const state = research.location?.state || '';
  const country = research.location?.country || '';
  const practiceAreas = research.practiceAreas || [];
  const competitors = research.competitors || [];

  const location = [city, state, country].filter(Boolean).join(', ');
  const isUK = country && (
    country.toLowerCase().includes('uk') ||
    country.toLowerCase().includes('united kingdom') ||
    country.toLowerCase().includes('england') ||
    country.toLowerCase().includes('gb')
  );

  const expectedCurrency = isUK ? '£' : '$';
  const expectedTerminology = isUK ? 'solicitor' : 'attorney';

  const reportText = extractText(html).substring(0, 25000);

  // Build lead context section if we have intelligence
  let leadContextSection = '';
  if (leadIntel && (leadIntel.name || leadIntel.title || leadIntel.seniority !== 'unknown')) {
    leadContextSection = `
LEAD CONTEXT (from ${leadIntel.source || 'lookup'}):
- Name: ${leadIntel.name || 'Unknown'}
- Title: ${leadIntel.title || 'Unknown'}
- Company: ${leadIntel.company || firmName}
- About: ${leadIntel.about ? leadIntel.about.substring(0, 300) + '...' : 'Not available'}
- Seniority: ${leadIntel.seniority || 'unknown'}
- Is Decision-Maker: ${leadIntel.isDecisionMaker ? 'YES' : 'NO/UNKNOWN'}
${leadIntel.linkedInUrl ? `- LinkedIn: ${leadIntel.linkedInUrl}` : ''}

CRITICAL PERSONALIZATION CHECK:
Based on this lead's profile, consider:
- A senior partner/owner cares about ROI, business outcomes, and credibility
- A marketing manager/director cares about tactics, metrics, and implementation
- An associate may not have buying authority - flag if this is the case
- Tone should match their seniority: senior = more strategic, junior = more tactical

`;
  }

  const prompt = `You are a BRUTAL quality control reviewer. Your job is to find EVERY issue that would make a law firm partner ignore this marketing report.

IMPORTANT — DATE CONTEXT:
Today is ${new Date().toISOString().split('T')[0]}. The current year is ${new Date().getFullYear()}. Reports dated "${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}" are CURRENT and correctly dated. Do NOT flag any ${new Date().getFullYear()} dates as future-dated or incorrect.
${leadContextSection}

CONTEXT:
- Firm: ${firmName}
- Location: ${location}
- Country: ${country || 'Assume US if unknown'}
- Practice areas: ${practiceAreas.join(', ')}
- Competitors in report: ${competitors.map(c => typeof c === 'object' ? c.name : c).slice(0, 5).join(', ')}
- Expected currency: ${expectedCurrency}
- Expected terminology: ${expectedTerminology}

IMPORTANT — DO NOT FLAG THESE AS ISSUES:
1. SEARCH VOLUMES: Numbers are already adjusted for market size. Small towns (50-200 searches) and UK markets (~30% of US) will have low numbers. This is CORRECT. Do NOT flag low search volumes or audience sizes.
2. COMPETITOR NAMES: These are REAL businesses from Google Places API. Their names may look unusual — do NOT flag real competitor names as fabricated or US-centric. Only flag if a competitor is clearly from the wrong city/country.
3. OPPORTUNITY ESTIMATES: Ranges like £500-1K or £1K-1.5K for small markets are reasonable and already adjusted. Do NOT flag these as unrealistic.

REPORT TEXT:
${reportText}

BE BRUTAL. Check for:

1. **GEOGRAPHIC MISMATCH** (CRITICAL)
   - US firms (LLC, PLLC, P.C., US cities) showing for UK lead = FAIL
   - UK firms (Ltd, LLP, Solicitors) showing for US lead = FAIL
   - Competitors from wrong city/region

2. **CURRENCY MISMATCH** (CRITICAL)
   - UK reports MUST use £, US reports use $
   - Check ALL money amounts, formulas, ranges

3. **TERMINOLOGY MISMATCH** (CRITICAL)
   - UK: "solicitor", "barrister", "practice"
   - US: "attorney", "lawyer", "firm"
   - Wrong terminology = unprofessional

4. **AWKWARD PHRASING** (IMPORTANT)
   - "individual going through a divorce" → should be "divorcing client"
   - "family member dealing with estate" → should be "someone planning their estate"
   - Generic robotic language
   - Grammar issues (a/an errors)

5. **BROKEN CONTENT** (CRITICAL)
   - Empty sections, "undefined", "null", "NaN"
   - Trailing punctuation with nothing after
   - Zero values that shouldn't be zero
   - Missing location in hero section

6. **CREDIBILITY KILLERS** (IMPORTANT)
   - Claims too good to be true
   - Missing context/caveats
   - Anything a sophisticated partner would question

7. **WOULD THEY BOOK?** (THE REAL TEST)
   - Is this compelling enough for a busy partner to take 15 minutes?
   - What's the ONE thing that would make them close the tab?

8. **LEAD-SPECIFIC FIT** (IF LEAD CONTEXT PROVIDED)
   - Does the tone match this person's seniority?
   - Would THIS specific person find value in this report?
   - If they're NOT a decision-maker, note this as a concern
   - Senior partners want strategic outcomes, not tactical details
   - Marketing people want metrics and implementation specifics

Return ONLY valid JSON:
{
  "score": 1-10,
  "wouldBook": true/false,
  "issues": [
    {
      "severity": "CRITICAL|IMPORTANT|MINOR",
      "category": "GEOGRAPHIC|CURRENCY|TERMINOLOGY|PHRASING|BROKEN|CREDIBILITY|PERSONALIZATION",
      "issue": "Clear description of the problem",
      "currentText": "The exact text that's wrong (quote from report)",
      "fixedText": "What it should say instead",
      "location": "Where in the report (hero, gap1, competitor section, etc.)"
    }
  ],
  "biggestProblem": "The ONE thing that would make them not book",
  "verdict": "One sentence summary",
  "leadFit": {
    "wouldThisPersonBook": true/false,
    "concern": "Any concern about this specific lead (e.g., 'Not a decision-maker', 'Junior role')",
    "toneMatch": "Does the report tone match their seniority? (good/needs adjustment)"
  }
}

If score is 10 and wouldBook is true, issues array can be empty.
Be specific with currentText and fixedText so fixes can be applied automatically.`;

  try {
    const response = await askAI(prompt, 4000);

    // Parse JSON from response
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const qcResult = JSON.parse(jsonStr.trim());

    console.log(`   Score: ${qcResult.score}/10`);
    console.log(`   Would book: ${qcResult.wouldBook ? '✅ YES' : '❌ NO'}`);
    console.log(`   Issues found: ${qcResult.issues?.length || 0}`);

    if (qcResult.biggestProblem) {
      console.log(`   Biggest problem: ${qcResult.biggestProblem}`);
    }

    return qcResult;
  } catch (e) {
    console.error(`   ❌ QC failed: ${e.message}`);
    return { score: 0, wouldBook: false, issues: [], error: e.message };
  }
}

/**
 * AI FIX - Apply fixes to the HTML based on QC findings
 */
async function applyFixes(html, qcResult, research) {
  if (!qcResult.issues || qcResult.issues.length === 0) {
    console.log('   No fixes needed');
    return html;
  }

  console.log(`\n🔧 APPLYING FIXES (${qcResult.issues.length} issues)`);

  const firmName = research.firmName || 'Unknown';
  const country = research.location?.country || '';
  const isUK = country && (
    country.toLowerCase().includes('uk') ||
    country.toLowerCase().includes('united kingdom') ||
    country.toLowerCase().includes('england') ||
    country.toLowerCase().includes('gb')
  );

  // Build fix instructions
  const fixInstructions = qcResult.issues.map((issue, i) =>
    `${i + 1}. [${issue.severity}] ${issue.category}: ${issue.issue}
   Current: "${issue.currentText || 'N/A'}"
   Fix to: "${issue.fixedText || 'N/A'}"
   Location: ${issue.location || 'unknown'}`
  ).join('\n\n');

  const prompt = `You are an expert at fixing HTML marketing reports. Apply these fixes to the report.

FIRM CONTEXT:
- Firm: ${firmName}
- Country: ${country || 'US'}
- Is UK: ${isUK}
- Currency: ${isUK ? '£' : '$'}
- Terminology: ${isUK ? 'solicitor/solicitors' : 'attorney/attorneys'}

FIXES TO APPLY:
${fixInstructions}

RULES:
1. Make ONLY the specified fixes - don't change anything else
2. For currency: Replace ALL $ with £ for UK firms (in text, not in code/URLs)
3. For terminology: Replace "attorney" with "solicitor", "attorneys" with "solicitors" for UK
4. For phrasing: Use the exact fixedText provided
5. For broken content: Remove or fix as specified
6. Preserve all HTML structure, classes, and styling
7. Don't add new content - only fix what's broken

CURRENT HTML:
${html}

Return ONLY the fixed HTML. No explanations, no markdown code blocks, just the raw HTML starting with <!DOCTYPE html>.`;

  try {
    const fixedHtml = await askAI(prompt, 60000);

    // Validate we got HTML back
    if (!fixedHtml.includes('<!DOCTYPE html>') && !fixedHtml.includes('<html')) {
      console.log('   ⚠️  AI response doesn\'t look like HTML, keeping original');
      return html;
    }

    // Clean up any markdown code blocks if present
    let cleanHtml = fixedHtml;
    if (cleanHtml.includes('```html')) {
      cleanHtml = cleanHtml.replace(/```html\s*/g, '').replace(/```\s*$/g, '');
    }
    if (cleanHtml.includes('```')) {
      cleanHtml = cleanHtml.replace(/```\s*/g, '');
    }

    console.log(`   ✅ Applied ${qcResult.issues.length} fixes`);
    return cleanHtml.trim();
  } catch (e) {
    console.error(`   ❌ Fix application failed: ${e.message}`);
    return html;
  }
}

/**
 * Main perfection loop
 */
async function perfectReport() {
  console.log('\n' + '═'.repeat(60));
  console.log('🎯 AI REPORT PERFECTOR');
  console.log('═'.repeat(60));
  console.log(`Firm: ${research.firmName}`);
  console.log(`Location: ${research.location?.city}, ${research.location?.country || 'US'}`);
  console.log(`Lead email: ${leadEmail || 'Not provided'}`);
  console.log(`Max iterations: ${MAX_ITERATIONS}`);

  // Look up lead intelligence if email provided
  let leadIntel = null;
  if (leadEmail) {
    leadIntel = await getLeadIntelligence(leadEmail, research.firmName, research);
  }

  // Log lead summary
  if (leadIntel) {
    console.log('\n' + '─'.repeat(50));
    console.log('👤 LEAD INTELLIGENCE SUMMARY');
    console.log('─'.repeat(50));
    console.log(`   Name: ${leadIntel.name || 'Unknown'}`);
    console.log(`   Title: ${leadIntel.title || 'Unknown'}`);
    console.log(`   Seniority: ${leadIntel.seniority}`);
    console.log(`   Decision-maker: ${leadIntel.isDecisionMaker ? 'YES ✅' : 'NO/UNKNOWN ⚠️'}`);
    console.log(`   Source: ${leadIntel.source}`);
  }

  let currentHtml = reportHtml;
  let iteration = 0;
  let finalResult = null;

  // Pre-pass: Fix common verbose phrasing issues with direct string replacement
  // This is more reliable than asking AI to rewrite entire HTML
  console.log('\n🔧 PRE-PASS: Fixing common phrasing issues...');
  currentHtml = preFixCommonIssues(currentHtml);

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    // Run brutal QC with lead context
    const qcResult = await brutalQC(currentHtml, research, iteration, leadIntel);
    finalResult = qcResult;

    // Check if we're done
    if (qcResult.score >= 9 && qcResult.wouldBook) {
      console.log(`\n✅ PERFECT! Score: ${qcResult.score}/10`);
      break;
    }

    // Check if we have fixable issues
    if (!qcResult.issues || qcResult.issues.length === 0) {
      console.log(`\n⚠️  No specific fixes identified despite low score`);
      break;
    }

    // Apply fixes
    const fixedHtml = await applyFixes(currentHtml, qcResult, research);

    // Check if anything changed
    if (fixedHtml === currentHtml) {
      console.log(`\n⚠️  No changes made, stopping iteration`);
      break;
    }

    currentHtml = fixedHtml;
    console.log(`   Iteration ${iteration} complete, re-checking...`);
  }

  // Save the perfected report
  fs.writeFileSync(reportFile, currentHtml);
  console.log(`\n💾 Saved perfected report: ${reportFile}`);

  // Save QC result
  const qcResultFile = reportFile.replace('.html', '-qc.json');
  fs.writeFileSync(qcResultFile, JSON.stringify({
    iterations: iteration,
    finalScore: finalResult?.score || 0,
    wouldBook: finalResult?.wouldBook || false,
    verdict: finalResult?.verdict || 'Unknown',
    biggestProblem: finalResult?.biggestProblem || null,
    remainingIssues: finalResult?.issues?.length || 0,
    leadIntelligence: leadIntel ? {
      name: leadIntel.name,
      title: leadIntel.title,
      seniority: leadIntel.seniority,
      isDecisionMaker: leadIntel.isDecisionMaker,
      source: leadIntel.source
    } : null,
    leadFit: finalResult?.leadFit || null
  }, null, 2));

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL RESULT');
  console.log('═'.repeat(60));
  console.log(`Iterations: ${iteration}`);
  console.log(`Final score: ${finalResult?.score || 0}/10`);
  console.log(`Would book: ${finalResult?.wouldBook ? '✅ YES' : '❌ NO'}`);
  console.log(`Verdict: ${finalResult?.verdict || 'Unknown'}`);
  if (finalResult?.biggestProblem) {
    console.log(`Remaining issue: ${finalResult.biggestProblem}`);
  }
  if (leadIntel) {
    console.log('─'.repeat(40));
    console.log(`Lead: ${leadIntel.name || 'Unknown'} (${leadIntel.title || 'Unknown title'})`);
    console.log(`Decision-maker: ${leadIntel.isDecisionMaker ? '✅ YES' : '⚠️ NO/UNKNOWN'}`);
    if (finalResult?.leadFit?.concern) {
      console.log(`Lead concern: ${finalResult.leadFit.concern}`);
    }
  }
  console.log('═'.repeat(60) + '\n');

  // Exit code based on result
  const passed = finalResult?.score >= 8 && finalResult?.wouldBook;

  // Write result for workflow
  fs.writeFileSync('qc-result.json', JSON.stringify({
    status: passed ? 'PASSED' : 'FAILED',
    firmName: research.firmName,
    iterations: iteration,
    score: finalResult?.score || 0,
    wouldBook: finalResult?.wouldBook || false,
    biggestIssue: finalResult?.biggestProblem || null,
    qualityIssues: finalResult?.issues?.length || 0,
    recommendation: passed
      ? 'Report perfected and ready to send.'
      : `Report needs manual review. ${finalResult?.verdict || ''}`,
    leadIntelligence: leadIntel ? {
      name: leadIntel.name,
      title: leadIntel.title,
      company: leadIntel.company,
      seniority: leadIntel.seniority,
      isDecisionMaker: leadIntel.isDecisionMaker,
      source: leadIntel.source,
      linkedInUrl: leadIntel.linkedInUrl
    } : null,
    leadFit: finalResult?.leadFit || null
  }, null, 2));

  process.exit(passed ? 0 : 1);
}

// Run
perfectReport().catch(e => {
  console.error(`\n❌ Perfector failed: ${e.message}`);
  process.exit(1);
});
