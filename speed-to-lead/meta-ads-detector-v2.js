#!/usr/bin/env node
/**
 * IMPROVED META ADS DETECTOR V2
 * Reliably detects active AND inactive Meta ads
 */

const { chromium } = require('playwright');

async function detectMetaAds(firmName, country = 'US') {
  console.log(`\n🔍 Detecting Meta ads for: ${firmName}`);
  
  const browser = await chromium.launch({ headless: false }); // Show browser for debugging
  const page = await browser.newPage();
  
  const result = {
    hasAds: false,
    hasActiveAds: false,
    hasInactiveAds: false,
    activeCount: 0,
    inactiveCount: 0,
    totalCount: 0,
    pageId: null,
    pageName: null,
    lastActiveDate: null,
    adExamples: [],
    screenshot: null
  };
  
  try {
    // Step 1: Search for firm's ads (active_status=all to get both active + inactive)
    const searchQuery = firmName.replace(/\s+/g, '+');
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${searchQuery}&search_type=keyword_unordered`;
    
    console.log(`   🌍 Searching: ${searchUrl}`);
    await page.goto(searchUrl, { timeout: 30000, waitUntil: 'networkidle' });
    
    // Wait for content to load
    await page.waitForTimeout(5000);
    
    // Take screenshot for debugging
    const screenshotPath = `./reports/meta-search-${firmName.replace(/\s+/g, '-').toLowerCase()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    result.screenshot = screenshotPath;
    console.log(`   📸 Screenshot saved: ${screenshotPath}`);
    
    // Method 1: Look for "Page transparency" link (most reliable way to find the page)
    const pageTransparencyLinks = await page.locator('a[href*="ads/library/?active_status=all"][href*="page_id="]').all();
    
    if (pageTransparencyLinks.length > 0) {
      console.log(`   ✅ Found ${pageTransparencyLinks.length} Facebook page(s) with ad history`);
      
      // Get the first matching page (usually the exact match)
      const firstPageLink = await pageTransparencyLinks[0].getAttribute('href');
      const pageIdMatch = firstPageLink.match(/page_id=(\d+)/);
      
      if (pageIdMatch) {
        result.pageId = pageIdMatch[1];
        console.log(`   📄 Page ID: ${result.pageId}`);
        
        // Navigate to this page's ad library specifically
        const pageAdLibraryUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&view_all_page_id=${result.pageId}`;
        console.log(`   🔗 Loading page ad library: ${pageAdLibraryUrl}`);
        
        await page.goto(pageAdLibraryUrl, { timeout: 30000, waitUntil: 'networkidle' });
        await page.waitForTimeout(5000);
        
        // Take another screenshot
        const pageScreenshot = `./reports/meta-page-${result.pageId}.png`;
        await page.screenshot({ path: pageScreenshot, fullPage: true });
        console.log(`   📸 Page screenshot: ${pageScreenshot}`);
        
        // NOW count ads properly
        const bodyText = await page.textContent('body');
        
        // Look for "Active" ads section
        const activeMatch = bodyText.match(/Active\s+\((\d+)\)/i) || bodyText.match(/(\d+)\s+Active/i);
        if (activeMatch) {
          result.activeCount = parseInt(activeMatch[1]);
          result.hasActiveAds = result.activeCount > 0;
        }
        
        // Look for "Inactive" ads section
        const inactiveMatch = bodyText.match(/Inactive\s+\((\d+)\)/i) || bodyText.match(/(\d+)\s+Inactive/i);
        if (inactiveMatch) {
          result.inactiveCount = parseInt(inactiveMatch[1]);
          result.hasInactiveAds = result.inactiveCount > 0;
        }
        
        // Fallback: count ad articles
        if (result.activeCount === 0 && result.inactiveCount === 0) {
          const adArticles = await page.locator('[role="article"]').all();
          console.log(`   📊 Found ${adArticles.length} ad article(s)`);
          
          for (const article of adArticles) {
            const articleHtml = await article.innerHTML().catch(() => '');
            const articleText = await article.textContent().catch(() => '');
            
            // Check if this article has "Active" or "Inactive" badge
            if (articleText.includes('Active') && !articleText.includes('Inactive')) {
              result.activeCount++;
            } else if (articleText.includes('Inactive')) {
              result.inactiveCount++;
            }
          }
          
          result.hasActiveAds = result.activeCount > 0;
          result.hasInactiveAds = result.inactiveCount > 0;
        }
        
        result.totalCount = result.activeCount + result.inactiveCount;
        result.hasAds = result.totalCount > 0;
        
        // Extract page name
        const pageNameEl = await page.locator('h1, h2').first().textContent().catch(() => '');
        result.pageName = pageNameEl || firmName;
        
        // Try to find date range for inactive ads
        if (result.hasInactiveAds) {
          const dateMatch = bodyText.match(/(\w+ \d+, \d{4})\s*[-–]\s*(\w+ \d+, \d{4})/);
          if (dateMatch) {
            result.lastActiveDate = dateMatch[2];
          }
        }
      }
    } else {
      console.log(`   ❌ No Facebook page found with ad history for "${firmName}"`);
    }
    
    // Print results
    console.log(`\n📊 RESULTS:`);
    console.log(`   Page ID: ${result.pageId || 'Not found'}`);
    console.log(`   Active ads: ${result.activeCount}`);
    console.log(`   Inactive ads: ${result.inactiveCount}`);
    console.log(`   Total: ${result.totalCount}`);
    console.log(`   Status: ${result.hasActiveAds ? '✅ RUNNING ADS' : result.hasInactiveAds ? '⚠️  STOPPED RUNNING' : '❌ NO ADS'}`);
    if (result.lastActiveDate) {
      console.log(`   Last active: ${result.lastActiveDate}`);
    }
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  return result;
}

// CLI usage
if (require.main === module) {
  const firmName = process.argv[2];
  const country = process.argv[3] || 'US';
  
  if (!firmName) {
    console.error('Usage: node meta-ads-detector-v2.js "Firm Name" [country]');
    console.error('Example: node meta-ads-detector-v2.js "Randall, McClenney, Daniels & Dunn P.C. Attorneys At Law" US');
    process.exit(1);
  }
  
  detectMetaAds(firmName, country).then(result => {
    console.log('\n✅ Detection complete!');
    console.log(JSON.stringify(result, null, 2));
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { detectMetaAds };
