import type { NewsArticle } from '../types/anime';

const NEWS_BASE = 'https://aninews.vercel.app';

export const MIN_VISIBLE_NEWS = 10;
export const MIN_SEARCH_LENGTH = 2;

export interface NewsPageResult {
  articles: NewsArticle[];
  hasMore: boolean;
  nextCursor?: string;
  nextOffset?: number;
}

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
): Promise<NewsPageResult> {
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

export async function searchNews(
  query: string,
  options: { limit?: number; source?: string; offset?: number } = {}
): Promise<NewsPageResult> {
  const limit = options.limit ?? 5;
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (options.source && options.source !== 'all') params.set('source', options.source);
  if (options.offset) params.set('offset', String(options.offset));
  const res = await fetch(`${NEWS_BASE}/api/search?${params}`);
  const json = await res.json();
  const articles: NewsArticle[] = (json.data || []).map(mapArticle);
  const offset = json.meta?.offset ?? options.offset ?? 0;
  const returned = json.meta?.returned ?? articles.length;
  const hasMore = json.meta?.hasMore ?? false;
  return {
    articles,
    hasMore,
    nextOffset: hasMore ? offset + returned : undefined,
  };
}

export async function fetchNewsPage(
  source: string,
  options: { search?: string; pageParam?: string | number }
): Promise<NewsPageResult> {
  const q = options.search?.trim() ?? '';
  if (q.length >= MIN_SEARCH_LENGTH) {
    const offset = typeof options.pageParam === 'number' ? options.pageParam : 0;
    return searchNews(q, { limit: 20, source, offset });
  }
  const cursor = typeof options.pageParam === 'string' ? options.pageParam : undefined;
  return fetchNews(20, source, cursor);
}
