import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1', withCredentials: true });

export const fetchJobs = async ({ limit = 20, offset = 0, minScore = 0, search = '' } = {}) => {
  const res = await api.get('/jobs', { params: { limit, offset, minScore, search } });
  return res.data;
};

export const fetchJobById = async (id) => {
  const res = await api.get(`/jobs/${id}`);
  return res.data;
};

export const fetchJobStats = async () => {
  const res = await api.get('/jobs/stats');
  return res.data;
};

export const submitJobFeedback = async (id, feedbackType) => {
  const res = await api.post(`/jobs/${id}/feedback`, { feedback_type: feedbackType });
  return res.data;
};

export const saveJob = async (id, saved) => {
  const res = await api.post(`/jobs/${id}/save`, { saved });
  return res.data;
};

export const recalculateMatches = async () => {
  const res = await api.post('/jobs/recalculate');
  return res.data;
};

export const triggerScrape = async () => {
  const res = await api.post('/jobs/trigger-scrape');
  return res.data;
};
