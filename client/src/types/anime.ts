export type AnimeStatus = 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';

export type ItalianAudioStatus = 'dub' | 'sub' | 'unknown';

export interface FuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface FranchiseSeason {
  id: number;
  title: string;
  status: AnimeStatus;
  episodes: number | null;
  seasonNumber: number | null;
  coverImage: string;
  startDate: FuzzyDate | null;
  season: string | null;
  seasonYear: number | null;
}

export interface UpcomingSeasonEntry {
  franchiseTitle: string;
  seasonLabel: string;
  seasonId: number;
  coverImage: string;
  releaseLabel: string | null;
  sortKey: number;
}

export interface AnimeCard {
  id: number;
  idMal: number | null;
  title: string;
  titleEnglish: string | null;
  coverImage: string;
  genres: string[];
  description: string;
  episodes: number | null;
  seasonCount: number;
  status: AnimeStatus;
  statusLabel: string;
  italianAudio: ItalianAudioStatus;
  italianAudioLabel: string;
  airingDay: string | null;
  airingTime: string | null;
  platforms: string[];
  italianPlatforms: string[];
  averageScore: number | null;
  franchiseKey: string;
  franchiseTitle: string;
  titleSlug: string;
  seasonNumber: number | null;
  isSeasonEntry: boolean;
  franchiseStatus: AnimeStatus;
  franchiseStatusLabel: string;
  seasons: FranchiseSeason[];
  canonicalSeasonId: number;
  startDate: FuzzyDate | null;
  season: string | null;
  seasonYear: number | null;
}

export const WEEK_DAYS = [
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
  'Domenica',
] as const;

export type WeekDay = (typeof WEEK_DAYS)[number];

export interface AnimeFilters {
  search: string;
  genres: string[];
  status: AnimeStatus | '';
  minSeasons: number;
  releaseOrder: '' | 'recent' | 'oldest';
  minStars: number;
  platform: string;
  airingDay: '' | WeekDay;
}

export interface NewsArticle {
  title: string;
  slug: string;
  source: string;
  excerpt: string;
  date: string;
  image: string;
  link: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
}

export const ITALIAN_PLATFORMS = ['Crunchyroll', 'Netflix', 'Prime Video', 'Disney Plus', 'Disney+', 'VVVVID', 'Anime Generation'];

export const EXCLUDED_GENRES = ['Hentai'] as const;

export const PLATFORM_OPTIONS = [
  { label: 'Tutte', value: '' },
  { label: 'Crunchyroll', value: 'Crunchyroll' },
  { label: 'Netflix', value: 'Netflix' },
  { label: 'Prime Video', value: 'Prime Video' },
  { label: 'Disney+', value: 'Disney Plus' },
  { label: 'VVVVID', value: 'VVVVID' },
];

export const STATUS_OPTIONS = [
  { label: 'Tutti', value: '' },
  { label: 'In corso', value: 'RELEASING' },
  { label: 'In arrivo', value: 'NOT_YET_RELEASED' },
  { label: 'Completo', value: 'FINISHED' },
];

export const RELEASE_ORDER_OPTIONS = [
  { label: 'Nessun filtro', value: '' },
  { label: 'Più recente', value: 'recent' },
  { label: 'Meno recente', value: 'oldest' },
] as const;

export const SCORE_FILTER_OPTIONS = [
  { label: 'Tutti', value: 0 },
  { label: '1+ ★', value: 1 },
  { label: '2+ ★', value: 2 },
  { label: '3+ ★', value: 3 },
  { label: '4+ ★', value: 4 },
  { label: '5 ★', value: 5 },
] as const;

export const AIRING_DAY_OPTIONS: { label: string; value: '' | WeekDay }[] = [
  { label: 'Tutti', value: '' },
  ...WEEK_DAYS.map((d) => ({ label: d, value: d })),
];

export const DAY_MAP: Record<string, string> = {
  monday: 'Lunedì',
  tuesday: 'Martedì',
  wednesday: 'Mercoledì',
  thursday: 'Giovedì',
  friday: 'Venerdì',
  saturday: 'Sabato',
  sunday: 'Domenica',
  Mondays: 'Lunedì',
  Tuesdays: 'Martedì',
  Wednesdays: 'Mercoledì',
  Thursdays: 'Giovedì',
  Fridays: 'Venerdì',
  Saturdays: 'Sabato',
  Sundays: 'Domenica',
};
