const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const dbConfig = process.env.PG_URI ? {
  connectionString: process.env.PG_URI,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
} : {
  host: process.env.PG_HOST || 'postgres',  // Usa el nombre del servicio de Docker
  port: parseInt(process.env.PG_PORT, 10) || 5432,
  database: process.env.PG_DATABASE || 'invernadero_iot',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Configuración adicional del pool
dbConfig.max = 20; // Maximum number of clients in the pool
dbConfig.idleTimeoutMillis = 30000; // Close clients after 30 seconds of inactivity
dbConfig.connectionTimeoutMillis = 2000; // Return an error after 2 seconds if connection could not be established

// Create PostgreSQL connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully');
    
    // Test query
    const result = await client.query('SELECT NOW() as current_time');
    console.log(`📅 Database time: ${result.rows[0].current_time}`);
    
    client.release();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    return false;
  }
};

// Graceful shutdown
const closePool = async () => {
  try {
    await pool.end();
    console.log('📛 Database connection pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

// Health check function
const healthCheck = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { status: 'OK', message: 'Database connection healthy' };
  } catch (error) {
    return { status: 'ERROR', message: error.message };
  }
};

// Query helper with error handling
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (>1000ms)
    if (duration > 1000) {
      console.warn(`🐌 Slow query detected (${duration}ms):`, text);
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Transaction helper
const withTransaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  withTransaction,
  testConnection,
  closePool,
  healthCheck
};