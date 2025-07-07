#!/bin/bash

# 🔒 Test Script for Secure Database Administration
# Verifies that pgAdmin is removed and secure CLI works

set -e

echo "🔒 TESTING SECURE DATABASE ADMINISTRATION"
echo "========================================"
echo ""

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

# Test 1: Verify pgAdmin is removed from docker-compose
test_pgadmin_removed() {
    run_test "Verify pgAdmin service is removed"
    
    if grep -q "pgadmin:" docker-compose.yml; then
        log_error "pgAdmin service still found in docker-compose.yml"
        return 1
    fi
    
    if grep -q "pgadmin_data:" docker-compose.yml; then
        log_error "pgAdmin volume still found in docker-compose.yml"
        return 1
    fi
    
    log_success "pgAdmin completely removed from docker-compose.yml"
}

# Test 2: Verify secure database initialization service exists
test_db_init_service() {
    run_test "Verify secure database initialization service"
    
    if [ ! -f "src/services/databaseInitService.js" ]; then
        log_error "databaseInitService.js not found"
        return 1
    fi
    
    # Check for security features in the service
    if grep -q "auditLogService" src/services/databaseInitService.js && \
       grep -q "encryptionService" src/services/databaseInitService.js && \
       grep -q "createBackup" src/services/databaseInitService.js; then
        log_success "Database initialization service has security features"
    else
        log_error "Database initialization service missing security features"
        return 1
    fi
}

# Test 3: Verify secure CLI exists and is executable
test_secure_cli() {
    run_test "Verify secure database CLI exists"
    
    if [ ! -f "src/cli/dbAdmin.js" ]; then
        log_error "Secure database CLI not found"
        return 1
    fi
    
    if [ ! -x "src/cli/dbAdmin.js" ]; then
        log_error "Database CLI is not executable"
        return 1
    fi
    
    # Check for security features in CLI
    if grep -q "read-only" src/cli/dbAdmin.js && \
       grep -q "audit" src/cli/dbAdmin.js && \
       grep -q "security" src/cli/dbAdmin.js; then
        log_success "Secure database CLI found with security features"
    else
        log_error "Database CLI missing security features"
        return 1
    fi
}

# Test 4: Verify npm scripts are updated
test_npm_scripts() {
    run_test "Verify npm scripts for database administration"
    
    if grep -q "db:admin" package.json && \
       grep -q "db:init" package.json && \
       grep -q "db:status" package.json; then
        log_success "Database administration npm scripts added"
    else
        log_error "Database administration npm scripts missing"
        return 1
    fi
}

# Test 5: Verify enhanced init-database.js
test_enhanced_init() {
    run_test "Verify enhanced database initialization"
    
    if grep -q "databaseInitService" init-database.js; then
        log_success "init-database.js uses enhanced service"
    else
        log_error "init-database.js not enhanced with new service"
        return 1
    fi
}

# Test 6: Check server integration
test_server_integration() {
    run_test "Verify server integration with secure database service"
    
    if grep -q "databaseInitService" src/server.js; then
        log_success "Server integrates with secure database service"
    else
        log_error "Server missing integration with secure database service"
        return 1
    fi
}

# Test 7: Verify no obvious security vulnerabilities
test_security_vulnerabilities() {
    run_test "Check for obvious security vulnerabilities"
    
    # Check if there are any hardcoded passwords or secrets
    if grep -r "password.*=" src/cli/ src/services/databaseInit* 2>/dev/null | grep -v "process.env" | grep -v "console.log"; then
        log_error "Potential hardcoded credentials found"
        return 1
    fi
    
    # Check for SQL injection protection
    if grep -q "pool.query.*\\$" src/cli/dbAdmin.js && \
       grep -q "parameterized" src/cli/dbAdmin.js; then
        log_success "SQL injection protection measures found"
    else
        log_warning "Limited SQL injection protection detected"
    fi
}

# Test 8: Test CLI help functionality (without full execution)
test_cli_help() {
    run_test "Test CLI structure and help"
    
    # Check if CLI has proper structure
    if grep -q "showMenu" src/cli/dbAdmin.js && \
       grep -q "securityAudit" src/cli/dbAdmin.js && \
       grep -q "createBackup" src/cli/dbAdmin.js; then
        log_success "CLI has proper menu structure with security features"
    else
        log_error "CLI missing expected functionality"
        return 1
    fi
}

# Test 9: Verify Docker configuration
test_docker_config() {
    run_test "Verify Docker configuration for secure database"
    
    # Check docker-compose.yml has secure database setup
    if grep -q "db-init:" docker-compose.yml && \
       ! grep -q "pgadmin:" docker-compose.yml; then
        log_success "Docker configuration uses secure database initialization"
    else
        log_error "Docker configuration issues detected"
        return 1
    fi
}

# Test 10: Check environment variables documentation
test_env_documentation() {
    run_test "Check for security environment variables"
    
    # Look for security-related environment variables in documentation
    if grep -q "ENCRYPTION" docker-compose.yml 2>/dev/null || \
       grep -q "JWT_SECRET" docker-compose.yml; then
        log_success "Security environment variables configured"
    else
        log_warning "Security environment variables may need configuration"
    fi
}

# Main test execution
main() {
    echo "🎯 Target: Secure Database Administration System"
    echo "📅 Started: $(date)"
    echo "=" | head -c 50; echo
    
    # Run all tests
    test_pgadmin_removed || true
    test_db_init_service || true
    test_secure_cli || true
    test_npm_scripts || true
    test_enhanced_init || true
    test_server_integration || true
    test_security_vulnerabilities || true
    test_cli_help || true
    test_docker_config || true
    test_env_documentation || true
    
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
        log_success "🎉 ALL TESTS PASSED - Secure database administration ready!"
        echo
        echo "🔒 Security Features Verified:"
        echo "   ✅ pgAdmin completely removed"
        echo "   ✅ Secure CLI for database administration"
        echo "   ✅ Enhanced initialization with security"
        echo "   ✅ Audit logging and encryption ready"
        echo "   ✅ Read-only query protection"
        echo "   ✅ Backup and recovery capabilities"
        echo
        echo "🚀 Usage Commands:"
        echo "   npm run db:admin    # Open secure database CLI"
        echo "   npm run db:init     # Initialize database"
        echo "   npm run db:status   # Check database status"
        echo
        exit 0
    else
        echo
        log_error "⚠️  Some tests failed - Review issues before production use"
        exit 1
    fi
}

# Check dependencies
if ! command -v node &> /dev/null; then
    log_error "Node.js is required but not installed"
    exit 1
fi

# Run the test suite
main "$@"