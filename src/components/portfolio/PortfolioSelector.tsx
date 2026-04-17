import { Folder, FolderOpen, FolderClosed, Layers } from 'lucide-react';
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue, SelectSeparator,
} from '@/components/ui/select';
import { usePortfolioContext, ActivePortfolioSelection } from '@/contexts/PortfolioContext';

interface PortfolioSelectorProps {
  className?: string;
  /** "Tümü" seçeneği gösterilsin mi (İşlemlerim'de evet, trade formunda hayır) */
  includeAll?: boolean;
  /** Kapalı portföyleri seçim için göster (İşlemlerim'de evet) */
  includeClosed?: boolean;
}

export function PortfolioSelector({
  className,
  includeAll = true,
  includeClosed = true,
}: PortfolioSelectorProps) {
  const {
    activePortfolios,
    closedPortfolios,
    activeSelection,
    setActiveSelection,
  } = usePortfolioContext();

  const value: string = activeSelection === null ? '' : activeSelection;

  const handleChange = (next: string) => {
    const parsed: ActivePortfolioSelection =
      next === 'all' ? 'all' : next;
    setActiveSelection(parsed);
  };

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2 truncate">
          <Folder className="w-4 h-4 text-primary shrink-0" />
          <SelectValue placeholder="Portföy seç" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {includeAll && (
          <>
            <SelectItem value="all">
              <span className="inline-flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Tümü
              </span>
            </SelectItem>
            {(activePortfolios.length > 0 || (includeClosed && closedPortfolios.length > 0)) && (
              <SelectSeparator />
            )}
          </>
        )}

        {activePortfolios.length > 0 && (
          <SelectGroup>
            <SelectLabel>Aktif Portföyler</SelectLabel>
            {activePortfolios.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="inline-flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-profit" />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {includeClosed && closedPortfolios.length > 0 && (
          <SelectGroup>
            <SelectLabel>Kapalı Portföyler</SelectLabel>
            {closedPortfolios.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <FolderClosed className="w-4 h-4" />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
