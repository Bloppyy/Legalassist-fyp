import api from './axios';

// Checklist templates
export const getTemplates       = () => api.get('/checklist-templates');
export const createTemplate     = (data) => api.post('/checklist-templates', data);
export const updateTemplate     = (id, data) => api.put(`/checklist-templates/${id}`, data);
export const deleteTemplate     = (id) => api.delete(`/checklist-templates/${id}`);
export const addTemplateItem    = (id, data) => api.post(`/checklist-templates/${id}/items`, data);
export const updateTemplateItem = (id, itemId, data) => api.put(`/checklist-templates/${id}/items/${itemId}`, data);
export const removeTemplateItem = (id, itemId) => api.delete(`/checklist-templates/${id}/items/${itemId}`);

// Case checklist
export const getCaseChecklist   = (caseId) => api.get(`/cases/${caseId}/checklist`);
export const applyTemplate      = (caseId, template_id) => api.post(`/cases/${caseId}/checklist/apply-template`, { template_id });
export const addCaseItem        = (caseId, data) => api.post(`/cases/${caseId}/checklist/items`, data);
export const updateCaseItem     = (caseId, itemId, data) => api.patch(`/cases/${caseId}/checklist/items/${itemId}`, data);
export const deleteCaseItem     = (caseId, itemId) => api.delete(`/cases/${caseId}/checklist/items/${itemId}`);
export const matchDirection     = (caseId, required_actions) => api.post(`/cases/${caseId}/checklist/match-direction`, { required_actions });
