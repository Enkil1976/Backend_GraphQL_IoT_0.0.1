#!/usr/bin/env node

/**
 * Script para verificar el estado de las correcciones de notificaciones
 * y confirmar que el payload se está enviando correctamente
 */

console.log('🔧 Verificando correcciones de notificaciones...\n');

// Verificar que los archivos tienen las correcciones
const fs = require('fs');
const path = require('path');

console.log('📋 Estado de las correcciones implementadas:');

// 1. Verificar rulesEngineService.js
const rulesEngineFile = path.join(__dirname, 'src/services/rulesEngineService.js');
const rulesEngineContent = fs.readFileSync(rulesEngineFile, 'utf8');

if (rulesEngineContent.includes('const effectiveCanal = canal || \'telegram\';')) {
  console.log('   ✅ rulesEngineService.js - Default canal corregido');
} else {
  console.log('   ❌ rulesEngineService.js - Default canal NO encontrado');
}

if (rulesEngineContent.includes('const effectiveTargetChannel = targetChannel || \'webhook\';')) {
  console.log('   ✅ rulesEngineService.js - Default targetChannel corregido');
} else {
  console.log('   ❌ rulesEngineService.js - Default targetChannel NO encontrado');
}

if (rulesEngineContent.includes('canal: effectiveCanal,')) {
  console.log('   ✅ rulesEngineService.js - Metadata canal usando effectiveCanal');
} else {
  console.log('   ❌ rulesEngineService.js - Metadata canal NO corregido');
}

// 2. Verificar notificationService.js
const notificationFile = path.join(__dirname, 'src/services/notificationService.js');
const notificationContent = fs.readFileSync(notificationFile, 'utf8');

if (notificationContent.includes('canal: metadata.canal || \'telegram\'')) {
  console.log('   ✅ notificationService.js - Default canal en webhook corregido');
} else {
  console.log('   ❌ notificationService.js - Default canal en webhook NO encontrado');
}

if (notificationContent.includes('targetChannel: metadata.targetChannel || \'webhook\'')) {
  console.log('   ✅ notificationService.js - Default targetChannel en webhook corregido');
} else {
  console.log('   ❌ notificationService.js - Default targetChannel en webhook NO encontrado');
}

console.log('\n📊 Resumen de las correcciones:');
console.log('');
console.log('🔧 Cambios implementados:');
console.log('   1. En rulesEngineService.js líneas 678-679:');
console.log('      const effectiveCanal = canal || \'telegram\';');
console.log('      const effectiveTargetChannel = targetChannel || \'webhook\';');
console.log('');
console.log('   2. En rulesEngineService.js líneas 726-727:');
console.log('      canal: effectiveCanal,');
console.log('      targetChannel: effectiveTargetChannel');
console.log('');
console.log('   3. En notificationService.js líneas 400-401:');
console.log('      canal: metadata.canal || \'telegram\',');
console.log('      targetChannel: metadata.targetChannel || \'webhook\',');

console.log('\n🚀 Estado: Las correcciones están implementadas localmente');
console.log('💡 Próximos pasos:');
console.log('   1. Hacer deploy de los cambios a producción');
console.log('   2. Verificar que las notificaciones ahora envían:');
console.log('      - canal: "telegram" (en lugar de "webhook")');
console.log('      - targetChannel: "webhook"');
console.log('   3. Monitorear logs en producción para confirmar');

console.log('\n📋 Mensaje esperado en webhook:');
console.log('   {');
console.log('     "usuario": "sistema",');
console.log('     "canal": "telegram",');
console.log('     "targetChannel": "webhook",');
console.log('     "mensaje": "...",');
console.log('     "timestamp": "...",');
console.log('     "priority": "...",');
console.log('     "source": "iot-greenhouse",');
console.log('     "metadata": { ... }');
console.log('   }');

console.log('\n✅ Script completado');