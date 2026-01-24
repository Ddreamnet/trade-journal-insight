-- Fix search_path for calculate_rr_ratio function
CREATE OR REPLACE FUNCTION public.calculate_rr_ratio(
    p_entry_price NUMERIC,
    p_target_price NUMERIC,
    p_stop_price NUMERIC,
    p_trade_type public.trade_type
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    risk NUMERIC;
    reward NUMERIC;
BEGIN
    IF p_trade_type = 'buy' THEN
        reward := p_target_price - p_entry_price;
        risk := p_entry_price - p_stop_price;
    ELSE
        reward := p_entry_price - p_target_price;
        risk := p_stop_price - p_entry_price;
    END IF;
    
    IF risk <= 0 THEN
        RETURN NULL;
    END IF;
    
    RETURN ROUND(reward / risk, 2);
END;
$$;

-- Fix search_path for calculate_progress_percent function
CREATE OR REPLACE FUNCTION public.calculate_progress_percent(
    p_entry_price NUMERIC,
    p_exit_price NUMERIC,
    p_target_price NUMERIC,
    p_trade_type public.trade_type
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    movement NUMERIC;
    target_movement NUMERIC;
BEGIN
    IF p_trade_type = 'buy' THEN
        movement := ABS(p_exit_price - p_entry_price);
        target_movement := ABS(p_target_price - p_entry_price);
    ELSE
        movement := ABS(p_entry_price - p_exit_price);
        target_movement := ABS(p_entry_price - p_target_price);
    END IF;
    
    IF target_movement = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((movement / target_movement) * 100, 2);
END;
$$;