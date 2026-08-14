import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FavoriteButton } from '../components/FavoriteButton';
import { AnimeDescription } from '../components/AnimeDescription';
import { AppLink } from '../components/AppLink';
import { ItalianVerificationNote } from '../components/ItalianVerificationNote';
import { PosterImage } from '../components/PosterImage';
import { StarRating } from '../components/StarRating';
import { fetchItalyNews, searchNews } from '../services/aninews';
import { fetchAnimeById, formatStartDate, seasonStatusLabel } from '../services/anilist';
import type { AnimeCard, FranchiseSeason, NewsArticle, StreamingLink } from '../types/anime';

function BackLink() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          navigate(-1);
          return;
        }
        navigate('/');
      }}
      className="mb-6 inline-flex items-center text-sm text-gray-400 transition hover:text-accent-light"
    >
      ← Torna indietro
    </button>
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

function isUpcomingAnime(anime: AnimeCard): boolean {
  return (
    anime.franchiseStatus === 'NOT_YET_RELEASED' ||
    anime.seasons.some((s) => s.status === 'NOT_YET_RELEASED')
  );
}

function upcomingDateSource(anime: AnimeCard, displaySeason: FranchiseSeason | null) {
  if (displaySeason?.status === 'NOT_YET_RELEASED') return displaySeason;
  return anime;
}

function mergeRelatedNews(italian: NewsArticle[], english: NewsArticle[], limit = 8): NewsArticle[] {
  const seen = new Set<string>();
  const merged: NewsArticle[] = [];
  for (const article of [...italian, ...english]) {
    const key = article.link || article.slug;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(article);
    if (merged.length >= limit) break;
  }
  return merged;
}

function StreamingLinks({ links }: { links: StreamingLink[] }) {
  if (!links.length) return null;

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-300">Guarda su</p>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => {
          const isItalian = link.language?.toLowerCase() === 'italian';
          return (
            <AppLink
              key={link.url}
              href={link.url}
              site={link.site}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                isItalian
                  ? 'border-accent/40 bg-accent/10 text-accent-light hover:border-accent'
                  : 'border-white/10 bg-surface-card text-gray-300 hover:border-accent/30'
              }`}
            >
              {link.site}
              {isItalian ? ' · IT' : ''}
            </AppLink>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-gray-500">Le piattaforme sono indicative, non filtrate per l’Italia.</p>
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

  const anime = query.data;

  const newsQuery = useQuery({
    queryKey: ['news-search', anime?.franchiseTitle, anime?.title],
    queryFn: async () => {
      const [italian, primary] = await Promise.all([
        fetchItalyNews({ search: anime!.franchiseTitle, limit: 5 }),
        searchNews(anime!.franchiseTitle),
      ]);
      const english = primary.articles.length
        ? primary.articles
        : (await searchNews(anime!.title)).articles;
      const italianArticles = italian.articles.length
        ? italian.articles
        : (await fetchItalyNews({ search: anime!.title, limit: 5 })).articles;
      return mergeRelatedNews(italianArticles, english);
    },
    enabled: !!anime,
    staleTime: 900000,
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

  if (!anime) {
    return (
      <div>
        <BackLink />
        <p className="rounded-lg bg-surface-card p-4 text-gray-400">Anime non trovato.</p>
      </div>
    );
  }

  const seasonIds = anime.seasons.length ? anime.seasons.map((s) => s.id) : [anime.id];
  const displaySeason =
    anime.seasons.find((s) => s.id === animeId) ??
    anime.seasons.find((s) => s.id === anime.canonicalSeasonId) ??
    null;
  const isAiring = anime.franchiseStatus === 'RELEASING';
  const isUpcoming = isUpcomingAnime(anime);
  const dateSource = upcomingDateSource(anime, displaySeason);
  const releaseDateLabel = isUpcoming
    ? formatStartDate(dateSource.startDate, dateSource.season, dateSource.seasonYear)
    : null;
  const relatedNews = newsQuery.data ?? [];

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

          {anime.trailerUrl && (
            <AppLink
              href={anime.trailerUrl}
              className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80"
            >
              Guarda trailer
            </AppLink>
          )}

          <StarRating score={anime.averageScore} size="md" />

          <div className="flex flex-wrap gap-1">
            {anime.genres.map((g) => (
              <span key={g} className="rounded bg-surface-hover px-2 py-0.5 text-xs text-gray-300">
                {g}
              </span>
            ))}
          </div>

          <AnimeDescription anilistId={animeId} descriptionEn={anime.description} />

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
                {anime.nextEpisode ? ` · ep. ${anime.nextEpisode}` : ''}
              </span>
            )}
            {releaseDateLabel && (
              <span className="col-span-2">Uscita prevista: {releaseDateLabel}</span>
            )}
          </div>

          <ItalianVerificationNote verified={anime.hasItalianLink} />

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

          <StreamingLinks links={anime.streamingLinks} />

          {anime.italianPlatforms.length > 0 && !anime.streamingLinks.length && (
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
              <p className="mt-2 text-xs text-gray-500">Le piattaforme sono indicative, non filtrate per l’Italia.</p>
            </div>
          )}

          {relatedNews.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-medium text-gray-300">News correlate</p>
              <div className="space-y-3">
                {relatedNews.map((article) => (
                  <a
                    key={article.slug}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 rounded-xl border border-white/10 bg-surface-card p-3 transition hover:border-accent/30"
                  >
                    {article.image && (
                      <img src={article.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                    )}
                    <div>
                      <p className="text-xs text-accent-light">{article.source}</p>
                      <h2 className="text-sm font-semibold leading-tight">{article.title}</h2>
                      {article.excerpt && (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-400">{article.excerpt}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        {format(new Date(article.date), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
