const WebSocket = require('ws');
const { SubscriptionClient } = require('subscriptions-transport-ws');

/**
 * Test script for GraphQL WebSocket subscriptions
 * Tests real-time sensor data subscriptions
 */

// Test configuration
const WS_URL = 'ws://localhost:4000/graphql';
const TEST_TOKEN = 'your-test-jwt-token'; // Replace with actual JWT

// Sample subscription query
const SENSOR_DATA_SUBSCRIPTION = `
  subscription SensorDataUpdated($sensorTypes: [SensorType!]) {
    sensorDataUpdated(sensorTypes: $sensorTypes) {
      id
      sensorId
      timestamp
      temperatura
      humedad
      ph
      ec
      ppm
      light
      whiteLight
      watts
      voltage
      current
    }
  }
`;

// Sample variables
const SUBSCRIPTION_VARIABLES = {
  sensorTypes: ['TEMHUM1', 'TEMHUM2', 'CALIDAD_AGUA', 'LUXOMETRO']
};

async function testWebSocketConnection() {
  console.log('🧪 Testing WebSocket GraphQL Subscription...\n');

  try {
    // Create WebSocket client
    const wsClient = new SubscriptionClient(WS_URL, {
      reconnect: true,
      connectionParams: {
        authorization: `Bearer ${TEST_TOKEN}`,
        token: TEST_TOKEN
      }
    }, WebSocket);

    // Handle connection events
    wsClient.on('connected', () => {
      console.log('✅ WebSocket connected successfully');
    });

    wsClient.on('disconnected', () => {
      console.log('📡 WebSocket disconnected');
    });

    wsClient.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    // Create subscription
    const subscription = wsClient.request({
      query: SENSOR_DATA_SUBSCRIPTION,
      variables: SUBSCRIPTION_VARIABLES
    });

    // Handle subscription data
    subscription.subscribe({
      next: (result) => {
        if (result.errors) {
          console.error('❌ Subscription error:', result.errors);
          return;
        }

        const data = result.data?.sensorDataUpdated;
        if (data) {
          console.log(`📊 New sensor data received:`);
          console.log(`   Sensor: ${data.sensorId}`);
          console.log(`   Time: ${data.timestamp}`);
          
          if (data.temperatura !== null) {
            console.log(`   Temperature: ${data.temperatura}°C`);
          }
          if (data.humedad !== null) {
            console.log(`   Humidity: ${data.humedad}%`);
          }
          if (data.ph !== null) {
            console.log(`   pH: ${data.ph}`);
          }
          if (data.light !== null) {
            console.log(`   Light: ${data.light} lux`);
          }
          if (data.watts !== null) {
            console.log(`   Power: ${data.watts}W`);
          }
          console.log('   ---');
        }
      },
      error: (error) => {
        console.error('❌ Subscription error:', error);
      },
      complete: () => {
        console.log('✅ Subscription completed');
      }
    });

    console.log('🔊 Listening for real-time sensor data updates...');
    console.log('📍 Subscribed to sensor types:', SUBSCRIPTION_VARIABLES.sensorTypes.join(', '));
    console.log('⏰ Waiting for data (press Ctrl+C to exit)...\n');

    // Keep the process alive
    process.on('SIGINT', () => {
      console.log('\n🛑 Closing subscription...');
      subscription.unsubscribe();
      wsClient.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Test without authentication (for development)
async function testWithoutAuth() {
  console.log('🧪 Testing WebSocket connection without authentication...\n');

  const ws = new WebSocket(WS_URL, 'graphql-ws');

  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    // Send connection init
    ws.send(JSON.stringify({
      type: 'connection_init',
      payload: {}
    }));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Received message:', message);

    if (message.type === 'connection_ack') {
      console.log('✅ Connection acknowledged');
      
      // Start subscription
      ws.send(JSON.stringify({
        id: 'test-subscription',
        type: 'start',
        payload: {
          query: SENSOR_DATA_SUBSCRIPTION,
          variables: SUBSCRIPTION_VARIABLES
        }
      }));
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('📡 WebSocket connection closed');
  });
}

// Check command line arguments
const args = process.argv.slice(2);
const useAuth = !args.includes('--no-auth');

if (useAuth) {
  if (TEST_TOKEN === 'your-test-jwt-token') {
    console.log('⚠️  Please set a valid JWT token in TEST_TOKEN variable');
    console.log('💡 Or run with --no-auth flag to test without authentication');
    process.exit(1);
  }
  testWebSocketConnection();
} else {
  testWithoutAuth();
}