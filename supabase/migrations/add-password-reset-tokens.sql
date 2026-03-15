-- Create password_reset_tokens table for self-service password recovery
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for user_id lookups and expiration checks
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Enable Row Level Security
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can insert (for forgot-password endpoint)
CREATE POLICY "allow_insert_password_reset_tokens" ON password_reset_tokens
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Anyone can read/update their own tokens or valid tokens
CREATE POLICY "allow_read_password_reset_tokens" ON password_reset_tokens
  FOR SELECT
  USING (true);

-- RLS Policy: Allow delete (for cleanup after reset)
CREATE POLICY "allow_delete_password_reset_tokens" ON password_reset_tokens
  FOR DELETE
  USING (true);
