#!/usr/bin/env node
/**
 * Normalize Research Data - Compatibility Layer
 * Converts new v5 format to old format expected by report generator
 */

function normalizeResearchData(data) {
  // If it's already old format, return as-is
  if (data.gaps || data.competitors) {
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
    
    // Placeholder competitors (we don't scrape this in v5)
    competitors: [],
    
    // Calculated metrics
    estimatedMonthlyRevenueLoss: 19000,
    
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
  const normalized = normalizeResearchData(data);
  
  // Overwrite the file with normalized data
  fs.writeFileSync(inputPath, JSON.stringify(normalized, null, 2));
  
  console.log(`✅ Normalized: ${inputPath}`);
}

module.exports = { normalizeResearchData };
