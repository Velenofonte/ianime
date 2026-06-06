import { create } from 'zustand';
import type { AnimeFilters } from '../types/anime';

interface FilterStore extends AnimeFilters {
  panelOpen: boolean;
  setSearch: (search: string) => void;
  setGenres: (genres: string[]) => void;
  setStatus: (status: AnimeFilters['status']) => void;
  setMinSeasons: (minSeasons: number) => void;
  setReleaseOrder: (releaseOrder: AnimeFilters['releaseOrder']) => void;
  setMinStars: (minStars: number) => void;
  setPlatform: (platform: string) => void;
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
};

export const useFilterStore = create<FilterStore>((set) => ({
  ...initial,
  panelOpen: localStorage.getItem('ianime-filters-open') === '1',
  setSearch: (search) => set({ search }),
  setGenres: (genres) => set({ genres }),
  setStatus: (status) => set({ status }),
  setMinSeasons: (minSeasons) => set({ minSeasons }),
  setReleaseOrder: (releaseOrder) => set({ releaseOrder }),
  setMinStars: (minStars) => set({ minStars }),
  setPlatform: (platform) => set({ platform }),
  togglePanel: () =>
    set((state) => {
      const panelOpen = !state.panelOpen;
      localStorage.setItem('ianime-filters-open', panelOpen ? '1' : '0');
      return { panelOpen };
    }),
  reset: () => set(initial),
}));
