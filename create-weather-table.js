require('dotenv').config();
const { pool } = require('./src/config/database');

async function createWeatherTable() {
  console.log('🗄️  Creating weather_current table...');
  
  const weatherTableSQL = `
-- Create weather_current table for storing WeatherAPI.com data
-- This table stores real-time weather data collected from external API

CREATE TABLE IF NOT EXISTS weather_current (
    id SERIAL PRIMARY KEY,
    
    -- Core weather measurements
    temperatura DECIMAL(5,2) NOT NULL,                    -- Temperature in Celsius
    humedad INTEGER NOT NULL CHECK (humedad >= 0 AND humedad <= 100), -- Humidity percentage
    sensacion_termica DECIMAL(5,2),                       -- Feels like temperature
    punto_rocio DECIMAL(5,2),                             -- Dew point temperature
    
    -- Extended weather data
    presion DECIMAL(7,2),                                 -- Atmospheric pressure in mb
    velocidad_viento DECIMAL(5,2),                        -- Wind speed in km/h
    direccion_viento VARCHAR(10),                         -- Wind direction (N, NE, E, SE, S, SW, W, NW)
    visibilidad DECIMAL(4,1),                             -- Visibility in km
    uv_index DECIMAL(3,1),                                -- UV index
    
    -- Weather condition
    condicion VARCHAR(100),                               -- Weather condition description in Spanish
    icono VARCHAR(50),                                    -- Weather icon code from API
    
    -- Air quality (optional fields from WeatherAPI)
    calidad_aire_pm2_5 DECIMAL(6,2),                     -- PM2.5 air quality
    calidad_aire_pm10 DECIMAL(6,2),                      -- PM10 air quality
    
    -- Location information
    location_name VARCHAR(100),                           -- Location name from API
    location_lat DECIMAL(10,7),                          -- Latitude
    location_lon DECIMAL(10,7),                          -- Longitude
    
    -- Timestamps
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),   -- When data was received and stored
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()     -- Table record creation time
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_weather_received_at ON weather_current(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_location ON weather_current(location_name);
CREATE INDEX IF NOT EXISTS idx_weather_temp_hum ON weather_current(temperatura, humedad);

-- Add comments for documentation
COMMENT ON TABLE weather_current IS 'External weather data from WeatherAPI.com for greenhouse environmental context';
COMMENT ON COLUMN weather_current.temperatura IS 'Current temperature in Celsius from WeatherAPI';
COMMENT ON COLUMN weather_current.humedad IS 'Current humidity percentage from WeatherAPI';
COMMENT ON COLUMN weather_current.sensacion_termica IS 'Feels like temperature accounting for humidity and wind';
COMMENT ON COLUMN weather_current.punto_rocio IS 'Dew point calculated from temperature and humidity';
COMMENT ON COLUMN weather_current.presion IS 'Atmospheric pressure in millibars';
COMMENT ON COLUMN weather_current.velocidad_viento IS 'Wind speed in kilometers per hour';
COMMENT ON COLUMN weather_current.direccion_viento IS 'Wind direction using cardinal directions';
COMMENT ON COLUMN weather_current.visibilidad IS 'Visibility distance in kilometers';
COMMENT ON COLUMN weather_current.uv_index IS 'UV radiation index';
COMMENT ON COLUMN weather_current.condicion IS 'Human readable weather condition in Spanish';
COMMENT ON COLUMN weather_current.icono IS 'Weather icon identifier from WeatherAPI';
COMMENT ON COLUMN weather_current.calidad_aire_pm2_5 IS 'PM2.5 air quality particles (μg/m³)';
COMMENT ON COLUMN weather_current.calidad_aire_pm10 IS 'PM10 air quality particles (μg/m³)';
COMMENT ON COLUMN weather_current.location_name IS 'Geographic location name from API';
COMMENT ON COLUMN weather_current.location_lat IS 'Latitude coordinate of weather station';
COMMENT ON COLUMN weather_current.location_lon IS 'Longitude coordinate of weather station';
COMMENT ON COLUMN weather_current.received_at IS 'Timestamp when weather data was collected and stored in Chile timezone';

-- Set table timezone to Chile
ALTER TABLE weather_current ALTER COLUMN received_at SET DEFAULT (NOW() AT TIME ZONE 'America/Santiago');
ALTER TABLE weather_current ALTER COLUMN created_at SET DEFAULT (NOW() AT TIME ZONE 'America/Santiago');
  `;

  try {
    // Execute the SQL
    await pool.query(weatherTableSQL);
    console.log('✅ weather_current table created successfully');
    
    // Test the table by checking if it exists
    const checkTable = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'weather_current' 
      ORDER BY ordinal_position
    `);
    
    console.log(`✅ Table verified with ${checkTable.rows.length} columns`);
    console.log('📋 Weather table columns:');
    checkTable.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating weather table:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the table creation
createWeatherTable().catch(error => {
  console.error('❌ Failed to create weather table:', error);
  process.exit(1);
});