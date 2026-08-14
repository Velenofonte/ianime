import { create } from 'zustand';
import { EXCLUDED_GENRES, type AnimeFilters } from '../types/anime';

interface FilterStore extends AnimeFilters {
  panelOpen: boolean;
  setSearch: (search: string) => void;
  setGenres: (genres: string[]) => void;
  setStatus: (status: AnimeFilters['status']) => void;
  setMinSeasons: (minSeasons: number) => void;
  setReleaseOrder: (releaseOrder: AnimeFilters['releaseOrder']) => void;
  setMinStars: (minStars: number) => void;
  setPlatform: (platform: string) => void;
  setAiringDay: (airingDay: AnimeFilters['airingDay']) => void;
  setLinkIt: (linkIt: boolean) => void;
  togglePanel: () => void;
  reset: () => void;
}

const initial: AnimeFilters = {
  search: '',
  genres: [],
  status: '',
  minSeasons: 0,
  releaseOrder: '',
  minStars: 0,
  platform: '',
  airingDay: '',
  linkIt: false,
};

export const useFilterStore = create<FilterStore>((set) => ({
  ...initial,
  panelOpen: localStorage.getItem('ianime-filters-open') === '1',
  setSearch: (search) => set({ search }),
  setGenres: (genres) =>
    set({ genres: genres.filter((g) => !EXCLUDED_GENRES.includes(g as (typeof EXCLUDED_GENRES)[number])) }),
  setStatus: (status) =>
    set(status === 'RELEASING' ? { status } : { status, airingDay: '' }),
  setMinSeasons: (minSeasons) => set({ minSeasons }),
  setReleaseOrder: (releaseOrder) => set({ releaseOrder }),
  setMinStars: (minStars) => set({ minStars }),
  setPlatform: (platform) => set({ platform }),
  setAiringDay: (airingDay) =>
    set(airingDay ? { airingDay, status: 'RELEASING' } : { airingDay }),
  setLinkIt: (linkIt) => set({ linkIt }),
  togglePanel: () =>
    set((state) => {
      const panelOpen = !state.panelOpen;
      localStorage.setItem('ianime-filters-open', panelOpen ? '1' : '0');
      return { panelOpen };
    }),
  reset: () => set(initial),
}));
