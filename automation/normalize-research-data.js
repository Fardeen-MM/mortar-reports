#!/usr/bin/env node
/**
 * Normalize Research Data - Compatibility Layer
 * Converts new v5 format to old format expected by report generator
 */

function normalizeResearchData(data) {
  // If it's already old format with gaps, return as-is
  // (Don't check competitors alone - empty array [] is truthy but needs normalization)
  if (data.gaps) {
    return data;
  }
  
  // Transform v5 format to old format
  const normalized = {
    firmName: data.firmName || 'Unknown Firm',
    website: data.website || '',
    location: data.location || {},
    allLocations: data.allLocations || [],
    
    // Practice areas from firmIntel
    practiceAreas: data.firmIntel?.keySpecialties || data.practiceAreas || [],
    
    // Credentials
    credentials: data.firmIntel?.credentials || [],
    
    // Attorneys (use samples from v5)
    attorneys: data.sampleAttorneys || [],
    
    // Add placeholder gaps (we don't have this in v5)
    gaps: {
      googleAds: { hasGap: true, impact: 5000, status: 'not_running' },
      metaAds: { hasGap: true, impact: 5000, status: 'not_running' },
      voiceAI: { hasGap: true, impact: 3000 },
      support24x7: { hasGap: true, impact: 2000 },
      siteSpeed: { hasGap: false, impact: 0 },
      crm: { hasGap: true, impact: 4000 }
    },
    
    // Competitors from research data - NO FALLBACKS (no fake names)
    // If we don't have real competitor data, return empty array
    // The report generator handles this gracefully with "limited data" messaging
    competitors: (data.competitors && data.competitors.length > 0)
      ? data.competitors.map(c => ({
          name: c.name || c.firmName,
          city: c.city || data.location?.city || '',
          state: c.state || data.location?.state || '',
          reviews: c.reviews || c.reviewCount || 0,
          rating: c.rating || 0,
          hasGoogleAds: c.hasGoogleAds || false,
          hasMetaAds: c.hasMetaAds || false,
          hasVoiceAI: c.hasVoiceAI || c.has24x7 || false,
          ...c
        })).filter(c => c.name) // Filter out any without names
      : [], // Empty array - no fake fallbacks
    
    // Calculated metrics - no longer used since hero total is calculated from gaps
    // Keeping field for backwards compatibility but not using a hardcoded default
    estimatedMonthlyRevenueLoss: data.estimatedMonthlyRevenueLoss || 0,
    
    // V5-specific data to preserve
    firmIntel: data.firmIntel,
    
    // AI enhancements if present
    ai_enhancements: data.ai_enhancements || null
  };
  
  return normalized;
}

// CLI mode
if (require.main === module) {
  const fs = require('fs');
  const inputPath = process.argv[2];
  
  if (!inputPath) {
    console.error('Usage: node normalize-research-data.js <input-json>');
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  
  // DEBUG: Log what we received
  console.log(`📊 Input data:`);
  console.log(`   Firm: ${data.firmName}`);
  console.log(`   Location: ${data.location?.city}, ${data.location?.state}`);
  console.log(`   Competitors (input): ${data.competitors ? data.competitors.length : 0}`);
  console.log(`   Has gaps field: ${!!data.gaps}`);
  
  const normalized = normalizeResearchData(data);
  
  // DEBUG: Log what we're outputting
  console.log(`📊 Output data:`);
  console.log(`   Competitors (output): ${normalized.competitors ? normalized.competitors.length : 0}`);
  if (normalized.competitors && normalized.competitors.length > 0) {
    normalized.competitors.forEach((c, i) => console.log(`      ${i+1}. ${c.name}`));
  }
  
  // Overwrite the file with normalized data
  fs.writeFileSync(inputPath, JSON.stringify(normalized, null, 2));
  
  console.log(`✅ Normalized: ${inputPath}`);
}

module.exports = { normalizeResearchData };
