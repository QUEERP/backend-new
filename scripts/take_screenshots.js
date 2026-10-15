const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\9f3e3b75-ef81-4b5c-9f6b-5e2f773dacfa';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmMjJjNjU0ZS1jYzJiLTQ1NjUtOWRmYy03NmIwOTcxYWEwN2QiLCJlbWFpbCI6InRlc3QyM0BnbWFpbC5jb20iLCJyb2xlIjoiQURNSU4iLCJpc0FjdGl2ZSI6dHJ1ZSwiaWF0IjoxNzkyMDU0OTA5LCJleHAiOjE3OTI2NTk3MDksImF1ZCI6IlFVRS1BY2NvdW50aW5nLVVzZXJzIiwiaXNzIjoiUVVFLUFjY291bnRpbmcifQ.Xo-HDIwD9ELuDyZ2hm3bumAlJxSXnOkT1h9wgKHW2_8';
const BIZ_ID = 'dc70ca38-b141-477d-a379-f02649117a78';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Launching browser via puppeteer-core with Edge...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 960 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();

    // Navigate to root to set local storage & cookies
    console.log('Setting auth state...');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.evaluate((tok, bId) => {
      localStorage.setItem('token', tok);
      localStorage.setItem('accessToken', tok);
      localStorage.setItem('activeBusinessId', bId);
      document.cookie = `token=${tok}; path=/; max-age=86400`;
    }, TOKEN, BIZ_ID);
    await sleep(600);

    // ==========================================
    // 1. CUSTOMER FORM: India & UAE (Light & Dark)
    // ==========================================
    console.log('Capturing customer form...');
    await page.goto(`http://localhost:5173/dashboard/${BIZ_ID}/customers/add`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    // 1a. Customer Form - India (Light)
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      const countryInput = document.querySelector('input[name="country"]');
      if (countryInput) {
        countryInput.value = 'India';
        countryInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'customer_form_india_light.png'), fullPage: false });
    console.log('✓ Saved customer_form_india_light.png');

    // 1b. Customer Form - India (Dark)
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'customer_form_india_dark.png'), fullPage: false });
    console.log('✓ Saved customer_form_india_dark.png');

    // 1c. Customer Form - UAE (Light)
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      const countryInput = document.querySelector('input[name="country"]');
      if (countryInput) {
        countryInput.value = 'United Arab Emirates';
        countryInput.dispatchEvent(new Event('input', { bubbles: true }));
        countryInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'customer_form_uae_light.png'), fullPage: false });
    console.log('✓ Saved customer_form_uae_light.png');

    // 1d. Customer Form - UAE (Dark)
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'customer_form_uae_dark.png'), fullPage: false });
    console.log('✓ Saved customer_form_uae_dark.png');

    // ==========================================
    // 2. INVOICE FORM: Domestic & Export (Light & Dark)
    // ==========================================
    console.log('Capturing invoice form...');
    await page.goto(`http://localhost:5173/dashboard/${BIZ_ID}/invoices/add`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    // 2a. Invoice Domestic (Light)
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'invoice_form_domestic_light.png'), fullPage: false });
    console.log('✓ Saved invoice_form_domestic_light.png');

    // 2b. Invoice Domestic (Dark)
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'invoice_form_domestic_dark.png'), fullPage: false });
    console.log('✓ Saved invoice_form_domestic_dark.png');

    // 2c. Invoice Export details (Light)
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      window.scrollTo({ top: 380, behavior: 'instant' });
    });
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'invoice_form_export_light.png'), fullPage: false });
    console.log('✓ Saved invoice_form_export_light.png');

    // 2d. Invoice Export details (Dark)
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'invoice_form_export_dark.png'), fullPage: false });
    console.log('✓ Saved invoice_form_export_dark.png');

    // ==========================================
    // 3. STATUTORY TAX REPORT (Light & Dark)
    // ==========================================
    console.log('Capturing statutory tax report...');
    await page.goto(`http://localhost:5173/dashboard/${BIZ_ID}/statutory/tax`, { waitUntil: 'domcontentloaded' });
    await sleep(3500);

    // 3a. Tax Report (Light)
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'tax_report_light.png'), fullPage: false });
    console.log('✓ Saved tax_report_light.png');

    // 3b. Tax Report (Dark)
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'tax_report_dark.png'), fullPage: false });
    console.log('✓ Saved tax_report_dark.png');

    // ==========================================
    // 4. STATUTORY CURRENCY REPORT (Light & Dark)
    // ==========================================
    console.log('Capturing statutory currency report...');
    await page.goto(`http://localhost:5173/dashboard/${BIZ_ID}/statutory/currency`, { waitUntil: 'domcontentloaded' });
    await sleep(3500);

    // 4a. Currency Breakdown (Light)
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'currency_report_breakdown_light.png'), fullPage: false });
    console.log('✓ Saved currency_report_breakdown_light.png');

    // 4b. Currency Breakdown (Dark)
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'currency_report_breakdown_dark.png'), fullPage: false });
    console.log('✓ Saved currency_report_breakdown_dark.png');

    // 4c. Purchases Reconciliation Tab (Light)
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      const tabs = Array.from(document.querySelectorAll('button[role="tab"]'));
      const reconTab = tabs.find(t => t.textContent && t.textContent.includes('Reconciliation'));
      if (reconTab) reconTab.click();
      window.scrollTo({ top: 350, behavior: 'instant' });
    });
    await sleep(1000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'currency_report_reconciliation_light.png'), fullPage: false });
    console.log('✓ Saved currency_report_reconciliation_light.png');

    // 4d. Purchases Reconciliation Tab (Dark)
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await sleep(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'currency_report_reconciliation_dark.png'), fullPage: false });
    console.log('✓ Saved currency_report_reconciliation_dark.png');

    console.log('ALL SCREENSHOTS SUCCESSFULLY CAPTURED!');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Screenshot runner error:', err);
  process.exit(1);
});
