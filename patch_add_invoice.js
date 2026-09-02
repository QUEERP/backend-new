const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/components/dashboard/add-invoice-client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add TaxOverrideModal import
if (!content.includes('TaxOverrideModal')) {
  content = content.replace(
    "import { EditableTaxSelect } from '@/components/dashboard/editable-tax-select'",
    "import { EditableTaxSelect } from '@/components/dashboard/editable-tax-select'\nimport { TaxOverrideModal } from '@/components/dashboard/tax-override-modal'"
  );
}

// 2. Remove manualTaxType and old summary fields, add new state for TaxOverrideModal and resolvedTaxes
content = content.replace(
  "const [manualTaxType, setManualTaxType] = useState<'intra' | 'inter' | null>(null)",
  `const [resolvedTaxes, setResolvedTaxes] = useState<any[]>([]);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideItemIndex, setOverrideItemIndex] = useState<number | null>(null);`
);

// 3. Update the summary useMemo to just use resolvedTaxes
content = content.replace(
  /const summary = React\.useMemo\(\(\) => \{[\s\S]*?return \{\n      subtotal,\n      taxTotal,\n      total,\n      cgst,\n      sgst,\n      igst,\n      vat,\n      tds,\n      isIndia,\n      isUAE,\n      isIntrastate,\n      isOtherCountry,\n      taxLabel,\n    \}\n  \}\, \[items\, formData\, manualTaxType\, customers\, business\]\)/g,
  `const summary = React.useMemo(() => {
    let subtotal = 0;
    items.forEach(item => {
      subtotal += (Number(item.quantity || 0) * Number(item.price || 0));
    });
    
    // Use the backend-resolved tax amount
    const taxTotal = resolvedTaxes.reduce((sum, tax) => sum + (tax.taxAmountTxnCcy || 0), 0);
    
    const discount = Number(formData.discount || 0);
    const shipping = Number(formData.shippingCharges || 0);
    const total = subtotal + taxTotal - discount + shipping;

    const isBasic = business?.businessType === 'Basic';

    return {
      subtotal,
      taxTotal,
      total,
      isBasic,
    };
  }, [items, formData.discount, formData.shippingCharges, resolvedTaxes, business]);`
);

// 4. Update handleSubmit mappedItems to send override flags instead of cgst/sgst
content = content.replace(
  /const mappedItems = items\.map\(item => \(\{[\s\S]*?\}\)\)/g,
  `const mappedItems = items.map((item, index) => ({
      id: item.id || \`temp-\${index}\`,
      itemName: item.itemName,
      description: item.description,
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      productId: item.productId,
      warehouseId: item.warehouseId,
      hsnSacCode: item.hsnSacCode,
      unit: item.unit,
      itemType: item.itemType,
      isManualOverride: item.isManualOverride,
      overrideTaxRate: item.overrideTaxRate,
      overrideReason: item.overrideReason,
      overrideTaxTypeId: item.overrideTaxTypeId
    }))`
);

// 5. Add useDebounce and useEffect for /api/taxes/resolve
content = content.replace(
  "const addItem = () => {",
  `
  useEffect(() => {
    const fetchTaxes = async () => {
      if (!businessId || items.length === 0 || !items[0].price) return;
      try {
        const token = getCookie('token') || getCookie('accessToken');
        const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5002';
        const res = await fetch(\`\${API_BASE}/api/taxes/resolve\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: \`Bearer \${token}\`,
            'x-business-id': businessId
          },
          body: JSON.stringify({
            items,
            customerId: formData.customerId,
            discount: formData.discount,
            currency: formData.currency,
            transactionDate: formData.invoiceDate
          })
        });
        const data = await res.json();
        if (data.success) {
          setResolvedTaxes(data.data.taxTransactions || []);
        }
      } catch (err) {
        console.error("Failed to fetch tax preview", err);
      }
    };
    
    const timeoutId = setTimeout(fetchTaxes, 500);
    return () => clearTimeout(timeoutId);
  }, [items, formData.customerId, formData.discount, formData.currency, formData.invoiceDate, businessId]);

  const addItem = () => {`
);

// We need to replace the Table headers (remove country-specific headers)
content = content.replace(
  /\{summary\.isOtherCountry \? \([\s\S]*?\}\)/g,
  `<TableHead className="w-[100px] h-12 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Tax</TableHead>`
);

// We need to replace the Table body cells (remove EditableTaxSelect, replace with Tax Rate display and Override button)
content = content.replace(
  /\{summary\.isOtherCountry \? \([\s\S]*?<\/TableCell>\n\s*\}\)/g,
  `<TableCell className="align-top py-4">
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold">
          {item.isManualOverride ? item.overrideTaxRate : (resolvedTaxes.find(t => t.itemIndex === index)?.taxRate?.rate || 0)}%
        </span>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          className="h-6 text-[10px] px-2"
          onClick={() => {
            setOverrideItemIndex(index);
            setOverrideModalOpen(true);
          }}
        >
          Override
        </Button>
      </div>
    </TableCell>`
);

// Replace the Total Line Amount display to just be item price * qty (or + resolved tax)
content = content.replace(
  /const lineAmount = Number\(item\.quantity \|\| 0\) \* Number\(item\.price \|\| 0\)[\s\S]*?const totalLineAmount = formData\.vatType === 'inclusive' \? lineAmount : \(lineAmount \+ lineTax\)/g,
  `const lineAmount = Number(item.quantity || 0) * Number(item.price || 0);
  const lineTax = resolvedTaxes.filter(t => t.itemIndex === index).reduce((sum, t) => sum + t.taxAmountTxnCcy, 0);
  const totalLineAmount = lineAmount + lineTax;`
);

// Replace Order Summary tax details
content = content.replace(
  /\{summary\.isIndia \? \([\s\S]*?\}\) : null\}/g,
  `<div className="space-y-2 border-t border-border pt-3">
    {resolvedTaxes.map((tax, idx) => (
      <div key={idx} className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground font-medium">{tax.taxRate?.taxType?.name || tax.overrideTaxType?.name || 'Tax'} ({tax.taxRate?.rate || tax.overrideRate}%)</span>
        <span className="font-bold text-blue-600">+{formData.currency || currency} {tax.taxAmountTxnCcy.toFixed(2)}</span>
      </div>
    ))}
  </div>`
);

// Add the TaxOverrideModal at the end
content = content.replace(
  /\{showCreateProduct && \([\s\S]*?\}\)/,
  `$&
  <TaxOverrideModal
    isOpen={overrideModalOpen}
    onClose={() => setOverrideModalOpen(false)}
    itemName={overrideItemIndex !== null ? (items[overrideItemIndex]?.itemName || 'Item') : ''}
    currentRate={overrideItemIndex !== null ? (resolvedTaxes.find(t => t.itemIndex === overrideItemIndex)?.taxRate?.rate || 0) : 0}
    onApply={(rate, reason, taxTypeId) => {
      if (overrideItemIndex !== null) {
        const newItems = [...items];
        newItems[overrideItemIndex] = {
          ...newItems[overrideItemIndex],
          isManualOverride: true,
          overrideTaxRate: rate,
          overrideReason: reason,
          overrideTaxTypeId: taxTypeId
        };
        setItems(newItems);
      }
    }}
  />`
);

fs.writeFileSync(filePath, content);
console.log('Patched add-invoice-client.tsx successfully.');
