import api from './axios';

export const getAggregateEvaluation = () => api.get('/evaluation/aggregate');
export const runBatchEvaluation     = () => api.post('/evaluation/run-batch');
