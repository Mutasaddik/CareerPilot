import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1', withCredentials: true });

// Upload a CV file
export const uploadCV = async ({ file, usageScope = 'primary', companyName = '', jobId = '', templatePreference = 'modern' }, onUploadProgress) => {
  const formData = new FormData();
  formData.append('cv', file);
  formData.append('usageScope', usageScope);
  formData.append('companyName', companyName);
  formData.append('jobId', jobId);
  formData.append('templatePreference', templatePreference);

  const response = await api.post('/cv/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onUploadProgress) {
        const pct = Math.round((e.loaded * 100) / e.total);
        onUploadProgress(pct);
      }
    },
  });
  return response.data;
};

// Get all CVs for current user
export const getAllCVs = async () => {
  const response = await api.get('/cv');
  return response.data;
};

// Get single CV by ID
export const getCVById = async (cvId) => {
  const response = await api.get(`/cv/${cvId}`);
  return response.data;
};

// Set a CV as primary
export const setCVPrimary = async (cvId) => {
  const response = await api.patch(`/cv/${cvId}/set-primary`);
  return response.data;
};

// Update CV scope (primary / company / job)
export const updateCVScope = async (cvId, { usageScope, companyName, jobId }) => {
  const response = await api.patch(`/cv/${cvId}/scope`, { usageScope, companyName, jobId });
  return response.data;
};

// Delete a CV
export const deleteCV = async (cvId) => {
  const response = await api.delete(`/cv/${cvId}`);
  return response.data;
};

// Trigger re-analysis of an existing CV
export const reanalyzeCV = async (cvId) => {
  const response = await api.post(`/cv/${cvId}/analyze`);
  return response.data;
};

// ── AI-rewritten CVs ──────────────────────────────────────────────
// General rewrite when jobId is empty; cvId defaults to the primary CV
export const createCVRewrite = async ({ cvId, jobId } = {}) => {
  const response = await api.post('/cv/rewrite', { cvId, jobId });
  return response.data;
};

export const getCVRewrites = async () => {
  const response = await api.get('/cv/rewrites');
  return response.data;
};

export const getCVRewrite = async (rewriteId) => {
  const response = await api.get(`/cv/rewrites/${rewriteId}`);
  return response.data;
};

export const updateCVRewrite = async (rewriteId, cv) => {
  const response = await api.put(`/cv/rewrites/${rewriteId}`, { cv });
  return response.data;
};

export const deleteCVRewrite = async (rewriteId) => {
  const response = await api.delete(`/cv/rewrites/${rewriteId}`);
  return response.data;
};
