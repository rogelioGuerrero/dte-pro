import { getStore, connectLambda } from '@netlify/blobs';

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  },
  body: JSON.stringify(body ?? {}),
});

const corsHeaders = (event) => {
  const origin = event.headers?.origin || event.headers?.Origin;
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (origin) {
    return {
      ...headers,
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    };
  }

  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
  };
};

const parseJsonBody = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeVendorId = (v) => {
  const raw = typeof v === 'string' ? v.trim() : '';
  const up = raw.toUpperCase();
  if (!up) return '';
  if (up.length > 32) return '';
  if (!/^[A-Z0-9_-]+$/.test(up)) return '';
  return up;
};

const cleanOld = (clients) => {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return clients.filter((c) => {
    const received = new Date(c?.receivedAt || 0).getTime();
    if (!Number.isFinite(received)) return c?.status === 'pending';
    return received > oneDayAgo || c?.status === 'pending';
  });
};

const isValidStatus = (s) => s === 'pending' || s === 'imported' || s === 'dismissed';

export const handler = async (event, context) => {
  connectLambda(event);
  const cors = corsHeaders(event);

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

  const vendorId = normalizeVendorId(event.queryStringParameters?.v);
  if (!vendorId) {
    return json(400, { error: 'Missing or invalid vendor id (v)' }, cors);
  }

  if (typeof event.body === 'string' && event.body.length > 50_000) {
    return json(413, { error: 'Payload too large' }, cors);
  }

  const store = getStore('dte-pending-clients');
  const key = `vendors/${vendorId}/clients.json`;

  let stored = null;
  try {
    stored = await store.get(key, { type: 'json' });
  } catch (err) {
    console.error('Error reading blob:', err);
    // If blob is corrupted, treat as empty
  }
  const clientsRaw = Array.isArray(stored) ? stored : [];
  const clients = cleanOld(clientsRaw);

  if (event.httpMethod === 'GET') {
    const includeAll = event.queryStringParameters?.all === '1';
    const result = includeAll ? clients : clients.filter((c) => c?.status === 'pending');
    return json(200, result, cors);
  }

  const body = parseJsonBody(event.body);
  const action = body?.action;

  if (action === 'create') {
    const data = body?.data ?? body?.clientData;
    if (!data || typeof data !== 'object') {
      return json(400, { error: 'Missing client data' }, cors);
    }

    const id = `pc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const newClient = {
      id,
      data,
      receivedAt: new Date().toISOString(),
      status: 'pending',
    };

    const next = [...clients, newClient];
    await store.setJSON(key, next);

    return json(200, { id }, cors);
  }

  if (action === 'setStatus') {
    const id = typeof body?.id === 'string' ? body.id : '';
    const status = body?.status;

    if (!id) return json(400, { error: 'Missing id' }, cors);
    if (!isValidStatus(status)) return json(400, { error: 'Invalid status' }, cors);

    let found = false;
    const next = clients.map((c) => {
      if (c?.id === id) {
        found = true;
        return { ...c, status };
      }
      return c;
    });

    if (!found) return json(404, { error: 'Not found' }, cors);

    await store.setJSON(key, next);
    return json(200, { ok: true }, cors);
  }

  return json(400, { error: 'Invalid action' }, cors);
};
