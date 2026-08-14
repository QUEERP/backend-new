const reportController = require('./src/controllers/reportController');

async function test() {
  try {
    const req = {
      business: { id: "e24ee048-2039-4c2e-a1c9-24bf7b2f943e" },
      query: {}
    };
    const res = {
      json: (data) => console.log(JSON.stringify(data, null, 2)),
      status: (code) => {
        console.log("Status Code:", code);
        return {
          json: (data) => console.log("Error JSON:", JSON.stringify(data, null, 2))
        };
      }
    };

    console.log("Testing getBalanceSheet:");
    await reportController.getBalanceSheet(req, res);

    console.log("Testing getTrialBalance:");
    await reportController.getTrialBalance(req, res);
    
    console.log("Testing getProfitLoss:");
    await reportController.getProfitLoss(req, res);
    
  } catch (e) {
    console.error(e);
  }
}
test();
