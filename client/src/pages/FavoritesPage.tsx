import { Link } from 'react-router-dom';
import { AnimeCard } from '../components/AnimeCard';
import { SkeletonGrid } from '../components/Skeleton';
import { useFavoritesAnime } from '../hooks/useFavorites';

export function FavoritesPage() {
  const { ids, franchiseAnime, isLoading } = useFavoritesAnime();

  if (isLoading) return <SkeletonGrid count={4} />;

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
      <h1 className="mb-6 flex items-baseline gap-1.5 text-2xl font-bold">
        I tuoi preferiti
        <span className="text-xs font-medium tabular-nums text-gray-400">({franchiseAnime.length})</span>
      </h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {franchiseAnime.map((a) => (
          <AnimeCard key={a.franchiseKey} anime={a} />
        ))}
      </div>
    </div>
  );
}
