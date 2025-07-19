#!/bin/bash

# Script para apagar todos los dispositivos enviando comandos MQTT via GraphQL

SERVER_URL="https://biodomepro.2h4eh9.easypanel.host/graphql"
USERNAME="admin"
PASSWORD="admin123"

echo "🔐 Iniciando sesión..."

# Obtener token de autenticación
TOKEN_RESPONSE=$(curl -s -X POST "$SERVER_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"mutation { login(username: \\\"$USERNAME\\\", password: \\\"$PASSWORD\\\") { token user { username role } } }\"}")

TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Error de autenticación"
    echo "$TOKEN_RESPONSE"
    exit 1
fi

echo "✅ Autenticado correctamente"

# Obtener lista de todos los dispositivos
echo "📋 Obteniendo lista de dispositivos..."

DEVICES_RESPONSE=$(curl -s -X POST "$SERVER_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\": \"query { devices { id name deviceId type status } }\"}")

# Extraer IDs de dispositivos
DEVICE_IDS=$(echo "$DEVICES_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$DEVICE_IDS" ]; then
    echo "❌ No se encontraron dispositivos"
    exit 1
fi

# Contar dispositivos
DEVICE_COUNT=$(echo "$DEVICE_IDS" | wc -l)
echo "📊 Encontrados $DEVICE_COUNT dispositivos para apagar"

# Mostrar lista de dispositivos
echo ""
echo "📋 Dispositivos que serán apagados:"
echo "$DEVICES_RESPONSE" | grep -o '"name":"[^"]*' | cut -d'"' -f4 | sed 's/^/   - /'

echo ""
echo "🔌 Apagando todos los dispositivos..."

SUCCESS=0
FAILED=0

for DEVICE_ID in $DEVICE_IDS; do
    echo "Apagando dispositivo ID: $DEVICE_ID"
    
    # Enviar comando para apagar el dispositivo
    RESPONSE=$(curl -s -X POST "$SERVER_URL" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"query\": \"mutation { updateDeviceStatus(id: \\\"$DEVICE_ID\\\", status: \\\"off\\\") { id name status } }\"}")
    
    # Verificar si el comando fue exitoso
    if echo "$RESPONSE" | grep -q '"status":"OFF"'; then
        echo "✅ Dispositivo $DEVICE_ID apagado correctamente"
        ((SUCCESS++))
    elif echo "$RESPONSE" | grep -q '"status":"OFFLINE"'; then
        echo "✅ Dispositivo $DEVICE_ID establecido como OFFLINE"
        ((SUCCESS++))
    elif echo "$RESPONSE" | grep -q '"updateDeviceStatus"'; then
        echo "✅ Dispositivo $DEVICE_ID actualizado"
        ((SUCCESS++))
    else
        echo "❌ Error apagando dispositivo $DEVICE_ID"
        echo "$RESPONSE"
        ((FAILED++))
    fi
    
    # Pequeña pausa
    sleep 0.3
done

echo ""
echo "📊 Resumen:"
echo "   - Apagados exitosamente: $SUCCESS"
echo "   - Fallidos: $FAILED"
echo "   - Total procesados: $((SUCCESS + FAILED))"
echo ""
echo "✅ Proceso de apagado completado!"
echo ""
echo "📡 Comandos MQTT enviados para apagar todos los dispositivos"
echo "🔌 Los dispositivos físicos deberían recibir señales de apagado"