const fs = require('fs');

const pController = 'c:/Users/DELL/Downloads/new-queerp/backend/src/controllers/PO.Controller.js';
let cController = fs.readFileSync(pController, 'utf8');

// Fix createPurchaseOrder
cController = cController.replace(
  /expectedDeliveryDate: expectedDeliveryDate \? new Date\(expectedDeliveryDate\) : null,\s*notes,\s*items: \{ create: mappedItems \}/g,
  `expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        notes,
        currencyCode: req.body.currencyCode || 'AED',
        currencySymbol: req.body.currencySymbol || 'AED',
        items: { create: mappedItems }`
);

// Fix updatePurchaseOrder to strip items and properly pass other fields
cController = cController.replace(
  /const order = await prisma\.purchaseOrder\.update\(\{\s*where: \{ id \},\s*data: req\.body,/g,
  `const { items, ...updateData } = req.body;
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,`
);

fs.writeFileSync(pController, cController);
console.log('Fixed PO currency bug and edit crash');
