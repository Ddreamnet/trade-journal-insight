
-- =============================================
-- 1. portfolio_cash_flows tablosu (APPEND-ONLY)
-- =============================================
CREATE TABLE public.portfolio_cash_flows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  flow_type text NOT NULL CHECK (flow_type IN ('deposit', 'withdraw')),
  amount numeric NOT NULL CHECK (amount > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_cash_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cash flows"
  ON public.portfolio_cash_flows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cash flows"
  ON public.portfolio_cash_flows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policies = append-only

-- =============================================
-- 2. trades tablosuna lot_quantity ve remaining_lot
-- =============================================
ALTER TABLE public.trades
  ADD COLUMN lot_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN remaining_lot integer NOT NULL DEFAULT 0;

-- Legacy kayıtları 0 olarak set et (zaten DEFAULT 0)
UPDATE public.trades SET lot_quantity = 0, remaining_lot = 0;

-- =============================================
-- 3. trade_partial_closes tablosu (APPEND-ONLY)
-- =============================================
CREATE TABLE public.trade_partial_closes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  exit_price numeric NOT NULL,
  lot_quantity integer NOT NULL,
  closing_type text NOT NULL CHECK (closing_type IN ('kar_al', 'stop')),
  stop_reason text,
  closing_note text,
  realized_pnl numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_partial_closes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own partial closes"
  ON public.trade_partial_closes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own partial closes"
  ON public.trade_partial_closes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policies = append-only

-- =============================================
-- 4. Trigger: trades INSERT/UPDATE - lot -> position_amount + remaining_lot
-- =============================================
CREATE OR REPLACE FUNCTION public.trades_sync_lot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- On INSERT, set remaining_lot = lot_quantity
  IF TG_OP = 'INSERT' THEN
    NEW.remaining_lot := NEW.lot_quantity;
  END IF;
  
  -- Always sync position_amount = entry_price * lot_quantity
  NEW.position_amount := NEW.entry_price * NEW.lot_quantity;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trades_sync_lot_trigger
  BEFORE INSERT OR UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.trades_sync_lot();

-- =============================================
-- 5. Helper: calculate_available_cash (legacy fallback dahil)
-- =============================================
CREATE OR REPLACE FUNCTION public.calculate_available_cash(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deposits numeric;
  v_withdrawals numeric;
  v_active_blocks numeric;
  v_realized_pnl numeric;
BEGIN
  -- Deposits
  SELECT COALESCE(SUM(amount), 0) INTO v_deposits
  FROM public.portfolio_cash_flows
  WHERE user_id = p_user_id AND flow_type = 'deposit';

  -- Withdrawals
  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawals
  FROM public.portfolio_cash_flows
  WHERE user_id = p_user_id AND flow_type = 'withdraw';

  -- Active trade blocks (legacy fallback dahil)
  SELECT COALESCE(SUM(
    CASE
      WHEN remaining_lot > 0 THEN entry_price * remaining_lot
      WHEN remaining_lot = 0 AND position_amount > 0 THEN position_amount
      ELSE 0
    END
  ), 0) INTO v_active_blocks
  FROM public.trades
  WHERE user_id = p_user_id AND status = 'active';

  -- Realized PnL (from partial closes)
  SELECT COALESCE(SUM(realized_pnl), 0) INTO v_realized_pnl
  FROM public.trade_partial_closes
  WHERE user_id = p_user_id;

  RETURN v_deposits - v_withdrawals - v_active_blocks + v_realized_pnl;
END;
$$;

-- =============================================
-- 6. RPC: create_trade_with_cash_check
-- =============================================
CREATE OR REPLACE FUNCTION public.create_trade_with_cash_check(
  p_user_id uuid,
  p_stock_symbol text,
  p_stock_name text,
  p_trade_type trade_type,
  p_entry_price numeric,
  p_target_price numeric,
  p_stop_price numeric,
  p_lot_quantity integer,
  p_reasons text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_available numeric;
  v_required numeric;
  v_trade_id uuid;
BEGIN
  -- Check auth
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_required := p_entry_price * p_lot_quantity;
  v_available := public.calculate_available_cash(p_user_id);

  IF v_required > v_available THEN
    RAISE EXCEPTION 'Yetersiz nakit. Kullanılabilir: %, Gerekli: %', ROUND(v_available, 2), ROUND(v_required, 2);
  END IF;

  INSERT INTO public.trades (
    user_id, stock_symbol, stock_name, trade_type,
    entry_price, target_price, stop_price, lot_quantity, reasons
  ) VALUES (
    p_user_id, p_stock_symbol, p_stock_name, p_trade_type,
    p_entry_price, p_target_price, p_stop_price, p_lot_quantity, p_reasons
  ) RETURNING id INTO v_trade_id;

  RETURN v_trade_id;
END;
$$;

-- =============================================
-- 7. RPC: create_withdraw_with_check
-- =============================================
CREATE OR REPLACE FUNCTION public.create_withdraw_with_check(
  p_user_id uuid,
  p_amount numeric,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_available numeric;
  v_flow_id uuid;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_available := public.calculate_available_cash(p_user_id);

  IF p_amount > v_available THEN
    RAISE EXCEPTION 'Yetersiz bakiye. Kullanılabilir: %, Çekilmek istenen: %', ROUND(v_available, 2), ROUND(p_amount, 2);
  END IF;

  INSERT INTO public.portfolio_cash_flows (user_id, flow_type, amount, note)
  VALUES (p_user_id, 'withdraw', p_amount, p_note)
  RETURNING id INTO v_flow_id;

  RETURN v_flow_id;
END;
$$;

-- =============================================
-- 8. RPC: close_trade_partial
-- =============================================
CREATE OR REPLACE FUNCTION public.close_trade_partial(
  p_user_id uuid,
  p_trade_id uuid,
  p_exit_price numeric,
  p_lot_quantity integer,
  p_closing_type text,
  p_stop_reason text DEFAULT NULL,
  p_closing_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trade RECORD;
  v_realized_pnl numeric;
  v_partial_id uuid;
  v_new_remaining integer;
  v_has_portfolio boolean;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get trade
  SELECT * INTO v_trade
  FROM public.trades
  WHERE id = p_trade_id AND user_id = p_user_id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İşlem bulunamadı veya zaten kapalı';
  END IF;

  IF p_lot_quantity <= 0 OR p_lot_quantity > v_trade.remaining_lot THEN
    RAISE EXCEPTION 'Geçersiz lot miktarı. Kalan lot: %', v_trade.remaining_lot;
  END IF;

  -- Calculate realized PnL for this partial
  IF v_trade.trade_type = 'buy' THEN
    v_realized_pnl := (p_exit_price - v_trade.entry_price) * p_lot_quantity;
  ELSE
    v_realized_pnl := (v_trade.entry_price - p_exit_price) * p_lot_quantity;
  END IF;

  -- Insert partial close record
  INSERT INTO public.trade_partial_closes (
    trade_id, user_id, exit_price, lot_quantity,
    closing_type, stop_reason, closing_note, realized_pnl
  ) VALUES (
    p_trade_id, p_user_id, p_exit_price, p_lot_quantity,
    p_closing_type, p_stop_reason, p_closing_note, v_realized_pnl
  ) RETURNING id INTO v_partial_id;

  -- Update remaining lot
  v_new_remaining := v_trade.remaining_lot - p_lot_quantity;

  IF v_new_remaining = 0 THEN
    -- Full close
    UPDATE public.trades SET
      remaining_lot = 0,
      status = 'closed',
      exit_price = p_exit_price,
      closing_type = p_closing_type,
      stop_reason = p_stop_reason,
      closing_note = p_closing_note,
      closed_at = now()
    WHERE id = p_trade_id;
  ELSE
    -- Partial close, trade stays active
    UPDATE public.trades SET
      remaining_lot = v_new_remaining
    WHERE id = p_trade_id;
  END IF;

  RETURN v_partial_id;
END;
$$;
