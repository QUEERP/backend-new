# Ledger Account Mapping Specification

This document serves as the single source of truth for all double-entry ledger postings in the ERP system.

**IMPORTANT:** All future code dealing with `journalEntries` MUST strictly adhere to this mapping. If a new transaction type or business requirement arises that deviates from this list, this document must be updated and approved *before* code is written.

## Phase 2: Core Transactions

### Sales & Receivables
| Transaction Type | Debit (Dr) | Credit (Cr) |
| :### Foreign Currency & Exchange Rate Convention (Pattern A)

To maintain data fidelity in the ledger and correctly calculate base-currency balances, ALL ledger-posting code must adhere to the following convention when calling `postJournalEntries`:

1. **Standard Entries:** Callers MUST pass the `debit` or `credit` amount in the **Original Foreign Currency**, and explicitly pass the real transaction `exchangeRate`. The engine (`postJournalEntries`) is exclusively responsible for multiplying these out to compute the Base Currency equivalent. This ensures the database retains the original foreign amount.
2. **Derived/Base-Currency Entries:** If a caller is computing a derived value that is inherently already in Base Currency (e.g., Realized FX Gain/Loss differences, or COGS which is pulled from Base Currency inventory valuation), the caller MUST pass the derived base-currency amount and explicitly pass `exchangeRate: 1.0`. This must be clearly commented in the code as "already in base currency — do not re-convert".

Failure to follow this standard will result in double-multiplication of base-currency values or loss of foreign-currency fidelity in the ledger.

---
**END OF SPECIFICATION**
