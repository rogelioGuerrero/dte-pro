// Configuración del Backend LangGraph
export const BACKEND_CONFIG = {
  // URL del backend (apuntando al backend en Render)
  URL: import.meta.env.VITE_BACKEND_URL || 'https://api-dte.onrender.com',
  
  // Autenticación
  AUTH: {
    // JWT Bearer Token (requerido por el contrato)
    JWT_TOKEN: import.meta.env.VITE_JWT_TOKEN || '',
    
    // API Key (opcional, según configuración)
    API_KEY: import.meta.env.VITE_API_KEY || '',
    
    // Método de autenticación (por defecto 'bearer')
    METHOD: (import.meta.env.VITE_AUTH_METHOD || 'bearer') as 'bearer' | 'apikey' | 'none'
  },
  
  // Configuración del negocio (requerido por el contrato)
  BUSINESS_ID: import.meta.env.VITE_BUSINESS_ID || 'uuid-business-temporal',
  
  // Timeouts
  TIMEOUTS: {
    CONNECTION: 15000,  // 15s (MH puede tardar hasta 15s)
    RESPONSE: 60000,    // 60s
    POLLING: 2000       // 2s entre consultas de estado
  }
};

// Headers de autenticación para llamadas al backend
export const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  switch (BACKEND_CONFIG.AUTH.METHOD) {
    case 'bearer':
      if (BACKEND_CONFIG.AUTH.JWT_TOKEN) {
        headers['Authorization'] = `Bearer ${BACKEND_CONFIG.AUTH.JWT_TOKEN}`;
      }
      break;
    case 'apikey':
      if (BACKEND_CONFIG.AUTH.API_KEY) {
        headers['x-api-key'] = BACKEND_CONFIG.AUTH.API_KEY;
      }
      break;
  }

  return headers;
};
