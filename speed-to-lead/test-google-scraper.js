const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('https://www.google.com/search?q=family+law+lawyer+Toronto', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  
  await page.waitForTimeout(3000);
  
  // Try to extract search result titles
  console.log('Trying different selectors...\n');
  
  // Method 1: h3 tags
  const h3s = await page.locator('h3').allTextContents();
  console.log('H3 tags found:', h3s.length);
  console.log('First 5 H3s:', h3s.slice(0, 5));
  
  // Method 2: Look for specific Google result selectors
  const results1 = await page.locator('.g .yuRUbf h3').allTextContents();
  console.log('\n.g .yuRUbf h3:', results1.length);
  console.log('First 5:', results1.slice(0, 5));
  
  // Method 3: Try data-attrid
  const results2 = await page.locator('[data-attrid] h3').allTextContents();
  console.log('\n[data-attrid] h3:', results2.length);
  console.log('First 5:', results2.slice(0, 5));
  
  // Method 4: Try to get all divs with certain structure
  const results3 = await page.locator('div[data-hveid] h3').allTextContents();
  console.log('\ndiv[data-hveid] h3:', results3.length);
  console.log('First 5:', results3.slice(0, 5));
  
  // Take screenshot for debugging
  await page.screenshot({ path: './reports/google-search-debug.png', fullPage: true });
  console.log('\nScreenshot saved to ./reports/google-search-debug.png');
  
  await browser.close();
})();
