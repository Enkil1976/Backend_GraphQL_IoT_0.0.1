-- Migration: Create Dynamic Sensor Management Tables
-- Description: Adds tables for managing dynamic sensor creation and configuration
-- Version: 1.0.0
-- Date: 2024-01-XX

-- 1. Tabla de sensores registrados
CREATE TABLE IF NOT EXISTS sensors (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    location VARCHAR(200),
    
    -- Configuración MQTT
    mqtt_topic VARCHAR(300) NOT NULL,
    hardware_id VARCHAR(100),
    
    -- Configuración de base de datos
    table_name VARCHAR(100) NOT NULL,
    cache_key VARCHAR(200) NOT NULL,
    
    -- Campos de datos y métricas
    data_fields JSONB NOT NULL DEFAULT '[]',
    metrics_fields JSONB NOT NULL DEFAULT '[]',
    
    -- Configuración del payload
    payload_template JSONB NOT NULL DEFAULT '{}',
    validation_rules JSONB NOT NULL DEFAULT '{}',
    
    -- Configuración especial
    special_handling JSONB DEFAULT '{}',
    
    -- Estado y configuración
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE,
    
    -- Configuración de muestreo
    sampling_interval INTEGER DEFAULT 30, -- segundos
    retention_days INTEGER DEFAULT 90,
    
    -- Umbrales de alerta
    alert_thresholds JSONB DEFAULT '{}',
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    
    -- Índices
    CONSTRAINT unique_sensor_id UNIQUE (sensor_id),
    CONSTRAINT unique_hardware_id UNIQUE (hardware_id)
);

-- 2. Tabla de datos de sensores genérica
CREATE TABLE IF NOT EXISTS sensor_data_generic (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(100) NOT NULL REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    
    -- Datos del sensor (almacenados como JSON)
    data_values JSONB NOT NULL,
    
    -- Información del sistema
    rssi INTEGER,
    boot_count INTEGER DEFAULT 0,
    memory_usage INTEGER,
    
    -- Timestamp
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Índices para consultas rápidas
    CONSTRAINT fk_sensor_data_sensor FOREIGN KEY (sensor_id) REFERENCES sensors(sensor_id)
);

-- 3. Tabla de configuración de tipos de sensores
CREATE TABLE IF NOT EXISTS sensor_types (
    id SERIAL PRIMARY KEY,
    type_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Plantillas
    mqtt_topic_template VARCHAR(300) NOT NULL,
    payload_template JSONB NOT NULL,
    
    -- Configuración de base de datos
    default_table_name VARCHAR(100) NOT NULL,
    cache_key_template VARCHAR(200) NOT NULL,
    
    -- Campos disponibles
    available_fields JSONB NOT NULL DEFAULT '[]',
    metrics_fields JSONB NOT NULL DEFAULT '[]',
    
    -- Configuración especial
    special_handling JSONB DEFAULT '{}',
    
    -- Estado
    is_active BOOLEAN DEFAULT TRUE,
    is_customizable BOOLEAN DEFAULT FALSE,
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_type_id UNIQUE (type_id)
);

-- 4. Tabla de estadísticas de sensores
CREATE TABLE IF NOT EXISTS sensor_statistics (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(100) NOT NULL REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    
    -- Período de estadísticas
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    period_type VARCHAR(20) NOT NULL, -- 'hour', 'day', 'week', 'month'
    
    -- Estadísticas por campo
    field_stats JSONB NOT NULL DEFAULT '{}',
    
    -- Métricas de calidad de datos
    total_readings INTEGER DEFAULT 0,
    valid_readings INTEGER DEFAULT 0,
    error_readings INTEGER DEFAULT 0,
    data_quality_percent DECIMAL(5,2) DEFAULT 0,
    
    -- Métricas de conectividad
    uptime_percent DECIMAL(5,2) DEFAULT 0,
    average_rssi DECIMAL(5,2),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Índices
    CONSTRAINT unique_sensor_period UNIQUE (sensor_id, period_start, period_end, period_type),
    CONSTRAINT fk_sensor_stats_sensor FOREIGN KEY (sensor_id) REFERENCES sensors(sensor_id)
);

-- 5. Tabla de alertas de sensores
CREATE TABLE IF NOT EXISTS sensor_alerts (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(100) NOT NULL REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    
    -- Configuración de alerta
    alert_name VARCHAR(200) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    condition_type VARCHAR(50) NOT NULL, -- 'above', 'below', 'equals', 'range'
    threshold_value DECIMAL(10,4),
    threshold_min DECIMAL(10,4),
    threshold_max DECIMAL(10,4),
    
    -- Estado
    is_active BOOLEAN DEFAULT TRUE,
    is_triggered BOOLEAN DEFAULT FALSE,
    last_triggered TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,
    
    -- Configuración de notificación
    notification_channels JSONB DEFAULT '["webhook"]',
    cooldown_minutes INTEGER DEFAULT 15,
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    
    CONSTRAINT fk_sensor_alerts_sensor FOREIGN KEY (sensor_id) REFERENCES sensors(sensor_id)
);

-- 6. Crear tablas específicas para nuevos tipos de sensores
-- Tabla para sensores de temperatura y presión
CREATE TABLE IF NOT EXISTS temp_pressure_data (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(100) NOT NULL,
    temperatura DECIMAL(5,2) NOT NULL,
    presion DECIMAL(7,2) NOT NULL,
    altitude DECIMAL(7,2),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para sensores de humedad del suelo
CREATE TABLE IF NOT EXISTS soil_moisture_data (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(100) NOT NULL,
    humedad_suelo DECIMAL(5,2) NOT NULL,
    temperatura_suelo DECIMAL(5,2),
    conductividad DECIMAL(6,2),
    nitrogeno DECIMAL(6,2),
    fosforo DECIMAL(6,2),
    potasio DECIMAL(6,2),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para sensores de CO2
CREATE TABLE IF NOT EXISTS co2_data (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(100) NOT NULL,
    co2 DECIMAL(7,2) NOT NULL,
    tvoc DECIMAL(6,2),
    temperatura DECIMAL(5,2),
    humedad DECIMAL(5,2),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para sensores de movimiento
CREATE TABLE IF NOT EXISTS motion_data (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(100) NOT NULL,
    motion_detected BOOLEAN NOT NULL,
    confidence DECIMAL(5,2),
    distance DECIMAL(5,2),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para sensores personalizados
CREATE TABLE IF NOT EXISTS custom_sensor_data (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(100) NOT NULL,
    value DECIMAL(10,4) NOT NULL,
    unit VARCHAR(20),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para datos de sensores TemHum genéricos
CREATE TABLE IF NOT EXISTS temhum_data (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(100) NOT NULL,
    temperatura DECIMAL(5,2) NOT NULL,
    humedad DECIMAL(5,2) NOT NULL CHECK (humedad >= 0 AND humedad <= 100),
    heatindex DECIMAL(5,2),
    dewpoint DECIMAL(5,2),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Estadísticas opcionales
    tmin DECIMAL(5,2),
    tmax DECIMAL(5,2),
    tavg DECIMAL(5,2),
    hmin DECIMAL(5,2),
    hmax DECIMAL(5,2),
    havg DECIMAL(5,2),
    total INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0
);

-- Crear índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_sensors_type ON sensors(type);
CREATE INDEX IF NOT EXISTS idx_sensors_active ON sensors(is_active);
CREATE INDEX IF NOT EXISTS idx_sensors_online ON sensors(is_online);
CREATE INDEX IF NOT EXISTS idx_sensors_last_seen ON sensors(last_seen);
CREATE INDEX IF NOT EXISTS idx_sensors_mqtt_topic ON sensors(mqtt_topic);
CREATE INDEX IF NOT EXISTS idx_sensors_hardware_id ON sensors(hardware_id);

CREATE INDEX IF NOT EXISTS idx_sensor_data_generic_sensor_id ON sensor_data_generic(sensor_id);
CREATE INDEX IF NOT EXISTS idx_sensor_data_generic_received_at ON sensor_data_generic(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_data_generic_composite ON sensor_data_generic(sensor_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_types_type_id ON sensor_types(type_id);
CREATE INDEX IF NOT EXISTS idx_sensor_types_active ON sensor_types(is_active);

CREATE INDEX IF NOT EXISTS idx_sensor_statistics_sensor_id ON sensor_statistics(sensor_id);
CREATE INDEX IF NOT EXISTS idx_sensor_statistics_period ON sensor_statistics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_sensor_statistics_composite ON sensor_statistics(sensor_id, period_type, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_alerts_sensor_id ON sensor_alerts(sensor_id);
CREATE INDEX IF NOT EXISTS idx_sensor_alerts_active ON sensor_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_sensor_alerts_triggered ON sensor_alerts(is_triggered);

-- Índices para tablas de datos específicas
CREATE INDEX IF NOT EXISTS idx_temp_pressure_data_sensor_id ON temp_pressure_data(sensor_id);
CREATE INDEX IF NOT EXISTS idx_temp_pressure_data_received_at ON temp_pressure_data(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_soil_moisture_data_sensor_id ON soil_moisture_data(sensor_id);
CREATE INDEX IF NOT EXISTS idx_soil_moisture_data_received_at ON soil_moisture_data(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_co2_data_sensor_id ON co2_data(sensor_id);
CREATE INDEX IF NOT EXISTS idx_co2_data_received_at ON co2_data(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_motion_data_sensor_id ON motion_data(sensor_id);
CREATE INDEX IF NOT EXISTS idx_motion_data_received_at ON motion_data(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_sensor_data_sensor_id ON custom_sensor_data(sensor_id);
CREATE INDEX IF NOT EXISTS idx_custom_sensor_data_received_at ON custom_sensor_data(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_temhum_data_sensor_id ON temhum_data(sensor_id);
CREATE INDEX IF NOT EXISTS idx_temhum_data_received_at ON temhum_data(received_at DESC);

-- Insertar tipos de sensores predefinidos
INSERT INTO sensor_types (type_id, name, description, mqtt_topic_template, payload_template, default_table_name, cache_key_template, available_fields, metrics_fields, special_handling, is_customizable) VALUES
('TEMHUM', 'Temperatura y Humedad', 'Sensor de temperatura y humedad ambiental', 'Invernadero/{sensorId}/data', 
 '{"temperatura": {"type": "float", "required": true, "min": -50, "max": 80}, "humedad": {"type": "float", "required": true, "min": 0, "max": 100}}', 
 'temhum_data', 'sensor_latest:{sensorId}', 
 '["temperatura", "humedad", "heatindex", "dewpoint", "rssi", "boot", "mem"]', 
 '["temperatura", "humedad", "heatindex", "dewpoint"]', 
 '{}', false),

('TEMP_PRESSURE', 'Temperatura y Presión', 'Sensor de temperatura y presión atmosférica', 'Invernadero/{sensorId}/data',
 '{"temperatura": {"type": "float", "required": true, "min": -50, "max": 80}, "presion": {"type": "float", "required": true, "min": 300, "max": 1200}}',
 'temp_pressure_data', 'sensor_latest:{sensorId}',
 '["temperatura", "presion", "altitude", "rssi", "boot", "mem"]',
 '["temperatura", "presion", "altitude"]',
 '{}', false),

('WATER_QUALITY', 'Calidad del Agua', 'Sensor de calidad del agua (pH, EC, PPM)', 'Invernadero/{sensorId}/data',
 '{"ph": {"type": "float", "required": true, "min": 0, "max": 14}, "ec": {"type": "float", "required": true, "min": 0, "max": 10000}, "ppm": {"type": "float", "required": true, "min": 0, "max": 5000}}',
 'calidad_agua', 'sensor_latest:{sensorId}',
 '["ph", "ec", "ppm", "temperatura_agua", "rssi", "boot", "mem"]',
 '["ph", "ec", "ppm", "temperatura_agua"]',
 '{}', false),

('LIGHT', 'Sensor de Luz', 'Sensor de luz ambiental y espectro', 'Invernadero/{sensorId}/data',
 '{"light": {"type": "float", "required": true, "min": 0, "max": 100000}, "white_light": {"type": "float", "required": false, "min": 0, "max": 100000}}',
 'luxometro', 'sensor_latest:{sensorId}',
 '["light", "white_light", "raw_light", "uv_index", "rssi", "boot", "mem"]',
 '["light", "white_light", "raw_light", "uv_index"]',
 '{}', false),

('SOIL_MOISTURE', 'Humedad del Suelo', 'Sensor de humedad del suelo y nutrientes', 'Invernadero/{sensorId}/data',
 '{"humedad_suelo": {"type": "float", "required": true, "min": 0, "max": 100}, "temperatura_suelo": {"type": "float", "required": false, "min": -10, "max": 50}}',
 'soil_moisture_data', 'sensor_latest:{sensorId}',
 '["humedad_suelo", "temperatura_suelo", "conductividad", "nitrogeno", "fosforo", "potasio", "rssi", "boot", "mem"]',
 '["humedad_suelo", "temperatura_suelo", "conductividad", "nitrogeno", "fosforo", "potasio"]',
 '{}', false),

('CO2', 'Dióxido de Carbono', 'Sensor de CO2 y calidad del aire', 'Invernadero/{sensorId}/data',
 '{"co2": {"type": "float", "required": true, "min": 0, "max": 10000}, "tvoc": {"type": "float", "required": false, "min": 0, "max": 1000}}',
 'co2_data', 'sensor_latest:{sensorId}',
 '["co2", "tvoc", "temperatura", "humedad", "rssi", "boot", "mem"]',
 '["co2", "tvoc", "temperatura", "humedad"]',
 '{}', false),

('MOTION', 'Sensor de Movimiento', 'Sensor de movimiento y presencia', 'Invernadero/{sensorId}/data',
 '{"motion_detected": {"type": "boolean", "required": true}, "confidence": {"type": "float", "required": false, "min": 0, "max": 100}}',
 'motion_data', 'sensor_latest:{sensorId}',
 '["motion_detected", "confidence", "distance", "rssi", "boot", "mem"]',
 '["motion_detected", "confidence", "distance"]',
 '{}', false),

('POWER_MONITOR', 'Monitor de Consumo', 'Sensor de consumo eléctrico', 'Invernadero/{sensorId}/data',
 '{"voltage": {"type": "float", "required": true, "min": 0, "max": 300}, "current": {"type": "float", "required": true, "min": 0, "max": 50}, "watts": {"type": "float", "required": true, "min": 0, "max": 5000}}',
 'power_monitor_logs', 'sensor_latest:{sensorId}',
 '["voltage", "current", "watts", "frequency", "power_factor", "energy_total", "rssi", "boot", "mem"]',
 '["voltage", "current", "watts", "frequency", "power_factor", "energy_total"]',
 '{"deviceLinking": true, "deviceIdField": "monitors_device_id"}', false),

('CUSTOM', 'Sensor Personalizado', 'Sensor con campos personalizables', 'Invernadero/{sensorId}/data',
 '{"value": {"type": "float", "required": true}, "unit": {"type": "string", "required": false}}',
 'custom_sensor_data', 'sensor_latest:{sensorId}',
 '["value", "unit", "rssi", "boot", "mem"]',
 '["value"]',
 '{}', true);

-- Función para actualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at automáticamente
CREATE TRIGGER update_sensors_updated_at BEFORE UPDATE ON sensors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sensor_types_updated_at BEFORE UPDATE ON sensor_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sensor_alerts_updated_at BEFORE UPDATE ON sensor_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE sensors IS 'Tabla principal de sensores registrados en el sistema';
COMMENT ON TABLE sensor_data_generic IS 'Datos genéricos de sensores almacenados como JSON';
COMMENT ON TABLE sensor_types IS 'Tipos de sensores predefinidos con sus configuraciones';
COMMENT ON TABLE sensor_statistics IS 'Estadísticas históricas de sensores por períodos';
COMMENT ON TABLE sensor_alerts IS 'Configuración de alertas para sensores';

COMMENT ON COLUMN sensors.sensor_id IS 'Identificador único del sensor';
COMMENT ON COLUMN sensors.mqtt_topic IS 'Tópico MQTT para este sensor específico';
COMMENT ON COLUMN sensors.payload_template IS 'Plantilla de payload JSON para validación';
COMMENT ON COLUMN sensors.data_fields IS 'Campos de datos que maneja este sensor';
COMMENT ON COLUMN sensors.metrics_fields IS 'Campos que se usan para métricas y estadísticas';
COMMENT ON COLUMN sensors.special_handling IS 'Configuración especial (ej: linking con dispositivos)';

COMMENT ON COLUMN sensor_data_generic.data_values IS 'Valores de datos del sensor en formato JSON';
COMMENT ON COLUMN sensor_types.mqtt_topic_template IS 'Plantilla de tópico MQTT con placeholder {sensorId}';
COMMENT ON COLUMN sensor_types.payload_template IS 'Plantilla de payload con validaciones';
COMMENT ON COLUMN sensor_types.is_customizable IS 'Si permite personalización de campos';

COMMENT ON COLUMN sensor_statistics.field_stats IS 'Estadísticas por campo (min, max, avg, etc.)';
COMMENT ON COLUMN sensor_statistics.period_type IS 'Tipo de período: hour, day, week, month';
COMMENT ON COLUMN sensor_alerts.condition_type IS 'Tipo de condición: above, below, equals, range';

-- Finalización del script
SELECT 'Dynamic sensor tables created successfully' AS result;