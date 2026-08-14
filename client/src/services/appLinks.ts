const ANDROID_PACKAGES = {
  netflix: 'com.netflix.mediaclient',
  crunchyroll: 'com.crunchyroll.crunchyroid',
  prime: 'com.amazon.avod.thirdpartyclient',
  youtube: 'com.google.android.youtube',
  disney: 'com.disney.disneyplus',
} as const;

type AppTarget = keyof typeof ANDROID_PACKAGES;

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function youtubeWatchUrl(url: URL): URL {
  if (url.hostname.replace(/^www\./, '') === 'youtu.be') {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    if (id) return new URL(`https://www.youtube.com/watch?v=${id}`);
  }
  const shorts = url.pathname.match(/^\/shorts\/([^/]+)/);
  if (shorts?.[1]) return new URL(`https://www.youtube.com/watch?v=${shorts[1]}`);
  return url;
}

const PRIME_CATALOG_ID_RE = /\b(0[0-9A-Z]{15,})\b/;
const PRIME_EU_WEB = 'https://www.primevideo.com/region/eu/';
/** /home apre l'app. /detail accetta solo gti=amzn1.dv.gti.{uuid} — ASIN/asin= causano parse error. */
const PRIME_LAUNCH_INTENT = `intent://app.primevideo.com/home#Intent;scheme=https;package=${ANDROID_PACKAGES.prime};end`;
const PRIME_GTI_RE =
  /^amzn\d\.dv\.gti\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const API_URL = import.meta.env.VITE_API_URL || '/api';
const primeGtiCache = new Map<string, string | null>();
const primeGtiPending = new Map<string, Promise<string | null>>();

function primeCacheKey(url: string, title?: string): string {
  return `${url}|${title?.trim() ?? ''}`;
}

export async function prefetchPrimeGti(url: string, title?: string): Promise<string | null> {
  const key = primeCacheKey(url, title);
  if (primeGtiCache.has(key)) return primeGtiCache.get(key) ?? null;
  const pending = primeGtiPending.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const params = new URLSearchParams();
      if (url) params.set('url', url);
      if (title?.trim()) params.set('title', title.trim());
      const res = await fetch(`${API_URL}/prime/gti?${params}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { gti?: string | null };
      const gti = data.gti && PRIME_GTI_RE.test(data.gti.trim()) ? data.gti.trim() : null;
      primeGtiCache.set(key, gti);
      return gti;
    } catch {
      return null;
    } finally {
      primeGtiPending.delete(key);
    }
  })();

  primeGtiPending.set(key, request);
  return request;
}

function cachedPrimeGti(url: string, title?: string): string | null {
  return primeGtiCache.get(primeCacheKey(url, title)) ?? null;
}

function androidPrimeIntent(webUrl: string, title?: string): string {
  const gti = cachedPrimeGti(webUrl, title);
  if (gti) {
    return `intent://app.primevideo.com/detail?gti=${gti}#Intent;scheme=https;package=${ANDROID_PACKAGES.prime};end`;
  }
  return PRIME_LAUNCH_INTENT;
}

function primeCatalogId(url: URL): string | null {
  const parts = url.pathname.split('/').filter(Boolean);
  const detailIdx = parts.findIndex((p) => p.toLowerCase() === 'detail');
  if (detailIdx < 0) return null;
  for (let i = parts.length - 1; i > detailIdx; i--) {
    const seg = parts[i];
    if (PRIME_CATALOG_ID_RE.test(seg)) return seg;
  }
  return null;
}

function primeEuFallback(url: URL): string {
  const id = primeCatalogId(url);
  if (id && !id.startsWith('amzn1.')) return `${PRIME_EU_WEB}detail/${id}`;
  return PRIME_EU_WEB;
}

function siteAppTarget(site?: string): AppTarget | null {
  if (!site) return null;
  const s = site.toLowerCase();
  if (s.includes('prime') || (s.includes('amazon') && s.includes('video'))) return 'prime';
  if (s.includes('netflix')) return 'netflix';
  if (s.includes('crunchyroll')) return 'crunchyroll';
  if (s.includes('disney')) return 'disney';
  if (s.includes('youtube')) return 'youtube';
  return null;
}

export function streamingAppTarget(rawUrl: string, site?: string): AppTarget | null {
  const fromSite = siteAppTarget(site);
  if (fromSite) return fromSite;

  const url = parseUrl(rawUrl);
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null;

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '').replace(/^app\./, '').toLowerCase();

  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube';
  if (host === 'netflix.com' || host.endsWith('.netflix.com')) return 'netflix';
  if (host === 'crunchyroll.com' || host.endsWith('.crunchyroll.com')) return 'crunchyroll';
  if (host === 'primevideo.com' || host.endsWith('.primevideo.com')) return 'prime';
  if (host === 'disneyplus.com' || host.endsWith('.disneyplus.com')) return 'disney';
  if (host === 'amazon.com' || host.endsWith('.amazon.com') || /^amazon\.[a-z.]{2,}$/.test(host)) {
    if (/primevideo|\/gp\/video|\/gp\/product|\/dp\/|watch\.amazon/i.test(`${url.hostname}${url.pathname}`)) {
      return 'prime';
    }
  }
  return null;
}

function androidIntentUrl(webUrl: string, target: AppTarget): string {
  let url = parseUrl(webUrl);
  if (!url) return webUrl;
  if (target === 'youtube') url = youtubeWatchUrl(url);

  const hostAndPath = `${url.host}${url.pathname}${url.search}`;
  const fallback = encodeURIComponent(url.toString());
  const scheme = url.protocol.replace(':', '');
  return `intent://${hostAndPath}#Intent;scheme=${scheme};package=${ANDROID_PACKAGES[target]};S.browser_fallback_url=${fallback};end`;
}

function iosSchemeUrl(webUrl: string, target: AppTarget): string | null {
  let url = parseUrl(webUrl);
  if (!url) return null;
  if (target === 'youtube') url = youtubeWatchUrl(url);

  const rest = `${url.host}${url.pathname}${url.search}`;
  if (target === 'youtube') {
    const id = url.searchParams.get('v');
    return id ? `youtube://www.youtube.com/watch?v=${id}` : `youtube://${rest}`;
  }
  if (target === 'netflix') return `nflx://${rest}`;
  if (target === 'crunchyroll') return `crunchyroll://${rest}`;
  if (target === 'prime') {
    const gti = cachedPrimeGti(webUrl, undefined);
    if (gti) return `aiv://aiv/detail?gti=${gti}`;
    return 'aiv://';
  }
  if (target === 'disney') return `disneyplus://${rest}`;
  return null;
}

function openWithAppFallback(href: string, fallbackUrl: string): void {
  const started = Date.now();
  window.location.href = href;
  window.setTimeout(() => {
    if (document.hidden || Date.now() - started >= 2000) return;
    window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
  }, 900);
}

export function openInNativeApp(webUrl: string, site?: string, title?: string): void {
  const target = streamingAppTarget(webUrl, site);
  if (!target) {
    window.open(webUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  const parsed = parseUrl(webUrl);
  const primeFallback = parsed ? primeEuFallback(parsed) : PRIME_EU_WEB;

  if (isAndroid()) {
    if (target === 'prime') {
      window.location.href = androidPrimeIntent(webUrl, title);
      return;
    }
    window.location.href = androidIntentUrl(webUrl, target);
    return;
  }

  if (isIOS()) {
    if (target === 'prime') {
      const gti = cachedPrimeGti(webUrl, title);
      const scheme = gti ? `aiv://aiv/detail?gti=${gti}` : 'aiv://';
      openWithAppFallback(scheme, primeFallback);
      return;
    }
    const scheme = iosSchemeUrl(webUrl, target);
    if (!scheme) {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    openWithAppFallback(scheme, webUrl);
    return;
  }

  window.open(target === 'prime' ? primeFallback : webUrl, '_blank', 'noopener,noreferrer');
}
