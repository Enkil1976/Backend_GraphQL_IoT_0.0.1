-- Fix production database - Create missing rule_executions table
-- Run this script if the db-init service didn't create the table

-- Create rule_executions table
CREATE TABLE IF NOT EXISTS rule_executions (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT false,
    execution_time_ms INTEGER DEFAULT 0,
    
    -- Context and evaluation data
    trigger_data JSONB,
    evaluation_result JSONB,
    actions_executed JSONB,
    
    -- Error information
    error_message TEXT,
    stack_trace TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rule_executions_rule_id ON rule_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_executions_triggered_at ON rule_executions(triggered_at);
CREATE INDEX IF NOT EXISTS idx_rule_executions_success ON rule_executions(success);
CREATE INDEX IF NOT EXISTS idx_rule_executions_rule_triggered ON rule_executions(rule_id, triggered_at DESC);

-- Add comments for documentation
COMMENT ON TABLE rule_executions IS 'Stores the execution history and results of automation rules';

-- Add device_id field to devices table if it doesn't exist
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_id VARCHAR(50) UNIQUE;

-- Create index for device_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

-- Update existing devices with device_id values if they don't have them
UPDATE devices SET device_id = 'ventilador_01' WHERE name = 'Ventilador de Circulación' AND device_id IS NULL;
UPDATE devices SET device_id = 'bomba_agua_01' WHERE name = 'Bomba de Agua Principal' AND device_id IS NULL;
UPDATE devices SET device_id = 'calefactor_01' WHERE name = 'Calefactor Nocturno' AND device_id IS NULL;
UPDATE devices SET device_id = 'calefactor_agua_01' WHERE name = 'Calefactor de Agua' AND device_id IS NULL;
UPDATE devices SET device_id = 'led_grow_01' WHERE name LIKE '%LED%' AND device_id IS NULL;

-- Verify the table was created
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'rule_executions' 
ORDER BY ordinal_position;

-- Show device_id values
SELECT id, name, device_id, type FROM devices ORDER BY id;

-- Fix temhum tables column types

