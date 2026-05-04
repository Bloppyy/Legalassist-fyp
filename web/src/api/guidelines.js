import api from './axios';

export const getGuidelines   = (params) => api.get('/court-guidelines', { params });
export const getGuideline    = (id) => api.get(`/court-guidelines/${id}`);
export const createGuideline = (data) => api.post('/court-guidelines', data);
export const updateGuideline = (id, data) => api.put(`/court-guidelines/${id}`, data);
export const deleteGuideline = (id) => api.delete(`/court-guidelines/${id}`);
export const downloadGuideline = (id) => api.get(`/court-guidelines/${id}/download`);
