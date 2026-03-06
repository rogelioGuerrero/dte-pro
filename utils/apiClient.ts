import { supabase } from './supabaseClient';

const baseUrl = import.meta.env.VITE_API_DTE_URL || '';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function apiFetch<T>(path: string, options: { method?: HttpMethod; body?: any; signal?: AbortSignal } = {}): Promise<T> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status} en ${path}`);
  }

  return res.json();
}
