-- SafeTalk SMS-Only Database Schema
-- Execute this in Supabase SQL editor

-- Users table - stores phone number pairs
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL UNIQUE, -- User's phone number
  ex_partner_phone VARCHAR(20) NOT NULL, -- Ex-partner's phone number  
  twilio_number VARCHAR(20) NOT NULL, -- The SafeTalk service number
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Ensure no duplicate pairings
  CONSTRAINT unique_phone_pair UNIQUE (phone_number, ex_partner_phone)
);

-- Messages table - conversation history  
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_number VARCHAR(20) NOT NULL, -- Who sent the original message
  to_number VARCHAR(20) NOT NULL, -- Who received the original message
  original_text TEXT NOT NULL, -- Raw message content
  filtered_text TEXT, -- AI-cleaned message (for incoming messages)
  message_type VARCHAR(20) CHECK (message_type IN ('informational', 'decision_making')),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  twilio_message_id VARCHAR(100), -- Twilio's message SID
  
  -- Index for faster queries
  INDEX idx_user_messages (user_id, created_at DESC),
  INDEX idx_twilio_message_id (twilio_message_id)
);

-- Response options table - stores AI-generated response options
CREATE TABLE IF NOT EXISTS response_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  option1 TEXT NOT NULL,
  option2 TEXT NOT NULL, 
  option3 TEXT NOT NULL,
  selected_response TEXT, -- Which option was chosen or custom response
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One response option set per message
  CONSTRAINT one_response_per_message UNIQUE (message_id)
);

-- Conversations table - tracks ongoing conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_id UUID REFERENCES messages(id),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One conversation per user pair
  CONSTRAINT one_conversation_per_user UNIQUE (user_id)
);

-- Row Level Security (RLS) - Enable for all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;  
ALTER TABLE response_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies (for future API access)
-- Note: For webhook access, use service role key which bypasses RLS

CREATE POLICY "Users can view own data" ON users
  FOR ALL USING (phone_number = current_setting('app.current_user_phone', true));

CREATE POLICY "Users can view own messages" ON messages  
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE phone_number = current_setting('app.current_user_phone', true)));

CREATE POLICY "Users can view own response options" ON response_options
  FOR ALL USING (message_id IN (SELECT id FROM messages WHERE user_id IN (SELECT id FROM users WHERE phone_number = current_setting('app.current_user_phone', true))));

CREATE POLICY "Users can view own conversations" ON conversations
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE phone_number = current_setting('app.current_user_phone', true)));

-- Functions for common operations
CREATE OR REPLACE FUNCTION get_or_create_user(
  p_phone_number VARCHAR(20),
  p_ex_partner_phone VARCHAR(20), 
  p_twilio_number VARCHAR(20)
) RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Try to find existing user
  SELECT id INTO user_id 
  FROM users 
  WHERE phone_number = p_phone_number AND ex_partner_phone = p_ex_partner_phone;
  
  -- If not found, create new user
  IF user_id IS NULL THEN
    INSERT INTO users (phone_number, ex_partner_phone, twilio_number)
    VALUES (p_phone_number, p_ex_partner_phone, p_twilio_number)
    RETURNING id INTO user_id;
  END IF;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user by any phone number
CREATE OR REPLACE FUNCTION get_user_by_phone(p_phone VARCHAR(20))
RETURNS TABLE (
  user_id UUID,
  user_phone VARCHAR(20),
  ex_phone VARCHAR(20),
  service_phone VARCHAR(20),
  is_user_phone BOOLEAN
) AS $$
BEGIN
  -- Check if phone is the user's number
  RETURN QUERY
  SELECT u.id, u.phone_number, u.ex_partner_phone, u.twilio_number, true as is_user_phone
  FROM users u
  WHERE u.phone_number = p_phone AND u.is_active = true;
  
  -- If not found, check if it's the ex-partner's number
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT u.id, u.phone_number, u.ex_partner_phone, u.twilio_number, false as is_user_phone
    FROM users u  
    WHERE u.ex_partner_phone = p_phone AND u.is_active = true;
  END IF;
END;
$$ LANGUAGE plpgsql;