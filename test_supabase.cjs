
const https = require('https');

const url = "https://kjukdoqkunuifiorcdpz.supabase.co/rest/v1/companies?select=id&limit=1";
const options = {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqdWtkb3FrdW51aWZpb3JjZHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTE5NjYsImV4cCI6MjA4NTg4Nzk2Nn0.piJhInicK1y_9e6jSmRpm-hpg-grR7w0iTJN3zTUWFM',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqdWtkb3FrdW51aWZpb3JjZHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTE5NjYsImV4cCI6MjA4NTg4Nzk2Nn0.piJhInicK1y_9e6jSmRpm-hpg-grR7w0iTJN3zTUWFM'
  }
};

const req = https.get(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Body: ${data}`);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
});
