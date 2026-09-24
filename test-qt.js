const quotationService = require('./src/services/sales/quotation.service');
const payload = {
  title: "Test QT",
  customerId: "1f80e27b-bd3f-4cc5-9429-e3758f355d82",
  currency: "INR",
  issueDate: "2026-09-24T00:00:00.000Z",
  items: [
    {
      productId: "45129c19-1372-44d7-9e19-f36db4c68322",
      itemName: "",
      description: "steel pipe",
      itemType: "GOODS",
      quantity: 1,
      price: 50,
      discount: 0
    }
  ]
};
const businessId = "dc70ca38-b141-477d-a379-f02649117a78";
const userId = "156f8af2-2f10-43f3-bd39-70a45023153a";
const userEmail = "test@example.com";

async function run() {
  try {
    const qt = await quotationService.createQuotation(businessId, userId, userEmail, payload);
    console.log("Success!", qt.id);
  } catch (err) {
    console.error("Failed!", err);
  }
}
run();
