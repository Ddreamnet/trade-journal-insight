import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { useMemo } from 'react';

export type AssetCategory = 'cash' | 'real_estate' | 'commodity';
export type AssetType =
  | 'usd'
  | 'eur'
  | 'konut'
  | 'isyeri'
  | 'arsa'
  | 'bitcoin'
  | 'ethereum'
  | 'altin'
  | 'gumus';

export type QuantityUnit = 'gram' | 'btc' | 'eth' | 'unit' | 'usd' | 'eur';

export interface UserAsset {
  id: string;
  user_id: string;
  portfolio_id: string;
  category: AssetCategory;
  asset_type: AssetType;
  title: string | null;
  quantity: number;
  quantity_unit: QuantityUnit;
  amount_usd: number;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AddAssetInput {
  portfolio_id: string;
  category: AssetCategory;
  asset_type: AssetType;
  title?: string;
  quantity: number;
  quantity_unit: QuantityUnit;
  amount_usd: number;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface ReduceAssetInput {
  assetId: string;
  reduceByUsd: number;
  reduceByQuantity?: number;
}

/**
 * useUserAssets
 * portfolioFilter:
 *  - undefined | null → tüm portföyler
 *  - string           → tek portföy
 *  - string[]         → birden fazla portföy ([] → hiç varlık)
 */
export function useUserAssets(portfolioFilter?: string | string[] | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: allAssets = [], isLoading } = useQuery({
    queryKey: ['user_assets', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_assets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UserAsset[];
    },
    enabled: !!user,
  });

  const assets = useMemo(() => {
    if (portfolioFilter == null) return allAssets;
    if (typeof portfolioFilter === 'string') {
      return allAssets.filter(a => a.portfolio_id === portfolioFilter);
    }
    if (portfolioFilter.length === 0) return [];
    const set = new Set(portfolioFilter);
    return allAssets.filter(a => set.has(a.portfolio_id));
  }, [allAssets, portfolioFilter]);

  const addAsset = useMutation({
    mutationFn: async (input: AddAssetInput) => {
      if (!user) throw new Error('Not authenticated');
      if (!input.portfolio_id) throw new Error('Portföy seçilmedi');
      const { data, error } = await supabase
        .from('user_assets')
        .insert({
          user_id: user.id,
          portfolio_id: input.portfolio_id,
          category: input.category,
          asset_type: input.asset_type,
          title: input.title || null,
          quantity: input.quantity,
          quantity_unit: input.quantity_unit,
          amount_usd: input.amount_usd,
          note: input.note || null,
          metadata: input.metadata || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as UserAsset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_assets', user?.id] });
      toast({ title: 'Varlık eklendi', description: 'Varlığınız kaydedildi.' });
    },
    onError: (error) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  // Reduce or delete an asset (used for Exchange / partial sell)
  const reduceAsset = useMutation({
    mutationFn: async ({ assetId, reduceByUsd, reduceByQuantity }: ReduceAssetInput) => {
      if (!user) throw new Error('Not authenticated');

      // Get current asset
      const { data: current, error: fetchError } = await supabase
        .from('user_assets')
        .select('*')
        .eq('id', assetId)
        .eq('user_id', user.id)
        .single();
      if (fetchError) throw fetchError;

      const asset = current as UserAsset;
      const newAmountUsd = asset.amount_usd - reduceByUsd;
      const newQuantity = reduceByQuantity != null ? asset.quantity - reduceByQuantity : asset.quantity;

      if (newAmountUsd <= 0.001 || newQuantity <= 0.0001) {
        // Delete the asset entirely
        const { error } = await supabase
          .from('user_assets')
          .delete()
          .eq('id', assetId)
          .eq('user_id', user.id);
        if (error) throw error;
        return null;
      } else {
        // Partial reduce
        const { data, error } = await supabase
          .from('user_assets')
          .update({
            amount_usd: newAmountUsd,
            quantity: newQuantity,
          })
          .eq('id', assetId)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        return data as UserAsset;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_assets', user?.id] });
    },
    onError: (error) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  const deleteAsset = useMutation({
    mutationFn: async (assetId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('user_assets')
        .delete()
        .eq('id', assetId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_assets', user?.id] });
      toast({ title: 'Varlık silindi' });
    },
    onError: (error) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  // Total USD value of (filtered) assets
  const totalAssetsUsd = assets.reduce((sum, a) => sum + a.amount_usd, 0);

  return {
    assets,
    allAssets,
    isLoading,
    totalAssetsUsd,
    addAsset,
    reduceAsset,
    deleteAsset,
  };
}
