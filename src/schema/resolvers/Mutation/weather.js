const weatherService = require('../../../services/weatherService');

const weatherMutations = {
  /**
   * Collect weather data and save to database
   */
  collectWeatherData: async(parent, { location }, context) => {
    try {
      console.log('[WeatherMutation] collectWeatherData called', { location, user: context.user?.username });

      // Check if user has editor or admin access
      if (!context.user || !['admin', 'editor'].includes(context.user.role)) {
        throw new Error('Access denied. Editor or admin role required to collect weather data.');
      }

      const result = await weatherService.collectWeatherData(location);
      return result;
    } catch (error) {
      console.error('[WeatherMutation] Error in collectWeatherData:', error);
      return {
        success: false,
        message: `Failed to collect weather data: ${error.message}`,
        data: null,
        errors: [error.message]
      };
    }
  },

  /**
   * Update weather service configuration
   */
  updateWeatherConfig: async(parent, { input }, context) => {
    try {
      console.log('[WeatherMutation] updateWeatherConfig called', { input, user: context.user?.username });

      // Check if user has admin access
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Access denied. Admin role required to update weather configuration.');
      }

      const result = await weatherService.updateWeatherConfig(input);
      return result;
    } catch (error) {
      console.error('[WeatherMutation] Error in updateWeatherConfig:', error);
      return {
        success: false,
        message: `Failed to update weather configuration: ${error.message}`,
        config: weatherService.getWeatherConfig(),
        errors: [error.message]
      };
    }
  },

  /**
   * Test weather location
   */
  testWeatherLocation: async(parent, { location }, context) => {
    try {
      console.log('[WeatherMutation] testWeatherLocation called', { location, user: context.user?.username });

      // Check if user has admin access
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Access denied. Admin role required to test weather locations.');
      }

      const result = await weatherService.testWeatherLocation(location);
      return result;
    } catch (error) {
      console.error('[WeatherMutation] Error in testWeatherLocation:', error);
      return {
        success: false,
        message: `Failed to test weather location: ${error.message}`,
        locationInfo: null,
        currentWeather: null,
        errors: [error.message]
      };
    }
  }
};

module.exports = weatherMutations;
