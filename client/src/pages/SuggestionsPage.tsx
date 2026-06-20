import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnimeCard } from '../components/AnimeCard';
import { SkeletonGrid } from '../components/Skeleton';
import { api } from '../services/api';
import { fetchRecommendationsPage } from '../services/anilist';

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
        <span>Caricamento altri suggerimenti...</span>
      </div>
      <SkeletonGrid count={4} />
    </div>
  );
}

export function SuggestionsPage() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const wasFetchingRef = useRef(false);

  const { data: ids = [], isLoading: loadingIds } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => (await api.getFavorites()).anilist_ids,
  });

  const query = useInfiniteQuery({
    queryKey: ['recommendations', ids],
    queryFn: ({ pageParam }) => fetchRecommendationsPage(ids, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.hasNextPage ? pages.length + 1 : undefined),
    enabled: ids.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => 2000 * (attempt + 1),
  });

  const allMedia = useMemo(() => {
    const seen = new Set<string>();
    const result = [];
    for (const page of query.data?.pages ?? []) {
      for (const anime of page.media) {
        if (seen.has(anime.franchiseKey)) continue;
        seen.add(anime.franchiseKey);
        result.push(anime);
      }
    }
    return result;
  }, [query.data]);

  const pageCount = query.data?.pages.length ?? 0;
  const isLoadingMore =
    query.isFetchingNextPage || (query.isFetching && !query.isLoading && pageCount > 0);

  useEffect(() => {
    if (query.isLoading || query.isFetching || !query.hasNextPage) return;
    const pages = query.data?.pages ?? [];
    const lastPage = pages.length ? pages[pages.length - 1] : undefined;
    if (!lastPage || lastPage.media.length > 0) return;

    let consecutiveEmpty = 0;
    for (let i = pages.length - 1; i >= 0; i--) {
      if (pages[i].media.length > 0) break;
      consecutiveEmpty++;
    }
    if (consecutiveEmpty > 5) return;

    const t = setTimeout(() => query.fetchNextPage(), 800);
    return () => clearTimeout(t);
  }, [
    query.isLoading,
    query.isFetching,
    query.hasNextPage,
    query.data?.pages,
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

  if (loadingIds || query.isLoading) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold">Suggerimenti</h1>
        <p className="mb-6 text-sm text-gray-400">Basato sui tuoi preferiti · consigli dalla community AniList</p>
        <SkeletonGrid count={4} />
      </div>
    );
  }

  if (!ids.length) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-2 text-2xl font-bold">Suggerimenti</h1>
        <p className="mb-4 text-gray-400">Aggiungi anime ai preferiti per ricevere suggerimenti personalizzati.</p>
        <Link to="/" className="text-accent-light hover:underline">
          Esplora anime →
        </Link>
      </div>
    );
  }

  if (query.isError && !query.data?.pages.length) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold">Suggerimenti</h1>
        <p className="mb-6 text-sm text-gray-400">Basato sui tuoi preferiti · consigli dalla community AniList</p>
        <p className="rounded-lg bg-red-500/10 p-4 text-red-400">
          Errore nel caricamento: {(query.error as Error).message}
        </p>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80 disabled:opacity-50"
        >
          {query.isFetching ? 'Riprovo...' : 'Riprova'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Suggerimenti</h1>
      <p className="mb-6 text-sm text-gray-400">Basato sui tuoi preferiti · consigli dalla community AniList</p>

      {!allMedia.length ? (
        <p className="rounded-lg bg-surface-card p-4 text-gray-400">
          Nessun suggerimento disponibile al momento. Prova ad aggiungere altri preferiti.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allMedia.map((a) => (
              <AnimeCard key={a.franchiseKey} anime={a} />
            ))}
          </div>

          {query.hasNextPage && (
            <div ref={sentinelRef}>
              <LoadMoreIndicator loading={isLoadingMore} />
            </div>
          )}

          {query.isFetchNextPageError && (
            <div className="mt-6 rounded-lg bg-red-500/10 p-4 text-center">
              <p className="text-red-400">
                Errore nel caricamento: {(query.error as Error).message}
              </p>
              <button
                type="button"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetching}
                className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80 disabled:opacity-50"
              >
                {query.isFetching ? 'Riprovo...' : 'Riprova'}
              </button>
            </div>
          )}

          {!query.hasNextPage && (
            <p className="mt-8 text-center text-sm text-gray-500">
              Fine suggerimenti per i tuoi preferiti.
            </p>
          )}
        </>
      )}
    </div>
  );
}
