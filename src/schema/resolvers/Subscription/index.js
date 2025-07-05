// Import all subscription resolvers
const weather = require('./weather');
const sensors = require('./sensors');
const devices = require('./devices');
const notifications = require('./notifications');

// Combine all Subscription resolvers
const Subscription = {
  // Placeholder for development
  _empty: () => 'GraphQL Subscription placeholder',
  
  // Weather subscriptions
  ...weather,
  
  // Sensor subscriptions
  ...sensors,
  
  // Device subscriptions
  ...devices,
  
  // Notification subscriptions
  ...notifications,
};

module.exports = Subscription;