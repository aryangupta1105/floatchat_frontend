const axios = require('axios');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjczNzA1YjVmN2I3ZTI4ZGZkZDVhYTY1Iiwicm9sZSI6InVzZXIiLCJpYXQiOjE3MzM3NDc3NjksImV4cCI6MTczNDM1MjU2OX0.4xd3Y_7xyeHSC1r3sP8nR4zQ1vW2xY9aB6cD5eF8gH0';
const baseURL = 'http://localhost:5000';

async function testQueries() {
  try {
    console.log('\n=== Testing Conceptual Query ===');
    console.log('Question: what variables does an argo profile typically measure?');
    
    const conceptualRes = await axios.post(`${baseURL}/query`, 
      {
        question: 'what variables does an argo profile typically measure?',
        mode: 'auto'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`Type: ${conceptualRes.data.type}`);
    console.log(`Answer: ${conceptualRes.data.answer}\n`);

    console.log('=== Testing Data Query (Location) ===');
    console.log('Question: is there any argo data available in the bay of bengal in 2002?');
    
    const dataRes = await axios.post(`${baseURL}/query`, 
      {
        question: 'is there any argo data available in the bay of bengal in 2002 if yes fetch it?',
        mode: 'auto'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`Type: ${dataRes.data.type}`);
    console.log(`SQL: ${dataRes.data.sql ? dataRes.data.sql.substring(0, 100) + '...' : 'null'}`);
    console.log(`Answer: ${dataRes.data.answer}`);
    console.log(`Rows returned: ${dataRes.data.raw_rows ? dataRes.data.raw_rows.length : 0}\n`);

    console.log('=== Testing Conceptual Query #2 ===');
    console.log('Question: explain how argo floats work');
    
    const conceptual2Res = await axios.post(`${baseURL}/query`, 
      {
        question: 'explain how argo floats work',
        mode: 'auto'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`Type: ${conceptual2Res.data.type}`);
    console.log(`Answer: ${conceptual2Res.data.answer}\n`);

    console.log('=== All tests completed successfully! ===');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testQueries();
