import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ── Auth API calls ────────────────────────────────────────────────
export const registerUser = (data) =>
  api.post('/auth/register', data).then((r) => r.data);

export const loginUser = (data) =>
  api.post('/auth/login', data).then((r) => r.data);

export const logoutUser = () =>
  api.post('/auth/logout').then((r) => r.data);

export const verifyOTP = (data) =>
  api.post('/auth/verify-otp', data).then((r) => r.data);

export const resendOTP = (data) =>
  api.post('/auth/resend-otp', data).then((r) => r.data);

export const forgotPassword = (data) =>
  api.post('/auth/forgot-password', data).then((r) => r.data);

export const resetPassword = (data) =>
  api.post('/auth/reset-password', data).then((r) => r.data);

export const getMe = () =>
  api.get('/auth/me').then((r) => r.data);

export const refreshToken = () =>
  api.post('/auth/refresh').then((r) => r.data);

export default api;
