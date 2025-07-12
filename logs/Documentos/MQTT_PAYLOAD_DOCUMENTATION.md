# Documentación de Payloads MQTT - Sistema IoT Invernadero

## Tabla de Contenidos
1. [Sensores](#sensores)
2. [Dispositivos de Control](#dispositivos-de-control)
3. [Campos Comunes](#campos-comunes)
4. [Ejemplos de Implementación](#ejemplos-de-implementación)
5. [Retrocompatibilidad](#retrocompatibilidad)

---

## Sensores

### 1. Sensor de Temperatura y Humedad (TEMHUM)

**Tópico MQTT**: `Invernadero/[SENSOR_ID]/data`

**Payload Estándar**:
```json
{
  // === CAMPOS OBLIGATORIOS ===
  "temperatura": 26.1,        // Temperatura en °C
  "humedad": 41.8,            // Humedad relativa en %
  
  // === CAMPOS OPCIONALES ===
  "heatindex": 25.9,          // Índice de calor en °C
  "dewpoint": 12.1,           // Punto de rocío en °C
  "rssi": -76,                // Intensidad señal WiFi (dBm)
  "boot": 49,                 // Contador de reinicios
  "mem": 19296,               // Memoria libre (bytes)
  "timestamp": "2025-07-11T17:00:00Z", // Timestamp ISO 8601
  
  // === ESTADÍSTICAS (OPCIONAL) ===
  "stats": {
    "tmin": 3.8,              // Temperatura mínima
    "tmax": 27.9,             // Temperatura máxima
    "tavg": 26.2,             // Temperatura promedio
    "hmin": 38.0,             // Humedad mínima
    "hmax": 72.9,             // Humedad máxima
    "havg": 42.5,             // Humedad promedio
    "total": 2553,            // Total de lecturas
    "errors": 0               // Errores de lectura
  }
}
```

**Sensores Activos**:
- `Invernadero/TemHum1/data` → `invernadero-temhum1`
- `Invernadero/TemHum2/data` → `invernadero-temhum2`
- `Invernadero/TemHum3/data` → `invernadero-temhum3`

---

### 2. Sensor de Calidad del Agua (WATER_QUALITY)

**Tópico MQTT**: `Invernadero/[SENSOR_ID]/data`

**Payload Estándar**:
```json
{
  // === CAMPOS OBLIGATORIOS ===
  "ph": 7.28,                 // Nivel de pH (0-14)
  
  // === CAMPOS OPCIONALES ===
  "ec": 1500,                 // Conductividad eléctrica (μS/cm)
  "ppm": 750,                 // Partes por millón (mg/L)
  "temperatura": 12.25,       // Temperatura del agua en °C
  "voltage": 0.99,            // Voltaje del sensor (V)
  "rssi": -65,                // Intensidad señal WiFi (dBm)
  "boot": 0,                  // Contador de reinicios
  "mem": 0,                   // Memoria libre (bytes)
  "timestamp": "2025-07-11T17:00:00Z"
}
```

**Sensores Activos**:
- `Invernadero/AguaPH/data` → `invernadero-aguaph` ⚠️ **REQUIERE CORRECCIÓN**

**⚠️ Problema Actual**: El sensor AguaPH envía variables con mayúsculas:
```json
{
  "pH": 7.278059,      // ❌ Debe ser "ph"
  "Temp": 12.25278,    // ❌ Debe ser "temperatura"
  "Voltage": 0.993191  // ❌ Debe ser "voltage"
}
```

---

### 3. Sensor de Luminosidad (LIGHT)

**Tópico MQTT**: `Invernadero/[SENSOR_ID]/data`

**Payload Estándar**:
```json
{
  // === CAMPOS OBLIGATORIOS ===
  "light": 9656.06,           // Intensidad de luz en lux
  
  // === CAMPOS OPCIONALES ===
  "white_light": 37691,       // Componente de luz blanca
  "raw_light": 20955,         // Valor crudo del sensor
  "uv_index": 3.2,            // Índice UV (0-15)
  "rssi": -71,                // Intensidad señal WiFi (dBm)
  "boot": 0,                  // Contador de reinicios
  "mem": 0,                   // Memoria libre (bytes)
  "timestamp": "2025-07-11T17:00:00Z"
}
```

**Sensores Activos**:
- `Invernadero/Luxometro/data` → `invernadero-luxometro` ✅ **CORRECTO**

---

### 4. Sensor de Temperatura y Presión (TEMP_PRESSURE)

**Tópico MQTT**: `Invernadero/[SENSOR_ID]/data`

**Payload Estándar**:
```json
{
  // === CAMPOS OBLIGATORIOS ===
  "temperatura": 28.81,       // Temperatura en °C
  "presion": 98889.77,        // Presión atmosférica en Pa
  
  // === CAMPOS OPCIONALES ===
  "altitude": 542.5,          // Altitud calculada en metros
  "rssi": -82,                // Intensidad señal WiFi (dBm)
  "boot": 0,                  // Contador de reinicios
  "mem": 0,                   // Memoria libre (bytes)
  "timestamp": "2025-07-11T17:00:00Z"
}
```

**Sensores Activos**:
- `Invernadero/BMP280-1/data` → `invernadero-bmp280-1` ✅ **CORRECTO**

---

### 5. Sensor de Energía (POWER)

**Tópico MQTT**: `Invernadero/[SENSOR_ID]/data`

**Payload Estándar**:
```json
{
  // === CAMPOS OBLIGATORIOS ===
  "watts": 150.5,             // Potencia en vatios
  "voltage": 220.0,           // Voltaje en voltios
  "current": 0.68,            // Corriente en amperios
  
  // === CAMPOS OPCIONALES ===
  "frequency": 50.0,          // Frecuencia en Hz
  "power_factor": 0.85,       // Factor de potencia
  "energy_total": 25.5,       // Energía total acumulada (kWh)
  "rssi": -68,                // Intensidad señal WiFi (dBm)
  "boot": 15,                 // Contador de reinicios
  "mem": 18240,               // Memoria libre (bytes)
  "timestamp": "2025-07-11T17:00:00Z"
}
```

---

## Dispositivos de Control

### 1. Bomba de Agua (water_pump)

**Tópico MQTT Control**: `Invernadero/[DEVICE_ID]/sw`  
**Tópico MQTT Status**: `Invernadero/[DEVICE_ID]/status`

**Payload Estándar**:
```json
{
  // === IDENTIFICACIÓN ===
  "device_id": "bomba_agua_01",        // ID único del dispositivo
  "device_type": "water_pump",         // Tipo de dispositivo
  
  // === CONTROL PRINCIPAL ===
  "estado": true,                      // Estado bomba (true/false)
  "modo": "auto",                      // Modo: auto/manual/timer
  "intensidad": 100,                   // Intensidad bombeo (0-100%)
  
  // === PARÁMETROS OPERATIVOS ===
  "presion": 2.5,                      // Presión de salida (bar)
  "caudal": 15.5,                      // Caudal actual (L/min)
  "horas_operacion": 1250,             // Horas acumuladas
  
  // === SEGURIDAD ===
  "proteccion_seca": false,            // Protección marcha en seco
  "sobrecarga": false,                 // Detección sobrecarga
  "temperatura_motor": 45.2,           // Temperatura motor (°C)
  "vibracion": 0.5,                    // Nivel vibración (g)
  
  // === CICLOS Y TEMPORIZADORES ===
  "ciclo_activo": true,                // Ciclo programado activo
  "tiempo_encendido": 900,             // Tiempo encendido (segundos)
  "tiempo_apagado": 0,                 // Tiempo apagado (segundos)
  "proxima_activacion": "2025-07-11T17:00:00Z",
  
  // === CONSUMO ENERGÉTICO ===
  "consumo": 150,                      // Consumo eléctrico (W)
  "voltaje": 220,                      // Voltaje alimentación (V)
  "corriente": 0.68,                   // Corriente consumida (A)
  "energia_acumulada": 25.5,           // Energía acumulada (kWh)
  
  // === CAMPOS COMUNES ===
  "rssi": -68,                         // Intensidad señal WiFi
  "firmware_version": "1.5.2",         // Versión firmware
  "timestamp": "2025-07-11T17:00:00Z"
}
```

**Payload Mínimo**:
```json
{
  "device_id": "bomba_agua_01",
  "device_type": "water_pump",
  "estado": true
}
```

---

### 2. Ventilador (fan)

**Tópico MQTT Control**: `Invernadero/[DEVICE_ID]/sw`  
**Tópico MQTT Status**: `Invernadero/[DEVICE_ID]/status`

**Payload Estándar**:
```json
{
  // === IDENTIFICACIÓN ===
  "device_id": "ventilador_01",        // ID único del dispositivo
  "device_type": "fan",                // Tipo de dispositivo
  
  // === CONTROL PRINCIPAL ===
  "estado": true,                      // Estado ventilador (true/false)
  "modo": "auto",                      // Modo: auto/manual/timer
  "velocidad": 75,                     // Velocidad (0-100%)
  "direccion": "forward",              // Dirección: forward/reverse
  "oscilacion": false,                 // Oscilación activa
  "rpm": 1450,                         // RPM actuales
  
  // === CONTROL DE TEMPERATURA ===
  "temperatura_objetivo": 25.0,        // Temperatura objetivo (°C)
  "temperatura_actual": 26.5,          // Temperatura actual (°C)
  "histeresis": 1.0,                   // Histéresis (°C)
  "modo_termostato": true,             // Modo termostato
  
  // === PROGRAMACIÓN ===
  "temporizador_activo": false,        // Temporizador activo
  "tiempo_restante": 0,                // Tiempo restante (segundos)
  "horario_programado": "06:00-20:00", // Horario funcionamiento
  
  // === SEGURIDAD ===
  "sobrecarga": false,                 // Detección sobrecarga
  "temperatura_motor": 42.1,           // Temperatura motor (°C)
  "vibracion": 0.3,                    // Nivel vibración (g)
  "filtro_obstruido": false,           // Filtro obstruido
  
  // === CONSUMO ENERGÉTICO ===
  "consumo": 85,                       // Consumo eléctrico (W)
  "voltaje": 220,                      // Voltaje alimentación (V)
  "corriente": 0.39,                   // Corriente consumida (A)
  "energia_acumulada": 15.2,           // Energía acumulada (kWh)
  
  // === CAMPOS COMUNES ===
  "rssi": -71,                         // Intensidad señal WiFi
  "firmware_version": "1.3.1",         // Versión firmware
  "timestamp": "2025-07-11T17:00:00Z"
}
```

**Payload Mínimo**:
```json
{
  "device_id": "ventilador_01",
  "device_type": "fan",
  "estado": true,
  "velocidad": 75
}
```

---

### 3. Calefactor (heater)

**Tópico MQTT Control**: `Invernadero/[DEVICE_ID]/sw`  
**Tópico MQTT Status**: `Invernadero/[DEVICE_ID]/status`

**Payload Estándar**:
```json
{
  // === IDENTIFICACIÓN ===
  "device_id": "calefactor_01",        // ID único del dispositivo
  "device_type": "heater",             // Tipo de dispositivo
  
  // === CONTROL PRINCIPAL ===
  "estado": true,                      // Estado calefactor (true/false)
  "modo": "auto",                      // Modo: auto/manual/timer
  "potencia": 80,                      // Potencia (0-100%)
  "temperatura_objetivo": 22.0,        // Temperatura objetivo (°C)
  "temperatura_actual": 20.5,          // Temperatura actual (°C)
  
  // === CONTROL DE TEMPERATURA ===
  "sensor_temperatura": 20.5,          // Lectura sensor temp (°C)
  "temperatura_elemento": 45.2,        // Temperatura elemento (°C)
  "control_pid": true,                 // Control PID activo
  "pid_kp": 2.0,                       // Parámetro PID Kp
  "pid_ki": 0.5,                       // Parámetro PID Ki
  "pid_kd": 0.1,                       // Parámetro PID Kd
  
  // === PROGRAMACIÓN ===
  "horario_nocturno": "20:00-06:00",   // Horario funcionamiento
  "temperatura_dia": 25.0,             // Temperatura diurna (°C)
  "temperatura_noche": 18.0,           // Temperatura nocturna (°C)
  "modo_estacional": "invierno",       // Modo estacional
  
  // === SEGURIDAD ===
  "sobrecalentamiento": false,         // Protección sobrecalentamiento
  "sensor_incendio": false,            // Sensor humo/incendio
  "ventilacion_forzada": false,        // Ventilación forzada
  "temperatura_maxima": 35.0,          // Temperatura máxima (°C)
  
  // === CONSUMO ENERGÉTICO ===
  "consumo": 800,                      // Consumo eléctrico (W)
  "voltaje": 220,                      // Voltaje alimentación (V)
  "corriente": 3.64,                   // Corriente consumida (A)
  "energia_acumulada": 125.8,          // Energía acumulada (kWh)
  
  // === CAMPOS COMUNES ===
  "rssi": -63,                         // Intensidad señal WiFi
  "firmware_version": "1.4.0",         // Versión firmware
  "timestamp": "2025-07-11T17:00:00Z"
}
```

**Payload Mínimo**:
```json
{
  "device_id": "calefactor_01",
  "device_type": "heater",
  "estado": true,
  "potencia": 80,
  "temperatura_objetivo": 22.0
}
```

---

### 4. Calentador de Agua (water_heater)

**Tópico MQTT Control**: `Invernadero/[DEVICE_ID]/sw`  
**Tópico MQTT Status**: `Invernadero/[DEVICE_ID]/status`

**Payload Estándar**:
```json
{
  // === IDENTIFICACIÓN ===
  "device_id": "calefactor_agua_01",   // ID único del dispositivo
  "device_type": "water_heater",       // Tipo de dispositivo
  
  // === CONTROL PRINCIPAL ===
  "estado": true,                      // Estado calefactor (true/false)
  "modo": "auto",                      // Modo: auto/manual/timer
  "potencia": 70,                      // Potencia (0-100%)
  "temperatura_objetivo": 25.0,        // Temperatura objetivo agua (°C)
  "temperatura_agua": 23.5,            // Temperatura actual agua (°C)
  
  // === CONTROL DE AGUA ===
  "sensor_agua": 23.5,                 // Lectura sensor agua (°C)
  "flujo_agua": 2.5,                   // Flujo agua (L/min)
  "presion_agua": 1.8,                 // Presión agua (bar)
  "nivel_tanque": 75,                  // Nivel tanque (%)
  "bomba_circulacion": true,           // Bomba circulación activa
  
  // === PROGRAMACIÓN ===
  "horario_calentamiento": "06:00-22:00", // Horario funcionamiento
  "temperatura_minima": 18.0,          // Temperatura mínima (°C)
  "temperatura_maxima": 30.0,          // Temperatura máxima (°C)
  "modo_ahorro": false,                // Modo ahorro energético
  
  // === SEGURIDAD ===
  "sobrecalentamiento": false,         // Protección sobrecalentamiento
  "sensor_escape": false,              // Sensor escape agua
  "presion_excesiva": false,           // Presión excesiva
  "valvula_alivio": false,             // Válvula alivio activa
  
  // === CONSUMO ENERGÉTICO ===
  "consumo": 1200,                     // Consumo eléctrico (W)
  "voltaje": 220,                      // Voltaje alimentación (V)
  "corriente": 5.45,                   // Corriente consumida (A)
  "energia_acumulada": 89.2,           // Energía acumulada (kWh)
  
  // === CAMPOS COMUNES ===
  "rssi": -59,                         // Intensidad señal WiFi
  "firmware_version": "1.2.8",         // Versión firmware
  "timestamp": "2025-07-11T17:00:00Z"
}
```

**Payload Mínimo**:
```json
{
  "device_id": "calefactor_agua_01",
  "device_type": "water_heater",
  "estado": true,
  "temperatura_objetivo": 25.0
}
```

---

### 5. Luz LED de Crecimiento (led_light)

**Tópico MQTT Control**: `Invernadero/[DEVICE_ID]/sw`  
**Tópico MQTT Status**: `Invernadero/[DEVICE_ID]/status`

**Payload Estándar**:
```json
{
  // === IDENTIFICACIÓN ===
  "device_id": "led_grow_01",          // ID único del dispositivo
  "device_type": "led_light",          // Tipo de dispositivo
  
  // === CONTROL PRINCIPAL ===
  "estado": true,                      // Estado lámpara (true/false)
  "modo": "auto",                      // Modo: auto/manual/timer
  "intensidad": 85,                    // Intensidad luz (0-100%)
  "espectro": "full",                  // Espectro: full/blue/red/mixed
  "dimmer": 85,                        // Nivel dimmer (0-100%)
  
  // === CONTROL DE ESPECTRO ===
  "led_azul": 90,                      // Intensidad LED azul (0-100%)
  "led_rojo": 80,                      // Intensidad LED rojo (0-100%)
  "led_blanco": 85,                    // Intensidad LED blanco (0-100%)
  "led_verde": 60,                     // Intensidad LED verde (0-100%)
  "led_uv": 30,                        // Intensidad LED UV (0-100%)
  "led_ir": 40,                        // Intensidad LED IR (0-100%)
  
  // === PROGRAMACIÓN ===
  "horario_dia": "06:00-20:00",        // Horario día
  "horario_noche": "20:00-06:00",      // Horario noche
  "intensidad_dia": 100,               // Intensidad diurna (%)
  "intensidad_noche": 20,              // Intensidad nocturna (%)
  "fotoperiodo": 14,                   // Horas luz/día
  
  // === SENSORES ===
  "sensor_luz": 45000,                 // Sensor luz ambiente (lux)
  "temperatura_led": 38.5,             // Temperatura LEDs (°C)
  "humedad_ambiente": 55,              // Humedad ambiente (%)
  "ppfd": 850,                         // PPFD (μmol/m²/s)
  
  // === SEGURIDAD ===
  "sobrecalentamiento": false,         // Protección sobrecalentamiento
  "ventilacion_activa": true,          // Ventilación activa
  "led_fallidos": 0,                   // Número LEDs fallidos
  "corriente_excesiva": false,         // Corriente excesiva
  
  // === CONSUMO ENERGÉTICO ===
  "consumo": 180,                      // Consumo eléctrico (W)
  "voltaje": 220,                      // Voltaje alimentación (V)
  "corriente": 0.82,                   // Corriente consumida (A)
  "energia_acumulada": 45.6,           // Energía acumulada (kWh)
  "eficiencia_luminosa": 2.8,          // Eficiencia (μmol/J)
  
  // === CAMPOS COMUNES ===
  "rssi": -55,                         // Intensidad señal WiFi
  "firmware_version": "1.6.2",         // Versión firmware
  "timestamp": "2025-07-11T17:00:00Z"
}
```

**Payload Mínimo**:
```json
{
  "device_id": "led_grow_01",
  "device_type": "led_light",
  "estado": true,
  "intensidad": 85,
  "espectro": "full"
}
```

---

### 6. Válvula (valve)

**Tópico MQTT Control**: `Invernadero/[DEVICE_ID]/sw`  
**Tópico MQTT Status**: `Invernadero/[DEVICE_ID]/status`

**Payload Estándar**:
```json
{
  // === IDENTIFICACIÓN ===
  "device_id": "valvula_01",           // ID único del dispositivo
  "device_type": "valve",              // Tipo de dispositivo
  
  // === CONTROL PRINCIPAL ===
  "estado": true,                      // Estado válvula (true/false)
  "modo": "auto",                      // Modo: auto/manual/timer
  "apertura": 100,                     // Apertura (0-100%)
  "direccion": "entrada",              // Dirección: entrada/salida
  
  // === CONTROL DE FLUJO ===
  "flujo_actual": 8.5,                 // Flujo actual (L/min)
  "flujo_objetivo": 10.0,              // Flujo objetivo (L/min)
  "presion_entrada": 2.1,              // Presión entrada (bar)
  "presion_salida": 1.8,               // Presión salida (bar)
  
  // === PROGRAMACIÓN ===
  "temporizador_activo": false,        // Temporizador activo
  "tiempo_apertura": 30,               // Tiempo apertura (segundos)
  "tiempo_cierre": 5,                  // Tiempo cierre (segundos)
  
  // === SEGURIDAD ===
  "sobrepresion": false,               // Protección sobrepresión
  "flujo_bloqueado": false,            // Flujo bloqueado
  "posicion_confirmada": true,         // Posición confirmada
  
  // === CAMPOS COMUNES ===
  "rssi": -62,                         // Intensidad señal WiFi
  "firmware_version": "1.1.5",         // Versión firmware
  "timestamp": "2025-07-11T17:00:00Z"
}
```

**Payload Mínimo**:
```json
{
  "device_id": "valvula_01",
  "device_type": "valve",
  "estado": true,
  "apertura": 100
}
```

---

## Campos Comunes

### Campos Obligatorios para Dispositivos
```json
{
  "device_id": "string",      // ID único del dispositivo
  "device_type": "string",    // Tipo de dispositivo
  "estado": boolean           // Estado principal del dispositivo
}
```

### Campos Obligatorios para Sensores
```json
{
  // Al menos un campo de medición según el tipo de sensor
  "temperatura": number,      // Para sensores de temperatura
  "humedad": number,         // Para sensores de humedad
  "ph": number,              // Para sensores de pH
  "light": number,           // Para sensores de luz
  "presion": number,         // Para sensores de presión
  "watts": number            // Para sensores de potencia
}
```

### Campos Opcionales Comunes
```json
{
  "rssi": number,                    // Intensidad señal WiFi (dBm)
  "boot": number,                    // Contador de reinicios
  "mem": number,                     // Memoria libre (bytes)
  "firmware_version": "string",      // Versión del firmware
  "timestamp": "ISO 8601 string",    // Timestamp del mensaje
  "location": "string",              // Ubicación del dispositivo
  "battery": number,                 // Nivel de batería (0-100%)
  "uptime": number                   // Tiempo de funcionamiento (segundos)
}
```

---

## Ejemplos de Implementación

### Ejemplo 1: Bomba de Agua Básica
```json
{
  "device_id": "bomba_principal",
  "device_type": "water_pump",
  "estado": true,
  "modo": "manual",
  "intensidad": 100,
  "timestamp": "2025-07-11T17:00:00Z"
}
```

### Ejemplo 2: Sensor de Temperatura Completo
```json
{
  "temperatura": 25.5,
  "humedad": 60.2,
  "heatindex": 26.8,
  "dewpoint": 17.3,
  "rssi": -65,
  "boot": 12,
  "mem": 18432,
  "timestamp": "2025-07-11T17:00:00Z",
  "stats": {
    "tmin": 18.2,
    "tmax": 28.9,
    "tavg": 25.1,
    "hmin": 45.0,
    "hmax": 78.5,
    "havg": 62.3,
    "total": 1440,
    "errors": 0
  }
}
```

### Ejemplo 3: LED de Crecimiento Avanzado
```json
{
  "device_id": "led_crecimiento_principal",
  "device_type": "led_light",
  "estado": true,
  "modo": "auto",
  "intensidad": 90,
  "espectro": "full",
  "led_azul": 95,
  "led_rojo": 85,
  "led_blanco": 90,
  "horario_dia": "06:00-20:00",
  "fotoperiodo": 14,
  "temperatura_led": 42.3,
  "consumo": 165,
  "timestamp": "2025-07-11T17:00:00Z"
}
```

---

## Retrocompatibilidad

El sistema mantiene compatibilidad con payloads legacy:

### Payloads Legacy Soportados
```json
// Bomba (legacy)
{"bombaSw": true}

// Ventilador (legacy)
{"ventiladorSw": true}

// Calefactor (legacy)
{"calefactorSw": true}

// Calefactor de Agua (legacy)
{"calefactorAguaSw": true}
```

### Mapeo Automático
El sistema automáticamente convierte:
- `bombaSw` → `estado`
- `ventiladorSw` → `estado`
- `calefactorSw` → `estado`
- `calefactorAguaSw` → `estado`
- `pH` → `ph`
- `Temp` → `temperatura`
- `Voltage` → `voltage`

---

## Validación y Errores

### Errores Comunes
1. **Campos obligatorios faltantes**: El sistema rechazará payloads sin campos obligatorios
2. **Tipos de datos incorrectos**: Los valores deben ser del tipo correcto (number, boolean, string)
3. **Valores fuera de rango**: Algunos campos tienen rangos válidos (ej: 0-100 para porcentajes)

### Mensajes de Error
```json
{
  "error": "Validation failed",
  "details": [
    "Campo requerido faltante: device_id",
    "Campo requerido faltante: device_type",
    "Valor fuera de rango: intensidad debe estar entre 0-100"
  ]
}
```

---

## Notas de Implementación

1. **Timestamps**: Usar formato ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)
2. **Unidades**: Especificar siempre las unidades en comentarios
3. **Rangos**: Validar rangos de valores según el tipo de sensor/dispositivo
4. **Frecuencia**: Enviar datos cada 30 segundos para sensores, inmediatamente para dispositivos
5. **Tamaño**: Mantener payloads bajo 1KB para mejor rendimiento

---

*Última actualización: 2025-07-11*
*Versión del sistema: 1.0.0*