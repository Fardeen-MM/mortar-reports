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
  console.log(`   🔍 Checking Google Ads Transparency Center for "${firmName}"...`);

  const result = {
    running: false,
    adCount: 0,
    advertiserName: null,
    error: null
  };

  const page = await browser.newPage();

  try {
    // Go to Google Ads Transparency Center
    await page.goto('https://adstransparency.google.com/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Find and use the search input
    const searchInput = page.locator('input[type="text"], input[type="search"], [role="searchbox"], [role="combobox"]').first();
    if (await searchInput.count() === 0) {
      console.log(`   ⚠️  Could not find search input on Google Ads Transparency Center`);
      return result;
    }

    await searchInput.click();
    await page.waitForTimeout(500);
    // Type slowly to trigger autocomplete
    await searchInput.fill('');
    await page.type('input:focus', firmName, { delay: 50 });
    await page.waitForTimeout(3000);

    // Try clicking autocomplete suggestion matching firm name
    let clickedSuggestion = false;
    try {
      // Look for suggestion items — try multiple selectors
      const suggestionSelectors = [
        '[role="option"]', '[role="listbox"] li', '[class*="suggestion"]',
        '[class*="dropdown"] li', '[class*="autocomplete"] li', '[class*="menu"] li'
      ];
      for (const sel of suggestionSelectors) {
        const suggestions = await page.locator(sel).all();
        if (suggestions.length > 0) {
          console.log(`   📋 Found ${suggestions.length} autocomplete suggestions (${sel})`);
          // Try to find one matching our firm name
          for (const sug of suggestions) {
            const sugText = await sug.textContent().catch(() => '');
            console.log(`   🔎 Suggestion: "${(sugText || '').replace(/\s+/g, ' ').substring(0, 100)}"`);
            if (namesMatch(sugText, firmName)) {
              await sug.click();
              clickedSuggestion = true;
              console.log(`   ✅ Clicked matching suggestion`);
              break;
            }
          }
          if (!clickedSuggestion && suggestions.length > 0) {
            // No name match — click first suggestion anyway
            await suggestions[0].click();
            clickedSuggestion = true;
            console.log(`   📋 Clicked first suggestion (no name match)`);
          }
          break;
        }
      }
    } catch (e) {
      console.log(`   ⚠️  Autocomplete click failed: ${e.message}`);
    }

    // If no autocomplete, press Enter as fallback
    if (!clickedSuggestion) {
      console.log(`   📋 No autocomplete suggestions found, pressing Enter`);
      await page.keyboard.press('Enter');
    }

    // Wait for results page to load
    await page.waitForTimeout(6000);

    // Use innerText to get only VISIBLE text (excludes <script> tags)
    const bodyText = await page.evaluate(() => document.body.innerText);
    const currentUrl = page.url();

    // Debug: log URL and visible text
    const cleanBody = bodyText.replace(/\s+/g, ' ').trim();
    console.log(`   🔗 Current URL: ${currentUrl}`);
    console.log(`   🔎 Visible text (first 500 chars): "${cleanBody.substring(0, 500)}"`);

      // Check for "no results" indicators
      const hasNoResults = bodyText.includes('No ads found') ||
                           bodyText.includes('no ads to show') ||
                           bodyText.includes("hasn't advertised") ||
                           bodyText.includes('No results found');

      let adCount = 0;
      let matched = false;
      const domainBase = (firmDomain || '').replace(/^www\./, '').toLowerCase();
      const normalizedFirm = normalizeName(firmName);

      // Approach 1: Find clickable advertiser links that match the firm
      try {
        const links = await page.locator('a').all();
        console.log(`   📋 Scanning ${links.length} links for name/domain match...`);
        for (const link of links) {
          const linkText = await link.textContent().catch(() => '');
          if (!linkText || linkText.length < 3) continue;

          const isNameMatch = namesMatch(linkText, firmName);
          const isDomainMatch = domainBase && linkText.toLowerCase().includes(domainBase);
          if (!isNameMatch && !isDomainMatch) continue;

          // Found a matching link — look for ad count in nearby context
          const parentText = await link.evaluate(el => {
            // Walk up to find a row/container with ad count info
            let parent = el.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
              const text = parent.textContent || '';
              if (/\d+/.test(text) && text.length > 10 && text.length < 500) return text;
              parent = parent.parentElement;
            }
            return el.parentElement?.textContent || '';
          }).catch(() => '');

          const countMatch = parentText.match(/(\d[\d,]*)\s+ads?/i) ||
                             parentText.match(/(\d[\d,]*)\s+creatives?/i);
          const cardAdCount = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : 1;

          adCount = cardAdCount;
          result.advertiserName = linkText.trim().substring(0, 80);
          matched = true;
          const matchType = isNameMatch ? 'Name' : `Domain (${domainBase})`;
          console.log(`   🎯 ${matchType} match via link: "${result.advertiserName}" → ${adCount} ads`);
          break;
        }
      } catch (linkErr) {
        console.log(`   ⚠️  Link extraction failed: ${linkErr.message}`);
      }

      // Approach 2: Body text scan — check if firm name appears on page with ad counts
      if (!matched) {
        const normalizedBody = normalizeName(bodyText);
        const firmInBody = normalizedBody.includes(normalizedFirm);
        const domainInBody = domainBase && bodyText.toLowerCase().includes(domainBase);

        if (firmInBody || domainInBody) {
          console.log(`   📋 Firm ${firmInBody ? 'name' : 'domain'} found in page text, extracting ad count...`);
          const adMatches = bodyText.match(/(\d[\d,]*)\s+ads?/gi) || [];
          for (const match of adMatches) {
            const num = parseInt(match.match(/(\d[\d,]*)/)[1].replace(/,/g, ''));
            if (num > 0 && num < 10000) {
              adCount = Math.max(adCount, num);
            }
          }
          if (adCount > 0) {
            matched = true;
            result.advertiserName = firmName;
            console.log(`   🎯 Body text match: "${firmName}" → ${adCount} ads`);
          } else {
            // Firm name on page but no "N ads" pattern — still counts as running
            adCount = 1;
            matched = true;
            result.advertiserName = firmName;
            console.log(`   🎯 Firm found on page but no ad count extracted, marking as 1 ad`);
          }
        } else {
          console.log(`   ❌ Firm name/domain not found in page text`);
        }
      }

      // Sanity cap: most law firms run < 20 ads
      adCount = Math.min(adCount, 50);

      // Final determination
      result.running = !hasNoResults && adCount > 0;
      result.adCount = adCount;

      if (result.running) {
        console.log(`   ✅ Google Ads: Running (${result.adCount} ads detected${matched ? ', name-matched' : ''})`);
      } else {
        console.log(`   ❌ Google Ads: Not running`);
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
