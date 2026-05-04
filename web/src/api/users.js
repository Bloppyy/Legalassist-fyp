import api from './axios';

export const getMe                  = () => api.get('/users/me');
export const updateMe               = (data) => api.put('/users/me', data);
export const getUsers               = (params) => api.get('/users', { params });
export const createUser             = (data) => api.post('/users', data);
export const updateUserRole         = (id, role) => api.put(`/users/${id}/role`, { role });
export const updateUserSupervisor   = (id, supervisor_id) => api.put(`/users/${id}/supervisor`, { supervisor_id });
export const deleteUser             = (id) => api.delete(`/users/${id}`);
