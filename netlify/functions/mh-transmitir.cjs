const MH_BASE_URL_TEST = (process.env.MH_BASE_URL_TEST || 'https://apitest.dtes.mh.gob.sv').replace(/\/+$/, '');
const MH_BASE_URL_PROD = (process.env.MH_BASE_URL_PROD || 'https://api.dtes.mh.gob.sv').replace(/\/+$/, '');

const { randomUUID } = require('crypto');

let cachedToken = null;

const buildAuthorizationHeader = (token) => {
  const raw = typeof token === 'string' ? token.trim() : '';
  if (!raw) return '';
  return /^Bearer\s+/i.test(raw) ? raw : `Bearer ${raw}`;
};

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  },
  body: JSON.stringify(body ?? {}),
});

const corsHeaders = (event) => {
  const origin = event.headers?.origin || event.headers?.Origin;
  const allowedRaw = process.env.ALLOWED_ORIGINS;
  const allowedList =
    typeof allowedRaw === 'string' && allowedRaw.trim().length > 0
      ? allowedRaw
      : 'http://localhost:8888,http://127.0.0.1:8888,http://localhost:5173,http://127.0.0.1:5173';
  const allowed = allowedList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!origin) {
    return {
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }

  if (!allowed.includes(origin)) {
    return null;
  }

  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
};

const base64UrlToUtf8 = (value) => {
  if (typeof value !== 'string' || value.length === 0) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const final = padded + '='.repeat(padLen);
  try {
    return Buffer.from(final, 'base64').toString('utf8');
  } catch {
    return null;
  }
};

const parseDteFromJws = (jws) => {
  if (typeof jws !== 'string') return null;
  const parts = jws.split('.');
  if (parts.length < 2) return null;
  const payloadTxt = base64UrlToUtf8(parts[1]);
  if (!payloadTxt) return null;
  try {
    return JSON.parse(payloadTxt);
  } catch {
    // Algunos JWS vienen con payload "parecido a JSON" pero no estrictamente parseable (por saltos de línea, etc.).
    // Para transmisión a MH solo necesitamos ciertos campos de identificacion; extraerlos por regex.
    const getStr = (re) => {
      const m = payloadTxt.match(re);
      return m && typeof m[1] === 'string' ? m[1] : undefined;
    };

    const getNum = (re) => {
      const m = payloadTxt.match(re);
      if (!m || typeof m[1] !== 'string') return undefined;
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : undefined;
    };

    const version = getNum(/"version"\s*:\s*(\d+)/);
    const tipoDte = getStr(/"tipoDte"\s*:\s*"([^"]+)"/);
    const codigoGeneracion = getStr(/"codigoGeneracion"\s*:\s*"([^"]+)"/);
    const ambiente = getStr(/"ambiente"\s*:\s*"(00|01)"/);

    if (!version && !tipoDte && !codigoGeneracion) return null;

    return {
      identificacion: {
        version,
        tipoDte,
        codigoGeneracion,
        ambiente,
      },
    };
  }
};

const obtenerTokenMH = async (baseUrl) => {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt) return cachedToken.token;

  const MH_USER = process.env.MH_USER || '';
  const MH_PWD = process.env.MH_PWD || '';

  if (!MH_USER || !MH_PWD) {
    throw new Error('Missing MH_USER/MH_PWD. Configure them in Netlify env vars.');
  }

  const body = new URLSearchParams({
    user: MH_USER,
    pwd: MH_PWD,
  });

  const res = await fetch(`${baseUrl}/seguridad/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'DTE-CONVERTER',
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.status !== 'OK' || !data?.body?.token) {
    throw new Error(`Auth MH failed: ${res.status} ${JSON.stringify(data)}`);
  }

  const tokenValue = data.body.token;
  if (typeof tokenValue !== 'string' || !tokenValue) {
    throw new Error(`Auth MH returned invalid token: ${JSON.stringify(data)}`);
  }

  const expiresInSec = 60 * 60;
  cachedToken = {
    token: tokenValue,
    expiresAt: now + Math.max(30, expiresInSec - 30) * 1000,
  };

  return cachedToken.token;
};

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin;
  const allowedRaw = process.env.ALLOWED_ORIGINS;
  const allowedList =
    typeof allowedRaw === 'string' && allowedRaw.trim().length > 0
      ? allowedRaw
      : 'http://localhost:8888,http://127.0.0.1:8888,http://localhost:5173,http://127.0.0.1:5173';
  const allowed = allowedList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Debug logging para identificar el problema
  console.log('Request origin:', origin);
  console.log('ALLOWED_ORIGINS env var:', allowedRaw);
  console.log('Parsed allowed origins:', allowed);

  const cors = corsHeaders(event);
  if (!cors) {
    console.log('CORS denied for origin:', origin);
    return json(403, { error: 'CORS denied', origin, allowed });
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: cors,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, cors);
  }

  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' }, cors);
  }

  const ambiente = payload?.ambiente === '01' ? '01' : '00';
  const baseUrl = ambiente === '01' ? MH_BASE_URL_PROD : MH_BASE_URL_TEST;

  if (payload?.authOnly === true) {
    try {
      const hasUser = Boolean(process.env.MH_USER);
      const hasPwd = Boolean(process.env.MH_PWD);
      const token = await obtenerTokenMH(baseUrl);
      return json(200, { status: 'OK', hasUser, hasPwd }, cors);
    } catch (err) {
      const msg = err?.message || '';
      let mhPayload;
      try {
        const idx = msg.indexOf('{');
        if (idx >= 0) mhPayload = JSON.parse(msg.slice(idx));
      } catch {
        mhPayload = undefined;
      }

      if (mhPayload?.body) {
        const body = mhPayload.body;
        return json(
          200,
          {
            status: mhPayload.status || 'ERROR',
            codigoMsg: body.codigoMsg,
            descripcionMsg: body.descripcionMsg,
            clasificaMsg: body.clasificaMsg,
          },
          cors
        );
      }

      return json(
        200,
        {
          status: 'ERROR',
          message: err?.message || 'Auth error',
          hasUser: Boolean(process.env.MH_USER),
          hasPwd: Boolean(process.env.MH_PWD),
        },
        cors
      );
    }
  }

  const dte = payload?.dte;

  if (!dte || typeof dte !== 'string') {
    return json(400, { error: 'Body must include { dte: string }' }, cors);
  }

  try {
    const token = await obtenerTokenMH(baseUrl);

    const dteJson = parseDteFromJws(dte);
    const identificacion = dteJson?.identificacion || payload?.identificacion || {};
    const version = typeof identificacion.version === 'number' ? identificacion.version : undefined;
    const tipoDte = typeof identificacion.tipoDte === 'string' ? identificacion.tipoDte : undefined;
    const codigoGeneracion = typeof identificacion.codigoGeneracion === 'string' ? identificacion.codigoGeneracion : undefined;

    if (!version || !tipoDte || !codigoGeneracion) {
      return json(
        400,
        {
          error: 'No se pudieron extraer campos requeridos del JWS (identificacion.version, identificacion.tipoDte, identificacion.codigoGeneracion).',
        },
        cors
      );
    }

    const idEnvio = Date.now();

    const mhRes = await fetch(`${baseUrl}/fesv/recepciondte`, {
      method: 'POST',
      headers: {
        Authorization: buildAuthorizationHeader(token),
        'Content-Type': 'application/json',
        'User-Agent': event.headers?.['user-agent'] || event.headers?.['User-Agent'] || 'DTE-CONVERTER',
        'X-Request-ID': randomUUID(),
        'X-Ambiente': ambiente,
      },
      body: JSON.stringify({
        ambiente,
        idEnvio,
        version,
        tipoDte,
        documento: dte,
        codigoGeneracion,
      }),
    });

    const data = await mhRes.json().catch(() => ({}));
    // Debug: log completo para ver qué devuelve MH
    console.log('MH response status:', mhRes.status);
    console.log('MH response body:', JSON.stringify(data, null, 2));
    return json(mhRes.ok ? 200 : mhRes.status, data, cors);
  } catch (err) {
    return json(500, { error: err?.message || 'Internal error' }, cors);
  }
};
