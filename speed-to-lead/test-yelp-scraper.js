const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Search Yelp for family lawyers in Toronto
  const url = 'https://www.yelp.com/search?find_desc=family+law+lawyer&find_loc=Toronto%2C+ON';
  
  console.log('Searching Yelp:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Extract business names
  const businesses = await page.locator('h3 a, h2 a, [class*="businessName"]').allTextContents();
  
  console.log('\nBusinesses found:', businesses.length);
  console.log('\nFirst 10:');
  businesses.slice(0, 10).forEach((name, i) => {
    console.log(`${i + 1}. ${name}`);
  });
  
  // Screenshot
  await page.screenshot({ path: './reports/yelp-search-debug.png', fullPage: true });
  console.log('\nScreenshot saved');
  
  await browser.close();
})();
