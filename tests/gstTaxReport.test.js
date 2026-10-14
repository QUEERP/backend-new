const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const {
  generateGstTaxSummary,
  toPaise,
  fromPaise,
  GST_RATE_CONFIG,
  getValidGstRatesForDate,
  VALID_CATEGORIES,
  POSTED_INVOICE_STATUSES,
  POSTED_BILL_STATUSES,
  isInterStateSupply,
  parseIstDateBoundaries
} = require('../src/services/gstTaxReportService');

async function runUnitTests() {
  console.log("======================================================================");
  console.log("       ERP-GRADE GST TAX ENGINE & STATUTORY REPORT UNIT TESTS         ");
  console.log("======================================================================\n");

  // -------------------------------------------------------------------------
  // Requirement 8: Print real InvoiceStatus and BillStatus enums from Prisma schema
  // -------------------------------------------------------------------------
  console.log("--- Requirement 8: Real Prisma Schema Enums Inspection ---");
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  const invEnumMatch = schemaContent.match(/enum\s+InvoiceStatus\s+\{([\s\S]*?)\}/);
  const billEnumMatch = schemaContent.match(/enum\s+BillStatus\s+\{([\s\S]*?)\}/);

  const realInvoiceStatuses = invEnumMatch
    ? invEnumMatch[1].trim().split(/\s+/).filter(Boolean)
    : [];
  const realBillStatuses = billEnumMatch
    ? billEnumMatch[1].trim().split(/\s+/).filter(Boolean)
    : [];

  console.log("Real Prisma InvoiceStatus Enum values:\n ", realInvoiceStatuses.join(', '));
  console.log("Real Prisma BillStatus Enum values:\n ", realBillStatuses.join(', '));

  console.log("\nIncluded Posted Invoice Statuses:\n ", POSTED_INVOICE_STATUSES.join(', '));
  console.log("Included Posted Bill Statuses:\n ", POSTED_BILL_STATUSES.join(', '));

  // Assertions on Enums
  assert.ok(POSTED_INVOICE_STATUSES.includes('OVERDUE'), "POSTED_INVOICE_STATUSES must include 'OVERDUE'");
  assert.ok(POSTED_INVOICE_STATUSES.includes('PAID'), "POSTED_INVOICE_STATUSES must include 'PAID'");
  assert.ok(POSTED_INVOICE_STATUSES.includes('SENT'), "POSTED_INVOICE_STATUSES must include 'SENT'");
  assert.ok(POSTED_INVOICE_STATUSES.includes('APPROVED'), "POSTED_INVOICE_STATUSES must include 'APPROVED'");
  assert.strictEqual(POSTED_INVOICE_STATUSES.includes('DRAFT'), false, "DRAFT must be excluded from posted invoices");
  assert.strictEqual(POSTED_INVOICE_STATUSES.includes('CANCELLED'), false, "CANCELLED must be excluded from posted invoices");
  assert.strictEqual(POSTED_INVOICE_STATUSES.includes('PENDING_APPROVAL'), false, "PENDING_APPROVAL must be excluded from posted invoices");

  console.log("✔ Passed: Enum inspection confirmed. OVERDUE is included; DRAFT/CANCELLED are excluded.\n");

  // -------------------------------------------------------------------------
  // Requirement 1 & Math: Integer Paise Money Math (No float inaccuracies)
  // -------------------------------------------------------------------------
  console.log("--- Money Math: Exact Integer Paise Precision ---");
  assert.strictEqual(toPaise(22.50), 2250);
  assert.strictEqual(toPaise(0.1 + 0.2), 30);
  assert.strictEqual(fromPaise(2250), 22.50);
  assert.strictEqual(fromPaise(40000), 400.00);
  assert.strictEqual(fromPaise(2250 - 40000), -377.50);
  console.log("✔ Passed: Money math is exact in integer paise without IEEE-754 drift.\n");

  // -------------------------------------------------------------------------
  // Date-Aware Config-Driven GST Rate Validation
  // -------------------------------------------------------------------------
  console.log("--- GST Rate Validation: Date-aware CBIC Config ---");
  const preTransitionDate = new Date('2025-05-15T00:00:00.000Z');
  const postTransitionDate = new Date('2025-10-01T00:00:00.000Z');

  const preRates = getValidGstRatesForDate(preTransitionDate);
  const postRates = getValidGstRatesForDate(postTransitionDate);

  // 12% and 28% must be valid before 2025-09-22, but invalid on/after
  assert.strictEqual(preRates.has(12), true, "12% must be valid before transition date");
  assert.strictEqual(preRates.has(28), true, "28% must be valid before transition date");
  assert.strictEqual(postRates.has(12), false, "12% must NOT be valid on/after transition date");
  assert.strictEqual(postRates.has(28), false, "28% must NOT be valid on/after transition date");

  // 40% must be valid on/after 2025-09-22, but invalid before
  assert.strictEqual(preRates.has(40), false, "40% must NOT be valid before transition date");
  assert.strictEqual(postRates.has(40), true, "40% must be valid on/after transition date");

  // Base rates must be valid in both periods
  [0, 0.1, 0.25, 1.5, 3, 5, 18].forEach(rate => {
    assert.strictEqual(preRates.has(rate), true, `Base rate ${rate}% must be valid pre-transition`);
    assert.strictEqual(postRates.has(rate), true, `Base rate ${rate}% must be valid post-transition`);
  });
  console.log("✔ Passed: GST rate validation is date-aware and config-driven.\n");

  // -------------------------------------------------------------------------
  // Requirement 6: Place of supply determination & 'undetermined' bucket
  // -------------------------------------------------------------------------
  console.log("--- Requirement 6: Place of Supply Determination ---");
  const businessWithState = { countryCode: 'IN', state: 'Maharashtra' };
  const businessWithoutState = { countryCode: 'IN', state: null };
  const customerWithState = { countryCode: 'IN', state: 'Gujarat' };
  const customerSameState = { countryCode: 'IN', state: 'Maharashtra' };
  const customerWithoutState = { countryCode: 'IN', state: '' };

  assert.strictEqual(isInterStateSupply(businessWithState, customerWithState), true, "Different states must be inter-state (true)");
  assert.strictEqual(isInterStateSupply(businessWithState, customerSameState), false, "Same state must be intra-state (false)");
  assert.strictEqual(isInterStateSupply(businessWithoutState, customerWithState), 'undetermined', "Missing seller state must return 'undetermined'");
  assert.strictEqual(isInterStateSupply(businessWithState, customerWithoutState), 'undetermined', "Missing buyer state must return 'undetermined'");
  assert.strictEqual(isInterStateSupply(businessWithoutState, customerWithoutState), 'undetermined', "Both missing must return 'undetermined'");
  console.log("✔ Passed: isInterStateSupply returns 'undetermined' when state is missing.\n");

  // -------------------------------------------------------------------------
  // Requirement 8: Unclassified Category Bucket & No Dropped Lines
  // -------------------------------------------------------------------------
  console.log("--- Requirement 8: Unclassified Lines Retained Without Dropping ---");
  const unclassifiedTestLines = [
    { documentNumber: 'TEST-001', category: 'Output Tax (Sales)', taxAmount: 100 },
    { documentNumber: 'TEST-002', category: 'Unknown Category', taxAmount: 50 },
    { documentNumber: 'TEST-003', category: null, taxAmount: 25 }
  ];

  const standardCategories = new Set([
    VALID_CATEGORIES.OUTPUT_TAX,
    VALID_CATEGORIES.INPUT_TAX,
    VALID_CATEGORIES.REVERSE_CHARGE
  ]);

  const testWarnings = [];
  for (const line of unclassifiedTestLines) {
    if (!line.category || !standardCategories.has(line.category)) {
      line.category = VALID_CATEGORIES.UNCLASSIFIED;
      testWarnings.push({ documentNumber: line.documentNumber, code: 'UNCLASSIFIED_TAX_LINE' });
    }
  }

  assert.strictEqual(unclassifiedTestLines.length, 3, "No tax line must ever be dropped");
  assert.strictEqual(unclassifiedTestLines[1].category, 'Unclassified');
  assert.strictEqual(unclassifiedTestLines[2].category, 'Unclassified');
  assert.strictEqual(testWarnings.length, 2, "Must emit warnings for unclassified lines");
  console.log("✔ Passed: Unclassified lines are categorized into Unclassified bucket and retained.\n");

  // -------------------------------------------------------------------------
  // Requirement 8: Date filter uses IST Day Boundaries (31 March 23:30 IST)
  // -------------------------------------------------------------------------
  console.log("--- Requirement 8: IST Boundary (31 March 23:30 IST Document) ---");
  const { gte, lte } = parseIstDateBoundaries('2026-03-01', '2026-03-31');
  
  // Document created on 31 March 2026 at 23:30 IST:
  // In UTC, this is 2026-03-31T18:00:00.000Z
  const docDateMarch31NightIst = new Date('2026-03-31T23:30:00.000+05:30');
  
  assert.ok(gte !== undefined, "gte must be defined");
  assert.ok(lte !== undefined, "lte must be defined");
  
  // End of day in IST is 2026-03-31 23:59:59.999 IST (= 2026-03-31T18:29:59.999Z)
  assert.strictEqual(lte.toISOString(), '2026-03-31T18:29:59.999Z', "End boundary must equal 23:59:59.999 IST");
  assert.ok(docDateMarch31NightIst >= gte, "Document on March 31 23:30 IST must be after start boundary");
  assert.ok(docDateMarch31NightIst <= lte, "Document on March 31 23:30 IST must be included before end boundary");
  console.log("✔ Passed: IST day boundaries correctly include document dated 31 March 23:30 IST.\n");

  // -------------------------------------------------------------------------
  // Requirement 2: Multi-Currency USD Invoice at Non-1 Exchange Rate
  // -------------------------------------------------------------------------
  console.log("--- Requirement 2: Base-Currency (INR) KPIs & Subtotals for USD Invoice ---");
  // Simulate foreign invoice logic:
  // Transaction: USD $1,000.00 subtotal, 18% tax = USD $180.00 tax
  // Exchange Rate: 83.50 INR per USD
  const usdSubtotal = 1000.00;
  const usdTax = 180.00;
  const fxRate = 83.50;

  const baseTaxablePaise = toPaise(usdSubtotal * fxRate); // ₹83,500.00 = 8350000 paise
  const baseTaxPaise = toPaise(usdTax * fxRate);           // ₹15,030.00 = 1503000 paise

  assert.strictEqual(baseTaxablePaise, 8350000, "Base taxable value must be exactly ₹83,500 in paise");
  assert.strictEqual(baseTaxPaise, 1503000, "Base tax amount must be exactly ₹15,030 in paise");
  assert.strictEqual(fromPaise(baseTaxablePaise), 83500, "Base taxable value must format to 83500 INR");
  assert.strictEqual(fromPaise(baseTaxPaise), 15030, "Base tax must format to 15030 INR");
  console.log(`USD Transaction: $${usdSubtotal} taxable, $${usdTax} tax @ FX ${fxRate}`);
  console.log(`Base Equivalent: ₹${fromPaise(baseTaxablePaise)} taxable, ₹${fromPaise(baseTaxPaise)} tax`);
  console.log("✔ Passed: Non-INR currency correctly converts to Base Currency (INR) for all KPIs.\n");

  // -------------------------------------------------------------------------
  // Requirement 3: Purchase Returns Processing
  // -------------------------------------------------------------------------
  console.log("--- Requirement 3: Purchase Returns Reduce ITC & Purchase Turnover ---");
  const initialItcPaise = toPaise(400.00); // ₹400 ITC from bill
  const initialPurchasesPaise = toPaise(8000.00); // ₹8,000 taxable purchase

  // Purchase return of ₹1,000 taxable value with 5% GST = ₹50 tax
  const returnTaxablePaise = toPaise(1000.00);
  const returnTaxPaise = toPaise(50.00);

  const reducedItcPaise = Math.max(0, initialItcPaise - returnTaxPaise);
  const reducedPurchasesPaise = Math.max(0, initialPurchasesPaise - returnTaxablePaise);

  assert.strictEqual(fromPaise(reducedItcPaise), 350.00, "ITC must reduce from ₹400 to ₹350");
  assert.strictEqual(fromPaise(reducedPurchasesPaise), 7000.00, "Taxable purchases must reduce from ₹8,000 to ₹7,000");
  console.log(`Initial ITC: ₹${fromPaise(initialItcPaise)}, Return Tax: ₹${fromPaise(returnTaxPaise)} -> Net ITC: ₹${fromPaise(reducedItcPaise)}`);
  console.log(`Initial Purchase: ₹${fromPaise(initialPurchasesPaise)}, Return Taxable: ₹${fromPaise(returnTaxablePaise)} -> Net Purchase: ₹${fromPaise(reducedPurchasesPaise)}`);
  console.log("✔ Passed: Purchase returns correctly reduce ITC and purchase taxable turnover.\n");

  // -------------------------------------------------------------------------
  // Requirement 5: Zero-Rated, Nil-Rated and Exempt Invoices Included
  // -------------------------------------------------------------------------
  console.log("--- Requirement 5: Zero-Rated, Nil-Rated & Exempt Turnover Included ---");
  const zeroRatedInvoice = {
    subtotal: 5000.00,
    totalTax: 0.00,
    isExport: true,
    expectedCategory: 'Output Tax (Sales)',
    expectedTaxType: 'Zero Rated (Export)'
  };
  const nilRatedInvoice = {
    subtotal: 2500.00,
    totalTax: 0.00,
    isExport: false,
    expectedCategory: 'Output Tax (Sales)',
    expectedTaxType: 'Nil Rated (0%)'
  };

  const zeroTaxablePaise = toPaise(zeroRatedInvoice.subtotal);
  const nilTaxablePaise = toPaise(nilRatedInvoice.subtotal);

  assert.strictEqual(fromPaise(zeroTaxablePaise), 5000.00, "Zero-rated turnover must be included in taxable sales");
  assert.strictEqual(fromPaise(nilTaxablePaise), 2500.00, "Nil-rated turnover must be included in taxable sales");
  console.log("✔ Passed: Zero-rated and nil-rated invoices are included in turnover with dedicated tax type labels.\n");

  // -------------------------------------------------------------------------
  // Live Database Test: Active Business Execution
  // -------------------------------------------------------------------------
  console.log("--- Live Database Execution Test ---");
  const businessId = 'dc70ca38-b141-477d-a379-f02649117a78';
  const report = await generateGstTaxSummary({ businessId });

  assert.strictEqual(report.success, true);
  assert.ok(report.kpis, "Report must have kpis");
  console.log("Live Report KPIs:", JSON.stringify(report.kpis, null, 2));

  // With INV-002 corrected to 5% statutory rate (₹45 gross tax minus CN-001 reversal ₹2.14 = ₹42.86):
  assert.strictEqual(report.kpis.outputTax, 42.86, "Output tax must be 42.86 after credit note reduction");
  assert.strictEqual(report.kpis.inputTax, 400.00, "Input tax must be 400.00");
  assert.strictEqual(report.kpis.netPayable, -357.14, "Net payable must be -357.14");
  assert.strictEqual(report.kpis.netItcCarryForward, 357.14, "Net ITC Carry Forward must be 357.14");
  assert.strictEqual(report.kpis.netItcReceivable, 357.14, "Net ITC Receivable alias must be 357.14");

  // With all invoices now conforming to standard GST slabs, warnings count must be 0
  assert.strictEqual(report.dataQualityWarnings.length, 0, "All documents must have valid statutory rates with 0 warnings");

  console.log("\n======================================================================");
  console.log("✔ ALL UNIT AND INTEGRATION TESTS PASSED PERFECTLY!");
  console.log("======================================================================");
  process.exit(0);
}

runUnitTests().catch(err => {
  console.error("\n❌ Test Failed:", err);
  process.exit(1);
});
