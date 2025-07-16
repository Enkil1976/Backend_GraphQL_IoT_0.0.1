const { healthCheck: dbHealthCheck } = require('../../../config/database');
const { healthCheck: redisHealthCheck } = require('../../../config/redis');
const { healthCheck: pubsubHealthCheck } = require('../../../utils/pubsub');

module.exports = {
  health: async() => {
    try {
      // Check all services
      const [dbStatus, redisStatus, pubsubStatus] = await Promise.allSettled([
        dbHealthCheck(),
        redisHealthCheck(),
        pubsubHealthCheck()
      ]);

      // Extract results
      const database = dbStatus.status === 'fulfilled'
        ? dbStatus.value.status
        : 'ERROR';

      const redis = redisStatus.status === 'fulfilled'
        ? redisStatus.value.status
        : 'ERROR';

      const mqtt = 'OK'; // MQTT health check will be implemented later

      return {
        status: 'OK',
        timestamp: new Date(),
        services: {
          database,
          redis,
          mqtt
        }
      };
    } catch (error) {
      console.error('Health check error:', error);
      return {
        status: 'ERROR',
        timestamp: new Date(),
        services: {
          database: 'ERROR',
          redis: 'ERROR',
          mqtt: 'ERROR'
        }
      };
    }
  }
};
