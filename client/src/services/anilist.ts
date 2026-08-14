import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import DOMPurify from 'dompurify';
import { starsToAnilistScore } from '../components/StarRating';
import type {
  AnimeCard,
  AnimeStatus,
  FranchiseSeason,
  FuzzyDate,
  ItalianAudioStatus,
  StreamingLink,
  UpcomingSeasonEntry,
} from '../types/anime';
import { DAY_MAP, EXCLUDED_GENRES, ITALIAN_PLATFORMS } from '../types/anime';
import { fetchJikanBroadcast } from './jikan';
import { loadHiddenSuggestions } from './hiddenSuggestions';

const ANILIST_URL = 'https://graphql.anilist.co';

export const ANIME_PAGE_SIZE = 20;
export const MIN_VISIBLE_RESULTS = 20;

const PLATFORM_ALIASES: Record<string, string[]> = {
  'Disney Plus': ['disney', 'disney+', 'disney plus'],
  'Prime Video': ['prime', 'amazon', 'prime video'],
  Crunchyroll: ['crunchyroll'],
  Netflix: ['netflix'],
  VVVVID: ['vvvvid'],
};

const MEDIA_FIELDS = `
  id idMal
  title { romaji english }
  coverImage { extraLarge }
  description genres episodes status format averageScore
  startDate { year month day }
  season seasonYear
  nextAiringEpisode { airingAt episode }
  trailer { id site }
  externalLinks { site url language type }
  relations {
    edges {
      relationType
      node {
        id format status episodes
        startDate { year month day }
        season seasonYear
        title { romaji english }
        coverImage { extraLarge }
      }
    }
  }
`;

const STATUS_PRIORITY: AnimeStatus[] = ['RELEASING', 'NOT_YET_RELEASED', 'HIATUS', 'FINISHED'];

const SEASON_NUMBER_PATTERNS: { regex: RegExp; group: number }[] = [
  { regex: /\s*:?\s*season\s*(\d+)\b/i, group: 1 },
  { regex: /\b(\d+)(?:st|nd|rd|th)\s+season\b/i, group: 1 },
];

const STRIP_SUFFIX_PATTERNS: RegExp[] = [
  /\s*:?\s*season\s*\d+\b/i,
  /\b\d+(?:st|nd|rd|th)\s+season\b/i,
  /\s*:?\s*part\s*\d+\b/i,
  /\s*:?\s*cour\s*\d+\b/i,
  /\s*:?\s*final\s+season\b/i,
];

function extractSeasonNumber(title: string): number | null {
  for (const { regex, group } of SEASON_NUMBER_PATTERNS) {
    const match = title.match(regex);
    if (match?.[group]) return Number.parseInt(match[group], 10);
  }
  return null;
}

function stripAllSeasonSuffixes(title: string): { base: string; isSeasonEntry: boolean } {
  let working = title;
  let isSeasonEntry = false;
  let prev = '';

  while (prev !== working) {
    prev = working;
    for (const regex of STRIP_SUFFIX_PATTERNS) {
      if (regex.test(working)) {
        working = working.replace(regex, '').trim().replace(/\s*:\s*$/, '').trim();
        isSeasonEntry = true;
      }
    }
  }

  return { base: working || title, isSeasonEntry };
}

export interface ParsedFranchiseTitle {
  franchiseTitle: string;
  seasonNumber: number | null;
  isSeasonEntry: boolean;
  titleSlug: string;
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseFranchiseTitle(english: string | null, romaji: string): ParsedFranchiseTitle {
  const candidates = [english, romaji].filter(Boolean) as string[];

  let best: ParsedFranchiseTitle | null = null;

  for (const title of candidates) {
    const seasonNumber = extractSeasonNumber(title);
    const { base, isSeasonEntry } = stripAllSeasonSuffixes(title);
    if (!base) continue;

    const parsed: ParsedFranchiseTitle = {
      franchiseTitle: base,
      seasonNumber,
      isSeasonEntry: isSeasonEntry || seasonNumber !== null,
      titleSlug: slugifyTitle(base),
    };

    if (!best || (parsed.isSeasonEntry && !best.isSeasonEntry) || base.length < best.franchiseTitle.length) {
      best = parsed;
    }
  }

  if (best) return best;

  const franchiseTitle = english || romaji;
  return {
    franchiseTitle,
    seasonNumber: null,
    isSeasonEntry: false,
    titleSlug: slugifyTitle(franchiseTitle),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(message: string, status: number): boolean {
  return status === 429 || /too many requests/i.test(message);
}

export async function anilistQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const body = JSON.stringify({ query, variables });
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(ANILIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
      });
      const json = await res.json();
      const message = json.errors?.[0]?.message || res.statusText;

      if (json.errors && isRateLimitError(message, res.status)) {
        if (attempt < 2) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
      }

      if (json.errors) throw new Error(message || 'Errore AniList');
      return json.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      lastError =
        msg === 'Failed to fetch'
          ? new Error('Connessione ad AniList non disponibile. Riprova tra qualche secondo.')
          : err instanceof Error
            ? err
            : new Error('Errore di rete');
      if (attempt < 2) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError ?? new Error('Errore AniList');
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
  const excluded = new Set<string>(EXCLUDED_GENRES);
  const allowed = genres.filter((g) => !excluded.has(g));
  const featured = FEATURED_GENRES.filter((g) => allowed.includes(g));
  const featuredSet = new Set<string>(featured);
  const rest = allowed.filter((g) => !featuredSet.has(g)).sort((a, b) => a.localeCompare(b, 'it'));
  return [...featured, ...rest];
}

export function isExcludedRawMedia(raw: { genres?: string[] }): boolean {
  return raw.genres?.some((g) => EXCLUDED_GENRES.includes(g as (typeof EXCLUDED_GENRES)[number])) ?? false;
}

export function isExcludedAnime(anime: AnimeCard): boolean {
  return anime.genres.some((g) => EXCLUDED_GENRES.includes(g as (typeof EXCLUDED_GENRES)[number]));
}

function isTvSeasonFormat(format: string): boolean {
  return format === 'TV' || format === 'TV_SHORT';
}

export function matchesPlatform(platforms: string[], filterValue: string): boolean {
  if (!filterValue) return true;
  const aliases = PLATFORM_ALIASES[filterValue] ?? [filterValue.toLowerCase()];
  return platforms.some((p) => {
    const lower = p.toLowerCase();
    return aliases.some((alias) => lower.includes(alias));
  });
}

function hasItalianLanguageLink(links: { language: string | null }[]): boolean {
  return links.some((l) => l.language?.toLowerCase() === 'italian');
}

function isHttpUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

function toStreamingLinks(
  links: { site: string; url: string; language: string | null; type: string }[]
): StreamingLink[] {
  const seen = new Set<string>();
  const result: StreamingLink[] = [];
  for (const link of links) {
    if (!link.url || !isHttpUrl(link.url)) continue;
    const type = (link.type || '').toUpperCase();
    if (type && type !== 'STREAMING' && type !== 'INFO') continue;
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    result.push({
      site: link.site,
      url: link.url,
      language: link.language,
      type: link.type,
    });
  }
  return result;
}

function trailerWatchUrl(trailer?: { id: string | null; site: string | null } | null): string | null {
  if (!trailer?.id || !trailer.site) return null;
  const site = trailer.site.toLowerCase();
  if (site === 'youtube') return `https://www.youtube.com/watch?v=${trailer.id}`;
  if (site === 'dailymotion') return `https://www.dailymotion.com/video/${trailer.id}`;
  return null;
}

function inferItalianAudio(links: { site: string; language: string | null }[]): ItalianAudioStatus {
  const hasItalianLink = links.some((l) => l.language?.toLowerCase() === 'italian');
  const hasVvvvid = links.some((l) => l.site.toLowerCase().includes('vvvvid'));
  const hasAnimeGen = links.some((l) => l.site.toLowerCase().includes('prime') || l.site.toLowerCase().includes('amazon'));
  if (hasVvvvid || hasAnimeGen) return 'dub';
  if (hasItalianLink) return 'sub';
  return 'unknown';
}

export function statusLabel(status: AnimeStatus): string {
  if (status === 'RELEASING') return 'In corso';
  if (status === 'FINISHED') return 'Completo';
  if (status === 'NOT_YET_RELEASED') return 'In arrivo';
  if (status === 'HIATUS') return 'In pausa';
  return status;
}

export function seasonStatusLabel(status: AnimeStatus): string {
  if (status === 'RELEASING') return 'In corso';
  if (status === 'FINISHED') return 'Conclusa';
  if (status === 'NOT_YET_RELEASED') return 'In arrivo';
  if (status === 'HIATUS') return 'In pausa';
  return status;
}

const SEASON_LABELS: Record<string, string> = {
  WINTER: 'Inverno',
  SPRING: 'Primavera',
  SUMMER: 'Estate',
  FALL: 'Autunno',
};

function parseFuzzyDate(raw?: { year?: number | null; month?: number | null; day?: number | null } | null): FuzzyDate | null {
  if (!raw) return null;
  const year = raw.year && raw.year > 0 ? raw.year : null;
  const month = raw.month && raw.month > 0 ? raw.month : null;
  const day = raw.day && raw.day > 0 ? raw.day : null;
  if (!year && !month && !day) return null;
  return { year, month, day };
}

export function formatStartDate(
  startDate: FuzzyDate | null,
  season?: string | null,
  seasonYear?: number | null
): string | null {
  if (startDate?.year && startDate.month && startDate.day) {
    return format(new Date(startDate.year, startDate.month - 1, startDate.day), 'd MMMM yyyy', { locale: it });
  }
  if (startDate?.year && startDate.month) {
    return format(new Date(startDate.year, startDate.month - 1, 1), 'MMMM yyyy', { locale: it });
  }
  if (startDate?.year) return String(startDate.year);
  if (season && seasonYear) {
    const label = SEASON_LABELS[season] ?? season;
    return `${label} ${seasonYear}`;
  }
  return null;
}

function seasonDateFields(raw: {
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  season?: string | null;
  seasonYear?: number | null;
}) {
  return {
    startDate: parseFuzzyDate(raw.startDate),
    season: raw.season ?? null,
    seasonYear: raw.seasonYear ?? null,
  };
}

function italianAudioLabel(s: ItalianAudioStatus): string {
  if (s === 'dub') return 'Doppiato IT';
  if (s === 'sub') return 'Sottotitoli IT';
  return 'Non verificato';
}

interface RawRelationNode {
  id: number;
  format: string;
  status: string;
  episodes: number | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  season?: string | null;
  seasonYear?: number | null;
  title?: { romaji: string; english: string | null };
  coverImage?: { extraLarge: string };
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
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  season?: string | null;
  seasonYear?: number | null;
  averageScore: number | null;
  nextAiringEpisode: { airingAt: number; episode: number | null } | null;
  trailer?: { id: string | null; site: string | null } | null;
  externalLinks: { site: string; url: string; language: string | null; type: string }[];
  relations: { edges: { relationType: string; node: RawRelationNode }[] };
}

function relationNodeTitle(node: RawRelationNode): string {
  return node.title?.english || node.title?.romaji || `Anime #${node.id}`;
}

function sortFranchiseSeasons(seasons: FranchiseSeason[]): FranchiseSeason[] {
  return [...seasons].sort((a, b) => {
    const aNum = a.seasonNumber ?? Number.MAX_SAFE_INTEGER;
    const bNum = b.seasonNumber ?? Number.MAX_SAFE_INTEGER;
    if (aNum !== bNum) return aNum - bNum;
    return a.id - b.id;
  });
}

function rawToFranchiseSeason(raw: RawMedia): FranchiseSeason {
  const parsed = parseFranchiseTitle(raw.title.english, raw.title.romaji);
  return {
    id: raw.id,
    title: raw.title.english || raw.title.romaji,
    status: raw.status,
    episodes: raw.episodes,
    seasonNumber: parsed.seasonNumber ?? (parsed.isSeasonEntry ? null : 1),
    coverImage: raw.coverImage?.extraLarge || '',
    ...seasonDateFields(raw),
  };
}

function seasonFromRelationNode(node: RawRelationNode): FranchiseSeason {
  const english = node.title?.english ?? null;
  const romaji = node.title?.romaji ?? relationNodeTitle(node);
  const parsed = parseFranchiseTitle(english, romaji);
  return {
    id: node.id,
    title: relationNodeTitle(node),
    status: node.status as AnimeStatus,
    episodes: node.episodes ?? null,
    seasonNumber: parsed.seasonNumber,
    coverImage: node.coverImage?.extraLarge || '',
    ...seasonDateFields(node),
  };
}

function collectTvSeasonEdges(raw: RawMedia) {
  return raw.relations.edges.filter(
    (e) =>
      (e.relationType === 'SEQUEL' || e.relationType === 'PREQUEL') &&
      isTvSeasonFormat(e.node.format)
  );
}

const MAX_FRANCHISE_FETCHES = 8;
const FRANCHISE_FETCH_DELAY_MS = 700;
const ANILIST_BATCH_DELAY_MS = 700;
const ANILIST_BATCH_SIZE = 50;

const CALENDAR_ACTIVE_STATUSES: AnimeStatus[] = ['RELEASING', 'NOT_YET_RELEASED'];

const CALENDAR_STATUS_FIELDS = `
  id status
  relations {
    edges {
      relationType
      node { id format status }
    }
  }
`;

interface RawCalendarStatus {
  id: number;
  status: AnimeStatus;
  relations: { edges: { relationType: string; node: { format: string; status: string } }[] };
}

function isCalendarRelevantRaw(raw: RawCalendarStatus): boolean {
  if (CALENDAR_ACTIVE_STATUSES.includes(raw.status)) return true;
  return raw.relations.edges.some(
    (e) =>
      (e.relationType === 'SEQUEL' || e.relationType === 'PREQUEL') &&
      isTvSeasonFormat(e.node.format) &&
      CALENDAR_ACTIVE_STATUSES.includes(e.node.status as AnimeStatus)
  );
}

async function fetchMediaStatusBatch(ids: number[]): Promise<RawCalendarStatus[]> {
  const uniqueIds = [...new Set(ids)];
  const results: RawCalendarStatus[] = [];

  for (let i = 0; i < uniqueIds.length; i += ANILIST_BATCH_SIZE) {
    if (i > 0) await sleep(ANILIST_BATCH_DELAY_MS);

    const chunk = uniqueIds.slice(i, i + ANILIST_BATCH_SIZE);
    const data = await anilistQuery<{ Page: { media: (RawCalendarStatus | null)[] } }>(
      `query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ${CALENDAR_STATUS_FIELDS} } } }`,
      { ids: chunk }
    );

    for (const raw of data.Page.media) {
      if (raw) results.push(raw);
    }
  }

  return results;
}

export async function fetchCalendarAnimeByIds(ids: number[]): Promise<AnimeCard[]> {
  if (!ids.length) return [];

  const statusEntries = await fetchMediaStatusBatch(ids);
  const relevantIds = statusEntries.filter(isCalendarRelevantRaw).map((raw) => raw.id);
  if (!relevantIds.length) return [];

  return fetchAnimeByIds(relevantIds, { jikanOnlyIfStatus: ['RELEASING'] });
}

const rawMediaCache = new Map<number, Promise<RawMedia | null>>();

async function fetchRawMediaById(id: number): Promise<RawMedia | null> {
  let pending = rawMediaCache.get(id);
  if (!pending) {
    pending = anilistQuery<{ Media: RawMedia | null }>(
      `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`,
      { id }
    ).then((data) => data.Media);
    rawMediaCache.set(id, pending);
  }
  return pending;
}

async function fetchRawMediaBatch(ids: number[]): Promise<Map<number, RawMedia>> {
  const uniqueIds = [...new Set(ids)];
  const byId = new Map<number, RawMedia>();

  for (let i = 0; i < uniqueIds.length; i += ANILIST_BATCH_SIZE) {
    if (i > 0) await sleep(ANILIST_BATCH_DELAY_MS);

    const chunk = uniqueIds.slice(i, i + ANILIST_BATCH_SIZE);
    const data = await anilistQuery<{ Page: { media: (RawMedia | null)[] } }>(
      `query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} } } }`,
      { ids: chunk }
    );

    for (const raw of data.Page.media) {
      if (raw) byId.set(raw.id, raw);
    }
  }

  return byId;
}

async function fetchFullFranchiseSeasons(startRaw: RawMedia): Promise<FranchiseSeason[]> {
  const seasons = new Map<number, FranchiseSeason>();
  const expanded = new Set<number>();
  const queue = [startRaw.id];
  const rawCache = new Map<number, RawMedia>([[startRaw.id, startRaw]]);

  seasons.set(startRaw.id, rawToFranchiseSeason(startRaw));

  try {
    while (queue.length > 0 && expanded.size < MAX_FRANCHISE_FETCHES) {
      const id = queue.shift()!;
      if (expanded.has(id)) continue;
      expanded.add(id);

      let raw = rawCache.get(id);
      if (!raw) {
        await sleep(FRANCHISE_FETCH_DELAY_MS);
        try {
          raw = (await fetchRawMediaById(id)) ?? undefined;
        } catch {
          break;
        }
        if (!raw) continue;
        rawCache.set(id, raw);
        seasons.set(id, rawToFranchiseSeason(raw));
      }

      for (const edge of collectTvSeasonEdges(raw)) {
        const node = edge.node;
        if (!seasons.has(node.id)) {
          seasons.set(node.id, seasonFromRelationNode(node));
        }
        if (!expanded.has(node.id)) queue.push(node.id);
      }
    }
  } catch {
    // usa i risultati parziali raccolti fino a qui
  }

  if (seasons.size <= 1) return buildFranchiseSeasons(startRaw);
  return sortFranchiseSeasons([...seasons.values()]);
}

function buildFranchiseSeasons(raw: RawMedia): FranchiseSeason[] {
  const parsedSelf = parseFranchiseTitle(raw.title.english, raw.title.romaji);
  const seasons = new Map<number, FranchiseSeason>();

  seasons.set(raw.id, {
    id: raw.id,
    title: raw.title.english || raw.title.romaji,
    status: raw.status,
    episodes: raw.episodes,
    seasonNumber: parsedSelf.seasonNumber ?? (parsedSelf.isSeasonEntry ? null : 1),
    coverImage: raw.coverImage?.extraLarge || '',
    ...seasonDateFields(raw),
  });

  for (const edge of raw.relations.edges) {
    if (edge.relationType !== 'SEQUEL' && edge.relationType !== 'PREQUEL') continue;
    if (!isTvSeasonFormat(edge.node.format)) continue;

    const node = edge.node;
    const nodeEnglish = node.title?.english ?? null;
    const nodeRomaji = node.title?.romaji ?? relationNodeTitle(node);
    const parsed = parseFranchiseTitle(nodeEnglish, nodeRomaji);

    seasons.set(node.id, {
      id: node.id,
      title: relationNodeTitle(node),
      status: node.status as AnimeStatus,
      episodes: node.episodes ?? null,
      seasonNumber: parsed.seasonNumber,
      coverImage: node.coverImage?.extraLarge || '',
      ...seasonDateFields(node),
    });
  }

  return sortFranchiseSeasons([...seasons.values()]);
}

function aggregateFranchiseStatus(seasons: FranchiseSeason[]): AnimeStatus {
  for (const status of STATUS_PRIORITY) {
    if (seasons.some((s) => s.status === status)) return status;
  }
  return seasons[0]?.status ?? 'FINISHED';
}

function computeSeasonCount(seasons: FranchiseSeason[]): number {
  const seasonNumbers = seasons
    .map((s) => s.seasonNumber)
    .filter((n): n is number => n !== null);
  const maxSeason = seasonNumbers.length ? Math.max(...seasonNumbers) : 0;
  if (maxSeason > 0) return maxSeason;
  return Math.max(seasons.length, 1);
}

function pickCanonicalSeason(seasons: FranchiseSeason[], fallbackId: number): FranchiseSeason {
  const releasing = seasons.find((s) => s.status === 'RELEASING');
  if (releasing) return releasing;

  const upcoming = seasons.find((s) => s.status === 'NOT_YET_RELEASED');
  if (upcoming) return upcoming;

  const withNumber = seasons.filter((s) => s.seasonNumber !== null);
  if (withNumber.length) {
    return withNumber.reduce((best, s) =>
      (s.seasonNumber ?? 0) > (best.seasonNumber ?? 0) ? s : best
    );
  }

  return seasons.find((s) => s.id === fallbackId) ?? seasons[seasons.length - 1];
}

function deriveFranchiseFields(raw: RawMedia, seasonsOverride?: FranchiseSeason[]) {
  const parsed = parseFranchiseTitle(raw.title.english, raw.title.romaji);
  const seasons = seasonsOverride ?? buildFranchiseSeasons(raw);
  const firstSeason = seasons.find((s) => s.seasonNumber === 1);
  const franchiseTitle = firstSeason
    ? parseFranchiseTitle(firstSeason.title, firstSeason.title).franchiseTitle
    : parsed.franchiseTitle;
  const titleSlug = slugifyTitle(franchiseTitle);
  const franchiseStatus = aggregateFranchiseStatus(seasons);
  const seasonCount = computeSeasonCount(seasons);
  const canonical = pickCanonicalSeason(seasons, raw.id);
  const minSeasonId = Math.min(...seasons.map((s) => s.id));

  return {
    franchiseKey: `${titleSlug}::${minSeasonId}`,
    franchiseTitle,
    titleSlug,
    seasonNumber: parsed.seasonNumber,
    isSeasonEntry: parsed.isSeasonEntry,
    franchiseStatus,
    franchiseStatusLabel: statusLabel(franchiseStatus),
    seasons,
    seasonCount,
    canonicalSeasonId: canonical.id,
    canonicalCoverImage: canonical.coverImage || raw.coverImage?.extraLarge || '',
    startDate: canonical.startDate,
    season: canonical.season,
    seasonYear: canonical.seasonYear,
  };
}

function seasonIdsForCard(card: AnimeCard): number[] {
  const ids = card.seasons.map((s) => s.id);
  return ids.length ? ids : [card.id];
}

function cardsShareFranchise(a: AnimeCard, b: AnimeCard): boolean {
  if (a.titleSlug !== b.titleSlug) return false;

  const aIds = new Set(seasonIdsForCard(a));
  if (b.seasons.some((s) => aIds.has(s.id))) return true;

  return a.isSeasonEntry || b.isSeasonEntry;
}

function mergeSeasons(cards: AnimeCard[]): FranchiseSeason[] {
  const merged = new Map<number, FranchiseSeason>();
  for (const card of cards) {
    for (const season of card.seasons) {
      merged.set(season.id, season);
    }
  }
  return [...merged.values()].sort((a, b) => {
    const aNum = a.seasonNumber ?? Number.MAX_SAFE_INTEGER;
    const bNum = b.seasonNumber ?? Number.MAX_SAFE_INTEGER;
    if (aNum !== bNum) return aNum - bNum;
    return a.id - b.id;
  });
}

function pickRepresentativeCard(cards: AnimeCard[]): AnimeCard {
  const releasing = cards.find((c) => c.franchiseStatus === 'RELEASING' || c.status === 'RELEASING');
  if (releasing) return releasing;

  return cards.reduce((best, card) => {
    const bestNum = best.seasonNumber ?? 0;
    const cardNum = card.seasonNumber ?? 0;
    if (cardNum > bestNum) return card;
    if (cardNum === bestNum && card.id > best.id) return card;
    return best;
  });
}

function mergeStreamingLinks(cards: AnimeCard[]): StreamingLink[] {
  const seen = new Set<string>();
  const result: StreamingLink[] = [];
  for (const card of cards) {
    for (const link of card.streamingLinks) {
      if (seen.has(link.url)) continue;
      seen.add(link.url);
      result.push(link);
    }
  }
  return result;
}

function mergeFranchiseCards(cards: AnimeCard[]): AnimeCard {
  const base = pickRepresentativeCard(cards);
  const seasons = mergeSeasons(cards);
  const franchiseStatus = aggregateFranchiseStatus(seasons);
  const seasonCount = computeSeasonCount(seasons);
  const canonical = pickCanonicalSeason(seasons, base.canonicalSeasonId);
  const minSeasonId = Math.min(...seasons.map((s) => s.id));

  const airingCard =
    cards.find((c) => c.status === 'RELEASING' && c.airingDay) ??
    cards.find((c) => c.franchiseStatus === 'RELEASING' && c.airingDay) ??
    base;

  return {
    ...base,
    id: canonical.id,
    coverImage: canonical.coverImage || base.coverImage,
    franchiseKey: `${base.titleSlug}::${minSeasonId}`,
    franchiseStatus,
    franchiseStatusLabel: statusLabel(franchiseStatus),
    seasons,
    seasonCount,
    canonicalSeasonId: canonical.id,
    airingDay: airingCard.airingDay,
    airingTime: airingCard.airingTime,
    nextEpisode: airingCard.nextEpisode,
    status: airingCard.status,
    statusLabel: statusLabel(airingCard.status),
    startDate: canonical.startDate,
    season: canonical.season,
    seasonYear: canonical.seasonYear,
    hasItalianLink: cards.some((c) => c.hasItalianLink),
    streamingLinks: mergeStreamingLinks(cards),
    trailerUrl: cards.find((c) => c.trailerUrl)?.trailerUrl ?? base.trailerUrl,
  };
}

export function collapseFranchises(cards: AnimeCard[]): AnimeCard[] {
  const groups: AnimeCard[][] = [];

  for (const card of cards) {
    let placed = false;
    for (const group of groups) {
      if (group.some((existing) => cardsShareFranchise(existing, card))) {
        group.push(card);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([card]);
  }

  return groups.map((group) => (group.length === 1 ? group[0] : mergeFranchiseCards(group)));
}

export async function normalizeMedia(
  raw: RawMedia,
  broadcast?: { day: string | null; time: string | null },
  seasonsOverride?: FranchiseSeason[]
): Promise<AnimeCard> {
  const platforms = [...new Set(raw.externalLinks.map((l) => l.site).filter(Boolean))];
  const italianPlatforms = platforms.filter((p) =>
    ITALIAN_PLATFORMS.some((ip) => p.toLowerCase().includes(ip.toLowerCase().replace('+', '')))
  );
  const italianAudio = inferItalianAudio(raw.externalLinks);
  const hasItalianLink = hasItalianLanguageLink(raw.externalLinks);
  const streamingLinks = toStreamingLinks(raw.externalLinks);
  const franchise = deriveFranchiseFields(raw, seasonsOverride);

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
    coverImage: franchise.canonicalCoverImage,
    genres: raw.genres || [],
    description: DOMPurify.sanitize(raw.description || 'Nessuna descrizione disponibile.', { ALLOWED_TAGS: [] }),
    episodes: raw.episodes,
    seasonCount: franchise.seasonCount,
    status: raw.status,
    statusLabel: statusLabel(raw.status),
    italianAudio,
    italianAudioLabel: italianAudioLabel(italianAudio),
    hasItalianLink,
    airingDay,
    airingTime,
    nextEpisode: raw.nextAiringEpisode?.episode ?? null,
    trailerUrl: trailerWatchUrl(raw.trailer),
    platforms,
    italianPlatforms,
    streamingLinks,
    averageScore: raw.averageScore ?? null,
    franchiseKey: franchise.franchiseKey,
    franchiseTitle: franchise.franchiseTitle,
    titleSlug: franchise.titleSlug,
    seasonNumber: franchise.seasonNumber,
    isSeasonEntry: franchise.isSeasonEntry,
    franchiseStatus: franchise.franchiseStatus,
    franchiseStatusLabel: franchise.franchiseStatusLabel,
    seasons: franchise.seasons,
    canonicalSeasonId: franchise.canonicalSeasonId,
    startDate: franchise.startDate,
    season: franchise.season,
    seasonYear: franchise.seasonYear,
  };
}

export interface FetchAnimeParams {
  page?: number;
  search?: string;
  genres?: string[];
  status?: AnimeStatus | '';
  releaseOrder?: '' | 'recent' | 'oldest';
  minStars?: number;
}

function resolveSort(releaseOrder: '' | 'recent' | 'oldest' | undefined): string[] {
  if (releaseOrder === 'recent') return ['START_DATE_DESC'];
  if (releaseOrder === 'oldest') return ['START_DATE'];
  return ['TRENDING_DESC'];
}

export async function fetchTrendingAnime(params: FetchAnimeParams = {}): Promise<{ media: AnimeCard[]; hasNextPage: boolean }> {
  const query = `
    query (
      $page: Int
      $search: String
      $genres: [String]
      $excludedGenres: [String]
      $status: MediaStatus
      $sort: [MediaSort]
      $minScore: Int
    ) {
      Page(page: $page, perPage: ${ANIME_PAGE_SIZE}) {
        pageInfo { hasNextPage }
        media(
          type: ANIME
          sort: $sort
          search: $search
          genre_in: $genres
          genre_not_in: $excludedGenres
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
    excludedGenres: [...EXCLUDED_GENRES],
    status: params.status || undefined,
    sort: resolveSort(params.releaseOrder),
    minScore: params.minStars && params.minStars > 0 ? starsToAnilistScore(params.minStars) : undefined,
  });

  const rawList = data.Page.media.filter((raw) => !isExcludedRawMedia(raw));
  const media = await Promise.all(rawList.map((raw) => normalizeMedia(raw)));
  return { media, hasNextPage: data.Page.pageInfo.hasNextPage };
}

export async function fetchAnimeById(id: number): Promise<AnimeCard | null> {
  let raw: RawMedia | null;
  try {
    raw = await fetchRawMediaById(id);
  } catch {
    return null;
  }
  if (!raw) return null;

  let fullSeasons: FranchiseSeason[];
  try {
    fullSeasons = await fetchFullFranchiseSeasons(raw);
  } catch {
    fullSeasons = buildFranchiseSeasons(raw);
  }

  let broadcast;
  if (raw.idMal) broadcast = await fetchJikanBroadcast(raw.idMal);
  return normalizeMedia(raw, broadcast, fullSeasons);
}

const RECOMMENDATION_SOURCE_MAX = 50;
const RECOMMENDATION_PER_PAGE = 25;
const RECOMMENDATION_SOURCE_BATCH_SIZE = 8;
const RECOMMENDATION_HYDRATE_BATCH_SIZE = 24;

interface RawRecommendationEdge {
  node: {
    rating: number | null;
    mediaRecommendation: {
      id: number;
      format: string;
      genres: string[];
    } | null;
  };
}

export interface RecommendationsPageResult {
  media: AnimeCard[];
  hasNextPage: boolean;
}

export interface FavoriteExclusions {
  excludedIds: Set<number>;
  excludedSlugs: Set<string>;
}

const favoriteExclusionCache = new Map<string, FavoriteExclusions>();

export function buildFavoriteExclusionsFromCards(
  favoriteIds: number[],
  cards: AnimeCard[]
): FavoriteExclusions {
  const collapsed = collapseFranchises(cards);
  const excludedIds = new Set<number>(favoriteIds);
  const excludedSlugs = new Set<string>();

  for (const card of collapsed) {
    excludedSlugs.add(card.titleSlug);
    for (const id of seasonIdsForCard(card)) {
      excludedIds.add(id);
    }
  }

  return { excludedIds, excludedSlugs };
}

function mergeHiddenIntoExclusions(base: FavoriteExclusions): FavoriteExclusions {
  const hidden = loadHiddenSuggestions();
  const excludedIds = new Set(base.excludedIds);
  const excludedSlugs = new Set(base.excludedSlugs);
  for (const id of hidden.ids) excludedIds.add(id);
  for (const slug of hidden.slugs) excludedSlugs.add(slug);
  return { excludedIds, excludedSlugs };
}

export async function loadFavoriteExclusions(
  favoriteIds: number[],
  prefetchedCards?: AnimeCard[]
): Promise<FavoriteExclusions> {
  const key = [...favoriteIds].sort((a, b) => a - b).join(',');
  const cached = favoriteExclusionCache.get(key);
  if (cached) return mergeHiddenIntoExclusions(cached);

  const cardSource = prefetchedCards ?? (await fetchAnimeByIds(favoriteIds, { skipJikan: true }));
  const result = buildFavoriteExclusionsFromCards(favoriteIds, cardSource);
  favoriteExclusionCache.set(key, result);
  return mergeHiddenIntoExclusions(result);
}

function isExcludedFromSuggestions(card: AnimeCard, exclusions: FavoriteExclusions): boolean {
  if (exclusions.excludedSlugs.has(card.titleSlug)) return true;
  return seasonIdsForCard(card).some((id) => exclusions.excludedIds.has(id));
}

function mergeRecommendationScores(
  target: Map<number, number>,
  source: Map<number, number>
): void {
  for (const [id, rating] of source) {
    target.set(id, (target.get(id) ?? 0) + rating);
  }
}

function mergeRecommendationSources(
  target: Map<number, Map<number, number>>,
  source: Map<number, Map<number, number>>
): void {
  for (const [recId, bySource] of source) {
    let dest = target.get(recId);
    if (!dest) {
      dest = new Map();
      target.set(recId, dest);
    }
    for (const [sourceId, rating] of bySource) {
      dest.set(sourceId, (dest.get(sourceId) ?? 0) + rating);
    }
  }
}

export function favoriteTitleMap(cards: AnimeCard[] | undefined): Map<number, string> {
  const titles = new Map<number, string>();
  if (!cards) return titles;
  for (const card of cards) {
    titles.set(card.id, card.franchiseTitle);
    titles.set(card.canonicalSeasonId, card.franchiseTitle);
    for (const season of card.seasons) {
      titles.set(season.id, card.franchiseTitle);
    }
  }
  return titles;
}

export function attachRecommendationReasons(
  cards: AnimeCard[],
  sources: Map<number, Map<number, number>>,
  favoriteTitles: Map<number, string>
): AnimeCard[] {
  return cards.map((card) => {
    const combined = new Map<number, number>();
    for (const id of seasonIdsForCard(card)) {
      const bySource = sources.get(id);
      if (!bySource) continue;
      for (const [sourceId, rating] of bySource) {
        combined.set(sourceId, (combined.get(sourceId) ?? 0) + rating);
      }
    }
    const names: string[] = [];
    const seen = new Set<string>();
    for (const [sourceId] of [...combined.entries()].sort((a, b) => b[1] - a[1])) {
      const title = favoriteTitles.get(sourceId);
      if (!title || seen.has(title)) continue;
      seen.add(title);
      names.push(title);
      if (names.length >= 3) break;
    }
    return names.length ? { ...card, recommendedBecause: names } : card;
  });
}

function scoresFromRecommendationResponse(
  mediaList: {
    id: number;
    recommendations: {
      pageInfo: { hasNextPage: boolean };
      edges: RawRecommendationEdge[];
    };
  }[],
  exclusions: FavoriteExclusions
): { scores: Map<number, number>; sources: Map<number, Map<number, number>>; hasNextPage: boolean } {
  const scores = new Map<number, number>();
  const sources = new Map<number, Map<number, number>>();
  let hasNextPage = false;

  for (const media of mediaList) {
    if (media.recommendations.pageInfo?.hasNextPage) hasNextPage = true;

    for (const edge of media.recommendations.edges) {
      const rec = edge.node.mediaRecommendation;
      if (!rec) continue;
      if (!isTvSeasonFormat(rec.format)) continue;
      if (isExcludedRawMedia(rec)) continue;
      if (exclusions.excludedIds.has(rec.id)) continue;

      const rating = edge.node.rating ?? 0;
      scores.set(rec.id, (scores.get(rec.id) ?? 0) + rating);

      let bySource = sources.get(rec.id);
      if (!bySource) {
        bySource = new Map();
        sources.set(rec.id, bySource);
      }
      bySource.set(media.id, (bySource.get(media.id) ?? 0) + rating);
    }
  }

  return { scores, sources, hasNextPage };
}

async function fetchRecommendationScoresChunk(
  sourceIds: number[],
  recPage: number,
  exclusions: FavoriteExclusions
): Promise<{ scores: Map<number, number>; sources: Map<number, Map<number, number>>; hasNextPage: boolean }> {
  const query = `
    query ($ids: [Int], $recPage: Int) {
      Page(perPage: 50) {
        media(id_in: $ids, type: ANIME) {
          id
          recommendations(page: $recPage, perPage: ${RECOMMENDATION_PER_PAGE}, sort: RATING_DESC) {
            pageInfo { hasNextPage }
            edges {
              node {
                rating
                mediaRecommendation {
                  id
                  format
                  genres
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await anilistQuery<{
    Page: {
      media: {
        id: number;
        recommendations: {
          pageInfo: { hasNextPage: boolean };
          edges: RawRecommendationEdge[];
        };
      }[];
    };
  }>(query, { ids: sourceIds, recPage });

  return scoresFromRecommendationResponse(data.Page.media, exclusions);
}

export async function fetchRecommendationScoresBatched(
  sourceIds: number[],
  recPage: number,
  exclusions: FavoriteExclusions,
  onBatchComplete?: (partial: {
    scores: Map<number, number>;
    sources: Map<number, Map<number, number>>;
    hasNextPage: boolean;
  }) => void | Promise<void>
): Promise<{
  scores: Map<number, number>;
  sources: Map<number, Map<number, number>>;
  hasNextPage: boolean;
}> {
  const totalScores = new Map<number, number>();
  const totalSources = new Map<number, Map<number, number>>();
  let hasNextPage = false;

  for (let i = 0; i < sourceIds.length; i += RECOMMENDATION_SOURCE_BATCH_SIZE) {
    if (i > 0) await sleep(ANILIST_BATCH_DELAY_MS);

    const chunk = sourceIds.slice(i, i + RECOMMENDATION_SOURCE_BATCH_SIZE);
    const { scores, sources, hasNextPage: chunkHasNext } = await fetchRecommendationScoresChunk(
      chunk,
      recPage,
      exclusions
    );

    mergeRecommendationScores(totalScores, scores);
    mergeRecommendationSources(totalSources, sources);
    hasNextPage = hasNextPage || chunkHasNext;
    if (onBatchComplete) {
      await onBatchComplete({
        scores: new Map(totalScores),
        sources: totalSources,
        hasNextPage,
      });
    }
  }

  return { scores: totalScores, sources: totalSources, hasNextPage };
}

export function rankRecommendationIds(scores: Map<number, number>): number[] {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

export function scoreForRecommendationCard(card: AnimeCard, scores: Map<number, number>): number {
  return Math.max(...seasonIdsForCard(card).map((id) => scores.get(id) ?? 0));
}

export async function hydrateRecommendationCards(
  rankedIds: number[],
  exclusions: FavoriteExclusions,
  alreadyShownIds?: Set<number>
): Promise<AnimeCard[]> {
  const pending = rankedIds.filter((id) => !alreadyShownIds?.has(id)).slice(0, RECOMMENDATION_HYDRATE_BATCH_SIZE);
  if (!pending.length) return [];

  return collapseFranchises(await fetchAnimeByIds(pending, { skipJikan: true })).filter(
    (card) => !isExcludedFromSuggestions(card, exclusions)
  );
}

export interface FetchRecommendationsOptions {
  prefetchedFavoriteCards?: AnimeCard[];
}

export async function fetchRecommendationsPage(
  favoriteIds: number[],
  recPage: number,
  options?: FetchRecommendationsOptions
): Promise<RecommendationsPageResult> {
  if (!favoriteIds.length) return { media: [], hasNextPage: false };

  const sourceIds = favoriteIds.slice(0, RECOMMENDATION_SOURCE_MAX);
  const exclusions = await loadFavoriteExclusions(favoriteIds, options?.prefetchedFavoriteCards);

  const { scores, sources, hasNextPage } = await fetchRecommendationScoresBatched(sourceIds, recPage, exclusions);
  const rankedIds = rankRecommendationIds(scores);

  if (!rankedIds.length) {
    return { media: [], hasNextPage };
  }

  if (recPage > 1) await sleep(ANILIST_BATCH_DELAY_MS);

  const cards = collapseFranchises(await fetchAnimeByIds(rankedIds, { skipJikan: true })).filter(
    (card) => !isExcludedFromSuggestions(card, exclusions)
  );
  const titles = favoriteTitleMap(options?.prefetchedFavoriteCards);
  return { media: attachRecommendationReasons(cards, sources, titles), hasNextPage };
}

const SEASON_MONTH: Record<string, number> = {
  WINTER: 0,
  SPRING: 3,
  SUMMER: 6,
  FALL: 9,
};

export function fuzzyDateSortKey(
  startDate: FuzzyDate | null,
  season?: string | null,
  seasonYear?: number | null
): number {
  if (startDate?.year && startDate.month && startDate.day) {
    return new Date(startDate.year, startDate.month - 1, startDate.day).getTime();
  }
  if (startDate?.year && startDate.month) {
    return new Date(startDate.year, startDate.month - 1, 1).getTime();
  }
  if (startDate?.year) {
    return new Date(startDate.year, 0, 1).getTime();
  }
  if (season && seasonYear) {
    const month = SEASON_MONTH[season] ?? 0;
    return new Date(seasonYear, month, 1).getTime();
  }
  return Number.MAX_SAFE_INTEGER;
}

export function collectUpcomingSeasons(cards: AnimeCard[]): UpcomingSeasonEntry[] {
  const collapsed = collapseFranchises(cards);
  const entries: UpcomingSeasonEntry[] = [];
  const seen = new Set<number>();

  for (const card of collapsed) {
    for (const season of card.seasons) {
      if (season.status !== 'NOT_YET_RELEASED') continue;
      if (seen.has(season.id)) continue;
      seen.add(season.id);

      const seasonLabel =
        season.seasonNumber !== null
          ? `S${season.seasonNumber}`
          : season.title !== card.franchiseTitle
            ? season.title
            : 'Nuova stagione';

      entries.push({
        franchiseTitle: card.franchiseTitle,
        seasonLabel,
        seasonId: season.id,
        coverImage: season.coverImage || card.coverImage,
        releaseLabel: formatStartDate(season.startDate, season.season, season.seasonYear),
        sortKey: fuzzyDateSortKey(season.startDate, season.season, season.seasonYear),
      });
    }
  }

  return entries.sort((a, b) => a.sortKey - b.sortKey);
}

export async function fetchAnimeByIds(
  ids: number[],
  options: { expandFranchise?: boolean; skipJikan?: boolean; jikanOnlyIfStatus?: AnimeStatus[] } = {}
): Promise<AnimeCard[]> {
  if (!ids.length) return [];

  const needsJikan = (status: AnimeStatus, idMal: number | null): idMal is number => {
    if (!idMal || options.skipJikan) return false;
    if (!options.jikanOnlyIfStatus) return true;
    return options.jikanOnlyIfStatus.includes(status);
  };

  if (!options.expandFranchise && ids.length > 1) {
    try {
      const byId = await fetchRawMediaBatch(ids);
      const broadcasts = new Map<number, { day: string | null; time: string | null }>();

      if (!options.skipJikan) {
        const malIds = [...new Set(
          ids
            .map((id) => byId.get(id))
            .filter((raw): raw is RawMedia => !!raw && needsJikan(raw.status, raw.idMal))
            .map((raw) => raw.idMal!)
        )];

        for (let i = 0; i < malIds.length; i += 3) {
          if (i > 0) await sleep(400);
          const chunk = malIds.slice(i, i + 3);
          const chunkResults = await Promise.all(chunk.map((malId) => fetchJikanBroadcast(malId)));
          chunk.forEach((malId, idx) => {
            const broadcast = chunkResults[idx];
            if (broadcast) broadcasts.set(malId, broadcast);
          });
        }
      }

      const results: AnimeCard[] = [];
      for (const id of ids) {
        const raw = byId.get(id);
        if (!raw || isExcludedRawMedia(raw)) continue;

        const broadcast = raw.idMal ? broadcasts.get(raw.idMal) : undefined;
        results.push(await normalizeMedia(raw, broadcast));
      }

      return results;
    } catch {
      // fallback sequenziale sotto
    }
  }

  const results: AnimeCard[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      if (i > 0) {
        await sleep(options.expandFranchise ? FRANCHISE_FETCH_DELAY_MS : ANILIST_BATCH_DELAY_MS);
      }
      const raw = await fetchRawMediaById(id);
      if (!raw) continue;

      let fullSeasons: FranchiseSeason[] | undefined;
      if (options.expandFranchise) {
        try {
          fullSeasons = await fetchFullFranchiseSeasons(raw);
        } catch {
          fullSeasons = buildFranchiseSeasons(raw);
        }
      }

      let broadcast;
      if (needsJikan(raw.status, raw.idMal)) broadcast = await fetchJikanBroadcast(raw.idMal);
      results.push(await normalizeMedia(raw, broadcast, fullSeasons));
    } catch {
      // salta voci non caricabili
    }
  }
  return results;
}

export function matchesAiringDay(anime: AnimeCard, day: string): boolean {
  if (!anime.airingDay) return false;
  const normalized = Object.entries(DAY_MAP).find(([, v]) => v === day)?.[0];
  return anime.airingDay === day || anime.airingDay === normalized;
}

export function filterAnimeClientSide(
  media: AnimeCard[],
  filters: {
    minSeasons: number;
    platform: string;
    status?: AnimeStatus | '';
    airingDay?: string;
  }
): AnimeCard[] {
  return media.filter((a) => {
    if (isExcludedAnime(a)) return false;
    if (filters.minSeasons > 0 && a.seasonCount < filters.minSeasons) return false;
    if (filters.platform && !matchesPlatform(a.platforms, filters.platform)) return false;
    if (filters.status === 'FINISHED' && a.franchiseStatus !== 'FINISHED') return false;
    if (filters.status === 'RELEASING' && a.franchiseStatus !== 'RELEASING') return false;
    if (filters.status === 'NOT_YET_RELEASED' && a.franchiseStatus !== 'NOT_YET_RELEASED') return false;
    if (filters.airingDay) {
      if (a.franchiseStatus !== 'RELEASING') return false;
      if (!matchesAiringDay(a, filters.airingDay)) return false;
    }
    return true;
  });
}
