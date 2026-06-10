import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useQuery }    from '@tanstack/react-query';
import { useEffect }   from 'react';
import axios           from 'axios';
import useAuthStore    from './store/authStore.js';
import { getMe }       from './api/authApi.js';

import Landing         from './pages/Landing.jsx';
import MaintenancePage from './pages/Maintenance.jsx';
import NotFound        from './pages/NotFound.jsx';
import ServerError     from './pages/ServerError.jsx';
import PrivacyPage     from './pages/Privacy.jsx';
import TermsPage       from './pages/Terms.jsx';
import Register        from './pages/Register.jsx';
import Login           from './pages/Login.jsx';
import OTPVerify       from './pages/OTPVerify.jsx';
import ForgotPassword  from './pages/ForgotPassword.jsx';
import ResetPassword   from './pages/ResetPassword.jsx';

const checkMaintenance = async () => {
  const res = await axios.get('/api/v1/maintenance/status');
  return res.data;
};

function SessionInit() {
  const { setUser, clearUser, setLoading } = useAuthStore();

  useQuery({
    queryKey: ['auth-session'],
    queryFn:  getMe,
    retry:    false,
    staleTime: 1000 * 60 * 5,
    onSuccess: (data) => {
      if (data?.user) setUser(data.user);
      else { clearUser(); }
    },
    onError: () => {
      clearUser();
    },
    onSettled: () => {
      setLoading(false);
    },
  });

  return null;
}

export default function App() {
  const { data: maintenanceData } = useQuery({
    queryKey: ['maintenance'],
    queryFn:  checkMaintenance,
    staleTime: 1000 * 60,
    retry:    false,
  });

  const isUnderMaintenance = maintenanceData?.maintenance === true;
  const isAdmin = false; // Phase 3 sets this from authStore

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
        {/* Public */}
        <Route path="/"                element={<Landing />} />
        <Route path="/privacy"         element={<PrivacyPage />} />
        <Route path="/terms"           element={<TermsPage />} />
        <Route path="/500"             element={<ServerError />} />

        {/* Auth */}
        <Route path="/register"        element={<Register />} />
        <Route path="/login"           element={<Login />} />
        <Route path="/verify-otp"      element={<OTPVerify />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />

        {/* Dashboard — Phase 3+ */}
        {/* <Route path="/dashboard/*" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} /> */}

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
