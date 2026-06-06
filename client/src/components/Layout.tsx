import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IconCalendar, IconHeart, IconHome, IconNews } from './NavIcons';
import { OfflineBanner } from './OfflineBanner';
import { InstallPrompt } from './InstallPrompt';

const NAV_ITEMS: { to: string; end?: boolean; label: string; Icon: typeof IconHome }[] = [
  { to: '/', end: true, label: 'Home', Icon: IconHome },
  { to: '/preferiti', label: 'Preferiti', Icon: IconHeart },
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

  return (
    <div className="min-h-screen bg-surface pb-16 md:pb-0">
      <OfflineBanner />
      <InstallPrompt />
      <header className="sticky top-0 z-40 h-14 border-b border-white/10 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/" className="text-lg font-bold text-accent-light">
            iAnime
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
                <span className="hidden text-gray-400 sm:inline">{user.username}</span>
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
