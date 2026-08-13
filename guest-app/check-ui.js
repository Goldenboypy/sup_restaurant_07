const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('console:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('pageerror:', err.message));
  await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const text = await page.locator('body').innerText();
  console.log('BODY_TEXT_START');
  console.log(text.slice(0, 4000));
  console.log('BODY_TEXT_END');
  await browser.close();
})();
