import api from './axios';

export const getDocuments      = (params) => api.get('/documents', { params });
export const getDocument       = (id) => api.get(`/documents/${id}`);
export const createDocument    = (data) => api.post('/documents', data);
export const updateDocument    = (id, data) => api.put(`/documents/${id}`, data);
export const deleteDocument    = (id) => api.delete(`/documents/${id}`);
export const downloadDocument  = (id) => api.get(`/documents/${id}/download`);
export const reuploadDocument  = (id, data) => api.post(`/documents/${id}/reupload`, data);

// Approval workflow
export const submitDocument    = (id) => api.patch(`/documents/${id}/submit`);
export const escalateDocument  = (id, data) => api.patch(`/documents/${id}/escalate`, data);
export const approveDocument   = (id) => api.patch(`/documents/${id}/approve`);
export const rejectDocument    = (id, data) => api.patch(`/documents/${id}/reject`, data);
export const fileDocument      = (id, data) => api.patch(`/documents/${id}/file`, data);
export const serveDocument     = (id) => api.patch(`/documents/${id}/serve`);

// AI
export const checkCompliance   = (id, data) => api.post(`/documents/${id}/check-compliance`, data);
export const checkSimilarity   = (id, data) => api.post(`/documents/${id}/check-similarity`, data);
export const extractEntities   = (id) => api.get(`/documents/${id}/entities`);
export const classifyDoc       = (id) => api.post(`/documents/${id}/classify`);

// Pre-filing validation
export const uploadFilingPdf      = (id, data) => api.post(`/documents/${id}/upload-filing-pdf`, data);
export const stripAnnotationsDoc  = (id) => api.post(`/documents/${id}/strip-annotations`);
