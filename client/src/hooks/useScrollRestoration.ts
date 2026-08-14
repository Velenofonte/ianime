import { useLayoutEffect } from 'react';
import { useNavigationType } from 'react-router-dom';

const PREFIX = 'ianime-scroll:';

export function useScrollRestoration(routeKey: string) {
  const navType = useNavigationType();

  useLayoutEffect(() => {
    if (navType === 'POP') {
      const raw = sessionStorage.getItem(`${PREFIX}${routeKey}`);
      const y = raw ? Number(raw) : 0;
      if (Number.isFinite(y) && y > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y });
        });
      }
    } else {
      window.scrollTo({ top: 0 });
    }

    return () => {
      sessionStorage.setItem(`${PREFIX}${routeKey}`, String(window.scrollY));
    };
  }, [routeKey, navType]);
}
