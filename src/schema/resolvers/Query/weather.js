const weatherService = require('../../../services/weatherService');

const weatherResolvers = {
  /**
   * Get current weather data from API
   */
  getCurrentWeather: async (parent, { location }, context) => {
    try {
      console.log('[WeatherResolver] getCurrentWeather called', { location, user: context.user?.username });
      
      const weatherData = await weatherService.getCurrentWeather(location);
      return weatherData;
    } catch (error) {
      console.error('[WeatherResolver] Error in getCurrentWeather:', error);
      throw new Error(`Failed to get current weather: ${error.message}`);
    }
  },

  /**
   * Get latest weather data from database
   */
  getLatestWeather: async (parent, { limit = 1 }, context) => {
    try {
      console.log('[WeatherResolver] getLatestWeather called', { limit, user: context.user?.username });
      
      const weatherData = await weatherService.getLatestWeather(limit);
      return weatherData;
    } catch (error) {
      console.error('[WeatherResolver] Error in getLatestWeather:', error);
      throw new Error(`Failed to get latest weather: ${error.message}`);
    }
  },

  /**
   * Get weather history with pagination
   */
  getWeatherHistory: async (parent, { hours = 24, limit = 100, page = 1 }, context) => {
    try {
      console.log('[WeatherResolver] getWeatherHistory called', { hours, limit, page, user: context.user?.username });
      
      const historyData = await weatherService.getWeatherHistory(hours, limit, page);
      return historyData;
    } catch (error) {
      console.error('[WeatherResolver] Error in getWeatherHistory:', error);
      throw new Error(`Failed to get weather history: ${error.message}`);
    }
  },

  /**
   * Get weather chart data
   */
  getWeatherChartData: async (parent, { hours = 24 }, context) => {
    try {
      console.log('[WeatherResolver] getWeatherChartData called', { hours, user: context.user?.username });
      
      const chartData = await weatherService.getWeatherChartData(hours);
      return chartData;
    } catch (error) {
      console.error('[WeatherResolver] Error in getWeatherChartData:', error);
      throw new Error(`Failed to get weather chart data: ${error.message}`);
    }
  },

  /**
   * Get weather statistics
   */
  getWeatherStats: async (parent, { days = 7 }, context) => {
    try {
      console.log('[WeatherResolver] getWeatherStats called', { days, user: context.user?.username });
      
      const stats = await weatherService.getWeatherStats(days);
      return stats;
    } catch (error) {
      console.error('[WeatherResolver] Error in getWeatherStats:', error);
      throw new Error(`Failed to get weather statistics: ${error.message}`);
    }
  },

  /**
   * Get weather service configuration
   */
  getWeatherConfig: async (parent, args, context) => {
    try {
      console.log('[WeatherResolver] getWeatherConfig called', { user: context.user?.username });
      
      // Check if user has admin access
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Access denied. Admin role required to view weather configuration.');
      }
      
      const config = weatherService.getWeatherConfig();
      return config;
    } catch (error) {
      console.error('[WeatherResolver] Error in getWeatherConfig:', error);
      throw new Error(`Failed to get weather configuration: ${error.message}`);
    }
  }
};

module.exports = weatherResolvers;