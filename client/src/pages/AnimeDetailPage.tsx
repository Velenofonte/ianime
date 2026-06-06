import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { FavoriteButton } from '../components/FavoriteButton';
import { PosterImage } from '../components/PosterImage';
import { StarRating } from '../components/StarRating';
import { fetchAnimeById } from '../services/anilist';

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

  return (
    <div>
      <BackLink />
      <div className="grid gap-6 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
        <div className="mx-auto w-full max-w-xs md:mx-0">
          <div className="overflow-hidden rounded-xl border border-white/5 bg-surface-card">
            <PosterImage src={anime.coverImage} alt={anime.title}>
              <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs">
                {anime.statusLabel}
              </span>
            </PosterImage>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <h1 className="flex-1 text-2xl font-bold leading-tight">{anime.title}</h1>
            <FavoriteButton anilistId={anime.id} inline />
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
            <span>Episodi: {anime.episodes ?? '?'}</span>
            <span>Stagioni: {anime.seasonCount}</span>
            <span>{anime.italianAudioLabel}</span>
            {anime.airingDay && anime.status === 'RELEASING' && (
              <span>
                Uscita: {anime.airingDay}
                {anime.airingTime ? ` ${anime.airingTime}` : ''}
              </span>
            )}
          </div>

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
