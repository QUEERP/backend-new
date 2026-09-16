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
    console.log('Navigating to login page...');
    await page.goto('https://erp.queinfotech.com/signin', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: `${outDir}\\hosted_login.png` });

    console.log('Filling credentials...');
    // Assuming standard email/password fields
    await page.type('input[type="email"]', 'devpriya@gmail.com');
    await page.type('input[type="password"]', 'devpriya@123');
    await page.click('button[type="submit"]');

    console.log('Waiting for dashboard navigation...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    
    // Extra wait for dashboard to fully render
    await new Promise(r => setTimeout(r, 5000));
    
    await page.screenshot({ path: `${outDir}\\hosted_dashboard.png` });
    
    // We can try to grab the active business ID from URL or just click menu links
    // It's safer to just extract the base URL after login
    const currentUrl = page.url(); // e.g. https://erp.queinfotech.com/dashboard/xxx
    console.log('Current URL after login:', currentUrl);
    
    const baseUrl = currentUrl.split('?')[0]; // Remove query params if any
    
    const screens = [
      { url: `${baseUrl}/sales-orders`, name: 'hosted_sales.png' },
      { url: `${baseUrl}/purchase-orders`, name: 'hosted_purchase.png' },
      { url: `${baseUrl}/stock`, name: 'hosted_inventory.png' },
      { url: `${baseUrl}/invoices`, name: 'hosted_invoices.png' },
      { url: `${baseUrl}/tax-rules`, name: 'hosted_tax.png' },
      { url: `${baseUrl}/roles`, name: 'hosted_roles.png' },
      { url: `${baseUrl}/sales-report`, name: 'hosted_reports.png' }
    ];

    for (const s of screens) {
      console.log(`Navigating to ${s.url}`);
      await page.goto(s.url, { waitUntil: 'networkidle2', timeout: 20000 });
      await new Promise(r => setTimeout(r, 3000)); // Wait for tables to load
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
