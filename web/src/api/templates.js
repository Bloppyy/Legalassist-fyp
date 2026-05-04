import api from './axios';

export const getTemplates    = (params) => api.get('/templates', { params });
export const getTemplate     = (id) => api.get(`/templates/${id}`);
export const createTemplate  = (data) => api.post('/templates', data);
export const updateTemplate  = (id, data) => api.put(`/templates/${id}`, data);
export const deleteTemplate  = (id) => api.delete(`/templates/${id}`);
export const downloadTemplate = (id) => api.get(`/templates/${id}/download`);

export const getCategories      = () => api.get('/template-categories');
export const getCategory        = (id) => api.get(`/template-categories/${id}`);
export const createCategory     = (data) => api.post('/template-categories', data);
export const updateCategory     = (id, data) => api.put(`/template-categories/${id}`, data);
export const deleteCategory     = (id) => api.delete(`/template-categories/${id}`);
