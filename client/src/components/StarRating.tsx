/** AniList score 0–100 → 0–5 stelle (100 = 5 stelle) */
export function scoreToStars(score: number): number {
  return Math.min(5, Math.max(0, score / 20));
}

/** Stelle 1–5 → soglia AniList 0–100 */
export function starsToAnilistScore(stars: number): number {
  return stars * 20;
}

type StarRatingProps = {
  score: number | null;
  showValue?: boolean;
  size?: 'sm' | 'md';
};

export function StarRating({ score, showValue = true, size = 'sm' }: StarRatingProps) {
  if (score == null || score <= 0) return null;

  const stars = scoreToStars(score);
  const full = Math.floor(stars);
  const half = stars - full >= 0.25 && stars - full < 0.75;
  const rounded = half ? full + 0.5 : Math.round(stars * 2) / 2;
  const iconClass = size === 'md' ? 'text-base' : 'text-sm';

  return (
    <div className="flex items-center gap-1.5" aria-label={`Valutazione ${stars.toFixed(1)} su 5`}>
      <span className={`flex text-amber-400 ${iconClass}`} aria-hidden>
        {Array.from({ length: 5 }, (_, i) => {
          const filled = i < Math.floor(rounded);
          const isHalf = !filled && i < rounded;
          return (
            <span key={i} className="relative inline-block w-[1em]">
              <span className="text-gray-600">★</span>
              {(filled || isHalf) && (
                <span
                  className="absolute left-0 top-0 overflow-hidden text-amber-400"
                  style={{ width: isHalf ? '50%' : '100%' }}
                >
                  ★
                </span>
              )}
            </span>
          );
        })}
      </span>
      {showValue && (
        <span className={`text-gray-400 ${size === 'md' ? 'text-sm' : 'text-xs'}`}>
          {stars.toFixed(1)}/5
        </span>
      )}
    </div>
  );
}
