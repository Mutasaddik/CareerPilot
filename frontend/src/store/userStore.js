import { create } from 'zustand';

const useUserStore = create((set, get) => ({
  profile:     null,
  preferences: null,
  isLoading:   false,

  setProfile: (profile) => set({
    profile,
    preferences: {
      targetRoles:         profile?.target_roles         || [],
      targetLocations:     profile?.target_locations     || [],
      skills:              profile?.skills               || [],
      jobType:             profile?.job_type             || 'full-time',
      salaryMinBdt:        profile?.salary_min_bdt       || '',
      salaryMaxBdt:        profile?.salary_max_bdt       || '',
      remotePreference:    profile?.remote_preference    || 'any',
      cvTemplatePreference:profile?.cv_template_preference || 'modern',
      onboardingCompleted: profile?.onboarding_completed || false,
    },
  }),

  updateProfile: (fields) => set((state) => ({
    profile: state.profile ? { ...state.profile, ...fields } : null,
  })),

  updatePreferences: (fields) => set((state) => ({
    preferences: state.preferences ? { ...state.preferences, ...fields } : fields,
  })),

  setLoading: (isLoading) => set({ isLoading }),

  isOnboardingComplete: () => get().preferences?.onboardingCompleted === true,
}));

export default useUserStore;
