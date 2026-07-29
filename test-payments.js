const { getPayments } = require('./src/controllers/paymentController');

async function test() {
  const req = {
    business: { id: 'a21c8ef4-bd77-491d-955e-819710afc26c' }
  };
  
  const res = {
    status: (code) => {
      console.log('Status:', code);
      return { json: (data) => console.log('Response:', JSON.stringify(data, null, 2)) };
    },
    json: (data) => console.log('Response:', JSON.stringify(data, null, 2))
  };

  await getPayments(req, res);
  process.exit(0);
}
test();
