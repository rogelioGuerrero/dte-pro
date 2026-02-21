const MH_BASE_URL = (process.env.MH_BASE_URL || 'https://api-sandbox.mh.gob.sv').replace(/\/+$/, '');
const MH_CLIENT_ID = process.env.MH_CLIENT_ID || '';
const MH_CLIENT_SECRET = process.env.MH_CLIENT_SECRET || '';
const MH_SCOPE = process.env.MH_SCOPE || 'dte.transmitir dte.consultar';
const MH_CONSULTA_PATH = process.env.MH_CONSULTA_PATH || '/dte/v1/consultar';

const { randomUUID } = require('crypto');

let cachedToken = null;

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
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }

  if (!allowed.includes(origin)) {
    return null;
  }

  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
};

const obtenerTokenMH = async () => {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt) return cachedToken.token;

  if (!MH_CLIENT_ID || !MH_CLIENT_SECRET) {
    throw new Error('Missing MH_CLIENT_ID/MH_CLIENT_SECRET. Configure them in Netlify env vars.');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: MH_CLIENT_ID,
    client_secret: MH_CLIENT_SECRET,
    scope: MH_SCOPE,
  });

  const res = await fetch(`${MH_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(`Auth MH failed: ${res.status} ${JSON.stringify(data)}`);
  }

  const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  cachedToken = {
    token: data.access_token,
    expiresAt: now + Math.max(30, expiresInSec - 30) * 1000,
  };

  return cachedToken.token;
};

const parseJsonBody = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

exports.handler = async (event) => {
  const cors = corsHeaders(event);
  if (!cors) return json(403, { error: 'CORS denied' });

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: cors,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, cors);
  }

  const ambiente = event.queryStringParameters?.ambiente === '01' ? '01' : '00';

  const baseMarker = '/.netlify/functions/mh-consulta';
  const pathTail = typeof event.path === 'string' ? event.path.split(baseMarker)[1] || '' : '';
  const codigoRaw = pathTail.replace(/^\/+/, '');

  const token = await obtenerTokenMH();

  const url = new URL(`${MH_BASE_URL}${MH_CONSULTA_PATH}${codigoRaw ? `/${encodeURIComponent(codigoRaw)}` : ''}`);

  const qsp = event.queryStringParameters || {};
  for (const key of Object.keys(qsp)) {
    if (key === 'ambiente') continue;
    const val = qsp[key];
    if (typeof val === 'string' && val.length > 0) url.searchParams.set(key, val);
  }

  const bodyObj = event.httpMethod === 'POST' ? parseJsonBody(event.body) : null;

  const mhRes = await fetch(url.toString(), {
    method: event.httpMethod,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Request-ID': randomUUID(),
      'X-Ambiente': ambiente,
    },
    body: event.httpMethod === 'POST' ? JSON.stringify(bodyObj ?? {}) : undefined,
  });

  const data = await mhRes.json().catch(() => ({}));
  return json(mhRes.ok ? 200 : mhRes.status, data, cors);
};
