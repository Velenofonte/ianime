import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { collectUpcomingSeasons, fetchAnimeByIds, matchesAiringDay } from '../services/anilist';
import { WEEK_DAYS } from '../types/anime';

const ITALIAN_DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'] as const;

function calendarTitle(anime: { franchiseTitle: string; title: string; seasonNumber: number | null }) {
  if (anime.seasonNumber !== null) {
    return `${anime.franchiseTitle} — S${anime.seasonNumber}`;
  }
  if (anime.title !== anime.franchiseTitle) {
    return anime.franchiseTitle;
  }
  return anime.title;
}

export function CalendarPage() {
  const { data: ids = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => (await api.getFavorites()).anilist_ids,
  });

  const { data: anime = [], isLoading } = useQuery({
    queryKey: ['calendar-anime', ids],
    queryFn: () => fetchAnimeByIds(ids, { expandFranchise: true }),
    enabled: ids.length > 0,
  });

  const upcoming = useMemo(() => collectUpcomingSeasons(anime), [anime]);

  const airing = anime.filter((a) => a.status === 'RELEASING' && a.airingDay);

  const byDay = WEEK_DAYS.reduce<Record<string, typeof airing>>((acc, day) => {
    acc[day] = airing.filter((a) => matchesAiringDay(a, day));
    return acc;
  }, {});

  const today = ITALIAN_DAYS[new Date().getDay()];

  if (!ids.length) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-gray-400">Aggiungi anime in corso ai preferiti per vedere il calendario.</p>
        <Link to="/" className="text-accent-light hover:underline">
          Esplora anime →
        </Link>
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
          <div
            key={day}
            className={`rounded-xl border bg-surface-card p-4 ${
              day === today ? 'border-yellow-400' : 'border-white/10'
            }`}
          >
            <h2 className="mb-3 font-semibold text-accent-light">{day}</h2>
            {byDay[day]?.length ? (
              <ul className="space-y-3">
                {byDay[day].map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/anime/${a.canonicalSeasonId}`}
                      className="flex gap-3 rounded-lg p-1 transition hover:bg-surface-hover"
                    >
                      {a.coverImage && (
                        <img src={a.coverImage} alt="" className="h-14 w-10 rounded object-cover" />
                      )}
                      <div>
                        <p className="text-sm font-medium leading-tight">{calendarTitle(a)}</p>
                        {a.airingTime && <p className="text-xs text-gray-400">{a.airingTime}</p>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Nessuna uscita</p>
            )}
          </div>
        ))}
      </div>

      <hr className="my-10 border-white/10" />

      <section>
        <h2 className="mb-1 text-lg font-semibold">In arrivo nei preferiti</h2>
        <p className="mb-4 text-sm text-gray-400">Stagioni future ordinate per data di uscita</p>

        {upcoming.length ? (
          <ul className="space-y-3">
            {upcoming.map((entry) => (
              <li key={entry.seasonId}>
                <Link
                  to={`/anime/${entry.seasonId}`}
                  className="flex gap-4 rounded-xl border border-white/10 bg-surface-card p-3 transition hover:border-accent/30 hover:bg-surface-hover"
                >
                  {entry.coverImage && (
                    <img src={entry.coverImage} alt="" className="h-20 w-14 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{entry.franchiseTitle}</p>
                    <p className="text-sm text-accent-light">{entry.seasonLabel}</p>
                    <p className="mt-1 text-sm text-gray-400">
                      {entry.releaseLabel ?? 'Data da annunciare'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-white/5 bg-surface-card px-4 py-3 text-sm text-gray-500">
            Nessuna stagione in arrivo tra i preferiti
          </p>
        )}
      </section>
    </div>
  );
}
