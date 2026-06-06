import DOMPurify from 'dompurify';
import { starsToAnilistScore } from '../components/StarRating';
import type { AnimeCard, AnimeStatus, ItalianAudioStatus } from '../types/anime';import { DAY_MAP, ITALIAN_PLATFORMS } from '../types/anime';
import { fetchJikanBroadcast } from './jikan';

const ANILIST_URL = 'https://graphql.anilist.co';

const MEDIA_FIELDS = `
  id idMal
  title { romaji english }
  coverImage { extraLarge }
  description genres episodes status format averageScore
  nextAiringEpisode { airingAt episode }
  externalLinks { site url language type }
  relations {
    edges {
      relationType
      node { id format status }
    }
  }
`;

export async function anilistQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || 'Errore AniList');
  return json.data;
}

export async function fetchGenres(): Promise<string[]> {
  const data = await anilistQuery<{ GenreCollection: string[] }>(
    `query { GenreCollection }`
  );
  return sortGenresForFilter(data.GenreCollection);
}

const FEATURED_GENRES = [
  'Isekai',
  'Action',
  'Adventure',
  'Fantasy',
  'Comedy',
  'Drama',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Supernatural',
  'Mystery',
  'Horror',
] as const;

export function sortGenresForFilter(genres: string[]): string[] {
  const featured = FEATURED_GENRES.filter((g) => genres.includes(g));
  const featuredSet = new Set<string>(featured);
  const rest = genres.filter((g) => !featuredSet.has(g)).sort((a, b) => a.localeCompare(b, 'it'));
  return [...featured, ...rest];
}

function countSeasons(relations: { edges: { relationType: string; node: { format: string } }[] }): number {
  const sequels = relations.edges.filter(
    (e) => e.relationType === 'SEQUEL' && e.node.format === 'TV'
  ).length;
  return Math.max(1, sequels + 1);
}

function inferItalianAudio(links: { site: string; language: string | null }[]): ItalianAudioStatus {
  const hasItalianLink = links.some((l) => l.language?.toLowerCase() === 'italian');
  const hasVvvvid = links.some((l) => l.site.toLowerCase().includes('vvvvid'));
  const hasAnimeGen = links.some((l) => l.site.toLowerCase().includes('prime') || l.site.toLowerCase().includes('amazon'));
  if (hasVvvvid || hasAnimeGen) return 'dub';
  if (hasItalianLink) return 'sub';
  return 'unknown';
}

function statusLabel(status: AnimeStatus): string {
  if (status === 'RELEASING') return 'In corso';
  if (status === 'FINISHED') return 'Completo';
  if (status === 'NOT_YET_RELEASED') return 'In arrivo';
  return status;
}

function italianAudioLabel(s: ItalianAudioStatus): string {
  if (s === 'dub') return 'Doppiato IT';
  if (s === 'sub') return 'Sottotitoli IT';
  return 'Non verificato';
}

interface RawMedia {
  id: number;
  idMal: number | null;
  title: { romaji: string; english: string | null };
  coverImage: { extraLarge: string };
  description: string | null;
  genres: string[];
  episodes: number | null;
  status: AnimeStatus;
  averageScore: number | null;
  nextAiringEpisode: { airingAt: number } | null;
  externalLinks: { site: string; url: string; language: string | null; type: string }[];
  relations: { edges: { relationType: string; node: { id: number; format: string; status: string } }[] };
}

export async function normalizeMedia(raw: RawMedia, broadcast?: { day: string | null; time: string | null }): Promise<AnimeCard> {
  const platforms = [...new Set(raw.externalLinks.map((l) => l.site).filter(Boolean))];
  const italianPlatforms = platforms.filter((p) =>
    ITALIAN_PLATFORMS.some((ip) => p.toLowerCase().includes(ip.toLowerCase().replace('+', '')))
  );
  const italianAudio = inferItalianAudio(raw.externalLinks);
  let airingDay: string | null = null;
  let airingTime: string | null = null;
  if (broadcast?.day) {
    airingDay = DAY_MAP[broadcast.day] || broadcast.day;
    airingTime = broadcast.time;
  } else if (raw.nextAiringEpisode?.airingAt) {
    const d = new Date(raw.nextAiringEpisode.airingAt * 1000);
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    airingDay = days[d.getDay()];
    airingTime = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  return {
    id: raw.id,
    idMal: raw.idMal,
    title: raw.title.english || raw.title.romaji,
    titleEnglish: raw.title.english,
    coverImage: raw.coverImage?.extraLarge || '',
    genres: raw.genres || [],
    description: DOMPurify.sanitize(raw.description || 'Nessuna descrizione disponibile.', { ALLOWED_TAGS: [] }),
    episodes: raw.episodes,
    seasonCount: countSeasons(raw.relations),
    status: raw.status,
    statusLabel: statusLabel(raw.status),
    italianAudio,
    italianAudioLabel: italianAudioLabel(italianAudio),
    airingDay,
    airingTime,
    platforms,
    italianPlatforms,
    averageScore: raw.averageScore ?? null,
  };
}

export interface FetchAnimeParams {
  page?: number;
  search?: string;
  genres?: string[];
  status?: AnimeStatus | '';
  releaseOrder?: '' | 'recent' | 'oldest';
  minStars?: number;
  licensedBy?: number[];
}

function resolveSort(releaseOrder: '' | 'recent' | 'oldest' | undefined): string[] {
  if (releaseOrder === 'recent') return ['START_DATE_DESC'];
  if (releaseOrder === 'oldest') return ['START_DATE'];
  return ['POPULARITY_DESC'];
}

export async function fetchTrendingAnime(params: FetchAnimeParams = {}): Promise<{ media: AnimeCard[]; hasNextPage: boolean }> {
  const query = `
    query ($page: Int, $search: String, $genres: [String], $status: MediaStatus, $sort: [MediaSort], $minScore: Int) {
      Page(page: $page, perPage: 20) {
        pageInfo { hasNextPage }
        media(
          type: ANIME
          sort: $sort
          search: $search
          genre_in: $genres
          status: $status
          averageScore_greater: $minScore
        ) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await anilistQuery<{ Page: { pageInfo: { hasNextPage: boolean }; media: RawMedia[] } }>(query, {
    page: params.page || 1,
    search: params.search || undefined,
    genres: params.genres?.length ? params.genres : undefined,
    status: params.status || undefined,
    sort: resolveSort(params.releaseOrder),
    minScore: params.minStars && params.minStars > 0 ? starsToAnilistScore(params.minStars) : undefined,
  });

  const rawList = data.Page.media;
  const malIds = rawList.filter((m) => m.status === 'RELEASING' && m.idMal).map((m) => m.idMal!);
  const broadcasts = await Promise.all(
    malIds.slice(0, 10).map(async (id) => ({ id, b: await fetchJikanBroadcast(id) }))
  );
  const broadcastMap = Object.fromEntries(broadcasts.map(({ id, b }) => [id, b]));

  let media = await Promise.all(
    rawList.map((raw) => normalizeMedia(raw, raw.idMal ? broadcastMap[raw.idMal] : undefined))
  );

  if (params.licensedBy?.length) {
    // client-side platform filter fallback by site name
  }
  return { media, hasNextPage: data.Page.pageInfo.hasNextPage };
}

export async function fetchAnimeById(id: number): Promise<AnimeCard | null> {
  const query = `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`;
  const data = await anilistQuery<{ Media: RawMedia | null }>(query, { id });
  if (!data.Media) return null;
  let broadcast;
  if (data.Media.idMal) broadcast = await fetchJikanBroadcast(data.Media.idMal);
  return normalizeMedia(data.Media, broadcast);
}

export async function fetchAnimeByIds(ids: number[]): Promise<AnimeCard[]> {
  if (!ids.length) return [];
  const results: AnimeCard[] = [];
  for (const id of ids) {
    const query = `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`;
    const data = await anilistQuery<{ Media: RawMedia }>(query, { id });
    if (data.Media) {
      let broadcast;
      if (data.Media.idMal) broadcast = await fetchJikanBroadcast(data.Media.idMal);
      results.push(await normalizeMedia(data.Media, broadcast));
    }
  }
  return results;
}

export function filterAnimeClientSide(
  media: AnimeCard[],
  filters: { minSeasons: number; platform: string }
): AnimeCard[] {
  return media.filter((a) => {
    if (filters.minSeasons > 0 && a.seasonCount < filters.minSeasons) return false;
    if (filters.platform && !a.platforms.some((p) => p.toLowerCase().includes(filters.platform.toLowerCase()))) return false;
    return true;
  });
}
