-- Migration 037: Add connection status and error tracking for provider connections
ALTER TABLE provider_connections
ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'connected',
ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

CREATE INDEX IF NOT EXISTS idx_provider_connections_status ON provider_connections(status);
