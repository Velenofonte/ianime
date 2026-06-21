import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { collapseFranchises, fetchAnimeById, fetchAnimeByIds } from '../services/anilist';
import type { AnimeCard } from '../types/anime';

export const FAVORITES_QUERY_KEY = ['favorites'] as const;
export const FAVORITES_ANIME_QUERY_KEY = ['favorites-anime'] as const;

const FAVORITES_STALE_MS = Infinity;
const FAVORITES_ANIME_STALE_MS = Infinity;

function cardMatchesRemovedIds(card: AnimeCard, removedIds: number[]): boolean {
  const idSet = new Set(removedIds);
  if (idSet.has(card.id)) return true;
  return card.seasons.some((s) => idSet.has(s.id));
}

export function prefetchFavoritesAnime(qc: ReturnType<typeof useQueryClient>, ids: number[]) {
  if (!ids.length) return;
  void qc.prefetchQuery({
    queryKey: FAVORITES_ANIME_QUERY_KEY,
    queryFn: () => fetchAnimeByIds(ids),
    staleTime: FAVORITES_ANIME_STALE_MS,
  });
}

export function useFavorites() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null>(null);

  const { data: ids = [], isLoading } = useQuery({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: async () => (await api.getFavorites()).anilist_ids,
    enabled: !!user,
    staleTime: FAVORITES_STALE_MS,
  });

  useEffect(() => {
    const userId = user?.id ?? null;
    const prevUserId = prevUserIdRef.current;

    if (userId && userId !== prevUserId) {
      void qc.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY });
    }

    if (prevUserId && !userId) {
      qc.removeQueries({ queryKey: FAVORITES_QUERY_KEY });
      qc.removeQueries({ queryKey: FAVORITES_ANIME_QUERY_KEY });
    }

    prevUserIdRef.current = userId;
  }, [user?.id, qc]);

  useEffect(() => {
    if (!user || !ids.length) return;
    const cached = qc.getQueryData<AnimeCard[]>(FAVORITES_ANIME_QUERY_KEY);
    if (!cached?.length) prefetchFavoritesAnime(qc, ids);
  }, [user, ids, qc]);

  const addFavorite = useMutation({
    mutationFn: (anilistId: number) => api.addFavorite(anilistId),
    onMutate: async (anilistId) => {
      await qc.cancelQueries({ queryKey: FAVORITES_QUERY_KEY });
      const previousIds = qc.getQueryData<number[]>(FAVORITES_QUERY_KEY) ?? [];
      const previousAnime = qc.getQueryData<AnimeCard[]>(FAVORITES_ANIME_QUERY_KEY) ?? [];

      if (!previousIds.includes(anilistId)) {
        qc.setQueryData<number[]>(FAVORITES_QUERY_KEY, [...previousIds, anilistId]);
      }

      return { previousIds, previousAnime, anilistId };
    },
    onSuccess: async (_data, anilistId) => {
      const existing = qc.getQueryData<AnimeCard[]>(FAVORITES_ANIME_QUERY_KEY) ?? [];
      if (existing.some((c) => c.id === anilistId || c.seasons.some((s) => s.id === anilistId))) return;

      try {
        const card = await fetchAnimeById(anilistId);
        if (card) {
          qc.setQueryData<AnimeCard[]>(FAVORITES_ANIME_QUERY_KEY, [...existing, card]);
        }
      } catch {
        // La lista ID è aggiornata; i dettagli si ricaricano al prossimo prefetch
      }
    },
    onError: (_err, _anilistId, context) => {
      if (!context) return;
      qc.setQueryData(FAVORITES_QUERY_KEY, context.previousIds);
      qc.setQueryData(FAVORITES_ANIME_QUERY_KEY, context.previousAnime);
    },
  });

  const removeFavorite = useMutation({
    mutationFn: (removeIds: number[]) =>
      Promise.all(removeIds.map((id) => api.removeFavorite(id))),
    onMutate: async (removeIds) => {
      await qc.cancelQueries({ queryKey: FAVORITES_QUERY_KEY });
      const previousIds = qc.getQueryData<number[]>(FAVORITES_QUERY_KEY) ?? [];
      const previousAnime = qc.getQueryData<AnimeCard[]>(FAVORITES_ANIME_QUERY_KEY) ?? [];
      const removeSet = new Set(removeIds);

      qc.setQueryData<number[]>(
        FAVORITES_QUERY_KEY,
        previousIds.filter((id) => !removeSet.has(id))
      );
      qc.setQueryData<AnimeCard[]>(
        FAVORITES_ANIME_QUERY_KEY,
        previousAnime.filter((card) => !cardMatchesRemovedIds(card, removeIds))
      );

      return { previousIds, previousAnime };
    },
    onError: (_err, _removeIds, context) => {
      if (!context) return;
      qc.setQueryData(FAVORITES_QUERY_KEY, context.previousIds);
      qc.setQueryData(FAVORITES_ANIME_QUERY_KEY, context.previousAnime);
    },
  });

  return {
    ids,
    isLoading: !!user && isLoading,
    addFavorite,
    removeFavorite,
  };
}

export function useFavoritesAnime() {
  const { ids, isLoading: loadingIds } = useFavorites();

  const { data: anime = [], isLoading: loadingAnime } = useQuery({
    queryKey: FAVORITES_ANIME_QUERY_KEY,
    queryFn: () => fetchAnimeByIds(ids),
    enabled: ids.length > 0,
    staleTime: FAVORITES_ANIME_STALE_MS,
  });

  const franchiseAnime = collapseFranchises(anime);

  return {
    ids,
    anime,
    franchiseAnime,
    isLoading: loadingIds || (ids.length > 0 && loadingAnime),
  };
}
