const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5002,
  path: '/api/payments?page=1&limit=10',
  method: 'GET',
  headers: {
    // We need to bypass auth or use a valid token.
    // Instead of doing auth, let's just see if the endpoint works if we mock auth or if we just look at the controller code.
  }
};
