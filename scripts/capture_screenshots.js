const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { generateToken } = require('../src/utils/jwtUtils');

const BIZ_ID = 'e24ee048-2039-4c2e-a1c9-24bf7b2f943e';
const USER_ID = '71f7eb5c-91fd-465a-bc30-777eb6c04086';
const USER_EMAIL = 'devpriya@gmail.com';

const TOKEN = generateToken({
  userId: USER_ID,
  email: USER_EMAIL,
  role: 'ADMIN',
  isActive: true,
  activeBusinessId: BIZ_ID
});

const ARTIFACT_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\1c1b6d4e-273e-435c-818a-1f4daa6c19b7';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    defaultViewport: { width: 1440, height: 980 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    await page.setCookie(
      { name: 'token', value: TOKEN, domain: 'localhost', path: '/' },
      { name: 'accessToken', value: TOKEN, domain: 'localhost', path: '/' },
      { name: 'activeBusinessId', value: BIZ_ID, domain: 'localhost', path: '/' }
    );

    await page.evaluateOnNewDocument((token, bizId) => {
      localStorage.setItem('token', token);
      localStorage.setItem('accessToken', token);
      localStorage.setItem('activeBusinessId', bizId);
    }, TOKEN, BIZ_ID);

    const invoiceUrl = `http://localhost:5173/dashboard/${BIZ_ID}/invoices/add`;
    console.log('Navigating to Invoice Add page:', invoiceUrl);
    await page.goto(invoiceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('Waiting for Currency button to mount in DOM...');
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('button')).some(b => 
        b.innerText.includes('CAD - Canadian Dollar') || b.innerText.includes('Select currency')
      );
    }, { timeout: 20000 });

    console.log('Currency button mounted! Finding and clicking it...');
    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText.includes('CAD - Canadian Dollar') || b.innerText.includes('Select currency')
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked currency button:', clicked);

    await new Promise(r => setTimeout(r, 1000));

    console.log('Typing AED in cmdk search input...');
    const searchInput = await page.waitForSelector('input[placeholder*="Search currency"]', { timeout: 5000 });
    if (searchInput) {
      await searchInput.type('AED', { delay: 100 });
      await new Promise(r => setTimeout(r, 600));

      const optionClicked = await page.evaluate(() => {
        const item = Array.from(document.querySelectorAll('[cmdk-item], [role="option"]')).find(el => 
          el.innerText.includes('AED') || el.innerText.includes('UAE Dirham')
        );
        if (item) {
          item.click();
          return true;
        }
        return false;
      });
      console.log('Clicked AED option in dropdown:', optionClicked);
    }

    console.log('Waiting for Live FX Rate banner (1 AED = ... CAD)...');
    await page.waitForFunction(() => {
      return document.body.innerText.includes('1 AED =') && !document.querySelector('.animate-spin');
    }, { timeout: 20000 });

    console.log('Rate banner fully loaded!');
    await new Promise(r => setTimeout(r, 1500));

    const invoiceScreenshotPath = path.join(ARTIFACT_DIR, 'invoice_form_live.png');
    await page.screenshot({ path: invoiceScreenshotPath, fullPage: false });
    console.log('Saved Invoice Form screenshot to:', invoiceScreenshotPath);

  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

capture();
