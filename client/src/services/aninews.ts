import type { NewsArticle } from '../types/anime';

const NEWS_BASE = 'https://aninews.vercel.app';

function mapArticle(a: Record<string, string>): NewsArticle {
  return {
    title: a.title,
    slug: a.slug,
    source: a.source,
    excerpt: a.excerpt,
    date: a.date,
    image: a.image,
    link: a.link,
  };
}

export async function fetchNews(
  limit = 20,
  source = 'all',
  cursor?: string
): Promise<{ articles: NewsArticle[]; hasMore: boolean; nextCursor?: string }> {
  const params = new URLSearchParams({ limit: String(limit), source });
  if (cursor) params.set('cursor', cursor);
  const res = await fetch(`${NEWS_BASE}/api/news?${params}`);
  const json = await res.json();
  return {
    articles: (json.data || []).map(mapArticle),
    hasMore: json.meta?.hasMore ?? false,
    nextCursor: json.meta?.nextCursor,
  };
}

export async function searchNews(query: string, limit = 5): Promise<{ articles: NewsArticle[] }> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await fetch(`${NEWS_BASE}/api/search?${params}`);
  const json = await res.json();
  return {
    articles: (json.data || []).map(mapArticle),
  };
}
