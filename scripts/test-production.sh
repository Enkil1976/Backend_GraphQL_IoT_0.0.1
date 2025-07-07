#!/bin/bash

# 🧪 Script de Pruebas Automatizadas - Backend IoT v2.0
# Ejecuta las pruebas más críticas del sistema

set -e  # Exit on any error

# Configuration
BASE_URL="https://invernaderoiot-backendiot20.2h4eh9.easypanel.host"
ADMIN_USER="admin"
ADMIN_PASS="admin123"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

run_test() {
    ((TOTAL_TESTS++))
    log_info "Test $TOTAL_TESTS: $1"
}

# Test execution
test_health_check() {
    run_test "Health Check"
    
    local response=$(curl -s -w "%{http_code}" "$BASE_URL/health" -o /tmp/health_response)
    local status_code="${response: -3}"
    
    if [ "$status_code" = "200" ]; then
        local health_status=$(cat /tmp/health_response | jq -r '.status' 2>/dev/null)
        if [ "$health_status" = "healthy" ]; then
            log_success "Health check passed - Status: $health_status"
        else
            log_error "Health check failed - Invalid status: $health_status"
        fi
    else
        log_error "Health check failed - HTTP $status_code"
    fi
}

test_graphql_endpoint() {
    run_test "GraphQL Endpoint"
    
    local response=$(curl -s -X POST "$BASE_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query": "{ health { status } }"}')
    
    local status=$(echo "$response" | jq -r '.data.health.status' 2>/dev/null)
    
    if [ "$status" = "healthy" ]; then
        log_success "GraphQL endpoint accessible"
    else
        log_error "GraphQL endpoint failed - Response: $response"
    fi
}

test_authentication() {
    run_test "Authentication System"
    
    local response=$(curl -s -X POST "$BASE_URL/graphql" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"mutation { login(username: \\\"$ADMIN_USER\\\", password: \\\"$ADMIN_PASS\\\") { token user { username role } } }\"}")
    
    TOKEN=$(echo "$response" | jq -r '.data.login.token' 2>/dev/null)
    local username=$(echo "$response" | jq -r '.data.login.user.username' 2>/dev/null)
    local role=$(echo "$response" | jq -r '.data.login.user.role' 2>/dev/null)
    
    if [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ] && [ "$username" = "$ADMIN_USER" ] && [ "$role" = "admin" ]; then
        log_success "Authentication successful - User: $username, Role: $role"
    else
        log_error "Authentication failed - Response: $response"
        exit 1
    fi
}

test_unauthorized_access() {
    run_test "Unauthorized Access Protection"
    
    local response=$(curl -s -X POST "$BASE_URL/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query": "{ devices { id name } }"}')
    
    local error=$(echo "$response" | jq -r '.errors[0].message' 2>/dev/null)
    
    if [[ "$error" == *"logged in"* ]] || [[ "$error" == *"authentication"* ]] || [[ "$error" == *"unauthorized"* ]]; then
        log_success "Unauthorized access properly blocked"
    else
        log_error "Unauthorized access not blocked - Response: $response"
    fi
}

test_devices_query() {
    run_test "Device Queries"
    
    local response=$(curl -s -X POST "$BASE_URL/graphql" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"query": "{ devices { id name status enableNotifications type location } }"}')
    
    local devices_count=$(echo "$response" | jq '.data.devices | length' 2>/dev/null)
    local has_enable_notifications=$(echo "$response" | jq '.data.devices[0] | has("enableNotifications")' 2>/dev/null)
    
    if [ "$devices_count" -gt 0 ] && [ "$has_enable_notifications" = "true" ]; then
        log_success "Device queries working - Found $devices_count devices with enableNotifications field"
    else
        log_error "Device queries failed - Response: $response"
    fi
}

test_device_control() {
    run_test "Device Control"
    
    # Turn on device
    local response=$(curl -s -X POST "$BASE_URL/graphql" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"query": "mutation { turnOnDevice(id: \"1\") { id status } }"}')
    
    local status=$(echo "$response" | jq -r '.data.turnOnDevice.status' 2>/dev/null)
    
    if [ "$status" = "on" ]; then
        log_success "Device control (ON) successful"
        
        # Turn off device
        local response2=$(curl -s -X POST "$BASE_URL/graphql" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d '{"query": "mutation { turnOffDevice(id: \"1\") { id status } }"}')
        
        local status2=$(echo "$response2" | jq -r '.data.turnOffDevice.status' 2>/dev/null)
        
        if [ "$status2" = "off" ]; then
            log_success "Device control (OFF) successful"
        else
            log_error "Device control (OFF) failed - Response: $response2"
        fi
    else
        log_error "Device control (ON) failed - Response: $response"
    fi
}

test_rules_system() {
    run_test "Rules Engine"
    
    local response=$(curl -s -X POST "$BASE_URL/graphql" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"query": "{ rules { id name enabled priority } }"}')
    
    local rules_count=$(echo "$response" | jq '.data.rules | length' 2>/dev/null)
    local cycle_rules=$(echo "$response" | jq '[.data.rules[] | select(.name | contains("CICLO"))] | length' 2>/dev/null)
    
    if [ "$rules_count" -gt 0 ]; then
        log_success "Rules system working - Total rules: $rules_count, Cycle rules: $cycle_rules"
    else
        log_error "Rules system failed - Response: $response"
    fi
}

test_notifications_system() {
    run_test "Notifications System"
    
    local response=$(curl -s -X POST "$BASE_URL/graphql" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"query": "{ notifications(limit: 5) { id title message type priority status createdAt } }"}')
    
    local notifications_accessible=$(echo "$response" | jq 'has("data") and (.data | has("notifications"))' 2>/dev/null)
    
    if [ "$notifications_accessible" = "true" ]; then
        local notifications_count=$(echo "$response" | jq '.data.notifications | length' 2>/dev/null)
        log_success "Notifications system accessible - Found $notifications_count notifications"
    else
        log_error "Notifications system failed - Response: $response"
    fi
}

test_performance() {
    run_test "Performance Test"
    
    log_info "Running 5 concurrent requests..."
    
    local start_time=$(date +%s.%N)
    
    for i in {1..5}; do
        (curl -s -X POST "$BASE_URL/graphql" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d '{"query": "{ devices { id name status } }"}' \
            -w "Request $i: %{time_total}s\n" -o /dev/null) &
    done
    
    wait
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    if (( $(echo "$duration < 5.0" | bc -l) )); then
        log_success "Performance test passed - 5 concurrent requests completed in ${duration}s"
    else
        log_warning "Performance test slow - 5 concurrent requests took ${duration}s"
    fi
}

test_cycle_rules_in_database() {
    run_test "Cycle Rules Verification"
    
    # This test assumes the SQL has been executed
    local response=$(curl -s -X POST "$BASE_URL/graphql" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"query": "{ rules { id name enabled priority } }"}')
    
    local cycle_rules=$(echo "$response" | jq '[.data.rules[] | select(.name | contains("CICLO"))]' 2>/dev/null)
    local cycle_count=$(echo "$cycle_rules" | jq 'length' 2>/dev/null)
    
    if [ "$cycle_count" = "4" ]; then
        log_success "Cycle rules found - All 4 cycle rules present"
        
        # Check if they're enabled and have priority 9
        local enabled_count=$(echo "$cycle_rules" | jq '[.[] | select(.enabled == true)] | length' 2>/dev/null)
        local priority_count=$(echo "$cycle_rules" | jq '[.[] | select(.priority == 9)] | length' 2>/dev/null)
        
        if [ "$enabled_count" = "4" ] && [ "$priority_count" = "4" ]; then
            log_success "Cycle rules properly configured - All enabled with priority 9"
        else
            log_warning "Cycle rules found but configuration may need attention - Enabled: $enabled_count/4, Priority 9: $priority_count/4"
        fi
    elif [ "$cycle_count" = "0" ]; then
        log_warning "No cycle rules found - Execute the SQL script to create them"
    else
        log_warning "Partial cycle rules found - Expected 4, found $cycle_count"
    fi
}

# Main execution
main() {
    echo "🧪 Backend IoT GraphQL v2.0 - Automated Test Suite"
    echo "🎯 Target: $BASE_URL"
    echo "📅 Started: $TIMESTAMP"
    echo "=" | head -c 50; echo

    # Run all tests
    test_health_check
    test_graphql_endpoint
    test_authentication
    test_unauthorized_access
    test_devices_query
    test_device_control
    test_rules_system
    test_notifications_system
    test_cycle_rules_in_database
    test_performance

    echo
    echo "=" | head -c 50; echo
    echo "📊 TEST SUMMARY"
    echo "📋 Total Tests: $TOTAL_TESTS"
    echo "✅ Passed: $PASSED_TESTS"
    echo "❌ Failed: $FAILED_TESTS"
    
    local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "📈 Success Rate: $success_rate%"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo
        log_success "🎉 ALL TESTS PASSED - System ready for production!"
        exit 0
    else
        echo
        log_error "⚠️  Some tests failed - Review issues before production use"
        exit 1
    fi
}

# Check dependencies
if ! command -v curl &> /dev/null; then
    log_error "curl is required but not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed"
    exit 1
fi

# Run the test suite
main "$@"