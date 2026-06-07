import type { AnimeCard as AnimeCardType } from '../types/anime';
import { Link } from 'react-router-dom';
import { FavoriteButton } from './FavoriteButton';
import { PosterImage } from './PosterImage';
import { StarRating } from './StarRating';

export function AnimeCard({ anime }: { anime: AnimeCardType }) {
  const seasonIds = anime.seasons.length ? anime.seasons.map((s) => s.id) : [anime.id];
  const isAiring = anime.franchiseStatus === 'RELEASING';

  return (
    <Link
      to={`/anime/${anime.canonicalSeasonId}`}
      onClick={(e) => {
        if ((e.target as Element).closest('button')) e.preventDefault();
      }}
      className="group block overflow-hidden rounded-xl border border-white/5 bg-surface-card transition hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5"
    >
      <PosterImage src={anime.coverImage} alt={anime.franchiseTitle}>
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs">
          {anime.franchiseStatusLabel}
        </span>
      </PosterImage>
      <div className="space-y-2 p-4">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-2 flex-1 font-semibold leading-tight">{anime.franchiseTitle}</h3>
          <FavoriteButton anilistId={anime.canonicalSeasonId} relatedIds={seasonIds} inline />
        </div>
        <StarRating score={anime.averageScore} />
        <div className="flex flex-wrap gap-1">
          {anime.genres.slice(0, 3).map((g) => (
            <span key={g} className="rounded bg-surface-hover px-2 py-0.5 text-xs text-gray-300">{g}</span>
          ))}
        </div>
        <p className="line-clamp-3 text-xs text-gray-400">{anime.description}</p>
        <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
          <span>Stagioni: {anime.seasonCount}</span>
          <span>{anime.italianAudioLabel}</span>
          {isAiring && anime.airingDay && (
            <span className="col-span-2">
              Uscita: {anime.airingDay}{anime.airingTime ? ` ${anime.airingTime}` : ''}
            </span>
          )}
        </div>
        {anime.italianPlatforms.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {anime.italianPlatforms.slice(0, 3).map((p) => (
              <span key={p} className="rounded border border-accent/30 px-1.5 py-0.5 text-xs text-accent-light">{p}</span>
            ))}
          </div>
        )}
        {anime.platforms.length > 0 && (
          <p className="text-xs text-gray-500">
            Streaming: {anime.platforms.slice(0, 4).join(', ')}
          </p>
        )}
      </div>
    </Link>
  );
}
