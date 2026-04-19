/**
 * Netlify Function: news-proxy
 * Proxy para GNews API - evita CORS desde el browser.
 * URL: /.netlify/functions/news-proxy?q=economia&lang=es&max=10
 * La API key se lee del query param `apikey` enviado por el cliente.
 */
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const { q = 'economia negocios', lang = 'es', max = '10', apikey } = event.queryStringParameters || {};

  if (!apikey) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing apikey parameter' }),
    };
  }

  try {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=${lang}&max=${max}&apikey=${apikey}`;
    const res = await fetch(url);
    const data = await res.json();

    return {
      statusCode: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
