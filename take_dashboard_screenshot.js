const fs = require('fs');
const puppeteer = require('puppeteer-core');

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  
  const domain = 'localhost';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxNTZmOGFmMi0yZjEwLTQzZjMtYmQzOS03MGE0NTAyMzE1M2EiLCJpYXQiOjE3ODg4NTY2MTEsImV4cCI6MTc4OTQ2MTQxMSwiYXVkIjoiUVVFLUFjY291bnRpbmctVXNlcnMiLCJpc3MiOiJRVUUtQWNjb3VudGluZyJ9.f7FL__FD2MUgXu94BfyV8EISkGbGi1GybaNezMMc4eI';
  const bizId = '1f80e27b-bd3f-4cc5-9429-e3758f355d82';
  
  await page.setCookie(
    { name: 'token', value: token, domain: domain },
    { name: 'activeBusinessId', value: bizId, domain: domain }
  );

  const baseUrl = `http://localhost:5173/dashboard/${bizId}`;
  const outDir = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\ddd61627-dd5c-4cdf-b874-ef7f7df12e18';

  try {
    console.log(`Navigating to ${baseUrl}`);
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Give it an extra 2 seconds to load data
    await new Promise(r => setTimeout(r, 2000));
    
    await page.screenshot({ path: `${outDir}\\erp_dashboard_real_screenshot.png` });
    await page.screenshot({ path: `${outDir}\\erp_dashboard_hero_real_screenshot.png` });
    console.log(`Saved dashboard screenshots`);
  } catch (e) {
    console.error(`Failed to capture dashboard: ${e.message}`);
  }

  await browser.close();
}

run().catch(console.error);
