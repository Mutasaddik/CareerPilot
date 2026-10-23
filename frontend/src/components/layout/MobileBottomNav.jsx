import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, KanbanSquare, Bell, User,
} from 'lucide-react';

// Five primary tabs per the spec's mobile navigation.
const TABS = [
  { to: '/dashboard-home', label: 'Home',    icon: LayoutDashboard },
  { to: '/jobs',           label: 'Jobs',    icon: Briefcase },
  { to: '/tracker',        label: 'Tracker', icon: KanbanSquare },
  { to: '/alerts',         label: 'Alerts',  icon: Bell },
  { to: '/settings',       label: 'Profile', icon: User },
];

export default function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16
                 bg-bg-secondary/90 backdrop-blur-xl border-t border-white/8
                 flex items-center justify-around px-2"
    >
      {TABS.map(({ to, label, icon: Icon }) => {
        const active = location.pathname === to ||
                       (to !== '/dashboard-home' && location.pathname.startsWith(to));
        return (
          <NavLink
            key={to}
            to={to}
            data-testid={`mobile-nav-${label.toLowerCase()}`}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors
                        ${active ? 'text-brand-cyan' : 'text-text-muted hover:text-text-primary'}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
