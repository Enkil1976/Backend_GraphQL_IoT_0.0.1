// Import all query resolvers
const health = require('./health');
const sensors = require('./sensors');
const devices = require('./devices');
const users = require('./users');
const rules = require('./rules');
const notifications = require('./notifications');
const weather = require('./weather');
// const pumpCycles = require('./pumpCycles'); // Temporarily disabled - schema fix needed

// Combine all Query resolvers
const Query = {
  // Health check
  ...health,
  
  // Sensor queries
  ...sensors,
  
  // Device queries
  ...devices,
  
  // User queries
  ...users,
  
  // Rule queries
  ...rules,
  
  // Notification queries
  ...notifications,
  
  // Weather queries
  ...weather,
  
  // Pump cycle queries - Temporarily disabled for schema fix
  // ...pumpCycles,
};

module.exports = Query;