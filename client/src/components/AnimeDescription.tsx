import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  fetchItalianDescription,
  isTranslatableDescription,
  TRANSLATION_CACHE_TTL_MS,
} from '../services/translation';

type DescriptionLang = 'en' | 'it';

interface AnimeDescriptionProps {
  anilistId: number;
  descriptionEn: string;
}

function LangToggle({
  lang,
  onChange,
}: {
  lang: DescriptionLang;
  onChange: (lang: DescriptionLang) => void;
}) {
  const btnClass = (active: boolean) =>
    `rounded px-2 py-0.5 text-xs font-medium transition ${
      active ? 'bg-accent/20 text-accent-light' : 'text-gray-500 hover:text-gray-300'
    }`;

  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-surface-card p-0.5">
      <button type="button" className={btnClass(lang === 'en')} onClick={() => onChange('en')}>
        EN
      </button>
      <button type="button" className={btnClass(lang === 'it')} onClick={() => onChange('it')}>
        IT
      </button>
    </div>
  );
}

export function AnimeDescription({ anilistId, descriptionEn }: AnimeDescriptionProps) {
  const [lang, setLang] = useState<DescriptionLang>('en');
  const canTranslate = isTranslatableDescription(descriptionEn);

  const translationQuery = useQuery({
    queryKey: ['description-it', anilistId, descriptionEn],
    queryFn: () => fetchItalianDescription(anilistId, descriptionEn),
    enabled: lang === 'it' && canTranslate,
    staleTime: TRANSLATION_CACHE_TTL_MS,
    gcTime: TRANSLATION_CACHE_TTL_MS,
    retry: 1,
  });

  const showItalian = lang === 'it' && canTranslate;
  const isLoading = showItalian && translationQuery.isLoading;
  const translationError = showItalian && translationQuery.isError;

  let body = descriptionEn;
  if (showItalian && translationQuery.data) {
    body = translationQuery.data;
  }

  return (
    <div className="space-y-2">
      {canTranslate && <LangToggle lang={lang} onChange={setLang} />}
      {isLoading ? (
        <p className="animate-pulse text-sm text-gray-500">Traduzione in corso...</p>
      ) : (
        <p className="text-sm leading-relaxed text-gray-400">{body}</p>
      )}
      {translationError && (
        <p className="text-xs text-amber-400/90">
          Traduzione non disponibile.{' '}
          <button
            type="button"
            className="underline hover:text-amber-300"
            onClick={() => void translationQuery.refetch()}
          >
            Riprova
          </button>
          {' oppure '}
          <button type="button" className="underline hover:text-amber-300" onClick={() => setLang('en')}>
            mostra originale
          </button>
          .
        </p>
      )}
    </div>
  );
}
