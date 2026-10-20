export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
    requestId?: string;
  };
};
export class ApiError extends Error {
  public readonly code: string;
  public readonly details?: ApiErrorBody['error']['details'];
  public readonly requestId?: string;
  public readonly status: number;
  public constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.requestId = body.requestId;
  }
}
type RequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: HeadersInit;
};
/** Calls the Vite proxy and includes the secure Phase 6 session cookie. */
export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers: requestHeaders, ...requestOptions } = options;
  const headers = new Headers(requestHeaders);
  const hasBody = body !== undefined;
  if (hasBody) headers.set('content-type', 'application/json');
  const response = await fetch(`/api/v1${path}`, {
    ...requestOptions,
    headers,
    credentials: 'include',
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json();
  if (!response.ok) throw new ApiError(response.status, (payload as ApiErrorBody).error);
  return payload as T;
}
