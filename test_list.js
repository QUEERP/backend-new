const statutoryController = require('./src/controllers/statutoryController');

async function main() {
  const req = {
    business: { id: 'dc70ca38-b141-477d-a379-f02649117a78' }
  };
  const res = {
    json: function(data) {
      console.log(JSON.stringify(data, null, 2));
    },
    status: function(code) {
      console.log(`HTTP ${code}`);
      return this;
    }
  };
  await statutoryController.listAvailableReports(req, res);
}

main().catch(console.error);
