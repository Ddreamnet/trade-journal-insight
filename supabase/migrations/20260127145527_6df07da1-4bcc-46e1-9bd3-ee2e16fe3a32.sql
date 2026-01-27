-- Add new columns to trades table for position amount, closing type, and stop reason
ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS position_amount numeric NULL,
ADD COLUMN IF NOT EXISTS closing_type text NULL,
ADD COLUMN IF NOT EXISTS stop_reason text NULL;

-- Add check constraint for closing_type
ALTER TABLE public.trades 
ADD CONSTRAINT trades_closing_type_check 
CHECK (closing_type IS NULL OR closing_type IN ('kar_al', 'stop'));

-- Update progress calculation to be signed (directional) instead of absolute
CREATE OR REPLACE FUNCTION public.calculate_progress_percent(p_entry_price numeric, p_exit_price numeric, p_target_price numeric, p_trade_type trade_type)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
    movement NUMERIC;
    target_movement NUMERIC;
BEGIN
    -- Calculate signed movement (not absolute)
    IF p_trade_type = 'buy' THEN
        -- For long: positive if exit > entry (moving toward target)
        movement := p_exit_price - p_entry_price;
        target_movement := p_target_price - p_entry_price;
    ELSE
        -- For short: positive if exit < entry (moving toward target)
        movement := p_entry_price - p_exit_price;
        target_movement := p_entry_price - p_target_price;
    END IF;
    
    IF target_movement = 0 THEN
        RETURN 0;
    END IF;
    
    -- Return signed percentage (can be negative if went opposite direction)
    RETURN ROUND((movement / target_movement) * 100, 2);
END;
$function$;

-- Update closure handler - remove automatic is_successful determination
CREATE OR REPLACE FUNCTION public.trades_handle_closure()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- If status changed to closed and exit_price is set
    IF NEW.status = 'closed' AND NEW.exit_price IS NOT NULL AND OLD.status = 'active' THEN
        NEW.progress_percent := public.calculate_progress_percent(
            NEW.entry_price,
            NEW.exit_price,
            NEW.target_price,
            NEW.trade_type
        );
        -- is_successful is now set by the user via closing_type
        -- kar_al = true, stop = false
        NEW.is_successful := (NEW.closing_type = 'kar_al');
        NEW.closed_at := now();
    END IF;
    RETURN NEW;
END;
$function$;