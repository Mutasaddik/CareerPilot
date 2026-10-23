import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1', withCredentials: true });

// Certifications for the user's profession: asked for in real ads first,
// then ones recognised in the field (clearly labelled, no numbers)
export const fetchMyCertifications = async () => {
  const res = await api.get('/certifications/me');
  return res.data;
};
