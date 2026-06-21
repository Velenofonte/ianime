import { api } from './api';

export const TRANSLATION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_PREFIX = 'ianime-desc-it-';

function cacheKey(anilistId: number, textEn: string): string {
  let hash = 0;
  for (let i = 0; i < textEn.length; i++) {
    hash = (hash * 31 + textEn.charCodeAt(i)) | 0;
  }
  return `${CACHE_PREFIX}${anilistId}-${hash}`;
}

interface CacheEntry {
  translated: string;
  expiresAt: number;
}

function readCache(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.expiresAt <= Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.translated;
  } catch {
    return null;
  }
}

function writeCache(key: string, translated: string): void {
  const entry: CacheEntry = {
    translated,
    expiresAt: Date.now() + TRANSLATION_CACHE_TTL_MS,
  };
  localStorage.setItem(key, JSON.stringify(entry));
}

export function isTranslatableDescription(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed !== 'Nessuna descrizione disponibile.';
}

export async function fetchItalianDescription(anilistId: number, textEn: string): Promise<string> {
  const key = cacheKey(anilistId, textEn);
  const cached = readCache(key);
  if (cached) return cached;

  const { translated } = await api.translateDescription(anilistId, textEn);
  writeCache(key, translated);
  return translated;
}
