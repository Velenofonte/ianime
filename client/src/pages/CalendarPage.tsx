import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { fetchAnimeByIds } from '../services/anilist';
import { DAY_MAP } from '../types/anime';

const WEEK_DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export function CalendarPage() {
  const { data: ids = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => (await api.getFavorites()).anilist_ids,
  });

  const { data: anime = [], isLoading } = useQuery({
    queryKey: ['calendar-anime', ids],
    queryFn: () => fetchAnimeByIds(ids),
    enabled: ids.length > 0,
  });

  const airing = anime.filter((a) => a.status === 'RELEASING' && a.airingDay);

  const byDay = WEEK_DAYS.reduce<Record<string, typeof airing>>((acc, day) => {
    acc[day] = airing.filter((a) => {
      const normalized = Object.entries(DAY_MAP).find(([, v]) => v === day)?.[0];
      return a.airingDay === day || a.airingDay === normalized;
    });
    return acc;
  }, {});

  if (!ids.length) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-gray-400">Aggiungi anime in corso ai preferiti per vedere il calendario.</p>
        <Link to="/" className="text-accent-light hover:underline">Esplora anime →</Link>
      </div>
    );
  }

  if (isLoading) return <div className="py-20 text-center text-gray-400">Caricamento calendario...</div>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Calendario uscite</h1>
      <p className="mb-6 text-sm text-gray-400">Anime in corso nei preferiti, raggruppati per giorno di uscita.</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="rounded-xl border border-white/10 bg-surface-card p-4">
            <h2 className="mb-3 font-semibold text-accent-light">{day}</h2>
            {byDay[day]?.length ? (
              <ul className="space-y-3">
                {byDay[day].map((a) => (
                  <li key={a.id} className="flex gap-3">
                    {a.coverImage && (
                      <img src={a.coverImage} alt="" className="h-14 w-10 rounded object-cover" />
                    )}
                    <div>
                      <p className="text-sm font-medium leading-tight">{a.title}</p>
                      {a.airingTime && <p className="text-xs text-gray-400">{a.airingTime}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Nessuna uscita</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
