import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { Portfolio, PortfolioStatus } from '@/types/portfolio';

const DEFAULT_PORTFOLIO_NAME = 'Ana Portföy';

export function usePortfolios() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: portfolios = [], isLoading, error } = useQuery({
    queryKey: ['portfolios', user?.id],
    queryFn: async (): Promise<Portfolio[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;

      // İlk oturumda kullanıcı için hiç portföy yoksa otomatik bir "Ana Portföy" yarat
      if ((data?.length ?? 0) === 0) {
        const { data: created, error: createErr } = await supabase
          .from('portfolios')
          .insert({ user_id: user.id, name: DEFAULT_PORTFOLIO_NAME })
          .select('*')
          .single();
        if (createErr) throw createErr;
        return [created as Portfolio];
      }

      return data as Portfolio[];
    },
    enabled: !!user,
    staleTime: 1000 * 30,
  });

  const createPortfolio = useMutation({
    mutationFn: async ({ name }: { name: string }): Promise<Portfolio> => {
      if (!user) throw new Error('Not authenticated');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Portföy adı boş olamaz');

      const { data, error } = await supabase
        .from('portfolios')
        .insert({ user_id: user.id, name: trimmed })
        .select('*')
        .single();

      if (error) throw error;
      return data as Portfolio;
    },
    onSuccess: (portfolio) => {
      queryClient.setQueryData<Portfolio[]>(
        ['portfolios', user?.id],
        (old = []) => [...old, portfolio]
      );
      toast({
        title: 'Portföy oluşturuldu',
        description: `"${portfolio.name}" portföyü açıldı.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Hata',
        description: 'Portföy oluşturulamadı: ' + (err as Error).message,
        variant: 'destructive',
      });
    },
  });

  const renamePortfolio = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }): Promise<Portfolio> => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Portföy adı boş olamaz');
      const { data, error } = await supabase
        .from('portfolios')
        .update({ name: trimmed })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as Portfolio;
    },
    onSuccess: (portfolio) => {
      queryClient.setQueryData<Portfolio[]>(
        ['portfolios', user?.id],
        (old = []) => old.map(p => p.id === portfolio.id ? portfolio : p)
      );
    },
    onError: (err) => {
      toast({ title: 'Hata', description: (err as Error).message, variant: 'destructive' });
    },
  });

  const setPortfolioStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PortfolioStatus }): Promise<Portfolio> => {
      const { data, error } = await supabase
        .from('portfolios')
        .update({ status })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as Portfolio;
    },
    onSuccess: (portfolio) => {
      queryClient.setQueryData<Portfolio[]>(
        ['portfolios', user?.id],
        (old = []) => old.map(p => p.id === portfolio.id ? portfolio : p)
      );
      toast({
        title: portfolio.status === 'closed' ? 'Portföy kapatıldı' : 'Portföy yeniden açıldı',
        description: portfolio.name,
      });
    },
    onError: (err) => {
      toast({ title: 'Hata', description: (err as Error).message, variant: 'destructive' });
    },
  });

  const deletePortfolio = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('portfolios').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<Portfolio[]>(
        ['portfolios', user?.id],
        (old = []) => old.filter(p => p.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: ['trades', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['trade_partial_closes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['portfolio_cash_flows', user?.id] });
      toast({ title: 'Portföy silindi' });
    },
    onError: (err) => {
      toast({ title: 'Hata', description: (err as Error).message, variant: 'destructive' });
    },
  });

  const activePortfolios = portfolios.filter(p => p.status === 'active');
  const closedPortfolios = portfolios.filter(p => p.status === 'closed');

  return {
    portfolios,
    activePortfolios,
    closedPortfolios,
    isLoading,
    error,
    createPortfolio,
    renamePortfolio,
    setPortfolioStatus,
    deletePortfolio,
  };
}
