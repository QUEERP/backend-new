// src/config/reports/statutoryRegistry.js
const prisma = require("../../config/prisma");

/**
 * Statutory Report Registry
 * Maps TaxFramework string codes (from DB) to available statutory reports and their builder functions.
 */
const registry = {
  // INDIA GST Framework
  "India GST": {
    reports: [
      { code: "GSTR1", name: "GSTR-1 (Outward Supplies)", type: "SALES_REGISTER" },
      { code: "GSTR3B", name: "GSTR-3B (Summary Return)", type: "SUMMARY" }
    ],
    builders: {
      "GSTR1": async (businessId, filters) => {
        const transactions = await prisma.taxTransaction.findMany({
          where: {
            businessId,
            transactionType: { in: ['INVOICE', 'CREDIT_NOTE'] }
          },
          include: {
            taxRate: { include: { taxType: true } }
          }
        });
        
        const grouped = {};
        transactions.forEach(t => {
          const rate = t.taxRate.rate;
          const taxTypeName = t.taxRate.taxType.name;
          const key = rate.toString();
          
          if (!grouped[key]) {
            grouped[key] = { taxRate: rate, CGST: 0, SGST: 0, IGST: 0, totalTaxBaseCcy: 0 };
          }
          
          const sign = t.transactionType === 'CREDIT_NOTE' ? -1 : 1;
          const amt = t.taxAmountBaseCcy * sign;
          
          if (grouped[key][taxTypeName] !== undefined) {
             grouped[key][taxTypeName] += amt;
          }
          grouped[key].totalTaxBaseCcy += amt;
        });

        return {
          reportName: "GSTR-1 (Outward Supplies)",
          data: Object.values(grouped)
        };
      },
      "GSTR3B": async (businessId, filters) => {
        const transactions = await prisma.taxTransaction.findMany({
          where: { businessId },
          include: {
            taxRate: { 
              include: { 
                taxType: true,
                taxRule: true
              } 
            }
          }
        });

        // Initialize structures
        const table3_1 = {
          "(a) Outward taxable supplies (other than zero rated, nil rated and exempted)": { taxableValue: 0, CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(b) Outward taxable supplies (zero rated)": { taxableValue: 0, CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(c) Other outward supplies (Nil rated, exempted)": { taxableValue: 0, CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(d) Inward supplies (liable to reverse charge)": { taxableValue: 0, CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(e) Non-GST outward supplies": { taxableValue: 0, CGST: 0, SGST: 0, IGST: 0, CESS: 0 }
        };

        const table4 = {
          "(A)(3) Inward supplies liable to reverse charge": { CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(A)(5) All other ITC": { CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(B) ITC Reversed": { CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(C) Net ITC Available (A) - (B)": { CGST: 0, SGST: 0, IGST: 0, CESS: 0 },
          "(D) Ineligible ITC": { CGST: 0, SGST: 0, IGST: 0, CESS: 0 }
        };

        // Helper to add values
        const addValues = (target, t, sign, isTable4 = false) => {
          const taxName = t.taxRate.taxType.name.toUpperCase();
          const taxCol = taxName.includes('CGST') ? 'CGST' : 
                         taxName.includes('SGST') ? 'SGST' : 
                         taxName.includes('IGST') ? 'IGST' : 
                         taxName.includes('CESS') ? 'CESS' : null;
          
          if (!isTable4) {
            target.taxableValue += t.taxableAmountBaseCcy * sign;
          }
          if (taxCol) {
            target[taxCol] += t.taxAmountBaseCcy * sign;
          }
        };

        transactions.forEach(t => {
          const type = t.transactionType;
          const rate = t.taxRate.rate;
          const cat = t.taxRate.taxRule?.taxCategory || null;

          // TABLE 3.1
          if (['INVOICE', 'CREDIT_NOTE'].includes(type)) {
            const sign = type === 'CREDIT_NOTE' ? -1 : 1;
            if (rate > 0 && cat !== 'ZERO_RATED' && cat !== 'REVERSE_CHARGE') {
              addValues(table3_1["(a) Outward taxable supplies (other than zero rated, nil rated and exempted)"], t, sign);
            } else if (cat === 'ZERO_RATED') {
              addValues(table3_1["(b) Outward taxable supplies (zero rated)"], t, sign);
            } else if (rate === 0) {
              addValues(table3_1["(c) Other outward supplies (Nil rated, exempted)"], t, sign);
            }
          } else if (['BILL', 'PURCHASE_RETURN'].includes(type) && cat === 'REVERSE_CHARGE') {
            // Note: Reverse charge inward supplies are technically an input transaction, but represent an output liability here
            const sign = type === 'PURCHASE_RETURN' ? -1 : 1;
            addValues(table3_1["(d) Inward supplies (liable to reverse charge)"], t, sign);
          }

          // TABLE 4
          if (type === 'BILL') {
            if (cat === 'REVERSE_CHARGE') {
              addValues(table4["(A)(3) Inward supplies liable to reverse charge"], t, 1, true);
            } else if (rate > 0) {
              addValues(table4["(A)(5) All other ITC"], t, 1, true);
            }
          } else if (type === 'PURCHASE_RETURN' && rate > 0) {
            // Reversals are recorded as positive absolute values in section B
            addValues(table4["(B) ITC Reversed"], t, 1, true);
          }
        });

        // Compute (C) Net ITC Available
        ['CGST', 'SGST', 'IGST', 'CESS'].forEach(tax => {
          const a = table4["(A)(3) Inward supplies liable to reverse charge"][tax] + 
                    table4["(A)(5) All other ITC"][tax];
          const b = table4["(B) ITC Reversed"][tax];
          table4["(C) Net ITC Available (A) - (B)"][tax] = a - b;
        });

        // Format for response
        const formatTable = (tableObj) => {
          return Object.entries(tableObj).map(([category, values]) => ({
            category,
            ...values
          }));
        };

        return {
          reportName: "GSTR-3B (Summary Return)",
          sections: [
            {
              name: "3.1 Details of Outward Supplies and inward supplies liable to reverse charge",
              data: formatTable(table3_1)
            },
            {
              name: "4. Eligible ITC",
              data: formatTable(table4)
            }
          ]
        };
      }
    }
  },

  // UAE VAT Framework
  "UAE VAT": {
    reports: [
      { code: "UAE_VAT_RETURN", name: "UAE VAT Return (Form 201)", type: "SUMMARY" },
      { code: "UAE_VAT_OUTPUT", name: "Output Tax Register", type: "SALES_REGISTER" }
    ],
    builders: {
      "UAE_VAT_RETURN": async (businessId, filters) => {
        const transactions = await prisma.taxTransaction.findMany({
          where: { businessId },
          include: { taxRate: { include: { taxType: true } } }
        });

        const boxes = {
          box1: { box: "1", description: "Standard rated supplies", amount: 0, vatAmount: 0 },
          box3: { box: "3", description: "Supplies subject to the reverse charge provisions (Output)", amount: 0, vatAmount: 0 },
          box4: { box: "4", description: "Zero rated supplies", amount: 0, vatAmount: 0 },
          box5: { box: "5", description: "Exempt supplies", amount: 0, vatAmount: 0 },
          box9: { box: "9", description: "Standard rated expenses", amount: 0, vatAmount: 0 },
          box10: { box: "10", description: "Supplies subject to the reverse charge provisions (Input)", amount: 0, vatAmount: 0 },
        };

        transactions.forEach(t => {
          const typeName = t.taxRate.taxType.name;
          const isOutward = ['INVOICE', 'CREDIT_NOTE'].includes(t.transactionType);
          const isInward = ['BILL', 'PURCHASE_RETURN'].includes(t.transactionType);
          
          const sign = ['CREDIT_NOTE', 'PURCHASE_RETURN'].includes(t.transactionType) ? -1 : 1;
          const taxableAmt = t.taxableAmountBaseCcy * sign;
          const taxAmt = t.taxAmountBaseCcy * sign;

          if (isOutward) {
            if (typeName === 'VAT_STANDARD') {
              boxes.box1.amount += taxableAmt;
              boxes.box1.vatAmount += taxAmt;
            } else if (typeName === 'VAT_ZERO') {
              boxes.box4.amount += taxableAmt;
              boxes.box4.vatAmount += taxAmt;
            } else if (typeName === 'VAT_EXEMPT') {
              boxes.box5.amount += taxableAmt;
              boxes.box5.vatAmount += taxAmt;
            }
          }

          if (isInward) {
            if (typeName === 'VAT_STANDARD') {
              boxes.box9.amount += taxableAmt;
              boxes.box9.vatAmount += taxAmt;
            } else if (typeName === 'VAT_REVERSE_CHARGE') {
              // Reverse charge appears in BOTH Output (Box 3) and Input (Box 10)
              boxes.box3.amount += taxableAmt;
              boxes.box3.vatAmount += taxAmt;
              boxes.box10.amount += taxableAmt;
              boxes.box10.vatAmount += taxAmt;
            }
          }
        });

        return {
          reportName: "UAE VAT Return (Form 201)",
          data: Object.values(boxes)
        };
      },
      "UAE_VAT_OUTPUT": async (businessId, filters) => {
        const transactions = await prisma.taxTransaction.findMany({
          where: { 
            businessId,
            transactionType: { in: ['INVOICE', 'CREDIT_NOTE'] }
          },
          include: { 
            taxRate: { include: { taxType: true } }
          },
          orderBy: { createdAt: 'asc' }
        });

        const data = transactions.map(t => {
          const sign = t.transactionType === 'CREDIT_NOTE' ? -1 : 1;
          return {
            "Date": t.createdAt.toISOString().split('T')[0],
            "Document Type": t.transactionType,
            "Document Number": t.transactionId,
            "Tax Type": t.taxRate.taxType.name,
            "Tax Rate (%)": t.taxRate.rate,
            "Taxable Amount (Base)": t.taxableAmountBaseCcy * sign,
            "Tax Amount (Base)": t.taxAmountBaseCcy * sign
          };
        });

        return {
          reportName: "Output Tax Register",
          data
        };
      }
    }
  }
};

/**
 * Get available reports for a given framework.
 */
exports.getAvailableReports = (frameworkName) => {
  if (!frameworkName || !registry[frameworkName]) {
    return [];
  }
  return registry[frameworkName].reports;
};

/**
 * Execute a specific statutory report.
 */
exports.generateReport = async (frameworkName, reportCode, businessId, filters) => {
  if (!frameworkName || !registry[frameworkName]) {
    throw new Error(`Tax Framework ${frameworkName} not supported for statutory reporting.`);
  }

  const builder = registry[frameworkName].builders[reportCode];
  if (!builder) {
    throw new Error(`Report code ${reportCode} not found in framework ${frameworkName}.`);
  }

  // Ensure mandatory businessId scope is enforced at the highest level
  return await builder(businessId, filters);
};
