/**
 * FIRM INFO EXTRACTION
 * Extracts firm name and contact info when webhook payload is incomplete
 */

const Anthropic = require('@anthropic-ai/sdk');

// ============================================================================
// FIRM NAME EXTRACTION
// ============================================================================

async function extractFirmName(websitePages, firmWebsite, anthropicClient) {
  console.log('\n🔍 EXTRACTING FIRM NAME (webhook payload was incomplete)');
  
  if (!websitePages || websitePages.length === 0) {
    console.log('   ⚠️  No website pages to extract from');
    return extractFromDomain(firmWebsite);
  }
  
  const homepage = websitePages[0];
  
  // Method 1: Extract from <title> tag
  if (homepage.title) {
    const titleName = cleanFirmName(homepage.title);
    if (titleName && titleName.length > 3) {
      console.log(`   ✅ Extracted from <title>: ${titleName}`);
      return titleName;
    }
  }
  
  // Method 2: Look for law firm patterns in HTML
  const htmlName = extractFromHTML(homepage.html);
  if (htmlName) {
    console.log(`   ✅ Extracted from HTML: ${htmlName}`);
    return htmlName;
  }
  
  // Method 3: AI inference from homepage text
  try {
    const aiName = await extractWithAI(homepage.text, firmWebsite, anthropicClient);
    if (aiName) {
      console.log(`   ✅ AI extracted: ${aiName}`);
      return aiName;
    }
  } catch (error) {
    console.log(`   ⚠️  AI extraction failed: ${error.message}`);
  }
  
  // Method 4: Extract from domain
  const domainName = extractFromDomain(firmWebsite);
  console.log(`   ⚠️  Using domain-based name: ${domainName}`);
  return domainName;
}

function cleanFirmName(rawName) {
  if (!rawName) return '';
  
  // Remove common suffixes and noise
  let cleaned = rawName
    .replace(/\s*[-|–—]\s*.*/g, '') // Remove everything after dash/pipe
    .replace(/\s*(LLC|LLP|PLLC|PC|P\.C\.|L\.L\.C\.|L\.L\.P\.|P\.L\.L\.C\.)\.?\s*$/i, '') // Remove entity types
    .replace(/\s*(Law Firm|Attorneys?|Lawyers?)\s*$/i, '') // Remove generic terms
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses
    .trim();
  
  return cleaned;
}

function extractFromHTML(html) {
  if (!html) return null;
  
  // Look for law firm name patterns in common HTML structures
  const patterns = [
    /<h1[^>]*>([^<]{3,60}(?:Law|Legal|Attorney|Lawyer|Firm)[^<]{0,30})<\/h1>/i,
    /<h1[^>]*>([A-Z][a-zA-Z\s&,.']+(?:LLC|LLP|PLLC|PC))<\/h1>/i,
    /class=["'](?:logo|site-title|firm-name|brand)["'][^>]*>([^<]{3,60})<\/[^>]+>/i,
    /<title>([^<]{3,60}(?:Law|Legal|Attorney|Lawyer)[^<]{0,30})<\/title>/i
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const name = cleanFirmName(match[1]);
      if (name.length > 3) {
        return name;
      }
    }
  }
  
  return null;
}

async function extractWithAI(homepageText, website, anthropicClient) {
  const prompt = `Extract the law firm name from this homepage text. Return ONLY the firm name, nothing else.

Homepage text:
${homepageText.substring(0, 5000)}

Website: ${website}

Rules:
- Return the FULL legal name (e.g., "Smith & Associates LLP" not just "Smith")
- Do NOT include "Law Firm", "Attorneys", etc. unless part of official name
- Return ONLY the name, no explanation
- If you can't determine it with 90%+ confidence, return: UNKNOWN`;

  try {
    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      temperature: 0,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    const name = response.content[0].text.trim();
    if (name && name !== 'UNKNOWN' && name.length > 2) {
      return cleanFirmName(name);
    }
  } catch (error) {
    console.log(`   ⚠️  AI extraction error: ${error.message}`);
  }
  
  return null;
}

function extractFromDomain(website) {
  try {
    const url = new URL(website);
    const hostname = url.hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    
    if (parts.length >= 2) {
      // Take the domain name part, convert to Title Case
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
// CONTACT NAME EXTRACTION
// ============================================================================

async function extractContactName(email, intelligence, anthropicClient) {
  console.log('\n👤 EXTRACTING CONTACT NAME (webhook payload was incomplete)');
  
  // Method 1: Extract from email
  if (email && email.includes('@')) {
    const namePart = email.split('@')[0];
    const cleanName = namePart
      .replace(/[._-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    if (cleanName.length > 2) {
      console.log(`   ✅ Extracted from email: ${cleanName}`);
      return cleanName;
    }
  }
  
  // Method 2: Use first key decision maker from AI intelligence
  if (intelligence && intelligence.keyDecisionMakers && intelligence.keyDecisionMakers.length > 0) {
    const firstContact = intelligence.keyDecisionMakers[0];
    if (firstContact.name) {
      console.log(`   ✅ Using key decision maker: ${firstContact.name}`);
      return firstContact.name;
    }
  }
  
  // Fallback
  console.log('   ⚠️  Using generic fallback: Partner');
  return 'Partner';
}

module.exports = {
  extractFirmName,
  extractContactName
};
