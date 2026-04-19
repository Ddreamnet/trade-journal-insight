-- =============================================================================
-- Portfolio transfer — atomic multi-item transfer between two portfolios.
-- =============================================================================
-- Moves cash, user_assets, and active stock positions from one portfolio to
-- another under a single PL/pgSQL transaction (so a mid-transfer error
-- rolls back everything).
--
-- Items format: jsonb array of objects, each with a `type` discriminator.
--
-- Supported item shapes:
--
--   { "type": "tl_cash",
--     "amount": 1234.56 }                  -- TL cash amount to transfer
--
--   { "type": "asset_full",
--     "asset_id": "uuid" }                 -- move the entire user_assets row
--
--   { "type": "asset_partial",
--     "asset_id": "uuid",
--     "amount_usd": 100.0,
--     "quantity":   100.0 }                -- split a fungible asset row
--
--   { "type": "stock",
--     "trade_id": "uuid",
--     "lots":     30 }                     -- partial or full stock transfer
--
-- For every stock transfer we also write a matching withdraw/deposit pair so
-- the automatic trade-block bookkeeping stays balanced on both sides.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.transfer_portfolio_items(
  p_user_id           uuid,
  p_from_portfolio_id uuid,
  p_to_portfolio_id   uuid,
  p_items             jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from    RECORD;
  v_to      RECORD;
  v_item    jsonb;
  v_type    text;

  -- tl_cash
  v_amount  numeric;
  v_avail   numeric;

  -- asset_full / asset_partial
  v_asset_id   uuid;
  v_src_asset  RECORD;
  v_amount_usd numeric;
  v_qty        numeric;

  -- stock
  v_trade_id    uuid;
  v_lots        integer;
  v_src_trade   RECORD;
  v_cash_offset numeric;
  v_new_trade_id uuid;

  v_note_to   text;
  v_note_from text;
BEGIN
  ----------------------------------------------------------------------------
  -- Auth + ownership checks
  ----------------------------------------------------------------------------
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_from_portfolio_id = p_to_portfolio_id THEN
    RAISE EXCEPTION 'Aynı portföye aktarım yapılamaz';
  END IF;

  SELECT * INTO v_from
  FROM portfolios
  WHERE id = p_from_portfolio_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kaynak portföy bulunamadı';
  END IF;

  SELECT * INTO v_to
  FROM portfolios
  WHERE id = p_to_portfolio_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hedef portföy bulunamadı';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Aktarım listesi boş olamaz';
  END IF;

  v_note_to   := 'Aktarım → ' || v_to.name;
  v_note_from := 'Aktarım ← ' || v_from.name;

  ----------------------------------------------------------------------------
  -- Iterate items
  ----------------------------------------------------------------------------
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_type := v_item->>'type';

    ------------------------------------------------------------------------
    -- TL cash
    ------------------------------------------------------------------------
    IF v_type = 'tl_cash' THEN
      v_amount := COALESCE((v_item->>'amount')::numeric, 0);
      IF v_amount <= 0 THEN
        RAISE EXCEPTION 'TL aktarım tutarı sıfırdan büyük olmalı';
      END IF;

      v_avail := public.calculate_available_cash(p_user_id, p_from_portfolio_id);
      IF v_amount > v_avail + 0.01 THEN
        RAISE EXCEPTION 'Yetersiz TL bakiye. Kullanılabilir: %, istenen: %',
          ROUND(v_avail, 2), ROUND(v_amount, 2);
      END IF;

      INSERT INTO portfolio_cash_flows(user_id, portfolio_id, flow_type, amount, note)
      VALUES (p_user_id, p_from_portfolio_id, 'withdraw', v_amount, v_note_to);

      INSERT INTO portfolio_cash_flows(user_id, portfolio_id, flow_type, amount, note)
      VALUES (p_user_id, p_to_portfolio_id,   'deposit',  v_amount, v_note_from);

    ------------------------------------------------------------------------
    -- User asset (full row) — real estate and other whole-only items
    ------------------------------------------------------------------------
    ELSIF v_type = 'asset_full' THEN
      v_asset_id := (v_item->>'asset_id')::uuid;

      SELECT * INTO v_src_asset
      FROM user_assets
      WHERE id = v_asset_id
        AND user_id = p_user_id
        AND portfolio_id = p_from_portfolio_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Varlık bulunamadı (id=%)', v_asset_id;
      END IF;

      UPDATE user_assets
      SET portfolio_id = p_to_portfolio_id,
          note = COALESCE(NULLIF(note, ''), '') ||
                 CASE WHEN COALESCE(NULLIF(note, ''), '') = '' THEN '' ELSE ' · ' END ||
                 v_note_from,
          updated_at = now()
      WHERE id = v_asset_id;

    ------------------------------------------------------------------------
    -- User asset (partial) — fungibles (USD, EUR, BTC, ETH, gold, silver)
    ------------------------------------------------------------------------
    ELSIF v_type = 'asset_partial' THEN
      v_asset_id   := (v_item->>'asset_id')::uuid;
      v_amount_usd := COALESCE((v_item->>'amount_usd')::numeric, 0);
      v_qty        := COALESCE((v_item->>'quantity')::numeric, 0);

      IF v_amount_usd <= 0 OR v_qty <= 0 THEN
        RAISE EXCEPTION 'Varlık aktarım tutarları sıfırdan büyük olmalı';
      END IF;

      SELECT * INTO v_src_asset
      FROM user_assets
      WHERE id = v_asset_id
        AND user_id = p_user_id
        AND portfolio_id = p_from_portfolio_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Varlık bulunamadı (id=%)', v_asset_id;
      END IF;

      IF v_amount_usd > v_src_asset.amount_usd + 0.001
         OR v_qty > v_src_asset.quantity + 0.0001 THEN
        RAISE EXCEPTION 'Aktarım tutarı mevcut varlığı aşıyor';
      END IF;

      -- Destination: fresh row on target portfolio carrying the same metadata
      INSERT INTO user_assets (
        user_id, portfolio_id, category, asset_type, title,
        quantity, quantity_unit, amount_usd, note, metadata
      ) VALUES (
        p_user_id, p_to_portfolio_id, v_src_asset.category, v_src_asset.asset_type, v_src_asset.title,
        v_qty, v_src_asset.quantity_unit, v_amount_usd, v_note_from, v_src_asset.metadata
      );

      -- Source: reduce, or delete if fully drawn
      IF v_src_asset.amount_usd - v_amount_usd <= 0.001
         OR v_src_asset.quantity - v_qty <= 0.0001 THEN
        DELETE FROM user_assets WHERE id = v_asset_id;
      ELSE
        UPDATE user_assets
        SET amount_usd = amount_usd - v_amount_usd,
            quantity   = quantity   - v_qty,
            updated_at = now()
        WHERE id = v_asset_id;
      END IF;

    ------------------------------------------------------------------------
    -- Active stock position (partial or full)
    ------------------------------------------------------------------------
    ELSIF v_type = 'stock' THEN
      v_trade_id := (v_item->>'trade_id')::uuid;
      v_lots     := COALESCE((v_item->>'lots')::integer, 0);

      IF v_lots <= 0 THEN
        RAISE EXCEPTION 'Transfer edilecek lot sayısı sıfırdan büyük olmalı';
      END IF;

      SELECT * INTO v_src_trade
      FROM trades
      WHERE id = v_trade_id
        AND user_id = p_user_id
        AND portfolio_id = p_from_portfolio_id
        AND status = 'active'
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'İşlem bulunamadı veya aktif değil (id=%)', v_trade_id;
      END IF;

      IF v_lots > v_src_trade.remaining_lot THEN
        RAISE EXCEPTION 'Transfer lotu kalan lotu aşıyor (kalan: %, istenen: %)',
          v_src_trade.remaining_lot, v_lots;
      END IF;

      v_cash_offset := v_src_trade.entry_price * v_lots;

      -- Destination: fresh trade on target (no partial close history; fresh lot_quantity)
      INSERT INTO trades (
        user_id, portfolio_id,
        stock_symbol, stock_name, trade_type,
        entry_price, target_price, stop_price,
        reasons, rr_ratio,
        lot_quantity, remaining_lot, position_amount,
        status, merge_count, merge_history
      ) VALUES (
        p_user_id, p_to_portfolio_id,
        v_src_trade.stock_symbol, v_src_trade.stock_name, v_src_trade.trade_type,
        v_src_trade.entry_price, v_src_trade.target_price, v_src_trade.stop_price,
        v_src_trade.reasons, v_src_trade.rr_ratio,
        v_lots, v_lots, v_cash_offset,
        'active', 1, '[]'::jsonb
      )
      RETURNING id INTO v_new_trade_id;

      -- Source: partial decrement, or close if full transfer
      IF v_lots = v_src_trade.remaining_lot THEN
        UPDATE trades
        SET remaining_lot = 0,
            status        = 'closed',
            closed_at     = now(),
            closing_note  = 'Portföyler arası aktarım → ' || v_to.name,
            updated_at    = now()
        WHERE id = v_trade_id;
      ELSE
        UPDATE trades
        SET remaining_lot = remaining_lot - v_lots,
            updated_at    = now()
        WHERE id = v_trade_id;
      END IF;

      -- Cash offset: the source trade block shrinks by v_cash_offset, the
      -- target block grows by the same. Without a matching pair of cash
      -- flows, both portfolios' available cash would drift. Writing these
      -- keeps the math stable on both sides.
      INSERT INTO portfolio_cash_flows(user_id, portfolio_id, flow_type, amount, note)
      VALUES (p_user_id, p_from_portfolio_id, 'withdraw', v_cash_offset,
              'Aktarım (' || v_src_trade.stock_symbol || ') → ' || v_to.name);

      INSERT INTO portfolio_cash_flows(user_id, portfolio_id, flow_type, amount, note)
      VALUES (p_user_id, p_to_portfolio_id, 'deposit', v_cash_offset,
              'Aktarım (' || v_src_trade.stock_symbol || ') ← ' || v_from.name);

    ELSE
      RAISE EXCEPTION 'Bilinmeyen aktarım tipi: %', v_type;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_portfolio_items(uuid, uuid, uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.transfer_portfolio_items(uuid, uuid, uuid, jsonb) IS
  'Atomically transfer a batch of items (TL cash, user_assets, stock positions) from one portfolio to another. '
  'Writes cash-offset flows for each stock move so available-balance math stays consistent.';
