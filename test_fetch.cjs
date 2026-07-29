const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/projects',
  method: 'GET',
  headers: {
    'x-business-id': 'a21c8ef4-bd77-491d-955e-819710afc26c'
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  let data = '';
  res.on('data', d => {
    data += d;
  });
  res.on('end', () => {
    console.log(data);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
