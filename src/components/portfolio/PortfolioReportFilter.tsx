import { Folder, Layers } from 'lucide-react';
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue, SelectSeparator,
} from '@/components/ui/select';
import { usePortfolioContext } from '@/contexts/PortfolioContext';
import { PortfolioFilter } from '@/types/portfolio';

interface PortfolioReportFilterProps {
  className?: string;
}

const MODE_ALL_KEY = '__all__';
const MODE_ACTIVE_KEY = '__active__';
const MODE_CLOSED_KEY = '__closed__';

export function PortfolioReportFilter({ className }: PortfolioReportFilterProps) {
  const {
    portfolios,
    activePortfolios,
    closedPortfolios,
    reportFilter,
    setReportFilter,
  } = usePortfolioContext();

  const value =
    reportFilter.mode === 'all'    ? MODE_ALL_KEY :
    reportFilter.mode === 'active' ? MODE_ACTIVE_KEY :
    reportFilter.mode === 'closed' ? MODE_CLOSED_KEY :
    reportFilter.portfolioId ?? MODE_ALL_KEY;

  const handleChange = (next: string) => {
    let f: PortfolioFilter;
    if (next === MODE_ALL_KEY)    f = { mode: 'all', portfolioId: null };
    else if (next === MODE_ACTIVE_KEY) f = { mode: 'active', portfolioId: null };
    else if (next === MODE_CLOSED_KEY) f = { mode: 'closed', portfolioId: null };
    else f = { mode: 'single', portfolioId: next };
    setReportFilter(f);
  };

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2 truncate">
          <Folder className="w-4 h-4 text-primary shrink-0" />
          <SelectValue placeholder="Portföy filtresi" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Topluluk</SelectLabel>
          <SelectItem value={MODE_ALL_KEY}>
            <span className="inline-flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Tümü
            </span>
          </SelectItem>
          {activePortfolios.length > 0 && (
            <SelectItem value={MODE_ACTIVE_KEY}>Aktif portföyler</SelectItem>
          )}
          {closedPortfolios.length > 0 && (
            <SelectItem value={MODE_CLOSED_KEY}>Kapalı portföyler</SelectItem>
          )}
        </SelectGroup>

        {portfolios.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Tek Portföy</SelectLabel>
              {portfolios.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="inline-flex items-center gap-2">
                    <Folder className="w-4 h-4 text-muted-foreground" />
                    {p.name}
                    {p.status === 'closed' && (
                      <span className="text-[10px] text-muted-foreground ml-1">(kapalı)</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
