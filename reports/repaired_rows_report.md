# Audit & Repair Scope Report (Historical Execution Analysis)

This report details every row modified during earlier executions, verifies ledger consistency, explains data anomalies, and provides a dry-run rollback plan.

---

## 1. Scope of Modified Rows

During the previous `--execute` run, exactly one invoice line item and 11 payment records had their base amount initialized.

### A. Invoices Modified

| Business ID | Business Name | Document ID | Invoice No. | Item ID | Field | Before Value | After Value |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `e0250f84-1b58-4bf4-ba61-ea93ddaacf45` | Fresh India Business 1791981655638 | `364a87cb-ece1-4577-baf5-6e885864e2a8` | `INV-001` | `3a122dce-9b7a-4bee-9068-a510d64115d5` | `InvoiceItem.totalTax`<br>`InvoiceItem.totalAmount` | `totalTax: 0`<br>`totalAmount: 5000` | `totalTax: 900`<br>`totalAmount: 5900` |

**Confirmed**: No invoice in business `testing` (`dc70ca38-b141-477d-a379-f02649117a78`) or any other business had its tax reduced or altered.

### B. Payment Rows Modified (baseCurrencyAmount Initialization)

| Business ID | Business Name | Payment ID | Payment No. | Amount | Field | Before Value | After Value (Stored) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dc70ca38-b141-477d-a379-f02649117a78` | testing | `ebf6d389-9f3a-4d39-b879-6622938c48f7` | `VPAY-004` | 78.00 | `baseCurrencyAmount` | `null` | `78.00` |
| `e24ee048-2039-4c2e-a1c9-24bf7b2f943e` | Dev Priya | `685b7dc4-cf58-4c54-ad55-4b5512dafa21` | `PAY-001` | 2,000.00 | `baseCurrencyAmount` | `null` | `2,000.00` |
| `e24ee048-2039-4c2e-a1c9-24bf7b2f943e` | Dev Priya | `0f68f599-5e1f-4c98-8452-f72ef5a80bde` | `PAY-002` | 10.00 | `baseCurrencyAmount` | `null` | `10.00` |
| `e24ee048-2039-4c2e-a1c9-24bf7b2f943e` | Dev Priya | `1a1d5582-5761-430c-a614-542ab7b81cec` | `PAY-003` | 1,000.00 | `baseCurrencyAmount` | `null` | `1,000.00` |
| `e24ee048-2039-4c2e-a1c9-24bf7b2f943e` | Dev Priya | `66070230-11aa-4eb2-b02b-c90001098c23` | `PAY-004` | 400.00 | `baseCurrencyAmount` | `null` | `400.00` |
| `e24ee048-2039-4c2e-a1c9-24bf7b2f943e` | Dev Priya | `13b19b83-ef13-4183-8262-7f86cb090077` | `PAY-005` | 10,000.00 | `baseCurrencyAmount` | `null` | `10,000.00` |
| `e24ee048-2039-4c2e-a1c9-24bf7b2f943e` | Dev Priya | `f07802f5-0c12-4779-ba91-516ba17b096d` | `PAY-006` | 2,400.00 | `baseCurrencyAmount` | `null` | `2,400.00` |
| `e24ee048-2039-4c2e-a1c9-24bf7b2f943e` | Dev Priya | `a82903a9-3e48-4bbc-bdde-0e27ddbff045` | `PAY-007` | 2,000.00 | `baseCurrencyAmount` | `null` | `2,000.00` |
| `44c72903-27a2-4951-a223-5e6e411f24c7` | Farez Management | `aff67fdc-48bc-485f-b8d1-a9c14cc4df68` | `PAY-001` | 2,000.00 | `baseCurrencyAmount` | `null` | `2,000.00` |
| `44c72903-27a2-4951-a223-5e6e411f24c7` | Farez Management | `8702c234-88eb-4aef-bf75-79beead189df` | `PAY-002` | 1,390.00 | `baseCurrencyAmount` | `null` | `1,390.00` |
| `44c72903-27a2-4951-a223-5e6e411f24c7` | Farez Management | `9ad79927-786c-4e79-aae4-011cf776e08e` | `PAY-003` | 2,000.00 | `baseCurrencyAmount` | `null` | `2,000.00` |

---

## 2. Invoice `364a87cb` Analysis & General Ledger Consistency

- **Document**: `INV-001` (`364a87cb-ece1-4577-baf5-6e885864e2a8`)
- **Business**: Fresh India Business 1791981655638 (`e0250f84-1b58-4bf4-ba61-ea93ddaacf45`)
- **Header Values**: Subtotal: 5,000, Total Tax: 900, Grand Total: 5,900.
- **Line Item Values Prior to Repair**: Description: "Test product", Rate: 5000, Qty: 1, `taxPercent: 18`, but `totalTax: 0`, `totalAmount: 5000` (caused by the old write path forcing `totalTax: 0`).
- **What Was Changed**: The header tax was **NOT** reduced. The line item's `totalTax` was updated from `0` to `900` (and `totalAmount` to `5900`) so that line-item tax matches the header tax and line items.
- **General Ledger Verification**:
  - Journal Entry `79af356f`: Accounts Receivable (AR) **Debit 5,900.00**
  - Journal Entry `5076e8f0`: Net Revenue **Credit 5,000.00**
  - Journal Entry `20174671`: Tax Output **Credit 900.00**
  - **Result**: The General Ledger was already posted with **900.00 tax credit** and **5,900.00 AR debit**. The line item repair aligned the line items to the header and the General Ledger. The GL and Invoice are in 100% agreement.

---

## 3. Explanation of "13% Test Rate" Lines

- **Location**: Business "Farez Management" (`44c72903-27a2-4951-a223-5e6e411f24c7`)
  - Invoice `INV-001` (`f9e0cceb-2503-4fa3-879f-907c2c508564`), Item `30c04322-6e30-45f5-b5c0-d52fc31f44b7`: Rate 3,000, Tax 13%, Total Tax 390.
  - Invoice `INV-002` (`0e8a83ae-7d5c-47c5-948e-bc50a9829505`), Item `b6d0e2cc-8fb9-47d5-bdc0-82bb442deb5a`: Rate 2,000, Tax 13%, Total Tax 260.
- **Statutory Rules**: Under Indian GST (CBIC notifications), 13% is **NOT** a statutory GST rate slab (standard slabs are 0, 0.1, 0.25, 1.5, 3, 5, 12 [pre-Sept 2025], 18, 28 [pre-Sept 2025], 40 [post-Sept 2025]).
- **Action Taken**: **Zero changes were made to these lines**. The audit script flagged them as statutory anomalies (`item has invalid statutory GST rate for date`), but the database values remain intact as created by the user.

---

## 4. Payment Currency Analysis: PAY-001..007 & VPAY-004

The root cause was the Prisma `@default("AED")` and backend fallbacks `|| "AED"`. Below is the audit table per payment showing the linked document, stored currency, and what it should be:

| Payment No. | Payment ID | Business Name | Amount | Linked Document | Linked Doc Currency | Currency Stored Now | Stored Rate | Should Have Currency | Should Have Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `VPAY-004` | `ebf6d389` | testing | 78.00 | Bill `BILL-002` | **INR** | AED | 1.0 | **INR** | 1.0 |
| `PAY-001` | `685b7dc4` | Dev Priya | 2,000.00 | Unlinked Advance | None (Biz: CAD) | AED | 1.0 | **CAD** | 1.0 |
| `PAY-002` | `0f68f599` | Dev Priya | 10.00 | Unlinked Advance | None (Biz: CAD) | AED | 1.0 | **CAD** | 1.0 |
| `PAY-003` | `1a1d5582` | Dev Priya | 1,000.00 | Unlinked Advance | None (Biz: CAD) | AED | 1.0 | **CAD** | 1.0 |
| `PAY-004` | `66070230` | Dev Priya | 400.00 | Unlinked Advance | None (Biz: CAD) | AED | 1.0 | **CAD** | 1.0 |
| `PAY-005` | `13b19b83` | Dev Priya | 10,000.00 | Invoice `INV-2026-08-05-1` | **CAD** | AED | 1.0 | **CAD** | 1.0 |
| `PAY-006` | `f07802f5` | Dev Priya | 2,400.00 | Invoice `INV-2026-08-07-1` | **CAD** | AED | 1.0 | **CAD** | 1.0 |
| `PAY-007` | `a82903a9` | Dev Priya | 2,000.00 | Unlinked Advance | None (Biz: CAD) | AED | 1.0 | **CAD** | 1.0 |
| `PAY-001` | `aff67fdc` | Farez Management | 2,000.00 | Unlinked Advance | None (Biz: INR) | AED | 1.0 | **INR** | 1.0 |
| `PAY-002` | `8702c234` | Farez Management | 1,390.00 | Unlinked Advance | None (Biz: INR) | AED | 1.0 | **INR** | 1.0 |
| `PAY-003` | `9ad79927` | Farez Management | 2,000.00 | Unlinked Advance | None (Biz: INR) | AED | 1.0 | **INR** | 1.0 |

*Status*: **Dry-run only**. No backfill or update has been run. Awaiting explicit user approval before updating any stored payment currencies.

---

## 5. Rollback Script

A standalone rollback script has been created at:
`backend/scripts/rollback_audit.js`

- **Dry-run command**:
  `node scripts/rollback_audit.js --businessId <id>`
- **Live execution** (only if user approves):
  `node scripts/rollback_audit.js --businessId <id> --execute`
