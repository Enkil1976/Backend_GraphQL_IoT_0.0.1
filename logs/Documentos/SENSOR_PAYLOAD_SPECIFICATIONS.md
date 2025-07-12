# Especificaciones de Payloads para Sensores IoT

## Formato General

Todos los payloads deben seguir el formato JSON estándar y incluir un timestamp automático al ser procesados por el backend.

### Campos del Sistema (Opcionales para todos los sensores)

#### **Conectividad y Señal**
```json
{
  "rssi": -75,                    // Intensidad de señal WiFi (dBm) [-100 a 0]
  "signal_quality": 68,           // Calidad de señal en % [0-100]
  "wifi_channel": 6,              // Canal WiFi utilizado [1-13]
  "mac_address": "AA:BB:CC:DD:EE:FF", // Dirección MAC del sensor
  "ip_address": "192.168.1.100",  // IP asignada al sensor
  "gateway": "192.168.1.1",       // Gateway de red
  "dns": "8.8.8.8",               // Servidor DNS utilizado
  "connection_time": 1250,        // Tiempo de conexión en ms
  "ping_latency": 45,             // Latencia de ping en ms
  "packet_loss": 0.1,             // Pérdida de paquetes en %
  "reconnections": 3,             // Número de reconexiones en esta sesión
  "network_errors": 0             // Errores de red acumulados
}
```

#### **Estado del Sistema**
```json
{
  "boot": 142,                    // Contador de reinicios
  "uptime": 86400,                // Tiempo encendido en segundos
  "firmware_version": "1.2.3",    // Versión del firmware
  "hardware_version": "2.1",      // Versión del hardware
  "chip_id": "ESP32-001",         // Identificador único del chip
  "flash_size": 4194304,          // Tamaño de memoria flash (bytes)
  "mem_total": 327680,            // Memoria total disponible (bytes)
  "mem_free": 245760,             // Memoria libre actual (bytes)
  "mem_usage": 25,                // Porcentaje de uso de memoria
  "cpu_usage": 15,                // Porcentaje de uso de CPU
  "temperature_internal": 42.5,   // Temperatura interna del chip (°C)
  "heap_fragmentation": 8         // Fragmentación del heap en %
}
```

#### **Alimentación y Energía**
```json
{
  "battery_level": 85,            // Nivel de batería en % [0-100]
  "battery_voltage": 3.7,         // Voltaje de batería (V)
  "battery_current": 150,         // Corriente de batería (mA)
  "battery_power": 555,           // Potencia de batería (mW)
  "battery_cycles": 45,           // Ciclos de carga/descarga
  "battery_health": 92,           // Salud de batería en % [0-100]
  "charging": false,              // Estado de carga (true/false)
  "power_source": "battery",      // Fuente de alimentación (battery/usb/solar)
  "voltage_input": 5.0,           // Voltaje de entrada (V)
  "current_consumption": 120,     // Consumo actual (mA)
  "power_consumption": 600,       // Consumo de potencia (mW)
  "sleep_mode": false,            // En modo de bajo consumo
  "sleep_duration": 0,            // Tiempo en modo sleep (segundos)
  "wakeup_reason": "timer"        // Razón del despertar (timer/interrupt/reset)
}
```

#### **Diagnóstico y Calibración**
```json
{
  "sensor_status": "ok",          // Estado del sensor (ok/warning/error/calibrating)
  "last_calibration": "2025-07-10T10:30:00Z", // Última calibración ISO
  "calibration_due": false,       // Calibración pendiente
  "calibration_interval": 2592000, // Intervalo de calibración (segundos)
  "sensor_age": 180,              // Edad del sensor en días
  "error_count": 0,               // Contador de errores
  "warning_count": 2,             // Contador de advertencias
  "last_error": null,             // Último error registrado
  "last_warning": "low_battery",  // Última advertencia
  "self_test": "passed",          // Resultado de auto-diagnóstico
  "sensor_drift": 0.02,           // Deriva del sensor desde calibración
  "accuracy": 98.5,               // Precisión estimada en %
  "stability": "stable",          // Estabilidad (stable/unstable/drift)
  "maintenance_needed": false     // Mantenimiento requerido
}
```

#### **Configuración y Control**
```json
{
  "sampling_rate": 30,            // Frecuencia de muestreo (segundos)
  "reporting_interval": 60,       // Intervalo de reporte (segundos)
  "averaging_window": 5,          // Ventana de promediado (muestras)
  "threshold_min": 0,             // Umbral mínimo para alertas
  "threshold_max": 100,           // Umbral máximo para alertas
  "alarm_enabled": true,          // Alarmas habilitadas
  "alert_hysteresis": 2,          // Histéresis para alertas
  "auto_calibration": true,       // Calibración automática habilitada
  "data_logging": true,           // Logging local habilitado
  "debug_mode": false,            // Modo debug activo
  "sensor_enabled": true,         // Sensor habilitado/deshabilitado
  "location": "greenhouse_01",    // Ubicación física del sensor
  "zone": "A1",                   // Zona específica
  "group": "environmental"        // Grupo de sensores
}
```

#### **Estadísticas y Tendencias**
```json
{
  "readings_count": 1440,         // Total de lecturas tomadas
  "valid_readings": 1438,         // Lecturas válidas
  "invalid_readings": 2,          // Lecturas inválidas
  "reading_success_rate": 99.86,  // Tasa de éxito en %
  "average_24h": 25.5,            // Promedio últimas 24h
  "min_24h": 18.2,                // Mínimo últimas 24h
  "max_24h": 32.8,                // Máximo últimas 24h
  "variance_24h": 4.2,            // Varianza últimas 24h
  "trend": "stable",              // Tendencia (rising/falling/stable)
  "trend_rate": 0.1,              // Tasa de cambio por hora
  "peak_time": "14:30",           // Hora del pico diario
  "valley_time": "06:15",         // Hora del valle diario
  "data_quality": "high"          // Calidad de datos (high/medium/low)
}
```

#### **Seguridad y Autenticación**
```json
{
  "device_id": "SENSOR_001",      // ID único del dispositivo
  "auth_token": "abc123...",      // Token de autenticación
  "encryption": "AES256",         // Método de encriptación
  "security_level": "high",       // Nivel de seguridad
  "certificate_expiry": "2026-01-01T00:00:00Z", // Expiración certificado
  "tamper_detected": false,       // Detección de manipulación
  "intrusion_attempts": 0,        // Intentos de intrusión
  "last_security_check": "2025-07-11T16:00:00Z" // Última verificación
}
```

---

## 1. TEMHUM (Sensores de Temperatura y Humedad)

### Tópicos MQTT
- `Invernadero/TemHum1/data`
- `Invernadero/TemHum2/data` 
- `Invernadero/TemHum3/data`

### Payload Estándar
```json
{
  // === LECTURAS PRINCIPALES ===
  "temperatura": 26.2,     // OBLIGATORIO: Temperatura en °C (rango: -50 a 80)
  "humedad": 43.0,         // OBLIGATORIO: Humedad relativa en % (rango: 0-100)
  "heatindex": 26.0,       // OPCIONAL: Índice de calor en °C
  "dewpoint": 12.7,        // OPCIONAL: Punto de rocío en °C
  "feels_like": 27.5,      // OPCIONAL: Sensación térmica en °C
  "absolute_humidity": 8.2, // OPCIONAL: Humedad absoluta en g/m³
  "vapor_pressure": 1.45,  // OPCIONAL: Presión de vapor en kPa
  "wet_bulb": 18.5,        // OPCIONAL: Temperatura bulbo húmedo en °C
  
  // === CONTROL Y CALIBRACIÓN ===
  "temp_offset": 0.0,      // OPCIONAL: Offset calibración temperatura
  "humidity_offset": 0.0,  // OPCIONAL: Offset calibración humedad
  "sensor_compensation": true, // OPCIONAL: Compensación activada
  "heating_element": false, // OPCIONAL: Elemento calefactor activo
  "fan_speed": 0,          // OPCIONAL: Velocidad ventilador (0-100%)
  "auto_calibration": true, // OPCIONAL: Calibración automática
  
  // === CALIDAD DE DATOS ===
  "temp_stability": "stable", // OPCIONAL: Estabilidad temperatura
  "humidity_stability": "stable", // OPCIONAL: Estabilidad humedad
  "sensor_health": "good",  // OPCIONAL: Salud del sensor (good/fair/poor)
  "measurement_confidence": 95, // OPCIONAL: Confianza medición (0-100%)
  "data_smoothing": true,   // OPCIONAL: Suavizado de datos activo
  "outlier_detection": true, // OPCIONAL: Detección de valores atípicos
  
  // === ESTADÍSTICAS LOCALES ===
  "temp_min_1h": 25.8,     // OPCIONAL: Mínima temperatura última hora
  "temp_max_1h": 26.5,     // OPCIONAL: Máxima temperatura última hora
  "temp_avg_1h": 26.1,     // OPCIONAL: Promedio temperatura última hora
  "humidity_min_1h": 40.2, // OPCIONAL: Mínima humedad última hora
  "humidity_max_1h": 45.8, // OPCIONAL: Máxima humedad última hora
  "humidity_avg_1h": 43.1, // OPCIONAL: Promedio humedad última hora
  "measurements_1h": 120,  // OPCIONAL: Número mediciones última hora
  
  // === ALERTAS Y UMBRALES ===
  "temp_alert": false,     // OPCIONAL: Alerta temperatura activa
  "humidity_alert": false, // OPCIONAL: Alerta humedad activa
  "comfort_index": 8,      // OPCIONAL: Índice confort (1-10)
  "air_quality_impact": "low", // OPCIONAL: Impacto en calidad aire
  
  // === INFORMACIÓN TÉCNICA ===
  "sensor_model": "DHT22",  // OPCIONAL: Modelo del sensor
  "read_attempts": 1,      // OPCIONAL: Intentos de lectura
  "read_errors": 0,        // OPCIONAL: Errores de lectura
  "response_time": 2000,   // OPCIONAL: Tiempo respuesta (ms)
  "warm_up_time": 1000,    // OPCIONAL: Tiempo calentamiento (ms)
  
  // === CAMPOS COMUNES DEL SISTEMA ===
  "rssi": -78,             // OPCIONAL: Intensidad de señal WiFi
  "signal_quality": 65,    // OPCIONAL: Calidad señal %
  "boot": 49,              // OPCIONAL: Contador de reinicios
  "uptime": 86400,         // OPCIONAL: Tiempo encendido (segundos)
  "mem_free": 19296,       // OPCIONAL: Memoria libre (bytes)
  "cpu_usage": 15,         // OPCIONAL: Uso CPU %
  "battery_level": 85,     // OPCIONAL: Nivel batería %
  "sensor_status": "ok",   // OPCIONAL: Estado sensor
  "firmware_version": "1.2.3", // OPCIONAL: Versión firmware
  "location": "greenhouse_01", // OPCIONAL: Ubicación
  "zone": "A1"             // OPCIONAL: Zona específica
}
```

### Validación
- `temperatura`: Número decimal, -50 ≤ valor ≤ 80
- `humedad`: Número decimal, 0 ≤ valor ≤ 100
- `heatindex`: Número decimal (si se proporciona)
- `dewpoint`: Número decimal (si se proporciona)

---

## 2. WATER_QUALITY (Sensores de Calidad del Agua)

### Tópicos MQTT
- `Invernadero/AguaPH/data`
- `Invernadero/CalidadAgua/data`

### Payload Estándar
```json
{
  // === LECTURAS PRINCIPALES ===
  "ph": 7.25,              // OBLIGATORIO: Nivel de pH (rango: 0-14)
  "ec": 1500,              // OPCIONAL: Conductividad eléctrica (μS/cm)
  "ppm": 750,              // OPCIONAL: Partes por millón (mg/L)
  "temperatura": 18.5,     // OPCIONAL: Temperatura del agua en °C
  "voltage": 0.99,         // OPCIONAL: Voltaje del sensor (V)
  "tds": 600,              // OPCIONAL: Sólidos disueltos totales (mg/L)
  "salinity": 0.3,         // OPCIONAL: Salinidad (ppt)
  "orp": 350,              // OPCIONAL: Potencial redox (mV)
  "dissolved_oxygen": 8.5, // OPCIONAL: Oxígeno disuelto (mg/L)
  "turbidity": 2.1,        // OPCIONAL: Turbidez (NTU)
  "chlorine": 0.5,         // OPCIONAL: Cloro libre (mg/L)
  "ammonia": 0.02,         // OPCIONAL: Amoniaco (mg/L)
  "nitrates": 10.5,        // OPCIONAL: Nitratos (mg/L)
  "nitrites": 0.1,         // OPCIONAL: Nitritos (mg/L)
  "hardness": 150,         // OPCIONAL: Dureza del agua (mg/L CaCO3)
  "alkalinity": 120,       // OPCIONAL: Alcalinidad (mg/L CaCO3)
  
  // === CONTROL Y CALIBRACIÓN ===
  "ph_offset": 0.0,        // OPCIONAL: Offset calibración pH
  "ec_offset": 0.0,        // OPCIONAL: Offset calibración EC
  "calibration_ph4": 4.01, // OPCIONAL: Calibración pH 4
  "calibration_ph7": 7.00, // OPCIONAL: Calibración pH 7
  "calibration_ph10": 10.01, // OPCIONAL: Calibración pH 10
  "temp_compensation": true, // OPCIONAL: Compensación temperatura
  "stirring": false,       // OPCIONAL: Agitación activa
  "pump_active": false,    // OPCIONAL: Bomba de muestra activa
  "valve_position": "closed", // OPCIONAL: Posición válvula
  "flow_rate": 0.5,        // OPCIONAL: Caudal (L/min)
  "sample_volume": 100,    // OPCIONAL: Volumen muestra (mL)
  "flush_cycles": 3,       // OPCIONAL: Ciclos de lavado
  "stabilization_time": 30, // OPCIONAL: Tiempo estabilización (s)
  
  // === CALIDAD DE DATOS ===
  "ph_stability": "stable", // OPCIONAL: Estabilidad pH
  "ec_stability": "stable", // OPCIONAL: Estabilidad EC
  "measurement_quality": "high", // OPCIONAL: Calidad medición
  "probe_health": "good",  // OPCIONAL: Salud de sondas
  "electrode_age": 180,    // OPCIONAL: Edad electrodo (días)
  "cleaning_needed": false, // OPCIONAL: Limpieza requerida
  "replacement_due": false, // OPCIONAL: Reemplazo debido
  "drift_detected": false, // OPCIONAL: Deriva detectada
  
  // === ESTADÍSTICAS LOCALES ===
  "ph_min_1h": 7.20,       // OPCIONAL: pH mínimo última hora
  "ph_max_1h": 7.28,       // OPCIONAL: pH máximo última hora
  "ph_avg_1h": 7.24,       // OPCIONAL: pH promedio última hora
  "ec_min_1h": 1450,       // OPCIONAL: EC mínimo última hora
  "ec_max_1h": 1550,       // OPCIONAL: EC máximo última hora
  "ec_avg_1h": 1500,       // OPCIONAL: EC promedio última hora
  "temp_min_1h": 18.2,     // OPCIONAL: Temperatura mínima última hora
  "temp_max_1h": 18.8,     // OPCIONAL: Temperatura máxima última hora
  "temp_avg_1h": 18.5,     // OPCIONAL: Temperatura promedio última hora
  
  // === ALERTAS Y UMBRALES ===
  "ph_alert": false,       // OPCIONAL: Alerta pH activa
  "ec_alert": false,       // OPCIONAL: Alerta EC activa
  "temp_alert": false,     // OPCIONAL: Alerta temperatura activa
  "contamination_risk": "low", // OPCIONAL: Riesgo contaminación
  "water_quality_index": 85, // OPCIONAL: Índice calidad agua (0-100)
  "suitability": "excellent", // OPCIONAL: Aptitud (poor/fair/good/excellent)
  
  // === INFORMACIÓN TÉCNICA ===
  "probe_type": "glass",   // OPCIONAL: Tipo sonda pH
  "reference_electrode": "Ag/AgCl", // OPCIONAL: Electrodo referencia
  "sensor_model": "PHM-7850", // OPCIONAL: Modelo sensor
  "calibration_points": 3, // OPCIONAL: Puntos calibración
  "read_attempts": 1,      // OPCIONAL: Intentos lectura
  "read_errors": 0,        // OPCIONAL: Errores lectura
  "response_time": 5000,   // OPCIONAL: Tiempo respuesta (ms)
  "settling_time": 3000,   // OPCIONAL: Tiempo asentamiento (ms)
  
  // === CAMPOS COMUNES DEL SISTEMA ===
  "rssi": -65,             // OPCIONAL: Intensidad de señal WiFi
  "signal_quality": 72,    // OPCIONAL: Calidad señal %
  "boot": 87,              // OPCIONAL: Contador de reinicios
  "uptime": 172800,        // OPCIONAL: Tiempo encendido (segundos)
  "mem_free": 18240,       // OPCIONAL: Memoria libre (bytes)
  "cpu_usage": 20,         // OPCIONAL: Uso CPU %
  "battery_level": 78,     // OPCIONAL: Nivel batería %
  "sensor_status": "ok",   // OPCIONAL: Estado sensor
  "firmware_version": "2.1.0", // OPCIONAL: Versión firmware
  "location": "reservoir_01", // OPCIONAL: Ubicación
  "zone": "water_treatment" // OPCIONAL: Zona específica
}
```

### Validación
- `ph`: Número decimal, 0 ≤ valor ≤ 14
- `ec`: Número entero, 0 ≤ valor ≤ 10000
- `ppm`: Número entero, 0 ≤ valor ≤ 5000
- `temperatura`: Número decimal, -10 ≤ valor ≤ 60
- `voltage`: Número decimal, 0 ≤ valor ≤ 5

---

## 3. TEMP_PRESSURE (Sensores de Temperatura y Presión)

### Tópicos MQTT
- `Invernadero/BMP280-1/data`
- `Invernadero/BME280-1/data`

### Payload Estándar
```json
{
  "temperatura": 28.73,    // OBLIGATORIO: Temperatura en °C (rango: -40 a 85)
  "presion": 98892.81,     // OBLIGATORIO: Presión atmosférica en Pa (rango: 30000-110000)
  "altitude": 542.5,       // OPCIONAL: Altitud calculada en metros
  "rssi": -82,             // OPCIONAL: Intensidad de señal
  "boot": 23,              // OPCIONAL: Contador de reinicios
  "mem": 20480             // OPCIONAL: Memoria libre
}
```

### Validación
- `temperatura`: Número decimal, -40 ≤ valor ≤ 85
- `presion`: Número decimal, 30000 ≤ valor ≤ 110000
- `altitude`: Número decimal (si se proporciona)

---

## 4. LIGHT (Sensores de Luminosidad)

### Tópicos MQTT
- `Invernadero/Luxometro/data`
- `Invernadero/LightSensor/data`

### Payload Estándar
```json
{
  "light": 9451.47,        // OBLIGATORIO: Intensidad de luz en lux (rango: 0-100000)
  "white_light": 38444,    // OPCIONAL: Componente de luz blanca
  "raw_light": 20548,      // OPCIONAL: Valor crudo del sensor
  "uv_index": 3.2,         // OPCIONAL: Índice UV (rango: 0-15)
  "rssi": -71,             // OPCIONAL: Intensidad de señal
  "boot": 156,             // OPCIONAL: Contador de reinicios
  "mem": 18944             // OPCIONAL: Memoria libre
}
```

### Validación
- `light`: Número decimal, 0 ≤ valor ≤ 100000
- `white_light`: Número entero (si se proporciona)
- `raw_light`: Número entero (si se proporciona)
- `uv_index`: Número decimal, 0 ≤ valor ≤ 15

---

## 5. SOIL_MOISTURE (Sensores de Humedad del Suelo)

### Tópicos MQTT
- `Invernadero/SoilMoisture1/data`
- `Invernadero/HumedadSuelo/data`

### Payload Estándar
```json
{
  "humedad_suelo": 45.3,   // OBLIGATORIO: Humedad del suelo en % (rango: 0-100)
  "temperatura_suelo": 22.1, // OPCIONAL: Temperatura del suelo en °C
  "conductividad": 1200,   // OPCIONAL: Conductividad del suelo (μS/cm)
  "nitrogeno": 85,         // OPCIONAL: Contenido de nitrógeno (mg/kg)
  "fosforo": 42,           // OPCIONAL: Contenido de fósforo (mg/kg)
  "potasio": 178,          // OPCIONAL: Contenido de potasio (mg/kg)
  "rssi": -68,             // OPCIONAL: Intensidad de señal
  "boot": 12,              // OPCIONAL: Contador de reinicios
  "mem": 17856             // OPCIONAL: Memoria libre
}
```

### Validación
- `humedad_suelo`: Número decimal, 0 ≤ valor ≤ 100
- `temperatura_suelo`: Número decimal, -10 ≤ valor ≤ 60
- `conductividad`: Número entero, 0 ≤ valor ≤ 10000
- `nitrogeno`, `fosforo`, `potasio`: Número entero (si se proporciona)

---

## 6. CO2 (Sensores de Dióxido de Carbono)

### Tópicos MQTT
- `Invernadero/CO2Sensor/data`
- `Invernadero/AirQuality/data`

### Payload Estándar
```json
{
  "co2": 420,              // OBLIGATORIO: Concentración de CO2 en ppm (rango: 0-10000)
  "tvoc": 15,              // OPCIONAL: Compuestos orgánicos volátiles en ppb
  "temperatura": 24.5,     // OPCIONAL: Temperatura ambiente en °C
  "humedad": 55.2,         // OPCIONAL: Humedad relativa en %
  "rssi": -59,             // OPCIONAL: Intensidad de señal
  "boot": 78,              // OPCIONAL: Contador de reinicios
  "mem": 19712             // OPCIONAL: Memoria libre
}
```

### Validación
- `co2`: Número entero, 0 ≤ valor ≤ 10000
- `tvoc`: Número entero (si se proporciona)
- `temperatura`: Número decimal, -10 ≤ valor ≤ 60
- `humedad`: Número decimal, 0 ≤ valor ≤ 100

---

## 7. POWER (Monitores de Consumo Eléctrico)

### Tópicos MQTT
- `Invernadero/PowerMonitor1/data`
- `Invernadero/EnergyMeter/data`

### Payload Estándar
```json
{
  "voltage": 220.5,        // OBLIGATORIO: Voltaje en V (rango: 0-300)
  "current": 2.35,         // OBLIGATORIO: Corriente en A (rango: 0-50)
  "watts": 518.2,          // OBLIGATORIO: Potencia en W (rango: 0-10000)
  "frequency": 50.0,       // OPCIONAL: Frecuencia en Hz (rango: 40-70)
  "power_factor": 0.92,    // OPCIONAL: Factor de potencia (rango: 0-1)
  "energy_total": 1250.5,  // OPCIONAL: Energía total acumulada en kWh
  "device_id": "PUMP_001", // OPCIONAL: ID del dispositivo monitoreado
  "rssi": -73,             // OPCIONAL: Intensidad de señal
  "boot": 45,              // OPCIONAL: Contador de reinicios
  "mem": 18432             // OPCIONAL: Memoria libre
}
```

### Validación
- `voltage`: Número decimal, 0 ≤ valor ≤ 300
- `current`: Número decimal, 0 ≤ valor ≤ 50
- `watts`: Número decimal, 0 ≤ valor ≤ 10000
- `frequency`: Número decimal, 40 ≤ valor ≤ 70
- `power_factor`: Número decimal, 0 ≤ valor ≤ 1
- `energy_total`: Número decimal (si se proporciona)
- `device_id`: Cadena de texto (si se proporciona)

---

## 8. MOTION (Sensores de Movimiento)

### Tópicos MQTT
- `Invernadero/MotionSensor/data`
- `Invernadero/PIR/data`

### Payload Estándar
```json
{
  "motion_detected": true,  // OBLIGATORIO: Detección de movimiento (true/false)
  "confidence": 95,         // OPCIONAL: Nivel de confianza en % (rango: 0-100)
  "distance": 2.5,          // OPCIONAL: Distancia detectada en metros
  "duration": 1500,         // OPCIONAL: Duración del movimiento en ms
  "rssi": -61,              // OPCIONAL: Intensidad de señal
  "boot": 89,               // OPCIONAL: Contador de reinicios
  "mem": 17920              // OPCIONAL: Memoria libre
}
```

### Validación
- `motion_detected`: Booleano (true/false)
- `confidence`: Número entero, 0 ≤ valor ≤ 100
- `distance`: Número decimal, 0 ≤ valor ≤ 50
- `duration`: Número entero (si se proporciona)

---

## 9. WEATHER_STATION (Estaciones Meteorológicas)

### Tópicos MQTT
- `Invernadero/WeatherStation/data`
- `Invernadero/MeteoStation/data`

### Payload Estándar
```json
{
  "temperatura": 24.8,      // OBLIGATORIO: Temperatura ambiente en °C
  "humedad": 68.5,          // OBLIGATORIO: Humedad relativa en %
  "presion": 101325,        // OPCIONAL: Presión atmosférica en Pa
  "velocidad_viento": 3.2,  // OPCIONAL: Velocidad del viento en m/s
  "direccion_viento": "NE", // OPCIONAL: Dirección del viento (N,S,E,W,NE,NW,SE,SW)
  "precipitacion": 0.0,     // OPCIONAL: Precipitación acumulada en mm
  "uv_index": 4.5,          // OPCIONAL: Índice UV (rango: 0-15)
  "visibilidad": 10.0,      // OPCIONAL: Visibilidad en km
  "rssi": -52,              // OPCIONAL: Intensidad de señal
  "boot": 34,               // OPCIONAL: Contador de reinicios
  "mem": 20224              // OPCIONAL: Memoria libre
}
```

### Validación
- `temperatura`: Número decimal, -50 ≤ valor ≤ 60
- `humedad`: Número decimal, 0 ≤ valor ≤ 100
- `presion`: Número decimal, 30000 ≤ valor ≤ 110000
- `velocidad_viento`: Número decimal, 0 ≤ valor ≤ 100
- `direccion_viento`: Cadena de texto (N,S,E,W,NE,NW,SE,SW)
- `precipitacion`: Número decimal, 0 ≤ valor ≤ 1000
- `uv_index`: Número decimal, 0 ≤ valor ≤ 15
- `visibilidad`: Número decimal, 0 ≤ valor ≤ 50

---

## 10. CUSTOM (Sensores Personalizados)

### Tópicos MQTT
- `Invernadero/CustomSensor/data`
- `Invernadero/Sensor[ID]/data`

### Payload Estándar
```json
{
  "value": 42.5,           // OBLIGATORIO: Valor principal del sensor
  "unit": "°C",            // OBLIGATORIO: Unidad de medida
  "sensor_name": "Custom", // OPCIONAL: Nombre del sensor
  "min_value": 0,          // OPCIONAL: Valor mínimo esperado
  "max_value": 100,        // OPCIONAL: Valor máximo esperado
  "rssi": -67,             // OPCIONAL: Intensidad de señal
  "boot": 21,              // OPCIONAL: Contador de reinicios
  "mem": 19456             // OPCIONAL: Memoria libre
}
```

### Validación
- `value`: Número decimal (obligatorio)
- `unit`: Cadena de texto (obligatorio)
- `sensor_name`: Cadena de texto (si se proporciona)
- `min_value`, `max_value`: Número decimal (si se proporciona)

---

## Notas Importantes para el Desarrollo

### 1. Formato de Timestamp
- El backend automáticamente agrega un timestamp cuando procesa el mensaje
- No es necesario incluirlo en el payload del sensor
- Formato utilizado: ISO 8601 (ej: "2025-07-11T16:40:00.000Z")

### 2. Manejo de Errores
- Payloads con campos obligatorios faltantes serán rechazados
- Valores fuera de rango serán registrados pero marcados como errores
- Campos opcionales con valores inválidos serán ignorados

### 3. Retrocompatibilidad
- El sistema mantiene compatibilidad con payloads legacy
- Se recomienda migrar gradualmente a los nuevos formatos
- Los sensores existentes seguirán funcionando durante la transición

### 4. Ejemplos de Implementación en Firmware

#### Arduino/ESP32 - Sensor TemHum
```cpp
// Crear payload JSON estándar
StaticJsonDocument<200> doc;
doc["temperatura"] = dht.readTemperature();
doc["humedad"] = dht.readHumidity();
doc["rssi"] = WiFi.RSSI();
doc["boot"] = bootCount;
doc["mem"] = ESP.getFreeHeap();

String payload;
serializeJson(doc, payload);
mqttClient.publish("Invernadero/TemHum1/data", payload.c_str());
```

#### Arduino/ESP32 - Sensor Water Quality
```cpp
StaticJsonDocument<200> doc;
doc["ph"] = readPH();
doc["ec"] = readEC();
doc["ppm"] = readPPM();
doc["temperatura"] = readWaterTemp();
doc["rssi"] = WiFi.RSSI();
doc["boot"] = bootCount;
doc["mem"] = ESP.getFreeHeap();

String payload;
serializeJson(doc, payload);
mqttClient.publish("Invernadero/AguaPH/data", payload.c_str());
```

### 5. Pruebas y Validación
- Utilizar herramientas como MQTT Explorer para verificar payloads
- Probar con valores límite para validar rangos
- Verificar que los datos aparezcan correctamente en el dashboard

---

## Contacto y Soporte

Para dudas sobre la implementación o modificaciones a estas especificaciones, consultar la documentación técnica del sistema o contactar al equipo de desarrollo.

**Versión del documento**: 1.0  
**Fecha**: 2025-07-11  
**Sistema**: Backend GraphQL IoT Greenhouse