-- Create rule_executions table for GraphQL Backend
-- This table stores the execution history of automation rules

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

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_rule_executions_rule_triggered ON rule_executions(rule_id, triggered_at DESC);

-- Add comments for documentation
COMMENT ON TABLE rule_executions IS 'Stores the execution history and results of automation rules';
COMMENT ON COLUMN rule_executions.rule_id IS 'Reference to the rule that was executed';
COMMENT ON COLUMN rule_executions.triggered_at IS 'When the rule execution was triggered';
COMMENT ON COLUMN rule_executions.success IS 'Whether the rule execution completed successfully';
COMMENT ON COLUMN rule_executions.execution_time_ms IS 'Time taken to execute the rule in milliseconds';
COMMENT ON COLUMN rule_executions.trigger_data IS 'The sensor/device data that triggered the rule';
COMMENT ON COLUMN rule_executions.evaluation_result IS 'Result of condition evaluation';
COMMENT ON COLUMN rule_executions.actions_executed IS 'List of actions that were executed';
COMMENT ON COLUMN rule_executions.error_message IS 'Error message if execution failed';
COMMENT ON COLUMN rule_executions.stack_trace IS 'Stack trace if execution failed';