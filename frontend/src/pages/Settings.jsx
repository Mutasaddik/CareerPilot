import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Shield, Palette, Save, Trash2,
  Download, LogOut, CheckCircle, AlertTriangle,
  Zap, Edit2, X, Briefcase, ChevronDown
} from 'lucide-react';
import { getUserProfile, updateUserProfile, updateUserPreferences, deleteUserAccount } from '../api/userApi.js';
import { logoutUser } from '../api/authApi.js';
import useAuthStore from '../store/authStore.js';
import useUserStore from '../store/userStore.js';
import { useNavigate, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

const TABS = [
  { id: 'profile',     label: 'Profile',        icon: User },
  { id: 'preferences', label: 'Job Preferences', icon: Briefcase },
  { id: 'appearance',  label: 'Appearance',      icon: Palette },
  { id: 'privacy',     label: 'Privacy & Data',  icon: Shield },
];

const COUNTRY_CODES = [
  { code: '+880', country: 'BD', name: 'Bangladesh', digits: 10 },
  { code: '+91',  country: 'IN', name: 'India',       digits: 10 },
  { code: '+92',  country: 'PK', name: 'Pakistan',    digits: 10 },
  { code: '+94',  country: 'LK', name: 'Sri Lanka',   digits: 9  },
  { code: '+977', country: 'NP', name: 'Nepal',       digits: 10 },
  { code: '+95',  country: 'MM', name: 'Myanmar',     digits: 9  },
  { code: '+60',  country: 'MY', name: 'Malaysia',    digits: 9  },
  { code: '+65',  country: 'SG', name: 'Singapore',   digits: 8  },
  { code: '+66',  country: 'TH', name: 'Thailand',    digits: 9  },
  { code: '+62',  country: 'ID', name: 'Indonesia',   digits: 11 },
  { code: '+63',  country: 'PH', name: 'Philippines', digits: 10 },
  { code: '+44',  country: 'GB', name: 'UK',          digits: 10 },
  { code: '+1',   country: 'US', name: 'USA/Canada',  digits: 10 },
  { code: '+971', country: 'AE', name: 'UAE',         digits: 9  },
  { code: '+966', country: 'SA', name: 'Saudi Arabia',digits: 9  },
  { code: '+974', country: 'QA', name: 'Qatar',       digits: 8  },
  { code: '+61',  country: 'AU', name: 'Australia',   digits: 9  },
];

const TIMEZONES = [
  'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'UTC',
];

const POPULAR_ROLES = [
  'Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'Data Scientist', 'Data Analyst', 'Machine Learning Engineer', 'AI Engineer',
  'Product Manager', 'Project Manager', 'Business Analyst', 'System Analyst',
  'UI/UX Designer', 'Graphic Designer', 'Mobile Developer (Android)', 'Mobile Developer (iOS)',
  'DevOps Engineer', 'Cloud Engineer', 'Network Engineer', 'Cybersecurity Engineer',
  'QA Engineer', 'Test Automation Engineer', 'Embedded Systems Engineer',
  'Database Administrator', 'Technical Writer', 'IT Support Engineer',
  'Blockchain Developer', 'Game Developer', 'ERP Consultant', 'SAP Consultant',
];

const POPULAR_SKILLS = [
  'React', 'Vue.js', 'Angular', 'Next.js', 'Node.js', 'Express.js',
  'Python', 'Django', 'Flask', 'FastAPI', 'Java', 'Spring Boot',
  'PHP', 'Laravel', 'C#', '.NET', 'C++', 'Go', 'Rust', 'Kotlin', 'Swift',
  'TypeScript', 'JavaScript', 'HTML/CSS', 'Tailwind CSS', 'Bootstrap',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD',
  'Git', 'REST API', 'GraphQL', 'gRPC', 'Microservices', 'Linux',
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'NLP',
  'Figma', 'Adobe XD', 'Photoshop', 'Illustrator',
  'Jira', 'Confluence', 'Agile', 'Scrum', 'Kanban',
];

const BD_LOCATIONS = [
  'Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna',
  'Barishal', 'Mymensingh', 'Rangpur', 'Comilla', 'Gazipur',
  'Narayanganj', 'Savar', 'Remote', 'Anywhere in Bangladesh',
];

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Temporary'];

const REMOTE_OPTIONS = [
  { value: 'onsite',  label: 'On-site only' },
  { value: 'hybrid',  label: 'Hybrid' },
  { value: 'remote',  label: 'Remote only' },
  { value: 'any',     label: 'Open to all' },
];

const INDUSTRIES = [
  'Technology / IT', 'Telecom', 'Banking & Finance', 'E-commerce',
  'Healthcare', 'Education / EdTech', 'NGO / Development',
  'Garments / Textile', 'Manufacturing', 'Media & Advertising',
  'Government / Public Sector', 'Startup', 'Multinational',
];

function Toast({ message, type }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border ${
        type === 'success'
          ? 'bg-success/15 border-success/30 text-success'
          : 'bg-danger/15 border-danger/30 text-danger'
      }`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-6 w-full max-w-sm space-y-4">
        <h3 className="font-display font-bold text-lg text-text-primary">{title}</h3>
        <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} className="btn-ghost flex-1">Cancel</button>
          <button onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              danger
                ? 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25'
                : 'btn-primary'
            }`}>{confirmLabel}</button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Settings() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const clearUser   = useAuthStore((s) => s.clearUser);
  const setUser     = useAuthStore((s) => s.setUser);
  const authUser    = useAuthStore((s) => s.user);
  const setProfile  = useUserStore((s) => s.setProfile);

  const [tab,               setTab]               = useState('profile');
  const [toast,             setToast]             = useState(null);
  const [editMode,          setEditMode]          = useState(false);
  const [showSaveConfirm,   setShowSaveConfirm]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingSave,       setPendingSave]       = useState(null);
  const [selectedCountry,   setSelectedCountry]   = useState(COUNTRY_CODES[0]);
  const [phoneNumber,       setPhoneNumber]       = useState('');

  const [profileForm, setProfileForm] = useState({
    name: '', currentTitle: '', experienceYears: '', location: '', timezone: 'Asia/Dhaka',
  });

  const [prefForm, setPrefForm] = useState({
    targetRoles: [], targetLocations: [], skills: [], industries: [],
    jobType: 'Full-time', remotePreference: 'any',
    salaryMinBdt: '', salaryMaxBdt: '',
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn:  getUserProfile,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (profileData?.profile) {
      const p = profileData.profile;
      setProfileForm({
        name:            p.name            || '',
        currentTitle:    p.current_title   || '',
        experienceYears: p.experience_years?.toString() || '',
        location:        p.location        || '',
        timezone:        p.timezone        || 'Asia/Dhaka',
      });
      // Parse stored phone number
      if (p.phone) {
        const found = COUNTRY_CODES.find((c) => p.phone.startsWith(c.code));
        if (found) {
          setSelectedCountry(found);
          setPhoneNumber(p.phone.replace(found.code, ''));
        } else {
          setPhoneNumber(p.phone.replace(/^\+?880/, ''));
        }
      }
      setPrefForm({
        targetRoles:      p.target_roles      || [],
        targetLocations:  p.target_locations  || [],
        skills:           p.skills            || [],
        industries:       [],
        jobType:          p.job_type          || 'Full-time',
        remotePreference: p.remote_preference || 'any',
        salaryMinBdt:     p.salary_min_bdt?.toString() || '',
        salaryMaxBdt:     p.salary_max_bdt?.toString() || '',
      });
      setProfile(p);
      if (p.theme_preference === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      }
    }
  }, [profileData]);

  const profileMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      if (data.profile) {
        setUser({ ...authUser, name: data.profile.name, timezone: data.profile.timezone, theme_preference: data.profile.theme_preference });
      }
      setEditMode(false);
      showToast('Profile updated successfully.');
    },
    onError: () => showToast('Failed to update profile.', 'error'),
  });

  const prefMutation = useMutation({
    mutationFn: updateUserPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      showToast('Preferences saved.');
    },
    onError: () => showToast('Failed to save preferences.', 'error'),
  });

  const themeMutation = useMutation({
    mutationFn: (themePreference) => updateUserProfile({ themePreference }),
    onSuccess: (_, themePreference) => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      if (themePreference === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
      }
      showToast('Theme updated.');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess:  () => { clearUser(); navigate('/login'); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUserAccount,
    onSuccess:  () => { clearUser(); navigate('/'); },
    onError:    () => showToast('Failed to delete account.', 'error'),
  });

  const handleExportExcel = async () => {
    try {
      const res  = await fetch('/api/v1/user/export', { credentials: 'include' });
      const data = await res.json();
      const wb   = XLSX.utils.book_new();
      const userSheet = XLSX.utils.json_to_sheet([{
        'Name':             data.user?.name,
        'Email':            data.user?.email,
        'Phone':            data.user?.phone || '',
        'Job Title':        data.user?.current_title || '',
        'Experience (yrs)': data.user?.experience_years || '',
        'Location':         data.user?.location || '',
        'Plan':             data.user?.plan,
        'Joined':           data.user?.created_at,
      }]);
      XLSX.utils.book_append_sheet(wb, userSheet, 'Profile');
      if (data.applications?.length > 0) {
        const appSheet = XLSX.utils.json_to_sheet(data.applications.map((a) => ({
          'Company': a.company_name || '', 'Status': a.status,
          'Applied': a.applied_date, 'Notes': a.notes || '',
        })));
        XLSX.utils.book_append_sheet(wb, appSheet, 'Applications');
      }
      XLSX.writeFile(wb, 'careerpilot-data.xlsx');
      showToast('Exported as Excel successfully.');
    } catch {
      showToast('Failed to export data.', 'error');
    }
  };

  const toggleItem = (field, value) => {
    setPrefForm((f) => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter((v) => v !== value)
        : [...f[field], value],
    }));
  };

  const isPhoneValid = phoneNumber.length === selectedCountry.digits;

  const handleSaveProfile = () => {
    if (phoneNumber && !isPhoneValid) {
      showToast(`Please input a valid mobile number (${selectedCountry.digits} digits for ${selectedCountry.name})`, 'error');
      return;
    }
    setPendingSave('profile');
    setShowSaveConfirm(true);
  };

  const confirmSave = () => {
    setShowSaveConfirm(false);
    if (pendingSave === 'profile') {
      profileMutation.mutate({
        name:            profileForm.name,
        phone:           phoneNumber ? `${selectedCountry.code}${phoneNumber}` : undefined,
        currentTitle:    profileForm.currentTitle,
        experienceYears: profileForm.experienceYears ? parseInt(profileForm.experienceYears) : undefined,
        location:        profileForm.location,
        timezone:        profileForm.timezone,
      });
    } else if (pendingSave === 'preferences') {
      prefMutation.mutate({
        targetRoles:      prefForm.targetRoles,
        targetLocations:  prefForm.targetLocations,
        skills:           prefForm.skills,
        jobType:          prefForm.jobType.toLowerCase(),
        remotePreference: prefForm.remotePreference,
        salaryMinBdt:     prefForm.salaryMinBdt ? parseInt(prefForm.salaryMinBdt) : null,
        salaryMaxBdt:     prefForm.salaryMaxBdt ? parseInt(prefForm.salaryMaxBdt) : null,
      });
    }
    setPendingSave(null);
  };

  const p = profileData?.profile;

  if (isLoading) return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-brand-purple border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="border-b border-border bg-bg-secondary/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center shadow-glow-brand">
              <Zap className="w-4 h-4 text-white" />
            </Link>
            <span className="font-display font-bold text-text-primary">CareerPilot</span>
            <span className="text-text-muted">/</span>
            <span className="text-text-secondary text-sm">Settings</span>
          </div>
          <button onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-danger transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display font-bold text-2xl text-text-primary">Settings</h1>
          <p className="text-text-secondary text-sm mt-1">Manage your account, preferences and privacy.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-56 shrink-0">
            <nav className="space-y-1">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    tab === t.id
                      ? 'bg-brand-purple/15 text-brand-purple border border-brand-purple/20'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                  }`}>
                  <t.icon className="w-4 h-4" />{t.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

                {/* Profile tab */}
                {tab === 'profile' && (
                  <div className="glass-card p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-text-primary">Personal Information</h2>
                      {!editMode ? (
                        <button onClick={() => setEditMode(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-purple/15 text-brand-purple border border-brand-purple/20 hover:bg-brand-purple/25 transition-colors text-sm font-medium">
                          <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                        </button>
                      ) : (
                        <button onClick={() => setEditMode(false)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-primary/60 text-text-secondary border border-border hover:border-border-bright transition-colors text-sm font-medium">
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </div>

                    {!editMode ? (
                      <div className="grid md:grid-cols-2 gap-4">
                        {[
                          { label: 'Full Name',         value: p?.name },
                          { label: 'Email',             value: p?.email },
                          { label: 'Phone',             value: p?.phone },
                          { label: 'Current Job Title', value: p?.current_title },
                          { label: 'Experience',        value: p?.experience_years ? `${p.experience_years} years` : null },
                          { label: 'Location',          value: p?.location },
                          { label: 'Timezone',          value: p?.timezone },
                          { label: 'Member Since',      value: p?.created_at ? new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null },
                        ].map(({ label, value }) => (
                          <div key={label} className="space-y-1">
                            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</p>
                            <p className="text-sm text-text-primary">{value || <span className="text-text-muted italic">Not set</span>}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Full Name *</label>
                          <input value={profileForm.name}
                            onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                            className="input-field" placeholder="Your full name" />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Email</label>
                          <input value={authUser?.email || ''} disabled className="input-field opacity-50 cursor-not-allowed" />
                        </div>

                        {/* Phone with country code */}
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Mobile Number</label>
                          <div className="flex gap-2">
                            {/* Country code selector */}
                            <div className="relative shrink-0">
                              <select
                                value={selectedCountry.code}
                                onChange={(e) => {
                                  const found = COUNTRY_CODES.find((c) => c.code === e.target.value);
                                  if (found) { setSelectedCountry(found); setPhoneNumber(''); }
                                }}
                                style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)' }}
                                className="input-field pr-8 appearance-none cursor-pointer w-36">
                                {COUNTRY_CODES.map((c) => (
                                  <option key={c.code} value={c.code} style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                                    {c.country} {c.code}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                            </div>
                            {/* Phone number input */}
                            <input
                              type="tel"
                              value={phoneNumber}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, selectedCountry.digits);
                                setPhoneNumber(digits);
                              }}
                              className={`input-field flex-1 ${
                                phoneNumber && !isPhoneValid ? 'border-warning focus:border-warning' :
                                phoneNumber && isPhoneValid ? 'border-success focus:border-success' : ''
                              }`}
                              placeholder={`${selectedCountry.digits} digits`}
                              maxLength={selectedCountry.digits}
                            />
                          </div>
                          {phoneNumber && !isPhoneValid && (
                            <p className="text-xs text-warning">Please input a valid mobile number</p>
                          )}
                          {phoneNumber && isPhoneValid && (
                            <p className="text-xs text-success">✓ {selectedCountry.code} {phoneNumber}</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Current Job Title</label>
                          <input value={profileForm.currentTitle}
                            onChange={(e) => setProfileForm((f) => ({ ...f, currentTitle: e.target.value }))}
                            className="input-field" placeholder="e.g. Software Engineer" />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Years of Experience</label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="1"
                            value={profileForm.experienceYears}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              const num = parseInt(val);
                              if (!val) { setProfileForm((f) => ({ ...f, experienceYears: '' })); return; }
                              if (num >= 0 && num <= 50) setProfileForm((f) => ({ ...f, experienceYears: String(num) }));
                            }}
                            onKeyDown={(e) => {
                              if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault();
                            }}
                            className="input-field"
                            placeholder="e.g. 3"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Location</label>
                          <input value={profileForm.location}
                            onChange={(e) => setProfileForm((f) => ({ ...f, location: e.target.value }))}
                            className="input-field" placeholder="e.g. Dhaka, Bangladesh" />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Timezone</label>
                          <select
                            value={profileForm.timezone}
                            onChange={(e) => setProfileForm((f) => ({ ...f, timezone: e.target.value }))}
                            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)' }}
                            className="input-field">
                            {TIMEZONES.map((tz) => (
                              <option key={tz} value={tz} style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>{tz}</option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2 flex justify-end pt-2 border-t border-border">
                          <button onClick={handleSaveProfile} disabled={profileMutation.isPending}
                            className="btn-primary gap-2 disabled:opacity-60">
                            <Save className="w-4 h-4" />
                            {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Preferences tab */}
                {tab === 'preferences' && (
                  <div className="glass-card p-6 space-y-6">
                    <h2 className="font-semibold text-text-primary">Job Preferences</h2>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Target Roles</label>
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                        {POPULAR_ROLES.map((role) => (
                          <button key={role} onClick={() => toggleItem('targetRoles', role)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border whitespace-nowrap ${
                              prefForm.targetRoles.includes(role)
                                ? 'bg-brand-purple/15 border-brand-purple/40 text-brand-purple'
                                : 'bg-bg-primary/40 border-border text-text-secondary hover:border-border-bright'
                            }`}>{role}</button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Preferred Locations</label>
                      <div className="flex flex-wrap gap-2">
                        {BD_LOCATIONS.map((loc) => (
                          <button key={loc} onClick={() => toggleItem('targetLocations', loc)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              prefForm.targetLocations.includes(loc)
                                ? 'bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan'
                                : 'bg-bg-primary/40 border-border text-text-secondary hover:border-border-bright'
                            }`}>{loc}</button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Your Skills</label>
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                        {POPULAR_SKILLS.map((skill) => (
                          <button key={skill} onClick={() => toggleItem('skills', skill)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border whitespace-nowrap ${
                              prefForm.skills.includes(skill)
                                ? 'bg-success/15 border-success/40 text-success'
                                : 'bg-bg-primary/40 border-border text-text-secondary hover:border-border-bright'
                            }`}>{skill}</button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Industry</label>
                      <div className="flex flex-wrap gap-2">
                        {INDUSTRIES.map((ind) => (
                          <button key={ind} onClick={() => toggleItem('industries', ind)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              prefForm.industries.includes(ind)
                                ? 'bg-warning/15 border-warning/40 text-warning'
                                : 'bg-bg-primary/40 border-border text-text-secondary hover:border-border-bright'
                            }`}>{ind}</button>
                        ))}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Job Type</label>
                        <div className="flex flex-wrap gap-2">
                          {JOB_TYPES.map((type) => (
                            <button key={type} onClick={() => setPrefForm((f) => ({ ...f, jobType: type }))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                prefForm.jobType === type
                                  ? 'bg-brand-purple/15 border-brand-purple/40 text-brand-purple'
                                  : 'bg-bg-primary/40 border-border text-text-secondary hover:border-border-bright'
                              }`}>{type}</button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Work Style</label>
                        <div className="grid grid-cols-2 gap-2">
                          {REMOTE_OPTIONS.map((opt) => (
                            <button key={opt.value} onClick={() => setPrefForm((f) => ({ ...f, remotePreference: opt.value }))}
                              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                                prefForm.remotePreference === opt.value
                                  ? 'bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan'
                                  : 'bg-bg-primary/40 border-border text-text-secondary hover:border-border-bright'
                              }`}>{opt.label}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Expected Salary Range (BDT/month)</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">৳</span>
                          <input type="number" min="0" placeholder="Min (e.g. 50000)"
                            value={prefForm.salaryMinBdt}
                            onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
                            onChange={(e) => setPrefForm((f) => ({ ...f, salaryMinBdt: e.target.value }))}
                            className="input-field pl-7" />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">৳</span>
                          <input type="number" min="0" placeholder="Max (e.g. 100000)"
                            value={prefForm.salaryMaxBdt}
                            onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
                            onChange={(e) => setPrefForm((f) => ({ ...f, salaryMaxBdt: e.target.value }))}
                            className="input-field pl-7" />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-border">
                      <button onClick={() => { setPendingSave('preferences'); setShowSaveConfirm(true); }}
                        disabled={prefMutation.isPending}
                        className="btn-primary gap-2 disabled:opacity-60">
                        <Save className="w-4 h-4" />
                        {prefMutation.isPending ? 'Saving...' : 'Save Preferences'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Appearance tab */}
                {tab === 'appearance' && (
                  <div className="glass-card p-6 space-y-6">
                    <h2 className="font-semibold text-text-primary">Appearance</h2>
                    <div className="space-y-3">
                      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Theme</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: 'dark',  label: 'Dark',  desc: 'Easy on the eyes',  bg: '#0a0a12', fg: '#f1f5f9' },
                          { value: 'light', label: 'Light', desc: 'Classic and bright', bg: '#f8fafc', fg: '#0f172a' },
                        ].map((theme) => (
                          <button key={theme.value}
                            onClick={() => themeMutation.mutate(theme.value)}
                            className={`p-4 rounded-xl border-2 transition-all text-left space-y-3 ${
                              (p?.theme_preference || 'dark') === theme.value
                                ? 'border-brand-purple bg-brand-purple/10'
                                : 'border-border hover:border-border-bright'
                            }`}>
                            <div className="h-16 rounded-lg border border-border flex items-center justify-center gap-2"
                              style={{ backgroundColor: theme.bg }}>
                              <div className="w-8 h-2 rounded" style={{ backgroundColor: theme.fg + '40' }} />
                              <div className="w-12 h-2 rounded" style={{ backgroundColor: theme.fg + '60' }} />
                              {(p?.theme_preference || 'dark') === theme.value && (
                                <CheckCircle className="w-4 h-4 text-brand-purple ml-1" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-text-primary">{theme.label}</p>
                              <p className="text-xs text-text-secondary">{theme.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-text-muted">Theme is saved to your account and syncs across all devices.</p>
                    </div>
                  </div>
                )}

                {/* Privacy tab */}
                {tab === 'privacy' && (
                  <div className="space-y-4">
                    <div className="glass-card p-6 space-y-4">
                      <h2 className="font-semibold text-text-primary">Your Data (GDPR)</h2>
                      <p className="text-sm text-text-secondary">You have full control over your data.</p>
                      <div className="flex items-center justify-between p-4 rounded-xl bg-bg-primary/60 border border-border">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">Download My Data</p>
                          <p className="text-xs text-text-secondary mt-0.5">Export as Excel — profile, applications, CVs and contacts</p>
                        </div>
                        <button onClick={handleExportExcel}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-purple/15 text-brand-purple border border-brand-purple/30 hover:bg-brand-purple/25 transition-colors text-sm font-medium">
                          <Download className="w-4 h-4" /> Export Excel
                        </button>
                      </div>
                    </div>
                    <div className="glass-card p-6 space-y-4">
                      <h2 className="font-semibold text-danger flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Danger Zone
                      </h2>
                      <div className="flex items-center justify-between p-4 rounded-xl bg-danger/5 border border-danger/20">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">Delete Account</p>
                          <p className="text-xs text-text-secondary mt-0.5">Permanently delete your account and all data. Cannot be undone.</p>
                        </div>
                        <button onClick={() => setShowDeleteConfirm(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-colors text-sm font-medium">
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSaveConfirm && (
          <ConfirmDialog
            title="Save Changes"
            message="Are you sure you want to save these changes?"
            onConfirm={confirmSave}
            onCancel={() => { setShowSaveConfirm(false); setPendingSave(null); }}
            confirmLabel="Save"
          />
        )}
        {showDeleteConfirm && (
          <ConfirmDialog
            title="Delete Account"
            message="This will permanently delete your account and all data. This action cannot be undone."
            onConfirm={() => { setShowDeleteConfirm(false); deleteMutation.mutate(); }}
            onCancel={() => setShowDeleteConfirm(false)}
            confirmLabel="Delete Forever"
            danger
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </AnimatePresence>
    </div>
  );
}
