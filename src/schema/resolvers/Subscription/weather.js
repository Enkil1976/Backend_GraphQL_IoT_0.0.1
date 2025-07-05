const weatherService = require('../../../services/weatherService');
const { EVENTS } = require('../../../utils/pubsub');

const weatherSubscriptions = {
  /**
   * Subscribe to weather data updates
   */
  weatherDataUpdated: {
    subscribe: (parent, args, context) => {
      console.log('[WeatherSubscription] weatherDataUpdated subscription requested', { user: context.user?.username });
      
      // Optional: Add authentication check
      if (!context.user) {
        throw new Error('Authentication required for weather data subscription.');
      }
      
      return weatherService.getPubSub().asyncIterator([EVENTS.WEATHER_DATA_UPDATED]);
    }
  },

  /**
   * Subscribe to weather configuration changes
   */
  weatherConfigChanged: {
    subscribe: (parent, args, context) => {
      console.log('[WeatherSubscription] weatherConfigChanged subscription requested', { user: context.user?.username });
      
      // Check if user has admin access
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Access denied. Admin role required to subscribe to weather configuration changes.');
      }
      
      return weatherService.getPubSub().asyncIterator([EVENTS.WEATHER_CONFIG_CHANGED]);
    }
  }
};

module.exports = weatherSubscriptions;