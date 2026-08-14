import type { MouseEvent, ReactNode } from 'react';
import { openInNativeApp, streamingAppTarget } from '../services/appLinks';

export function AppLink({
  href,
  site,
  className,
  children,
}: {
  href: string;
  site?: string;
  className?: string;
  children: ReactNode;
}) {
  const opensApp = !!streamingAppTarget(href, site);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!opensApp) return;
    event.preventDefault();
    openInNativeApp(href, site);
  };

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
      {children}
    </a>
  );
}
