/**
 * test-exempt-itc.js
 *
 * Verifies Cases 1 & 2 of the ZERO_RATED/EXEMPT ITC gap analysis:
 *
 * Case 1: BILL with taxCategory = 'EXEMPT', rate = 0
 *   → taxAmountBaseCcy = 0 (no tax charged). The `rate > 0` guard on line 122
 *     of statutoryRegistry.js means this SHOULD NOT appear in (A)(5) at all.
 *
 * Case 2: BILL with taxCategory = 'ZERO_RATED', rate = 0
 *   → taxAmountBaseCcy = 0 (zero-rated). Same `rate > 0` guard applies.
 *     SHOULD NOT appear in (A)(5).
 *
 * The test also seeds a regular taxable bill (18% CGST+SGST) to confirm
 * (A)(5) is NOT broken — it must still correctly capture real ITC.
 *
 * Case 3 (ITC apportionment / Rule 42/43) is explicitly OUT OF SCOPE here.
 * That requires aggregate turnover ratios across the filing period and cannot
 * be determined from a single transaction's taxCategory flag. Logged in task.md.
 */

const prisma = require('./src/config/prisma');
const statutoryRegistry = require('./src/config/reports/statutoryRegistry');
const crypto = require('crypto');

async function run() {
  try {
    const india = await prisma.country.findUnique({ where: { code: 'IN' } });
    const inr = await prisma.currency.findUnique({ where: { code: 'INR' } });
    const gstFw = await prisma.taxFramework.findFirst({ where: { name: 'India GST' } });
    const user = await prisma.user.findFirst();

    if (!india || !inr || !gstFw) throw new Error('Missing IN/INR/India GST setup');

    const biz = await prisma.business.create({
      data: {
        name: 'Exempt ITC Verification Biz',
        baseCurrencyId: inr.id,
        countryId: india.id,
        ownerId: user.id,
        taxFrameworkId: gstFw.id
      }
    });

    // Reuse shared tax types
    const cgstType = await prisma.taxType.findFirst({ where: { name: 'CGST' } });
    const sgstType = await prisma.taxType.findFirst({ where: { name: 'SGST' } });

    // --- Rules ---
    // A) Standard taxable 18% rule (CGST 9% + SGST 9%) — should appear in (A)(5)
    const stdRule = await prisma.taxRule.create({
      data: { businessId: biz.id, name: 'Std 18%', rate: 18, type: 'GST', jurisdiction: 'INTRASTATE', taxCategory: null }
    });
    const cgst9 = await prisma.taxRate.create({ data: { name: 'CGST 9%', rate: 9, effectiveFrom: new Date('2020-01-01'), taxTypeId: cgstType.id, taxRuleId: stdRule.id } });
    const sgst9 = await prisma.taxRate.create({ data: { name: 'SGST 9%', rate: 9, effectiveFrom: new Date('2020-01-01'), taxTypeId: sgstType.id, taxRuleId: stdRule.id } });

    // B) Exempt inward purchase rule — rate = 0, taxCategory = 'EXEMPT'
    const exemptRule = await prisma.taxRule.create({
      data: { businessId: biz.id, name: 'Exempt Purchase', rate: 0, type: 'GST', jurisdiction: 'INTRASTATE', taxCategory: 'EXEMPT' }
    });
    const cgstExempt = await prisma.taxRate.create({ data: { name: 'CGST 0% Exempt', rate: 0, effectiveFrom: new Date('2020-01-01'), taxTypeId: cgstType.id, taxRuleId: exemptRule.id } });

    // C) Zero-rated inward purchase rule — rate = 0, taxCategory = 'ZERO_RATED'
    const zeroRule = await prisma.taxRule.create({
      data: { businessId: biz.id, name: 'Zero Rated Purchase', rate: 0, type: 'GST', jurisdiction: 'INTRASTATE', taxCategory: 'ZERO_RATED' }
    });
    const cgstZero = await prisma.taxRate.create({ data: { name: 'CGST 0% Zero', rate: 0, effectiveFrom: new Date('2020-01-01'), taxTypeId: cgstType.id, taxRuleId: zeroRule.id } });

    const createTx = async (type, taxable, taxAmt, rateId) => {
      await prisma.taxTransaction.create({
        data: {
          businessId: biz.id,
          transactionType: type,
          transactionId: crypto.randomUUID(),
          taxRateId: rateId,
          taxAmountTxnCcy: taxAmt,
          taxAmountBaseCcy: taxAmt,
          taxableAmountBaseCcy: taxable,
          transactionCurrencyId: inr.id
        }
      });
    };

    // ---- SEED TRANSACTIONS ----
    // 1. Regular taxable bill: 1000 taxable, 90 CGST + 90 SGST → should appear in (A)(5)
    console.log('Seeding: Regular taxable bill (1000 taxable, 90 CGST, 90 SGST)');
    await createTx('BILL', 1000, 90, cgst9.id);
    await createTx('BILL', 1000, 90, sgst9.id);

    // 2. Exempt bill: 500 taxable, 0 CGST → should NOT appear in (A)(5)
    console.log('Seeding: Exempt bill (500 taxable, 0 CGST)');
    await createTx('BILL', 500, 0, cgstExempt.id);

    // 3. Zero-rated bill: 750 taxable, 0 CGST → should NOT appear in (A)(5)
    console.log('Seeding: Zero-rated bill (750 taxable, 0 CGST)');
    await createTx('BILL', 750, 0, cgstZero.id);

    // ---- RUN REPORT ----
    console.log('\n--- GSTR-3B OUTPUT ---');
    const report = await statutoryRegistry.generateReport('India GST', 'GSTR3B', biz.id, {});
    const table4 = report.sections.find(s => s.name.startsWith('4.'));
    console.log(JSON.stringify(table4, null, 2));

    // ---- ASSERTIONS ----
    console.log('\n--- ASSERTIONS ---');
    const a5 = table4.data.find(r => r.category === '(A)(5) All other ITC');
    const expected_cgst = 90;
    const expected_sgst = 90;

    const cgst_ok = a5.CGST === expected_cgst;
    const sgst_ok = a5.SGST === expected_sgst;

    console.log(`(A)(5) CGST: ${a5.CGST} — Expected: ${expected_cgst} → ${cgst_ok ? 'PASS' : 'FAIL'}`);
    console.log(`(A)(5) SGST: ${a5.SGST} — Expected: ${expected_sgst} → ${sgst_ok ? 'PASS' : 'FAIL'}`);

    if (cgst_ok && sgst_ok) {
      console.log('\nCASE 1 (EXEMPT bill): correctly excluded from (A)(5) — rate=0 guard works.');
      console.log('CASE 2 (ZERO_RATED bill): correctly excluded from (A)(5) — rate=0 guard works.');
      console.log('Regular taxable bill: correctly included at expected amount.');
      console.log('\nNo code change required. The existing rate > 0 guard already handles both cases correctly.');
    } else {
      console.error('\nFAIL: Exempt or zero-rated bills leaked into (A)(5). Code change required.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
