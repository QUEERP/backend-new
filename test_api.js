const http = require('http');

const data = JSON.stringify({ email: 'pwtest@example.com', password: 'password123' });

const options = {
  hostname: 'localhost',
  port: 5002,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const json = JSON.parse(body);
    const token = json.token || json.data?.token || json.accessToken;
    console.log("Token:", token ? "Got token" : "No token");
    
    // Now request statutory list
    const req2 = http.request({
      hostname: 'localhost',
      port: 5002,
      path: '/api/statutory/list?businessId=8f626f0d-eb91-493a-be2a-7a4f7f58d519',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-business-id': '8f626f0d-eb91-493a-be2a-7a4f7f58d519'
      }
    }, res2 => {
      let body2 = '';
      res2.on('data', d => body2 += d);
      res2.on('end', () => {
        console.log("Status:", res2.statusCode);
        console.log("Response:", body2);
      });
    });
    req2.end();
  });
});

req.write(data);
req.end();
