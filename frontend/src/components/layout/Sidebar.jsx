import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Briefcase, FileText, KanbanSquare, Award, Settings as SettingsIcon, Shield, ShieldAlert, ShieldCheck, ChevronLeft,
} from 'lucide-react';
import useAuthStore from '../../store/authStore.js';

// ── Nav definitions per role ──────────────────────────────────────
// Each link: { to, label, icon }. Order matches the product spec.
const USER_NAV = [
  { to: '/dashboard-home', label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/jobs',           label: 'Jobs',            icon: Briefcase },
  { to: '/cv',             label: 'CV Studio',       icon: FileText },
  // Not built yet — add back when the page exists (each was a 404):
  // Cover Letters /cover-letters, Skill Radar /skill-radar, Interview Prep /interview-prep,
  // Salary Insights /salary, Market Trends /market, Learning Hub /learning, Contacts /contacts
  { to: '/tracker',        label: 'Tracker',         icon: KanbanSquare },
  { to: '/certifications', label: 'Certifications', icon: Award },
  { to: '/settings',       label: 'Settings',        icon: SettingsIcon },
];

const SUPERADMIN_NAV = [
  { to: '/superadmin/dashboard', label: 'Platform Overview', icon: ShieldAlert },
  { to: '/settings',             label: 'Settings',          icon: SettingsIcon },
];

const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Admin Dashboard', icon: Shield },
  { to: '/settings',        label: 'Settings',        icon: SettingsIcon },
];

const MODERATOR_NAV = [
  { to: '/moderator/dashboard', label: 'Moderation', icon: ShieldCheck },
  { to: '/settings',            label: 'Settings',   icon: SettingsIcon },
];

// Accent color per role — matches the spec's role color system.
const ROLE_ACCENT = {
  superadmin: { ring: 'ring-red-500/40',    glow: 'shadow-red-500/20',    text: 'text-red-400',    bg: 'bg-red-500/15',    badge: 'SuperAdmin' },
  admin:      { ring: 'ring-orange-500/40', glow: 'shadow-orange-500/20', text: 'text-orange-400', bg: 'bg-orange-500/15', badge: 'Admin' },
  moderator:  { ring: 'ring-purple-500/40', glow: 'shadow-purple-500/20', text: 'text-purple-400', bg: 'bg-purple-500/15', badge: 'Moderator' },
  user:       { ring: 'ring-brand-cyan/40', glow: 'shadow-brand-cyan/20', text: 'text-brand-cyan', bg: 'bg-brand-cyan/15', badge: null },
};

const navForRole = (role) => {
  switch (role) {
    case 'superadmin': return SUPERADMIN_NAV;
    case 'admin':      return ADMIN_NAV;
    case 'moderator':  return MODERATOR_NAV;
    default:           return USER_NAV;
  }
};

export default function Sidebar({ collapsed = false, onToggle }) {
  const { role } = useAuthStore();
  const location = useLocation();
  const links  = useMemo(() => navForRole(role), [role]);
  const accent = ROLE_ACCENT[role] || ROLE_ACCENT.user;

  return (
    <aside
      data-testid="sidebar"
      className={`hidden md:flex flex-col shrink-0 h-screen sticky top-0 z-40
                  bg-bg-secondary/60 backdrop-blur-xl border-r border-fg/8
                  transition-[width] duration-300 ease-out
                  ${collapsed ? 'w-[72px]' : 'w-64'}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 h-16 px-4 border-b border-fg/8 shrink-0">
        <div className={`w-9 h-9 rounded-xl ${accent.bg} flex items-center justify-center shrink-0`}>
          <span className={`font-black text-lg ${accent.text}`}>C</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight overflow-hidden">
            <span className="text-text-primary font-bold text-sm whitespace-nowrap">CareerPilot</span>
            {accent.badge && (
              <span className={`text-[10px] font-semibold ${accent.text} whitespace-nowrap`}>
                {accent.badge} Mode
              </span>
            )}
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-1 scrollbar-thin">
        {links.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to ||
                         (to !== '/dashboard-home' && location.pathname.startsWith(to));
          return (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}-link`}
              title={collapsed ? label : undefined}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                          transition-colors group
                          ${active
                            ? `${accent.bg} ${accent.text}`
                            : 'text-text-secondary hover:text-text-primary hover:bg-fg/5'}`}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full ${accent.text.replace('text-', 'bg-')}`}
                />
              )}
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2.5 border-t border-fg/8 shrink-0">
        <button
          onClick={onToggle}
          data-testid="sidebar-collapse-btn"
          className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2
                     text-text-muted hover:text-text-primary hover:bg-fg/5 transition-colors text-sm"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
