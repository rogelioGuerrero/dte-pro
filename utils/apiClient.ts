import { getBackendAuthToken } from './backendConfig';

const baseUrl = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_DTE_URL || '') as string;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function apiFetch<T>(path: string, options: { method?: HttpMethod; body?: any; signal?: AbortSignal } = {}): Promise<T> {
  if (!baseUrl) {
    throw new Error('Backend URL no configurada. Define VITE_BACKEND_URL (recomendado) o VITE_API_DTE_URL en tus variables de entorno.');
  }
  const url = `${baseUrl}${path}`;
  const token = getBackendAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      window.localStorage.removeItem('dte_jwt_token');
      window.dispatchEvent(
        new CustomEvent('dte-backend-auth-error', {
          detail: {
            status: res.status,
            message: text,
            path
          }
        })
      );
    }
    throw new Error(text || `Error ${res.status} en ${path}`);
  }

  if (!isJson) {
    // return text as any to avoid JSON parse crash
    const text = await res.text();
    return text as unknown as T;
  }

  return res.json();
}
