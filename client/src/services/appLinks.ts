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
  if (target === 'prime') return `aiv://${rest}`;
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
