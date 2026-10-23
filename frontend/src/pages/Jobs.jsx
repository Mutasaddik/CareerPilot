import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, SlidersHorizontal, LayoutGrid, List,
  RefreshCw, Loader2, Briefcase, TrendingUp, Star, Sparkles,
} from 'lucide-react';
import { fetchJobs, fetchJobStats, regenerateJobs, fetchRegenStatus } from '../api/jobApi.js';
import useJobStore from '../store/jobStore.js';
import JobCard from '../components/jobs/JobCard.jsx';
import JobDetailDrawer from '../components/jobs/JobDetailDrawer.jsx';

// ── Skeleton loader ───────────────────────────────────────────────
const JobCardSkeleton = () => (
  <div className="glass-card p-4 animate-pulse space-y-3">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-fg/8 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-fg/8 rounded w-3/4" />
        <div className="h-2.5 bg-fg/5 rounded w-1/2" />
      </div>
    </div>
    <div className="h-6 bg-fg/5 rounded-full w-32" />
    <div className="h-px bg-fg/8" />
    <div className="flex justify-between">
      <div className="h-2.5 bg-fg/5 rounded w-24" />
      <div className="h-2.5 bg-fg/5 rounded w-16" />
    </div>
  </div>
);

// ── Empty state ───────────────────────────────────────────────────
const EmptyState = ({ search, onClear, onRegen, regenLoading }) => (
  <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center mb-4">
      <Briefcase className="w-8 h-8 text-brand-cyan" />
    </div>
    <h3 className="text-text-primary font-bold text-lg mb-2">
      {search ? `No jobs matching "${search}"` : 'No jobs found'}
    </h3>
    <p className="text-text-secondary text-sm max-w-xs mb-4">
      {search
        ? 'Try a different search term or lower the match filter.'
        : 'Try regenerating to fetch fresh jobs tailored to your profile.'}
    </p>
    <div className="flex gap-3">
      {search && (
        <button onClick={onClear} className="btn-secondary px-4 py-2 text-sm">
          Clear Search
        </button>
      )}
      {!search && (
        <button
          onClick={onRegen}
          disabled={regenLoading}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
        >
          {regenLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Sparkles className="w-4 h-4" />}
          {regenLoading ? 'Fetching jobs…' : 'Find My Jobs'}
        </button>
      )}
    </div>
  </div>
);

// ── Stats bar ─────────────────────────────────────────────────────
// Counts that help browsing; the three score tiles double as filters
// (same thresholds as the match dropdown: 90 / 70 / 50).
const StatsBar = ({ stats, minScore, onFilter }) => {
  if (!stats) return null;
  const n = (v) => parseInt(v) || 0;
  const tiles = [
    { label: 'Strong matches (70%+)',  value: n(stats.strong_matches), icon: Briefcase,  color: 'text-brand-cyan', filter: 70 },
    { label: 'Excellent (90%+)',       value: n(stats.excellent),      icon: Star,       color: 'text-green-400',  filter: 90 },
    { label: 'Worth a look (50–69%)',  value: n(stats.good),           icon: TrendingUp, color: 'text-amber-400',  filter: 50 },
    { label: 'New this week',          value: n(stats.new_this_week),  icon: Sparkles,   color: 'text-purple-400' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {tiles.map(({ label, value, icon: Icon, color, filter }) => {
        const active = filter !== undefined && filter === minScore;
        const content = (
          <>
            <Icon className={`w-5 h-5 ${color} shrink-0`} />
            <div>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-text-muted text-xs">{label}</p>
            </div>
          </>
        );
        return filter === undefined ? (
          <div key={label} className="glass-card p-3 flex items-center gap-3">{content}</div>
        ) : (
          <button key={label} onClick={() => onFilter(filter)} aria-pressed={active}
            title={active ? 'Showing these jobs' : filter === 50 ? 'Show every job scoring 50% or more' : `Show jobs scoring ${filter}% or more`}
            className={`glass-card card-interactive p-3 flex items-center gap-3 text-left
              ${active ? 'border-brand-cyan/50 ring-1 ring-brand-cyan/30' : ''}`}>
            {content}
          </button>
        );
      })}
    </div>
  );
};

// ── Regenerate button with rate limit display ─────────────────────
const RegenerateButton = ({ onRegen, regenLoading, regenStatus }) => {
  const remaining = regenStatus?.remaining ?? null;
  const limit     = regenStatus?.limit ?? null;
  const used      = regenStatus?.used ?? 0;
  const exhausted = remaining !== null && remaining <= 0;

  return (
    <div className="relative group shrink-0">
      <button
        onClick={onRegen}
        disabled={regenLoading || exhausted}
        data-testid="regenerate-jobs-btn"
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all
          ${exhausted
            ? 'bg-fg/3 border-fg/8 text-text-muted cursor-not-allowed'
            : regenLoading
              ? 'bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan cursor-wait'
              : 'bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/20 hover:border-brand-cyan/50'
          }`}
      >
        {regenLoading
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Sparkles className="w-4 h-4" />}
        {regenLoading ? 'Refreshing…' : 'Regenerate'}
        {remaining !== null && !exhausted && (
          <span className="ml-1 px-1.5 py-0.5 rounded-md bg-fg/10 text-xs text-text-muted">
            {remaining}/{limit}
          </span>
        )}
      </button>

      {/* Tooltip on exhausted */}
      {exhausted && (
        <div className="absolute top-full mt-2 right-0 w-52 glass-card p-2.5 text-xs text-text-secondary z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Daily limit reached ({used}/{limit}). Resets at midnight.
        </div>
      )}
    </div>
  );
};

// ── Main Jobs page ────────────────────────────────────────────────
export default function Jobs() {
  const {
    jobs, total, offset, hasMore,
    isLoading, isLoadingMore,
    search, minScore, viewMode,
    drawerOpen, drawerJob,
    setJobs, appendJobs, setSearch, setMinScore,
    setViewMode, setIsLoading, setIsLoadingMore,
    openDrawer, closeDrawer, setStats,
  } = useJobStore();

  const observerRef    = useRef(null);
  const searchTimeout  = useRef(null);
  const queryClient    = useQueryClient();
  const [regenToast, setRegenToast] = useState(null);

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['job-stats'],
    queryFn:  fetchJobStats,
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => { if (statsData?.stats) setStats(statsData.stats); }, [statsData]);

  // Fetch regeneration status (remaining uses today)
  const { data: regenStatus, refetch: refetchRegenStatus } = useQuery({
    queryKey: ['regen-status'],
    queryFn:  fetchRegenStatus,
    staleTime: 60 * 1000,
  });

  // Initial / filter-change fetch
  const { data, isLoading: queryLoading, refetch } = useQuery({
    queryKey: ['jobs', search, minScore],
    queryFn:  () => fetchJobs({ limit: 20, offset: 0, minScore, search }),
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => { if (data?.jobs) setJobs(data.jobs, data.total || 0); }, [data]);
  useEffect(() => { setIsLoading(queryLoading); }, [queryLoading]);

  // Regenerate mutation
  const regenMutation = useMutation({
    mutationFn: regenerateJobs,
    onSuccess: (data) => {
      setRegenToast({
        type: 'success',
        message: data.message || 'Jobs refreshed! New matches appearing shortly.',
        remaining: data.remaining,
        limit: data.limit,
      });
      // The refresh searches job sites in the background (can take a minute
      // or two), so check back a few times as new matches land.
      [5000, 30000, 90000].forEach((delay) => setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        queryClient.invalidateQueries({ queryKey: ['job-stats'] });
        refetchRegenStatus();
        refetch();
      }, delay));
      setTimeout(() => setRegenToast(null), 6000);
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || 'Regeneration failed. Try again.';
      setRegenToast({ type: 'error', message: msg });
      setTimeout(() => setRegenToast(null), 5000);
    },
  });

  const handleRegen = () => {
    if (regenMutation.isPending) return;
    regenMutation.mutate();
  };

  // Infinite scroll — load more
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const d = await fetchJobs({ limit: 20, offset, minScore, search });
      appendJobs(d.jobs || [], d.total || 0);
    } catch { setIsLoadingMore(false); }
  }, [hasMore, isLoadingMore, offset, minScore, search]);

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore(); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  // Debounced search
  const handleSearch = (val) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(val), 350);
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Regen toast */}
      <AnimatePresence>
        {regenToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl border text-sm font-medium shadow-2xl backdrop-blur-xl
              ${regenToast.type === 'success'
                ? 'bg-green-500/20 border-green-500/30 text-green-300'
                : 'bg-red-500/20 border-red-500/30 text-red-300'}`}
          >
            {regenToast.message}
            {regenToast.remaining !== undefined && (
              <span className="ml-2 text-text-muted text-xs">
                ({regenToast.remaining} regenerations left today)
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Topbar */}
      <div className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-xl border-b border-fg/8 px-6 py-4">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search jobs, companies, skills…"
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-fg/5 border border-fg/10 rounded-xl pl-10 pr-4 py-2.5 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-brand-cyan/50 transition-colors"
            />
          </div>

          {/* Min score filter — default 50%, "All Matches" = 50%+ */}
          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-text-muted" />
            <select
              value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              className="bg-fg/5 border border-fg/10 rounded-xl px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-brand-cyan/50"
            >
              <option value={50}>All Matches</option>
              <option value={70}>70%+ Match</option>
              <option value={90}>90%+ Match</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-fg/5 border border-fg/10 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'card' ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-text-muted hover:text-text-primary'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-text-muted hover:text-text-primary'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Refresh cached results */}
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl bg-fg/5 border border-fg/10 text-text-muted hover:text-brand-cyan transition-colors shrink-0"
            title="Refresh current results"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Regenerate — triggers new scrape */}
          <RegenerateButton
            onRegen={handleRegen}
            regenLoading={regenMutation.isPending}
            regenStatus={regenStatus}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <StatsBar stats={statsData?.stats} minScore={minScore} onFilter={setMinScore} />

        {!isLoading && jobs.length > 0 && (
          <p className="text-text-muted text-sm mb-4">
            Showing <span className="text-text-primary font-medium">{jobs.length}</span> of{' '}
            <span className="text-text-primary font-medium">{total}</span> matched jobs
          </p>
        )}

        <motion.div layout className={`grid gap-4 ${viewMode === "card" ? "job-grid" : "grid-cols-1"}`}>
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)
            : jobs.length === 0
              ? <EmptyState
                  search={search}
                  onClear={() => setSearch('')}
                  onRegen={handleRegen}
                  regenLoading={regenMutation.isPending}
                />
              : jobs.map((job) => (
                  <JobCard key={job.id} job={job} onClick={() => openDrawer(job)} />
                ))
          }
        </motion.div>

        {/* Infinite scroll sentinel */}
        <div ref={observerRef} className="h-10 flex items-center justify-center mt-4">
          {isLoadingMore && <Loader2 className="w-5 h-5 text-brand-cyan animate-spin" />}
          {!hasMore && jobs.length > 0 && (
            <p className="text-text-muted text-sm">All {total} jobs loaded</p>
          )}
        </div>
      </div>

      {/* Drawer overlay */}
      <AnimatePresence>
        {drawerOpen && drawerJob && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 bg-black/40 z-30"
            />
            <JobDetailDrawer job={drawerJob} onClose={closeDrawer} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
