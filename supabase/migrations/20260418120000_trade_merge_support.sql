-- Trade merge desteği:
-- Kullanıcı aynı sembolde açık bir işlemi varken yeni bir alım/satım açmak istediğinde
-- bunu mevcut işlemle birleştirebilsin. Birleştirmede lot toplanır, entry/target/stop
-- ağırlıklı ortalamaya yeniden hesaplanır, işlemin merge geçmişi korunur.

-- 1) Yeni kolonlar: merge_count + merge_history
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS merge_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS merge_history jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.trades.merge_count IS
  'Bu trade kaydının kapsadığı bireysel alım/satım sayısı. 1 = birleştirme olmadı.';
COMMENT ON COLUMN public.trades.merge_history IS
  'Her merge olayının snapshot''ı: [{merged_at, original_*, added_*, new_*}, ...]';

-- 2) Birleştirme RPC''si — atomik: cash check + ağırlıklı ortalama + history append
CREATE OR REPLACE FUNCTION public.merge_into_trade(
  p_user_id          uuid,
  p_target_trade_id  uuid,
  p_add_entry_price  numeric,
  p_add_target_price numeric,
  p_add_stop_price   numeric,
  p_add_lot_quantity integer,
  p_add_reasons      text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trade           public.trades%ROWTYPE;
  v_new_lot         integer;
  v_new_entry       numeric;
  v_new_target      numeric;
  v_new_stop        numeric;
  v_old_position    numeric;
  v_new_position    numeric;
  v_delta           numeric;
  v_available_cash  numeric;
  v_history_entry   jsonb;
  v_merged_reasons  text[];
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_add_lot_quantity <= 0 THEN
    RAISE EXCEPTION 'Eklenen lot sıfırdan büyük olmalı';
  END IF;
  IF p_add_entry_price <= 0 OR p_add_target_price <= 0 OR p_add_stop_price <= 0 THEN
    RAISE EXCEPTION 'Fiyatlar sıfırdan büyük olmalı';
  END IF;

  -- Hedef trade''i kilitleyerek yükle
  SELECT * INTO v_trade
  FROM public.trades
  WHERE id = p_target_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İşlem bulunamadı';
  END IF;
  IF v_trade.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Bu işleme erişim yetkiniz yok';
  END IF;
  IF v_trade.status <> 'active' THEN
    RAISE EXCEPTION 'Sadece aktif işlemler birleştirilebilir';
  END IF;
  IF v_trade.lot_quantity IS NULL OR v_trade.lot_quantity <= 0 THEN
    RAISE EXCEPTION 'Hedef işlemin lot bilgisi eksik; birleştirme yapılamaz';
  END IF;

  v_new_lot := v_trade.lot_quantity + p_add_lot_quantity;

  v_new_entry  := (v_trade.entry_price  * v_trade.lot_quantity + p_add_entry_price  * p_add_lot_quantity) / v_new_lot;
  v_new_target := (v_trade.target_price * v_trade.lot_quantity + p_add_target_price * p_add_lot_quantity) / v_new_lot;
  v_new_stop   := (v_trade.stop_price   * v_trade.lot_quantity + p_add_stop_price   * p_add_lot_quantity) / v_new_lot;

  v_old_position := v_trade.entry_price * v_trade.lot_quantity;
  v_new_position := v_new_entry * v_new_lot;
  v_delta := v_new_position - v_old_position;

  -- Cash check: mevcut available_cash zaten old_position''ı düşürmüş durumda.
  -- Yeni blokaj new_position; aradaki fark (delta) için yeterli nakit lazım.
  IF v_delta > 0 THEN
    v_available_cash := public.calculate_available_cash(p_user_id, v_trade.portfolio_id);
    IF v_available_cash < v_delta THEN
      RAISE EXCEPTION 'Yetersiz nakit. Kullanılabilir: %, Gerekli ek: %',
        ROUND(v_available_cash, 2), ROUND(v_delta, 2);
    END IF;
  END IF;

  -- History entry
  v_history_entry := jsonb_build_object(
    'merged_at',       now(),
    'original_lot',    v_trade.lot_quantity,
    'original_entry',  v_trade.entry_price,
    'original_target', v_trade.target_price,
    'original_stop',   v_trade.stop_price,
    'added_lot',       p_add_lot_quantity,
    'added_entry',     p_add_entry_price,
    'added_target',    p_add_target_price,
    'added_stop',      p_add_stop_price,
    'added_reasons',   to_jsonb(p_add_reasons),
    'new_entry',       v_new_entry,
    'new_target',      v_new_target,
    'new_stop',        v_new_stop,
    'new_lot',         v_new_lot
  );

  -- reasons union (dedup)
  SELECT COALESCE(array_agg(DISTINCT r), '{}')
    INTO v_merged_reasons
  FROM unnest(COALESCE(v_trade.reasons, '{}'::text[]) || COALESCE(p_add_reasons, '{}'::text[])) AS r;

  UPDATE public.trades SET
    entry_price   = v_new_entry,
    target_price  = v_new_target,
    stop_price    = v_new_stop,
    lot_quantity  = v_new_lot,
    remaining_lot = remaining_lot + p_add_lot_quantity,
    reasons       = v_merged_reasons,
    merge_count   = merge_count + 1,
    merge_history = merge_history || v_history_entry
  WHERE id = p_target_trade_id;

  RETURN p_target_trade_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_into_trade(uuid, uuid, numeric, numeric, numeric, integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_into_trade(uuid, uuid, numeric, numeric, numeric, integer, text[]) TO authenticated;
