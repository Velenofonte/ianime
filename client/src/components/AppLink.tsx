import { useEffect, type MouseEvent, type ReactNode } from 'react';
import { openInNativeApp, prefetchPrimeGti, streamingAppTarget } from '../services/appLinks';

export function AppLink({
  href,
  site,
  title,
  className,
  children,
}: {
  href: string;
  site?: string;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const target = streamingAppTarget(href, site);
  const opensApp = !!target;

  useEffect(() => {
    if (target === 'prime') void prefetchPrimeGti(href, title);
  }, [target, href, title]);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!opensApp) return;
    event.preventDefault();
    openInNativeApp(href, site, title);
  };

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
      {children}
    </a>
  );
}
