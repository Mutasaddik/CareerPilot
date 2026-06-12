import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ── Admin API ─────────────────────────────────────────────────────
export const getAdminStats        = () => api.get('/admin/stats').then((r) => r.data);
export const getAdminUsers        = (params) => api.get('/admin/users', { params }).then((r) => r.data);
export const getAdminUser         = (id) => api.get(`/admin/users/${id}`).then((r) => r.data);
export const suspendUser          = (id) => api.post(`/admin/users/${id}/suspend`).then((r) => r.data);
export const unsuspendUser        = (id) => api.post(`/admin/users/${id}/unsuspend`).then((r) => r.data);
export const getAdminScrapers     = () => api.get('/admin/scrapers').then((r) => r.data);
export const getAdminFeatureFlags = () => api.get('/admin/feature-flags').then((r) => r.data);
export const getAdminAuditLogs    = (params) => api.get('/admin/audit-logs', { params }).then((r) => r.data);

// ── SuperAdmin API ────────────────────────────────────────────────
export const getSuperAdminStats     = () => api.get('/superadmin/stats').then((r) => r.data);
export const getSuperAdminUsers     = (params) => api.get('/superadmin/users', { params }).then((r) => r.data);
export const getSuperAdminFlags     = () => api.get('/superadmin/feature-flags').then((r) => r.data);
export const getMaintenance         = () => api.get('/superadmin/maintenance').then((r) => r.data);
export const setMaintenance         = (data) => api.post('/superadmin/maintenance', data).then((r) => r.data);
export const updateFeatureFlag      = (name, data) => api.patch(`/superadmin/feature-flags/${name}`, data).then((r) => r.data);
export const superAdminSuspendUser  = (id) => api.post(`/superadmin/users/${id}/suspend`).then((r) => r.data);
export const superAdminUnsuspendUser= (id) => api.post(`/superadmin/users/${id}/unsuspend`).then((r) => r.data);
export const superAdminDeleteUser   = (id) => api.delete(`/superadmin/users/${id}`).then((r) => r.data);
export const createAdminUser        = (data) => api.post('/superadmin/admins', data).then((r) => r.data);
export const deactivateAdmin        = (userId) => api.delete(`/superadmin/admins/${userId}`).then((r) => r.data);
export const getSuperAdminScrapers  = () => api.get('/superadmin/scrapers').then((r) => r.data);
export const getSuperAdminAuditLogs = (params) => api.get('/superadmin/audit-logs', { params }).then((r) => r.data);

// ── Moderator API ─────────────────────────────────────────────────
export const getModeratorStats       = () => api.get('/moderator/stats').then((r) => r.data);
export const getInterviewSubmissions = (params) => api.get('/moderator/interview-submissions', { params }).then((r) => r.data);
export const approveSubmission       = (id) => api.post(`/moderator/interview-submissions/${id}/approve`).then((r) => r.data);
export const rejectSubmission        = (id, data) => api.post(`/moderator/interview-submissions/${id}/reject`, data).then((r) => r.data);
export const getSalaryContributions  = () => api.get('/moderator/salary-contributions').then((r) => r.data);
export const validateContribution    = (id, data) => api.post(`/moderator/salary-contributions/${id}/validate`, data).then((r) => r.data);

export default api;
