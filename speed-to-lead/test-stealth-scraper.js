const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage'
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US'
  });
  
  const page = await context.newPage();
  
  // Add script to hide automation
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  
  // Try lawyers.com directory - usually less strict
  const url = 'https://www.lawyers.com/toronto/ontario/family-law/';
  
  console.log('Trying lawyers.com:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Try to extract firm names
  const firms1 = await page.locator('h2, h3, .lawyer-name, .firm-name, [class*="name"]').allTextContents();
  console.log('\nFirms found (method 1):', firms1.length);
  console.log('First 10:', firms1.slice(0, 10));
  
  // Screenshot
  await page.screenshot({ path: './reports/lawyers-com-debug.png', fullPage: true });
  
  await browser.close();
})();
