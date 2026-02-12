#!/usr/bin/env node
/**
 * ADS DETECTOR MODULE
 *
 * Detects Google Ads and Meta Ads for a law firm using:
 * - Google Ads Transparency Center (https://adstransparency.google.com)
 * - Meta Ad Library (https://www.facebook.com/ads/library)
 *
 * Requires Playwright for browser automation.
 */

const { chromium } = require('playwright');

/**
 * Normalize a firm name for comparison: lowercase, strip punctuation, remove
 * common legal suffixes (LLP, LLC, PA, PC, PLLC, PLC, Inc, Corp, etc.)
 */
function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[.,&'"""''()-]/g, ' ')
    .replace(/\b(llp|llc|pa|pc|pllc|plc|inc|corp|ltd|co|law\s*firm|law\s*offices?|law\s*group|attorneys?\s*at\s*law|solicitors?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two normalized names are a likely match:
 * one is a substring of the other, or they share enough words
 */
function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  // Substring match either direction
  if (na.includes(nb) || nb.includes(na)) return true;
  // Word overlap: if 2+ meaningful words match
  const wordsA = na.split(' ').filter(w => w.length > 2);
  const wordsB = new Set(nb.split(' ').filter(w => w.length > 2));
  const overlap = wordsA.filter(w => wordsB.has(w)).length;
  return overlap >= 2;
}

/**
 * Detect Google Ads via Ads Transparency Center
 * Searches by firm name for more reliable detection
 */
async function detectGoogleAds(browser, firmName, firmDomain) {
  console.log(`   🔍 Checking "${firmName}" website for Google Ads tracking...`);

  const result = {
    running: false,
    adCount: 0,
    advertiserName: null,
    error: null
  };

  // Need a website to check — construct from domain if needed
  let websiteUrl = '';
  if (firmDomain) {
    const domain = firmDomain.replace(/^www\./, '');
    websiteUrl = `https://www.${domain}`;
  }

  if (!websiteUrl) {
    console.log(`   ⚠️  No website URL available for "${firmName}", skipping ads check`);
    return result;
  }

  const page = await browser.newPage();

  try {
    // Track network requests for Google Ads related domains
    const adsSignals = [];
    page.on('request', (request) => {
      const url = request.url().toLowerCase();
      if (url.includes('googleadservices.com') ||
          url.includes('googleads.g.doubleclick.net') ||
          url.includes('googlesyndication.com') ||
          url.includes('google-analytics.com/collect') ||
          url.includes('gtag/js') ||
          url.includes('ads/ga-audiences') ||
          url.includes('pagead/') ||
          url.includes('conversion/')) {
        adsSignals.push(url.substring(0, 120));
      }
    });

    // Visit the firm's website
    console.log(`   🔗 Visiting: ${websiteUrl}`);
    await page.goto(websiteUrl, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Also check page source for Google Ads scripts
    const hasAdsScripts = await page.evaluate(() => {
      const html = document.documentElement.outerHTML.toLowerCase();
      const signals = {
        googleadservices: html.includes('googleadservices.com'),
        doubleclick: html.includes('doubleclick.net'),
        conversionId: /aw-\d+/.test(html) || /conversion_id/.test(html),
        gtagAds: html.includes('config') && html.includes('aw-'),
        adwordsRemarketing: html.includes('remarketing') && html.includes('google'),
        callTracking: html.includes('calltracking') || html.includes('call-tracking')
      };
      return signals;
    }).catch(() => ({}));

    // Determine if running Google Ads
    const networkAdsFound = adsSignals.length > 0;
    const scriptAdsFound = hasAdsScripts.googleadservices || hasAdsScripts.doubleclick ||
                           hasAdsScripts.conversionId || hasAdsScripts.gtagAds;

    console.log(`   📋 Network requests: ${adsSignals.length} ads-related signal(s)`);
    if (adsSignals.length > 0) {
      console.log(`   🔎 Signals: ${adsSignals.slice(0, 3).join(', ')}`);
    }
    console.log(`   📋 Script signals: ${JSON.stringify(hasAdsScripts)}`);

    if (networkAdsFound || scriptAdsFound) {
      result.running = true;
      result.adCount = Math.max(1, adsSignals.length);
      result.advertiserName = firmName;
      console.log(`   ✅ Google Ads: Running (${networkAdsFound ? 'network' : 'script'} signals detected)`);
    } else {
      console.log(`   ❌ Google Ads: No tracking detected on website`);
    }

  } catch (error) {
    console.log(`   ⚠️  Google Ads check failed: ${error.message}`);
    result.error = error.message;
  } finally {
    await page.close();
  }

  return result;
}

/**
 * Detect Meta Ads via Facebook Ad Library
 * Searches for the firm name and checks for active/inactive ads
 */
async function detectMetaAds(browser, firmName, country = 'US') {
  console.log(`   🔍 Checking Meta Ad Library for "${firmName}"...`);

  const result = {
    hasAds: false,
    hasActiveAds: false,
    hasInactiveAds: false,
    activeCount: 0,
    inactiveCount: 0,
    totalCount: 0,
    pageId: null,
    pageName: null,
    error: null
  };

  const page = await browser.newPage();

  try {
    // Search for firm's ads (active_status=all to get both active + inactive)
    const searchQuery = firmName.replace(/\s+/g, '+');
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${searchQuery}&search_type=keyword_unordered`;

    await page.goto(searchUrl, { timeout: 30000, waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    // Method 1: Look for "Page transparency" link (most reliable way to find the page)
    const pageTransparencyLinks = await page.locator('a[href*="ads/library/?active_status=all"][href*="page_id="]').all();

    if (pageTransparencyLinks.length > 0) {
      // Get the first matching page (usually the exact match)
      const firstPageLink = await pageTransparencyLinks[0].getAttribute('href');
      const pageIdMatch = firstPageLink.match(/page_id=(\d+)/);

      if (pageIdMatch) {
        result.pageId = pageIdMatch[1];

        // Navigate to this page's ad library specifically
        const pageAdLibraryUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&view_all_page_id=${result.pageId}`;
        await page.goto(pageAdLibraryUrl, { timeout: 30000, waitUntil: 'networkidle' });
        await page.waitForTimeout(5000);

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

          for (const article of adArticles) {
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
      }
    }

    if (result.hasActiveAds) {
      console.log(`   ✅ Meta Ads: Running (${result.activeCount} active, ${result.inactiveCount} inactive)`);
    } else if (result.hasInactiveAds) {
      console.log(`   ⚠️  Meta Ads: Previously ran (${result.inactiveCount} inactive ads)`);
    } else {
      console.log(`   ❌ Meta Ads: No ads found`);
    }

  } catch (error) {
    console.log(`   ⚠️  Meta Ads check failed: ${error.message}`);
    result.error = error.message;
  } finally {
    await page.close();
  }

  return result;
}

/**
 * Detect both Google and Meta ads for a firm
 *
 * @param {string} firmName - The law firm's name
 * @param {string} firmDomain - The firm's website domain
 * @param {string} country - Country code (default: US)
 * @returns {Object} - { googleAds: {...}, metaAds: {...} }
 */
async function detectAllAds(firmName, firmDomain, country = 'US') {
  console.log(`\n📱 CHECKING ADVERTISING PRESENCE`);
  console.log(`   Firm: ${firmName}`);
  console.log(`   Domain: ${firmDomain}\n`);

  const browser = await chromium.launch({ headless: true });

  try {
    // Run both checks (could be parallel but sequential is more stable)
    const googleAds = await detectGoogleAds(browser, firmName, firmDomain);
    const metaAds = await detectMetaAds(browser, firmName, country);

    return {
      googleAds,
      metaAds,
      summary: {
        runningGoogleAds: googleAds.running,
        runningMetaAds: metaAds.hasActiveAds,
        googleAdCount: googleAds.adCount,
        metaAdCount: metaAds.activeCount,
        anyAdsRunning: googleAds.running || metaAds.hasActiveAds
      }
    };

  } finally {
    await browser.close();
  }
}

/**
 * Detect ads using an existing browser instance
 * (For integration into research pipeline)
 */
async function detectAdsWithBrowser(browser, firmName, firmDomain, country = 'US') {
  console.log(`\n📱 CHECKING ADVERTISING PRESENCE`);

  const googleAds = await detectGoogleAds(browser, firmName, firmDomain);
  const metaAds = await detectMetaAds(browser, firmName, country);

  return {
    googleAds,
    metaAds,
    summary: {
      runningGoogleAds: googleAds.running,
      runningMetaAds: metaAds.hasActiveAds,
      googleAdCount: googleAds.adCount,
      metaAdCount: metaAds.activeCount,
      anyAdsRunning: googleAds.running || metaAds.hasActiveAds
    }
  };
}

// CLI usage
if (require.main === module) {
  const firmName = process.argv[2];
  const firmDomain = process.argv[3];
  const country = process.argv[4] || 'US';

  if (!firmName || !firmDomain) {
    console.error('Usage: node ads-detector.js "Firm Name" "domain.com" [country]');
    console.error('Example: node ads-detector.js "Gallardo Law Firm" "gallardolawfirm.com" US');
    process.exit(1);
  }

  detectAllAds(firmName, firmDomain, country).then(result => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ADS DETECTION RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify(result, null, 2));
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { detectAllAds, detectAdsWithBrowser, detectGoogleAds, detectMetaAds };
