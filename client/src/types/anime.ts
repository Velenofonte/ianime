export type AnimeStatus = 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';

export type ItalianAudioStatus = 'dub' | 'sub' | 'unknown';

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
}

export interface AnimeFilters {
  search: string;
  genres: string[];
  status: AnimeStatus | '';
  minSeasons: number;
  releaseOrder: '' | 'recent' | 'oldest';
  minStars: number;
  platform: string;
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
