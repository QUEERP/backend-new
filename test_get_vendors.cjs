const { getVendors } = require('./src/controllers/vendor');
async function test() {
  const req = {
    business: { id: 'a21c8ef4-bd77-491d-955e-819710afc26c' },
    query: {}
  };
  const res = {
    json: (data) => console.log(JSON.stringify(data, null, 2)),
    status: (code) => ({ json: (data) => console.log('Status', code, data) })
  };
  await getVendors(req, res);
}
test();
