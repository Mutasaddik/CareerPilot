import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload, Star, Building2, Briefcase, Trash2,
  ChevronRight, FileText, AlertCircle, CheckCircle,
  TrendingUp, Lightbulb, Target, Loader2, Plus
} from 'lucide-react';
import { getAllCVs, setCVPrimary, updateCVScope, deleteCV, reanalyzeCV } from '../api/cvApi.js';
import useCVStore from '../store/cvStore.js';
import CVUpload from '../components/cv/CVUpload.jsx';
import CVScoreGauge from '../components/cv/CVScoreGauge.jsx';

const scopeBadge = (cv) => {
  if (cv.is_primary)                    return { label: 'Primary',      color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' };
  if (cv.usage_scope === 'company_only')     return { label: cv.company_name || 'Company', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
  if (cv.usage_scope === 'job_only')         return { label: 'This Job',     color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
  return                                       { label: 'Unassigned',   color: 'text-text-muted bg-white/5 border-white/10' };
};

const scoreColor = (s) => {
  if (s >= 90) return 'text-green-400';
  if (s >= 70) return 'text-amber-400';
  if (s >= 50) return 'text-blue-400';
  return 'text-red-400';
};

function SkeletonCard() {
  return (
    <div className="glass-card p-4 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/8" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-white/8 rounded w-3/4" />
          <div className="h-2 bg-white/5 rounded w-1/2" />
        </div>
      </div>
      <div className="h-2 bg-white/5 rounded w-full" />
    </div>
  );
}

function ImprovementSection({ analysis }) {
  if (!analysis) return null;
  const suggestions = analysis.improvements || [];
  const keywords    = analysis.missing_keywords || [];
  const strengths   = analysis.strengths || [];
  const scorePath   = analysis.score_path || null;

  return (
    <div className="space-y-4">
      {/* Path to 90+ */}
      {scorePath && scorePath.fixes.length > 0 && (
        <div className="glass-card p-4 border border-green-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h3 className="text-text-primary font-semibold text-sm">Path to {scorePath.projected_score}+</h3>
            </div>
            <span className="text-xs text-text-muted">
              {scorePath.current_score} → <span className="text-green-400 font-bold">{scorePath.projected_score}</span>
            </span>
          </div>
          <div className="space-y-2">
            {scorePath.fixes.map((fix, i) => (
              <div key={i} className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-white/3 border border-white/8">
                <span className="text-text-secondary text-sm flex-1">{fix.action}</span>
                <span className="text-green-400 text-xs font-bold shrink-0 bg-green-500/10 px-2 py-0.5 rounded-full">+{fix.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <h3 className="text-text-primary font-semibold text-sm">Strengths</h3>
          </div>
          {strengths.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Improvements */}
      {suggestions.length > 0 && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h3 className="text-text-primary font-semibold text-sm">Improvements</h3>
          </div>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="text-amber-400 mt-0.5">→</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Missing keywords */}
      {keywords.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-red-400" />
            <h3 className="text-text-primary font-semibold text-sm">Missing Keywords</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw, i) => (
              <span key={i} className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expert summary */}
      {analysis.expert_summary && (
        <div className="glass-card p-4 border-l-2 border-purple-500">
          <h3 className="text-text-primary font-semibold text-sm mb-2">Expert Assessment</h3>
          <p className="text-text-secondary text-sm">{analysis.expert_summary}</p>
        </div>
      )}

      {/* Bullet rewrites */}
      {analysis.bullet_rewrites?.length > 0 && (
        <div className="glass-card p-4 space-y-3">
          <h3 className="text-text-primary font-semibold text-sm">Rewrite These Bullets</h3>
          {analysis.bullet_rewrites.map((bw, i) => (
            <div key={i} className="space-y-1.5 p-3 rounded-lg bg-white/3 border border-white/8">
              <p className="text-red-400/80 text-xs line-through">{bw.current}</p>
              <p className="text-green-400 text-sm">{bw.better}</p>
            </div>
          ))}
        </div>
      )}

      {/* Categorized missing keywords */}
      {analysis.missing_keywords_categorized && (
        <div className="glass-card p-4 space-y-3">
          <h3 className="text-text-primary font-semibold text-sm">Missing Keywords by Category</h3>
          {Object.entries(analysis.missing_keywords_categorized).filter(([, v]) => v?.length).map(([cat, kws]) => (
            <div key={cat}>
              <p className="text-text-muted text-xs uppercase tracking-wider mb-1.5">{cat.replace(/_/g, ' ')}</p>
              <div className="flex flex-wrap gap-1.5">
                {kws.map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">{kw}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Achievements section suggestion */}
      {analysis.achievements_suggestion?.length > 0 && (
        <div className="glass-card p-4 space-y-2">
          <h3 className="text-text-primary font-semibold text-sm">Add a "Key Achievements" Section</h3>
          {analysis.achievements_suggestion.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="text-purple-400 mt-0.5">★</span><span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommended certifications */}
      {analysis.recommended_certifications?.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-text-primary font-semibold text-sm mb-2">Recommended Certifications</h3>
          <div className="flex flex-wrap gap-2">
            {analysis.recommended_certifications.map((cert, i) => (
              <span key={i} className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs rounded-lg">{cert}</span>
            ))}
          </div>
        </div>
      )}

      {/* Daily micro-tip */}
      {analysis.daily_tip && (
        <div className="glass-card p-4 border-l-2 border-brand-cyan">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-brand-cyan" />
            <h3 className="text-text-primary font-semibold text-sm">Today's Tip</h3>
          </div>
          <p className="text-text-secondary text-sm">{analysis.daily_tip}</p>
        </div>
      )}
    </div>
  );
}

export default function CVStudio() {
  const qc = useQueryClient();
  const { cvs, setCVs, activeCVId, setActiveCV, analysisData, setIsAnalyzing } = useCVStore();
  const [showUpload, setShowUpload]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast]             = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch all CVs (React Query v5 — sync to store via useEffect)
  const { data: cvData, isLoading } = useQuery({
    queryKey: ['cvs'],
    queryFn: getAllCVs,
  });

  useEffect(() => {
    if (cvData?.cvs) setCVs(cvData.cvs);
  }, [cvData, setCVs]);

  const activeCV = cvs.find((c) => c.id === activeCVId) || cvs[0] || null;

  // Set primary
  const primaryMutation = useMutation({
    mutationFn: (cvId) => setCVPrimary(cvId),
    onSuccess: (_, cvId) => {
      qc.invalidateQueries({ queryKey: ['cvs'] });
      showToast('Primary CV updated — job matches recalculating…');
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (cvId) => deleteCV(cvId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cvs'] });
      setDeleteTarget(null);
      showToast('CV deleted.');
    },
  });

  // Re-analyze
  const analyzeMutation = useMutation({
    mutationFn: (cvId) => reanalyzeCV(cvId),
    onMutate: () => setIsAnalyzing(true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cvs'] });
      setIsAnalyzing(false);
      showToast('Analysis complete!');
    },
    onError: () => {
      setIsAnalyzing(false);
      showToast('Analysis failed. Please try again.', 'error');
    },
  });

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Topbar */}
      <div className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-xl border-b border-white/8 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-text-primary font-bold text-xl">CV Studio</h1>
            <p className="text-text-secondary text-xs mt-0.5">Manage your CV versions · AI-powered ATS analysis</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => setShowUpload(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm"
          >
            <Plus className="w-4 h-4" />
            Upload CV
          </motion.button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: CV Version List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-text-secondary text-xs uppercase tracking-wider font-medium px-1">Your CVs ({cvs.length})</h2>

          {isLoading ? (
            <>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </>
          ) : cvs.length === 0 ? (
            <div className="glass-card p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6 text-brand-cyan" />
              </div>
              <p className="text-text-primary font-semibold">No CVs yet</p>
              <p className="text-text-secondary text-sm">Upload your first CV to get your ATS score and improvement suggestions.</p>
              <button onClick={() => setShowUpload(true)} className="btn-primary px-4 py-2 text-sm mx-auto flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload CV
              </button>
            </div>
          ) : (
            cvs.map((cv) => {
              const badge    = scopeBadge(cv);
              const isActive = cv.id === activeCVId;
              return (
                <motion.div
                  key={cv.id}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setActiveCV(cv.id)}
                  className={`glass-card p-4 cursor-pointer transition-all border ${
                    isActive ? 'border-brand-cyan/40 bg-brand-cyan/5' : 'border-white/8 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      cv.is_primary ? 'bg-yellow-500/15 border border-yellow-500/20' : 'bg-white/5 border border-white/10'
                    }`}>
                      {cv.is_primary ? <Star className="w-5 h-5 text-yellow-400" /> : <FileText className="w-5 h-5 text-text-muted" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-sm font-medium truncate">
                        {cv.original_filename || cv.company_name || `CV v${cv.version_number}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.color}`}>{badge.label}</span>
                        {cv.ats_score != null && (
                          <span className={`text-xs font-bold ${scoreColor(cv.ats_score)}`}>
                            ATS: {cv.ats_score}%
                          </span>
                        )}
                      </div>
                      <p className="text-text-muted text-xs mt-1">
                        {new Date(cv.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-brand-cyan shrink-0 mt-1" />}
                  </div>

                  {/* Actions */}
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-center gap-2 mt-3 pt-3 border-t border-white/8"
                    >
                      {!cv.is_primary && (
                        <button
                          onClick={(e) => { e.stopPropagation(); primaryMutation.mutate(cv.id); }}
                          disabled={primaryMutation.isPending}
                          className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 transition-colors flex items-center justify-center gap-1"
                        >
                          <Star className="w-3 h-3" /> Set Primary
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); analyzeMutation.mutate(cv.id); }}
                        disabled={analyzeMutation.isPending}
                        className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/20 transition-colors flex items-center justify-center gap-1"
                      >
                        {analyzeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                        Re-analyze
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); window.open(cv.file_url, '_blank'); }}
                        className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-text-secondary border border-white/10 transition-colors flex items-center justify-center gap-1"
                      >
                        <FileText className="w-3 h-3" /> View
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(cv.id); }}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>

        {/* Right: Score + Analysis */}
        <div className="lg:col-span-2 space-y-5">
          {activeCV ? (
            <>
              <CVScoreGauge
                score={activeCV.ats_score}
                isAnalyzing={analyzeMutation.isPending}
                cvName={activeCV.original_filename || activeCV.company_name || `CV v${activeCV.version_number}`}
                onRescan={() => analyzeMutation.mutate(activeCV.id)}
              />

              {/* Score breakdown */}
              {activeCV.analysis_json?.breakdown && (
                <div className="glass-card p-5">
                  <h3 className="text-text-primary font-semibold text-sm mb-4">Score Breakdown</h3>
                  <div className="space-y-3">
                    {Object.entries(activeCV.analysis_json.breakdown).map(([key, val]) => (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-text-secondary capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className={`font-semibold ${scoreColor(val)}`}>{val}%</span>
                        </div>
                        <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-purple-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${val}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <ImprovementSection analysis={activeCV.analysis_json} />
            </>
          ) : (
            !isLoading && (
              <div className="glass-card p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center mx-auto">
                  <FileText className="w-8 h-8 text-brand-cyan" />
                </div>
                <p className="text-text-primary font-bold text-lg">No CV selected</p>
                <p className="text-text-secondary text-sm max-w-xs mx-auto">
                  Upload your CV to get your ATS score, keyword analysis, and personalized improvement tips.
                </p>
                <button onClick={() => setShowUpload(true)} className="btn-primary px-6 py-2.5 mx-auto flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Upload Your First CV
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Upload modal */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowUpload(false); }}
          >
            <CVUpload
              onSuccess={(cv) => { setShowUpload(false); showToast(`CV uploaded — ATS score: ${cv.ats_score ?? 'analyzing…'}`); }}
              onClose={() => setShowUpload(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass-card p-6 max-w-sm w-full space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-text-primary font-bold">Delete CV?</h3>
                  <p className="text-text-secondary text-xs">This cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:bg-white/5 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteTarget)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium
              ${toast.type === 'error'
                ? 'bg-red-500/20 border-red-500/30 text-red-400'
                : 'bg-green-500/20 border-green-500/30 text-green-400'}`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
