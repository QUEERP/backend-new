const fs = require('fs');
const puppeteer = require('puppeteer-core');

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  const outDir = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\ddd61627-dd5c-4cdf-b874-ef7f7df12e18';

  try {
    await page.goto('https://erp.queinfotech.com/signin', { waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', 'devpriya@gmail.com');
    await page.type('input[type="password"]', 'devpriya@123');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    const currentUrl = page.url();
    const baseUrl = currentUrl.split('?')[0];

    const screens = [
      { url: `${baseUrl}/projects`, name: 'hosted_projects.png' },
      { url: `${baseUrl}/employees`, name: 'hosted_hr.png' }
    ];

    for (const s of screens) {
      console.log(`Navigating to ${s.url}`);
      await page.goto(s.url, { waitUntil: 'networkidle2', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: `${outDir}\\${s.name}` });
      console.log(`Saved ${s.name}`);
    }

  } catch (e) {
    console.error(`Script error: ${e.message}`);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
