# Read-Only Data Audit Report

**Generated At**: 2026-10-15T07:07:16.862Z
**Scope**: Full database inspection across 17 businesses

## Summary of Anomalies
- **Invoices with Anomalies**: 2
- **Bills with Anomalies**: 0
- **Payments with Anomalies**: 11

## 1. Invoice Anomalies

| Document | Business | Grand Total | Issues |
| :--- | :--- | :--- | :--- |
| `INV-002` (`0e8a83ae`) | Farez Management | CAD 2260 | item has invalid statutory GST rate for date |
| `INV-001` (`f9e0cceb`) | Farez Management | CAD 3390 | item has invalid statutory GST rate for date |

## 2. Bill Anomalies

*No bill anomalies detected.*

## 3. Payment Anomalies

| Document | Business | Amount | Issues |
| :--- | :--- | :--- | :--- |
| `VPAY-004` (`ebf6d389`) | testing | AED 78 | Payment currency (AED) != linked document currency (INR) |
| `PAY-003` (`1a1d5582`) | Dev Priya | AED 1000 | Payment stored as default 'AED' on non-AED business (CAD) |
| `PAY-004` (`66070230`) | Dev Priya | AED 400 | Payment stored as default 'AED' on non-AED business (CAD) |
| `PAY-001` (`685b7dc4`) | Dev Priya | AED 2000 | Payment stored as default 'AED' on non-AED business (CAD) |
| `PAY-002` (`0f68f599`) | Dev Priya | AED 10 | Payment stored as default 'AED' on non-AED business (CAD) |
| `PAY-001` (`aff67fdc`) | Farez Management | AED 2000 | Payment stored as default 'AED' on non-AED business (INR) |
| `PAY-002` (`8702c234`) | Farez Management | AED 1390 | Payment stored as default 'AED' on non-AED business (INR) |
| `PAY-005` (`13b19b83`) | Dev Priya | AED 10000 | Payment currency (AED) != linked document currency (CAD) |
| `PAY-006` (`f07802f5`) | Dev Priya | AED 2400 | Payment currency (AED) != linked document currency (CAD) |
| `PAY-003` (`9ad79927`) | Farez Management | AED 2000 | Payment stored as default 'AED' on non-AED business (INR) |
| `PAY-007` (`a82903a9`) | Dev Priya | AED 2000 | Payment stored as default 'AED' on non-AED business (CAD) |

