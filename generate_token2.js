const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { userId: '156f8af2-2f10-43f3-bd39-70a45023153a' },
  'super_secret_key_123',
  { expiresIn: '7d', issuer: 'QUE-Accounting', audience: 'QUE-Accounting-Users' }
);
console.log('TOKEN:', token);
