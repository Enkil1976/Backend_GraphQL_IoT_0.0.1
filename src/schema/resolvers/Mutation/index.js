// Import all mutation resolvers
const auth = require('./auth');
const devices = require('./devices');
const users = require('./users');
const rules = require('./rules');
const notifications = require('./notifications');
const weather = require('./weather');
// const pumpCycles = require('./pumpCycles'); // Disabled - use terminal scripts instead

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
  
  // Pump cycle mutations (disabled - use terminal scripts: node scripts/manage-pump-cycles.js)
  // ...pumpCycles,
};

module.exports = Mutation;