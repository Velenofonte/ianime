import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimeCard } from '../components/AnimeCard';
import { FilterBar } from '../components/FilterBar';
import { SkeletonGrid } from '../components/Skeleton';
import {
  collapseFranchises,
  fetchTrendingAnime,
  filterAnimeClientSide,
  MIN_VISIBLE_RESULTS,
} from '../services/anilist';
import { useFilterStore } from '../store/filters';

function LoadMoreIndicator({ loading }: { loading: boolean }) {
  if (!loading) {
    return <div className="h-4" aria-hidden />;
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-center gap-3 text-gray-400">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"
          aria-hidden
        />
        <span>Caricamento altri anime...</span>
      </div>
      <SkeletonGrid count={4} />
    </div>
  );
}

export function HomePage() {
  const filters = useFilterStore();
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const wasFetchingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  const queryKey = useMemo(
    () =>
      [
        'anime',
        debouncedSearch,
        filters.genres,
        filters.status,
        filters.releaseOrder,
        filters.minStars,
        filters.minSeasons,
        filters.platform,
      ] as const,
    [
      debouncedSearch,
      filters.genres,
      filters.status,
      filters.releaseOrder,
      filters.minStars,
      filters.minSeasons,
      filters.platform,
    ]
  );

  const query = useInfiniteQuery({
    queryKey,
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

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [queryKey]);

  const needsMoreResults =
    filters.minSeasons > 0 || !!filters.platform || filters.status === 'FINISHED' || !!filters.airingDay;

  const allMedia = useMemo(() => {
    const raw = query.data?.pages.flatMap((p) => p.media) ?? [];
    const filtered = filterAnimeClientSide(raw, {
      minSeasons: filters.minSeasons,
      platform: filters.platform,
      status: filters.status || undefined,
      airingDay: filters.airingDay || undefined,
    });
    return collapseFranchises(filtered);
  }, [query.data, filters.minSeasons, filters.platform, filters.status, filters.airingDay]);

  const pageCount = query.data?.pages.length ?? 0;
  const isLoadingMore =
    query.isFetchingNextPage || (query.isFetching && !query.isLoading && pageCount > 0);

  useEffect(() => {
    if (query.isLoading || query.isFetching || !query.hasNextPage) return;
    if (!needsMoreResults || allMedia.length >= MIN_VISIBLE_RESULTS) return;
    query.fetchNextPage();
  }, [
    query.isLoading,
    query.isFetching,
    query.hasNextPage,
    needsMoreResults,
    allMedia.length,
    pageCount,
    query.fetchNextPage,
  ]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !query.hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetching) {
          query.fetchNextPage();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [query.hasNextPage, query.isFetching, pageCount, query.fetchNextPage]);

  useEffect(() => {
    const justFinished = wasFetchingRef.current && !query.isFetching;
    wasFetchingRef.current = query.isFetching;

    if (!justFinished || !query.hasNextPage || query.isLoading) return;

    const el = sentinelRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 400) {
      query.fetchNextPage();
    }
  }, [query.isFetching, query.isLoading, query.hasNextPage, query.fetchNextPage]);

  const showEmptyState =
    !query.isLoading && !query.isFetching && allMedia.length === 0 && pageCount > 0;
  const showFilteredEnd =
    !query.hasNextPage &&
    needsMoreResults &&
    allMedia.length > 0 &&
    allMedia.length < MIN_VISIBLE_RESULTS;

  return (
    <div>
      <FilterBar />
      <h1 className="mb-4 text-2xl font-bold">Anime popolari</h1>
      {query.isLoading && <SkeletonGrid />}
      {query.isError && (
        <div className="rounded-lg bg-red-500/10 p-4 text-red-400">
          <p>Errore nel caricamento: {(query.error as Error).message}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80 disabled:opacity-50"
          >
            {query.isFetching ? 'Riprovo...' : 'Riprova'}
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {allMedia.map((anime) => (
          <AnimeCard key={anime.franchiseKey} anime={anime} />
        ))}
      </div>

      {showEmptyState && (
        <div className="mt-8 rounded-lg border border-white/10 bg-surface-card p-6 text-center">
          <p className="text-gray-300">Nessun anime corrisponde ai filtri selezionati.</p>
          <button
            type="button"
            onClick={() => filters.reset()}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80"
          >
            Reset filtri
          </button>
        </div>
      )}

      {query.hasNextPage && (
        <div ref={sentinelRef}>
          <LoadMoreIndicator loading={isLoadingMore} />
        </div>
      )}

      {!query.hasNextPage && allMedia.length > 0 && (
        <p className="mt-8 text-center text-sm text-gray-500">
          {showFilteredEnd
            ? 'Fine risultati per questi filtri.'
            : 'Hai visto tutti i risultati disponibili.'}
        </p>
      )}
    </div>
  );
}
