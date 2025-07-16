-- Agregar sensor de calidad del agua para tópico Invernadero/Agua/data
-- Este sensor procesa datos de pH, EC, PPM y temperatura del agua

INSERT INTO sensors (
    name, 
    hardware_id, 
    sensor_type, 
    location, 
    is_active, 
    is_online,
    last_seen,
    created_at,
    updated_at,
    configuration
) VALUES (
    'Sensor Calidad Agua Principal',
    'agua-quality-01', 
    'WATER_QUALITY',
    'Sistema de Riego Principal',
    true,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP,
    '{
        "mqtt_topic": "Invernadero/Agua/data",
        "fields": ["ph", "ec", "ppm", "temp"],
        "cache_key": "sensor_latest:agua-quality-01",
        "metrics_fields": ["ph", "ec", "ppm", "temp"],
        "data_format": "json",
        "update_frequency": 30,
        "alert_thresholds": {
            "ph": {"min": 5.5, "max": 8.5},
            "ec": {"min": 800, "max": 2000},
            "ppm": {"min": 400, "max": 1500},
            "temp": {"min": 15, "max": 30}
        }
    }'::jsonb
)
ON CONFLICT (hardware_id) DO UPDATE SET
    name = EXCLUDED.name,
    sensor_type = EXCLUDED.sensor_type,
    location = EXCLUDED.location,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP,
    configuration = EXCLUDED.configuration;

-- Verificar que el sensor se creó correctamente
SELECT 
    id,
    name,
    hardware_id,
    sensor_type,
    location,
    is_active,
    configuration
FROM sensors 
WHERE hardware_id = 'agua-quality-01';