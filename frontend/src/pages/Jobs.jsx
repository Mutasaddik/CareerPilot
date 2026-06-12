import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import {
  Search, SlidersHorizontal, LayoutGrid, List,
  RefreshCw, Loader2, Briefcase, TrendingUp, Star,
} from 'lucide-react';
import { fetchJobs, fetchJobStats } from '../api/jobApi.js';
import useJobStore from '../store/jobStore.js';
import JobCard from '../components/jobs/JobCard.jsx';
import JobDetailDrawer from '../components/jobs/JobDetailDrawer.jsx';

// ── Skeleton loader ───────────────────────────────────────────────
const JobCardSkeleton = () => (
  <div className="glass-card p-4 animate-pulse space-y-3">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-white/8 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-white/8 rounded w-3/4" />
        <div className="h-2.5 bg-white/5 rounded w-1/2" />
      </div>
    </div>
    <div className="h-6 bg-white/5 rounded-full w-32" />
    <div className="h-px bg-white/8" />
    <div className="flex justify-between">
      <div className="h-2.5 bg-white/5 rounded w-24" />
      <div className="h-2.5 bg-white/5 rounded w-16" />
    </div>
  </div>
);

// ── Empty state ───────────────────────────────────────────────────
const EmptyState = ({ search, onClear }) => (
  <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center mb-4">
      <Briefcase className="w-8 h-8 text-brand-cyan" />
    </div>
    <h3 className="text-text-primary font-bold text-lg mb-2">
      {search ? `No jobs matching "${search}"` : 'No jobs yet'}
    </h3>
    <p className="text-text-secondary text-sm max-w-xs mb-4">
      {search
        ? 'Try a different search term or lower the match filter.'
        : 'Jobs are being scraped from LinkedIn, Indeed, Bdjobs, and Rozee. Check back shortly.'}
    </p>
    {search && (
      <button onClick={onClear} className="btn-primary px-4 py-2 text-sm">
        Clear Search
      </button>
    )}
  </div>
);

// ── Stats bar ─────────────────────────────────────────────────────
const StatsBar = ({ stats }) => {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {[
        { label: 'Total Matched',  value: stats.total_matched || 0,  icon: Briefcase,   color: 'text-brand-cyan'  },
        { label: 'Excellent (90%+)', value: stats.excellent || 0,    icon: Star,        color: 'text-green-400'   },
        { label: 'Strong (70%+)',  value: stats.strong || 0,         icon: TrendingUp,  color: 'text-amber-400'   },
        { label: 'Top Score',      value: `${stats.top_score || 0}%`, icon: Star,       color: 'text-purple-400'  },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="glass-card p-3 flex items-center gap-3">
          <Icon className={`w-5 h-5 ${color} shrink-0`} />
          <div>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-text-muted text-xs">{label}</p>
          </div>
        </div>
      ))}
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

  const observerRef   = useRef(null);
  const searchTimeout = useRef(null);

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['job-stats'],
    queryFn:  fetchJobStats,
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => { if (statsData?.stats) setStats(statsData.stats); }, [statsData]);

  // Initial / filter-change fetch
  const { data, isLoading: queryLoading, refetch } = useQuery({
    queryKey: ['jobs', search, minScore],
    queryFn:  () => fetchJobs({ limit: 20, offset: 0, minScore, search }),
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => { if (data?.jobs) setJobs(data.jobs, data.total || 0); }, [data]);

  useEffect(() => { setIsLoading(queryLoading); }, [queryLoading]);

  // Infinite scroll — load more
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const d = await fetchJobs({ limit: 20, offset, minScore, search });
      appendJobs(d.jobs || [], d.total || 0);
    } catch { setIsLoadingMore(false); }
  }, [hasMore, isLoadingMore, offset, minScore, search]);

  // Intersection observer for infinite scroll
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
      {/* Topbar */}
      <div className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-xl border-b border-white/8 px-6 py-4">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search jobs, companies, skills…"
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-brand-cyan/50 transition-colors"
            />
          </div>

          {/* Min score filter */}
          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-text-muted" />
            <select
              value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-brand-cyan/50"
            >
              <option value={0}>All Matches</option>
              <option value={50}>50%+ Match</option>
              <option value={70}>70%+ Match</option>
              <option value={90}>90%+ Match</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1 shrink-0">
            <button onClick={() => setViewMode('card')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'card' ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-text-muted hover:text-text-primary'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-text-muted hover:text-text-primary'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>

          <button onClick={() => refetch()} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-text-muted hover:text-brand-cyan transition-colors shrink-0">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats */}
        <StatsBar stats={statsData?.stats} />

        {/* Job count */}
        {!isLoading && jobs.length > 0 && (
          <p className="text-text-muted text-sm mb-4">
            Showing <span className="text-text-primary font-medium">{jobs.length}</span> of <span className="text-text-primary font-medium">{total}</span> matched jobs
          </p>
        )}

        {/* Grid */}
        <div className={`grid gap-4 ${viewMode === 'card' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)
            : jobs.length === 0
              ? <EmptyState search={search} onClear={() => setSearch('')} />
              : jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => openDrawer(job)}
                  />
                ))
          }
        </div>

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
