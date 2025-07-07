// Import all mutation resolvers
const auth = require('./auth');
const devices = require('./devices');
const users = require('./users');
const rules = require('./rules');
const notifications = require('./notifications');
const weather = require('./weather');
const pumpCycles = require('./pumpCycles');

// Combine all Mutation resolvers
const Mutation = {
  // Placeholder for development
  _empty: () => 'GraphQL Mutation placeholder',
  
  // Authentication mutations
  ...auth,
  
  // Device mutations
  ...devices,
  
  // User mutations
  ...users,
  
  // Rule mutations
  ...rules,
  
  // Notification mutations
  ...notifications,
  
  // Weather mutations
  ...weather,
  
  // Pump cycle mutations
  ...pumpCycles,
};

module.exports = Mutation;