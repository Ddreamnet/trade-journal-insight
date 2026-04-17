-- =============================================================================
-- Multi-portfolio support
-- =============================================================================
-- * portfolios tablosu (bir kullanıcı birden fazla portföy yönetebilir)
-- * trades, trade_partial_closes, portfolio_cash_flows,
--   portfolio_value_snapshots, user_assets tablolarına portfolio_id
-- * Mevcut kullanıcılar için "Ana Portföy" backfill
-- * RPC'ler portföy parametresi alır, cash hesapları portföy bazında
-- =============================================================================

-- 1) portfolio_status enum + portfolios tablosu
CREATE TYPE public.portfolio_status AS ENUM ('active', 'closed');

CREATE TABLE public.portfolios (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (length(trim(name)) > 0),
  status     public.portfolio_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at  timestamptz
);

CREATE INDEX idx_portfolios_user_id     ON public.portfolios(user_id);
CREATE INDEX idx_portfolios_user_status ON public.portfolios(user_id, status);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portfolios"
  ON public.portfolios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolios"
  ON public.portfolios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolios"
  ON public.portfolios FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolios"
  ON public.portfolios FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.portfolios_update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'closed' AND OLD.status = 'active' THEN
      NEW.closed_at := now();
    ELSIF NEW.status = 'active' AND OLD.status = 'closed' THEN
      NEW.closed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER portfolios_update_timestamp_trigger
BEFORE UPDATE ON public.portfolios
FOR EACH ROW EXECUTE FUNCTION public.portfolios_update_timestamp();

-- 2) portfolio_id kolonları (önce nullable, sonra backfill + NOT NULL)
ALTER TABLE public.trades
  ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE CASCADE;
ALTER TABLE public.trade_partial_closes
  ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE CASCADE;
ALTER TABLE public.portfolio_cash_flows
  ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE CASCADE;
ALTER TABLE public.portfolio_value_snapshots
  ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE CASCADE;
ALTER TABLE public.user_assets
  ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE CASCADE;

-- 3) Backfill: her mevcut kullanıcı için bir "Ana Portföy" yarat ve bağla
DO $$
DECLARE
  uid uuid;
  pid uuid;
BEGIN
  FOR uid IN
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM public.trades
      UNION
      SELECT user_id FROM public.portfolio_cash_flows
      UNION
      SELECT user_id FROM public.trade_partial_closes
      UNION
      SELECT user_id FROM public.portfolio_value_snapshots
      UNION
      SELECT user_id FROM public.user_assets
    ) u
    WHERE user_id IS NOT NULL
  LOOP
    INSERT INTO public.portfolios(user_id, name)
    VALUES (uid, 'Ana Portföy')
    RETURNING id INTO pid;

    UPDATE public.trades                    SET portfolio_id = pid WHERE user_id = uid AND portfolio_id IS NULL;
    UPDATE public.trade_partial_closes      SET portfolio_id = pid WHERE user_id = uid AND portfolio_id IS NULL;
    UPDATE public.portfolio_cash_flows      SET portfolio_id = pid WHERE user_id = uid AND portfolio_id IS NULL;
    UPDATE public.portfolio_value_snapshots SET portfolio_id = pid WHERE user_id = uid AND portfolio_id IS NULL;
    UPDATE public.user_assets               SET portfolio_id = pid WHERE user_id = uid AND portfolio_id IS NULL;
  END LOOP;
END $$;

-- 4) NOT NULL yap
ALTER TABLE public.trades                    ALTER COLUMN portfolio_id SET NOT NULL;
ALTER TABLE public.trade_partial_closes      ALTER COLUMN portfolio_id SET NOT NULL;
ALTER TABLE public.portfolio_cash_flows      ALTER COLUMN portfolio_id SET NOT NULL;
ALTER TABLE public.portfolio_value_snapshots ALTER COLUMN portfolio_id SET NOT NULL;
ALTER TABLE public.user_assets               ALTER COLUMN portfolio_id SET NOT NULL;

-- 5) snapshot UNIQUE constraint portföy bazına alınır
ALTER TABLE public.portfolio_value_snapshots
  DROP CONSTRAINT IF EXISTS portfolio_value_snapshots_user_id_snapshot_date_key;
ALTER TABLE public.portfolio_value_snapshots
  ADD CONSTRAINT portfolio_value_snapshots_portfolio_id_snapshot_date_key
    UNIQUE (portfolio_id, snapshot_date);

-- 6) Index'ler
CREATE INDEX idx_trades_portfolio_id         ON public.trades(portfolio_id);
CREATE INDEX idx_trades_portfolio_status     ON public.trades(portfolio_id, status);
CREATE INDEX idx_partial_closes_portfolio_id ON public.trade_partial_closes(portfolio_id);
CREATE INDEX idx_cash_flows_portfolio_id     ON public.portfolio_cash_flows(portfolio_id);
CREATE INDEX idx_snapshots_portfolio_id      ON public.portfolio_value_snapshots(portfolio_id, snapshot_date DESC);
CREATE INDEX idx_user_assets_portfolio_id    ON public.user_assets(portfolio_id);

-- 7) calculate_available_cash: portfolio_id parametresi (NULL → kullanıcı geneli)
CREATE OR REPLACE FUNCTION public.calculate_available_cash(
  p_user_id uuid,
  p_portfolio_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deposits     numeric;
  v_withdrawals  numeric;
  v_active_blocks numeric;
  v_realized_pnl numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_deposits
  FROM public.portfolio_cash_flows
  WHERE user_id = p_user_id
    AND flow_type = 'deposit'
    AND (p_portfolio_id IS NULL OR portfolio_id = p_portfolio_id);

  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawals
  FROM public.portfolio_cash_flows
  WHERE user_id = p_user_id
    AND flow_type = 'withdraw'
    AND (p_portfolio_id IS NULL OR portfolio_id = p_portfolio_id);

  SELECT COALESCE(SUM(
    CASE
      WHEN remaining_lot > 0 THEN entry_price * remaining_lot
      WHEN remaining_lot = 0 AND position_amount > 0 THEN position_amount
      ELSE 0
    END
  ), 0) INTO v_active_blocks
  FROM public.trades
  WHERE user_id = p_user_id
    AND status = 'active'
    AND (p_portfolio_id IS NULL OR portfolio_id = p_portfolio_id);

  SELECT COALESCE(SUM(realized_pnl), 0) INTO v_realized_pnl
  FROM public.trade_partial_closes
  WHERE user_id = p_user_id
    AND (p_portfolio_id IS NULL OR portfolio_id = p_portfolio_id);

  RETURN v_deposits - v_withdrawals - v_active_blocks + v_realized_pnl;
END;
$$;

-- 8) create_trade_with_cash_check yeni imza: portfolio_id zorunlu
DROP FUNCTION IF EXISTS public.create_trade_with_cash_check(uuid, text, text, trade_type, numeric, numeric, numeric, integer, text[]);

CREATE OR REPLACE FUNCTION public.create_trade_with_cash_check(
  p_user_id       uuid,
  p_portfolio_id  uuid,
  p_stock_symbol  text,
  p_stock_name    text,
  p_trade_type    trade_type,
  p_entry_price   numeric,
  p_target_price  numeric,
  p_stop_price    numeric,
  p_lot_quantity  integer,
  p_reasons       text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_available numeric;
  v_required  numeric;
  v_trade_id  uuid;
  v_portfolio public.portfolios;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_portfolio
  FROM public.portfolios
  WHERE id = p_portfolio_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portföy bulunamadı';
  END IF;
  IF v_portfolio.status <> 'active' THEN
    RAISE EXCEPTION 'Kapalı portföye işlem eklenemez';
  END IF;

  v_required  := p_entry_price * p_lot_quantity;
  v_available := public.calculate_available_cash(p_user_id, p_portfolio_id);

  IF v_required > v_available THEN
    RAISE EXCEPTION 'Yetersiz nakit. Kullanılabilir: %, Gerekli: %',
      ROUND(v_available, 2), ROUND(v_required, 2);
  END IF;

  INSERT INTO public.trades (
    user_id, portfolio_id, stock_symbol, stock_name, trade_type,
    entry_price, target_price, stop_price, lot_quantity, reasons
  ) VALUES (
    p_user_id, p_portfolio_id, p_stock_symbol, p_stock_name, p_trade_type,
    p_entry_price, p_target_price, p_stop_price, p_lot_quantity, p_reasons
  ) RETURNING id INTO v_trade_id;

  RETURN v_trade_id;
END;
$$;

-- 9) create_withdraw_with_check yeni imza: portfolio_id zorunlu
DROP FUNCTION IF EXISTS public.create_withdraw_with_check(uuid, numeric, text);

CREATE OR REPLACE FUNCTION public.create_withdraw_with_check(
  p_user_id      uuid,
  p_portfolio_id uuid,
  p_amount       numeric,
  p_note         text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_available numeric;
  v_flow_id   uuid;
  v_portfolio public.portfolios;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_portfolio
  FROM public.portfolios
  WHERE id = p_portfolio_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portföy bulunamadı';
  END IF;

  v_available := public.calculate_available_cash(p_user_id, p_portfolio_id);

  IF p_amount > v_available THEN
    RAISE EXCEPTION 'Yetersiz bakiye. Kullanılabilir: %, Çekilmek istenen: %',
      ROUND(v_available, 2), ROUND(p_amount, 2);
  END IF;

  INSERT INTO public.portfolio_cash_flows (user_id, portfolio_id, flow_type, amount, note)
  VALUES (p_user_id, p_portfolio_id, 'withdraw', p_amount, p_note)
  RETURNING id INTO v_flow_id;

  RETURN v_flow_id;
END;
$$;

-- 10) close_trade_partial: partial close'a parent trade'in portfolio_id'sini kopyala
CREATE OR REPLACE FUNCTION public.close_trade_partial(
  p_user_id      uuid,
  p_trade_id     uuid,
  p_exit_price   numeric,
  p_lot_quantity integer,
  p_closing_type text,
  p_stop_reason  text DEFAULT NULL,
  p_closing_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trade         RECORD;
  v_realized_pnl  numeric;
  v_partial_id    uuid;
  v_new_remaining integer;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_trade
  FROM public.trades
  WHERE id = p_trade_id AND user_id = p_user_id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İşlem bulunamadı veya zaten kapalı';
  END IF;

  IF p_lot_quantity <= 0 OR p_lot_quantity > v_trade.remaining_lot THEN
    RAISE EXCEPTION 'Geçersiz lot miktarı. Kalan lot: %', v_trade.remaining_lot;
  END IF;

  IF v_trade.trade_type = 'buy' THEN
    v_realized_pnl := (p_exit_price - v_trade.entry_price) * p_lot_quantity;
  ELSE
    v_realized_pnl := (v_trade.entry_price - p_exit_price) * p_lot_quantity;
  END IF;

  INSERT INTO public.trade_partial_closes (
    trade_id, user_id, portfolio_id, exit_price, lot_quantity,
    closing_type, stop_reason, closing_note, realized_pnl
  ) VALUES (
    p_trade_id, p_user_id, v_trade.portfolio_id, p_exit_price, p_lot_quantity,
    p_closing_type, p_stop_reason, p_closing_note, v_realized_pnl
  ) RETURNING id INTO v_partial_id;

  v_new_remaining := v_trade.remaining_lot - p_lot_quantity;

  IF v_new_remaining = 0 THEN
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
    UPDATE public.trades SET
      remaining_lot = v_new_remaining
    WHERE id = p_trade_id;
  END IF;

  RETURN v_partial_id;
END;
$$;
