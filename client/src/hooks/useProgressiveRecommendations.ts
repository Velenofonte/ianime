import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FAVORITES_ANIME_QUERY_KEY } from './useFavorites';
import {
  attachRecommendationReasons,
  favoriteTitleMap,
  fetchRecommendationScoresBatched,
  fetchRecommendationsPage,
  hydrateRecommendationCards,
  loadFavoriteExclusions,
  rankRecommendationIds,
  scoreForRecommendationCard,
} from '../services/anilist';
import { hideSuggestion } from '../services/hiddenSuggestions';
import type { AnimeCard } from '../types/anime';

const RECOMMENDATIONS_STALE_MS = 30 * 60 * 1000;

interface RecommendationsCache {
  media: AnimeCard[];
  hasNextPage: boolean;
  loadedRecPages: number;
}

function favoritesKey(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(',');
}

export function recommendationsQueryKey(ids: number[]) {
  return ['recommendations', favoritesKey(ids)] as const;
}

function mergeMediaByScore(existing: AnimeCard[], incoming: AnimeCard[], scores: Map<number, number>): AnimeCard[] {
  const byKey = new Map<string, AnimeCard>();
  for (const card of [...existing, ...incoming]) {
    byKey.set(card.franchiseKey, card);
  }
  return [...byKey.values()].sort(
    (a, b) => scoreForRecommendationCard(b, scores) - scoreForRecommendationCard(a, scores)
  );
}

function trackHydratedIds(cards: AnimeCard[], hydratedIds: Set<number>): void {
  for (const card of cards) {
    hydratedIds.add(card.id);
    for (const season of card.seasons) {
      hydratedIds.add(season.id);
    }
  }
}

export function useProgressiveRecommendations(ids: number[]) {
  const qc = useQueryClient();
  const idsKey = useMemo(() => favoritesKey(ids), [ids]);
  const initialCache = ids.length
    ? qc.getQueryData<RecommendationsCache>(recommendationsQueryKey(ids))
    : undefined;

  const [media, setMedia] = useState<AnimeCard[]>(() => initialCache?.media ?? []);
  const [hasNextPage, setHasNextPage] = useState(() => initialCache?.hasNextPage ?? false);
  const [loadedRecPages, setLoadedRecPages] = useState(() => initialCache?.loadedRecPages ?? 0);
  const [isInitialLoading, setIsInitialLoading] = useState(() => !initialCache);
  const [isAnalyzingFavorites, setIsAnalyzingFavorites] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const scoresRef = useRef(new Map<number, number>());
  const hydratedIdsRef = useRef(new Set<number>());
  const runIdRef = useRef(0);
  const hydratedFromCacheRef = useRef(false);

  if (initialCache && !hydratedFromCacheRef.current) {
    trackHydratedIds(initialCache.media, hydratedIdsRef.current);
    hydratedFromCacheRef.current = true;
  }

  const applyCache = useCallback((cached: RecommendationsCache) => {
    hydratedIdsRef.current = new Set();
    trackHydratedIds(cached.media, hydratedIdsRef.current);
    setMedia(cached.media);
    setHasNextPage(cached.hasNextPage);
    setLoadedRecPages(cached.loadedRecPages);
    setIsInitialLoading(false);
    setIsAnalyzingFavorites(false);
    setError(null);
  }, []);

  const persistCache = useCallback(
    (nextMedia: AnimeCard[], nextHasNextPage: boolean, nextLoadedRecPages: number) => {
      qc.setQueryData<RecommendationsCache>(recommendationsQueryKey(ids), {
        media: nextMedia,
        hasNextPage: nextHasNextPage,
        loadedRecPages: nextLoadedRecPages,
      });
    },
    [ids, qc]
  );

  useEffect(() => {
    if (!ids.length) {
      setMedia([]);
      setHasNextPage(false);
      setLoadedRecPages(0);
      setIsInitialLoading(false);
      setIsAnalyzingFavorites(false);
      setError(null);
      return;
    }

    const cached = qc.getQueryData<RecommendationsCache>(recommendationsQueryKey(ids));
    if (cached) {
      applyCache(cached);
      return;
    }

    const runId = ++runIdRef.current;
    scoresRef.current = new Map();
    hydratedIdsRef.current = new Set();
    hydratedFromCacheRef.current = false;

    setIsInitialLoading(true);
    setIsAnalyzingFavorites(false);
    setError(null);
    setMedia([]);
    setHasNextPage(false);
    setLoadedRecPages(0);

    async function loadFirstPage() {
      try {
        const prefetchedCards = qc.getQueryData<AnimeCard[]>(FAVORITES_ANIME_QUERY_KEY);
        const exclusions = await loadFavoriteExclusions(ids, prefetchedCards);
        if (runId !== runIdRef.current) return;

        const sourceIds = ids.slice(0, 50);
        const titles = favoriteTitleMap(prefetchedCards);
        let hasMore = false;

        setIsAnalyzingFavorites(sourceIds.length > 8);

        await fetchRecommendationScoresBatched(
          sourceIds,
          1,
          exclusions,
          async ({ scores, sources, hasNextPage: batchHasNext }) => {
            if (runId !== runIdRef.current) return;

            scoresRef.current = scores;
            hasMore = hasMore || batchHasNext;

            const rankedIds = rankRecommendationIds(scores);
            const hydrated = await hydrateRecommendationCards(rankedIds, exclusions, hydratedIdsRef.current);
            if (runId !== runIdRef.current) return;

            const newCards = attachRecommendationReasons(hydrated, sources, titles);
            trackHydratedIds(newCards, hydratedIdsRef.current);

            setMedia((prev) => {
              const merged = mergeMediaByScore(prev, newCards, scores);
              persistCache(merged, hasMore, 1);
              return merged;
            });

            if (newCards.length) setIsInitialLoading(false);
            setIsAnalyzingFavorites(true);
          }
        );

        if (runId !== runIdRef.current) return;

        setHasNextPage(hasMore);
        setLoadedRecPages(1);
        setIsAnalyzingFavorites(false);
        setIsInitialLoading(false);

        setMedia((prev) => {
          persistCache(prev, hasMore, 1);
          return prev;
        });
      } catch (err) {
        if (runId !== runIdRef.current) return;
        setError(err instanceof Error ? err : new Error('Errore nel caricamento'));
        setIsInitialLoading(false);
        setIsAnalyzingFavorites(false);
      }
    }

    void loadFirstPage();
  }, [idsKey, ids, qc, applyCache, persistCache]);

  const fetchNextPage = useCallback(async () => {
    if (!ids.length || isLoadingMore || !hasNextPage) return;

    const nextPage = loadedRecPages + 1;
    setIsLoadingMore(true);
    setError(null);

    try {
      const prefetchedCards = qc.getQueryData<AnimeCard[]>(FAVORITES_ANIME_QUERY_KEY);
      const result = await fetchRecommendationsPage(ids, nextPage, { prefetchedFavoriteCards: prefetchedCards });
      const seen = new Set(media.map((card) => card.franchiseKey));
      const merged = [
        ...media,
        ...result.media.filter((card) => !seen.has(card.franchiseKey)),
      ];

      setMedia(merged);
      setHasNextPage(result.hasNextPage);
      setLoadedRecPages(nextPage);
      persistCache(merged, result.hasNextPage, nextPage);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Errore nel caricamento'));
    } finally {
      setIsLoadingMore(false);
    }
  }, [ids, isLoadingMore, hasNextPage, loadedRecPages, media, qc, persistCache]);

  const hideCard = useCallback(
    (card: AnimeCard) => {
      const relatedIds = card.seasons.length ? card.seasons.map((season) => season.id) : [card.id];
      hideSuggestion(relatedIds, card.titleSlug);
      setMedia((prev) => {
        const next = prev.filter((item) => item.franchiseKey !== card.franchiseKey);
        persistCache(next, hasNextPage, loadedRecPages);
        return next;
      });
    },
    [hasNextPage, loadedRecPages, persistCache]
  );

  const refetch = useCallback(() => {
    qc.removeQueries({ queryKey: recommendationsQueryKey(ids) });
    scoresRef.current = new Map();
    hydratedIdsRef.current = new Set();
    hydratedFromCacheRef.current = false;
    runIdRef.current += 1;
    setIsInitialLoading(true);
    setMedia([]);
    setHasNextPage(false);
    setLoadedRecPages(0);
    setError(null);

    const runId = runIdRef.current;

    void (async () => {
      try {
        const prefetchedCards = qc.getQueryData<AnimeCard[]>(FAVORITES_ANIME_QUERY_KEY);
        const exclusions = await loadFavoriteExclusions(ids, prefetchedCards);
        if (runId !== runIdRef.current) return;

        const sourceIds = ids.slice(0, 50);
        const titles = favoriteTitleMap(prefetchedCards);
        let hasMore = false;

        setIsAnalyzingFavorites(sourceIds.length > 8);

        await fetchRecommendationScoresBatched(
          sourceIds,
          1,
          exclusions,
          async ({ scores, sources, hasNextPage: batchHasNext }) => {
            if (runId !== runIdRef.current) return;
            scoresRef.current = scores;
            hasMore = hasMore || batchHasNext;

            const rankedIds = rankRecommendationIds(scores);
            const hydrated = await hydrateRecommendationCards(rankedIds, exclusions, hydratedIdsRef.current);
            if (runId !== runIdRef.current) return;

            const newCards = attachRecommendationReasons(hydrated, sources, titles);
            trackHydratedIds(newCards, hydratedIdsRef.current);
            setMedia((prev) => mergeMediaByScore(prev, newCards, scores));
            if (newCards.length) setIsInitialLoading(false);
          }
        );

        if (runId !== runIdRef.current) return;
        setHasNextPage(hasMore);
        setLoadedRecPages(1);
        setIsAnalyzingFavorites(false);
        setIsInitialLoading(false);
        setMedia((prev) => {
          persistCache(prev, hasMore, 1);
          return prev;
        });
      } catch (err) {
        if (runId !== runIdRef.current) return;
        setError(err instanceof Error ? err : new Error('Errore nel caricamento'));
        setIsInitialLoading(false);
        setIsAnalyzingFavorites(false);
      }
    })();
  }, [ids, qc, persistCache]);

  return {
    media,
    isInitialLoading,
    isAnalyzingFavorites,
    isLoadingMore,
    hasNextPage,
    isError: !!error,
    error,
    fetchNextPage,
    hideCard,
    refetch,
    staleTime: RECOMMENDATIONS_STALE_MS,
  };
}
