-- Chat Bots Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bots table
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  share_code CHAR(4) UNIQUE NOT NULL,
  roblox_user_id BIGINT NOT NULL,
  roblox_username TEXT,
  roblox_avatar_url TEXT,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  chat_count INT DEFAULT 0,
  approved BOOLEAN DEFAULT NULL,
  rejected BOOLEAN DEFAULT NULL,
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]'::jsonb,
  conversation JSONB DEFAULT '[]'::jsonb,
  notes JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bot_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bots_share_code ON bots(share_code);
CREATE INDEX IF NOT EXISTS idx_bots_creator ON bots(creator_id);
CREATE INDEX IF NOT EXISTS idx_bots_approved ON bots(approved) WHERE approved = true;
CREATE INDEX IF NOT EXISTS idx_bots_pending ON bots(approved, rejected) WHERE approved IS NULL AND rejected IS NULL;
CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_bot ON chats(bot_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);

-- Function to increment chat count
CREATE OR REPLACE FUNCTION increment_chat_count(bot_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE bots SET chat_count = chat_count + 1 WHERE id = bot_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all, update own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Bots: Anyone can read, creators can update/delete
CREATE POLICY "Bots are viewable by everyone" ON bots FOR SELECT USING (true);
CREATE POLICY "Users can create bots" ON bots FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update own bots" ON bots FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete own bots" ON bots FOR DELETE USING (auth.uid() = creator_id);

-- Chats: Users can only access own chats
CREATE POLICY "Users can view own chats" ON chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own chats" ON chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chats" ON chats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chats" ON chats FOR DELETE USING (auth.uid() = user_id);

-- Insert the system Support bot
INSERT INTO bots (id, creator_id, share_code, roblox_user_id, roblox_username, name, description, system_prompt, is_public, approved)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'HELP',
  1,
  'Support',
  'Support',
  'The official support bot - here to help you use the app!',
  'You are the Support Bot - a helpful guide for users of the Chat Bots platform.

Your personality:
- Friendly and helpful, like a knowledgeable friend
- Clear and concise explanations
- Patient with new users
- Use casual language but stay professional

What you help with:
1. How to create a bot (enter Roblox user ID, write description, get share code)
2. How share codes work (4-digit codes like "7X3K" to share bots with friends)
3. How share links work (chatbots.app/b/CODE format)
4. How to find bots (enter someone''s share code)
5. General app questions

Key features to explain:
- Bots are based on real Roblox users (their avatar is used)
- Descriptions get turned into AI personalities
- Each bot has a unique 4-digit share code
- Users can create unlimited bots
- Chats are saved to your account
- Themes can be customized

Keep responses short and helpful. Use bullet points for lists.
If asked about something unrelated to the app, politely redirect to app-related help.',
  TRUE,
  TRUE
) ON CONFLICT (share_code) DO NOTHING;
