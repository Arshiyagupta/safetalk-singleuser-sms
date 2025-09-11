-- SafeTalk Subscription Migration
-- Add subscription-related columns to the users table
-- Run this in your Supabase SQL editor

-- Add subscription columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due')),
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS has_activated_service BOOLEAN DEFAULT FALSE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON users(subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Update existing users to have default subscription status
UPDATE users 
SET subscription_status = 'active', 
    subscription_started_at = created_at,
    has_activated_service = TRUE 
WHERE subscription_status IS NULL;

COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN users.subscription_id IS 'Stripe subscription ID for recurring billing';
COMMENT ON COLUMN users.subscription_status IS 'Current subscription status (active, canceled, past_due)';
COMMENT ON COLUMN users.subscription_started_at IS 'When the subscription began';
COMMENT ON COLUMN users.has_activated_service IS 'Whether both parties have texted START to activate service';