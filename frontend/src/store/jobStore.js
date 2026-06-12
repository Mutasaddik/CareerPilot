import { create } from 'zustand';

const useJobStore = create((set, get) => ({
  // Job list
  jobs:          [],
  total:         0,
  offset:        0,
  hasMore:       true,
  isLoading:     false,
  isLoadingMore: false,

  // Filters
  search:        '',
  minScore:      70,
  viewMode:      'card', // 'card' | 'list'

  // Drawer
  drawerJobId:   null,
  drawerJob:     null,
  drawerOpen:    false,

  // Saved jobs
  savedIds:      new Set(),

  // Stats
  stats:         null,

  // Error
  error:         null,

  // ── Setters ──────────────────────────────────────────────────────
  setJobs: (jobs, total) => set({ jobs, total, offset: jobs.length, hasMore: jobs.length < total }),

  appendJobs: (newJobs, total) => set((s) => {
    const seen   = new Set(s.jobs.map((j) => j.id));
    const unique = newJobs.filter((j) => !seen.has(j.id));
    const merged = [...s.jobs, ...unique];
    return { jobs: merged, total, offset: merged.length, hasMore: merged.length < total, isLoadingMore: false };
  }),

  setSearch:    (search)   => set({ search, jobs: [], offset: 0, hasMore: true }),
  setMinScore:  (minScore) => set({ minScore, jobs: [], offset: 0, hasMore: true }),
  setViewMode:  (viewMode) => set({ viewMode }),
  setIsLoading: (v)        => set({ isLoading: v }),
  setIsLoadingMore: (v)    => set({ isLoadingMore: v }),
  setStats:     (stats)    => set({ stats }),
  setError:     (error)    => set({ error }),

  // Drawer
  openDrawer: (job) => set({ drawerOpen: true, drawerJobId: job.id, drawerJob: job }),
  closeDrawer: ()  => set({ drawerOpen: false, drawerJobId: null }),
  updateDrawerJob: (updates) => set((s) => ({
    drawerJob: s.drawerJob ? { ...s.drawerJob, ...updates } : null,
  })),

  // Saved
  toggleSaved: (jobId) => set((s) => {
    const saved = new Set(s.savedIds);
    saved.has(jobId) ? saved.delete(jobId) : saved.add(jobId);
    return { savedIds: saved };
  }),

  // Update a single job in the list (after feedback/save)
  updateJob: (jobId, updates) => set((s) => ({
    jobs: s.jobs.map((j) => j.id === jobId ? { ...j, ...updates } : j),
    drawerJob: s.drawerJob?.id === jobId ? { ...s.drawerJob, ...updates } : s.drawerJob,
  })),

  reset: () => set({
    jobs: [], total: 0, offset: 0, hasMore: true,
    isLoading: false, isLoadingMore: false,
    search: '', minScore: 0,
    drawerJobId: null, drawerJob: null, drawerOpen: false,
    savedIds: new Set(), stats: null, error: null,
  }),
}));

export default useJobStore;
