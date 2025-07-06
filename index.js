#!/usr/bin/env node

require('dotenv').config();

const server = require('./src/server');

// Start the GraphQL server
server.start()
  .then(() => {
    console.log('🎉 IoT Greenhouse GraphQL API is running!');
  })
  .catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
