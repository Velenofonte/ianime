import type { NewsArticle } from '../types/anime';

const NEWS_URL = 'https://aninews.vercel.app/api/news';

export async function fetchNews(
  limit = 20,
  source = 'all',
  cursor?: string
): Promise<{ articles: NewsArticle[]; hasMore: boolean; nextCursor?: string }> {
  const params = new URLSearchParams({ limit: String(limit), source });
  if (cursor) params.set('cursor', cursor);
  const res = await fetch(`${NEWS_URL}?${params}`);
  const json = await res.json();
  const articles: NewsArticle[] = (json.data || []).map((a: Record<string, string>) => ({
    title: a.title,
    slug: a.slug,
    source: a.source,
    excerpt: a.excerpt,
    date: a.date,
    image: a.image,
    link: a.link,
  }));
  return {
    articles,
    hasMore: json.meta?.hasMore ?? false,
    nextCursor: json.meta?.nextCursor,
  };
}
