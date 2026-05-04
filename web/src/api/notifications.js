import api from './axios';

export const getNotifications = (params) => api.get('/notifications', { params });
export const markRead         = (id) => api.patch(`/notifications/${id}/read`);
export const markAllRead      = () => api.patch('/notifications/read-all');
