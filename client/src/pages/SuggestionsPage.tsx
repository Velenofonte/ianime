import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnimeCard } from '../components/AnimeCard';
import { SkeletonGrid } from '../components/Skeleton';
import { useFavorites } from '../hooks/useFavorites';
import { useProgressiveRecommendations } from '../hooks/useProgressiveRecommendations';
import { useScrollRestoration } from '../hooks/useScrollRestoration';

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

  useScrollRestoration('suggerimenti');

  const { ids, isLoading: loadingIds } = useFavorites();
  const query = useProgressiveRecommendations(ids);

  const isFetching = query.isLoadingMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !query.hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && query.hasNextPage && !isFetching) {
          void query.fetchNextPage();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [query.hasNextPage, isFetching, query.media.length, query.fetchNextPage]);

  useEffect(() => {
    const justFinished = wasFetchingRef.current && !isFetching;
    wasFetchingRef.current = isFetching;

    if (!justFinished || !query.hasNextPage || query.isInitialLoading) return;

    const el = sentinelRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 400) {
      void query.fetchNextPage();
    }
  }, [isFetching, query.isInitialLoading, query.hasNextPage, query.fetchNextPage]);

  if (loadingIds || query.isInitialLoading) {
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

  if (query.isError && !query.media.length) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold">Suggerimenti</h1>
        <p className="mb-6 text-sm text-gray-400">Basato sui tuoi preferiti · consigli dalla community AniList</p>
        <p className="rounded-lg bg-red-500/10 p-4 text-red-400">
          Errore nel caricamento: {query.error?.message}
        </p>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isInitialLoading || query.isAnalyzingFavorites}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80 disabled:opacity-50"
        >
          {query.isInitialLoading ? 'Riprovo...' : 'Riprova'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Suggerimenti</h1>
      <p className="mb-6 text-sm text-gray-400">Basato sui tuoi preferiti · consigli dalla community AniList</p>

      {query.isAnalyzingFavorites && (
        <p className="mb-4 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2 text-sm text-gray-300">
          Analisi di altri preferiti in corso…
        </p>
      )}

      {!query.media.length ? (
        <p className="rounded-lg bg-surface-card p-4 text-gray-400">
          Nessun suggerimento disponibile al momento. Prova ad aggiungere altri preferiti.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {query.media.map((a) => (
              <AnimeCard key={a.franchiseKey} anime={a} onHide={() => query.hideCard(a)} />
            ))}
          </div>

          {query.hasNextPage && (
            <div ref={sentinelRef}>
              <LoadMoreIndicator loading={query.isLoadingMore} />
            </div>
          )}

          {query.isError && (
            <div className="mt-6 rounded-lg bg-red-500/10 p-4 text-center">
              <p className="text-red-400">Errore nel caricamento: {query.error?.message}</p>
              <button
                type="button"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isLoadingMore}
                className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80 disabled:opacity-50"
              >
                {query.isLoadingMore ? 'Riprovo...' : 'Riprova'}
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
