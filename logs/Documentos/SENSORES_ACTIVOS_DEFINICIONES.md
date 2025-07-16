# Definiciones de Variables para Sensores Activos del Sistema

## Estado Actual del Sistema

**Análisis basado en los logs del contenedor Docker activo (2025-07-11 16:40)**

### Sensores Detectados y Activos

Según los logs MQTT y la base de datos, estos son los sensores actualmente funcionando:

---

## 1. **TemHum1** - Sensor de Temperatura y Humedad #1

### **Tópico MQTT Actual**: `Invernadero/TemHum1/data`
### **ID en BD**: `invernadero-temhum1` (Sensor ID: 5)

### **Payload Actual que Recibe el Sistema**:
```json
{
  "temperatura": 26.1,
  "humedad": 41.8,
  "heatindex": 25.9,
  "dewpoint": 12.1,
  "rssi": -76,
  "boot": 49,
  "mem": 19296,
  "stats": {
    "tmin": 3.8,
    "tmax": 27.9,
    "tavg": 26.2,
    "hmin": 38.0,
    "hmax": 72.9,
    "havg": 42.5,
    "total": 2553,
    "errors": 0
  }
}
```

### **Payload Estándar Recomendado**:
```json
{
  "temperatura": 26.1,        // OBLIGATORIO: Temperatura en °C
  "humedad": 41.8,            // OBLIGATORIO: Humedad relativa en %
  "heatindex": 25.9,          // OPCIONAL: Índice de calor en °C
  "dewpoint": 12.1,           // OPCIONAL: Punto de rocío en °C
  "rssi": -76,                // OPCIONAL: Intensidad señal WiFi (dBm)
  "boot": 49,                 // OPCIONAL: Contador de reinicios
  "mem": 19296,               // OPCIONAL: Memoria libre (bytes)
  "tmin": 3.8,                // OPCIONAL: Temperatura mínima
  "tmax": 27.9,               // OPCIONAL: Temperatura máxima
  "tavg": 26.2,               // OPCIONAL: Temperatura promedio
  "hmin": 38.0,               // OPCIONAL: Humedad mínima
  "hmax": 72.9,               // OPCIONAL: Humedad máxima
  "havg": 42.5,               // OPCIONAL: Humedad promedio
  "total": 2553,              // OPCIONAL: Total de lecturas
  "errors": 0                 // OPCIONAL: Errores de lectura
}
```

---

## 2. **TemHum2** - Sensor de Temperatura y Humedad #2

### **Tópico MQTT Actual**: `Invernadero/TemHum2/data`
### **ID en BD**: `invernadero-temhum2` (Sensor ID: 7)

### **Payload Actual que Recibe el Sistema**:
```json
{
  "temperatura": 29.2,
  "humedad": 41.2,
  "heatindex": 28.9,
  "dewpoint": 14.7,
  "rssi": -73,
  "boot": 40,
  "mem": 19368,
  "stats": {
    "tmin": 3.5,
    "tmax": 29.3,
    "tavg": 29.2,
    "hmin": 36.9,
    "hmax": 70.8,
    "havg": 40.9,
    "total": 2553,
    "errors": 0
  }
}
```

### **Payload Estándar Recomendado**: (Igual que TemHum1)

---

## 3. **TemHum3** - Sensor de Temperatura y Humedad #3

### **Tópico MQTT Actual**: `Invernadero/TemHum3/data`
### **ID en BD**: `invernadero-temhum3` (Sensor ID: 4)

### **Payload Actual que Recibe el Sistema**:
```json
{
  "temperatura": 27.68879,
  "humedad": 40.31925,
  "rssi": -83
}
```

### **Payload Estándar Recomendado**:
```json
{
  "temperatura": 27.7,        // OBLIGATORIO: Temperatura en °C
  "humedad": 40.3,            // OBLIGATORIO: Humedad relativa en %
  "heatindex": 28.2,          // OPCIONAL: Índice de calor calculado
  "dewpoint": 13.5,           // OPCIONAL: Punto de rocío calculado
  "rssi": -83,                // OPCIONAL: Intensidad señal WiFi (dBm)
  "boot": 0,                  // OPCIONAL: Contador de reinicios
  "mem": 0                    // OPCIONAL: Memoria libre (bytes)
}
```

---

## 4. **AguaPH** - Sensor de pH del Agua

### **Tópico MQTT Actual**: `Invernadero/AguaPH/data`
### **ID en BD**: `invernadero-aguaph` (Sensor ID: 6)

### **Payload Actual que Recibe el Sistema**:
```json
{
  "pH": 7.278059,
  "Temp": 12.25278,
  "Voltage": 0.993191
}
```

### **⚠️ PROBLEMA DETECTADO**: Variables con mayúsculas no estándar

### **Payload Estándar Recomendado**:
```json
{
  "ph": 7.28,                 // OBLIGATORIO: Nivel de pH (0-14)
  "temperatura": 12.25,       // OPCIONAL: Temperatura del agua en °C
  "voltage": 0.99,            // OPCIONAL: Voltaje del sensor (V)
  "ec": 1500,                 // OPCIONAL: Conductividad eléctrica (μS/cm)
  "ppm": 750,                 // OPCIONAL: Partes por millón (mg/L)
  "rssi": -65,                // OPCIONAL: Intensidad señal WiFi (dBm)
  "boot": 0,                  // OPCIONAL: Contador de reinicios
  "mem": 0                    // OPCIONAL: Memoria libre (bytes)
}
```

### **🔧 CAMBIOS REQUERIDOS EN FIRMWARE**:
- `"pH"` → `"ph"` (minúsculas)
- `"Temp"` → `"temperatura"` (español estándar)
- `"Voltage"` → `"voltage"` (minúsculas)

---

## 5. **BMP280-1** - Sensor de Temperatura y Presión

### **Tópico MQTT Actual**: `Invernadero/BMP280-1/data`
### **ID en BD**: `invernadero-bmp280-1` (Sensor ID: 3)

### **Payload Actual que Recibe el Sistema**:
```json
{
  "temperatura": 28.81,
  "presion": 98889.77
}
```

### **✅ FORMATO CORRECTO**: Las variables están en formato estándar

### **Payload Estándar Recomendado**:
```json
{
  "temperatura": 28.81,       // OBLIGATORIO: Temperatura en °C
  "presion": 98889.77,        // OBLIGATORIO: Presión atmosférica en Pa
  "altitude": 542.5,          // OPCIONAL: Altitud calculada en metros
  "rssi": -82,                // OPCIONAL: Intensidad señal WiFi (dBm)
  "boot": 0,                  // OPCIONAL: Contador de reinicios
  "mem": 0                    // OPCIONAL: Memoria libre (bytes)
}
```

---

## 6. **Luxometro** - Sensor de Luminosidad

### **Tópico MQTT Actual**: `Invernadero/Luxometro/data`
### **ID en BD**: `invernadero-luxometro` (Sensor ID: 2)

### **Payload Actual que Recibe el Sistema**:
```json
{
  "light": 9656.063,
  "white_light": 37691,
  "raw_light": 20955
}
```

### **✅ FORMATO CORRECTO**: Las variables están en formato estándar

### **Payload Estándar Recomendado**:
```json
{
  "light": 9656.06,           // OBLIGATORIO: Intensidad de luz en lux
  "white_light": 37691,       // OPCIONAL: Componente de luz blanca
  "raw_light": 20955,         // OPCIONAL: Valor crudo del sensor
  "uv_index": 3.2,            // OPCIONAL: Índice UV (0-15)
  "rssi": -71,                // OPCIONAL: Intensidad señal WiFi (dBm)
  "boot": 0,                  // OPCIONAL: Contador de reinicios
  "mem": 0                    // OPCIONAL: Memoria libre (bytes)
}
```

---

## 7. **Dispositivos de Control Activos**

### **Dispositivos Registrados en Base de Datos**:
- **ID 1**: `bomba_agua_01` - Bomba de Agua Principal
- **ID 2**: `ventilador_01` - Ventilador de Circulación  
- **ID 3**: `led_grow_01` - Lámpara LED Crecimiento
- **ID 4**: `calefactor_01` - Calefactor Nocturno
- **ID 5**: `calefactor_agua_01` - Calefactor de Agua

---

## 7.1. **Bomba de Agua Principal** (ID: bomba_agua_01)

### **Tópico MQTT Control**: `Invernadero/Bomba/sw`
### **Tópico MQTT Status**: `Invernadero/Bomba/status`
### **Tipo**: `water_pump`
### **Estado Actual**: `offline`

### **Payload Actual que Recibe el Sistema**:
```json
{
  "bombaSw": true
}
```

### **⚠️ PROBLEMA DETECTADO**: Variable no estándar `bombaSw`

### **Payload Estándar Recomendado**:
```json
{
  // === CONTROL PRINCIPAL ===
  "estado": true,             // OBLIGATORIO: Estado bomba (true/false)
  "modo": "auto",             // OPCIONAL: Modo operación (auto/manual/timer)
  "intensidad": 100,          // OPCIONAL: Intensidad bombeo (0-100%)
  "presion": 2.5,             // OPCIONAL: Presión de salida (bar)
  "caudal": 15.5,             // OPCIONAL: Caudal actual (L/min)
  "horas_operacion": 1250,    // OPCIONAL: Horas acumuladas de operación
  
  // === SEGURIDAD Y PROTECCIÓN ===
  "proteccion_seca": false,   // OPCIONAL: Protección marcha en seco
  "sobrecarga": false,        // OPCIONAL: Detección sobrecarga
  "temperatura_motor": 45.2,  // OPCIONAL: Temperatura motor (°C)
  "vibracion": 0.5,           // OPCIONAL: Nivel vibración (g)
  "presion_entrada": 1.2,     // OPCIONAL: Presión entrada (bar)
  
  // === CICLOS Y TEMPORIZADORES ===
  "ciclo_activo": true,       // OPCIONAL: Ciclo programado activo
  "tiempo_encendido": 900,    // OPCIONAL: Tiempo encendido actual (segundos)
  "tiempo_apagado": 0,        // OPCIONAL: Tiempo apagado actual (segundos)
  "ciclos_completados": 45,   // OPCIONAL: Ciclos completados hoy
  "proxima_activacion": "2025-07-11T17:00:00Z", // OPCIONAL: Próxima activación
  
  // === CONSUMO ENERGÉTICO ===
  "consumo": 150,             // OPCIONAL: Consumo eléctrico (W)
  "voltaje": 220,             // OPCIONAL: Voltaje alimentación (V)
  "corriente": 0.68,          // OPCIONAL: Corriente consumida (A)
  "factor_potencia": 0.85,    // OPCIONAL: Factor de potencia
  "energia_acumulada": 25.5,  // OPCIONAL: Energía acumulada (kWh)
  
  // === MANTENIMIENTO ===
  "filtro_estado": "limpio",  // OPCIONAL: Estado filtro (limpio/sucio/obstruido)
  "ultimo_mantenimiento": "2025-07-01T10:00:00Z", // OPCIONAL: Último mantenimiento
  "mantenimiento_debido": false, // OPCIONAL: Mantenimiento programado
  "alertas_activas": [],      // OPCIONAL: Lista de alertas activas
  
  // === CAMPOS COMUNES ===
  "rssi": -68,                // OPCIONAL: Intensidad señal WiFi (dBm)
  "boot": 15,                 // OPCIONAL: Contador de reinicios
  "mem": 18240,               // OPCIONAL: Memoria libre (bytes)
  "firmware_version": "1.5.2", // OPCIONAL: Versión firmware
  "device_id": "bomba_agua_01", // OPCIONAL: ID dispositivo
  "location": "invernadero_1", // OPCIONAL: Ubicación
  "last_command": "turn_on",  // OPCIONAL: Último comando recibido
  "command_timestamp": "2025-07-11T16:30:00Z" // OPCIONAL: Timestamp comando
}
```

### **🔧 CAMBIOS REQUERIDOS EN FIRMWARE**:
- `"bombaSw"` → `"estado"` (estándar)
- Agregar campos de diagnóstico y seguridad

---

## 7.2. **Ventilador de Circulación** (ID: ventilador_01)

### **Tópico MQTT Control**: `Invernadero/Ventilador/sw`
### **Tópico MQTT Status**: `Invernadero/Ventilador/status`
### **Tipo**: `fan`
### **Estado Actual**: `offline`

### **Payload Actual que Recibe el Sistema**:
```json
{
  "ventiladorSw": true
}
```

### **Payload Estándar Recomendado**:
```json
{
  // === CONTROL PRINCIPAL ===
  "estado": true,             // OBLIGATORIO: Estado ventilador (true/false)
  "modo": "auto",             // OPCIONAL: Modo operación (auto/manual/timer)
  "velocidad": 75,            // OPCIONAL: Velocidad ventilador (0-100%)
  "direccion": "forward",     // OPCIONAL: Dirección giro (forward/reverse)
  "oscilacion": false,        // OPCIONAL: Oscilación activa
  "rpm": 1450,                // OPCIONAL: RPM actuales
  
  // === CONTROL DE TEMPERATURA ===
  "temperatura_objetivo": 25.0, // OPCIONAL: Temperatura objetivo (°C)
  "temperatura_actual": 26.5,  // OPCIONAL: Temperatura actual (°C)
  "histeresis": 1.0,          // OPCIONAL: Histéresis temperatura (°C)
  "modo_termostato": true,    // OPCIONAL: Modo termostato activo
  
  // === PROGRAMACIÓN ===
  "temporizador_activo": false, // OPCIONAL: Temporizador activo
  "tiempo_restante": 0,       // OPCIONAL: Tiempo restante (segundos)
  "horario_programado": "06:00-20:00", // OPCIONAL: Horario funcionamiento
  "dias_semana": [1,2,3,4,5,6,7], // OPCIONAL: Días operación
  
  // === SEGURIDAD ===
  "sobrecarga": false,        // OPCIONAL: Detección sobrecarga
  "temperatura_motor": 42.1,  // OPCIONAL: Temperatura motor (°C)
  "vibracion": 0.3,           // OPCIONAL: Nivel vibración (g)
  "filtro_obstruido": false,  // OPCIONAL: Filtro obstruido
  "aspas_bloqueadas": false,  // OPCIONAL: Aspas bloqueadas
  
  // === CONSUMO ENERGÉTICO ===
  "consumo": 85,              // OPCIONAL: Consumo eléctrico (W)
  "voltaje": 220,             // OPCIONAL: Voltaje alimentación (V)
  "corriente": 0.39,          // OPCIONAL: Corriente consumida (A)
  "energia_acumulada": 15.2,  // OPCIONAL: Energía acumulada (kWh)
  
  // === ESTADÍSTICAS ===
  "horas_operacion": 2340,    // OPCIONAL: Horas acumuladas operación
  "ciclos_encendido": 856,    // OPCIONAL: Ciclos de encendido
  "eficiencia": 92,           // OPCIONAL: Eficiencia actual (%)
  "flujo_aire": 850,          // OPCIONAL: Flujo de aire (m³/h)
  
  // === CAMPOS COMUNES ===
  "rssi": -71,                // OPCIONAL: Intensidad señal WiFi (dBm)
  "boot": 8,                  // OPCIONAL: Contador de reinicios
  "mem": 17856,               // OPCIONAL: Memoria libre (bytes)
  "firmware_version": "1.3.1", // OPCIONAL: Versión firmware
  "device_id": "ventilador_01", // OPCIONAL: ID dispositivo
  "location": "invernadero_1"  // OPCIONAL: Ubicación
}
```

### **🔧 CAMBIOS REQUERIDOS EN FIRMWARE**:
- `"ventiladorSw"` → `"estado"` (estándar)
- Agregar control de velocidad y temperaturas

---

## 7.3. **Calefactor Nocturno** (ID: calefactor_01)

### **Tópico MQTT Control**: `Invernadero/Calefactor/sw`
### **Tópico MQTT Status**: `Invernadero/Calefactor/status`
### **Tipo**: `heater`
### **Estado Actual**: `offline`

### **Payload Actual que Recibe el Sistema**:
```json
{
  "calefactorSw": true
}
```

### **Payload Estándar Recomendado**:
```json
{
  // === CONTROL PRINCIPAL ===
  "estado": true,             // OBLIGATORIO: Estado calefactor (true/false)
  "modo": "auto",             // OPCIONAL: Modo operación (auto/manual/timer)
  "potencia": 80,             // OPCIONAL: Potencia calefacción (0-100%)
  "temperatura_objetivo": 22.0, // OPCIONAL: Temperatura objetivo (°C)
  "temperatura_actual": 20.5,  // OPCIONAL: Temperatura actual (°C)
  "histeresis": 0.5,          // OPCIONAL: Histéresis temperatura (°C)
  
  // === CONTROL DE TEMPERATURA ===
  "sensor_temperatura": 20.5, // OPCIONAL: Lectura sensor temp (°C)
  "temperatura_elemento": 45.2, // OPCIONAL: Temperatura elemento (°C)
  "control_pid": true,        // OPCIONAL: Control PID activo
  "pid_kp": 2.0,              // OPCIONAL: Parámetro PID Kp
  "pid_ki": 0.5,              // OPCIONAL: Parámetro PID Ki
  "pid_kd": 0.1,              // OPCIONAL: Parámetro PID Kd
  
  // === PROGRAMACIÓN ===
  "horario_nocturno": "20:00-06:00", // OPCIONAL: Horario funcionamiento
  "temperatura_dia": 25.0,    // OPCIONAL: Temperatura diurna (°C)
  "temperatura_noche": 18.0,  // OPCIONAL: Temperatura nocturna (°C)
  "modo_estacional": "invierno", // OPCIONAL: Modo estacional
  
  // === SEGURIDAD ===
  "sobrecalentamiento": false, // OPCIONAL: Protección sobrecalentamiento
  "sensor_incendio": false,   // OPCIONAL: Sensor humo/incendio
  "ventilacion_forzada": false, // OPCIONAL: Ventilación forzada activa
  "termostato_seguridad": false, // OPCIONAL: Termostato seguridad
  "temperatura_maxima": 35.0,  // OPCIONAL: Temperatura máxima (°C)
  
  // === CONSUMO ENERGÉTICO ===
  "consumo": 800,             // OPCIONAL: Consumo eléctrico (W)
  "voltaje": 220,             // OPCIONAL: Voltaje alimentación (V)
  "corriente": 3.64,          // OPCIONAL: Corriente consumida (A)
  "energia_acumulada": 125.8, // OPCIONAL: Energía acumulada (kWh)
  "costo_operacion": 15.50,   // OPCIONAL: Costo operación diario (€)
  
  // === ESTADÍSTICAS ===
  "horas_operacion": 1840,    // OPCIONAL: Horas acumuladas operación
  "ciclos_encendido": 456,    // OPCIONAL: Ciclos de encendido
  "eficiencia": 87,           // OPCIONAL: Eficiencia energética (%)
  "tiempo_calentamiento": 300, // OPCIONAL: Tiempo calentamiento (s)
  
  // === CAMPOS COMUNES ===
  "rssi": -63,                // OPCIONAL: Intensidad señal WiFi (dBm)
  "boot": 12,                 // OPCIONAL: Contador de reinicios
  "mem": 16384,               // OPCIONAL: Memoria libre (bytes)
  "firmware_version": "1.4.0", // OPCIONAL: Versión firmware
  "device_id": "calefactor_01", // OPCIONAL: ID dispositivo
  "location": "invernadero_1"  // OPCIONAL: Ubicación
}
```

### **🔧 CAMBIOS REQUERIDOS EN FIRMWARE**:
- `"calefactorSw"` → `"estado"` (estándar)
- Agregar control de temperatura y seguridad

---

## 7.4. **Calefactor de Agua** (ID: calefactor_agua_01)

### **Tópico MQTT Control**: `Invernadero/CalefactorAgua/sw`
### **Tópico MQTT Status**: `Invernadero/CalefactorAgua/status`
### **Tipo**: `water_heater`
### **Estado Actual**: `offline`

### **Payload Actual que Recibe el Sistema**:
```json
{
  "calefactorAguaSw": true
}
```

### **Payload Estándar Recomendado**:
```json
{
  // === CONTROL PRINCIPAL ===
  "estado": true,             // OBLIGATORIO: Estado calefactor (true/false)
  "modo": "auto",             // OPCIONAL: Modo operación (auto/manual/timer)
  "potencia": 70,             // OPCIONAL: Potencia calefacción (0-100%)
  "temperatura_objetivo": 25.0, // OPCIONAL: Temperatura objetivo agua (°C)
  "temperatura_agua": 23.5,   // OPCIONAL: Temperatura actual agua (°C)
  "histeresis": 1.0,          // OPCIONAL: Histéresis temperatura (°C)
  
  // === CONTROL DE AGUA ===
  "sensor_agua": 23.5,        // OPCIONAL: Lectura sensor agua (°C)
  "flujo_agua": 2.5,          // OPCIONAL: Flujo agua (L/min)
  "presion_agua": 1.8,        // OPCIONAL: Presión agua (bar)
  "nivel_tanque": 75,         // OPCIONAL: Nivel tanque (%)
  "bomba_circulacion": true,  // OPCIONAL: Bomba circulación activa
  
  // === PROGRAMACIÓN ===
  "horario_calentamiento": "06:00-22:00", // OPCIONAL: Horario funcionamiento
  "temperatura_minima": 18.0, // OPCIONAL: Temperatura mínima (°C)
  "temperatura_maxima": 30.0, // OPCIONAL: Temperatura máxima (°C)
  "modo_ahorro": false,       // OPCIONAL: Modo ahorro energético
  
  // === SEGURIDAD ===
  "sobrecalentamiento": false, // OPCIONAL: Protección sobrecalentamiento
  "sensor_escape": false,     // OPCIONAL: Sensor escape agua
  "presion_excesiva": false,  // OPCIONAL: Presión excesiva
  "termostato_seguridad": false, // OPCIONAL: Termostato seguridad
  "valvula_alivio": false,    // OPCIONAL: Válvula alivio activa
  
  // === CONSUMO ENERGÉTICO ===
  "consumo": 1200,            // OPCIONAL: Consumo eléctrico (W)
  "voltaje": 220,             // OPCIONAL: Voltaje alimentación (V)
  "corriente": 5.45,          // OPCIONAL: Corriente consumida (A)
  "energia_acumulada": 89.2,  // OPCIONAL: Energía acumulada (kWh)
  "costo_operacion": 11.20,   // OPCIONAL: Costo operación diario (€)
  
  // === ESTADÍSTICAS ===
  "horas_operacion": 980,     // OPCIONAL: Horas acumuladas operación
  "ciclos_encendido": 234,    // OPCIONAL: Ciclos de encendido
  "eficiencia": 89,           // OPCIONAL: Eficiencia energética (%)
  "litros_calentados": 1500,  // OPCIONAL: Litros calentados diarios
  
  // === CAMPOS COMUNES ===
  "rssi": -59,                // OPCIONAL: Intensidad señal WiFi (dBm)
  "boot": 7,                  // OPCIONAL: Contador de reinicios
  "mem": 15872,               // OPCIONAL: Memoria libre (bytes)
  "firmware_version": "1.2.8", // OPCIONAL: Versión firmware
  "device_id": "calefactor_agua_01", // OPCIONAL: ID dispositivo
  "location": "invernadero_1"  // OPCIONAL: Ubicación
}
```

### **🔧 CAMBIOS REQUERIDOS EN FIRMWARE**:
- `"calefactorAguaSw"` → `"estado"` (estándar)
- Agregar sensores de agua y seguridad

---

## 7.5. **Lámpara LED Crecimiento** (ID: led_grow_01)

### **Tópico MQTT Control**: `Invernadero/LedGrow/sw`
### **Tópico MQTT Status**: `Invernadero/LedGrow/status`
### **Tipo**: `lights`
### **Estado Actual**: `offline`

### **Payload Estándar Recomendado**:
```json
{
  // === CONTROL PRINCIPAL ===
  "estado": true,             // OBLIGATORIO: Estado lámpara (true/false)
  "modo": "auto",             // OPCIONAL: Modo operación (auto/manual/timer)
  "intensidad": 85,           // OPCIONAL: Intensidad luz (0-100%)
  "espectro": "full",         // OPCIONAL: Espectro luz (full/blue/red/mixed)
  "dimmer": 85,               // OPCIONAL: Nivel dimmer (0-100%)
  
  // === CONTROL DE ESPECTRO ===
  "led_azul": 90,             // OPCIONAL: Intensidad LED azul (0-100%)
  "led_rojo": 80,             // OPCIONAL: Intensidad LED rojo (0-100%)
  "led_blanco": 85,           // OPCIONAL: Intensidad LED blanco (0-100%)
  "led_verde": 60,            // OPCIONAL: Intensidad LED verde (0-100%)
  "led_uv": 30,               // OPCIONAL: Intensidad LED UV (0-100%)
  "led_ir": 40,               // OPCIONAL: Intensidad LED IR (0-100%)
  
  // === PROGRAMACIÓN ===
  "horario_dia": "06:00-20:00", // OPCIONAL: Horario día
  "horario_noche": "20:00-06:00", // OPCIONAL: Horario noche
  "intensidad_dia": 100,      // OPCIONAL: Intensidad diurna (%)
  "intensidad_noche": 20,     // OPCIONAL: Intensidad nocturna (%)
  "fotoperiodo": 14,          // OPCIONAL: Horas luz/día
  
  // === SENSORES ===
  "sensor_luz": 45000,        // OPCIONAL: Sensor luz ambiente (lux)
  "temperatura_led": 38.5,    // OPCIONAL: Temperatura LEDs (°C)
  "humedad_ambiente": 55,     // OPCIONAL: Humedad ambiente (%)
  "ppfd": 850,                // OPCIONAL: PPFD (μmol/m²/s)
  
  // === SEGURIDAD ===
  "sobrecalentamiento": false, // OPCIONAL: Protección sobrecalentamiento
  "ventilacion_activa": true, // OPCIONAL: Ventilación activa
  "led_fallidos": 0,          // OPCIONAL: Número LEDs fallidos
  "corriente_excesiva": false, // OPCIONAL: Corriente excesiva
  
  // === CONSUMO ENERGÉTICO ===
  "consumo": 180,             // OPCIONAL: Consumo eléctrico (W)
  "voltaje": 220,             // OPCIONAL: Voltaje alimentación (V)
  "corriente": 0.82,          // OPCIONAL: Corriente consumida (A)
  "energia_acumulada": 45.6,  // OPCIONAL: Energía acumulada (kWh)
  "eficiencia_luminosa": 2.8, // OPCIONAL: Eficiencia (μmol/J)
  
  // === ESTADÍSTICAS ===
  "horas_operacion": 3200,    // OPCIONAL: Horas acumuladas operación
  "ciclos_encendido": 1240,   // OPCIONAL: Ciclos de encendido
  "vida_util_restante": 87,   // OPCIONAL: Vida útil restante (%)
  "degradacion_luminosa": 5,  // OPCIONAL: Degradación luminosa (%)
  
  // === CAMPOS COMUNES ===
  "rssi": -55,                // OPCIONAL: Intensidad señal WiFi (dBm)
  "boot": 4,                  // OPCIONAL: Contador de reinicios
  "mem": 20480,               // OPCIONAL: Memoria libre (bytes)
  "firmware_version": "1.6.2", // OPCIONAL: Versión firmware
  "device_id": "led_grow_01", // OPCIONAL: ID dispositivo
  "location": "invernadero_1"  // OPCIONAL: Ubicación
}
```

---

## 8. **Sensores Legacy/Históricos**

### **Tópicos Adicionales Detectados**:
- `Invernadero/Agua/Temp` - Temperatura del agua (valor simple)
- `Invernadero/Agua/data` - Datos completos del agua
- `Invernadero/Agua/temp` - Temperatura del agua (objeto)

### **Payload Actual**:
```json
// Invernadero/Agua/Temp
20.6

// Invernadero/Agua/data
{"ph": 5, "ec": 1000, "ppm": 1000, "temp": 18}

// Invernadero/Agua/temp
{"temp": 18}
```

### **⚠️ PROBLEMA DETECTADO**: Formato inconsistente, múltiples tópicos para lo mismo

### **Payload Estándar Recomendado** (Consolidado):
```json
{
  "ph": 5.0,                  // OBLIGATORIO: Nivel de pH
  "ec": 1000,                 // OPCIONAL: Conductividad eléctrica
  "ppm": 1000,                // OPCIONAL: Partes por millón
  "temperatura": 18.0,        // OPCIONAL: Temperatura del agua
  "rssi": -65,                // OPCIONAL: Intensidad señal WiFi
  "boot": 0,                  // OPCIONAL: Contador de reinicios
  "mem": 0                    // OPCIONAL: Memoria libre
}
```

---

## **Resumen de Cambios Requeridos**

### **🔧 Cambios Críticos en Firmware - SENSORES**:

1. **AguaPH** (Sensor ID: 6):
   - `"pH"` → `"ph"`
   - `"Temp"` → `"temperatura"`
   - `"Voltage"` → `"voltage"`

2. **TemHum3** (Sensor ID: 4):
   - Agregar campos opcionales: `heatindex`, `dewpoint`, `boot`, `mem`

3. **Todos los Sensores**:
   - Agregar campo `rssi` si no está presente
   - Considerar agregar `boot` y `mem` para diagnóstico

### **🔧 Cambios Críticos en Firmware - DISPOSITIVOS**:

1. **Bomba de Agua** (ID: bomba_agua_01):
   - `"bombaSw"` → `"estado"`
   - Agregar campos: `modo`, `intensidad`, `presion`, `caudal`

2. **Ventilador** (ID: ventilador_01):
   - `"ventiladorSw"` → `"estado"`
   - Agregar campos: `modo`, `velocidad`, `temperatura_objetivo`

3. **Calefactor** (ID: calefactor_01):
   - `"calefactorSw"` → `"estado"`
   - Agregar campos: `modo`, `potencia`, `temperatura_objetivo`

4. **Calefactor de Agua** (ID: calefactor_agua_01):
   - `"calefactorAguaSw"` → `"estado"`
   - Agregar campos: `modo`, `potencia`, `temperatura_agua`

5. **Lámpara LED** (ID: led_grow_01):
   - Implementar tópico: `Invernadero/LedGrow/sw`
   - Agregar campos: `estado`, `modo`, `intensidad`, `espectro`

### **✅ Sensores con Formato Correcto**:
- **BMP280-1**: Formato perfecto
- **Luxometro**: Formato perfecto
- **TemHum1/TemHum2**: Formato completo y correcto

### **📊 Estado del Auto-Discovery**:
- **Sensores**: 7 sensores detectados y creados automáticamente ✅
- **Dispositivos**: 5 dispositivos registrados en BD, pero NO funcionan ❌
- **Problema CRÍTICO**: Los dispositivos NO están siendo procesados por auto-discovery

### **❌ PROBLEMAS DETECTADOS CON DISPOSITIVOS**:

1. **Sistema NO procesa dispositivos correctamente**:
   - Los tópicos `/sw` son detectados pero rechazados
   - Los payloads `{"bombaSw": true}` no son normalizados
   - Auto-discovery está configurado para dispositivos pero NO funciona

2. **Logs muestran errores**:
   ```
   ⚠️ No se encontró sensor para el tópico: Invernadero/Bomba/sw
   ⚠️ No se encontró sensor para el tópico: Invernadero/Ventilador/sw
   ⚠️ No se encontró sensor para el tópico: Invernadero/Calefactor/sw
   ⚠️ No se encontró sensor para el tópico: Invernadero/CalefactorAgua/sw
   ```

3. **Sistema trata dispositivos como sensores**:
   - Los dispositivos son procesados por el pipeline de sensores
   - No hay creación automática de dispositivos funcionando
   - Variables no normalizadas: `bombaSw`, `ventiladorSw`, `calefactorSw`

### **🔥 RESULTADO**: 
**El mapeo de variables para dispositivos NO está resuelto. Los dispositivos no funcionan en el sistema actual.**

---

## **Implementación Recomendada**

### **Prioridad 1 - Crítica**:
1. Corregir variables del sensor **AguaPH**
2. Estandarizar tópicos duplicados del agua

### **Prioridad 2 - Mejora**:
1. Agregar campos diagnóstico a **TemHum3**
2. Agregar campos opcionales a **BMP280-1** y **Luxometro**

### **Prioridad 3 - Expansión**:
1. Implementar campos de control para dispositivos
2. Agregar campos de estadísticas y monitoreo

---

## **Validación y Pruebas**

Una vez implementados los cambios, verificar que:
1. Auto-discovery funcione correctamente
2. Datos se almacenen en las tablas correctas
3. GraphQL API devuelva datos normalizados
4. Reglas del motor de reglas funcionen consistentemente

**Estado del Sistema**: ✅ **Funcionando** con mejoras recomendadas para normalización completa.