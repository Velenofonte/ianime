import { useInfiniteQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchNewsPage, MIN_SEARCH_LENGTH, MIN_VISIBLE_NEWS } from '../services/aninews';

const SOURCES = [
  { label: 'Tutte', value: 'all' },
  { label: 'Crunchyroll', value: 'crunchyroll' },
  { label: 'ANN', value: 'ann' },
  { label: 'MyAnimeList', value: 'myanimelist' },
  { label: 'Anime Corner', value: 'animecorner' },
];

export function NewsPage() {
  const [source, setSource] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const wasFetchingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const isSearchMode = debouncedSearch.trim().length >= MIN_SEARCH_LENGTH;

  const queryKey = useMemo(
    () => ['news', source, isSearchMode ? debouncedSearch.trim() : ''] as const,
    [source, debouncedSearch, isSearchMode]
  );

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchNewsPage(source, { search: debouncedSearch, pageParam: pageParam as string | number | undefined }),
    initialPageParam: isSearchMode ? 0 : (undefined as string | undefined),
    getNextPageParam: (last) => {
      if (!last.hasMore) return undefined;
      if (last.nextOffset !== undefined) return last.nextOffset;
      return last.nextCursor;
    },
    staleTime: 900000,
  });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [queryKey]);

  const articles = useMemo(
    () => query.data?.pages.flatMap((p) => p.articles) ?? [],
    [query.data]
  );

  const pageCount = query.data?.pages.length ?? 0;
  const needsMoreResults = isSearchMode;
  const isLoadingMore =
    query.isFetchingNextPage || (query.isFetching && !query.isLoading && pageCount > 0);

  useEffect(() => {
    if (query.isLoading || query.isFetching || !query.hasNextPage) return;
    if (!needsMoreResults || articles.length >= MIN_VISIBLE_NEWS) return;
    query.fetchNextPage();
  }, [
    query.isLoading,
    query.isFetching,
    query.hasNextPage,
    needsMoreResults,
    articles.length,
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
  }, [query.hasNextPage, query.isFetching, pageCount, query.fetchNextPage, articles.length]);

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
    !query.isLoading &&
    !query.isFetching &&
    articles.length === 0 &&
    pageCount > 0 &&
    !query.hasNextPage;

  const showFilteredEnd =
    !query.hasNextPage &&
    isSearchMode &&
    articles.length > 0 &&
    articles.length < MIN_VISIBLE_NEWS;

  const searchTooShort =
    debouncedSearch.trim().length > 0 && debouncedSearch.trim().length < MIN_SEARCH_LENGTH;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">News anime</h1>

      <div className="mb-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-400">Cerca nel titolo o nella descrizione</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Es. One Piece, Crunchyroll..."
            className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm"
          />
        </label>
        {searchTooShort && (
          <p className="mt-1 text-xs text-gray-500">Inserisci almeno {MIN_SEARCH_LENGTH} caratteri per cercare.</p>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <button
            key={s.value}
            onClick={() => setSource(s.value)}
            className={`rounded-full px-3 py-1 text-sm ${
              source === s.value ? 'bg-accent text-white' : 'bg-surface-card text-gray-300 hover:bg-surface-hover'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {query.isLoading && <p className="text-gray-400">Caricamento news...</p>}
      {query.isError && <p className="text-red-400">Errore: {(query.error as Error).message}</p>}

      {showEmptyState && (
        <div className="rounded-lg border border-white/10 bg-surface-card p-6 text-center">
          <p className="text-gray-300">
            {isSearchMode
              ? 'Nessuna news corrisponde alla ricerca.'
              : 'Nessuna news disponibile.'}
          </p>
          {isSearchMode && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80"
            >
              Cancella ricerca
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {articles.map((article) => (
          <a
            key={article.slug}
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-4 rounded-xl border border-white/10 bg-surface-card p-4 transition hover:border-accent/30"
          >
            {article.image && (
              <img src={article.image} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
            )}
            <div>
              <p className="text-xs text-accent-light">{article.source}</p>
              <h2 className="font-semibold leading-tight">{article.title}</h2>
              {article.excerpt && <p className="mt-1 line-clamp-2 text-sm text-gray-400">{article.excerpt}</p>}
              <p className="mt-2 text-xs text-gray-500">
                {format(new Date(article.date), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
              </p>
            </div>
          </a>
        ))}
      </div>

      {query.hasNextPage && (
        <div ref={sentinelRef} className="mt-8">
          {isLoadingMore ? (
            <div className="flex items-center justify-center gap-3 text-gray-400">
              <div
                className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"
                aria-hidden
              />
              <span>
                {needsMoreResults && articles.length < MIN_VISIBLE_NEWS
                  ? 'Ricerca altre news...'
                  : 'Caricamento altre news...'}
              </span>
            </div>
          ) : (
            <div className="h-4" aria-hidden />
          )}
        </div>
      )}

      {!query.hasNextPage && articles.length > 0 && (
        <p className="mt-8 text-center text-sm text-gray-500">
          {showFilteredEnd ? 'Fine risultati per questa ricerca.' : 'Fine news.'}
        </p>
      )}
    </div>
  );
}
