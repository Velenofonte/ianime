import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { FavoriteButton } from '../components/FavoriteButton';
import { PosterImage } from '../components/PosterImage';
import { StarRating } from '../components/StarRating';
import { fetchAnimeById, seasonStatusLabel } from '../services/anilist';

function BackLink() {
  return (
    <Link
      to="/"
      className="mb-6 inline-flex items-center text-sm text-gray-400 transition hover:text-accent-light"
    >
      ← Torna indietro
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid gap-6 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
        <div className="aspect-[2/3] w-full max-w-xs rounded-xl bg-surface-hover" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 rounded bg-surface-hover" />
          <div className="h-4 w-1/3 rounded bg-surface-hover" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 w-16 rounded bg-surface-hover" />
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-surface-hover" />
            <div className="h-3 w-full rounded bg-surface-hover" />
            <div className="h-3 w-2/3 rounded bg-surface-hover" />
          </div>
        </div>
      </div>
    </div>
  );
}

function seasonListLabel(season: { title: string; seasonNumber: number | null }, index: number): string {
  if (season.seasonNumber !== null) {
    const hasPart = /\bpart\s*\d+\b/i.test(season.title) || /\bcour\s*\d+\b/i.test(season.title);
    if (hasPart) return season.title;
    return `Stagione ${season.seasonNumber}`;
  }
  return index === 0 ? 'Stagione 1' : `Stagione ${index + 1}`;
}

export function AnimeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const animeId = Number(id);
  const validId = Number.isFinite(animeId) && animeId > 0;

  const query = useQuery({
    queryKey: ['anime', animeId],
    queryFn: () => fetchAnimeById(animeId),
    enabled: validId,
  });

  if (!validId) {
    return (
      <div>
        <BackLink />
        <p className="rounded-lg bg-surface-card p-4 text-gray-400">Anime non trovato.</p>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div>
        <BackLink />
        <DetailSkeleton />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div>
        <BackLink />
        <p className="rounded-lg bg-red-500/10 p-4 text-red-400">
          Errore nel caricamento: {(query.error as Error).message}
        </p>
      </div>
    );
  }

  if (!query.data) {
    return (
      <div>
        <BackLink />
        <p className="rounded-lg bg-surface-card p-4 text-gray-400">Anime non trovato.</p>
      </div>
    );
  }

  const anime = query.data;
  const seasonIds = anime.seasons.length ? anime.seasons.map((s) => s.id) : [anime.id];
  const displaySeason =
    anime.seasons.find((s) => s.id === animeId) ??
    anime.seasons.find((s) => s.id === anime.canonicalSeasonId) ??
    null;
  const isAiring = anime.franchiseStatus === 'RELEASING';

  return (
    <div>
      <BackLink />
      <div className="grid gap-6 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
        <div className="mx-auto w-full max-w-xs md:mx-0">
          <div className="overflow-hidden rounded-xl border border-white/5 bg-surface-card">
            <PosterImage src={anime.coverImage} alt={anime.franchiseTitle}>
              <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs">
                {anime.franchiseStatusLabel}
              </span>
            </PosterImage>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <h1 className="flex-1 text-2xl font-bold leading-tight">{anime.franchiseTitle}</h1>
            <FavoriteButton anilistId={anime.canonicalSeasonId} relatedIds={seasonIds} inline />
          </div>

          <StarRating score={anime.averageScore} size="md" />

          <div className="flex flex-wrap gap-1">
            {anime.genres.map((g) => (
              <span key={g} className="rounded bg-surface-hover px-2 py-0.5 text-xs text-gray-300">
                {g}
              </span>
            ))}
          </div>

          <p className="text-sm leading-relaxed text-gray-400">{anime.description}</p>

          <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
            <span>Stagioni: {anime.seasonCount}</span>
            <span>{anime.italianAudioLabel}</span>
            {displaySeason && (
              <span className="col-span-2">
                In visione: {displaySeason.title}
              </span>
            )}
            {isAiring && anime.airingDay && (
              <span className="col-span-2">
                Uscita: {anime.airingDay}
                {anime.airingTime ? ` ${anime.airingTime}` : ''}
              </span>
            )}
          </div>

          {(anime.seasons.length > 1 || anime.seasonCount > 1) && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300">Stagioni</p>
              <ul className="space-y-2">
                {anime.seasons.map((season, index) => {
                  const isCurrent = season.id === animeId;
                  return (
                    <li key={season.id}>
                      <Link
                        to={`/anime/${season.id}`}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                          isCurrent
                            ? 'border-accent/40 bg-accent/10 text-accent-light'
                            : 'border-white/10 bg-surface-card text-gray-300 hover:border-accent/30'
                        }`}
                      >
                        <span>{seasonListLabel(season, index)}</span>
                        <span className="text-xs text-gray-400">{seasonStatusLabel(season.status)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {anime.italianPlatforms.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-gray-500">Piattaforme italiane</p>
              <div className="flex flex-wrap gap-1">
                {anime.italianPlatforms.map((p) => (
                  <span
                    key={p}
                    className="rounded border border-accent/30 px-1.5 py-0.5 text-xs text-accent-light"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {anime.platforms.length > 0 && (
            <p className="text-sm text-gray-500">Streaming: {anime.platforms.join(', ')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
