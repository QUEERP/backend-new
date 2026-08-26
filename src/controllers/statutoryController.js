const prisma = require("../config/prisma");
const statutoryRegistry = require("../config/reports/statutoryRegistry");

exports.getDashboardSummary = async (req, res) => {
    try {
        const businessId = req.business ? req.business.id : req.headers['x-business-id'];

        if (!businessId) {
            return res.status(400).json({ success: false, message: "Business ID is required" });
        }

        let totalSales = 0;
        // 1. Fetch Tax Ledger Balances (Post-Cutover)
        const accounts = await prisma.account.findMany({
            where: { businessId, code: { in: ['SYSTEM_TAX_PAYABLE', 'SYSTEM_TAX_RECEIVABLE'] } }
        });
        const taxPayableAcc = accounts.find(a => a.code === 'SYSTEM_TAX_PAYABLE');
        const taxReceivableAcc = accounts.find(a => a.code === 'SYSTEM_TAX_RECEIVABLE');

        let outputVat = 0;
        let inputVat = 0;
        let taxableSales = 0;
        let zeroRatedSales = 0;
        let exemptSales = 0;

        if (taxPayableAcc) {
            const payableEntries = await prisma.journalEntry.aggregate({
                where: { businessId, accountId: taxPayableAcc.id },
                _sum: { credit: true, debit: true }
            });
            outputVat = (payableEntries._sum.credit || 0) - (payableEntries._sum.debit || 0);
        }

        if (taxReceivableAcc) {
            const receivableEntries = await prisma.journalEntry.aggregate({
                where: { businessId, accountId: taxReceivableAcc.id },
                _sum: { credit: true, debit: true }
            });
            inputVat = (receivableEntries._sum.debit || 0) - (receivableEntries._sum.credit || 0);
        }

        // 2. Fetch Sales Breakdowns from Invoices
        try {
            const invoices = await prisma.invoice.findMany({
                where: { businessId, isDeleted: false, status: { not: "CANCELLED" } },
                select: { grandTotal: true, totalTax: true, vatType: true, subtotal: true }
            });

            for (const inv of invoices) {
                totalSales += (inv.grandTotal || 0);

                // For pre-cutover compatibility, if ledger has no output VAT, we fallback to invoice tax
                if (!taxPayableAcc) {
                    outputVat += (inv.totalTax || 0);
                }

                const type = (inv.vatType || "").toLowerCase();
                if (type.includes("zero")) {
                    zeroRatedSales += (inv.subtotal || 0);
                } else if (type.includes("exempt")) {
                    exemptSales += (inv.subtotal || 0);
                } else {
                    taxableSales += (inv.subtotal || 0);
                }
            }
        } catch (e) {
            console.error("Error fetching invoices for statutory stats:", e);
        }

        let totalPurchases = 0;

        // Try to aggregate bills
        try {
            const bills = await prisma.bill.findMany({
                where: { businessId },
                select: { totalAmount: true, tax: true }
            });

            for (const bill of bills) {
                totalPurchases += (bill.totalAmount || 0);
                // For pre-cutover compatibility
                if (!taxReceivableAcc) {
                    inputVat += (bill.tax || 0);
                }
            }
        } catch (e) {
            console.error("Error fetching bills for statutory stats:", e);
        }

        const vatPayable = outputVat > inputVat ? outputVat - inputVat : 0;
        const vatRefund = inputVat > outputVat ? inputVat - outputVat : 0;

        let recentReports = [];
        try {
            // Check if StatutoryReport model exists
            if (prisma.statutoryReport) {
                recentReports = await prisma.statutoryReport.findMany({
                    where: { businessId },
                    orderBy: { generatedAt: 'desc' },
                    take: 5
                });
            }
        } catch (e) {
            console.log("Could not fetch recent statutory reports.");
        }

        const stats = {
            totalSales,
            totalPurchases,
            outputVat,
            inputVat,
            vatPayable,
            vatRefund,
            taxableSales,
            zeroRatedSales,
            exemptSales,
            recentReports
        };

        return res.status(200).json({ success: true, data: stats });

    } catch (error) {
        console.error("Error fetching statutory dashboard summary:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

exports.listAvailableReports = async (req, res) => {
    try {
        const businessId = req.business.id; // STRICT SCOPING
        const business = await prisma.business.findUnique({
            where: { id: businessId },
            include: { taxFramework: true }
        });

        if (!business || !business.taxFramework) {
            return res.json({ success: true, framework: null, availableReports: [] });
        }

        const frameworkName = business.taxFramework.name;
        const availableReports = statutoryRegistry.getAvailableReports(frameworkName);

        res.json({
            success: true,
            framework: frameworkName,
            availableReports
        });
    } catch (error) {
        console.error("Error listing statutory reports:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

exports.generateStatutoryReport = async (req, res) => {
    try {
        const businessId = req.business.id; // STRICT SCOPING
        const { reportCode } = req.params;
        const filters = req.query;

        const business = await prisma.business.findUnique({
            where: { id: businessId },
            include: { taxFramework: true }
        });

        if (!business || !business.taxFramework) {
            return res.status(400).json({ success: false, message: "No tax framework configured for this business" });
        }

        const frameworkName = business.taxFramework.name;

        const reportData = await statutoryRegistry.generateReport(frameworkName, reportCode, businessId, filters);

        res.json({
            success: true,
            report: reportData
        });
    } catch (error) {
        console.error("Error generating statutory report:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};
