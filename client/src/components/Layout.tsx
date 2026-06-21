import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../hooks/useFavorites';
import { APP_VERSION } from '../version';
import { IconCalendar, IconHeart, IconHome, IconNews, IconSparkle } from './NavIcons';
import { OfflineBanner } from './OfflineBanner';
import { InstallPrompt } from './InstallPrompt';

const NAV_ITEMS: { to: string; end?: boolean; label: string; Icon: typeof IconHome }[] = [
  { to: '/', end: true, label: 'Home', Icon: IconHome },
  { to: '/preferiti', label: 'Preferiti', Icon: IconHeart },
  { to: '/suggerimenti', label: 'Suggerimenti', Icon: IconSparkle },
  { to: '/calendario', label: 'Calendario', Icon: IconCalendar },
  { to: '/news', label: 'News', Icon: IconNews },
];

const desktopNavClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive ? 'bg-accent/20 text-accent-light' : 'text-gray-400 hover:text-white hover:bg-surface-hover'
  }`;

const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
    isActive ? 'text-accent-light' : 'text-gray-400'
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  useFavorites();

  return (
    <div className="min-h-screen bg-surface pb-16 md:pb-0">
      <OfflineBanner />
      <InstallPrompt />
      <header className="sticky top-0 z-40 h-14 border-b border-white/10 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <img src="/icons/icon.png" alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain shadow-md shadow-accent/20" />
            <span className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold tracking-tight text-accent-light">iAnime</span>
              <span className="text-[10px] font-medium tabular-nums text-gray-500">{APP_VERSION}</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map(({ to, end, label, Icon }) => (
              <NavLink key={to} to={to} end={end} className={desktopNavClass}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            {user ? (
              <>
                <Link
                  to="/account"
                  className="rounded-lg px-2 py-1.5 text-gray-400 transition hover:bg-surface-hover hover:text-white"
                >
                  {user.username}
                </Link>
                <button onClick={logout} className="rounded-lg bg-surface-hover px-3 py-1.5 hover:bg-white/10">
                  Esci
                </button>
              </>
            ) : (
              <Link to="/login" className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent/80">
                Accedi
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Navigazione principale"
      >
        <div className="mx-auto flex max-w-lg">
          {NAV_ITEMS.map(({ to, end, label, Icon }) => (
            <NavLink key={to} to={to} end={end} className={mobileNavClass}>
              {({ isActive }) => (
                <>
                  <Icon className={`h-6 w-6 ${isActive ? 'text-accent-light' : 'text-gray-400'}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
