import { create } from 'zustand';

const useCVStore = create((set, get) => ({
  // All CV versions
  cvs: [],
  // Primary CV (the one used for job matching)
  primaryCV: null,
  // Currently viewed/selected CV in studio
  activeCVId: null,
  // ATS score of primary CV (0-100)
  atsScore: null,
  // Full analysis JSON of active CV
  analysisData: null,
  // Upload progress (0-100)
  uploadProgress: 0,
  // Loading states
  isLoading: false,
  isUploading: false,
  isAnalyzing: false,
  // Error
  error: null,

  // ── Setters ──────────────────────────────────────────────────────

  setCVs: (cvs) => {
    const primary = cvs.find((cv) => cv.is_primary) || null;
    set({
      cvs,
      primaryCV: primary,
      atsScore: primary?.ats_score ?? null,
      analysisData: primary?.analysis_json ?? null,
      activeCVId: primary?.id ?? (cvs[0]?.id || null),
    });
  },

  setActiveCV: (cvId) => {
    const cv = get().cvs.find((c) => c.id === cvId);
    set({
      activeCVId: cvId,
      analysisData: cv?.analysis_json ?? null,
    });
  },

  addCV: (cv) => {
    const updated = [cv, ...get().cvs];
    set({ cvs: updated });
    if (cv.is_primary) {
      set({ primaryCV: cv, atsScore: cv.ats_score, analysisData: cv.analysis_json, activeCVId: cv.id });
    }
  },

  updateCV: (cvId, updates) => {
    const updated = get().cvs.map((cv) => (cv.id === cvId ? { ...cv, ...updates } : cv));
    // Recalculate primary
    const primary = updated.find((cv) => cv.is_primary) || null;
    set({
      cvs: updated,
      primaryCV: primary,
      atsScore: primary?.ats_score ?? null,
    });
    if (get().activeCVId === cvId) {
      set({ analysisData: updated.find((c) => c.id === cvId)?.analysis_json ?? null });
    }
  },

  setPrimaryCV: (cvId) => {
    const updated = get().cvs.map((cv) => ({ ...cv, is_primary: cv.id === cvId }));
    const primary = updated.find((cv) => cv.is_primary) || null;
    set({ cvs: updated, primaryCV: primary, atsScore: primary?.ats_score ?? null });
  },

  removeCV: (cvId) => {
    const updated = get().cvs.filter((cv) => cv.id !== cvId);
    const primary = updated.find((cv) => cv.is_primary) || null;
    set({
      cvs: updated,
      primaryCV: primary,
      atsScore: primary?.ats_score ?? null,
      activeCVId: get().activeCVId === cvId ? (updated[0]?.id || null) : get().activeCVId,
    });
  },

  setUploadProgress: (pct) => set({ uploadProgress: pct }),
  setIsLoading: (v) => set({ isLoading: v }),
  setIsUploading: (v) => set({ isUploading: v }),
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setError: (e) => set({ error: e }),
  clearError: () => set({ error: null }),
  reset: () => set({
    cvs: [], primaryCV: null, activeCVId: null,
    atsScore: null, analysisData: null,
    uploadProgress: 0, isLoading: false,
    isUploading: false, isAnalyzing: false, error: null,
  }),
}));

export default useCVStore;
