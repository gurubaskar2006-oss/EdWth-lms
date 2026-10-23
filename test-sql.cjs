const http = require('http');

const data = JSON.stringify({
  language: 'sqlite3',
  version: '*',
  files: [{
    name: 'main',
    content: "CREATE TABLE students (id INT, name TEXT);\nINSERT INTO students VALUES (1, 'Alex Vance');\nSELECT * FROM students;"
  }]
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/execute',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let result = '';
  res.on('data', (chunk) => {
    result += chunk;
  });
  res.on('end', () => {
    console.log(result);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.write(data);
req.end();
