import api from './axios';

export const getCases       = (params) => api.get('/cases', { params });
export const getCase        = (id) => api.get(`/cases/${id}`);
export const getCaseHistory = (id) => api.get(`/cases/${id}/history`);
export const createCase     = (data) => api.post('/cases', data);
export const updateCase     = (id, data) => api.put(`/cases/${id}`, data);
export const deleteCase     = (id) => api.delete(`/cases/${id}`);
