
-- Create user_assets table for non-TL assets (USD, EUR, real estate, commodities)
CREATE TABLE public.user_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  category text NOT NULL, -- 'cash', 'real_estate', 'commodity'
  asset_type text NOT NULL, -- 'usd', 'eur', 'konut', 'isyeri', 'arsa', 'bitcoin', 'ethereum', 'altin', 'gumus'
  title text, -- required for real_estate, optional for others
  quantity numeric NOT NULL DEFAULT 1, -- grams for gold/silver, units for btc/eth, 1 for real estate
  quantity_unit text NOT NULL DEFAULT 'unit', -- 'gram', 'btc', 'eth', 'unit', 'usd', 'eur'
  amount_usd numeric NOT NULL, -- total USD value of this item
  note text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own assets"
  ON public.user_assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets"
  ON public.user_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets"
  ON public.user_assets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets"
  ON public.user_assets FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_user_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_assets_updated_at
  BEFORE UPDATE ON public.user_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_assets_updated_at();
