import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1', withCredentials: true });

// All tracked applications + funnel stats
export const fetchApplications = async () => {
  const res = await api.get('/applications');
  return res.data;
};

// Track a job from the feed — calling it again just updates the status
export const trackJob = async (jobId, status = 'applied') => {
  const res = await api.post('/applications', { jobId, status });
  return res.data;
};

// Track a job found outside CareerPilot
export const createApplication = async ({ jobTitle, company, jobUrl, location, status, notes }) => {
  const res = await api.post('/applications', { jobTitle, company, jobUrl, location, status, notes });
  return res.data;
};

// fields: status, notes, followUpDate, appliedDate, offerSalaryBdt, jobTitle, company, jobUrl, location
export const updateApplication = async (id, fields) => {
  const res = await api.patch(`/applications/${id}`, fields);
  return res.data;
};

export const deleteApplication = async (id) => {
  const res = await api.delete(`/applications/${id}`);
  return res.data;
};
