const fs = require('fs');
const path = require('path');

const registryPath = path.join(__dirname, 'src', 'config', 'reports', 'statutoryRegistry.js');
let code = fs.readFileSync(registryPath, 'utf8');

const frameworks = [
  'UK VAT',
  'AU GST',
  'SG GST',
  'Deutschland MwSt',
  'NZ GST',
  'South Africa VAT'
];

let injectedCode = '';

for (const fw of frameworks) {
  const codeName = fw.replace(/[^A-Za-z0-9]/g, '_').toUpperCase() + '_GENERIC_RETURN';
  injectedCode += `
  // ${fw} Framework
  "${fw}": {
    reports: [
      { code: "${codeName}", name: "Generic Tax Return", type: "SUMMARY" }
    ],
    builders: {
      "${codeName}": async (businessId, filters) => {
        const transactions = await prisma.taxTransaction.findMany({
          where: { businessId },
          include: { taxRate: { include: { taxType: true } } }
        });

        let totalCollected = 0;
        let totalPaid = 0;

        transactions.forEach(t => {
          const isOutward = ['INVOICE', 'CREDIT_NOTE'].includes(t.transactionType);
          const isInward = ['BILL', 'PURCHASE_RETURN'].includes(t.transactionType);
          
          const sign = ['CREDIT_NOTE', 'PURCHASE_RETURN'].includes(t.transactionType) ? -1 : 1;
          const taxAmt = t.taxAmountBaseCcy * sign;

          if (isOutward) {
            totalCollected += taxAmt;
          } else if (isInward) {
            totalPaid += taxAmt;
          }
        });

        const netTax = totalCollected - totalPaid;

        return {
          reportName: "Generic Tax Return",
          sections: [
            {
              name: "Summary",
              data: [
                { category: "Total Tax Collected (Sales)", amount: totalCollected },
                { category: "Total Tax Paid (Purchases)", amount: totalPaid },
                { category: "Net Tax (Collected - Paid)", amount: netTax }
              ]
            }
          ]
        };
      }
    }
  },
`;
}

// Inject before "};" at the end of registry object
// The registry object ends around line 308 (before `exports.getAvailableReports`)
code = code.replace(/  \}\n\};\n\n\/\*\*/, `  },\n${injectedCode}};\n\n/**`);

fs.writeFileSync(registryPath, code);
console.log('Patched statutoryRegistry.js');
