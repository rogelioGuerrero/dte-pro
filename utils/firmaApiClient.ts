export interface FirmaApiResponse {
  status?: string;
  body?: string | { codigo?: string; mensaje?: string | string[] };
  message?: string;
  error?: string;
}

const BASE_URL = 'https://api-firma.onrender.com';
const CONTEXT_PATH = '/firma';

const buildUrl = (path: string): string => {
  const cleanBase = BASE_URL.replace(/\/+$/, '');
  const cleanContext = CONTEXT_PATH.startsWith('/') ? CONTEXT_PATH : `/${CONTEXT_PATH}`;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanContext}${cleanPath}`;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetriableHttpStatus = (status: number): boolean => {
  return status === 502 || status === 503 || status === 504;
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

  const url = buildUrl('/firmardocumento/status');

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Timeout esperando servicio de firma')), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
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
      const errorToThrow = isTimeout ? new Error(`Timeout esperando servicio de firma (${timeoutMs}ms)`) : err;
      
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
  nit: string;
  passwordPri: string;
  dteJson: unknown;
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
}): Promise<string> => {
  const timeoutMs = params.timeoutMs ?? 30000;
  const retries = params.retries ?? 2;
  const baseDelayMs = params.baseDelayMs ?? 1000;
  const url = buildUrl('/firmardocumento/');

  // Normalizar NIT: asegurar string sin espacios ni caracteres extra
  const nit = String(params.nit).replace(/[\s-]/g, '').trim();

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
        },
        body: JSON.stringify({
          nit,
          passwordPri: params.passwordPri,
          dteJson: params.dteJson,
        }),
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') || '';
      const payload: FirmaApiResponse | string = contentType.includes('application/json')
        ? ((await res.json().catch(() => ({}))) as FirmaApiResponse)
        : await res.text().catch(() => '');

      if (!res.ok) {
        const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);

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
        throw new Error(`Respuesta inesperada del servicio de firma: ${payload}`);
      }

      if (payload.status === 'ERROR') {
        const errorBody = typeof payload.body === 'object' && payload.body !== null ? payload.body : {};
        const errorMsg = Array.isArray(errorBody.mensaje)
          ? errorBody.mensaje.join('; ')
          : (typeof errorBody.mensaje === 'string' ? errorBody.mensaje : 'Error desconocido del servicio de firma');
        const codigo = typeof errorBody.codigo === 'string' ? errorBody.codigo : 'UNKNOWN';
        throw new Error(`Error del servicio de firma (${codigo}): ${errorMsg}`);
      }

      if (payload.status !== 'OK') {
        throw new Error(`Respuesta inesperada del servicio de firma: status=${payload.status}`);
      }

      const jws = payload.body;
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

export const limpiarDteParaFirma = <T extends Record<string, unknown>>(dte: T): T => {
  const cloned = cloneObject(dte);
  delete (cloned as Record<string, unknown>).firmaElectronica;
  delete (cloned as Record<string, unknown>).selloRecibido;
  return cloned;
};
