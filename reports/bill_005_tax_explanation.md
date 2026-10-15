# BILL-005 Tax Computation & Discount Timing Analysis

**Report Only**: No database records have been modified.

---

## 1. Document Details

- **Document Number**: `BILL-005`
- **Document ID**: `bd214de9-6a63-45f7-8722-5c043bf83075`
- **Business**: Fresh India Business (`e0250f84-1b58-4bf4-ba61-ea93ddaacf45`)
- **Stored Values**:
  - `subtotal`: 8,000.00
  - `discount`: 150.00
  - `tax`: 400.00
  - `totalAmount`: 8,250.00
- **Line Items**:
  - Item 1: Quantity: 100, Price: 80.00, Total: 8,400.00, Name: "testing"

---

## 2. Analysis of the Calculation

In `BILL-005`, the calculation stored in the database is:
$$\text{Tax} = 8,000 \times 5\% = 400.00$$
$$\text{Total Amount} = \text{Subtotal (8,000)} - \text{Discount (150)} + \text{Tax (400)} = 8,250.00$$

Here, the 5% tax was computed on the **gross subtotal** ($\text{INR } 8,000.00$) before deducting the trade discount ($\text{INR } 150.00$).

---

## 3. Statutory GST Rules (Section 15(3) of CGST Act)

Under Section 15(3) of the CGST Act, 2017:
> "The value of the supply shall not include any discount which is given:
> (a) before or at the time of the supply if such discount has been duly recorded in the invoice issued in respect of such supply..."

Therefore, statutory GST principles dictate that **trade discounts recorded on the face of the invoice/bill must be deducted from the gross subtotal to determine the Taxable Value before computing tax**:

1. **Taxable Value**: $\text{Gross Subtotal } (8,000.00) - \text{Trade Discount } (150.00) = \mathbf{7,850.00}$
2. **Statutory Tax @ 5%**: $7,850.00 \times 5\% = \mathbf{392.50}$
3. **Statutory Total Payable**: $7,850.00 + 392.50 = \mathbf{8,242.50}$

### Discrepancy Summary
- Stored Tax: **400.00** vs. Statutory Tax: **392.50** (Difference: $+7.50$ excess tax)
- Stored Total: **8,250.00** vs. Statutory Total: **8,242.50** (Difference: $+7.50$ excess total)

### Recommendation
In Phase 2 engine standardization, all document types (invoices, sales orders, and bills) enforce:
$$\text{Taxable Value} = \text{subtotal} - \text{trade discounts} + \text{chargeable shipping/freight}$$
Existing posted documents remain untouched in historical state unless approved for repair.
