import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Bell, Sun, Moon, ChevronDown,
  LogOut, Settings as SettingsIcon, User as UserIcon, Menu,
} from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import useUserStore from '../../store/userStore.js';
import { updateUserProfile } from '../../api/userApi.js';
import { setTheme, useTheme, adoptAccountTheme } from '../../utils/theme.js';

const initialsOf = (name = '') =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'U';

export default function Topbar({ onMobileMenu }) {
  const navigate = useNavigate();
  const { user, role, clearUser } = useAuthStore();
  const profile = useUserStore((s) => s.profile);

  const queryClient = useQueryClient();
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close avatar dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Cmd+K / Ctrl+K focuses global search
  const searchRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A new device starts from the theme saved on the account; after that the
  // device remembers its own choice and nothing switches it automatically.
  useEffect(() => { adoptAccountTheme(user?.theme_preference); }, [user?.theme_preference]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    // Also save to the account so other devices start with it (best effort)
    updateUserProfile({ themePreference: next })
      .then(() => queryClient.invalidateQueries({ queryKey: ['user-profile'] }))
      .catch(() => {});
  };

  const handleLogout = () => {
    clearUser();
    navigate('/login', { replace: true });
  };

  const displayName = user?.name || 'User';
  const planLabel   = profile?.plan || user?.plan || 'Free';

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-30 h-16 shrink-0 flex items-center gap-3 px-4 md:px-6
                 bg-bg-primary/80 backdrop-blur-xl border-b border-fg/8"
    >
      {/* Mobile hamburger */}
      <button
        onClick={onMobileMenu}
        data-testid="topbar-mobile-menu-btn"
        className="md:hidden p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-fg/5 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Global search */}
      <div className="relative flex-1 max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          ref={searchRef}
          type="text"
          data-testid="global-search-input"
          placeholder="Search jobs, companies, skills, contacts…"
          className="w-full bg-fg/5 border border-fg/10 rounded-xl pl-10 pr-16 py-2.5
                     text-text-primary placeholder-text-muted text-sm
                     focus:outline-none focus:border-brand-cyan/50 transition-colors"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5
                        text-[10px] text-text-muted bg-fg/5 border border-fg/10 rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          data-testid="topbar-theme-toggle"
          className="p-2.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-fg/5 transition-colors"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark'
            ? <Sun  className="w-[18px] h-[18px]" />
            : <Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* Notification bell */}
        <button
          data-testid="topbar-bell"
          className="relative p-2.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-fg/5 transition-colors"
          title="Notifications"
        >
          <Bell className="w-[18px] h-[18px]" />
          {/* Unread dot wired to alertStore in Phase 11 */}
        </button>

        {/* Avatar dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            data-testid="topbar-avatar-btn"
            className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-xl hover:bg-fg/5 transition-colors"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={displayName}
                   className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-brand-cyan/15 flex items-center justify-center">
                <span className="text-brand-cyan text-xs font-bold">{initialsOf(displayName)}</span>
              </div>
            )}
            <div className="hidden md:flex flex-col items-start leading-tight">
              <span className="text-text-primary text-xs font-semibold whitespace-nowrap">{displayName}</span>
              <span className="text-text-muted text-[10px] capitalize">{planLabel} Plan</span>
            </div>
            <ChevronDown className="w-4 h-4 text-text-muted hidden md:block" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-52 rounded-xl bg-bg-secondary border border-fg/10
                           shadow-xl shadow-black/40 overflow-hidden py-1.5"
              >
                <div className="px-3 py-2 border-b border-fg/8">
                  <p className="text-text-primary text-sm font-semibold truncate">{displayName}</p>
                  <p className="text-text-muted text-xs truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                  data-testid="avatar-menu-profile"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-fg/5 transition-colors"
                >
                  <UserIcon className="w-4 h-4" /> Profile
                </button>
                <button
                  onClick={() => { setMenuOpen(false); navigate('/settings'); }}
                  data-testid="avatar-menu-settings"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-fg/5 transition-colors"
                >
                  <SettingsIcon className="w-4 h-4" /> Settings
                </button>
                <div className="border-t border-fg/8 my-1" />
                <button
                  onClick={handleLogout}
                  data-testid="avatar-menu-logout"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
