const http = require('http');
const data = JSON.stringify({
  name: 'Test User',
  email: `testuser_direct_${Date.now()}@example.com`,
  password: 'Test@12345',
  college: 'Test College',
  university: 'University of Health Sciences (UHS)',
  year: 5,
});
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};
const req = http.request(options, (res) => {
  console.log('STATUS', res.statusCode);
  console.log('HEADERS', JSON.stringify(res.headers));
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('BODY', body);
  });
});
req.on('error', (err) => console.error('ERROR', err.message));
req.write(data);
req.end();
