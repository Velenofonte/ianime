import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AnimeCard } from '../components/AnimeCard';
import { FilterBar } from '../components/FilterBar';
import { SkeletonGrid } from '../components/Skeleton';
import { fetchTrendingAnime, filterAnimeClientSide } from '../services/anilist';
import { useFilterStore } from '../store/filters';

export function HomePage() {
  const filters = useFilterStore();
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  const query = useInfiniteQuery({
    queryKey: ['anime', debouncedSearch, filters.genres, filters.status, filters.releaseOrder, filters.minStars],
    queryFn: ({ pageParam = 1 }) =>
      fetchTrendingAnime({
        page: pageParam,
        search: debouncedSearch || undefined,
        genres: filters.genres.length ? filters.genres : undefined,
        status: filters.status || undefined,
        releaseOrder: filters.releaseOrder || undefined,
        minStars: filters.minStars || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.hasNextPage ? pages.length + 1 : undefined),
    staleTime: 300000,
  });

  const allMedia = useMemo(() => {
    const raw = query.data?.pages.flatMap((p) => p.media) ?? [];
    return filterAnimeClientSide(raw, { minSeasons: filters.minSeasons, platform: filters.platform });
  }, [query.data, filters.minSeasons, filters.platform]);

  return (
    <div>
      <FilterBar />
      <h1 className="mb-4 text-2xl font-bold">Anime popolari</h1>
      {query.isLoading && <SkeletonGrid />}
      {query.isError && (
        <p className="rounded-lg bg-red-500/10 p-4 text-red-400">
          Errore nel caricamento: {(query.error as Error).message}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {allMedia.map((anime) => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>
      {query.hasNextPage && (
        <div className="mt-8 text-center">
          <button
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="rounded-lg bg-accent px-6 py-2 font-medium text-white hover:bg-accent/80 disabled:opacity-50"
          >
            {query.isFetchingNextPage ? 'Caricamento...' : 'Carica altri'}
          </button>
        </div>
      )}
    </div>
  );
}
