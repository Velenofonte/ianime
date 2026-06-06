import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useState } from 'react';
import { fetchNews } from '../services/aninews';

const SOURCES = [
  { label: 'Tutte', value: 'all' },
  { label: 'Crunchyroll', value: 'crunchyroll' },
  { label: 'ANN', value: 'ann' },
  { label: 'MyAnimeList', value: 'myanimelist' },
  { label: 'Anime Corner', value: 'animecorner' },
];

export function NewsPage() {
  const [source, setSource] = useState('all');
  const { data, isLoading, error } = useQuery({
    queryKey: ['news', source],
    queryFn: () => fetchNews(20, source),
    staleTime: 900000,
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">News anime</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <button
            key={s.value}
            onClick={() => setSource(s.value)}
            className={`rounded-full px-3 py-1 text-sm ${
              source === s.value ? 'bg-accent text-white' : 'bg-surface-card text-gray-300 hover:bg-surface-hover'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {isLoading && <p className="text-gray-400">Caricamento news...</p>}
      {error && <p className="text-red-400">Errore: {(error as Error).message}</p>}
      <div className="space-y-4">
        {data?.articles.map((article) => (
          <a
            key={article.slug}
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-4 rounded-xl border border-white/10 bg-surface-card p-4 transition hover:border-accent/30"
          >
            {article.image && (
              <img src={article.image} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
            )}
            <div>
              <p className="text-xs text-accent-light">{article.source}</p>
              <h2 className="font-semibold leading-tight">{article.title}</h2>
              {article.excerpt && <p className="mt-1 line-clamp-2 text-sm text-gray-400">{article.excerpt}</p>}
              <p className="mt-2 text-xs text-gray-500">
                {format(new Date(article.date), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
