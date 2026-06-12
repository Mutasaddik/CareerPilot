import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../store/authStore.js';
import { getMe } from '../api/authApi.js';

export default function ProtectedRoute({ children, requiredRole = null }) {
  const navigate = useNavigate();
  const { setUser, clearUser, isAuthenticated, isLoading, user } = useAuthStore();

  const { data, isError, isSuccess } = useQuery({
    queryKey: ['auth-me'],
    queryFn:  getMe,
    retry:    false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isSuccess && data?.user) setUser(data.user);
    if (isError) { clearUser(); navigate('/login'); }
  }, [isSuccess, isError, data]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/login');
  }, [isLoading, isAuthenticated]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && requiredRole) {
      const hierarchy = { superadmin: 4, admin: 3, moderator: 2, user: 1 };
      if ((hierarchy[user?.role] || 0) < (hierarchy[requiredRole] || 0)) {
        navigate('/');
      }
    }
  }, [isLoading, isAuthenticated, user, requiredRole]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand-purple border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return children;
}
