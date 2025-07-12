# Guía del Sensor pH Profesional - Sistema IoT Invernadero

## 🌟 Características Principales

### ✅ **Portal Cautivo WiFi**
- **Red WiFi**: `invernaderoiot`
- **Contraseña**: `invernadero123`
- **IP del portal**: `192.168.4.1`
- Configuración automática cuando no hay WiFi configurado

### ✅ **Interfaz Web Profesional**
- Página de bienvenida con instrucciones claras
- Formulario de configuración WiFi y MQTT
- Monitor en tiempo real del sensor
- Panel de estado del sistema
- API REST para integración

### ✅ **Actualización OTA**
- Actualización de firmware sin cables
- Hostname: Configurable (por defecto: nombre del dispositivo)
- Contraseña OTA: `invernadero123`

### ✅ **Gestión Avanzada**
- Configuración persistente en EEPROM
- Botón de reset físico
- LEDs de estado (WiFi, Sistema)
- Validación de datos del sensor
- Estadísticas de funcionamiento

---

## 📋 Lista de Componentes Necesarios

### **Hardware Básico**
```
- ESP32-C3 o ESP32
- Sensor pH analógico (pin 1)
- Sensor NTC 10kΩ (pin 3)
- LED Verde (pin 2) - Estado del sistema
- LED Azul (pin 8) - Estado WiFi
- Pulsador (pin 9) - Reset de configuración
- Resistencia 10kΩ para NTC
- Resistencias 220Ω para LEDs
```

### **Conexiones**
```
ESP32-C3    Componente
--------    ----------
Pin 1   →   Sensor pH (analógico)
Pin 3   →   Sensor NTC + resistencia 10kΩ
Pin 2   →   LED Verde (+ resistencia 220Ω)
Pin 8   →   LED Azul (+ resistencia 220Ω)
Pin 9   →   Pulsador (pull-up interno)
GND     →   GND común
3.3V    →   VCC sensores y LEDs
```

---

## 🚀 Primera Configuración

### **Paso 1: Subir el Firmware**
1. Instalar las librerías necesarias en Arduino IDE:
   ```
   - WiFi (ESP32)
   - WebServer (ESP32)
   - DNSServer (ESP32)
   - PubSubClient
   - ArduinoJson
   - ArduinoOTA
   - EEPROM (ESP32)
   ```

2. Configurar Arduino IDE para ESP32-C3:
   - Board Manager: ESP32 Arduino Core
   - Board: "ESP32C3 Dev Module"
   - Partition Scheme: "Default 4MB with spiffs"

3. Subir el código `arduino_ph_sensor_professional.ino`

### **Paso 2: Primera Conexión**
1. **Al encender por primera vez**, el dispositivo creará un Access Point:
   - **SSID**: `invernaderoiot`
   - **Contraseña**: `invernadero123`

2. **Conectarse al WiFi del dispositivo** desde el teléfono/computadora

3. **Abrir el navegador** y ir a cualquier página (será redirigido automáticamente)
   - O acceder directamente a: `http://192.168.4.1`

### **Paso 3: Configuración Web**
1. **Página de Bienvenida** mostrará:
   - Explicación del dispositivo
   - Instrucciones de configuración
   - Información del sistema

2. **Hacer clic en "Configurar WiFi"** y completar:
   ```
   🌐 Red WiFi (SSID): [Su red WiFi]
   🔒 Contraseña WiFi: [Su contraseña]
   📱 Nombre del Dispositivo: Sensor pH 01
   
   📡 Configuración MQTT (pre-configurada):
   🖥️ Servidor MQTT: sdb201a6.ala.us-east-1.emqxsl.com
   🔌 Puerto MQTT: 8883
   👤 Usuario MQTT: Esp01-DTH22
   🔑 Contraseña MQTT: 11211121
   📮 Tópico MQTT: Invernadero/AguaPH/data
   
   🔧 Calibración del Sensor:
   ⚖️ Offset pH: 0.00
   🌡️ Offset Temperatura: 0.0
   ⏱️ Intervalo de Publicación: 30000 ms
   ```

3. **Hacer clic en "Guardar y Conectar"**
   - El dispositivo se reiniciará automáticamente
   - Se conectará a su red WiFi
   - Comenzará a enviar datos al servidor MQTT

---

## 📊 Uso Normal

### **Acceso al Panel Web**
Una vez configurado, acceder al dispositivo en su red WiFi:
```
http://[IP_DEL_DISPOSITIVO]
```

### **Funciones Disponibles**
1. **🏠 Página Principal**:
   - Estado del sistema en tiempo real
   - Datos actuales del sensor
   - Conexión WiFi y MQTT

2. **📝 Configuración**:
   - Modificar parámetros WiFi/MQTT
   - Calibrar sensores
   - Cambiar intervalos

3. **📊 Estado Detallado**:
   - Estadísticas completas
   - Información de memoria
   - Historial de errores

4. **🔄 Actualización OTA**:
   - Usar Arduino IDE: Tools → Port → Network → [Dispositivo]
   - O herramientas web OTA

### **Indicadores LED**
```
LED Verde (Sistema):
- Parpadeo lento (2 seg): Todo funcionando correctamente
- Parpadeo rápido (0.5 seg): Problemas de conectividad
- Parpadeo continuo: Modo configuración

LED Azul (WiFi):
- Encendido fijo: WiFi conectado
- Apagado: WiFi desconectado
- Parpadeo: Intentando conectar
```

---

## 🔧 Configuración Avanzada

### **Calibración del Sensor pH**
1. **Preparar soluciones buffer** (pH 4.0, 7.0, 10.0)
2. **Acceder al panel web** → Configuración
3. **Medir en solución pH 7.0** y anotar lectura
4. **Calcular offset**: `Offset = 7.0 - Lectura_Actual`
5. **Guardar configuración** y reiniciar

### **Configuración MQTT Personalizada**
```json
Servidor MQTT: tu-servidor.com
Puerto: 1883 (sin SSL) o 8883 (con SSL)
Usuario: tu_usuario
Contraseña: tu_contraseña
Tópico: Invernadero/[ID_DISPOSITIVO]/data
```

### **Formato del Payload MQTT**
```json
{
  "ph": 7.28,
  "temperatura": 12.25,
  "voltage": 0.993,
  "rssi": -68,
  "boot": 1,
  "mem": 245760,
  "total_readings": 156,
  "errors": 2,
  "valid_samples": 8,
  "device_id": "sensor_ph_01",
  "device_type": "water_quality",
  "firmware_version": "2.0.0",
  "timestamp": "2025-07-11T14:30:25.000Z"
}
```

---

## 🛠️ Mantenimiento y Solución de Problemas

### **Reset de Configuración**
**Método 1 - Botón físico**:
1. Mantener presionado el botón de reset
2. Encender el dispositivo
3. Soltar el botón después de 2 segundos

**Método 2 - Panel web**:
1. Acceder a Estado → Resetear Configuración
2. Confirmar la acción

### **Problemas Comunes**

**❌ No se puede conectar al WiFi del dispositivo**
```
Solución:
1. Verificar que el dispositivo esté en modo configuración (LED verde parpadeando)
2. Buscar red "invernaderoiot" en la lista de WiFi
3. Usar contraseña "invernadero123"
4. Si no aparece, reiniciar el dispositivo presionando el botón reset
```

**❌ No aparece en la red después de configurar**
```
Solución:
1. Verificar que los datos WiFi sean correctos
2. Comprobar que la red WiFi tenga internet
3. Revisar en el router la lista de dispositivos conectados
4. Usar herramientas de escaneo de red (IP Scanner)
```

**❌ No envía datos MQTT**
```
Solución:
1. Verificar configuración MQTT en el panel web
2. Comprobar estado de conexión en la página principal
3. Revisar logs en el monitor serie
4. Verificar que el broker MQTT esté funcionando
```

**❌ Lecturas del sensor incorrectas**
```
Solución:
1. Verificar conexiones del sensor pH y NTC
2. Calibrar el sensor con soluciones buffer
3. Ajustar offset en la configuración
4. Limpiar electrodos del sensor pH
```

### **Actualización de Firmware**

**Método OTA (Recomendado)**:
1. Conectar Arduino IDE a la misma red WiFi
2. Tools → Port → Network → [Nombre del dispositivo]
3. Subir nuevo firmware normalmente
4. El dispositivo se actualizará automáticamente

**Método USB (Respaldo)**:
1. Conectar cable USB al ESP32
2. Subir firmware por cable como instalación inicial
3. La configuración se mantendrá

### **Logs de Diagnóstico**
Acceder al monitor serie (115200 baud) para ver logs detallados:
```
🌱 Sensor pH Invernadero v2.0.0
📡 Iniciando sistema IoT profesional...
✅ Configuración encontrada - Iniciando modo normal
🔗 Conectando a WiFi...
✅ WiFi conectado: 192.168.1.100
🔗 Conectando a MQTT... ✅ Conectado
📡 Datos publicados: pH=7.28, T=12.3°C
```

---

## 📱 Integración con Sistemas Externos

### **API REST**
```bash
# Obtener datos actuales del sensor
GET http://[IP_DISPOSITIVO]/api/sensor

Respuesta:
{
  "ph": 7.28,
  "temperatura": 12.25,
  "voltage": 0.993,
  "rssi": -68,
  "timestamp": "2025-07-11T14:30:25.000Z"
}
```

### **Comandos MQTT (Opcional)**
```bash
# Tópico de comandos (si se implementa)
Tópico: Invernadero/AguaPH/command

# Comando de calibración
{
  "command": "calibrate",
  "ph_offset": 0.15
}

# Comando de configuración
{
  "command": "config",
  "publish_interval": 60000
}
```

### **Integración con Home Assistant**
```yaml
# configuration.yaml
mqtt:
  sensor:
    - name: "pH Invernadero"
      state_topic: "Invernadero/AguaPH/data"
      value_template: "{{ value_json.ph }}"
      unit_of_measurement: "pH"
      
    - name: "Temperatura Agua"
      state_topic: "Invernadero/AguaPH/data"
      value_template: "{{ value_json.temperatura }}"
      unit_of_measurement: "°C"
```

---

## 🔒 Seguridad

### **Contraseñas por Defecto (CAMBIAR EN PRODUCCIÓN)**
```
Access Point: invernadero123
OTA: invernadero123
```

### **Recomendaciones de Seguridad**
1. **Cambiar contraseñas** en el código antes de producción
2. **Usar certificados SSL** para MQTT en redes públicas
3. **Configurar firewall** para limitar acceso al dispositivo
4. **Actualizar firmware** regularmente
5. **Usar redes WiFi seguras** (WPA2/WPA3)

---

## 📞 Soporte Técnico

### **Información del Sistema**
- **Firmware**: v2.0.0
- **Compatibilidad**: ESP32, ESP32-C3, ESP32-S3
- **Memoria mínima**: 4MB Flash
- **Librerías**: PubSubClient, ArduinoJson, ArduinoOTA

### **Contacto y Documentación**
- **Documentación completa**: Ver archivos `MQTT_PAYLOAD_DOCUMENTATION.md`
- **Ejemplos de código**: Ver archivos `MQTT_IMPLEMENTATION_EXAMPLES.md`
- **Código fuente**: `arduino_ph_sensor_professional.ino`

---

*Última actualización: 2025-07-11 | Versión: 2.0.0*