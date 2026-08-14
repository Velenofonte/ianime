from __future__ import annotations

import re
import time
from urllib.parse import quote_plus, urlparse

import httpx

# Wikidata P14462 / share Prime: amzn1.dv.gti.{uuid}. ASIN e id compatti non sono GTI.
GTI_RE = re.compile(
    r"amzn\d\.dv\.gti\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",
    re.I,
)
PAGE_TITLE_ID_RE = re.compile(r'"pageTitleId"\s*:\s*"(amzn\d\.dv\.gti\.[a-f0-9\-]+)"', re.I)
COMPACT_RE = re.compile(r"/detail/(0[0-9A-Z]{15,})")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
}
TIMEOUT_SECONDS = 12.0
CACHE_TTL_SECONDS = 6 * 60 * 60

_cache: dict[str, tuple[float, str | None]] = {}
_MISS = object()


def _cache_get(key: str) -> str | None | object:
    hit = _cache.get(key)
    if not hit:
        return _MISS
    stored_at, value = hit
    if time.monotonic() - stored_at > CACHE_TTL_SECONDS:
        return _MISS
    return value


def _cache_set(key: str, value: str | None) -> None:
    _cache[key] = (time.monotonic(), value)


def _normalize_gti(value: str | None) -> str | None:
    if not value:
        return None
    match = GTI_RE.fullmatch(value.strip())
    return match.group(0).lower() if match else None


def _gti_from_html(html: str) -> str | None:
    title_id = PAGE_TITLE_ID_RE.search(html)
    if title_id:
        gti = _normalize_gti(title_id.group(1))
        if gti:
            return gti
    match = GTI_RE.search(html)
    return _normalize_gti(match.group(0) if match else None)


def _fetch(url: str) -> str:
    with httpx.Client(timeout=TIMEOUT_SECONDS, follow_redirects=True, headers=HEADERS) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.text


def _gti_from_primevideo_url(raw_url: str) -> str | None:
    parsed = urlparse(raw_url)
    host = parsed.netloc.lower().replace("www.", "")
    if "primevideo.com" not in host:
        return None
    in_query = GTI_RE.search(parsed.query)
    if in_query:
        return _normalize_gti(in_query.group(0))
    compact = COMPACT_RE.search(parsed.path)
    fetch_url = raw_url
    if compact and "/region/" not in parsed.path:
        fetch_url = f"https://www.primevideo.com/region/eu/detail/{compact.group(1)}"
    try:
        return _gti_from_html(_fetch(fetch_url))
    except httpx.HTTPError:
        return None


def _gti_from_search(title: str) -> str | None:
    query = quote_plus(title.strip())
    if not query:
        return None
    try:
        html = _fetch(f"https://www.primevideo.com/region/eu/search?phrase={query}")
    except httpx.HTTPError:
        return None
    compact = COMPACT_RE.search(html)
    if compact:
        gti = _gti_from_primevideo_url(f"https://www.primevideo.com/region/eu/detail/{compact.group(1)}")
        if gti:
            return gti
    return _gti_from_html(html)


def resolve_prime_gti(url: str = "", title: str = "") -> str | None:
    key = f"{url.strip()}|{title.strip().lower()}"
    cached = _cache_get(key)
    if cached is not _MISS:
        return cached  # type: ignore[return-value]

    gti = None
    in_url = GTI_RE.search(url or "")
    if in_url:
        gti = _normalize_gti(in_url.group(0))
    if not gti and url:
        gti = _gti_from_primevideo_url(url)
    if not gti and title.strip():
        gti = _gti_from_search(title)

    _cache_set(key, gti)
    return gti
