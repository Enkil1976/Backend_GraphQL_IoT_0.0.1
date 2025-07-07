#!/bin/bash

# Script para ejecutar el backend IoT con Docker Compose
# Uso: ./docker-run.sh [comando]

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para mostrar ayuda
show_help() {
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos disponibles:"
    echo "  start     - Iniciar todos los servicios"
    echo "  stop      - Detener todos los servicios"
    echo "  restart   - Reiniciar todos los servicios"
    echo "  logs      - Mostrar logs de todos los servicios"
    echo "  logs-app  - Mostrar logs solo de la aplicación"
    echo "  build     - Construir las imágenes"
    echo "  clean     - Limpiar contenedores y volúmenes"
    echo "  status    - Mostrar estado de los servicios"
    echo "  shell     - Acceder al shell del contenedor de la app"
    echo "  psql      - Conectar a PostgreSQL"
    echo "  redis     - Conectar a Redis CLI"
    echo "  help      - Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 start"
    echo "  $0 logs-app"
    echo "  $0 shell"
}

# Función para verificar si Docker está corriendo
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}Error: Docker no está corriendo${NC}"
        exit 1
    fi
}

# Función para verificar si el archivo .env existe
check_env() {
    if [ ! -f .env ]; then
        echo -e "${YELLOW}Advertencia: No existe archivo .env${NC}"
        echo -e "${YELLOW}Copiando .env.docker a .env...${NC}"
        cp .env.docker .env
        echo -e "${GREEN}Archivo .env creado. Revisa y ajusta las variables si es necesario.${NC}"
    fi
}

# Función para iniciar servicios
start_services() {
    echo -e "${GREEN}Iniciando servicios IoT Backend...${NC}"
    docker compose up -d
    echo -e "${GREEN}Servicios iniciados exitosamente${NC}"
    echo -e "${YELLOW}Esperando a que los servicios estén listos...${NC}"
    sleep 10
    docker compose ps
    echo ""
    echo -e "${GREEN}URLs disponibles:${NC}"
    echo "  GraphQL Playground: http://localhost:4001/graphql"
    echo "  PGAdmin: http://localhost:5050"
    echo "  Health Check: http://localhost:4001/health"
}

# Función para detener servicios
stop_services() {
    echo -e "${YELLOW}Deteniendo servicios...${NC}"
    docker compose down
    echo -e "${GREEN}Servicios detenidos${NC}"
}

# Función para reiniciar servicios
restart_services() {
    echo -e "${YELLOW}Reiniciando servicios...${NC}"
    docker compose restart
    echo -e "${GREEN}Servicios reiniciados${NC}"
}

# Función para mostrar logs
show_logs() {
    docker compose logs -f
}

# Función para mostrar logs solo de la app
show_app_logs() {
    docker compose logs -f app
}

# Función para construir imágenes
build_images() {
    echo -e "${GREEN}Construyendo imágenes...${NC}"
    docker compose build --no-cache
    echo -e "${GREEN}Imágenes construidas exitosamente${NC}"
}

# Función para limpiar contenedores y volúmenes
clean_all() {
    echo -e "${YELLOW}Limpiando contenedores, volúmenes e imágenes...${NC}"
    docker compose down -v --rmi all
    echo -e "${GREEN}Limpieza completada${NC}"
}

# Función para mostrar estado
show_status() {
    echo -e "${GREEN}Estado de los servicios:${NC}"
    docker compose ps
    echo ""
    echo -e "${GREEN}Uso de recursos:${NC}"
    docker stats --no-stream
}

# Función para acceder al shell del contenedor
access_shell() {
    echo -e "${GREEN}Accediendo al shell del contenedor de la aplicación...${NC}"
    docker compose exec app sh
}

# Función para conectar a PostgreSQL
connect_psql() {
    echo -e "${GREEN}Conectando a PostgreSQL...${NC}"
    docker compose exec postgres psql -U postgres -d invernadero_iot
}

# Función para conectar a Redis CLI
connect_redis() {
    echo -e "${GREEN}Conectando a Redis CLI...${NC}"
    docker compose exec redis redis-cli -a redis_password
}

# Verificar Docker
check_docker

# Verificar archivo .env
check_env

# Procesar comando
case "${1:-start}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    logs)
        show_logs
        ;;
    logs-app)
        show_app_logs
        ;;
    build)
        build_images
        ;;
    clean)
        clean_all
        ;;
    status)
        show_status
        ;;
    shell)
        access_shell
        ;;
    psql)
        connect_psql
        ;;
    redis)
        connect_redis
        ;;
    help)
        show_help
        ;;
    *)
        echo -e "${RED}Comando no reconocido: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac