-- SafeTalk Database Schema for Supabase
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    twilio_number VARCHAR(20) NOT NULL,
    ex_number VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20) NOT NULL,
    original_text TEXT NOT NULL,
    filtered_text TEXT,
    message_type VARCHAR(20) CHECK (message_type IN ('informational', 'decision_making')) DEFAULT 'informational',
    direction VARCHAR(10) CHECK (direction IN ('incoming', 'outgoing')) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed')) DEFAULT 'pending',
    twilio_message_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Response options table
CREATE TABLE IF NOT EXISTS response_options (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    option_1 TEXT NOT NULL,
    option_2 TEXT NOT NULL,
    option_3 TEXT NOT NULL,
    selected_response TEXT,
    custom_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_twilio_number ON users(twilio_number);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_twilio_id ON messages(twilio_message_id);
CREATE INDEX IF NOT EXISTS idx_response_options_message_id ON response_options(message_id);

-- Update timestamps function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_options ENABLE ROW LEVEL SECURITY;

-- Policy for users table (users can only access their own data)
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (phone_number = current_setting('app.current_user_phone', true));

CREATE POLICY "Users can update their own data" ON users
    FOR UPDATE USING (phone_number = current_setting('app.current_user_phone', true));

-- Policy for messages table (users can only access their own messages)
CREATE POLICY "Users can view their own messages" ON messages
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM users 
            WHERE phone_number = current_setting('app.current_user_phone', true)
        )
    );

CREATE POLICY "Users can insert their own messages" ON messages
    FOR INSERT WITH CHECK (
        user_id IN (
            SELECT id FROM users 
            WHERE phone_number = current_setting('app.current_user_phone', true)
        )
    );

-- Policy for response options (users can only access options for their messages)
CREATE POLICY "Users can view their own response options" ON response_options
    FOR SELECT USING (
        message_id IN (
            SELECT m.id FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE u.phone_number = current_setting('app.current_user_phone', true)
        )
    );

CREATE POLICY "Users can insert their own response options" ON response_options
    FOR INSERT WITH CHECK (
        message_id IN (
            SELECT m.id FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE u.phone_number = current_setting('app.current_user_phone', true)
        )
    );

CREATE POLICY "Users can update their own response options" ON response_options
    FOR UPDATE USING (
        message_id IN (
            SELECT m.id FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE u.phone_number = current_setting('app.current_user_phone', true)
        )
    );

-- Create a function to get recent messages with response options
CREATE OR REPLACE FUNCTION get_user_messages_with_options(user_phone TEXT, message_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    message_id UUID,
    from_number VARCHAR,
    to_number VARCHAR,
    original_text TEXT,
    filtered_text TEXT,
    message_type VARCHAR,
    direction VARCHAR,
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    option_1 TEXT,
    option_2 TEXT,
    option_3 TEXT,
    selected_response TEXT,
    custom_response TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.from_number,
        m.to_number,
        m.original_text,
        m.filtered_text,
        m.message_type,
        m.direction,
        m.status,
        m.created_at,
        ro.option_1,
        ro.option_2,
        ro.option_3,
        ro.selected_response,
        ro.custom_response
    FROM messages m
    JOIN users u ON m.user_id = u.id
    LEFT JOIN response_options ro ON m.id = ro.message_id
    WHERE u.phone_number = user_phone
    ORDER BY m.created_at DESC
    LIMIT message_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample data for testing (remove in production)
-- This helps test the schema without needing real API keys
INSERT INTO users (phone_number, twilio_number, ex_number) VALUES 
    ('+1234567890', '+1987654321', '+1555123456')
ON CONFLICT (phone_number) DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON messages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON response_options TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_messages_with_options TO anon, authenticated;