const prisma = require("../config/prisma");
const { buildPDF, sendExcel, sendJSON } = require("../utils/exportUtils");

exports.exportCurrencyTransactions = async (req, res) => {
  try {
    const businessId = req.business.id;
    const { fromDate, toDate, fxOnly, format } = req.query; // format in query, or we can use req.params if we want

    // If format is passed as a route param like /export/:format, then:
    const exportFormat = req.params.format || format;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { baseCurrency: true }
    });

    if (!business || !business.baseCurrency) {
      return res.status(400).json({ success: false, message: "Business or base currency not found" });
    }

    const baseCcy = business.baseCurrency.code;
    const baseCcyId = business.baseCurrency.id;

    const dateFilter = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate);

    // Helper to fetch and map records
    const fetchRecords = async (model, dateField, typeName, numberField, partyField, txnAmountField) => {
      const where = { businessId };
      if (Object.keys(dateFilter).length > 0) where[dateField] = dateFilter;
      if (fxOnly === 'true') {
        where.transactionCurrencyId = { not: baseCcyId };
      }

      const include = { transactionCurrency: true };
      if (partyField) {
        if (model === 'payment') {
           // Payment can be customer or vendor
           include.customer = true;
           include.vendor = true;
        } else {
           include[partyField] = true;
        }
      }

      const records = await prisma[model].findMany({ where, include });
      return records.map(r => {
        let partyName = '-';
        if (model === 'payment') {
          if (r.customer) partyName = r.customer.name || r.customer.company || '-';
          else if (r.vendor) partyName = r.vendor.name || r.vendor.company || '-';
        } else if (partyField && r[partyField]) {
          partyName = r[partyField].name || r[partyField].company || '-';
        }

        return {
          Date: r[dateField] ? new Date(r[dateField]).toLocaleDateString() : '-',
          Type: typeName,
          'Document Number': r[numberField] || '-',
          'Party Name': partyName,
          'Transaction Currency': r.transactionCurrency?.code || baseCcy,
          'Base Currency': baseCcy,
          'Exchange Rate': r.exchangeRate || 1.0,
          'Foreign Currency Amount': r[txnAmountField] || 0,
          'Base Currency Amount': r.baseCurrencyAmount || 0,
          _rawDate: r[dateField] ? new Date(r[dateField]) : new Date(0)
        };
      });
    };

    const results = await Promise.all([
      fetchRecords('quotation', 'issueDate', 'Quotation', 'quotationNumber', 'customer', 'grandTotal'),
      fetchRecords('salesOrder', 'orderDate', 'SalesOrder', 'orderNumber', 'customer', 'grandTotal'),
      fetchRecords('invoice', 'invoiceDate', 'Invoice', 'invoiceNumber', 'customer', 'grandTotal'),
      fetchRecords('creditNote', 'createdAt', 'CreditNote', 'creditNoteNumber', 'customer', 'grandTotal'),
      fetchRecords('payment', 'paymentDate', 'Payment', 'paymentNumber', null, 'amount'),
      fetchRecords('purchaseRequest', 'createdAt', 'PurchaseRequest', 'requestNumber', null, 'grandTotal'),
      fetchRecords('purchaseOrder', 'orderDate', 'PurchaseOrder', 'orderNumber', 'vendor', 'grandTotal'),
      fetchRecords('bill', 'billDate', 'Bill', 'billNumber', 'vendor', 'grandTotal'),
      fetchRecords('purchaseReturn', 'createdAt', 'PurchaseReturn', 'returnNumber', 'vendor', 'grandTotal'),
    ]);

    let allTransactions = results.flat();
    allTransactions.sort((a, b) => a._rawDate - b._rawDate);
    
    allTransactions = allTransactions.map(t => {
      delete t._rawDate;
      return t;
    });

    if (exportFormat === 'json') {
      return sendJSON(res, 'Currency_Transactions', allTransactions);
    }

    if (exportFormat === 'excel') {
      return sendExcel(res, 'Currency_Transactions', 'Transactions', allTransactions);
    }

    if (exportFormat === 'pdf') {
      const headers = [
        "Date", "Type", "Document Number", "Party Name", 
        "Txn Ccy", "Base Ccy", "Ex Rate", "Txn Amount", "Base Amount"
      ];
      const colWidths = [60, 80, 100, 100, 40, 40, 50, 70, 70];
      const dataRows = allTransactions.map(t => [
        t.Date,
        t.Type,
        t['Document Number'],
        t['Party Name'],
        t['Transaction Currency'],
        t['Base Currency'],
        Number(t['Exchange Rate']).toFixed(4),
        Number(t['Foreign Currency Amount']).toFixed(2),
        Number(t['Base Currency Amount']).toFixed(2)
      ]);
      return buildPDF(res, "Currency Transactions Report", headers, colWidths, dataRows, business.name);
    }

    return res.status(400).json({ success: false, message: "Invalid format requested" });

  } catch (error) {
    console.error("Currency Export Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
