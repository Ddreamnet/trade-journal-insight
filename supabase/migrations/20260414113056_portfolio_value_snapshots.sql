
CREATE TABLE IF NOT EXISTS public.portfolio_value_snapshots (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date date        NOT NULL,
  value_usd     numeric(20,4) NOT NULL DEFAULT 0,
  value_try     numeric(20,4),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);

ALTER TABLE public.portfolio_value_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own snapshots"
  ON public.portfolio_value_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON public.portfolio_value_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own snapshots"
  ON public.portfolio_value_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own snapshots"
  ON public.portfolio_value_snapshots FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_value_snapshots_user_date
  ON public.portfolio_value_snapshots (user_id, snapshot_date DESC);
