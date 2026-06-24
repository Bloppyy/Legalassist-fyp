import api from './axios';

export const getCaseStages          = (caseId) => api.get('/case-stages', { params: { case_id: caseId } });
export const getUpcomingCaseStages  = (days) => api.get('/case-stages', { params: { upcoming_days: days } });
export const getCaseStageStats      = () => api.get('/case-stages/stats');
export const createCaseStage        = (data) => api.post('/case-stages', data);
export const updateCaseStage        = (id, data) => api.patch(`/case-stages/${id}`, data);
export const deleteCaseStage        = (id) => api.delete(`/case-stages/${id}`);
export const toggleCaseStageComplete = (id) => api.patch(`/case-stages/${id}/complete`);
export const downloadStageFile      = (id) => api.get(`/case-stages/${id}/download`);
export const parseDirection         = (caseId, formData) =>
  api.post(`/case-stages/${caseId}/parse-direction`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const parseDirectionText     = (caseId, text) =>
  api.post(`/case-stages/${caseId}/parse-direction`, { text });
