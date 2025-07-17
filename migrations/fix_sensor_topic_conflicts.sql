-- Fix sensor topic conflicts migration
-- Date: 2025-07-16
-- Description: Resolves MQTT topic conflicts between sensors to ensure proper data processing

-- Problem: Two sensors were sharing similar MQTT topics causing processing conflicts:
-- - Sensor ID 2: invernadero-agua-temp -> Invernadero/Agua/temp
-- - Sensor ID 3: invernadero-agua -> Invernadero/Agua/data
-- This caused mqttAutoDiscoveryService to find sensors but dynamicSensorService to fail processing

-- Solution: Update sensor ID 2 to use a unique topic pattern
UPDATE sensors 
SET mqtt_topic = 'Invernadero/AguaTemp/data' 
WHERE id = 2 AND hardware_id = 'invernadero-agua-temp';

-- Verify the fix
SELECT id, name, hardware_id, mqtt_topic 
FROM sensors 
WHERE hardware_id LIKE '%agua%' 
ORDER BY id;

-- Expected result:
-- id=2: invernadero-agua-temp -> Invernadero/AguaTemp/data
-- id=3: invernadero-agua -> Invernadero/Agua/data