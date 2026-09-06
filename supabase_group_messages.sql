-- Migration: Dedicated Group Chat with @mentions, editing, deletion & expiration
-- Run this in your Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS public.group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    mentioned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    mentioned_all BOOLEAN NOT NULL DEFAULT FALSE,
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Enable RLS
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created ON public.group_messages (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_expires_at ON public.group_messages (expires_at);

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view messages in their groups" ON public.group_messages;
DROP POLICY IF EXISTS "Users can insert messages in their groups" ON public.group_messages;
DROP POLICY IF EXISTS "Users can update own messages within 5 min" ON public.group_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.group_messages;

-- 1. SELECT: Members of the group can view if mentioned_all, or mentioned_user_id is them, or they sent it, or normal message (mentioned_user_id IS NULL)
CREATE POLICY "Users can view messages in their groups"
ON public.group_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = group_messages.group_id
          AND gm.user_id = auth.uid()
          AND gm.status = 'accepted'
    )
    AND (
        mentioned_all = TRUE
        OR mentioned_user_id = auth.uid()
        OR sender_id = auth.uid()
        OR mentioned_user_id IS NULL
    )
    AND created_at > NOW() - INTERVAL '7 days'
    AND (mentioned_user_id IS NULL OR created_at > NOW() - INTERVAL '24 hours')
);

-- 2. INSERT: Users can insert messages in groups they belong to
CREATE POLICY "Users can insert messages in their groups"
ON public.group_messages FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = group_messages.group_id
          AND gm.user_id = auth.uid()
          AND gm.status = 'accepted'
    )
    AND sender_id = auth.uid()
);

-- 3. UPDATE: Sender can update own message within 5 minutes
CREATE POLICY "Users can update own messages within 5 min"
ON public.group_messages FOR UPDATE
USING (
    sender_id = auth.uid()
    AND created_at > NOW() - INTERVAL '5 minutes'
)
WITH CHECK (
    sender_id = auth.uid()
);

-- 4. DELETE: Sender can delete own message anytime
CREATE POLICY "Users can delete own messages"
ON public.group_messages FOR DELETE
USING (
    sender_id = auth.uid()
);

-- 5. Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'group_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
    END IF;
END $$;
