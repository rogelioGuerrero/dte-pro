import { getBackendAuthToken } from './backendConfig';

export interface FirmaApiResponse {
  status?: string;
  body?: string | { codigo?: string; mensaje?: string | string[] };
  message?: string;
  error?: string;
}

export interface MHError {
  codigo: string;
  campo?: string;
  descripcion: string;
  severidad?: string;
  valorEsperado?: string;
  valorActual?: string;
}

export interface MHWarning {
  codigo: string;
  campo?: string;
  descripcion: string;
  severidad?: 'BAJA' | 'MEDIA' | 'ALTA';
}

export interface MHResponse {
  success: boolean;
  estado?: 'PROCESADO' | 'ACEPTADO' | 'ACEPTADO_CON_ADVERTENCIAS' | 'RECHAZADO';
  codigoGeneracion?: string;
  selloRecepcion?: string;
  numeroControl?: string;
  fechaHoraRecepcion?: string;
  fechaHoraProcesamiento?: string;
  mensaje?: string;
  enlaceConsulta?: string;
  advertencias?: MHWarning[];
  errores?: MHError[];
}

export interface SignDTERequest {
  dte: Record<string, unknown>;
  passwordPri: string;
}

export interface SignDTEResponse {
  signed?: boolean;
  signature?: string;
  dte?: Record<string, unknown>;
}

export interface TransmitDTERequest {
  dte: Record<string, unknown>;
  passwordPri: string;
  ambiente?: '00' | '01';
}

export interface TransmitDTEResponse {
  transmitted?: boolean;
  mhResponse?: MHResponse;
  signature?: string;
  isOffline?: boolean;
  contingencyReason?: string | null;
}

const BASE_URL = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_DTE_URL || '') as string;
const CONTEXT_PATH: string = '';

const buildUrl = (path: string): string => {
  if (!BASE_URL) {
    throw new Error('Backend URL no configurada. Define VITE_BACKEND_URL o VITE_API_DTE_URL en tus variables de entorno.');
  }
  const cleanBase = BASE_URL.replace(/\/+$/, '');
  const cleanContext = CONTEXT_PATH
    ? (CONTEXT_PATH.startsWith('/') ? CONTEXT_PATH : `/${CONTEXT_PATH}`)
    : '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanContext}${cleanPath}`;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetriableHttpStatus = (status: number): boolean => {
  return status === 502 || status === 503 || status === 504;
};

const buildAuthHeaders = (): Record<string, string> => {
  const token = getBackendAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const cloneObject = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

export const wakeFirmaService = async (opts?: {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}): Promise<void> => {
  const retries = opts?.retries ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 1000;
  const timeoutMs = opts?.timeoutMs ?? 15000;

  const url = buildUrl('/api/dte/sign');

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Timeout esperando servicio de firma')), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          Accept: 'application/json',
          ...buildAuthHeaders(),
        },
        signal: controller.signal,
      });

      if (!res.ok && res.status !== 204 && res.status !== 405) {
        const txt = await res.text().catch(() => '');
        if (isRetriableHttpStatus(res.status) && attempt < retries) {
          await sleep(baseDelayMs * Math.pow(2, attempt));
          continue;
        }
        throw new Error(`Healthcheck falló (HTTP ${res.status}): ${txt}`);
      }

      return;
    } catch (err: any) {
      // Detectar Timeout
      const isTimeout = err.name === 'AbortError' || err.message?.includes('Timeout');
      const errorToThrow = isTimeout
        ? new Error('El servicio de firma tardó más de lo esperado. Reintenta en unos segundos.')
        : err;
      
      lastError = errorToThrow;
      
      if (attempt < retries) {
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }
      throw errorToThrow;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No se pudo despertar el servicio de firma');
};

export const firmarDocumento = async (params: {
  passwordPri: string;
  dteJson: unknown;
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
}): Promise<string> => {
  const timeoutMs = params.timeoutMs ?? 30000;
  const retries = params.retries ?? 2;
  const baseDelayMs = params.baseDelayMs ?? 1000;
  const url = buildUrl('/api/dte/sign');

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Timeout firmando documento')), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'application/json',
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({
          passwordPri: params.passwordPri,
          dte: params.dteJson,
        }),
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') || '';
      const payload: SignDTEResponse | FirmaApiResponse | string = contentType.includes('application/json')
        ? ((await res.json().catch(() => ({}))) as SignDTEResponse | FirmaApiResponse)
        : await res.text().catch(() => '');

      if (!res.ok) {
        const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);

        if (res.status === 401) {
          throw new Error('Sesión expirada o token faltante. Inicia sesión nuevamente para firmar el documento.');
        }

        if (res.status === 400) {
          throw new Error(`Firma falló (HTTP 400): ${detail}`);
        }

        if (isRetriableHttpStatus(res.status) && attempt < retries) {
          await sleep(baseDelayMs * Math.pow(2, attempt));
          continue;
        }
        throw new Error(`Firma falló (HTTP ${res.status}): ${detail}`);
      }

      if (typeof payload === 'string') {
        throw new Error(`Respuesta inesperada del backend de firma: ${payload}`);
      }

      if ('status' in payload && payload.status === 'ERROR') {
        const errorBody = typeof payload.body === 'object' && payload.body !== null ? payload.body : {};
        const errorMsg = Array.isArray(errorBody.mensaje)
          ? errorBody.mensaje.join('; ')
          : (typeof errorBody.mensaje === 'string' ? errorBody.mensaje : 'Error desconocido del servicio de firma');
        const codigo = typeof errorBody.codigo === 'string' ? errorBody.codigo : 'UNKNOWN';
        throw new Error(`Error del servicio de firma (${codigo}): ${errorMsg}`);
      }

      const jws = 'signature' in payload ? payload.signature : undefined;
      if (typeof jws !== 'string' || !jws) {
        throw new Error(`Firma sin body o body no es string. Respuesta: ${JSON.stringify(payload)}`);
      }

      return jws;
    } catch (err: any) {
      // Detectar Timeout
      const isTimeout = err.name === 'AbortError' || err.message?.includes('Timeout');
      const errorToThrow = isTimeout ? new Error(`Timeout firmando documento (${timeoutMs}ms)`) : err;
      
      lastError = errorToThrow;

      if (attempt < retries) {
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }

      throw errorToThrow;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No se pudo firmar el documento');
};

export const transmitirDocumento = async (params: {
  dte: Record<string, unknown>;
  passwordPri: string;
  ambiente?: '00' | '01';
  timeoutMs?: number;
}): Promise<TransmitDTEResponse> => {
  const timeoutMs = params.timeoutMs ?? 45000;
  const url = buildUrl('/api/dte/transmit');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Timeout transmitiendo documento')), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
        ...buildAuthHeaders(),
      },
      body: JSON.stringify({
        dte: params.dte,
        passwordPri: params.passwordPri,
        ambiente: params.ambiente ?? '00',
      }),
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? ((await res.json().catch(() => ({}))) as TransmitDTEResponse)
      : await res.text().catch(() => '');

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Sesión expirada o token faltante. Inicia sesión nuevamente para transmitir el documento.');
      }

      const detail = typeof payload === 'string'
        ? payload
        : payload?.mhResponse?.mensaje || JSON.stringify(payload);
      throw new Error(detail || `Transmisión falló (HTTP ${res.status})`);
    }

    if (typeof payload === 'string') {
      throw new Error(`Respuesta inesperada del backend: ${payload}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

export const limpiarDteParaFirma = <T extends Record<string, unknown>>(dte: T): T => {
  const cloned = cloneObject(dte);
  delete (cloned as Record<string, unknown>).firmaElectronica;
  delete (cloned as Record<string, unknown>).selloRecibido;
  return cloned;
};
