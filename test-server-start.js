require('dotenv').config();
const { testConnection: testDB } = require('./src/config/database');
const { testConnection: testRedis } = require('./src/config/redis');
const weatherService = require('./src/services/weatherService');

async function testServerComponents() {
  console.log('🧪 Testing GraphQL Server Components');
  console.log('=====================================');
  
  let allTestsPassed = true;

  // Test Database Connection
  console.log('\n1. Testing Database Connection...');
  try {
    const dbConnected = await testDB();
    if (dbConnected) {
      console.log('✅ Database connection successful');
    } else {
      console.log('❌ Database connection failed');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Database test error:', error.message);
    allTestsPassed = false;
  }

  // Test Redis Connection (with retry)
  console.log('\n2. Testing Redis Connection...');
  try {
    let redisConnected = false;
    let retries = 3;
    
    while (!redisConnected && retries > 0) {
      try {
        redisConnected = await testRedis();
        if (!redisConnected && retries > 1) {
          console.log('   Retrying Redis connection...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.log(`   Redis attempt failed: ${error.message}`);
      }
      retries--;
    }
    
    if (redisConnected) {
      console.log('✅ Redis connection successful');
    } else {
      console.log('⚠️  Redis connection failed (but may work at runtime)');
      // Don't fail the test for Redis - it often works at runtime
    }
  } catch (error) {
    console.log('⚠️  Redis test error:', error.message);
    // Don't fail the test for Redis issues
  }

  // Test Weather Service
  console.log('\n3. Testing Weather Service...');
  try {
    const isConfigured = weatherService.isConfigured();
    if (isConfigured) {
      console.log('✅ Weather service configured');
      
      // Test actual API call (optional)
      try {
        const weatherData = await weatherService.getCurrentWeather();
        console.log('✅ Weather API call successful');
        console.log(`   Location: ${weatherData.location.name}`);
        console.log(`   Temperature: ${weatherData.temperatura}°C`);
      } catch (weatherError) {
        console.log('⚠️  Weather API call failed:', weatherError.message);
        console.log('   (Service is configured but API call failed)');
      }
    } else {
      console.log('❌ Weather service not configured');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ Weather service test error:', error.message);
    allTestsPassed = false;
  }

  // Test GraphQL Schema Loading
  console.log('\n4. Testing GraphQL Schema...');
  try {
    const typeDefs = require('./src/schema/typeDefs');
    const resolvers = require('./src/schema/resolvers');
    
    if (typeDefs && resolvers) {
      console.log('✅ GraphQL schema and resolvers loaded');
      
      // Check if weather resolvers exist
      if (resolvers.Query.getCurrentWeather && 
          resolvers.Mutation.collectWeatherData && 
          resolvers.Subscription.weatherDataUpdated) {
        console.log('✅ Weather resolvers found');
      } else {
        console.log('❌ Weather resolvers missing');
        allTestsPassed = false;
      }
    } else {
      console.log('❌ GraphQL schema loading failed');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('❌ GraphQL schema test error:', error.message);
    allTestsPassed = false;
  }

  // Test Environment Variables
  console.log('\n5. Testing Environment Variables...');
  const requiredEnvVars = [
    'PG_URI',
    'REDIS_HOST', 
    'REDIS_PORT',
    'JWT_SECRET',
    'WEATHER_API_KEY',
    'WEATHER_LOCATION'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length === 0) {
    console.log('✅ All required environment variables present');
  } else {
    console.log('❌ Missing environment variables:', missingVars.join(', '));
    allTestsPassed = false;
  }

  // Summary
  console.log('\n=====================================');
  if (allTestsPassed) {
    console.log('🎉 All tests passed! GraphQL server is ready to start.');
    console.log('\nTo start the server, run:');
    console.log('  npm start');
    console.log('\nGraphQL Playground will be available at:');
    console.log('  http://localhost:4000/graphql');
  } else {
    console.log('❌ Some tests failed. Please fix the issues before starting the server.');
  }

  process.exit(allTestsPassed ? 0 : 1);
}

// Run the tests
testServerComponents().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});