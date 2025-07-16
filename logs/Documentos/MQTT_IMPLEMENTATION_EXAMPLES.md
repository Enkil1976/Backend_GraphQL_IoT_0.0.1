# Ejemplos de Implementación MQTT - Sistema IoT Invernadero

## Tabla de Contenidos
1. [Configuración del Cliente MQTT](#configuración-del-cliente-mqtt)
2. [Ejemplos de Código](#ejemplos-de-código)
3. [Casos de Uso Comunes](#casos-de-uso-comunes)
4. [Migración desde Payloads Legacy](#migración-desde-payloads-legacy)
5. [Testing y Debugging](#testing-y-debugging)

---

## Configuración del Cliente MQTT

### Configuración Básica
```javascript
const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://localhost:1883', {
  clientId: 'invernadero_device_01',
  username: 'your_username',
  password: 'your_password',
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000
});

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker');
});
```

### Configuración Arduino/ESP32
```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "YOUR_MQTT_SERVER";
const int mqtt_port = 1883;
const char* mqtt_user = "your_username";
const char* mqtt_password = "your_password";

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void setup_wifi() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected");
}
```

---

## Ejemplos de Código

### 1. Sensor de Temperatura y Humedad (DHT22)

**Arduino/ESP32**:
```cpp
#include <DHT.h>

#define DHT_PIN 2
#define DHT_TYPE DHT22

DHT dht(DHT_PIN, DHT_TYPE);

void publishTemHumData() {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  
  if (isnan(temp) || isnan(hum)) {
    Serial.println("Error reading DHT sensor");
    return;
  }
  
  // Crear payload JSON
  StaticJsonDocument<500> doc;
  doc["temperatura"] = round(temp * 100.0) / 100.0;
  doc["humedad"] = round(hum * 100.0) / 100.0;
  doc["heatindex"] = dht.computeHeatIndex(temp, hum, false);
  doc["dewpoint"] = temp - ((100 - hum) / 5.0);
  doc["rssi"] = WiFi.RSSI();
  doc["boot"] = ESP.getResetReason();
  doc["mem"] = ESP.getFreeHeap();
  doc["timestamp"] = getISOTimestamp();
  
  // Estadísticas (opcional)
  JsonObject stats = doc.createNestedObject("stats");
  stats["tmin"] = temp_min;
  stats["tmax"] = temp_max;
  stats["tavg"] = temp_avg;
  stats["hmin"] = hum_min;
  stats["hmax"] = hum_max;
  stats["havg"] = hum_avg;
  stats["total"] = reading_count;
  stats["errors"] = error_count;
  
  String payload;
  serializeJson(doc, payload);
  
  // Publicar en MQTT
  client.publish("Invernadero/TemHum1/data", payload.c_str());
  Serial.println("✅ Temperature/Humidity data published");
}
```

**Node.js**:
```javascript
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

function publishTemHumData() {
  const payload = {
    temperatura: 25.5,
    humedad: 60.2,
    heatindex: 26.8,
    dewpoint: 17.3,
    rssi: -65,
    boot: 12,
    mem: 18432,
    timestamp: new Date().toISOString(),
    stats: {
      tmin: 18.2,
      tmax: 28.9,
      tavg: 25.1,
      hmin: 45.0,
      hmax: 78.5,
      havg: 62.3,
      total: 1440,
      errors: 0
    }
  };
  
  client.publish('Invernadero/TemHum1/data', JSON.stringify(payload));
  console.log('✅ Temperature/Humidity data published');
}

// Publicar cada 30 segundos
setInterval(publishTemHumData, 30000);
```

### 2. Bomba de Agua con Doble ID

**Arduino/ESP32**:
```cpp
void publishPumpControl(bool estado, String modo = "manual", int intensidad = 100) {
  StaticJsonDocument<800> doc;
  
  // IDs del dispositivo
  doc["device_id"] = "bomba_agua_01";
  doc["device_type"] = "water_pump";
  
  // Control principal
  doc["estado"] = estado;
  doc["modo"] = modo;
  doc["intensidad"] = intensidad;
  
  // Parámetros operativos
  doc["presion"] = readPressureSensor();
  doc["caudal"] = readFlowSensor();
  doc["horas_operacion"] = getOperationHours();
  
  // Seguridad
  doc["proteccion_seca"] = checkDryRunProtection();
  doc["sobrecarga"] = checkOverloadProtection();
  doc["temperatura_motor"] = readMotorTemperature();
  
  // Consumo energético
  doc["consumo"] = readPowerConsumption();
  doc["voltaje"] = readVoltage();
  doc["corriente"] = readCurrent();
  
  // Campos comunes
  doc["rssi"] = WiFi.RSSI();
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["timestamp"] = getISOTimestamp();
  
  String payload;
  serializeJson(doc, payload);
  
  // Publicar control
  client.publish("Invernadero/bomba_agua_01/sw", payload.c_str());
  
  // Publicar estado (opcional)
  client.publish("Invernadero/bomba_agua_01/status", payload.c_str());
  
  Serial.println("✅ Pump control published");
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  // Procesar comandos recibidos
  if (String(topic) == "Invernadero/bomba_agua_01/command") {
    StaticJsonDocument<200> doc;
    deserializeJson(doc, message);
    
    bool estado = doc["estado"];
    String modo = doc["modo"];
    int intensidad = doc["intensidad"];
    
    // Aplicar control
    controlPump(estado, modo, intensidad);
    
    // Responder con estado actual
    publishPumpControl(estado, modo, intensidad);
  }
}
```

**Node.js**:
```javascript
function publishPumpControl(estado, modo = 'manual', intensidad = 100) {
  const payload = {
    device_id: 'bomba_agua_01',
    device_type: 'water_pump',
    estado: estado,
    modo: modo,
    intensidad: intensidad,
    presion: 2.5,
    caudal: 15.2,
    horas_operacion: 1250,
    proteccion_seca: false,
    sobrecarga: false,
    temperatura_motor: 45.2,
    consumo: 150,
    voltaje: 220,
    corriente: 0.68,
    rssi: -68,
    firmware_version: '1.5.2',
    timestamp: new Date().toISOString()
  };
  
  client.publish('Invernadero/bomba_agua_01/sw', JSON.stringify(payload));
  console.log('✅ Pump control published');
}

// Suscribirse a comandos
client.subscribe('Invernadero/bomba_agua_01/command');

client.on('message', (topic, message) => {
  if (topic === 'Invernadero/bomba_agua_01/command') {
    const command = JSON.parse(message.toString());
    
    // Aplicar comando
    controlPump(command.estado, command.modo, command.intensidad);
    
    // Responder con estado actual
    publishPumpControl(command.estado, command.modo, command.intensidad);
  }
});
```

### 3. LED de Crecimiento Avanzado

**Arduino/ESP32**:
```cpp
void publishLEDControl() {
  StaticJsonDocument<1000> doc;
  
  // IDs del dispositivo
  doc["device_id"] = "led_crecimiento_01";
  doc["device_type"] = "led_light";
  
  // Control principal
  doc["estado"] = led_estado;
  doc["modo"] = led_modo;
  doc["intensidad"] = led_intensidad;
  doc["espectro"] = led_espectro;
  
  // Control de espectro
  doc["led_azul"] = led_azul_intensity;
  doc["led_rojo"] = led_rojo_intensity;
  doc["led_blanco"] = led_blanco_intensity;
  doc["led_verde"] = led_verde_intensity;
  doc["led_uv"] = led_uv_intensity;
  doc["led_ir"] = led_ir_intensity;
  
  // Programación
  doc["horario_dia"] = "06:00-20:00";
  doc["horario_noche"] = "20:00-06:00";
  doc["intensidad_dia"] = 100;
  doc["intensidad_noche"] = 20;
  doc["fotoperiodo"] = 14;
  
  // Sensores
  doc["sensor_luz"] = readLightSensor();
  doc["temperatura_led"] = readLEDTemperature();
  doc["humedad_ambiente"] = readHumidity();
  doc["ppfd"] = calculatePPFD();
  
  // Seguridad
  doc["sobrecalentamiento"] = checkOverheating();
  doc["ventilacion_activa"] = fan_active;
  doc["led_fallidos"] = failed_leds_count;
  
  // Consumo energético
  doc["consumo"] = readPowerConsumption();
  doc["voltaje"] = readVoltage();
  doc["corriente"] = readCurrent();
  doc["eficiencia_luminosa"] = calculateLuminousEfficacy();
  
  // Campos comunes
  doc["rssi"] = WiFi.RSSI();
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["timestamp"] = getISOTimestamp();
  
  String payload;
  serializeJson(doc, payload);
  
  client.publish("Invernadero/led_crecimiento_01/sw", payload.c_str());
  Serial.println("✅ LED control published");
}
```

---

## Casos de Uso Comunes

### 1. Ciclo Automático de Riego

**Controlador Principal**:
```javascript
const riegoCiclos = {
  programacion: [
    { inicio: "06:00", duracion: 15 }, // 6:00 AM - 15 minutos
    { inicio: "12:00", duracion: 20 }, // 12:00 PM - 20 minutos
    { inicio: "18:00", duracion: 15 }  // 6:00 PM - 15 minutos
  ]
};

function iniciarRiego(duracion) {
  const comando = {
    device_id: "bomba_agua_01",
    device_type: "water_pump",
    estado: true,
    modo: "auto",
    intensidad: 100,
    duracion_programada: duracion * 60, // segundos
    timestamp: new Date().toISOString()
  };
  
  client.publish('Invernadero/bomba_agua_01/command', JSON.stringify(comando));
  
  // Programar apagado automático
  setTimeout(() => {
    detenerRiego();
  }, duracion * 60 * 1000);
}

function detenerRiego() {
  const comando = {
    device_id: "bomba_agua_01",
    device_type: "water_pump",
    estado: false,
    modo: "auto",
    timestamp: new Date().toISOString()
  };
  
  client.publish('Invernadero/bomba_agua_01/command', JSON.stringify(comando));
}
```

### 2. Control de Clima Automático

**Sistema de Ventilación**:
```javascript
function controlClima(temperatura, humedad) {
  const TEMP_MAX = 28.0;
  const TEMP_MIN = 18.0;
  const HUM_MAX = 75.0;
  const HUM_MIN = 50.0;
  
  let ventilador_estado = false;
  let ventilador_velocidad = 0;
  let calefactor_estado = false;
  let calefactor_potencia = 0;
  
  // Lógica de control
  if (temperatura > TEMP_MAX || humedad > HUM_MAX) {
    ventilador_estado = true;
    ventilador_velocidad = Math.min(100, (temperatura - TEMP_MAX) * 20 + 40);
  }
  
  if (temperatura < TEMP_MIN) {
    calefactor_estado = true;
    calefactor_potencia = Math.min(100, (TEMP_MIN - temperatura) * 15 + 30);
  }
  
  // Comando ventilador
  const comandoVentilador = {
    device_id: "ventilador_01",
    device_type: "fan",
    estado: ventilador_estado,
    velocidad: ventilador_velocidad,
    temperatura_objetivo: (TEMP_MAX + TEMP_MIN) / 2,
    modo: "auto",
    timestamp: new Date().toISOString()
  };
  
  // Comando calefactor
  const comandoCalefactor = {
    device_id: "calefactor_01",
    device_type: "heater",
    estado: calefactor_estado,
    potencia: calefactor_potencia,
    temperatura_objetivo: (TEMP_MAX + TEMP_MIN) / 2,
    modo: "auto",
    timestamp: new Date().toISOString()
  };
  
  client.publish('Invernadero/ventilador_01/command', JSON.stringify(comandoVentilador));
  client.publish('Invernadero/calefactor_01/command', JSON.stringify(comandoCalefactor));
}
```

### 3. Fotoperiodo Automático para LEDs

**Control de Iluminación**:
```javascript
function controlFotoperiodo() {
  const ahora = new Date();
  const hora = ahora.getHours();
  const minuto = ahora.getMinutes();
  const tiempoActual = hora * 60 + minuto; // minutos desde medianoche
  
  const INICIO_DIA = 6 * 60;  // 6:00 AM
  const FIN_DIA = 20 * 60;    // 8:00 PM
  
  let intensidad = 0;
  let espectro = "off";
  
  if (tiempoActual >= INICIO_DIA && tiempoActual < FIN_DIA) {
    // Periodo diurno
    intensidad = 100;
    espectro = "full";
    
    // Simulación de amanecer/atardecer
    const duracionDia = FIN_DIA - INICIO_DIA;
    const tiempoEnDia = tiempoActual - INICIO_DIA;
    
    if (tiempoEnDia < 60) {
      // Primera hora: amanecer gradual
      intensidad = Math.floor((tiempoEnDia / 60) * 100);
    } else if (tiempoEnDia > duracionDia - 60) {
      // Última hora: atardecer gradual
      intensidad = Math.floor(((duracionDia - tiempoEnDia) / 60) * 100);
    }
  }
  
  const comando = {
    device_id: "led_crecimiento_01",
    device_type: "led_light",
    estado: intensidad > 0,
    intensidad: intensidad,
    espectro: espectro,
    modo: "auto",
    horario_dia: "06:00-20:00",
    fotoperiodo: 14,
    timestamp: new Date().toISOString()
  };
  
  client.publish('Invernadero/led_crecimiento_01/command', JSON.stringify(comando));
}

// Ejecutar cada minuto
setInterval(controlFotoperiodo, 60000);
```

---

## Migración desde Payloads Legacy

### Script de Migración

```javascript
// Mapeo de dispositivos legacy a nuevos IDs
const deviceMapping = {
  'Invernadero/Bomba/sw': {
    device_id: 'bomba_agua_01',
    device_type: 'water_pump'
  },
  'Invernadero/Ventilador/sw': {
    device_id: 'ventilador_01',
    device_type: 'fan'
  },
  'Invernadero/Calefactor/sw': {
    device_id: 'calefactor_01',
    device_type: 'heater'
  },
  'Invernadero/CalefactorAgua/sw': {
    device_id: 'calefactor_agua_01',
    device_type: 'water_heater'
  }
};

// Convertir payload legacy a nuevo formato
function convertLegacyPayload(topic, legacyPayload) {
  const mapping = deviceMapping[topic];
  if (!mapping) {
    return legacyPayload; // Sin conversión
  }
  
  const newPayload = {
    device_id: mapping.device_id,
    device_type: mapping.device_type,
    timestamp: new Date().toISOString()
  };
  
  // Mapear campos legacy
  const fieldMapping = {
    'bombaSw': 'estado',
    'ventiladorSw': 'estado',
    'calefactorSw': 'estado',
    'calefactorAguaSw': 'estado'
  };
  
  for (const [legacyField, newField] of Object.entries(fieldMapping)) {
    if (legacyPayload.hasOwnProperty(legacyField)) {
      newPayload[newField] = legacyPayload[legacyField];
    }
  }
  
  return newPayload;
}

// Publicar tanto legacy como nuevo formato durante migración
function publishDualFormat(topic, legacyPayload) {
  // Publicar formato legacy
  client.publish(topic, JSON.stringify(legacyPayload));
  
  // Publicar formato nuevo
  const newPayload = convertLegacyPayload(topic, legacyPayload);
  const newTopic = topic.replace(/\/sw$/, '/command');
  client.publish(newTopic, JSON.stringify(newPayload));
}
```

### Validación de Migración

```javascript
// Validar que ambos formatos funcionen
function validateMigration() {
  const testCases = [
    {
      topic: 'Invernadero/Bomba/sw',
      legacy: { bombaSw: true },
      expected: {
        device_id: 'bomba_agua_01',
        device_type: 'water_pump',
        estado: true
      }
    },
    {
      topic: 'Invernadero/Ventilador/sw',
      legacy: { ventiladorSw: false },
      expected: {
        device_id: 'ventilador_01',
        device_type: 'fan',
        estado: false
      }
    }
  ];
  
  testCases.forEach(test => {
    const converted = convertLegacyPayload(test.topic, test.legacy);
    
    console.log(`Testing ${test.topic}:`);
    console.log(`  Legacy: ${JSON.stringify(test.legacy)}`);
    console.log(`  Converted: ${JSON.stringify(converted)}`);
    console.log(`  Valid: ${JSON.stringify(converted).includes(JSON.stringify(test.expected))}`);
  });
}
```

---

## Testing y Debugging

### Cliente de Pruebas MQTT

```javascript
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

// Suscribirse a todos los tópicos del invernadero
client.subscribe('Invernadero/+/+');

client.on('message', (topic, message) => {
  const timestamp = new Date().toISOString();
  const payload = message.toString();
  
  console.log(`[${timestamp}] 📡 ${topic}`);
  
  try {
    const parsed = JSON.parse(payload);
    console.log(`  📄 Payload:`, JSON.stringify(parsed, null, 2));
    
    // Validar estructura
    if (parsed.device_id && parsed.device_type) {
      console.log(`  ✅ Dual-ID format detected`);
      console.log(`  📋 Device ID: ${parsed.device_id}`);
      console.log(`  🏷️  Device Type: ${parsed.device_type}`);
    } else {
      console.log(`  ⚠️  Legacy format detected`);
    }
  } catch (error) {
    console.log(`  ❌ Invalid JSON: ${payload}`);
  }
  
  console.log('');
});

// Funciones de testing
function testSensorData() {
  const payload = {
    temperatura: 25.5,
    humedad: 60.2,
    heatindex: 26.8,
    rssi: -65,
    timestamp: new Date().toISOString()
  };
  
  client.publish('Invernadero/TemHum1/data', JSON.stringify(payload));
  console.log('✅ Test sensor data published');
}

function testDeviceControl() {
  const payload = {
    device_id: 'bomba_test_01',
    device_type: 'water_pump',
    estado: true,
    modo: 'test',
    intensidad: 50,
    timestamp: new Date().toISOString()
  };
  
  client.publish('Invernadero/bomba_test_01/sw', JSON.stringify(payload));
  console.log('✅ Test device control published');
}

function testLegacyDevice() {
  const payload = { bombaSw: true };
  
  client.publish('Invernadero/Bomba/sw', JSON.stringify(payload));
  console.log('✅ Test legacy device published');
}

// Ejecutar tests
client.on('connect', () => {
  console.log('🔗 Connected to MQTT broker');
  console.log('📡 Listening to all Invernadero topics...\n');
  
  // Ejecutar tests después de 2 segundos
  setTimeout(() => {
    testSensorData();
    testDeviceControl();
    testLegacyDevice();
  }, 2000);
});
```

### Herramientas de Debugging

**1. Monitor de Tráfico MQTT**:
```bash
# Usando mosquitto_sub para monitorear todos los mensajes
mosquitto_sub -h localhost -p 1883 -t "Invernadero/+/+" -v

# Monitorear un dispositivo específico
mosquitto_sub -h localhost -p 1883 -t "Invernadero/bomba_agua_01/+" -v
```

**2. Envío de Comandos de Prueba**:
```bash
# Comando para bomba
mosquitto_pub -h localhost -p 1883 -t "Invernadero/bomba_agua_01/command" -m '{"device_id":"bomba_agua_01","device_type":"water_pump","estado":true,"modo":"manual","intensidad":75}'

# Comando para ventilador
mosquitto_pub -h localhost -p 1883 -t "Invernadero/ventilador_01/command" -m '{"device_id":"ventilador_01","device_type":"fan","estado":true,"velocidad":50}'
```

**3. Validador de Payloads**:
```javascript
function validatePayload(payload, type) {
  const requiredFields = {
    sensor: ['timestamp'],
    device: ['device_id', 'device_type', 'estado', 'timestamp']
  };
  
  const required = requiredFields[type] || [];
  const missing = required.filter(field => !payload.hasOwnProperty(field));
  
  if (missing.length > 0) {
    console.log(`❌ Missing required fields: ${missing.join(', ')}`);
    return false;
  }
  
  console.log(`✅ Payload valid for ${type}`);
  return true;
}
```

---

## Mejores Prácticas

### 1. Gestión de Errores
```javascript
function publishWithRetry(topic, payload, maxRetries = 3) {
  let retries = 0;
  
  function attempt() {
    client.publish(topic, JSON.stringify(payload), (error) => {
      if (error) {
        retries++;
        if (retries < maxRetries) {
          console.log(`❌ Publish failed, retrying... (${retries}/${maxRetries})`);
          setTimeout(attempt, 1000 * retries);
        } else {
          console.log(`❌ Publish failed after ${maxRetries} attempts`);
        }
      } else {
        console.log(`✅ Published successfully to ${topic}`);
      }
    });
  }
  
  attempt();
}
```

### 2. Validación de Datos
```javascript
function validateSensorData(data) {
  const rules = {
    temperatura: { min: -40, max: 80 },
    humedad: { min: 0, max: 100 },
    ph: { min: 0, max: 14 },
    presion: { min: 80000, max: 120000 }
  };
  
  for (const [field, value] of Object.entries(data)) {
    if (rules[field]) {
      const { min, max } = rules[field];
      if (value < min || value > max) {
        console.log(`⚠️ Warning: ${field} value ${value} is out of range (${min}-${max})`);
      }
    }
  }
}
```

### 3. Optimización de Ancho de Banda
```javascript
function optimizePayload(payload) {
  // Remover campos nulos o indefinidos
  const optimized = {};
  
  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && value !== undefined) {
      // Redondear números flotantes
      if (typeof value === 'number') {
        optimized[key] = Math.round(value * 100) / 100;
      } else {
        optimized[key] = value;
      }
    }
  }
  
  return optimized;
}
```

---

*Última actualización: 2025-07-11*
*Versión del sistema: 1.0.0*