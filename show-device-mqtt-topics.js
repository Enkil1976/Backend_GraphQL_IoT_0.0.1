#!/usr/bin/env node

/**
 * Mostrar tópicos MQTT para dispositivos basándose en patrones conocidos
 * y configuraciones del sistema
 */

const devices = [
  {
    id: 1,
    name: "Bomba de Agua Principal", 
    deviceId: "bomba_agua_01",
    type: "WATER_PUMP",
    description: "Bomba principal para sistema de riego"
  },
  {
    id: 2,
    name: "Ventilador de Circulación",
    deviceId: "ventilador_01", 
    type: "VENTILATOR",
    description: "Ventilador para circulación de aire"
  },
  {
    id: 3,
    name: "Lámpara LED Crecimiento",
    deviceId: "led_grow_01",
    type: "LIGHTS", 
    description: "Iluminación LED para crecimiento de plantas"
  },
  {
    id: 4,
    name: "Calefactor Nocturno",
    deviceId: "calefactor_01",
    type: "HEATER",
    description: "Calefactor para temperatura nocturna"
  },
  {
    id: 5,
    name: "Calefactor de Agua", 
    deviceId: "calefactor_agua_01",
    type: "RELAY",
    description: "Calefactor para mantener temperatura del agua"
  },
  {
    id: 271,
    name: "Luz LED - invernadero-ledgrow01",
    deviceId: "invernadero-ledgrow01", 
    type: "RELAY",
    description: "Auto-created from MQTT topic: Invernadero/led_grow_01/sw"
  }
];

function generateMQTTTopics(device) {
  // Basándose en los patrones del sistema y la documentación
  const topics = [];
  
  // Patrón 1: Invernadero/[DeviceName]/sw (más común)
  if (device.deviceId.includes('bomba')) {
    topics.push('Invernadero/Bomba/sw');
  } else if (device.deviceId.includes('ventilador')) {
    topics.push('Invernadero/Ventilador/sw');
  } else if (device.deviceId.includes('led') || device.deviceId.includes('grow')) {
    topics.push('Invernadero/LedGrow/sw');
    topics.push('Invernadero/led_grow_01/sw'); // Auto-discovery topic
  } else if (device.deviceId.includes('calefactor')) {
    if (device.deviceId.includes('agua')) {
      topics.push('Invernadero/CalefactorAgua/sw');
    } else {
      topics.push('Invernadero/Calefactor/sw');
    }
  }
  
  // Patrón 2: Control directo por device_id
  topics.push(`greenhouse/device/${device.deviceId}/control`);
  
  // Patrón 3: Tópicos de estado
  topics.push(`greenhouse/device/${device.deviceId}/status`);
  
  return topics;
}

function generateMQTTPayloads(device) {
  const payloads = [];
  
  // Payload típico para control ON/OFF
  if (device.deviceId.includes('bomba')) {
    payloads.push('{"bombaSw": true}');
    payloads.push('{"bombaSw": false}');
  } else if (device.deviceId.includes('ventilador')) {
    payloads.push('{"ventiladorSw": true}');
    payloads.push('{"ventiladorSw": false}');
  } else if (device.deviceId.includes('led') || device.deviceId.includes('grow')) {
    payloads.push('{"ledSw": true}');
    payloads.push('{"ledSw": false}');
  } else if (device.deviceId.includes('calefactor')) {
    if (device.deviceId.includes('agua')) {
      payloads.push('{"calefactorAguaSw": true}');
      payloads.push('{"calefactorAguaSw": false}');
    } else {
      payloads.push('{"calefactorSw": true}');
      payloads.push('{"calefactorSw": false}');
    }
  }
  
  // Payloads genéricos
  payloads.push('{"state": true}');
  payloads.push('{"state": false}');
  payloads.push('{"status": "ON"}');
  payloads.push('{"status": "OFF"}');
  
  return payloads;
}

console.log('🔍 TÓPICOS MQTT DE DISPOSITIVOS ACTUALES');
console.log('='.repeat(60));
console.log();

devices.forEach((device, index) => {
  console.log(`📱 DISPOSITIVO ${device.id}: ${device.name}`);
  console.log(`   Device ID: ${device.deviceId}`);
  console.log(`   Type: ${device.type}`);
  console.log();
  
  const topics = generateMQTTTopics(device);
  console.log(`   📡 TÓPICOS MQTT PROBABLES:`);
  topics.forEach(topic => {
    console.log(`      - ${topic}`);
  });
  console.log();
  
  const payloads = generateMQTTPayloads(device);
  console.log(`   📦 PAYLOADS TÍPICOS:`);
  payloads.slice(0, 4).forEach(payload => {  // Mostrar solo los primeros 4
    console.log(`      - ${payload}`);
  });
  
  console.log();
  console.log('   ' + '-'.repeat(50));
  console.log();
});

console.log('⚠️  DISPOSITIVO FANTASMA IDENTIFICADO:');
console.log('   📱 THM-003 (NO EXISTE EN EL SISTEMA)');
console.log('   📡 Tópico problemático: Invernadero/THM-003/sw');
console.log('   📦 Payload recibido: {"state": true}');
console.log('   🔧 Causa: Regla intentando controlar dispositivo inexistente');
console.log();

console.log('💡 ANÁLISIS:');
console.log('   - Los dispositivos existentes tienen tópicos MQTT válidos');
console.log('   - THM-003 NO debería estar generando mensajes');
console.log('   - Alguna regla está enviando comandos a un dispositivo eliminado');
console.log('   - Las reglas deshabilitadas deberían haber detenido esto');
console.log();

console.log('🎯 RECOMENDACIÓN:');
console.log('   1. Monitorear si Invernadero/THM-003/sw se detiene');
console.log('   2. Si continúa, revisar las 5 reglas activas restantes');
console.log('   3. Buscar referencias a THM-003 en configuraciones de base de datos');
console.log();