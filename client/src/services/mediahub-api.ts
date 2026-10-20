import { apiClient } from './api-client';
export type ApiEnvelope<T> = { data: T };
export type ApiInfo = { name: string; version: string };
/** Public Phase 5 endpoint, retained as a future connectivity check. */
export const getApiInfo = () => apiClient<ApiEnvelope<ApiInfo>>('');
