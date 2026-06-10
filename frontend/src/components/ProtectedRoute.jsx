import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../store/authStore.js';
import { getMe } from '../api/authApi.js';

export default function ProtectedRoute({ children, requiredRole = null }) {
  const navigate          = useNavigate();
  const { setUser, clearUser, isAuthenticated, isLoading, user } = useAuthStore();

  const { isLoading: queryLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: getMe,
    retry: false,
    staleTime: 1000 * 60 * 5,
    onSuccess: (data) => {
      setUser(data.user);
    },
    onError: () => {
      clearUser();
      navigate('/login');
    },
  });

  useEffect(() => {
    if (!queryLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [queryLoading, isAuthenticated, navigate]);

  // Role check
  useEffect(() => {
    if (!queryLoading && isAuthenticated && requiredRole) {
      const roleHierarchy = { superadmin: 4, admin: 3, moderator: 2, user: 1 };
      const userLevel     = roleHierarchy[user?.role] || 0;
      const requiredLevel = roleHierarchy[requiredRole] || 0;
      if (userLevel < requiredLevel) {
        navigate('/404');
      }
    }
  }, [queryLoading, isAuthenticated, user, requiredRole, navigate]);

  if (queryLoading || isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center mx-auto animate-pulse">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <div className="space-y-2">
            <div className="skeleton h-4 w-32 mx-auto" />
            <div className="skeleton h-3 w-24 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return children;
}
