#!/usr/bin/env node
/**
 * AI REPORT PERFECTOR — Deterministic QC
 *
 * Replaces the old AI QC loop with fast, reliable regex checks.
 * No more hallucinated issues. No more iteration loops. No more AI API calls for QC.
 *
 * Checks:
 * 1. Currency match (£ for UK, $ for US)
 * 2. Terminology match (solicitor vs attorney, excluding business names)
 * 3. Broken content (undefined, null, NaN, [object Object])
 * 4. Firm name present
 * 5. A/an article errors
 * 6. US corporate suffixes in UK reports
 * 7. Empty prose sections
 *
 * Keeps: preFixCommonIssues(), getLeadIntelligence() (LinkedIn lookup)
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
// LEAD INTELLIGENCE (kept from original — LinkedIn + firm website match)
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
// DETERMINISTIC QC — No AI, no hallucinations
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

function deterministicQC(html, research) {
  const firmName = research.firmName || 'Unknown';
  const country = research.location?.country || '';
  const isUK = country && (country.toUpperCase() === 'GB' || country.toUpperCase() === 'UK');
  const expectedCurrency = isUK ? '£' : '$';
  const wrongCurrency = isUK ? '$' : '£';

  const text = extractText(html);
  const issues = [];
  let score = 10;

  // 1. BROKEN CONTENT — undefined, null, NaN, [object Object]
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

  // 2. CURRENCY MISMATCH — check prose text (not HTML/CSS/JS)
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
      issue: `Found ${wrongCurrencyMatches.length} ${wrongCurrency} amount(s) in a ${isUK ? 'UK' : 'US'} report — should use ${expectedCurrency}`
    });
    score -= 3;
  }

  // 3. TERMINOLOGY MISMATCH — check for wrong attorney/solicitor usage
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
        issue: `Found "attorney" ${attorneyMatches.length} time(s) in UK report — should use "solicitor"`
      });
      score -= 1;
    }
    const lawFirmMatches = checkText.match(/\blaw firm\b/gi);
    if (lawFirmMatches && lawFirmMatches.length > 0) {
      issues.push({
        severity: 'MINOR', category: 'TERMINOLOGY',
        issue: `Found "law firm" ${lawFirmMatches.length} time(s) in UK report — prefer "law practice"`
      });
      // Don't deduct for this — it's minor
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
        issue: `Found "solicitor" ${solicitorMatches.length} time(s) in US report — should use "attorney"`
      });
      score -= 1;
    }
  }

  // 4. FIRM NAME PRESENT — the report should mention the firm
  // Check both raw name and HTML-escaped version (& → &amp;)
  if (firmName && firmName !== 'Unknown' && firmName !== 'Unknown Firm') {
    const htmlEscapedName = firmName.replace(/&/g, '&amp;');
    if (!html.includes(firmName) && !html.includes(htmlEscapedName)) {
      issues.push({
        severity: 'IMPORTANT', category: 'BROKEN',
        issue: `Firm name not found in report`
      });
      score -= 1;
    }
  }

  // 5. A/AN ARTICLE ERRORS
  // Words that start with consonant SOUNDS (so "an X" is wrong): solicitor, family, tax, etc.
  // Note: "employment" starts with vowel sound "em-", so "an employment" is CORRECT — not included here
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
    // Check if it's actually wrong (a estate, a attorney — but "a estate planning" is fine)
    const actualErrors = aVowel.filter(m => {
      const word = m.split(/\s+/)[1].toLowerCase();
      return ['attorney', 'estate', 'accident', 'eviction', 'hour', 'honest'].includes(word);
    });
    if (actualErrors.length > 0) {
      issues.push({
        severity: 'MINOR', category: 'PHRASING',
        issue: `Article error: "${actualErrors[0]}" — should use "an" before vowel sound`
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

  // 7. EMPTY PROSE SECTIONS — check for empty paragraphs or missing content
  const emptyParagraphs = html.match(/<p>\s*<\/p>/gi);
  if (emptyParagraphs && emptyParagraphs.length > 0) {
    issues.push({
      severity: 'IMPORTANT', category: 'BROKEN',
      issue: `Found ${emptyParagraphs.length} empty paragraph(s) in report`
    });
    score -= 1;
  }

  // Clamp score
  score = Math.max(0, Math.min(10, Math.round(score * 2) / 2));

  const wouldBook = score >= 8;
  const verdict = score >= 9
    ? 'Clean report, ready to send.'
    : score >= 7
      ? 'Minor issues but presentable.'
      : 'Report has quality issues that need attention.';

  return {
    score,
    wouldBook,
    issues,
    biggestProblem: issues.length > 0 ? issues[0].issue : null,
    verdict
  };
}

// ============================================================================
// MAIN — Run QC, save results
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

  // Pre-pass: Fix common verbose phrasing issues
  console.log('\n🔧 PRE-PASS: Fixing common phrasing issues...');
  currentHtml = preFixCommonIssues(currentHtml);

  // Save pre-fixed HTML
  if (currentHtml !== reportHtml) {
    fs.writeFileSync(reportFile, currentHtml);
    console.log('💾 Saved pre-fixed report');
  }

  // Run deterministic QC
  console.log('\n🔍 DETERMINISTIC QC');
  const qcResult = deterministicQC(currentHtml, research);

  console.log(`   Score: ${qcResult.score}/10`);
  console.log(`   Would book: ${qcResult.wouldBook ? '✅ YES' : '❌ NO'}`);
  console.log(`   Issues found: ${qcResult.issues.length}`);
  if (qcResult.issues.length > 0) {
    for (const issue of qcResult.issues) {
      console.log(`   [${issue.severity}] ${issue.category}: ${issue.issue}`);
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
    leadIntelligence: leadIntel ? {
      name: leadIntel.name, title: leadIntel.title,
      seniority: leadIntel.seniority, isDecisionMaker: leadIntel.isDecisionMaker,
      source: leadIntel.source
    } : null,
    leadFit: null
  }, null, 2));

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL RESULT');
  console.log('═'.repeat(60));
  console.log(`Score: ${qcResult.score}/10`);
  console.log(`Would book: ${qcResult.wouldBook ? '✅ YES' : '❌ NO'}`);
  console.log(`Verdict: ${qcResult.verdict}`);
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
    leadIntelligence: leadIntel ? {
      name: leadIntel.name, title: leadIntel.title, company: leadIntel.company,
      seniority: leadIntel.seniority, isDecisionMaker: leadIntel.isDecisionMaker,
      source: leadIntel.source, linkedInUrl: leadIntel.linkedInUrl
    } : null,
    leadFit: null
  }, null, 2));

  process.exit(passed ? 0 : 1);
}

// Run
perfectReport().catch(e => {
  console.error(`\n❌ Perfector failed: ${e.message}`);
  process.exit(1);
});
