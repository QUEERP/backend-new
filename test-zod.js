const { createQuotationSchema } = require('./src/validations/sales.validation');

const payload = {
  "title": "que info tech - Initial Deal",
  "customerId": "2c56aac0-34ea-42fe-951a-64c05675e0a3",
  "dealId": "45487c43-40ff-4fef-a214-6aaf22b67922",
  "currency": "INR",
  "discount": 0,
  "gstTreatment": "SAME_STATE",
  "issueDate": "2026-09-24",
  "items": [
    {
      "productId": "45129c19-1372-44d7-9e19-f36db4c68322",
      "itemName": "",
      "description": "steel pipe",
      "quantity": 1,
      "price": 50,
      "taxPercent": 0,
      "itemType": "GOODS",
      "hsnSacCode": "33235",
      "warehouseId": "73e93a7d-5310-4050-8b1b-b4a11f264d12",
      "cgstPercent": 0,
      "sgstPercent": 0,
      "igstPercent": 0
    }
  ],
  "notes": "tesyt",
  "tax": 0,
  "taxType": "GST"
};

try {
  const result = createQuotationSchema.parse(payload);
  console.log("Validation succeeded!", result);
} catch (error) {
  console.error("Validation failed!", error);
}
