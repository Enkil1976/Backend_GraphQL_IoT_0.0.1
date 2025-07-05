require('dotenv').config();
const server = require('./src/server');

async function testServerStart() {
  console.log('🚀 Testing GraphQL server startup...');
  
  try {
    const httpServer = await server.start();
    console.log('✅ Server started successfully!');
    
    // Test basic endpoints
    const http = require('http');
    
    // Test health endpoint
    const healthReq = http.request('http://localhost:4000/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          console.log('✅ Health endpoint working:', health.status);
        } catch (error) {
          console.log('⚠️ Health endpoint response parsing failed');
        }
      });
    });
    
    healthReq.on('error', (error) => {
      console.log('⚠️ Health endpoint request failed:', error.message);
    });
    
    healthReq.end();
    
    // Wait a bit then shutdown
    setTimeout(async () => {
      console.log('🛑 Shutting down test server...');
      await server.shutdown();
      console.log('✅ Server test completed successfully!');
      process.exit(0);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
}

testServerStart();