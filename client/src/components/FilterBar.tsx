import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchGenres } from '../services/anilist';
import { useFilterStore } from '../store/filters';
import { PLATFORM_OPTIONS, RELEASE_ORDER_OPTIONS, SCORE_FILTER_OPTIONS, STATUS_OPTIONS, AIRING_DAY_OPTIONS } from '../types/anime';

function countActiveFilters(filters: ReturnType<typeof useFilterStore.getState>) {
  let count = 0;
  if (filters.search) count += 1;
  if (filters.genres.length) count += 1;
  if (filters.status) count += 1;
  if (filters.minSeasons > 0) count += 1;
  if (filters.releaseOrder) count += 1;
  if (filters.minStars > 0) count += 1;
  if (filters.platform) count += 1;
  if (filters.airingDay) count += 1;
  return count;
}
function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-400">{label}</span>
      {children}
    </label>
  );
}

export function FilterBar() {
  const filters = useFilterStore();
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  const { data: genres = [] } = useQuery({ queryKey: ['genres'], queryFn: fetchGenres, staleTime: 86400000 });
  const activeCount = countActiveFilters(filters);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const update = () => setBarHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [genres.length, filters.panelOpen]);

  return (
    <>
      <div
        ref={barRef}
        className="fixed left-0 right-0 top-14 z-30 border-b border-white/10 bg-surface/95 px-4 py-3 backdrop-blur"
      >
        <div className="mx-auto max-w-7xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={filters.togglePanel}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-surface-hover"
              aria-expanded={filters.panelOpen}
            >
              <svg
                className={`h-4 w-4 transition-transform ${filters.panelOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {filters.panelOpen ? 'Nascondi filtri' : 'Mostra filtri'}
              {activeCount > 0 && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-xs text-white">{activeCount}</span>
              )}
            </button>
            {filters.panelOpen && activeCount > 0 && (
              <button
                type="button"
                onClick={filters.reset}
                className="text-sm text-gray-400 hover:text-white"
              >
                Reset filtri
              </button>
            )}
          </div>

          {filters.panelOpen && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <FilterField label="Titolo">
                  <input
                    type="search"
                    placeholder="Cerca per titolo..."
                    value={filters.search}
                    onChange={(e) => filters.setSearch(e.target.value)}
                    className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </FilterField>
                <FilterField label="Stato">
                  <select
                    value={filters.status}
                    onChange={(e) => filters.setStatus(e.target.value as typeof filters.status)}
                    className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Giorno uscita">
                  <select
                    value={filters.airingDay}
                    onChange={(e) => filters.setAiringDay(e.target.value as typeof filters.airingDay)}
                    className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm"
                  >
                    {AIRING_DAY_OPTIONS.map((o) => (
                      <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Stagioni">
                  <select
                    value={filters.minSeasons}
                    onChange={(e) => filters.setMinSeasons(Number(e.target.value))}
                    className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm"
                  >
                    <option value={0}>Tutte</option>
                    <option value={1}>Almeno 1</option>
                    <option value={2}>Almeno 2</option>
                    <option value={3}>Almeno 3</option>
                    <option value={4}>Almeno 4</option>
                  </select>
                </FilterField>
                <FilterField label="Uscita">
                  <select
                    value={filters.releaseOrder}
                    onChange={(e) => filters.setReleaseOrder(e.target.value as typeof filters.releaseOrder)}
                    className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm"
                  >
                    {RELEASE_ORDER_OPTIONS.map((o) => (
                      <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Score">
                  <select
                    value={filters.minStars}
                    onChange={(e) => filters.setMinStars(Number(e.target.value))}
                    className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm"
                  >
                    {SCORE_FILTER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Piattaforma">
                  <select
                    value={filters.platform}
                    onChange={(e) => filters.setPlatform(e.target.value)}
                    className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm"
                  >
                    {PLATFORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </FilterField>
                <div className="hidden items-end xl:flex">
                  <button
                    type="button"
                    onClick={() => filters.reset()}
                    className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-surface-hover"
                  >
                    Reset filtri
                  </button>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-gray-400">Generi</p>
                <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto md:max-h-32">
                {genres.map((g) => {
                  const active = filters.genres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() =>
                        filters.setGenres(
                          active ? filters.genres.filter((x) => x !== g) : [...filters.genres, g]
                        )
                      }
                      className={`rounded-full px-3 py-1 text-xs transition ${
                        active ? 'bg-accent text-white' : 'bg-surface-hover text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div aria-hidden style={{ height: barHeight }} />
    </>
  );
}
