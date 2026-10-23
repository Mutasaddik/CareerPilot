import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1', withCredentials: true });

// Market update for the user's own role, from real job ads
export const fetchMarketUpdate = async () => {
  const res = await api.get('/market/me');
  return res.data;
};
