import { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, FileText, Send, Radar,
  MessageSquareText, Wallet, TrendingUp, GraduationCap,
  Users, KanbanSquare, Settings as SettingsIcon,
} from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import MobileBottomNav from './MobileBottomNav.jsx';

const Spinner = () => (
  <div className="min-h-screen bg-bg-primary flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-brand-cyan border-t-transparent animate-spin" />
  </div>
);

// Drawer nav links for mobile (mirrors the user sidebar)
const MOBILE_DRAWER_NAV = [
  { to: '/dashboard-home', label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/jobs',           label: 'Jobs',            icon: Briefcase },
  { to: '/cv',             label: 'CV Studio',       icon: FileText },
  { to: '/cover-letters',  label: 'Cover Letters',   icon: Send },
  { to: '/skill-radar',    label: 'Skill Radar',     icon: Radar },
  { to: '/interview-prep', label: 'Interview Prep',  icon: MessageSquareText },
  { to: '/salary',         label: 'Salary Insights', icon: Wallet },
  { to: '/market',         label: 'Market Trends',   icon: TrendingUp },
  { to: '/learning',       label: 'Learning Hub',    icon: GraduationCap },
  { to: '/contacts',       label: 'Contacts',        icon: Users },
  { to: '/tracker',        label: 'Tracker',         icon: KanbanSquare },
  { to: '/settings',       label: 'Settings',        icon: SettingsIcon },
];

export default function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [collapsed, setCollapsed]   = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-bg-primary">
      {/* Desktop sidebar */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      {/* Mobile drawer sidebar */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="md:hidden fixed inset-0 bg-black/50 z-50"
            />
            <motion.aside
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-64 z-50
                         bg-bg-secondary border-r border-white/8 flex flex-col"
              data-testid="mobile-drawer"
            >
              <div className="flex items-center justify-between h-16 px-4 border-b border-white/8">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-cyan/15 flex items-center justify-center">
                    <span className="font-black text-lg text-brand-cyan">C</span>
                  </div>
                  <span className="text-text-primary font-bold text-sm">CareerPilot</span>
                </div>
                <button onClick={() => setDrawerOpen(false)}
                        className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-1">
                {MOBILE_DRAWER_NAV.map(({ to, label, icon: Icon }) => {
                  const active = location.pathname === to ||
                                 (to !== '/dashboard-home' && location.pathname.startsWith(to));
                  return (
                    <NavLink key={to} to={to}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
                                  ${active ? 'bg-brand-cyan/15 text-brand-cyan'
                                           : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}>
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      <span>{label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMobileMenu={() => setDrawerOpen(true)} />
        {/* pb-20 leaves room for the mobile bottom nav */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
