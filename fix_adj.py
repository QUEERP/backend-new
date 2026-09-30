import sys
p = 'c:/Users/DELL/Downloads/new-queerp/backend/src/services/inventory/stockAdjustment.service.js'
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """const items = Array.isArray(data.items) ? data.items : (data.productId ? [{ productId: data.productId, quantity: data.quantity, type: data.adjustmentType || data.type || "ADD", batchNumber: data.batchNumber, serialNumbers: data.serialNumbers }] : []);
    if (items.length === 0) throw new Error("Items array is required for stock adjustment");

    const adjustment = await tx.stockAdjustment.create({"""

content = content.replace("const adjustment = await tx.stockAdjustment.create({", replacement)
content = content.replace("create: data.items.map(item => ({", "create: items.map(item => ({")
content = content.replace("for (const item of data.items) {", "for (const item of items) {")

with open(p, 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
