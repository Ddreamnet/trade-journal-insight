-- Create trade type enum
CREATE TYPE public.trade_type AS ENUM ('buy', 'sell');

-- Create trade status enum
CREATE TYPE public.trade_status AS ENUM ('active', 'closed');

-- Create trades table
CREATE TABLE public.trades (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_symbol TEXT NOT NULL,
    stock_name TEXT NOT NULL,
    trade_type public.trade_type NOT NULL,
    entry_price NUMERIC NOT NULL,
    target_price NUMERIC NOT NULL,
    stop_price NUMERIC NOT NULL,
    reasons TEXT[] DEFAULT '{}',
    rr_ratio NUMERIC,
    status public.trade_status NOT NULL DEFAULT 'active',
    exit_price NUMERIC,
    progress_percent NUMERIC,
    is_successful BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own trades
CREATE POLICY "Users can view their own trades"
ON public.trades
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS Policy: Users can create their own trades
CREATE POLICY "Users can create their own trades"
ON public.trades
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own trades
CREATE POLICY "Users can update their own trades"
ON public.trades
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own trades
CREATE POLICY "Users can delete their own trades"
ON public.trades
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Function to calculate RR ratio
CREATE OR REPLACE FUNCTION public.calculate_rr_ratio(
    p_entry_price NUMERIC,
    p_target_price NUMERIC,
    p_stop_price NUMERIC,
    p_trade_type public.trade_type
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
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

-- Function to calculate progress percent
CREATE OR REPLACE FUNCTION public.calculate_progress_percent(
    p_entry_price NUMERIC,
    p_exit_price NUMERIC,
    p_target_price NUMERIC,
    p_trade_type public.trade_type
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
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

-- Trigger function to auto-calculate RR on insert/update
CREATE OR REPLACE FUNCTION public.trades_calculate_rr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.rr_ratio := public.calculate_rr_ratio(
        NEW.entry_price,
        NEW.target_price,
        NEW.stop_price,
        NEW.trade_type
    );
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- Trigger function to handle trade closure
CREATE OR REPLACE FUNCTION public.trades_handle_closure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If status changed to closed and exit_price is set
    IF NEW.status = 'closed' AND NEW.exit_price IS NOT NULL AND OLD.status = 'active' THEN
        NEW.progress_percent := public.calculate_progress_percent(
            NEW.entry_price,
            NEW.exit_price,
            NEW.target_price,
            NEW.trade_type
        );
        NEW.is_successful := NEW.progress_percent >= 50;
        NEW.closed_at := now();
    END IF;
    RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trades_calculate_rr_trigger
BEFORE INSERT OR UPDATE OF entry_price, target_price, stop_price, trade_type
ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.trades_calculate_rr();

CREATE TRIGGER trades_handle_closure_trigger
BEFORE UPDATE OF status, exit_price
ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.trades_handle_closure();

-- Create index for faster user queries
CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_status ON public.trades(status);
CREATE INDEX idx_trades_created_at ON public.trades(created_at DESC);