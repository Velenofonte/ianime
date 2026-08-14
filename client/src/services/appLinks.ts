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

const PRIME_ASIN_RE = /\b(B[0-9A-Z]{9})\b/i;
const PRIME_CATALOG_ID_RE = /\b(0[0-9A-Z]{15,})\b/;

function primeAsin(url: URL): string | null {
  const fromQuery = url.searchParams.get('asin');
  if (fromQuery && PRIME_ASIN_RE.test(fromQuery)) return fromQuery.toUpperCase();
  const match = `${url.pathname}${url.search}`.match(PRIME_ASIN_RE);
  return match?.[1]?.toUpperCase() ?? null;
}

function primeCatalogId(url: URL): string | null {
  const gti = url.searchParams.get('gti');
  if (gti) return gti;
  const parts = url.pathname.split('/').filter(Boolean);
  const detailIdx = parts.findIndex((p) => p.toLowerCase() === 'detail');
  if (detailIdx < 0) return null;
  for (let i = parts.length - 1; i > detailIdx; i--) {
    const seg = parts[i];
    if (PRIME_CATALOG_ID_RE.test(seg)) return seg;
  }
  return null;
}

/** L'app Prime non gestisce www.primevideo.com: serve app.primevideo.com. */
function primeAppUrl(url: URL): URL {
  const asin = primeAsin(url);
  if (asin) return new URL(`https://app.primevideo.com/detail?asin=${asin}`);
  const id = primeCatalogId(url);
  if (id) {
    if (id.startsWith('amzn1.dv.gti.')) {
      return new URL(`https://app.primevideo.com/detail?gti=${encodeURIComponent(id)}`);
    }
    return new URL(`https://app.primevideo.com/detail/${id}`);
  }
  const next = new URL(url.toString());
  next.hostname = 'app.primevideo.com';
  next.pathname = next.pathname.replace(/^\/region\/[^/]+/i, '').replace(/^\/-\/[^/]+/, '') || '/';
  return next;
}

export function streamingAppTarget(rawUrl: string): AppTarget | null {
  const url = parseUrl(rawUrl);
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null;

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '').replace(/^app\./, '').toLowerCase();

  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube';
  if (host === 'netflix.com' || host.endsWith('.netflix.com')) return 'netflix';
  if (host === 'crunchyroll.com' || host.endsWith('.crunchyroll.com')) return 'crunchyroll';
  if (host === 'primevideo.com' || host.endsWith('.primevideo.com')) return 'prime';
  if (host === 'disneyplus.com' || host.endsWith('.disneyplus.com')) return 'disney';
  if (host === 'amazon.com' || host.endsWith('.amazon.com') || /^amazon\.[a-z.]{2,}$/.test(host)) {
    if (/primevideo|\/gp\/video|watch\.amazon/i.test(`${url.hostname}${url.pathname}`)) return 'prime';
  }
  return null;
}

function androidIntentUrl(webUrl: string, target: AppTarget): string {
  let url = parseUrl(webUrl);
  if (!url) return webUrl;
  if (target === 'youtube') url = youtubeWatchUrl(url);
  if (target === 'prime') url = primeAppUrl(url);

  const hostAndPath = `${url.host}${url.pathname}${url.search}`;
  const fallback = encodeURIComponent(webUrl);
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
    const asin = primeAsin(url);
    if (asin) return `aiv://aiv/watch?asin=${asin}`;
    const primed = primeAppUrl(url);
    return `aiv://${primed.host}${primed.pathname}${primed.search}`;
  }
  if (target === 'disney') return `disneyplus://${rest}`;
  return null;
}

export function openInNativeApp(webUrl: string): void {
  const target = streamingAppTarget(webUrl);
  if (!target) {
    window.open(webUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  if (isAndroid()) {
    window.location.href = androidIntentUrl(webUrl, target);
    return;
  }

  if (isIOS()) {
    const scheme = iosSchemeUrl(webUrl, target);
    if (!scheme) {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const started = Date.now();
    window.location.href = scheme;
    window.setTimeout(() => {
      if (!document.hidden && Date.now() - started < 2000) {
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      }
    }, 900);
    return;
  }

  window.open(webUrl, '_blank', 'noopener,noreferrer');
}
