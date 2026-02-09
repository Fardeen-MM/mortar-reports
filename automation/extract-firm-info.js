/**
 * INTELLIGENT FIRM INFO EXTRACTION
 * Uses Claude to extract EVERYTHING useful from scraped website data
 * 
 * Philosophy: Give Claude ALL the data, let it figure out what's important
 */

const Anthropic = require('@anthropic-ai/sdk');

// ============================================================================
// COMPREHENSIVE EXTRACTION WITH AI
// ============================================================================

async function extractEverything(websitePages, firmWebsite, anthropicClient) {
  console.log('\n🧠 INTELLIGENT EXTRACTION WITH CLAUDE');
  console.log('   Analyzing all scraped pages...\n');
  
  if (!websitePages || websitePages.length === 0) {
    console.log('   ⚠️  No website pages to extract from');
    return getFallbackData(firmWebsite);
  }
  
  // Build comprehensive context from ALL pages
  const context = buildContext(websitePages, firmWebsite);
  
  const prompt = `You are analyzing a law firm's website. Extract EVERYTHING useful for creating a personalized marketing report.

REQUIRED FIELDS (extract these with 100% certainty or return null):
1. **firmName** - The actual business name (NOT the SEO page title). Look for:
   - Footer copyright
   - Logo text
   - "About Us" mentions
   - Domain name
   Example: If page title is "Best Divorce Lawyers Chicago | Smith Law", the firm name is "Smith Law"

2. **city** - Physical office location city
3. **state** - Physical office location state (2-letter code)
4. **fullAddress** - Complete address with zip
5. **phone** - Main phone number
6. **practiceAreas** - Array of practice areas. CRITICAL EXTRACTION RULES:
   - Be SPECIFIC: "divorce", "child custody", "personal injury", "car accident", NOT just "family law"
   - Look at URL patterns: /divorce/, /family-law/, /personal-injury/, /immigration/
   - Check navigation menu items for practice areas
   - Look at page titles and H1 headings
   - Extract from attorney bio specializations
   - If general practice, list their top 3-5 areas
   - NEVER return empty array if the site clearly serves legal clients
   - Examples: ["divorce", "child custody", "spousal support"] NOT ["family law"]

6b. **practiceAreaCategory** - Pick the ONE best-fitting category from this EXACT list:
   "divorce", "personal injury", "immigration", "criminal", "estate", "business",
   "bankruptcy", "employment", "tax", "landlord", "real estate", "ip",
   "medical malpractice", "workers comp", "default"
   Rules:
   - "divorce" covers ALL family law: divorce, custody, prenups, postnups, matrimonial, separation, cohabitation agreements, family mediation
   - "estate" covers wills, trusts, probate, elder law
   - "default" ONLY if the firm genuinely doesn't fit any category
   - Pick based on the firm's PRIMARY focus, not every area they mention
   - Return the EXACT string from the list above, nothing else

LEADERSHIP & TEAM:
7. **foundingPartners** - Array of founding partners with {name, title, background, photo_url}
8. **keyAttorneys** - Array of all attorneys mentioned with {name, title, specialization, years_experience, bar_admissions, photo_url}
9. **leadership** - Who runs the firm? Managing partner, senior partner, etc.

FIRM DETAILS:
10. **foundedYear** - When was the firm established?
11. **firmSize** - "solo", "small (2-10)", "mid (11-50)", "large (51+)"
12. **officeCount** - How many office locations?
13. **otherLocations** - Array of other office cities/states

SPECIALIZATION & POSITIONING:
14. **primaryFocus** - What are they KNOWN for? (1-2 practice areas they emphasize most)
15. **nicheSpecializations** - Any unique/rare specializations? (e.g., "aviation law", "cannabis law")
16. **targetMarket** - Who are their ideal clients? (individuals, businesses, specific industries)
17. **serviceArea** - Geographic area they serve

CREDIBILITY & PROOF:
18. **awards** - Any awards, recognitions, "Best Lawyers", Super Lawyers, etc.
19. **barAssociations** - Memberships (ABA, state bar, specialty bars)
20. **notableCases** - Any case wins or results mentioned?
21. **clientTestimonials** - Pull 2-3 specific client quotes if available
22. **yearsInBusiness** - How long operating?

MARKETING & TECH:
23. **websiteModernization** - "modern" (2020+), "dated" (2015-2019), "ancient" (<2015)
24. **hasLiveChat** - true/false
25. **hasBlog** - true/false (active = posted in last 6 months)
26. **blogLastPosted** - Date of most recent blog post if has blog
27. **socialMediaPresence** - {facebook, linkedin, twitter, instagram} with URLs if found
28. **videoContent** - Do they have video on site? Attorney intros, testimonials, etc.
29. **languagesOffered** - Any non-English languages mentioned?

BUSINESS SIGNALS:
30. **growthIndicators** - Array of signals (e.g., "hiring", "new office opening", "expanding practice areas")
31. **recentNews** - Any recent news, press releases, or announcements?
32. **communityInvolvement** - Sponsorships, pro bono work, community service mentioned?

DIFFERENTIATION:
33. **uniqueSellingPoints** - What makes them different? Pull from "Why Choose Us" type content
34. **guarantees** - Any guarantees offered? (free consultation, no win no fee, etc.)
35. **pricing** - Any pricing info mentioned? Hourly rates, flat fees, payment plans?

PERSONALITY & CULTURE:
36. **firmPersonality** - "corporate/formal", "approachable/friendly", "aggressive/fighter", "compassionate"
37. **missionStatement** - Their stated mission/values if clearly articulated
38. **firmStory** - Origin story, why they started, personal motivations

CONTACT & OPERATIONS:
39. **email** - General contact email
40. **hoursOfOperation** - Office hours if mentioned
41. **afterHoursAvailable** - Any 24/7 or after-hours service mentioned?
42. **freeConsultation** - Do they offer free initial consultations?

EXTRACT ANYTHING ELSE INTERESTING:
43. **otherInsights** - Array of any other notable facts, unique approaches, specialties, or hooks

RULES:
- Extract from ALL pages, not just homepage
- Use exact text from website when quoting (testimonials, awards, etc.)
- If you can't find something with 90%+ confidence, return null for that field
- For arrays, return empty array [] if nothing found (not null)
- Be specific and accurate - this data will be used in a personalized report
- Look beyond homepage - check About, Team, Practice Areas, Contact pages

Return ONLY valid JSON (no markdown, no explanation):`;

  try {
    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `${prompt}\n\n${context}`
      }]
    });
    
    const text = response.content[0].text;
    
    // Extract JSON from response (handles markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('   ❌ AI did not return valid JSON');
      return getFallbackData(firmWebsite);
    }
    
    const extracted = JSON.parse(jsonMatch[0]);
    
    // Log what was extracted
    console.log('   ✅ Extracted:');
    console.log(`      Firm: ${extracted.firmName || 'MISSING'}`);
    console.log(`      Location: ${extracted.city || '?'}, ${extracted.state || '?'}`);
    console.log(`      Practice Areas: ${(extracted.practiceAreas || []).length} found`);
    console.log(`      Practice Category: ${extracted.practiceAreaCategory || 'not classified'}`);
    console.log(`      Attorneys: ${(extracted.keyAttorneys || []).length} found`);
    console.log(`      Founding Partners: ${(extracted.foundingPartners || []).length} found`);
    console.log(`      Founded: ${extracted.foundedYear || 'unknown'}`);
    console.log(`      Unique Insights: ${(extracted.otherInsights || []).length} found`);
    console.log('');
    
    // Validate critical fields
    if (!extracted.firmName || extracted.firmName === 'null') {
      console.log('   ⚠️  Firm name missing, using domain fallback');
      extracted.firmName = extractFromDomain(firmWebsite);
    }
    
    if (!extracted.city && !extracted.state) {
      console.log('   ⚠️  Location missing, attempting fallback extraction');
      const locationFallback = await extractLocationFallback(context, anthropicClient);
      extracted.city = locationFallback.city;
      extracted.state = locationFallback.state;
    }
    
    // Ensure arrays are arrays
    extracted.practiceAreas = extracted.practiceAreas || [];
    extracted.keyAttorneys = extracted.keyAttorneys || [];
    extracted.foundingPartners = extracted.foundingPartners || [];
    extracted.otherInsights = extracted.otherInsights || [];
    
    return extracted;
    
  } catch (error) {
    console.log(`   ❌ AI extraction failed: ${error.message}`);
    console.error(error.stack);
    return getFallbackData(firmWebsite);
  }
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

function buildContext(websitePages, firmWebsite) {
  let context = `WEBSITE: ${firmWebsite}\n\n`;
  
  // Prioritize important pages
  const pageOrder = ['/', '/about', '/team', '/attorneys', '/contact', '/practice-areas', '/services'];
  
  const sortedPages = websitePages.sort((a, b) => {
    const aPath = new URL(a.url).pathname.toLowerCase();
    const bPath = new URL(b.url).pathname.toLowerCase();
    const aIndex = pageOrder.findIndex(p => aPath.includes(p));
    const bIndex = pageOrder.findIndex(p => bPath.includes(p));
    
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
  
  // Take first 10 pages (prioritized), include text content
  sortedPages.slice(0, 10).forEach((page, i) => {
    const url = page.url;
    const pageName = url.split('/').pop() || 'homepage';
    
    context += `\n${'='.repeat(80)}\n`;
    context += `PAGE ${i + 1}: ${pageName}\n`;
    context += `URL: ${url}\n`;
    context += `TITLE: ${page.title}\n`;
    context += `${'='.repeat(80)}\n\n`;
    context += page.text.substring(0, 8000); // First 8KB of text per page
    context += '\n\n';
  });
  
  return context.substring(0, 180000); // Claude's context limit
}

// ============================================================================
// FALLBACK EXTRACTION (if AI fails completely)
// ============================================================================

function getFallbackData(firmWebsite) {
  console.log('   ⚠️  Using minimal fallback data');
  
  return {
    firmName: extractFromDomain(firmWebsite),
    website: firmWebsite,
    city: null,
    state: null,
    fullAddress: null,
    phone: null,
    practiceAreas: [],
    foundingPartners: [],
    keyAttorneys: [],
    primaryFocus: null,
    firmSize: 'unknown',
    extraction_method: 'fallback'
  };
}

function extractFromDomain(website) {
  try {
    const url = new URL(website);
    const hostname = url.hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    
    if (parts.length >= 2) {
      let name = parts[0]
        .replace(/[-_]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      return name + ' Law';
    }
  } catch {
    return 'Unknown Firm';
  }
  
  return 'Unknown Firm';
}

// ============================================================================
// LOCATION FALLBACK (focused extraction if comprehensive fails)
// ============================================================================

async function extractLocationFallback(context, anthropicClient) {
  console.log('   🔍 Attempting focused location extraction...');
  
  const prompt = `Extract ONLY the physical office location from this law firm website.

${context.substring(0, 50000)}

Return ONLY JSON:
{
  "city": "city name",
  "state": "2-letter state code",
  "fullAddress": "complete address if found"
}

If you cannot find the location with 90%+ confidence, return null for those fields.`;

  try {
    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.log(`   ⚠️  Location fallback failed: ${error.message}`);
  }
  
  return { city: null, state: null, fullAddress: null };
}

// ============================================================================
// LEGACY COMPATIBILITY (for existing code that calls old functions)
// ============================================================================

async function extractFirmName(websitePages, firmWebsite, anthropicClient) {
  const data = await extractEverything(websitePages, firmWebsite, anthropicClient);
  return data.firmName;
}

async function extractContactName(email, intelligence, anthropicClient) {
  // Try to extract from email
  if (email && email.includes('@')) {
    const namePart = email.split('@')[0];
    const cleanName = namePart
      .replace(/[._-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    if (cleanName.length > 2 && !cleanName.match(/^(info|contact|admin|office|support|hello)$/i)) {
      return cleanName;
    }
  }
  
  // Use key decision maker from intelligence
  if (intelligence && intelligence.keyDecisionMakers && intelligence.keyDecisionMakers.length > 0) {
    return intelligence.keyDecisionMakers[0].name;
  }
  
  return 'Partner';
}

module.exports = {
  extractEverything,
  extractFirmName,
  extractContactName
};
