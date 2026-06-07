import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AnimeCard } from '../components/AnimeCard';
import { SkeletonGrid } from '../components/Skeleton';
import { api } from '../services/api';
import { collapseFranchises, fetchAnimeByIds } from '../services/anilist';

export function FavoritesPage() {
  const { data: ids = [], isLoading: loadingIds } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => (await api.getFavorites()).anilist_ids,
  });

  const { data: anime = [], isLoading: loadingAnime } = useQuery({
    queryKey: ['favorites-anime', ids],
    queryFn: () => fetchAnimeByIds(ids),
    enabled: ids.length > 0,
  });

  const franchiseAnime = useMemo(() => collapseFranchises(anime), [anime]);

  if (loadingIds || loadingAnime) return <SkeletonGrid count={4} />;

  if (!ids.length) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-gray-400">Non hai ancora preferiti.</p>
        <Link to="/" className="text-accent-light hover:underline">Esplora anime →</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">I tuoi preferiti</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {franchiseAnime.map((a) => (
          <AnimeCard key={a.franchiseKey} anime={a} />
        ))}
      </div>
    </div>
  );
}
