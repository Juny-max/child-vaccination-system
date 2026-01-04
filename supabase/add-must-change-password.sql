-- Add must_change_password column to users table
-- Run this in Supabase SQL Editor

-- Add the column with default false for existing users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Add user_id to guardians table to link guardian to their user account
ALTER TABLE guardians
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guardians_user_id ON guardians(user_id);

-- Comment for documentation
COMMENT ON COLUMN users.must_change_password IS 'If true, user must change password on next login';
COMMENT ON COLUMN guardians.user_id IS 'Links guardian to their user account for portal access';
