
-- Allow users to delete their own partial closes
CREATE POLICY "Users can delete own partial closes"
ON public.trade_partial_closes
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own portfolio snapshots
CREATE POLICY "Users can delete own portfolio snapshots"
ON public.portfolio_snapshots
FOR DELETE
USING (auth.uid() = user_id);
