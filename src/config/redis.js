const Redis = require('ioredis');
require('dotenv').config();

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  username: process.env.REDIS_USER || undefined,
  retryDelayOnFailover: 100,
  enableOfflineQueue: true, // Enable queue for better reliability
  lazyConnect: false, // Connect immediately
  maxRetriesPerRequest: 3,
  retryDelayOnClusterDown: 300,
  retryDelayOnFailover: 100,
  keepAlive: 30000,
  family: 4, // 4 (IPv4) or 6 (IPv6)
  connectTimeout: 10000,
  commandTimeout: 5000,
};

// Create Redis client
const redis = new Redis(redisConfig);

// Error handling
redis.on('error', (error) => {
  console.error('❌ Redis connection error:', error);
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('ready', () => {
  console.log('✅ Redis ready');
});

redis.on('close', () => {
  console.log('📛 Redis connection closed');
});

redis.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

// Test Redis connection
const testConnection = async () => {
  try {
    await redis.ping();
    console.log('✅ Redis ping successful');
    return true;
  } catch (error) {
    console.error('❌ Redis ping failed:', error.message);
    return false;
  }
};

// Health check function
const healthCheck = async () => {
  try {
    const pong = await redis.ping();
    if (pong === 'PONG') {
      return { status: 'OK', message: 'Redis connection healthy' };
    } else {
      return { status: 'ERROR', message: 'Redis ping returned unexpected response' };
    }
  } catch (error) {
    return { status: 'ERROR', message: error.message };
  }
};

// Cache helper functions
const cache = {
  // Get value from cache
  get: async (key) => {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  // Set value in cache with TTL
  set: async (key, value, ttlSeconds = 300) => {
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  },

  // Delete from cache
  del: async (key) => {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  },

  // Check if key exists
  exists: async (key) => {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },

  // Get multiple keys
  mget: async (keys) => {
    try {
      const values = await redis.mget(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error(`Cache mget error for keys ${keys}:`, error);
      return keys.map(() => null);
    }
  },

  // Set multiple keys
  mset: async (keyValuePairs, ttlSeconds = 300) => {
    try {
      const pipeline = redis.pipeline();
      
      for (const [key, value] of keyValuePairs) {
        const serialized = JSON.stringify(value);
        pipeline.setex(key, ttlSeconds, serialized);
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  },

  // Increment counter
  incr: async (key, amount = 1) => {
    try {
      return await redis.incrby(key, amount);
    } catch (error) {
      console.error(`Cache incr error for key ${key}:`, error);
      return null;
    }
  },

  // Add to list (LIFO)
  lpush: async (key, ...values) => {
    try {
      const serialized = values.map(v => JSON.stringify(v));
      return await redis.lpush(key, ...serialized);
    } catch (error) {
      console.error(`Cache lpush error for key ${key}:`, error);
      return null;
    }
  },

  // Get list range
  lrange: async (key, start = 0, end = -1) => {
    try {
      const values = await redis.lrange(key, start, end);
      return values.map(v => JSON.parse(v));
    } catch (error) {
      console.error(`Cache lrange error for key ${key}:`, error);
      return [];
    }
  },

  // Trim list to specified size
  ltrim: async (key, start, end) => {
    try {
      await redis.ltrim(key, start, end);
      return true;
    } catch (error) {
      console.error(`Cache ltrim error for key ${key}:`, error);
      return false;
    }
  },

  // Hash operations
  hset: async (key, ...args) => {
    try {
      return await redis.hset(key, ...args);
    } catch (error) {
      console.error(`Cache hset error for key ${key}:`, error);
      return false;
    }
  },

  hget: async (key, field) => {
    try {
      return await redis.hget(key, field);
    } catch (error) {
      console.error(`Cache hget error for key ${key}:`, error);
      return null;
    }
  },

  hgetall: async (key) => {
    try {
      return await redis.hgetall(key);
    } catch (error) {
      console.error(`Cache hgetall error for key ${key}:`, error);
      return {};
    }
  },

  hdel: async (key, ...fields) => {
    try {
      return await redis.hdel(key, ...fields);
    } catch (error) {
      console.error(`Cache hdel error for key ${key}:`, error);
      return false;
    }
  },

  hlen: async (key) => {
    try {
      return await redis.hlen(key);
    } catch (error) {
      console.error(`Cache hlen error for key ${key}:`, error);
      return 0;
    }
  },

  hkeys: async (key) => {
    try {
      return await redis.hkeys(key);
    } catch (error) {
      console.error(`Cache hkeys error for key ${key}:`, error);
      return [];
    }
  },

  hvals: async (key) => {
    try {
      return await redis.hvals(key);
    } catch (error) {
      console.error(`Cache hvals error for key ${key}:`, error);
      return [];
    }
  },

  // Stream operations (for queue service)
  xadd: async (key, id, ...args) => {
    try {
      return await redis.xadd(key, id, ...args);
    } catch (error) {
      console.error(`Cache xadd error for key ${key}:`, error);
      return null;
    }
  },

  xgroup: async (subCommand, key, groupName, id, ...args) => {
    try {
      return await redis.xgroup(subCommand, key, groupName, id, ...args);
    } catch (error) {
      console.error(`Cache xgroup error for key ${key}:`, error);
      return null;
    }
  },

  xreadgroup: async (groupName, consumerName, count, block, ...args) => {
    try {
      return await redis.xreadgroup('GROUP', groupName, consumerName, 'COUNT', count, 'BLOCK', block, ...args);
    } catch (error) {
      console.error(`Cache xreadgroup error:`, error);
      return null;
    }
  },

  xpending: async (key, groupName, ...args) => {
    try {
      return await redis.xpending(key, groupName, ...args);
    } catch (error) {
      console.error(`Cache xpending error for key ${key}:`, error);
      return null;
    }
  },

  xack: async (key, groupName, ...ids) => {
    try {
      return await redis.xack(key, groupName, ...ids);
    } catch (error) {
      console.error(`Cache xack error for key ${key}:`, error);
      return false;
    }
  },

  xlen: async (key) => {
    try {
      return await redis.xlen(key);
    } catch (error) {
      console.error(`Cache xlen error for key ${key}:`, error);
      return 0;
    }
  }
};

// Graceful shutdown
const closeConnection = async () => {
  try {
    await redis.quit();
    console.log('📛 Redis connection closed gracefully');
  } catch (error) {
    console.error('Error closing Redis connection:', error);
  }
};

module.exports = {
  redis,
  cache,
  testConnection,
  closeConnection,
  healthCheck
};