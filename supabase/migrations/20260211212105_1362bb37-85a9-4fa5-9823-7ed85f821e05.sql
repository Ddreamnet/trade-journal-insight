
-- Update trades_sync_lot trigger to NOT overwrite position_amount when lot_quantity = 0 (legacy records)
CREATE OR REPLACE FUNCTION public.trades_sync_lot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- On INSERT, set remaining_lot = lot_quantity
  IF TG_OP = 'INSERT' THEN
    NEW.remaining_lot := NEW.lot_quantity;
  END IF;
  
  -- Only sync position_amount when lot_quantity > 0 (preserve legacy values)
  IF NEW.lot_quantity > 0 THEN
    NEW.position_amount := NEW.entry_price * NEW.lot_quantity;
  END IF;
  
  RETURN NEW;
END;
$function$;
