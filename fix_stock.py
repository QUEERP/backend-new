import sys
import re

p = 'c:/Users/DELL/Downloads/new-queerp/backend/src/services/inventory/product.service.js'
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

target_str = """        attachments: data.attachments !== undefined ? data.attachments : product.attachments
      }
    });

    await logAction(tx, {"""

replacement_str = """        attachments: data.attachments !== undefined ? data.attachments : product.attachments
      }
    });

    if (data.warehouseId && finalType === 'GOODS') {
      const existingStock = await tx.stock.findFirst({
        where: { productId: id, businessId: businessId },
        orderBy: { createdAt: 'asc' }
      });
      
      if (existingStock) {
         if (existingStock.warehouseId !== data.warehouseId || existingStock.locationId !== (data.locationId || null)) {
            const conflict = await tx.stock.findFirst({
               where: { productId: id, warehouseId: data.warehouseId, locationId: data.locationId || null }
            });
            if (!conflict) {
               await tx.stock.update({
                 where: { id: existingStock.id },
                 data: {
                   warehouseId: data.warehouseId,
                   locationId: data.locationId || null
                 }
               });
               
               await tx.stockMovement.updateMany({
                 where: { productId: id, warehouseId: existingStock.warehouseId, locationId: existingStock.locationId },
                 data: { warehouseId: data.warehouseId, locationId: data.locationId || null }
               });
            }
         }
      } else {
         await tx.stock.create({
           data: {
             productId: id,
             businessId: businessId,
             warehouseId: data.warehouseId,
             locationId: data.locationId || null,
             quantity: 0
           }
         });
      }
    }

    await logAction(tx, {"""

if target_str in content:
    content = content.replace(target_str, replacement_str)
elif target_str.replace('\n', '\r\n') in content:
    content = content.replace(target_str.replace('\n', '\r\n'), replacement_str.replace('\n', '\r\n'))
else:
    print("TARGET NOT FOUND")
    sys.exit(1)

with open(p, 'w', encoding='utf-8') as f:
    f.write(content)
print("SUCCESS")
