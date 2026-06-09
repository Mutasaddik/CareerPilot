import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Landing        from './pages/Landing.jsx';
import MaintenancePage from './pages/Maintenance.jsx';
import NotFound       from './pages/NotFound.jsx';
import ServerError    from './pages/ServerError.jsx';
import PrivacyPage    from './pages/Privacy.jsx';
import TermsPage      from './pages/Terms.jsx';
import Register       from './pages/Register.jsx';
import Login          from './pages/Login.jsx';
import OTPVerify      from './pages/OTPVerify.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';

const checkMaintenance = async () => {
  const res = await axios.get('/api/v1/maintenance/status');
  return res.data;
};

export default function App() {
  const { data: maintenanceData } = useQuery({
    queryKey: ['maintenance'],
    queryFn: checkMaintenance,
    staleTime: 1000 * 60,
    retry: false,
  });

  const isUnderMaintenance = maintenanceData?.maintenance === true;
  const isAdmin = false;

  if (isUnderMaintenance && !isAdmin) {
    return (
      <BrowserRouter>
        <MaintenancePage message={maintenanceData?.message} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"               element={<Landing />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/verify-otp"     element={<OTPVerify />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/privacy"        element={<PrivacyPage />} />
        <Route path="/terms"          element={<TermsPage />} />
        <Route path="/500"            element={<ServerError />} />
        <Route path="*"               element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
