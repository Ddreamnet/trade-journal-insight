-- Enum type for portfolio event types
CREATE TYPE public.portfolio_event_type AS ENUM ('deposit', 'withdraw', 'pnl');

-- Portfolio events table - logs all cash flows and realized PnL
CREATE TABLE public.portfolio_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type public.portfolio_event_type NOT NULL,
  amount_tl NUMERIC NOT NULL,
  trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Portfolio snapshots table - stores calculated state after each event
CREATE TABLE public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.portfolio_events(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  shares_total NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  portfolio_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_portfolio_events_user ON public.portfolio_events(user_id);
CREATE INDEX idx_portfolio_events_created ON public.portfolio_events(created_at);
CREATE INDEX idx_portfolio_snapshots_user ON public.portfolio_snapshots(user_id);
CREATE INDEX idx_portfolio_snapshots_date ON public.portfolio_snapshots(snapshot_date);

-- Enable RLS
ALTER TABLE public.portfolio_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for portfolio_events
CREATE POLICY "Users can view own portfolio events" 
ON public.portfolio_events 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolio events" 
ON public.portfolio_events 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolio events" 
ON public.portfolio_events 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for portfolio_snapshots (read-only for users, written by trigger)
CREATE POLICY "Users can view own portfolio snapshots" 
ON public.portfolio_snapshots 
FOR SELECT 
USING (auth.uid() = user_id);

-- Function to calculate and insert portfolio snapshot after each event
CREATE OR REPLACE FUNCTION public.calculate_portfolio_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  last_snapshot RECORD;
  new_shares NUMERIC;
  new_unit_price NUMERIC;
  new_portfolio_value NUMERIC;
BEGIN
  -- Get latest snapshot for this user
  SELECT * INTO last_snapshot
  FROM public.portfolio_snapshots
  WHERE user_id = NEW.user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no previous snapshot, this is first deposit
  IF last_snapshot IS NULL THEN
    IF NEW.event_type = 'deposit' THEN
      new_unit_price := 1.00;
      new_shares := NEW.amount_tl;
      new_portfolio_value := NEW.amount_tl;
    ELSE
      RAISE EXCEPTION 'First portfolio event must be a deposit';
    END IF;
  ELSE
    -- Calculate based on event type
    IF NEW.event_type = 'deposit' THEN
      new_shares := last_snapshot.shares_total + (NEW.amount_tl / last_snapshot.unit_price);
      new_portfolio_value := last_snapshot.portfolio_value + NEW.amount_tl;
      new_unit_price := last_snapshot.unit_price; -- unchanged
    ELSIF NEW.event_type = 'withdraw' THEN
      new_shares := last_snapshot.shares_total - (NEW.amount_tl / last_snapshot.unit_price);
      IF new_shares < 0 THEN
        RAISE EXCEPTION 'Insufficient shares for withdrawal';
      END IF;
      new_portfolio_value := last_snapshot.portfolio_value - NEW.amount_tl;
      new_unit_price := last_snapshot.unit_price; -- unchanged
    ELSIF NEW.event_type = 'pnl' THEN
      new_shares := last_snapshot.shares_total; -- unchanged
      new_portfolio_value := last_snapshot.portfolio_value + NEW.amount_tl;
      IF new_shares > 0 THEN
        new_unit_price := new_portfolio_value / new_shares;
      ELSE
        new_unit_price := last_snapshot.unit_price;
      END IF;
    END IF;
  END IF;

  -- Insert new snapshot
  INSERT INTO public.portfolio_snapshots (
    user_id, event_id, snapshot_date, 
    shares_total, unit_price, portfolio_value
  ) VALUES (
    NEW.user_id, NEW.id, NEW.created_at::date,
    new_shares, new_unit_price, new_portfolio_value
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create snapshot after portfolio event insert
CREATE TRIGGER after_portfolio_event_insert
AFTER INSERT ON public.portfolio_events
FOR EACH ROW EXECUTE FUNCTION public.calculate_portfolio_snapshot();

-- Function to create PnL event when trade closes
CREATE OR REPLACE FUNCTION public.create_pnl_event_on_trade_close()
RETURNS TRIGGER AS $$
DECLARE
  realized_pnl NUMERIC;
  has_portfolio BOOLEAN;
BEGIN
  -- Only run when trade status changes to closed
  IF NEW.status = 'closed' AND OLD.status = 'active' 
     AND NEW.exit_price IS NOT NULL 
     AND NEW.position_amount IS NOT NULL THEN
    
    -- Check if user has any portfolio events (must have deposited first)
    SELECT EXISTS (
      SELECT 1 FROM public.portfolio_events WHERE user_id = NEW.user_id
    ) INTO has_portfolio;
    
    -- Only create PnL event if user has a portfolio
    IF has_portfolio THEN
      -- Calculate realized PnL
      IF NEW.trade_type = 'buy' THEN
        realized_pnl := NEW.position_amount * ((NEW.exit_price - NEW.entry_price) / NEW.entry_price);
      ELSE
        realized_pnl := NEW.position_amount * ((NEW.entry_price - NEW.exit_price) / NEW.entry_price);
      END IF;

      -- Insert PnL event
      INSERT INTO public.portfolio_events (user_id, event_type, amount_tl, trade_id, note)
      VALUES (
        NEW.user_id, 
        'pnl', 
        realized_pnl, 
        NEW.id,
        'İşlem kapanışı: ' || NEW.stock_symbol
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for trade close PnL event creation
CREATE TRIGGER on_trade_close_create_pnl_event
AFTER UPDATE ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.create_pnl_event_on_trade_close();