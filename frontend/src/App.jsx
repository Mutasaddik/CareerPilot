import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useQuery }    from '@tanstack/react-query';
import { useEffect }   from 'react';
import axios           from 'axios';
import useAuthStore    from './store/authStore.js';
import useUserStore    from './store/userStore.js';
import { getMe }       from './api/authApi.js';
import { getUserProfile } from './api/userApi.js';

import Landing             from './pages/Landing.jsx';
import MaintenancePage     from './pages/Maintenance.jsx';
import NotFound            from './pages/NotFound.jsx';
import ServerError         from './pages/ServerError.jsx';
import PrivacyPage         from './pages/Privacy.jsx';
import TermsPage           from './pages/Terms.jsx';
import Register            from './pages/Register.jsx';
import Login               from './pages/Login.jsx';
import OTPVerify           from './pages/OTPVerify.jsx';
import ForgotPassword      from './pages/ForgotPassword.jsx';
import ResetPassword       from './pages/ResetPassword.jsx';
import Onboarding          from './pages/Onboarding.jsx';
import Settings            from './pages/Settings.jsx';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard.jsx';
import AdminDashboard      from './pages/admin/AdminDashboard.jsx';
import ModeratorDashboard  from './pages/moderator/ModeratorDashboard.jsx';
import Jobs                from './pages/Jobs.jsx';
import CVStudio           from './pages/CVStudio.jsx';

const checkMaintenance = async () => {
  try {
    const res = await axios.get('/api/v1/maintenance/status');
    return res.data;
  } catch {
    return { maintenance: false };
  }
};

const Spinner = () => (
  <div className="min-h-screen bg-bg-primary flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-brand-purple border-t-transparent animate-spin" />
  </div>
);

function RoleRoute({ children, allowedRoles }) {
  const { isAuthenticated, isLoading, role } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(role)) return <Navigate to="/" replace />;
  return children;
}

function AuthRequired({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function DashboardRedirect() {
  const { isAuthenticated, isLoading, role } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const map = {
    superadmin: '/superadmin/dashboard',
    admin:      '/admin/dashboard',
    moderator:  '/moderator/dashboard',
    user:       '/dashboard-home',
  };
  return <Navigate to={map[role] || '/dashboard-home'} replace />;
}

function SessionInit() {
  const { setUser, clearUser, setLoading } = useAuthStore();
  const setProfile = useUserStore((s) => s.setProfile);

  const { data, isError, isSuccess, isPending } = useQuery({
    queryKey: ['auth-session'],
    queryFn:  getMe,
    retry:    false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isSuccess) {
      if (data?.user) setUser(data.user);
      else { clearUser(); setLoading(false); }
    }
  }, [isSuccess, data]);

  useEffect(() => {
    if (isError) { clearUser(); setLoading(false); }
  }, [isError]);

  useEffect(() => {
    if (!isPending) setLoading(false);
  }, [isPending]);

  return null;
}

// Smart dashboard for regular users — checks onboarding status
function UserDashboard() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const setProfile = useUserStore((s) => s.setProfile);

  const { data, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn:  getUserProfile,
    enabled:  isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (data?.profile) setProfile(data.profile);
  }, [data]);

  if (isLoading || profileLoading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const onboardingDone = data?.profile?.onboarding_completed;

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="glass-card p-8 text-center space-y-4 max-w-sm">
        <p className="text-text-primary font-bold text-xl">🎉 Welcome to CareerPilot!</p>
        <p className="text-text-secondary text-sm">Full dashboard coming in Phase 5.</p>
        {!onboardingDone && (
          <a href="/onboarding" className="btn-primary w-full justify-center text-sm block">
            Complete Setup →
          </a>
        )}
        <a href="/settings" className="btn-ghost w-full justify-center text-sm block">
          Settings
        </a>
      </div>
    </div>
  );
}

export default function App() {
  const { data: maintenanceData } = useQuery({
    queryKey: ['maintenance'],
    queryFn:  checkMaintenance,
    staleTime: 1000 * 60,
    retry:    false,
  });

  const { isAuthenticated, role } = useAuthStore();
  const isUnderMaintenance = maintenanceData?.maintenance === true;
  const isAdmin = isAuthenticated && ['admin', 'superadmin'].includes(role);

  if (isUnderMaintenance && !isAdmin) {
    return (
      <BrowserRouter>
        <MaintenancePage message={maintenanceData?.message} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <SessionInit />
      <Routes>
        <Route path="/"        element={<Landing />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms"   element={<TermsPage />} />
        <Route path="/500"     element={<ServerError />} />

        <Route path="/register"        element={<Register />} />
        <Route path="/login"           element={<Login />} />
        <Route path="/verify-otp"      element={<OTPVerify />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />

        <Route path="/onboarding" element={<AuthRequired><Onboarding /></AuthRequired>} />
        <Route path="/settings"   element={<AuthRequired><Settings /></AuthRequired>} />
        <Route path="/dashboard"  element={<DashboardRedirect />} />

        <Route path="/superadmin/dashboard" element={
          <RoleRoute allowedRoles={['superadmin']}><SuperAdminDashboard /></RoleRoute>
        } />
        <Route path="/admin/dashboard" element={
          <RoleRoute allowedRoles={['admin', 'superadmin']}><AdminDashboard /></RoleRoute>
        } />
        <Route path="/moderator/dashboard" element={
          <RoleRoute allowedRoles={['moderator', 'admin', 'superadmin']}><ModeratorDashboard /></RoleRoute>
        } />

        <Route path="/jobs" element={<RoleRoute allowedRoles={["superadmin","admin","moderator","user"]}><Jobs /></RoleRoute>} />
        <Route path="/cv" element={<RoleRoute allowedRoles={["superadmin","admin","moderator","user"]}><CVStudio /></RoleRoute>} />

        <Route path="/dashboard-home" element={<AuthRequired><UserDashboard /></AuthRequired>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
