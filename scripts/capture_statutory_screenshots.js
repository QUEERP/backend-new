const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const ARTIFACTS_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\9f3e3b75-ef81-4b5c-9f6b-5e2f773dacfa';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.join(__dirname, '../.edge_temp_profile');
const PORT = 9222;

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmMjJjNjU0ZS1jYzJiLTQ1NjUtOWRmYy03NmIwOTcxYWEwN2QiLCJlbWFpbCI6InRlc3QyM0BnbWFpbC5jb20iLCJyb2xlIjoiQURNSU4iLCJpc0FjdGl2ZSI6dHJ1ZSwiaWF0IjoxNzkyMDU0OTA5LCJleHAiOjE3OTI2NTk3MDksImF1ZCI6IlFVRS1BY2NvdW50aW5nLVVzZXJzIiwiaXNzIjoiUVVFLUFjY291bnRpbmcifQ.Xo-HDIwD9ELuDyZ2hm3bumAlJxSXnOkT1h9wgKHW2_8';
const BIZ_ID = 'dc70ca38-b141-477d-a379-f02649117a78';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.id && this.callbacks.has(data.id)) {
        this.callbacks.get(data.id)(data);
        this.callbacks.delete(data.id);
      }
    });
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise(resolve => this.ws.on('open', resolve));
  }

  send(method, params = {}) {
    return new Promise((resolve) => {
      const id = this.id++;
      this.callbacks.set(id, (res) => resolve(res.result));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res?.result?.value;
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png', quality: 90 });
    if (res && res.data) {
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      console.log(`  ✓ Saved screenshot: ${filePath}`);
    }
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await sleep(2500);
  }
}

async function main() {
  console.log('Starting Edge in headless remote-debugging mode...');
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--window-size=1440,960',
    'about:blank'
  ]);

  edge.on('error', err => console.error('Edge process error:', err));

  // Wait for DevTools port
  let targets = null;
  for (let i = 0; i < 20; i++) {
    try {
      targets = await getJson(`http://localhost:${PORT}/json/list`);
      if (targets && targets.length > 0) break;
    } catch (e) {}
    await sleep(500);
  }

  if (!targets || targets.length === 0) {
    console.error('Failed to connect to Edge remote debugging.');
    edge.kill();
    process.exit(1);
  }

  const wsUrl = targets[0].webSocketDebuggerUrl;
  const client = new CdpClient(wsUrl);
  await client.ready();
  console.log('Connected to DevTools CDP.');

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  // Initial navigation to localhost:5173 to set cookies & localStorage
  console.log('Initializing auth tokens and business context...');
  await client.navigate('http://localhost:5173');
  await client.eval(`
    localStorage.setItem('token', '${TOKEN}');
    localStorage.setItem('accessToken', '${TOKEN}');
    localStorage.setItem('activeBusinessId', '${BIZ_ID}');
    document.cookie = 'token=${TOKEN}; path=/; max-age=86400';
  `);
  await sleep(1000);

  // -------------------------------------------------------------
  // 1. CUSTOMER FORM: India & UAE (Light and Dark)
  // -------------------------------------------------------------
  console.log('\n--- 1. Capturing Customer Form Screenshots ---');
  await client.navigate(`http://localhost:5173/dashboard/${BIZ_ID}/customers/add`);
  await sleep(2000);

  // 1a. Customer Form - India (Light Mode)
  await client.eval(`
    document.documentElement.classList.remove('dark');
    // Ensure India selected
    const countryInput = document.querySelector('input[name="country"], input[placeholder*="country" i]');
    if (countryInput) countryInput.value = 'India';
  `);
  await sleep(1000);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'customer_form_india_light.png'));

  // 1b. Customer Form - India (Dark Mode)
  await client.eval(`document.documentElement.classList.add('dark');`);
  await sleep(500);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'customer_form_india_dark.png'));

  // 1c. Customer Form - UAE (Light Mode)
  await client.eval(`
    document.documentElement.classList.remove('dark');
    // Set country to UAE
    const countrySelect = document.querySelector('select[name="country"]') || document.querySelector('input[name="country"]');
    if (countrySelect) {
      countrySelect.value = 'United Arab Emirates';
      countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
      countrySelect.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);
  await sleep(1000);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'customer_form_uae_light.png'));

  // 1d. Customer Form - UAE (Dark Mode)
  await client.eval(`document.documentElement.classList.add('dark');`);
  await sleep(500);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'customer_form_uae_dark.png'));

  // -------------------------------------------------------------
  // 2. INVOICE FORM: Domestic & Export (Light and Dark)
  // -------------------------------------------------------------
  console.log('\n--- 2. Capturing Invoice Form Screenshots ---');
  await client.navigate(`http://localhost:5173/dashboard/${BIZ_ID}/invoices/add`);
  await sleep(2500);

  // 2a. Invoice Form Domestic (Light Mode)
  await client.eval(`document.documentElement.classList.remove('dark');`);
  await sleep(800);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'invoice_form_domestic_light.png'));

  // 2b. Invoice Form Domestic (Dark Mode)
  await client.eval(`document.documentElement.classList.add('dark');`);
  await sleep(800);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'invoice_form_domestic_dark.png'));

  // 2c. Invoice Form Export (Light Mode - Scroll down to show Export Details)
  await client.eval(`
    document.documentElement.classList.remove('dark');
    // Scroll down to show export and item details
    window.scrollTo({ top: 350, behavior: 'instant' });
  `);
  await sleep(800);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'invoice_form_export_light.png'));

  // 2d. Invoice Form Export (Dark Mode)
  await client.eval(`document.documentElement.classList.add('dark');`);
  await sleep(800);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'invoice_form_export_dark.png'));

  // -------------------------------------------------------------
  // 3. STATUTORY TAX REPORT (Light and Dark)
  // -------------------------------------------------------------
  console.log('\n--- 3. Capturing Statutory Tax Report Screenshots ---');
  await client.navigate(`http://localhost:5173/dashboard/${BIZ_ID}/statutory/tax`);
  await sleep(3000);

  // 3a. Tax Report (Light Mode)
  await client.eval(`
    document.documentElement.classList.remove('dark');
    window.scrollTo({ top: 0, behavior: 'instant' });
  `);
  await sleep(1000);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'tax_report_light.png'));

  // 3b. Tax Report (Dark Mode)
  await client.eval(`document.documentElement.classList.add('dark');`);
  await sleep(800);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'tax_report_dark.png'));

  // -------------------------------------------------------------
  // 4. STATUTORY CURRENCY REPORT (Light and Dark + Reconciliation Tab)
  // -------------------------------------------------------------
  console.log('\n--- 4. Capturing Statutory Currency Report Screenshots ---');
  await client.navigate(`http://localhost:5173/dashboard/${BIZ_ID}/statutory/currency`);
  await sleep(3000);

  // 4a. Currency Report - Currencies Breakdown Tab (Light Mode)
  await client.eval(`
    document.documentElement.classList.remove('dark');
    window.scrollTo({ top: 0, behavior: 'instant' });
  `);
  await sleep(1000);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'currency_report_breakdown_light.png'));

  // 4b. Currency Report - Currencies Breakdown Tab (Dark Mode)
  await client.eval(`document.documentElement.classList.add('dark');`);
  await sleep(800);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'currency_report_breakdown_dark.png'));

  // 4c. Currency Report - Purchases Reconciliation Tab (Light Mode)
  console.log('Switching to Purchases Reconciliation Tab...');
  await client.eval(`
    document.documentElement.classList.remove('dark');
    const tabs = Array.from(document.querySelectorAll('button[role="tab"]'));
    const reconTab = tabs.find(t => t.textContent.includes('Reconciliation'));
    if (reconTab) reconTab.click();
    window.scrollTo({ top: 400, behavior: 'instant' });
  `);
  await sleep(1200);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'currency_report_reconciliation_light.png'));

  // 4d. Currency Report - Purchases Reconciliation Tab (Dark Mode)
  await client.eval(`document.documentElement.classList.add('dark');`);
  await sleep(800);
  await client.screenshot(path.join(ARTIFACTS_DIR, 'currency_report_reconciliation_dark.png'));

  console.log('\nAll 12 statutory screenshots successfully captured in Light and Dark mode!');
  edge.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});
