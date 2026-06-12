import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export const getUserProfile        = () => api.get('/user/profile').then((r) => r.data);
export const updateUserProfile     = (data) => api.put('/user/profile', data).then((r) => r.data);
export const updateUserPreferences = (data) => api.put('/user/preferences', data).then((r) => r.data);
export const getOnboardingStatus   = () => api.get('/user/onboarding').then((r) => r.data);
export const completeOnboarding    = (data) => api.post('/user/onboarding/complete', data).then((r) => r.data);
export const exportUserData        = () => api.get('/user/export', { responseType: 'blob' }).then((r) => r.data);
export const deleteUserAccount     = () => api.delete('/user/account').then((r) => r.data);

export default api;
