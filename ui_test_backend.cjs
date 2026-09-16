const { chromium } = require('playwright');
const fs = require('fs');
const prisma = require('./src/config/prisma');

const countries = [
  "US", "BR", "FR", "MX", "IT", "KR", "ES", "NL", "CH", "SA", 
  "IN", "GB", "AU", "DE", "SG", "JP", "ZA", "AE", "CA", "NZ", 
  "OM", "BH", "IE", "ID", "PL", "SE", "NO", "BE", "AT", "TH", 
  "VN", "PH", "CN", "TW"
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    // suppress log to keep output clean
  });

  console.log("Navigating to http://localhost:5173/signin...");
  await page.goto('http://localhost:5173/signin');

  await page.fill('input[type="email"]', 'pwtest@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000);
  console.log("Login submitted, current URL:", page.url());
  
  let results = [];
  console.log("| Country | Selected via UI | Statutory Reports Populated? | Report Name(s) |");
  console.log("|---------|-----------------|------------------------------|----------------|");
  results.push("| Country | Selected via UI | Statutory Reports Populated? | Report Name(s) |");
  results.push("|---------|-----------------|------------------------------|----------------|");

  for (const country of countries) {
    try {
      await page.goto('http://localhost:5173/create-business');
      
      const businessName = `Test ${country} ${Date.now()}`;
      await page.fill('input[placeholder="e.g., Acme Inc."]', businessName);
      
      await page.selectOption('select', { value: country });
      
      // Hook into the response to get the business ID and activate it
      const responsePromise = page.waitForResponse(response => 
        response.url().includes('/api/business/create') && response.status() === 201
      );
      
      await page.click('button[type="submit"]');
      
      const response = await responsePromise;
      const responseData = await response.json();
      const businessId = responseData.data.id || responseData.data.businessId;

      if (businessId) {
          // Force activate it so we bypass the 403 error on the dashboard
          await prisma.business.update({
              where: { id: businessId },
              data: { isActive: true }
          });
      }

      try {
        await page.waitForURL('**/dashboard/**', { timeout: 10000 });
      } catch (e) {
        const row = `| ${country} | Failed | N/A | Navigation failed |`;
        console.log(row);
        results.push(row);
        continue;
      }
      
      await page.waitForTimeout(3000);

      const statutoryLabel = page.locator('text="Statutory Reports"').first();
      if (await statutoryLabel.isVisible()) {
          await statutoryLabel.click();
          await page.waitForTimeout(2000);
      }
      
      const reportLinks = await page.locator('a[href*="/reports/statutory/"]').allInnerTexts();
      const uniqueReports = [...new Set(reportLinks)].filter(t => t.trim() !== '');

      const isPopulated = uniqueReports.length > 0;
      const reportNames = isPopulated ? uniqueReports.join(', ') : 'None';

      const row = `| ${country} | Yes | ${isPopulated ? 'Yes' : 'No'} | ${reportNames} |`;
      console.log(row);
      results.push(row);

    } catch (e) {
      const row = `| ${country} | Failed | N/A | Error: ${e.message.split('\\n')[0]} |`;
      console.log(row);
      results.push(row);
    }
  }

  fs.writeFileSync('playwright_results.md', results.join('\n'));
  await prisma.$disconnect();
  await browser.close();
  console.log("Done");
})();
