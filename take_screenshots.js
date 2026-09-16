const fs = require('fs');
const puppeteer = require('puppeteer-core');

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  
  // Set cookies
  const domain = 'localhost';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxNTZmOGFmMi0yZjEwLTQzZjMtYmQzOS03MGE0NTAyMzE1M2EiLCJpYXQiOjE3ODg4NTY2MTEsImV4cCI6MTc4OTQ2MTQxMSwiYXVkIjoiUVVFLUFjY291bnRpbmctVXNlcnMiLCJpc3MiOiJRVUUtQWNjb3VudGluZyJ9.f7FL__FD2MUgXu94BfyV8EISkGbGi1GybaNezMMc4eI';
  const bizId = '1f80e27b-bd3f-4cc5-9429-e3758f355d82';
  
  await page.setCookie(
    { name: 'token', value: token, domain: domain },
    { name: 'activeBusinessId', value: bizId, domain: domain }
  );

  const baseUrl = `http://localhost:5173/dashboard/${bizId}`;
  const outDir = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\ddd61627-dd5c-4cdf-b874-ef7f7df12e18';

  const screens = [
    { url: baseUrl, name: 'erp_dashboard_real_screenshot.png' },
    { url: `${baseUrl}/sales-orders`, name: 'erp_sales_real_screenshot.png' },
    { url: `${baseUrl}/invoices`, name: 'erp_so_invoice_real_screenshot.png' },
    { url: `${baseUrl}/purchase-orders`, name: 'erp_po_grn_real_screenshot.png' },
    { url: `${baseUrl}/stock`, name: 'erp_inventory_real_screenshot.png' },
    { url: `${baseUrl}/tax-rules`, name: 'erp_tax_config_real_screenshot.png' },
    { url: `${baseUrl}/roles`, name: 'erp_roles_real_screenshot.png' },
    { url: `${baseUrl}/sales-report`, name: 'erp_audit_reports_real_screenshot.png' }
  ];

  for (const s of screens) {
    try {
      console.log(`Navigating to ${s.url}`);
      await page.goto(s.url, { waitUntil: 'networkidle0', timeout: 15000 });
      await page.screenshot({ path: `${outDir}\\${s.name}` });
      console.log(`Saved ${s.name}`);
    } catch (e) {
      console.error(`Failed to capture ${s.name}: ${e.message}`);
    }
  }

  await browser.close();
}

run().catch(console.error);
