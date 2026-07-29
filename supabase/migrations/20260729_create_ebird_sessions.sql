-- Create ebird_sessions table for storing eBird Session IDs
CREATE TABLE IF NOT EXISTS public.ebird_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup of active session
CREATE INDEX IF NOT EXISTS idx_ebird_sessions_status ON public.ebird_sessions(status, created_at DESC);

-- Enable RLS
ALTER TABLE public.ebird_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active session
CREATE POLICY "Allow public read access to ebird_sessions" ON public.ebird_sessions
    FOR SELECT USING (true);

-- Allow service_role / authenticated to insert and update
CREATE POLICY "Allow write access to ebird_sessions" ON public.ebird_sessions
    FOR ALL USING (true);
