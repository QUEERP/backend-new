const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const regexes = [
  { match: /model SalesOrder \{[\s\S]*?\}/, replacement: (m) => m.replace(/deliveryNotes DeliveryNote\[\]\n?/, '') + '\n  deliveryNotes DeliveryNote[]\n' },
  { match: /model Warehouse \{[\s\S]*?\}/, replacement: (m) => m.replace(/deliveryNoteItems DeliveryNoteItem\[\]\n?/, '') + '\n  deliveryNoteItems DeliveryNoteItem[]\n' },
  { match: /model Vendor \{[\s\S]*?\}/, replacement: (m) => m.replace(/debitNotes DebitNote\[\]\n?/, '') + '\n  debitNotes DebitNote[]\n' },
  { match: /model Bill \{[\s\S]*?\}/, replacement: (m) => m.replace(/debitNotes DebitNote\[\]\n?/, '') + '\n  debitNotes DebitNote[]\n' },
  { match: /model PurchaseReturn \{[\s\S]*?\}/, replacement: (m) => m.replace(/debitNotes DebitNote\[\]\n?/, '') + '\n  debitNotes DebitNote[]\n' },
];

for (const {match, replacement} of regexes) {
    schema = schema.replace(match, replacement);
}

fs.writeFileSync('prisma/schema.prisma', schema);
