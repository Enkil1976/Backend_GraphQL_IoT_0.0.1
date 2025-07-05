-- Create user_configurations table for GraphQL Backend
-- Stores user-specific configuration settings

CREATE TABLE IF NOT EXISTS user_configurations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    config_name VARCHAR(255) NOT NULL DEFAULT 'Default Configuration',
    config JSONB NOT NULL, -- Configuration data as JSON
    is_active BOOLEAN DEFAULT true, -- Whether this configuration is active for the user
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_user_configurations_user_id ON user_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_configurations_active ON user_configurations(user_id, is_active) WHERE is_active = true;

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_user_configurations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_configurations_timestamp
    BEFORE UPDATE ON user_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_user_configurations_timestamp();

-- Table and column comments
COMMENT ON TABLE user_configurations IS 'User-specific system configurations';
COMMENT ON COLUMN user_configurations.user_id IS 'ID of the user who owns this configuration';
COMMENT ON COLUMN user_configurations.config_name IS 'Descriptive name for the configuration';
COMMENT ON COLUMN user_configurations.config IS 'Configuration data in JSON format (API endpoints, preferences, etc.)';
COMMENT ON COLUMN user_configurations.is_active IS 'Whether this configuration is currently active for the user';

-- Insert default configuration for existing users
INSERT INTO user_configurations (user_id, config_name, config, is_active)
SELECT 
    id as user_id,
    'Default Configuration' as config_name,
    '{
        "apiEndpoints": {
            "graphql": "/graphql",
            "subscriptions": "/graphql",
            "auth": "/auth"
        },
        "preferences": {
            "theme": "light",
            "language": "en",
            "timezone": "America/Santiago",
            "notifications": {
                "email": true,
                "push": true,
                "sms": false,
                "webhook": false
            }
        },
        "dashboard": {
            "refreshInterval": 30000,
            "showAllSensors": true,
            "defaultChartPeriod": "24h"
        }
    }'::jsonb as config,
    true as is_active
FROM users 
WHERE NOT EXISTS (
    SELECT 1 FROM user_configurations uc WHERE uc.user_id = users.id
);

-- Verify table creation
SELECT 
    'user_configurations table created successfully' as status,
    COUNT(*) as default_configs_created
FROM user_configurations;