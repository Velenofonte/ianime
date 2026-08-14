from __future__ import annotations

import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

import httpx

FEEDS = (
    ("AnimeClick", "https://www.animeclick.it/rss"),
    ("Everyeye Anime", "https://anime.everyeye.it/feed/feed_news_rss.asp"),
)

USER_AGENT = "iAnime/1.0 (+https://ianime.gigalixirapp.com)"
TIMEOUT_SECONDS = 8.0
CACHE_TTL_SECONDS = 15 * 60
HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")

_cache_items: list[dict] = []
_cache_at = 0.0


class ItalyNewsError(Exception):
    pass


def _local_tag(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child_text(item: ET.Element, names: set[str]) -> str:
    for child in item:
        if _local_tag(child.tag) in names and child.text:
            return child.text.strip()
    return ""


def _strip_html(value: str) -> str:
    return WHITESPACE_RE.sub(" ", HTML_TAG_RE.sub(" ", value)).strip()


def _parse_date(value: str) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat()
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.isoformat()
    except (TypeError, ValueError, OverflowError):
        pass
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.isoformat()
    except ValueError:
        return datetime.now(timezone.utc).isoformat()


def _item_image(item: ET.Element) -> str:
    for child in item:
        name = _local_tag(child.tag)
        if name == "enclosure":
            url = child.attrib.get("url", "")
            mime = child.attrib.get("type", "")
            if url and (mime.startswith("image/") or url.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif"))):
                return url
        if name in {"thumbnail", "content"}:
            url = child.attrib.get("url", "")
            if url:
                return url
        if name == "image":
            url = child.attrib.get("href") or _child_text(child, {"url"})
            if url:
                return url
    description = _child_text(item, {"description", "summary", "encoded"})
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', description, re.IGNORECASE)
    return match.group(1) if match else ""


def _item_link(item: ET.Element) -> str:
    for child in item:
        if _local_tag(child.tag) != "link":
            continue
        href = child.attrib.get("href", "").strip()
        if href:
            return href
        if child.text and child.text.strip():
            return child.text.strip()
    return ""


def _parse_feed(xml_text: str, source: str) -> list[dict]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    articles: list[dict] = []
    for item in root.iter():
        tag = _local_tag(item.tag)
        if tag not in {"item", "entry"}:
            continue
        title = _child_text(item, {"title"})
        link = _item_link(item)
        if not title or not link:
            continue
        excerpt = _strip_html(
            _child_text(item, {"description", "summary", "encoded", "content"})
        )
        guid = _child_text(item, {"guid", "id"}) or link
        date = _parse_date(_child_text(item, {"pubDate", "published", "updated", "date"}))
        articles.append(
            {
                "title": title,
                "slug": f"{source}-{guid}"[:180],
                "source": source,
                "excerpt": excerpt[:400],
                "date": date,
                "image": _item_image(item),
                "link": link,
            }
        )
    return articles


def _fetch_feed(source: str, url: str) -> list[dict]:
    try:
        with httpx.Client(
            timeout=TIMEOUT_SECONDS,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
            },
            follow_redirects=True,
        ) as client:
            response = client.get(url)
            response.raise_for_status()
    except httpx.HTTPError:
        return []
    return _parse_feed(response.text, source)


def _dedupe(articles: list[dict]) -> list[dict]:
    seen: set[str] = set()
    unique: list[dict] = []
    for article in articles:
        key = article["link"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(article)
    return unique


def get_italy_articles() -> list[dict]:
    global _cache_items, _cache_at
    now = time.monotonic()
    if _cache_items and now - _cache_at < CACHE_TTL_SECONDS:
        return _cache_items

    collected: list[dict] = []
    with ThreadPoolExecutor(max_workers=len(FEEDS)) as pool:
        futures = [pool.submit(_fetch_feed, source, url) for source, url in FEEDS]
        for future in futures:
            collected.extend(future.result())

    if not collected:
        if _cache_items:
            return _cache_items
        raise ItalyNewsError("Nessuna news italiana disponibile al momento")

    collected.sort(key=lambda article: article["date"], reverse=True)
    _cache_items = _dedupe(collected)
    _cache_at = now
    return _cache_items
