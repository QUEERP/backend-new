const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/components/dashboard/add-invoice-client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Restore isIndia and tds in summary useMemo
content = content.replace(
  `    return {
      subtotal,
      taxTotal,
      total,
      isBasic,
    };
  }, [items, formData.discount, formData.shippingCharges, resolvedTaxes, business]);`,
  `    const isIndia = business?.country === 'INDIA' || business?.country?.id === 'INDIA';
    const tds = Number(formData.tds || 0);
    const grandTotal = total - tds;

    return {
      subtotal,
      taxTotal,
      total: grandTotal,
      isBasic,
      isIndia,
      tds
    };
  }, [items, formData.discount, formData.shippingCharges, formData.tds, resolvedTaxes, business]);`
);

fs.writeFileSync(filePath, content);
console.log('Restored TDS logic.');
