import api from './axios';

export const getFirmDeadlines  = (params) => api.get('/firm-deadlines', { params });
export const getFirmDeadline   = (id) => api.get(`/firm-deadlines/${id}`);
export const createFirmDeadline = (data) => api.post('/firm-deadlines', data);
export const updateFirmDeadline = (id, data) => api.put(`/firm-deadlines/${id}`, data);
export const toggleFirmDeadline = (id) => api.patch(`/firm-deadlines/${id}/toggle-complete`);
export const deleteFirmDeadline = (id) => api.delete(`/firm-deadlines/${id}`);
