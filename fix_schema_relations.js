const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Opposite relations missing:
// 1. SalesOrder needs `deliveryNotes DeliveryNote[]` -> Added previously, but let's check regex.
// 2. Product needs `deliveryNoteItems DeliveryNoteItem[]` and `debitNoteItems DebitNoteItem[]`
// 3. Warehouse needs `deliveryNoteItems DeliveryNoteItem[]`
// 4. Vendor needs `debitNotes DebitNote[]` -> Added previously, but let's check regex.
// 5. Bill needs `debitNotes DebitNote[]`
// 6. PurchaseReturn needs `debitNotes DebitNote[]`

const replacements = [
  { match: /model Product \{/, replacement: 'model Product {\n  deliveryNoteItems DeliveryNoteItem[]\n  debitNoteItems DebitNoteItem[]' },
  { match: /model Warehouse \{/, replacement: 'model Warehouse {\n  deliveryNoteItems DeliveryNoteItem[]' },
  { match: /model SalesOrder \{/, replacement: 'model SalesOrder {\n  deliveryNotes DeliveryNote[]' },
  { match: /model Vendor \{/, replacement: 'model Vendor {\n  debitNotes DebitNote[]' },
  { match: /model Bill \{/, replacement: 'model Bill {\n  debitNotes DebitNote[]' },
  { match: /model PurchaseReturn \{/, replacement: 'model PurchaseReturn {\n  debitNotes DebitNote[]' },
];

for (const {match, replacement} of replacements) {
    if (schema.match(match) && !schema.includes(replacement.split('\n')[1])) {
        schema = schema.replace(match, replacement);
    }
}

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Opposite relations added.');
