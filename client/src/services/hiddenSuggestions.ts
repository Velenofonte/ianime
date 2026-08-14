const STORAGE_KEY = 'ianime-hidden-suggestions';

export interface HiddenSuggestions {
  ids: number[];
  slugs: string[];
}

function emptyHidden(): HiddenSuggestions {
  return { ids: [], slugs: [] };
}

export function loadHiddenSuggestions(): HiddenSuggestions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyHidden();
    const parsed = JSON.parse(raw) as HiddenSuggestions;
    return {
      ids: Array.isArray(parsed.ids) ? parsed.ids.filter((id) => Number.isFinite(id)) : [],
      slugs: Array.isArray(parsed.slugs) ? parsed.slugs.filter((s) => typeof s === 'string') : [],
    };
  } catch {
    return emptyHidden();
  }
}

export function hideSuggestion(ids: number[], slug: string): HiddenSuggestions {
  const current = loadHiddenSuggestions();
  const idSet = new Set(current.ids);
  for (const id of ids) idSet.add(id);
  const slugSet = new Set(current.slugs);
  if (slug) slugSet.add(slug);
  const next: HiddenSuggestions = { ids: [...idSet], slugs: [...slugSet] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
