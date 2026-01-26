-- Add closing_note column for trade closure notes
ALTER TABLE public.trades
ADD COLUMN closing_note TEXT;