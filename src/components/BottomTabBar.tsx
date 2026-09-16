import { NavLink, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/apps', label: 'My apps', icon: 'apps' },
  { to: '/timer', label: 'Timer', icon: 'timer' },
] as const;

function TabIcon({ name }: { name: (typeof TABS)[number]['icon'] }) {
  if (name === 'apps') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg>;
  }
  if (name === 'timer') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7" /><path d="M9 3h6M12 6v2M12 13l3-2" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6c5.8 0 8.9 3.2 8.9 8.5 0 5.1-3.4 8.3-8.9 8.3s-8.9-3.2-8.9-8.3c0-5.3 3.1-8.5 8.9-8.5Z" /></svg>;
}

function isTabActive(pathname: string, target: string) {
  if (target === '/apps') return pathname.startsWith('/apps') || pathname.startsWith('/rules');
  if (target === '/home') return pathname === '/home';
  return pathname === target;
}

export function BottomTabBar() {
  const { pathname } = useLocation();
  if (['/settings', '/profile', '/score', '/gems'].includes(pathname)) return null;

  return (
    <nav className="tabbar" aria-label="Main navigation">
      {TABS.map((tab) => {
        const active = isTabActive(pathname, tab.to);
        return (
          <NavLink key={tab.to} to={tab.to} className={`tabbar__item ${active ? 'is-active' : ''}`}>
            <span className="tabbar__icon"><TabIcon name={tab.icon} /></span>
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
