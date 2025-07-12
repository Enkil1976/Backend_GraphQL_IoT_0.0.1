# 📋 SCHEMA GRAPHQL EN PRODUCCIÓN - Documentado

**URL**: `https://postgres-bakend.2h4eh9.easypanel.host/graphql`

## 🔐 **Autenticación**

### **Login**
```graphql
mutation {
  login(username: "admin", password: "admin123") {
    token
    user {
      id
      username
      email
      role
    }
  }
}
```

---

## 📊 **Estructura de Sensores**

### **Campos de Sensor (Query)**
```graphql
type Sensor {
  id: String!
  name: String!
  type: String!        # Tipo: TEMHUM, LIGHT, WATER_QUALITY, etc.
  hardwareId: String!  # ID único del hardware
  location: String!    # Ubicación física
}
```

### **Consultar Sensores**
```graphql
query {
  sensors {
    id
    name
    type
    hardwareId
    location
  }
}
```

### **Respuesta de sensores existentes:**
```json
{
  "data": {
    "sensors": [
      {
        "id": "6",
        "name": "TemHum1 Sensor Temperatura y Humedad",
        "type": "TEMHUM",
        "hardwareId": "temhum1",
        "location": "Invernadero Principal"
      },
      {
        "id": "5",
        "name": "TemHum2 Sensor Temperatura y Humedad", 
        "type": "TEMHUM",
        "hardwareId": "temhum2",
        "location": "Invernadero"
      },
      {
        "id": "4",
        "name": "Luxómetro - Sensor de Luz",
        "type": "LIGHT",
        "hardwareId": "luxometro",
        "location": "Invernadero"
      },
      {
        "id": "7",
        "name": "Sensor Calidad Agua Principal",
        "type": "WATER_QUALITY", 
        "hardwareId": "agua-quality-01",
        "location": "Sistema de Riego Principal"
      }
    ]
  }
}
```

---

## 🔧 **Crear Sensores**

### **CreateSensorInput (Requerido)**
```graphql
input CreateSensorInput {
  sensorId: String!     # ⚠️ REQUERIDO - ID único del sensor
  name: String!         # Nombre descriptivo
  hardwareId: String!   # ID del hardware físico
  type: String!         # Tipo de sensor
  location: String!     # Ubicación física
}
```

### **Mutation para crear sensor**
```graphql
mutation {
  createSensor(input: {
    sensorId: "agua-quality-01"           # ⚠️ REQUERIDO
    name: "Sensor Calidad Agua Principal"
    hardwareId: "agua-quality-01"
    type: "WATER_QUALITY" 
    location: "Sistema de Riego Principal"
  }) {
    id
    name
    type
    hardwareId
    location
  }
}
```

### **Ejemplo de comando cURL**
```bash
# 1. Login
TOKEN=$(curl -s -X POST https://postgres-bakend.2h4eh9.easypanel.host/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"admin\", password: \"admin123\") { token } }"}' | \
  jq -r '.data.login.token')

# 2. Crear sensor
curl -X POST https://postgres-bakend.2h4eh9.easypanel.host/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation { 
      createSensor(input: { 
        sensorId: \"agua-quality-01\", 
        name: \"Sensor Calidad Agua Principal\", 
        hardwareId: \"agua-quality-01\", 
        type: \"WATER_QUALITY\", 
        location: \"Sistema de Riego Principal\" 
      }) { 
        id name type hardwareId location 
      } 
    }"
  }'
```

---

## 🔄 **Actualizar Sensores**

### **UpdateSensorInput**
```graphql
input UpdateSensorInput {
  name: String
  # ⚠️ NO incluye: mqttTopic, payloadFields
  # ⚠️ Incluye: customFields (sugerido por error)
  customFields: [String]  # Posiblemente para campos personalizados
}
```

### **Mutation para actualizar**
```graphql
mutation {
  updateSensor(id: "7", input: {
    name: "Nuevo Nombre del Sensor"
    customFields: ["ph", "ec", "ppm", "temp"]
  }) {
    id
    name
    type
    hardwareId
  }
}
```

---

## ⚠️ **Configuración MQTT - NO DISPONIBLE VIA GRAPHQL**

### **Problemas identificados:**
- ❌ `configureSensorMQTT` - Mutation no existe
- ❌ `configureDynamicSensor` - Mutation no existe
- ❌ `mqttTopic` - Campo no disponible en UpdateSensorInput
- ❌ `payloadFields` - Campo no disponible en UpdateSensorInput

### **Alternativas:**
1. **Configuración directa en base de datos** (recomendado)
2. **Configuración vía archivo de configuración**
3. **Usar `customFields` para indicar campos del payload**

---

## 🗃️ **Configuración Manual de MQTT (SQL)**

Dado que GraphQL no permite configurar MQTT directamente, usar SQL:

```sql
-- Actualizar configuración MQTT del sensor
UPDATE sensors 
SET configuration = jsonb_set(
  COALESCE(configuration, '{}'),
  '{mqtt_topic}',
  '"Invernadero/Agua/data"'
)
WHERE id = 7;

-- Agregar estructura del payload
UPDATE sensors 
SET configuration = jsonb_set(
  configuration,
  '{payload_fields}',
  '["ph", "ec", "ppm", "temp"]'
)
WHERE id = 7;

-- Agregar ejemplo de payload
UPDATE sensors 
SET configuration = jsonb_set(
  configuration,
  '{sample_payload}',
  '{"ph": 5, "ec": 1000, "ppm": 1000, "temp": 18}'
)
WHERE id = 7;
```

---

## 📊 **Tipos de Sensores Disponibles**

Basándome en los sensores existentes:

1. **TEMHUM** - Temperatura y Humedad
2. **LIGHT** - Sensor de Luz/Luxómetro  
3. **TEMP_PRESSURE** - Temperatura y Presión
4. **WATER_QUALITY** - Calidad del Agua (pH, EC, PPM, Temp)
5. **SYSTEM** - Sensores del sistema

---

## 🚨 **Limitaciones Identificadas**

### **GraphQL Schema**
- ✅ Introspección deshabilitada en producción (seguridad)
- ❌ No hay mutations para configurar MQTT
- ❌ No hay campos para tópicos MQTT en el schema
- ⚠️ `sensorId` es requerido pero no documentado

### **Configuración MQTT**
- ✅ Sensor creado exitosamente (ID: 7)
- ❌ Configuración MQTT debe hacerse manualmente
- ❌ No hay validación de tópicos MQTT via GraphQL

---

## 📝 **Próximos Pasos Recomendados**

1. **Configurar MQTT manualmente** en base de datos
2. **Actualizar código backend** para procesar `Invernadero/Agua/data`
3. **Probar recepción de datos** del payload: `{"ph": 5, "ec":1000, "ppm": 1000, "temp": 18}`
4. **Crear reglas de automatización** para calidad del agua

---

## ✅ **Estado Actual**

- ✅ **Sensor creado**: ID 7, hardwareId: "agua-quality-01"
- ✅ **Tipo configurado**: WATER_QUALITY
- ⏳ **Pendiente**: Configuración MQTT manual
- ⏳ **Pendiente**: Prueba de recepción de datos

---

**📅 Última actualización**: 2025-07-10  
**🔗 URL Producción**: https://postgres-bakend.2h4eh9.easypanel.host/graphql