// Configuración del Backend LangGraph
export const BACKEND_CONFIG = {
  // URL del backend (apuntando al backend en LangGraph/api-dte)
  URL: import.meta.env.VITE_BACKEND_URL || 'https://api-dte.onrender.com',
  
  // Timeouts
  TIMEOUTS: {
    CONNECTION: 15000,  // 15s (MH puede tardar hasta 15s)
    RESPONSE: 60000,    // 60s
    POLLING: 2000       // 2s entre consultas de estado
  }
};

type AuthHeaderParams = {
  token?: string | null;
  businessId?: string | null;
  adminSecret?: string | null;
};

// Headers de autenticación para llamadas al backend usando Supabase Auth
export const buildBackendHeaders = ({ token, businessId, adminSecret }: AuthHeaderParams = {}): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (businessId) {
    headers['x-business-id'] = businessId;
  }

  if (adminSecret) {
    headers['x-admin-secret'] = adminSecret;
  }

  return headers;
};

export const getBackendAuthToken = (): string | null => {
  const envToken = import.meta.env.VITE_JWT_TOKEN as string | undefined;
  if (envToken && envToken.trim()) {
    return envToken.trim();
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const storageKeys = [
    'dte_jwt_token',
    'auth_token',
    'access_token',
    'sb-access-token'
  ];

  for (const key of storageKeys) {
    const value = window.localStorage.getItem(key);
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
};
