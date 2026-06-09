import { create } from 'zustand';

const useAuthStore = create((set, get) => ({
  // ── State ─────────────────────────────────────────────────────
  user:          null,
  isAuthenticated: false,
  isLoading:     true,
  role:          null,

  // ── Actions ───────────────────────────────────────────────────
  setUser: (user) => set({
    user,
    isAuthenticated: !!user,
    isLoading: false,
    role: user?.role || null,
  }),

  clearUser: () => set({
    user:            null,
    isAuthenticated: false,
    isLoading:       false,
    role:            null,
  }),

  setLoading: (isLoading) => set({ isLoading }),

  updateUser: (fields) => set((state) => ({
    user: state.user ? { ...state.user, ...fields } : null,
  })),

  // ── Helpers ───────────────────────────────────────────────────
  isAdmin:      () => ['admin', 'superadmin'].includes(get().role),
  isSuperAdmin: () => get().role === 'superadmin',
  isModerator:  () => ['moderator', 'admin', 'superadmin'].includes(get().role),
  isPro:        () => get().user?.plan === 'pro',

  getRedirectPath: () => {
    const role = get().role;
    const map = {
      superadmin: '/superadmin/dashboard',
      admin:      '/admin/dashboard',
      moderator:  '/moderator/dashboard',
      user:       '/dashboard',
    };
    return map[role] || '/dashboard';
  },
}));

export default useAuthStore;
