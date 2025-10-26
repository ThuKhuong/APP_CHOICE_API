const http = require('http');

function makeRequest() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/teacher/sessions/1/proctor',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZWFjaGVyQGV4YW1wbGUuY29tIiwicm9sZSI6WyJ0ZWFjaGVyIl0sImlhdCI6MTczNDU2MjM3MywiZXhwIjoxNzM0NjQ4NzczfQ.gpRMHJD4SxPaeRxRemyFsOjpQzh9k7A1QpVqwtwhCI4'
    }
  };

  const req = http.request(options, (res) => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response body:', data);
      try {
        const jsonData = JSON.parse(data);
        console.log('Parsed JSON:', JSON.stringify(jsonData, null, 2));
      } catch (e) {
        console.log('Not JSON response');
      }
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e.message);
  });

  req.end();
}

console.log('Testing API endpoint...');
makeRequest();

