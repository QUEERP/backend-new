const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function main() {
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new',
        defaultViewport: { width: 1280, height: 800 }
    });
    const page = await browser.newPage();
    
    // Screenshot 1: Login
    await page.goto('http://localhost:5173/');
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\ddd61627-dd5c-4cdf-b874-ef7f7df12e18\\erp_login.png' });
    
    // Attempt Login
    try {
        await page.type('input[type="email"]', 'admin@example.com');
        await page.type('input[type="password"]', 'password');
        await page.click('button[type="submit"]');
        await new Promise(r => setTimeout(r, 4000));
        
        await page.screenshot({ path: 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\ddd61627-dd5c-4cdf-b874-ef7f7df12e18\\erp_dashboard.png' });
    } catch(e) {
        console.log("Login failed or element not found:", e.message);
    }

    await browser.close();
    console.log("Screenshots captured!");
}

main().catch(console.error);
