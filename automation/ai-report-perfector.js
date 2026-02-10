#!/usr/bin/env node
/**
 * AI REPORT PERFECTOR - Comprehensive QC
 *
 * 8-step pipeline: deterministic checks + AI review.
 * Catches anything that would make a law firm partner think "automated garbage."
 *
 * Deterministic checks (1-23):
 * 1. Broken content (undefined, null, NaN, [object Object])
 * 2. Currency match (£ for UK, $ for US)
 * 3. Terminology match (solicitor vs attorney, excluding business names)
 * 4. Firm name present
 * 5. A/an article errors
 * 6. US corporate suffixes in UK reports
 * 7. Empty prose sections
 * 8. Total opportunity is compelling (>= $100K US / £70K UK)
 * 9. No revenue card is embarrassingly small (>= $5K US / £3K UK)
 * 10. SERP mockup competitors
 * 11. Report is personalized (firm name 3x, city 2x, specific practice area)
 * 12. All sections have real content
 * 13. Math adds up (card sum ≈ ROI total)
 * 14. Overall "would you book?" flag
 * 15. Contact name quality (single word, generic names)
 * 16. City name validation (newlines, HTML, > 40 chars, > 4 words)
 * 17. Country/city consistency (Toronto with US, Canadian provinces)
 * 18. Firm name sanity (scraped headlines, > 6 words)
 * 19. Competitor self-reference (target firm in own list)
 * 20. Competitor name quality (> 60 chars, placeholders)
 * 21. Ad spend ratio sanity ($0 or > 20% of total)
 * 22. Fabricated statistics (unreferenced percentages in prose)
 * 23. Fallback prose detection (template fingerprint phrases)
 *
 * AI-powered (Haiku 3.5, ~$0.003/report):
 * - Contact name fix: matches email to team members
 * - Comprehensive AI review: 12 issue categories (replaces old 5-category sanity check)
 * - Auto-fixes: WRONG_NAME, BROKEN_SENTENCE, FABRICATED_STAT, WRONG_COUNTRY
 *
 * Pipeline:
 * Step 1: Fix contact name (deterministic)
 * Step 2: Pre-fix verbose phrases
 * Step 3: Validate research data
 * Step 4: Deterministic QC (checks 1-23)
 * Step 5: Comprehensive AI review (Haiku 3.5)
 * Step 6: Apply auto-fixes
 * Step 7: Re-run deterministic QC if fixes applied
 * Step 8: Save results
 *
 * Usage: node ai-report-perfector.js <research-json> <report-html> [lead-email]
 */

require('dotenv').config();
const fs = require('fs');
const https = require('https');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyD5L9ILLVBw3nBg8cI5_a14KmtJhAqLZ9fM';

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

// ============================================================================
// LEAD INTELLIGENCE (kept from original - LinkedIn + firm website match)
// ============================================================================

async function askAI(prompt, maxTokens = 4000) {
  return new Promise((resolve, reject) => {
    if (!ANTHROPIC_API_KEY) {
      reject(new Error('No ANTHROPIC_API_KEY'));
      return;
    }
    const requestData = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
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
      timeout: 120000
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
    req.on('timeout', () => { req.destroy(); reject(new Error('AI request timeout')); });
    req.write(requestData);
    req.end();
  });
}

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname, port: 443,
      path: urlObj.pathname + urlObj.search, method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

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
        } catch (e) { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

async function parseLinkedInProfile(html) {
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
  } catch (e) { return null; }
}

function determineSeniority(title) {
  if (!title) return { seniority: 'unknown', isDecisionMaker: false };
  const titleLower = title.toLowerCase();
  const seniorTitles = ['partner', 'managing partner', 'senior partner', 'founding partner',
    'owner', 'founder', 'co-founder', 'principal', 'ceo', 'chief', 'director', 'president',
    'of counsel', 'shareholder'];
  const midTitles = ['associate', 'senior associate', 'attorney', 'solicitor',
    'counsel', 'lawyer', 'manager', 'head of'];
  const juniorTitles = ['paralegal', 'legal assistant', 'intern', 'trainee',
    'coordinator', 'executive', 'specialist', 'administrator'];
  for (const t of seniorTitles) { if (titleLower.includes(t)) return { seniority: 'senior', isDecisionMaker: true }; }
  for (const t of midTitles) { if (titleLower.includes(t)) return { seniority: 'mid', isDecisionMaker: false }; }
  for (const t of juniorTitles) { if (titleLower.includes(t)) return { seniority: 'junior', isDecisionMaker: false }; }
  if (titleLower.includes('marketing')) {
    if (titleLower.includes('director') || titleLower.includes('head') || titleLower.includes('vp'))
      return { seniority: 'senior', isDecisionMaker: true };
    return { seniority: 'mid', isDecisionMaker: false };
  }
  return { seniority: 'unknown', isDecisionMaker: false };
}

async function lookupLinkedIn(email, firmName) {
  console.log(`\n🔍 LINKEDIN LOOKUP`);
  console.log(`   Email: ${email}`);
  console.log(`   Firm: ${firmName}`);
  const localPart = email.split('@')[0].replace(/[._-]/g, ' ');
  if (['info', 'contact', 'hello', 'office', 'admin', 'reception', 'enquiries', 'mail'].includes(localPart.toLowerCase().trim())) {
    console.log(`   ⚠️  Generic email address, skipping LinkedIn lookup`);
    return null;
  }
  const searchQuery = `${localPart} ${firmName} LinkedIn`;
  console.log(`   Searching: "${searchQuery}"`);
  try {
    const searchResults = await searchGoogle(searchQuery);
    const linkedInResult = searchResults.find(r => r.link && r.link.includes('linkedin.com/in/'));
    if (!linkedInResult) { console.log(`   ⚠️  No LinkedIn profile found`); return null; }
    console.log(`   Found: ${linkedInResult.link}`);
    const profileHtml = await fetchUrl(linkedInResult.link);
    if (!profileHtml || profileHtml.length < 1000) { console.log(`   ⚠️  Could not fetch profile`); return null; }
    const profileData = await parseLinkedInProfile(profileHtml);
    if (!profileData || !profileData.name) { console.log(`   ⚠️  Could not parse profile`); return null; }
    const { seniority, isDecisionMaker } = determineSeniority(profileData.title);
    const result = {
      name: profileData.name, title: profileData.title, company: profileData.company,
      about: profileData.about, location: profileData.location,
      seniority, isDecisionMaker, source: 'linkedin', linkedInUrl: linkedInResult.link
    };
    console.log(`   ✅ Found: ${result.name}, ${result.title}`);
    return result;
  } catch (e) { console.log(`   ⚠️  LinkedIn lookup failed: ${e.message}`); return null; }
}

function matchLeadToResearch(email, research) {
  const localPart = email.split('@')[0].toLowerCase().replace(/[._-]/g, ' ');
  const nameParts = localPart.split(' ').filter(p => p.length > 1);
  for (const p of (research.team?.foundingPartners || [])) {
    if (!p.name) continue;
    const matchCount = nameParts.filter(part => p.name.toLowerCase().includes(part)).length;
    if (matchCount >= 1 && nameParts.length <= 3) {
      console.log(`   ✅ Matched to founding partner: ${p.name}`);
      return { name: p.name, title: p.title || 'Founding Partner', company: research.firmName,
        about: p.bio || null, seniority: 'senior', isDecisionMaker: true, source: 'firm_website' };
    }
  }
  for (const a of (research.team?.keyAttorneys || [])) {
    if (!a.name) continue;
    const matchCount = nameParts.filter(part => a.name.toLowerCase().includes(part)).length;
    if (matchCount >= 1 && nameParts.length <= 3) {
      console.log(`   ✅ Matched to attorney: ${a.name}`);
      const { seniority, isDecisionMaker } = determineSeniority(a.title);
      return { name: a.name, title: a.title || 'Attorney', company: research.firmName,
        about: a.bio || null, seniority, isDecisionMaker, source: 'firm_website' };
    }
  }
  for (const dm of (research.intelligence?.keyDecisionMakers || [])) {
    if (!dm.name) continue;
    const matchCount = nameParts.filter(part => dm.name.toLowerCase().includes(part)).length;
    if (matchCount >= 1 && nameParts.length <= 3) {
      console.log(`   ✅ Matched to decision maker: ${dm.name}`);
      return { name: dm.name, title: dm.title || dm.role || 'Decision Maker', company: research.firmName,
        about: null, seniority: 'senior', isDecisionMaker: true, source: 'firm_website' };
    }
  }
  return null;
}

function inferFromEmail(email) {
  const localPart = email.split('@')[0].toLowerCase();
  if (localPart.includes('partner') || localPart.includes('managing') ||
      localPart.includes('founder') || localPart.includes('owner'))
    return { name: null, title: 'Partner (inferred)', seniority: 'senior', isDecisionMaker: true, source: 'email_inference' };
  if (['info', 'contact', 'hello', 'office', 'admin', 'reception', 'enquiries', 'mail'].includes(localPart))
    return { name: null, title: null, seniority: 'unknown', isDecisionMaker: false, source: 'email_inference', isGenericEmail: true };
  if (localPart.includes('.') || localPart.includes('_')) {
    const nameParts = localPart.replace(/[._-]/g, ' ').split(' ');
    const possibleName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    return { name: possibleName, title: null, seniority: 'unknown', isDecisionMaker: false, source: 'email_inference' };
  }
  return { name: null, title: null, seniority: 'unknown', isDecisionMaker: false, source: 'email_inference' };
}

async function getLeadIntelligence(email, firmName, research) {
  if (!email) { console.log(`\n⚠️  No lead email provided, skipping intelligence lookup`); return null; }
  console.log('\n' + '─'.repeat(50));
  console.log('👤 LEAD INTELLIGENCE LOOKUP');
  console.log('─'.repeat(50));

  const linkedin = await lookupLinkedIn(email, firmName);
  if (linkedin && linkedin.name) return linkedin;

  console.log(`\n🔍 FIRM WEBSITE MATCH`);
  const websiteMatch = matchLeadToResearch(email, research);
  if (websiteMatch) return websiteMatch;
  console.log(`   ⚠️  No match found in firm website data`);

  console.log(`\n🔍 EMAIL INFERENCE`);
  const inference = inferFromEmail(email);
  console.log(`   Inferred: seniority=${inference.seniority}, decision-maker=${inference.isDecisionMaker ? 'YES' : 'NO'}`);
  return inference;
}

// ============================================================================
// CONTACT NAME VALIDATION & FIX
// ============================================================================

function getTeamMembers(research) {
  const members = [];
  (research.team?.foundingPartners || []).forEach(p => p?.name && members.push(p.name));
  if (research.team?.leadership?.name) members.push(research.team.leadership.name);
  (research.team?.keyAttorneys || []).forEach(a => a?.name && members.push(a.name));
  (research.intelligence?.keyDecisionMakers || []).forEach(d => d?.name && members.push(d.name));
  return members;
}

function matchEmailToTeamMember(email, teamMembers) {
  if (!email || !teamMembers.length) return null;
  const localPart = email.split('@')[0].toLowerCase();

  for (const name of teamMembers) {
    const parts = name.replace(/[.-]/g, ' ').split(/\s+/).filter(Boolean);
    // Initials match: 'cmec' matches 'Christopher M. Eddison-Cogan'
    const initials = parts.map(p => p[0].toLowerCase()).join('');
    if (initials === localPart) return name;
    // First initial + last name: 'dcorrigan' matches 'David Corrigan'
    if (parts.length >= 2) {
      const firstInitialLast = (parts[0][0] + parts[parts.length - 1]).toLowerCase();
      if (firstInitialLast === localPart) return name;
    }
    // First name match: 'david' matches 'David Corrigan'
    if (parts.length >= 1 && parts[0].toLowerCase() === localPart) return name;
    // Last name match in local part: 'corrigan' in 'dcorrigan'
    if (parts.length >= 2) {
      const lastName = parts[parts.length - 1].toLowerCase();
      if (localPart.includes(lastName) && lastName.length >= 4) return name;
    }
  }
  return null;
}

function fixContactName(html, research, leadEmail) {
  // Extract current prospect name from "Prepared for X at Y"
  const preparedMatch = html.match(/Prepared for ([^·]+?) at /);
  if (!preparedMatch) return { html, fixed: false };

  const currentName = preparedMatch[1].trim();
  const teamMembers = getTeamMembers(research);

  console.log(`\n👤 CONTACT NAME CHECK`);
  console.log(`   Current: "${currentName}"`);
  console.log(`   Team members found: ${teamMembers.length}`);
  if (teamMembers.length > 0) console.log(`   Team: ${teamMembers.join(', ')}`);

  // Check if current name is problematic
  const isSingleWord = !currentName.includes(' ');
  const isGeneric = ['Partner', 'there', 'Your Firm', 'Hiring Partner', 'Unknown'].includes(currentName);
  const isIncomplete = isSingleWord && !isGeneric;

  if (!isSingleWord && !isGeneric) {
    // Check if current full name matches a team member (case-insensitive)
    const currentLower = currentName.toLowerCase();
    const exactMatch = teamMembers.find(m => m.toLowerCase() === currentLower);
    if (exactMatch) {
      console.log(`   ✅ Name matches team member: "${exactMatch}"`);
      return { html, fixed: false };
    }
    // Check if current name's last name matches any team member's last name
    const currentParts = currentName.split(/\s+/);
    const currentLast = currentParts[currentParts.length - 1].toLowerCase();
    const lastNameMatch = teamMembers.find(m => {
      const mParts = m.split(/\s+/);
      return mParts[mParts.length - 1].toLowerCase() === currentLast;
    });
    if (lastNameMatch) {
      console.log(`   ✅ Last name matches team member: "${lastNameMatch}"`);
      return { html, fixed: false };
    }
    // Full name that doesn't match team — could be from LinkedIn or other source, keep it
    console.log(`   ⚠️  Name doesn't match team but is a full name — keeping`);
    return { html, fixed: false };
  }

  // Name is problematic (single word, generic, or incomplete) — try to fix
  let bestName = null;

  // 1. Try email-to-team matching
  if (leadEmail) {
    const emailMatch = matchEmailToTeamMember(leadEmail, teamMembers);
    if (emailMatch) {
      bestName = emailMatch;
      console.log(`   🔍 Email matched team member: "${bestName}"`);
    }
  }

  // 2. If single-word name, check if it's someone's last name
  if (!bestName && isIncomplete) {
    const lastNameMatch = teamMembers.find(m => {
      const parts = m.split(/\s+/);
      return parts[parts.length - 1].toLowerCase() === currentName.toLowerCase();
    });
    if (lastNameMatch) {
      bestName = lastNameMatch;
      console.log(`   🔍 Last name matched team member: "${bestName}"`);
    }
  }

  // 3. Fallback to first team member
  if (!bestName && teamMembers.length > 0 && isGeneric) {
    bestName = teamMembers[0];
    console.log(`   🔍 Using first team member: "${bestName}"`);
  }

  if (bestName && bestName !== currentName) {
    console.log(`   ✅ FIXING: "${currentName}" → "${bestName}"`);
    // Replace in all occurrences: "Prepared for X at", CTA mentions, etc.
    let fixedHtml = html;
    // Escape for regex
    const escaped = currentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    fixedHtml = fixedHtml.replace(new RegExp(`Prepared for ${escaped}`, 'g'), `Prepared for ${bestName}`);
    // Also fix the CTA if it mentions the old name
    fixedHtml = fixedHtml.replace(new RegExp(`cases to ${escaped}`, 'g'), `cases to ${bestName}`);
    return { html: fixedHtml, fixed: true, oldName: currentName, newName: bestName };
  }

  if (isGeneric || isIncomplete) {
    console.log(`   ⚠️  Could not find a better name — keeping "${currentName}"`);
  }
  return { html, fixed: false };
}

// ============================================================================
// COMPREHENSIVE AI REVIEW — Uses Haiku 3.5 to catch semantic issues
// ============================================================================

function askHaiku(prompt, maxTokens = 2000) {
  return new Promise((resolve, reject) => {
    if (!ANTHROPIC_API_KEY) {
      reject(new Error('No ANTHROPIC_API_KEY'));
      return;
    }
    const requestData = JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
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
      timeout: 30000
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
            reject(new Error(`Haiku API error: ${result.error.message || JSON.stringify(result.error)}`));
          } else {
            reject(new Error(`Unexpected response: ${data.substring(0, 500)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Haiku request timeout')); });
    req.write(requestData);
    req.end();
  });
}

async function comprehensiveAIReview(html, research, leadEmail, leadIntel) {
  if (!ANTHROPIC_API_KEY) {
    console.log('   ⚠️  No ANTHROPIC_API_KEY — skipping AI review');
    return { issues: [], fixes: [] };
  }

  const text = extractText(html);
  const firmName = research.firmName || 'Unknown';
  const city = research.location?.city || '';
  const country = (research.location?.country || 'US').toUpperCase();
  const practiceArea = research.practiceArea || research.practice_area || '';
  const teamMembers = getTeamMembers(research);

  const preparedMatch = html.match(/Prepared for ([^·]+?) at /);
  const prospectName = preparedMatch ? preparedMatch[1].trim() : 'Unknown';
  const roiMatch = html.match(/class="roi-hero-number"[^>]*>([^<]+)/);
  const roiNumber = roiMatch ? roiMatch[1].trim() : 'Unknown';

  // Extract card body prose separately (most error-prone)
  const cardBodies = (html.match(/<div class="revenue-card-body">([\s\S]*?)<\/div>/gi) || [])
    .map(b => b.replace(/<[^>]+>/g, '').trim())
    .join('\n---\n');

  // Competitor names from research
  const compList = (research.competitors || []).map(c => c.name).filter(Boolean).join(', ');

  // Compact research summary
  const researchSummary = [
    `Firm: ${firmName}`,
    `City: ${city}, State: ${research.location?.state || ''}, Country: ${country}`,
    `Practice: ${practiceArea}`,
    `Team: ${teamMembers.length > 0 ? teamMembers.slice(0, 5).join(', ') : 'None found'}`,
    `Competitors: ${compList || 'None'}`,
    `Lead: ${leadEmail || 'Unknown'}, Intel: ${leadIntel ? `${leadIntel.name || 'Unknown'} (${leadIntel.title || 'Unknown'})` : 'None'}`
  ].join('\n');

  const prompt = `You are a QC reviewer for a personalized marketing report sent to a law firm. Your job is to catch issues that would make the recipient think "this is automated garbage."

RESEARCH DATA:
${researchSummary}

REPORT ADDRESSED TO: "${prospectName}"
ROI HEADLINE: ${roiNumber}

CARD BODY PROSE (most error-prone content):
${cardBodies.substring(0, 3000)}

FULL REPORT TEXT (first 8000 chars):
${text.substring(0, 8000)}

CHECK FOR THESE ISSUES (be precise — do NOT fabricate problems that don't exist):

1. WRONG_NAME — "${prospectName}" is clearly the wrong person
2. WRONG_CITY — Report mentions a city that contradicts the firm's location
3. WRONG_PRACTICE — Report describes a completely wrong practice area
4. WRONG_FIRM — Report mentions the wrong firm name
5. FABRICATED_STAT — Prose contains made-up percentages or claims not from the formula data
6. CONTRADICTORY_CLAIMS — Two sections of the report contradict each other
7. NONSENSICAL_PROSE — Grammatically correct but logically wrong sentences
8. COMPETITOR_ISSUE — A competitor listed is actually the target firm, or clearly not a law firm
9. WRONG_COUNTRY — Currency symbols ($/£) or terminology (attorney/solicitor) wrong for country "${country}"
10. BROKEN_CONTENT — "undefined", "null", "NaN", or "[object Object]" in visible text
11. GENERIC_REPORT — Report feels entirely generic with no firm-specific personalization
12. BROKEN_NUMBERS — ROI is $0, negative, NaN, or over $500K/month (calculation bug)

CRITICAL INSTRUCTIONS:
- Do NOT fabricate issues. Only flag REAL problems a human reader would notice.
- High revenue numbers ($100K-$225K+/month) are INTENTIONAL. The report shows massive opportunity. Only flag BROKEN_NUMBERS if the number is $0, negative, or over $500K/month.
- Percentages that come from the formula (4.5%, 15%, 25%, 2.0%, 1.2%, 35%, 60%, 70%) are correct — do NOT flag these.
- If the report looks good, return empty arrays. Most reports should pass clean.

Return ONLY valid JSON:
{
  "issues": [
    {"type": "FABRICATED_STAT", "detail": "Card says '78% of clients' but this stat isn't from research data", "severity": "IMPORTANT"}
  ],
  "suggestedFixes": [
    {"type": "FABRICATED_STAT", "find": "78% of clients choose", "replace": "many clients choose"}
  ]
}`;

  try {
    const response = await askHaiku(prompt, 2000);
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    const result = JSON.parse(jsonStr.trim());
    return {
      issues: result.issues || [],
      fixes: result.suggestedFixes || []
    };
  } catch (e) {
    console.log(`   ⚠️  AI review failed: ${e.message}`);
    return { issues: [], fixes: [] };
  }
}

function applyAiFixes(html, fixes) {
  let fixedHtml = html;
  let fixCount = 0;

  // Types safe to auto-fix
  const safeTypes = ['WRONG_NAME', 'BROKEN_SENTENCE', 'FABRICATED_STAT', 'WRONG_COUNTRY'];

  for (const fix of fixes) {
    if (!fix.find || !fix.replace || fix.find === fix.replace) continue;
    if (!safeTypes.includes(fix.type)) continue;
    // Don't replace very short strings (risk of false matches)
    if (fix.find.length < 3) continue;

    // FABRICATED_STAT guard: replacement must be shorter or similar length (prevent AI inserting new fabricated content)
    if (fix.type === 'FABRICATED_STAT' && fix.replace.length > fix.find.length * 1.5) {
      console.log(`   ⚠️  Skipping FABRICATED_STAT fix — replacement is too long (${fix.replace.length} vs ${fix.find.length} chars)`);
      continue;
    }

    // WRONG_COUNTRY guard: only allow currency/terminology swaps
    if (fix.type === 'WRONG_COUNTRY') {
      const currencySwap = /^[\$£€]/.test(fix.find) || /\b(attorney|solicitor|lawyer|law firm|law practice)\b/i.test(fix.find);
      if (!currencySwap) {
        console.log(`   ⚠️  Skipping WRONG_COUNTRY fix — not a currency/terminology swap`);
        continue;
      }
    }

    const escaped = fix.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const matches = fixedHtml.match(regex);
    if (matches) {
      fixedHtml = fixedHtml.replace(regex, fix.replace);
      fixCount += matches.length;
      console.log(`   ✅ AI fix [${fix.type}]: "${fix.find}" → "${fix.replace}" (${matches.length}x)`);
    }
  }

  return { html: fixedHtml, fixCount };
}

// ============================================================================
// PRE-FIX COMMON ISSUES (string replacement safety net, kept from original)
// ============================================================================

function preFixCommonIssues(html) {
  let fixedHtml = html;
  let fixCount = 0;

  const phraseFixes = [
    { pattern: /individual going through a divorce/gi, replacement: 'divorcing client' },
    { pattern: /individual going through divorce/gi, replacement: 'divorcing client' },
    { pattern: /person going through a divorce/gi, replacement: 'divorcing client' },
    { pattern: /person going through divorce/gi, replacement: 'divorcing client' },
    { pattern: /someone going through a divorce/gi, replacement: 'divorcing client' },
    { pattern: /someone going through divorce/gi, replacement: 'divorcing client' },
    { pattern: /people going through a divorce/gi, replacement: 'divorcing clients' },
    { pattern: /people going through divorce/gi, replacement: 'divorcing clients' },
    { pattern: /individuals going through divorce/gi, replacement: 'divorcing clients' },
    { pattern: /individual dealing with a family matter/gi, replacement: 'family law client' },
    { pattern: /person dealing with a family matter/gi, replacement: 'family law client' },
    { pattern: /individual facing a family issue/gi, replacement: 'family law client' },
    { pattern: /family member dealing with estate/gi, replacement: 'someone planning their estate' },
    { pattern: /individual planning their estate/gi, replacement: 'estate planning client' },
    { pattern: /person planning their estate/gi, replacement: 'estate planning client' },
    { pattern: /individual facing immigration issues/gi, replacement: 'immigration client' },
    { pattern: /person facing immigration issues/gi, replacement: 'immigration client' },
    { pattern: /individual dealing with immigration/gi, replacement: 'immigration client' },
    { pattern: /individual injured in an accident/gi, replacement: 'accident victim' },
    { pattern: /person injured in an accident/gi, replacement: 'accident victim' },
    { pattern: /individual who was injured/gi, replacement: 'accident victim' },
    { pattern: /individual planning ahead/gi, replacement: 'potential client' },
    { pattern: /individuals planning ahead/gi, replacement: 'potential clients' },
    { pattern: /person planning ahead/gi, replacement: 'potential client' },
    { pattern: /people planning ahead/gi, replacement: 'potential clients' },
    { pattern: /someone planning ahead/gi, replacement: 'potential client' },
    { pattern: /individual with a legal problem/gi, replacement: 'potential client' },
    { pattern: /person with a legal problem/gi, replacement: 'potential client' },
    { pattern: /individual seeking legal help/gi, replacement: 'potential client' },
    { pattern: /person seeking legal help/gi, replacement: 'potential client' },
    { pattern: /\ban individual\b/gi, replacement: 'a potential client' },
    { pattern: /\ba individual\b/gi, replacement: 'a potential client' }
  ];

  for (const fix of phraseFixes) {
    const matches = fixedHtml.match(fix.pattern);
    if (matches) {
      fixCount += matches.length;
      fixedHtml = fixedHtml.replace(fix.pattern, fix.replacement);
    }
  }

  if (fixCount > 0) {
    console.log(`   ✅ Pre-fixed ${fixCount} verbose phrase(s)`);
  }

  return fixedHtml;
}

// ============================================================================
// RESEARCH DATA VALIDATION — catches upstream garbage before report generation
// ============================================================================

function validateResearchData(research) {
  const issues = [];

  // Firm name sanity: reject scraped headlines
  const firmName = research.firmName || '';
  if (firmName) {
    const wordCount = firmName.trim().split(/\s+/).length;
    if (wordCount > 6) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `Firm name looks like a scraped headline (${wordCount} words): "${firmName.substring(0, 60)}"` });
    }
    const headlineStarts = ['welcome to', 'about us', 'home', 'contact us', 'our firm', 'meet our', 'we are'];
    if (headlineStarts.some(h => firmName.toLowerCase().startsWith(h))) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `Firm name starts with webpage heading: "${firmName.substring(0, 60)}"` });
    }
    // SEO slug pattern: lowercase phrase with city name embedded (e.g., "personal injury lawyer in Miami")
    const cityName = (research.location?.city || '').toLowerCase();
    if (cityName && wordCount >= 4 && firmName.toLowerCase().includes(cityName) && /\b(lawyer|attorney|solicitor|abogad|law firm|legal|divorce|injury|immigration|criminal)\b/i.test(firmName)) {
      issues.push({ severity: 'IMPORTANT', category: 'DATA_QUALITY', issue: `Firm name looks like an SEO page title: "${firmName.substring(0, 60)}"` });
    }
  }

  // City validation: newlines, HTML, absurd length
  const city = research.location?.city || '';
  if (city) {
    if (/[\n\t]/.test(city)) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `City contains control characters (scraped garbage): "${city.substring(0, 50).replace(/\n/g, '\\n')}"` });
    }
    if (/<[a-z]|<\//i.test(city)) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `City contains HTML fragments: "${city.substring(0, 50)}"` });
    }
    if (city.length > 40) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `City name absurdly long (${city.length} chars): "${city.substring(0, 50)}..."` });
    }
  }

  // Country/province mismatch (normalize country first)
  const country = normalizeCountry(research.location?.country || '');
  const state = (research.location?.state || '').toUpperCase();
  if (country === 'US') {
    const canadianProvinces = ['ON', 'ONTARIO', 'BC', 'BRITISH COLUMBIA', 'AB', 'ALBERTA', 'QC', 'QUEBEC', 'MB', 'MANITOBA', 'SK', 'SASKATCHEWAN', 'NS', 'NOVA SCOTIA', 'NB', 'NEW BRUNSWICK', 'NL', 'NEWFOUNDLAND', 'PE', 'PEI'];
    if (canadianProvinces.includes(state)) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `Canadian province "${state}" with country "US" — firm is likely Canadian` });
    }
    const canadianCities = ['toronto', 'vancouver', 'montreal', 'calgary', 'edmonton', 'ottawa', 'winnipeg', 'quebec city', 'halifax', 'victoria'];
    if (canadianCities.includes(city.toLowerCase())) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `Canadian city "${city}" with country "US" — should be "CA"` });
    }
  }

  // Attorney names that are scrape artifacts
  const allAttorneys = [
    ...(research.team?.foundingPartners || []),
    ...(research.team?.keyAttorneys || [])
  ];
  const artifactPatterns = [/^meet our/i, /^welcome/i, /^about/i, /^fostering/i, /^that define/i, /^learn more/i, /^our team/i, /^contact/i];
  const artifactNames = allAttorneys.filter(a => a?.name && artifactPatterns.some(p => p.test(a.name.trim())));
  if (artifactNames.length > 0) {
    issues.push({ severity: 'IMPORTANT', category: 'DATA_QUALITY', issue: `${artifactNames.length} team member name(s) look like scrape artifacts: ${artifactNames.map(a => `"${a.name}"`).join(', ')}` });
  }

  return issues;
}

// ============================================================================
// DETERMINISTIC QC - No AI, no hallucinations
// ============================================================================

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

function normalizeCountry(raw) {
  const c = (raw || '').toUpperCase().trim();
  const map = {
    'UK': 'GB', 'UNITED KINGDOM': 'GB', 'ENGLAND': 'GB', 'SCOTLAND': 'GB', 'WALES': 'GB',
    'CANADA': 'CA', 'AUSTRALIA': 'AU', 'NEW ZEALAND': 'NZ', 'IRELAND': 'IE',
    'UNITED STATES': 'US', 'USA': 'US', 'UNITED STATES OF AMERICA': 'US'
  };
  return map[c] || c;
}

function deterministicQC(html, research) {
  const firmName = research.firmName || 'Unknown';
  const country = normalizeCountry(research.location?.country || '');
  const isUK = country === 'GB';
  const expectedCurrency = isUK ? '£' : '$';
  const wrongCurrency = isUK ? '$' : '£';

  // Country baseline for threshold scaling (same baselines as report generator)
  const countryUpper = country.toUpperCase();
  const countryBaseline = isUK ? 0.7 : countryUpper === 'CA' ? 0.75 : countryUpper === 'AU' ? 0.6 : countryUpper === 'NZ' ? 0.4 : countryUpper === 'IE' ? 0.35 : 1.0;

  const text = extractText(html);
  const issues = [];
  let score = 10;

  // 1. BROKEN CONTENT - undefined, null, NaN, [object Object]
  const brokenPatterns = [
    { regex: /\bundefined\b/gi, label: 'undefined' },
    { regex: /\bnull\b/gi, label: 'null' },
    { regex: /\bNaN\b/g, label: 'NaN' },
    { regex: /\[object Object\]/g, label: '[object Object]' }
  ];
  for (const { regex, label } of brokenPatterns) {
    const matches = text.match(regex);
    if (matches) {
      issues.push({ severity: 'CRITICAL', category: 'BROKEN', issue: `Found "${label}" in report text (${matches.length} occurrences)` });
      score -= 3;
    }
  }

  // 2. CURRENCY MISMATCH - check prose text (not HTML/CSS/JS)
  // Look for wrong currency symbol in the visible text
  // Exclude URLs, code blocks, and style attributes
  const proseText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/href="[^"]*"/gi, '')
    .replace(/src="[^"]*"/gi, '')
    .replace(/<[^>]+>/g, ' ');

  // Count wrong currency in prose (but not when preceded by common HTML entities)
  const wrongCurrencyRegex = isUK ? /\$[\d,]+/g : /£[\d,]+/g;
  const wrongCurrencyMatches = proseText.match(wrongCurrencyRegex);
  if (wrongCurrencyMatches && wrongCurrencyMatches.length > 0) {
    issues.push({
      severity: 'CRITICAL', category: 'CURRENCY',
      issue: `Found ${wrongCurrencyMatches.length} ${wrongCurrency} amount(s) in a ${isUK ? 'UK' : 'US'} report - should use ${expectedCurrency}`
    });
    score -= 3;
  }

  // 3. TERMINOLOGY MISMATCH - check for wrong attorney/solicitor usage
  // Only in prose, not in competitor business names or meta tags
  const proseOnly = text
    .replace(new RegExp(firmName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '') // Remove firm name
    .replace(/reviews?/gi, ''); // Ignore "reviews" context

  if (isUK) {
    // UK report should not use "attorney" in prose (excluding competitor names)
    // We strip competitor names from the check text
    let checkText = proseOnly;
    for (const c of (research.competitors || [])) {
      if (c.name) checkText = checkText.replace(new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    }
    const attorneyMatches = checkText.match(/\battorney\b/gi);
    if (attorneyMatches && attorneyMatches.length > 0) {
      issues.push({
        severity: 'IMPORTANT', category: 'TERMINOLOGY',
        issue: `Found "attorney" ${attorneyMatches.length} time(s) in UK report - should use "solicitor"`
      });
      score -= 1;
    }
    const lawFirmMatches = checkText.match(/\blaw firm\b/gi);
    if (lawFirmMatches && lawFirmMatches.length > 0) {
      issues.push({
        severity: 'MINOR', category: 'TERMINOLOGY',
        issue: `Found "law firm" ${lawFirmMatches.length} time(s) in UK report - prefer "law practice"`
      });
      // Don't deduct for this - it's minor
    }
  } else {
    // US report should not use "solicitor" in prose
    let checkText = proseOnly;
    for (const c of (research.competitors || [])) {
      if (c.name) checkText = checkText.replace(new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    }
    const solicitorMatches = checkText.match(/\bsolicitor\b/gi);
    if (solicitorMatches && solicitorMatches.length > 0) {
      issues.push({
        severity: 'IMPORTANT', category: 'TERMINOLOGY',
        issue: `Found "solicitor" ${solicitorMatches.length} time(s) in US report - should use "attorney"`
      });
      score -= 1;
    }
  }

  // 4. FIRM NAME PRESENT - the report should mention the firm
  // Check both raw name and HTML-escaped version (& → &amp;), case-insensitive
  if (firmName && firmName !== 'Unknown' && firmName !== 'Unknown Firm') {
    const htmlLower = html.toLowerCase();
    const firmLower = firmName.toLowerCase();
    const htmlEscapedLower = firmLower.replace(/&/g, '&amp;');
    if (!htmlLower.includes(firmLower) && !htmlLower.includes(htmlEscapedLower)) {
      issues.push({
        severity: 'IMPORTANT', category: 'BROKEN',
        issue: `Firm name not found in report`
      });
      score -= 1;
    }
  }

  // 5. A/AN ARTICLE ERRORS
  // Words that start with consonant SOUNDS (so "an X" is wrong): solicitor, family, tax, etc.
  // Note: "employment" starts with vowel sound "em-", so "an employment" is CORRECT - not included here
  const anConsonant = text.match(/\ban\s+(solicitor|family|tax|criminal|business|bankruptcy|landlord|personal|real|medical|worker)\b/gi);
  if (anConsonant && anConsonant.length > 0) {
    issues.push({
      severity: 'MINOR', category: 'PHRASING',
      issue: `Article error: ${anConsonant[0]} - an before consonant sound`
    });
    score -= 0.5;
  }
  const aVowel = text.match(/\ba\s+(attorney|attorney's|estate|immigration|accident|eviction|individual|hour|honest)\b/gi);
  if (aVowel && aVowel.length > 0) {
    // Check if it's actually wrong (a estate, a attorney - but "a estate planning" is fine)
    const actualErrors = aVowel.filter(m => {
      const word = m.split(/\s+/)[1].toLowerCase();
      return ['attorney', 'estate', 'accident', 'eviction', 'hour', 'honest'].includes(word);
    });
    if (actualErrors.length > 0) {
      issues.push({
        severity: 'MINOR', category: 'PHRASING',
        issue: `Article error: "${actualErrors[0]}" - should use "an" before vowel sound`
      });
      score -= 0.5;
    }
  }

  // 6. US CORPORATE SUFFIXES IN UK REPORTS
  if (isUK) {
    const usSuffixes = proseOnly.match(/\b(Inc\.|Corp\.|PLLC)\b/g);
    if (usSuffixes && usSuffixes.length > 0) {
      issues.push({
        severity: 'MINOR', category: 'TERMINOLOGY',
        issue: `US corporate suffix "${usSuffixes[0]}" found in UK report`
      });
      score -= 0.5;
    }
  }

  // 7. EMPTY PROSE SECTIONS - check for empty paragraphs or missing content
  const emptyParagraphs = html.match(/<p>\s*<\/p>/gi);
  if (emptyParagraphs && emptyParagraphs.length > 0) {
    issues.push({
      severity: 'IMPORTANT', category: 'BROKEN',
      issue: `Found ${emptyParagraphs.length} empty paragraph(s) in report`
    });
    score -= 1;
  }

  // 8. TOTAL OPPORTUNITY IS COMPELLING (V7: ROI box hero number)
  const roiHeroMatch = html.match(/class="roi-hero-number"[^>]*>([^<]+)/);
  if (roiHeroMatch) {
    const totalText = roiHeroMatch[1].trim();
    // Parse the low end: extract first number like "$100K" or "£70K" or "$100,000"
    const totalLowMatch = totalText.match(/[\$£]?([\d,]+(?:\.\d+)?)\s*K?/i);
    if (totalLowMatch) {
      let totalLow = parseFloat(totalLowMatch[1].replace(/,/g, ''));
      if (totalText.includes('K') || totalText.includes('k')) totalLow *= 1000;
      const baseThreshold = isUK ? 70000 : 100000;
      const threshold = Math.round(baseThreshold * countryBaseline);
      const thresholdLabel = `${expectedCurrency}${Math.round(threshold / 1000)}K`;
      if (totalLow < threshold) {
        issues.push({
          severity: 'CRITICAL', category: 'SELLING_POWER',
          issue: `Total opportunity too low to sell (${totalText}) - needs to be at least ${thresholdLabel}/mo`
        });
        score -= 3;
      }
      if (totalLow > 500000) {
        issues.push({
          severity: 'CRITICAL', category: 'SELLING_POWER',
          issue: `Total opportunity absurdly high (${totalText}) - looks unbelievable`
        });
        score -= 3;
      }
    }
    // Check for inverted range
    const rangeMatch = totalText.match(/[\$£]?([\d,]+(?:\.\d+)?)\s*K?\s*[-–]\s*[\$£]?([\d,]+(?:\.\d+)?)\s*K?/i);
    if (rangeMatch) {
      let lo = parseFloat(rangeMatch[1].replace(/,/g, ''));
      let hi = parseFloat(rangeMatch[2].replace(/,/g, ''));
      if (totalText.includes('K') || totalText.includes('k')) { lo *= 1000; hi *= 1000; }
      if (hi < lo) {
        issues.push({
          severity: 'CRITICAL', category: 'SELLING_POWER',
          issue: `Total range is inverted (high < low): ${totalText}`
        });
        score -= 3;
      }
    }
  }

  // 9. NO REVENUE CARD IS EMBARRASSINGLY SMALL (V7: revenue-card-number)
  const revenueCardNumMatches = html.match(/class="revenue-card-number"[^>]*>[^<]+/g) || [];
  for (const cardMatch of revenueCardNumMatches) {
    const cardText = cardMatch.replace(/class="revenue-card-number"[^>]*>/, '').trim();
    const cardNumMatch = cardText.match(/[\$£]?([\d,]+(?:\.\d+)?)\s*K?/i);
    if (cardNumMatch) {
      let cardLow = parseFloat(cardNumMatch[1].replace(/,/g, ''));
      if (cardText.includes('K') || cardText.includes('k')) cardLow *= 1000;
      const cardThreshold = isUK ? 3000 : 5000;
      if (cardLow < cardThreshold) {
        issues.push({
          severity: 'IMPORTANT', category: 'SELLING_POWER',
          issue: `Revenue card number too small to impress (${cardText}) - lawyer won't care about ${isUK ? '£' : '$'}${cardLow}/mo`
        });
        score -= 1;
      }
    }
  }

  // 10. SERP MOCKUP HAS COMPETITORS (V7: competitors in SERP, not bar chart)
  const allSerpRows = html.match(/class="serp-row/g) || [];
  const serpYouRows = html.match(/class="serp-row serp-you/g) || [];
  const serpCompetitorCount = allSerpRows.length - serpYouRows.length;
  if (serpCompetitorCount < 2) {
    issues.push({
      severity: 'MINOR', category: 'SELLING_POWER',
      issue: `Only ${serpCompetitorCount} competitor(s) in SERP mockup - ideally show 2-3`
    });
    // Don't deduct score - SERP still works with fewer competitors
  }

  // 11. REPORT IS PERSONALIZED, NOT GENERIC
  if (firmName && firmName !== 'Unknown' && firmName !== 'Unknown Firm') {
    const htmlEscapedName = firmName.replace(/&/g, '&amp;');
    const nameRegex = new RegExp(firmName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const escapedNameRegex = new RegExp(htmlEscapedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const nameCount = (text.match(nameRegex) || []).length + (text.match(escapedNameRegex) || []).length;
    if (nameCount < 3) {
      issues.push({
        severity: 'CRITICAL', category: 'PERSONALIZATION',
        issue: `Firm name only appears ${nameCount} time(s) - report feels generic`
      });
      score -= 3;
    }
  }
  const cityName = research.location?.city;
  if (cityName && cityName.length > 2) {
    const cityRegex = new RegExp(cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const cityCount = (text.match(cityRegex) || []).length;
    if (cityCount < 2) {
      issues.push({
        severity: 'IMPORTANT', category: 'PERSONALIZATION',
        issue: `City name "${cityName}" only appears ${cityCount} time(s) - should feel local`
      });
      score -= 1;
    }
  }
  const practiceArea = research.practiceArea || research.practice_area || '';
  if (practiceArea) {
    const paLower = practiceArea.toLowerCase();
    // Check that report uses specific practice area term, not just "legal services"
    if (paLower === 'default' || paLower === 'legal services' || paLower === 'general') {
      const hasSpecificPractice = text.match(/\b(personal injury|family law|divorce|criminal|immigration|estate|tax|bankruptcy|employment|landlord|medical malpractice|real estate|worker.?s?.comp)\b/i);
      if (!hasSpecificPractice) {
        issues.push({
          severity: 'IMPORTANT', category: 'PERSONALIZATION',
          issue: `Practice area too vague ("${practiceArea}") - report should target a specific practice`
        });
        score -= 1;
      }
    }
  }

  // 12. ALL SECTIONS HAVE REAL CONTENT (V7 structure)
  const requiredSections = [
    { name: 'hero', pattern: /class="hero"/i },
    { name: 'ROI box', pattern: /class="roi-box/i },
    { name: 'revenue card 1', pattern: /class="revenue-card/i },
    { name: 'guarantee section', pattern: /class="guarantee-section/i },
    { name: 'case study', pattern: /class="case-study/i },
    { name: 'deliverables', pattern: /class="deliverables-group/i },
    { name: 'only job', pattern: /class="only-job/i },
    { name: 'footer', pattern: /class="footer"/i }
  ];
  for (const section of requiredSections) {
    if (!section.pattern.test(html)) {
      issues.push({
        severity: 'CRITICAL', category: 'STRUCTURE',
        issue: `Missing required section: ${section.name}`
      });
      score -= 3;
    }
  }
  // Check revenue cards have prose > 30 chars
  const revenueCardProse = html.match(/<div class="revenue-card"[\s\S]*?<\/div>\s*<\/div>/gi) || [];
  for (let i = 0; i < revenueCardProse.length; i++) {
    const cardText = revenueCardProse[i].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (cardText.length < 30) {
      issues.push({
        severity: 'CRITICAL', category: 'STRUCTURE',
        issue: `Revenue card ${i + 1} has almost no content (${cardText.length} chars)`
      });
      score -= 3;
    }
  }
  // Check we have 3 revenue cards (class may include "fade-in" etc.)
  const revenueCards = html.match(/class="revenue-card[\s"]/g) || [];
  if (revenueCards.length < 3) {
    issues.push({
      severity: 'IMPORTANT', category: 'STRUCTURE',
      issue: `Only ${revenueCards.length} revenue card(s) instead of 3`
    });
    score -= 1;
  }
  // Check deliverables have items (should be ~21)
  const deliverableItems = html.match(/class="deliverable-item"/g) || [];
  if (deliverableItems.length < 15) {
    issues.push({
      severity: 'IMPORTANT', category: 'STRUCTURE',
      issue: `Only ${deliverableItems.length} deliverable items (expected ~21)`
    });
    score -= 1;
  }

  // 13. MATH ADDS UP (V7: revenue card amounts should sum to ROI projected revenue)
  if (roiHeroMatch) {
    const totalText = roiHeroMatch[1].trim();
    const totalRangeMatch = totalText.match(/[\$£]?([\d,]+(?:\.\d+)?)\s*K?\s*[-–]\s*[\$£]?([\d,]+(?:\.\d+)?)\s*K?/i);
    if (totalRangeMatch) {
      let totalLo = parseFloat(totalRangeMatch[1].replace(/,/g, ''));
      let totalHi = parseFloat(totalRangeMatch[2].replace(/,/g, ''));
      if (totalText.includes('K') || totalText.includes('k')) { totalLo *= 1000; totalHi *= 1000; }
      // Sum revenue card amounts
      let cardSum = 0;
      for (const cardMatch of revenueCardNumMatches) {
        const ct = cardMatch.replace(/class="revenue-card-number"[^>]*>/, '').trim();
        const cnm = ct.match(/[\$£]?([\d,]+(?:\.\d+)?)\s*K?/i);
        if (cnm) {
          let val = parseFloat(cnm[1].replace(/,/g, ''));
          if (ct.includes('K') || ct.includes('k')) val *= 1000;
          cardSum += val;
        }
      }
      if (cardSum > 0 && totalLo > 0) {
        // ROI hero shows net revenue (total - ad spend), so it should be <= card sum
        // Allow generous tolerance since net = total - adSpend
        if (totalLo > cardSum * 1.2) {
          issues.push({
            severity: 'CRITICAL', category: 'MATH',
            issue: `Revenue card sum (~${isUK ? '£' : '$'}${Math.round(cardSum)}) is less than ROI hero number (~${isUK ? '£' : '$'}${Math.round(totalLo)}) - math looks wrong`
          });
          score -= 2;
        }
      }
      if (totalLo <= 0) {
        issues.push({
          severity: 'CRITICAL', category: 'MATH',
          issue: `ROI hero number is zero or negative`
        });
        score -= 2;
      }
    }
  }

  // 15. CONTACT NAME QUALITY - check if the prospect name is a real full name
  const preparedForMatch = html.match(/Prepared for ([^·]+?) at /);
  if (preparedForMatch) {
    const prospectName = preparedForMatch[1].trim();
    const isSingleWord = !prospectName.includes(' ');
    const isGenericName = ['Partner', 'there', 'Your Firm', 'Hiring Partner', 'Unknown'].includes(prospectName);
    if (isGenericName) {
      issues.push({
        severity: 'IMPORTANT', category: 'PERSONALIZATION',
        issue: `Contact name is generic: "${prospectName}" — report feels impersonal`
      });
      score -= 1;
    } else if (isSingleWord) {
      issues.push({
        severity: 'IMPORTANT', category: 'PERSONALIZATION',
        issue: `Contact name is only one word: "${prospectName}" — should be a full name`
      });
      score -= 1;
    }
  }

  // 16. CITY NAME VALIDATION
  const cityVal = research.location?.city || '';
  if (cityVal) {
    if (/[\n\t]/.test(cityVal)) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `City contains control characters: "${cityVal.substring(0, 40).replace(/\n/g, '\\n')}"` });
      score -= 3;
    }
    if (/<[a-z]|<\//i.test(cityVal)) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `City contains HTML: "${cityVal.substring(0, 40)}"` });
      score -= 3;
    }
    if (cityVal.length > 40) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `City name too long (${cityVal.length} chars)` });
      score -= 3;
    }
    if (cityVal.trim().split(/\s+/).length > 4) {
      issues.push({ severity: 'IMPORTANT', category: 'DATA_QUALITY', issue: `City name has ${cityVal.trim().split(/\s+/).length} words: "${cityVal}"` });
      score -= 1;
    }
  }

  // 17. COUNTRY/CITY CONSISTENCY
  if (countryUpper === 'US') {
    const canadianCities = ['toronto', 'vancouver', 'montreal', 'calgary', 'edmonton', 'ottawa', 'winnipeg'];
    if (canadianCities.includes(cityVal.toLowerCase())) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `Canadian city "${cityVal}" with country "US" — wrong country inflates numbers 33%` });
      score -= 3;
    }
    const stateVal = (research.location?.state || '').toUpperCase();
    const canadianProvinces = ['ON', 'ONTARIO', 'BC', 'BRITISH COLUMBIA', 'AB', 'ALBERTA', 'QC', 'QUEBEC'];
    if (canadianProvinces.includes(stateVal)) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `Canadian province "${stateVal}" with country "US"` });
      score -= 3;
    }
  }

  // 18. FIRM NAME SANITY
  if (firmName && firmName !== 'Unknown' && firmName !== 'Unknown Firm') {
    const firmWords = firmName.trim().split(/\s+/).length;
    if (firmWords > 6) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `Firm name looks like a scraped headline (${firmWords} words): "${firmName.substring(0, 50)}"` });
      score -= 3;
    }
    const headlineStarts = ['welcome to', 'about us', 'home -', 'contact us', 'our firm', 'meet our'];
    if (headlineStarts.some(h => firmName.toLowerCase().startsWith(h))) {
      issues.push({ severity: 'CRITICAL', category: 'DATA_QUALITY', issue: `Firm name looks like a page title: "${firmName.substring(0, 50)}"` });
      score -= 3;
    }
    // Single-word generic firm name
    if (firmWords === 1) {
      const genericSingleWords = ['business', 'legal', 'law', 'firm', 'office', 'services', 'attorney', 'lawyer', 'solicitor', 'practice', 'group'];
      if (genericSingleWords.includes(firmName.toLowerCase())) {
        issues.push({ severity: 'IMPORTANT', category: 'DATA_QUALITY', issue: `Firm name is a single generic word: "${firmName}"` });
        score -= 1;
      }
    }
    // SEO slug pattern: "personal injury lawyer in Miami"
    if (firmWords >= 4 && cityVal) {
      const firmLower = firmName.toLowerCase();
      if (firmLower.includes(cityVal.toLowerCase()) && /\b(lawyer|attorney|solicitor|abogad|law firm|legal|divorce|injury|immigration|criminal)\b/i.test(firmName)) {
        issues.push({ severity: 'IMPORTANT', category: 'DATA_QUALITY', issue: `Firm name looks like an SEO page title: "${firmName.substring(0, 50)}"` });
        score -= 1;
      }
    }
  }

  // 19. COMPETITOR SELF-REFERENCE — target firm in its own competitor list
  const compNames = (research.competitors || []).map(c => (c.name || '').toLowerCase());
  if (firmName && compNames.some(cn => cn && (cn.includes(firmName.toLowerCase()) || firmName.toLowerCase().includes(cn)) && cn.length > 3)) {
    issues.push({ severity: 'IMPORTANT', category: 'DATA_QUALITY', issue: `Target firm appears in its own competitor list` });
    score -= 1;
  }

  // 20. COMPETITOR NAME QUALITY (MINOR — report sanitizes names before display)
  for (const comp of (research.competitors || [])) {
    if (comp.name && comp.name.length > 60) {
      issues.push({ severity: 'MINOR', category: 'DATA_QUALITY', issue: `Competitor name too long in research data (${comp.name.length} chars): "${comp.name.substring(0, 50)}..." — sanitized before display` });
      // No score deduction — name is sanitized in the report
      break; // only flag once
    }
  }
  const placeholderComps = compNames.filter(n => /^(competitor|law firm|firm)\s*\d*$/i.test(n));
  if (placeholderComps.length >= 2) {
    issues.push({ severity: 'IMPORTANT', category: 'DATA_QUALITY', issue: `${placeholderComps.length} placeholder competitor name(s)` });
    score -= 1;
  }

  // 21. AD SPEND RATIO SANITY
  if (roiHeroMatch) {
    // Extract ad spend from report
    const adSpendMatch = html.match(/~[\$£]([\d,]+(?:\.\d+)?)\s*K?\s*<\/div>\s*<div class="roi-detail-label">Ad spend/i);
    if (adSpendMatch) {
      let adSpendVal = parseFloat(adSpendMatch[1].replace(/,/g, ''));
      // Check if "K" suffix present in the surrounding text
      const adSpendContext = html.match(/~[\$£][\d,]+(?:\.\d+)?\s*K?\s*<\/div>\s*<div class="roi-detail-label">Ad spend/i);
      if (adSpendContext && adSpendContext[0].includes('K')) adSpendVal *= 1000;
      const totalLowForAd = (() => {
        if (!roiHeroMatch) return 0;
        const tt = roiHeroMatch[1].trim();
        const m = tt.match(/[\$£]?([\d,]+(?:\.\d+)?)\s*K?/i);
        if (!m) return 0;
        let v = parseFloat(m[1].replace(/,/g, ''));
        if (tt.includes('K') || tt.includes('k')) v *= 1000;
        return v;
      })();
      if (adSpendVal <= 0) {
        issues.push({ severity: 'IMPORTANT', category: 'MATH', issue: `Ad spend is $0 — looks broken` });
        score -= 1;
      } else if (totalLowForAd > 0 && adSpendVal / totalLowForAd > 0.20) {
        issues.push({ severity: 'IMPORTANT', category: 'MATH', issue: `Ad spend is ${Math.round(adSpendVal / totalLowForAd * 100)}% of net revenue — ratio seems off` });
        score -= 1;
      }
    }
  }

  // 22. FABRICATED STATISTICS — percentages in prose not from our formulas
  // Our known formulas use: 4.5%, 15%, 25%, 2.0%, 1.2%, 35%, 60%, 70%
  const knownPcts = ['4.5', '15', '25', '2.0', '1.2', '35', '60', '70', '100'];
  const cardBodies = html.match(/<div class="revenue-card-body">([\s\S]*?)<\/div>/gi) || [];
  for (const cardBody of cardBodies) {
    const bodyText = cardBody.replace(/<[^>]+>/g, '');
    const pctMatches = bodyText.match(/(\d+(?:\.\d+)?)\s*%/g) || [];
    for (const pct of pctMatches) {
      const num = pct.replace('%', '').trim();
      if (!knownPcts.includes(num)) {
        issues.push({ severity: 'MINOR', category: 'FABRICATION', issue: `Card prose contains unreferenced statistic: ${pct}` });
        score -= 0.5;
        break; // only flag once per card
      }
    }
  }

  // 23. FALLBACK PROSE DETECTION — fingerprint phrases from templates
  const fallbackPhrases = ['that\'s real demand', 'people ready to hire', 'most people dealing with'];
  const proseCards = cardBodies.map(b => b.replace(/<[^>]+>/g, '').toLowerCase());
  const fallbackCount = fallbackPhrases.filter(fp => proseCards.some(pc => pc.includes(fp))).length;
  if (fallbackCount >= 2) {
    issues.push({ severity: 'MINOR', category: 'PROSE_QUALITY', issue: `Report uses fallback template prose (${fallbackCount} fingerprint phrases found)` });
    // Don't deduct — fallback prose is valid, just less personalized
  }

  // Clamp score
  score = Math.max(0, Math.min(10, Math.round(score * 2) / 2));

  // 14. OVERALL "WOULD YOU BOOK?" FLAG
  const opportunityThreshold = Math.round((isUK ? 70000 : 100000) * countryBaseline);
  let totalOppLow = 0;
  if (roiHeroMatch) {
    const tt = roiHeroMatch[1].trim();
    const tlm = tt.match(/[\$£]?([\d,]+(?:\.\d+)?)\s*K?/i);
    if (tlm) {
      totalOppLow = parseFloat(tlm[1].replace(/,/g, ''));
      if (tt.includes('K') || tt.includes('k')) totalOppLow *= 1000;
    }
  }

  const wouldBook = score >= 8 && totalOppLow >= opportunityThreshold;
  let verdict;
  if (score >= 9 && wouldBook) {
    verdict = 'Clean report, ready to send.';
  } else if (score >= 8 && wouldBook) {
    verdict = 'Minor issues but presentable.';
  } else if (score >= 8 && !wouldBook) {
    verdict = 'Numbers might not be compelling enough to close.';
  } else {
    verdict = 'Report has quality issues that need attention.';
  }

  return {
    score,
    wouldBook,
    issues,
    biggestProblem: issues.length > 0 ? issues[0].issue : null,
    verdict
  };
}

// ============================================================================
// MAIN - Run QC, save results
// ============================================================================

async function perfectReport() {
  console.log('\n' + '═'.repeat(60));
  console.log('🎯 AI REPORT PERFECTOR (Deterministic QC)');
  console.log('═'.repeat(60));
  console.log(`Firm: ${research.firmName}`);
  console.log(`Location: ${research.location?.city}, ${research.location?.country || 'US'}`);
  console.log(`Lead email: ${leadEmail || 'Not provided'}`);

  // Look up lead intelligence if email provided
  let leadIntel = null;
  if (leadEmail) {
    leadIntel = await getLeadIntelligence(leadEmail, research.firmName, research);
  }

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
  let fixesApplied = [];

  // Step 1: Fix contact name using research data (deterministic, no AI)
  console.log('\n👤 STEP 1: Contact name validation...');
  const nameResult = fixContactName(currentHtml, research, leadEmail);
  if (nameResult.fixed) {
    currentHtml = nameResult.html;
    fixesApplied.push(`Contact name: "${nameResult.oldName}" → "${nameResult.newName}"`);
  }

  // Step 2: Pre-pass verbose phrasing fixes
  console.log('\n🔧 STEP 2: Fixing common phrasing issues...');
  currentHtml = preFixCommonIssues(currentHtml);

  // Save if any fixes so far
  if (currentHtml !== reportHtml) {
    fs.writeFileSync(reportFile, currentHtml);
    console.log('💾 Saved pre-fixed report');
  }

  // Step 3: Validate research data (catches upstream garbage)
  console.log('\n🔬 STEP 3: Research data validation...');
  const dataIssues = validateResearchData(research);
  if (dataIssues.length > 0) {
    console.log(`   Found ${dataIssues.length} data quality issue(s):`);
    for (const issue of dataIssues) {
      console.log(`   [${issue.severity}] ${issue.category}: ${issue.issue}`);
    }
  } else {
    console.log('   ✅ Research data looks clean');
  }

  // Step 4: Run deterministic QC (checks 1-23)
  console.log('\n🔍 STEP 4: Deterministic QC...');
  const qcResult = deterministicQC(currentHtml, research);

  // Merge data validation issues into QC result
  for (const issue of dataIssues) {
    // Avoid duplicates — data validation and deterministic QC may flag the same city/firm issue
    const isDupe = qcResult.issues.some(qi => qi.category === issue.category && qi.issue === issue.issue);
    if (!isDupe) {
      qcResult.issues.unshift(issue); // data issues go first (most critical)
      if (issue.severity === 'CRITICAL') qcResult.score = Math.max(0, qcResult.score - 3);
      else if (issue.severity === 'IMPORTANT') qcResult.score = Math.max(0, qcResult.score - 1);
    }
  }
  // Re-clamp after adding data issues
  qcResult.score = Math.max(0, Math.min(10, Math.round(qcResult.score * 2) / 2));

  console.log(`   Score: ${qcResult.score}/10`);
  console.log(`   Would book: ${qcResult.wouldBook ? '✅ YES' : '❌ NO'}`);
  console.log(`   Issues found: ${qcResult.issues.length}`);
  if (qcResult.issues.length > 0) {
    for (const issue of qcResult.issues) {
      console.log(`   [${issue.severity}] ${issue.category}: ${issue.issue}`);
    }
  }

  // Step 5: Comprehensive AI review (catches semantic issues deterministic checks miss)
  console.log('\n🤖 STEP 5: Comprehensive AI review...');
  const aiResult = await comprehensiveAIReview(currentHtml, research, leadEmail, leadIntel);
  if (aiResult.issues.length > 0) {
    console.log(`   Found ${aiResult.issues.length} semantic issue(s):`);
    for (const issue of aiResult.issues) {
      console.log(`   [${issue.severity}] ${issue.type}: ${issue.detail}`);
      // Add AI issues to QC result
      qcResult.issues.push({
        severity: issue.severity || 'IMPORTANT',
        category: 'AI_REVIEW',
        issue: `${issue.type}: ${issue.detail}`
      });
    }
  } else {
    console.log(`   ✅ No semantic issues found`);
  }

  // Step 6: Apply AI-suggested fixes (safe types: WRONG_NAME, BROKEN_SENTENCE, FABRICATED_STAT, WRONG_COUNTRY)
  if (aiResult.fixes.length > 0) {
    console.log('\n🔧 STEP 6: Applying AI fixes...');
    const aiFixResult = applyAiFixes(currentHtml, aiResult.fixes);
    if (aiFixResult.fixCount > 0) {
      currentHtml = aiFixResult.html;
      fixesApplied.push(`AI fixes: ${aiFixResult.fixCount} replacement(s)`);
      fs.writeFileSync(reportFile, currentHtml);
      console.log('💾 Saved AI-fixed report');

      // Step 7: Re-run deterministic QC after AI fixes to get updated score
      console.log('\n🔍 STEP 7: Re-running deterministic QC after fixes...');
      const recheck = deterministicQC(currentHtml, research);
      qcResult.score = recheck.score;
      qcResult.wouldBook = recheck.wouldBook;
      qcResult.verdict = recheck.verdict;
      qcResult.biggestProblem = recheck.biggestProblem;
      qcResult.issues = recheck.issues;
      console.log(`   Updated score: ${recheck.score}/10`);
    }
  }

  // Save QC result alongside report
  const qcResultFile = reportFile.replace('.html', '-qc.json');
  fs.writeFileSync(qcResultFile, JSON.stringify({
    iterations: 1,
    finalScore: qcResult.score,
    wouldBook: qcResult.wouldBook,
    verdict: qcResult.verdict,
    biggestProblem: qcResult.biggestProblem,
    remainingIssues: qcResult.issues.length,
    fixesApplied,
    leadIntelligence: leadIntel ? {
      name: leadIntel.name, title: leadIntel.title,
      seniority: leadIntel.seniority, isDecisionMaker: leadIntel.isDecisionMaker,
      source: leadIntel.source
    } : null
  }, null, 2));

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL RESULT');
  console.log('═'.repeat(60));
  console.log(`Score: ${qcResult.score}/10`);
  console.log(`Would book: ${qcResult.wouldBook ? '✅ YES' : '❌ NO'}`);
  console.log(`Verdict: ${qcResult.verdict}`);
  if (fixesApplied.length > 0) {
    console.log(`Fixes applied: ${fixesApplied.join('; ')}`);
  }
  if (qcResult.biggestProblem) {
    console.log(`Biggest issue: ${qcResult.biggestProblem}`);
  }
  if (leadIntel) {
    console.log('─'.repeat(40));
    console.log(`Lead: ${leadIntel.name || 'Unknown'} (${leadIntel.title || 'Unknown title'})`);
    console.log(`Decision-maker: ${leadIntel.isDecisionMaker ? '✅ YES' : '⚠️ NO/UNKNOWN'}`);
  }
  console.log('═'.repeat(60) + '\n');

  const passed = qcResult.score >= 8 && qcResult.wouldBook;

  // Extract final contact name from the fixed HTML (may differ from original)
  const finalNameMatch = currentHtml.match(/Prepared for ([^·]+?) at /);
  const finalContactName = finalNameMatch ? finalNameMatch[1].trim() : null;

  // Write result for workflow (same format as before for compatibility)
  fs.writeFileSync('qc-result.json', JSON.stringify({
    status: passed ? 'PASSED' : 'FAILED',
    firmName: research.firmName,
    iterations: 1,
    score: qcResult.score,
    wouldBook: qcResult.wouldBook,
    biggestIssue: qcResult.biggestProblem,
    qualityIssues: qcResult.issues.length,
    recommendation: passed
      ? 'Report passed deterministic QC and is ready to send.'
      : `Report has issues: ${qcResult.verdict}`,
    fixesApplied,
    correctedContactName: nameResult.fixed ? finalContactName : null,
    leadIntelligence: leadIntel ? {
      name: leadIntel.name, title: leadIntel.title, company: leadIntel.company,
      seniority: leadIntel.seniority, isDecisionMaker: leadIntel.isDecisionMaker,
      source: leadIntel.source, linkedInUrl: leadIntel.linkedInUrl
    } : null
  }, null, 2));

  process.exit(passed ? 0 : 1);
}

// Run
perfectReport().catch(e => {
  console.error(`\n❌ Perfector failed: ${e.message}`);
  process.exit(1);
});
