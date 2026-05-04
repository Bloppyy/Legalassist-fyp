import api from './axios';

export const getDeadlines       = (params) => api.get('/deadlines', { params });
export const getDeadline        = (id) => api.get(`/deadlines/${id}`);
export const createDeadline     = (data) => api.post('/deadlines', data);
export const updateDeadline     = (id, data) => api.put(`/deadlines/${id}`, data);
export const toggleComplete     = (id) => api.patch(`/deadlines/${id}/toggle-complete`);
export const deleteDeadline     = (id) => api.delete(`/deadlines/${id}`);
